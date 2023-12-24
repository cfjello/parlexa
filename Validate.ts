import { assert } from "https://deno.land/std@0.208.0/assert/assert.ts";
import { ParseFuncState, ValidationRT } from "./types.ts";
import * as Colors from "https://deno.land/std/fmt/colors.ts" 
import { fail } from "https://deno.land/std@0.208.0/assert/fail.ts";


export class Validate {
    private static instance: Validate | null = null;
    public debug = false
    constructor( debug = false ) {
        this.debug = debug
    }

    __debug__ = (msg: string): void =>  this.debug ? console.debug(msg): undefined

    getIndent = (level: number, filler = '  ') => Array<string>(level).fill(filler, 0 ).join('')

    getMulti = (multi: string): number[] => {
        let res: number[] = [] 
        try {
            const [minS, maxS] = multi.split(':')
            const min = parseInt(minS)
            const max = maxS === 'm' ? Number.MAX_SAFE_INTEGER : parseInt(maxS)
            res = [min, max]
        }
        catch(err) {
            throw err
        }
        return res
    }

    //
    // Validation functions
    //
    alreadyMatched = ( s: Partial<ParseFuncState<unknown>>): boolean => s.funcRet?.status.includes('alreadyMatched') ?? false

    branchFailed = ( s: Partial<ParseFuncState<unknown>>): boolean => s.funcRet?.status.includes('branchFailed') ?? false 
    
    /*
    export const parserFailed = ( s: Partial<ParseFuncState<unknown>>): boolean => { 
        const ret = s.funcRet?.status.includes('parserFailed')
        return ret ?? false
    }
    */
    //
    // Progress functions
    //
    progress = (s: ParseFuncState<unknown>, pos: number) : boolean => pos > s.isc.goingInPos 

    inRange  = (s: ParseFuncState<unknown>): boolean => { 
        let ret = false
        if ( s.funcRet ) {
        const rtOffset = s.funcRet.branchFailed() ? -1 : -0 
        ret = (s.isc.roundTrips + rtOffset) >= s.funcRet.min && (s.isc.roundTrips + rtOffset) <= s.funcRet.max 
        }
        return ret
    }

    matched = (s: ParseFuncState<unknown>, pos: number): boolean => ( ! this.branchFailed(s) && this.progress(s, pos) && this.inRange(s) ) 
    /*
    export const orGroupMatched = (s: ParseFuncState<unknown>): boolean => {
        let isMatched = false
        if ( s.iMatcher.logic  === 'or' ) {
            isMatched = true // for now we assume isMatched even tough we do not know yet
            const [min, max] = getMulti( s.iMatcher.multi )
            isMatched = s.mRec.matchCnt >= min && s.mRec.matchCnt <= max 
        }
        return isMatched
    }
    */
    tryNextExpectEntry = (s: ParseFuncState<unknown>): ValidationRT => {
        let isMatched: ValidationRT = { ok: false, err: '' }
        const iMatcher = s.matchers[s.matchers.length-1]

        if ( this.branchFailed(s) ) {
            isMatched = { ok: false, err: 'Branch Failed' }
        }
        else if ( iMatcher.matchCnt > s.funcRet.max ) {
            isMatched = { ok: false, err: 'Max allowed matches reached' }
        }
        else if ( iMatcher.logicLast ) {
            isMatched = this.validLogicGroup(s)
        }
        else if ( iMatcher.logic  === 'xor' || iMatcher.logic  === 'or' ) {
            isMatched.ok = true // for now we assume isMatched even tough we do not know yet
        }
        else if ( iMatcher.logic  === 'none' ) {
            const [min, max] = this.getMulti( iMatcher.multi )
            isMatched = ( s.mRec.matchCnt >= min && s.mRec.matchCnt <= max ) ? { ok: true, err: '' } : { ok: false, err: 'Match count out of range' }
        }
        else {
            throw Error(`Parse() - Unhandled logic: ${iMatcher.logic}`)
        }
        return isMatched
    }

    matchOutOfRange = (s: ParseFuncState<unknown>, idx = s.matchers.length -1): boolean => {
        let ret = false
        const iMatcher = s.matchers[idx]
        if ( iMatcher.logic  === 'none' ) {
            const [min, max] = this.getMulti( iMatcher.multi )
            ret = s.mRec.matchCnt < min || s.mRec.matchCnt > max 
        }
        return ret
    }
    /*
    validParseMatchCnt = (s: ParseFuncState<unknown>, pos: number ): boolean => {
        let ret = true
        if ( s.mRec.matchCnt > s.eMap.max ) {
            __debug__(Colors.gray(`${getIndent(s.isc.level+1)}Parse() Skips ${s.isc.tokenStr}(${s.isc.level}) at ${pos} (max reached)`))
            ret = false
        }
        else if ( s.mRec.matchCnt < s.eMap.min ) {
            __debug__(Colors.gray(`${getIndent(s.isc.level+1)}Parse() Skips ${s.isc.tokenStr}(${s.isc.level}) at ${pos} (min not reached)`))
            ret = false
        }
        // }
        return ret
    }

    validFinalMatchCnt = (s: ParseFuncState<unknown>): ValidationRT => {
        assert(s.iMatcher.tries > 0 , 'iMatcher tries must be > 0 before checking the outcome')
        
        let ret =  { ok: true, err: '' } 
        if ( s.isc.roundTrips > 1 && s.iMatcher.matchCnt > s.iMatcher.max ) {
            ret = { ok: false, err: 'Max allowed matches exceeded for' + s.iMatcher.keyExt }
        }
        if ( s.isc.roundTrips === 1 && ! s.iMatcher.logicApplies ) {
            if ( s.iMatcher.matchCnt < s.iMatcher.min  )
                ret =  { ok: false, err: 'Min allowed matches not reached for ' + s.iMatcher.keyExt }
            else if ( s.iMatcher.matchCnt > s.iMatcher.max )
                ret = { ok: false, err: 'Max allowed matches exceeded for ' + s.iMatcher.keyExt }
        }
        return ret 
    }
        //
        // Final Evaluation of match count
        //
        // Check the number of matches for a given terminal symbol
        // We do not check for roundTrips > 1, since they are recursive calls 
        // where the match has already succeded once
        // Fail the branch if the match count is less than min or greater than max
        // 
        /*
        let failBranchMsg = ''
        //
        // Check if the match count is within the cardinality constraints
        //
        if ( ! s.iMatcher.logicApplies && s.isc.roundTrips === 1 ) {
            if ( s.iMatcher.tries  === 1 && s.iMatcher.matchCnt < s.funcRet.min ) {
                failBranchMsg = `Failed MIN match count: ${s.iMatcher.matchCnt} for ${s.iMatcher.keyExt}(${s.isc.level},${s.isc.roundTrips})`
                s.funcRet.setStatus( 'branchFailed', failBranchMsg )
            }
            else if ( s.iMatcher.tries  > 1 && ( s.iMatcher.matchCnt > s.funcRet.max || s.funcRet.matchCnt < s.funcRet.min ) ) {
                    // Fail this branch of matching due to failed cardinality constraint
                    failBranchMsg = `Failed match count: ${s.iMatcher.matchCnt} for ${s.iMatcher.keyExt}(${s.isc.level}) at roundtrip: ${s.isc.roundTrips}`
                    s.funcRet.setStatus( 'branchFailed', failBranchMsg )
            }
        }
        if ( failBranchMsg.length > 0 ) {
            __debug__(Colors.gray(`${getIndent(s.isc.level+1)}validFinalMatchCnt() found an error: (${failBranchMsg})`))
        }
        return s.funcRet.status.includes('branchFailed') ? false : true
    }
    */

    validLogicGroup = (s: ParseFuncState<unknown>): ValidationRT => {
        // Validation of logic groups:
        // When we matched or not matched the last element in 
        // the currently active Logic Group, we check if it has failed or not
        const iMatcher = s.matchers[s.matchers.length-1]
        let ret = { ok: true, err: '' }
        if ( iMatcher.logicApplies ) {
            if ( iMatcher.matchCnt > iMatcher.max ) {
                ret = { ok: false, err: 'Max allowed matches exceeded' }
            }
        }
        if ( iMatcher.logicLast ) {
            // __debug__(Colors.bgBrightYellow(`${getIndent(s.isc.level+1)} Logic for ${s.iMatcher.keyExt}: ${s.iMatcher.logicLast}`) )
            if ( ! s.logic.isMatched(iMatcher.logicGroup, s.isc.roundTrips)  ) { 
                // Logic group is not matched
                this.__debug__(Colors.bgBrightYellow(`${this.getIndent(s.isc.level+1)} Logic match failure for ${iMatcher.keyExt}`) )
                const failBranchMsg = `Logic match constraint is violated for ${iMatcher.keyExt}`
                ret = { ok: false, err: failBranchMsg }
            }
            else {
                this.__debug__(Colors.bgBrightYellow(`${this.getIndent(s.isc.level+1)} Logic matched for ${iMatcher.keyExt}`) )
            }
        }
        return ret
    }
} // End of class Validate
/*
export const validLogic = (s: ParseFuncState<unknown>): boolean => { // Has side effects
    //
    // Evaluate and update the result record for the current token
    //
    const ret = (s.logic !== undefined ) ? s.logic.validate() : true
    if ( ! ret ) {
        __debug__(Colors.yellow(`${getIndent(s.isc.level+1)}Non-Terminal branch Failed for ${s.mRec.tokenExt} due to Logic violation`) )
        s.funcRet.setStatus('branchFailed', `Logic match constraint is violated for ${s.iMatcher.keyExt}`)
    }
    s.mRec.matched = ret
    return ret
}
*/
/*

export const ValidateParse = (s: ParseFuncState<unknown>): boolean => {
    let ret = true
    if ( ! validLogic(s) ) {
        ret = false
    }
    else if ( ! validFinalMatchCnt(s) ) {
        ret = false
    }
  
    // else if ( ! validChildren(s) ) {
    //    ret = false
    // }
    
    return ret
}
*/