//
// Progress and validation functions
//
import { Debug } from "./Debug.ts";
import { assert } from "./imports.ts";
import { InternMatcher, InternMatcherExt, InternMatcherSealed, ValidationRT } from "./types.ts";
import { ParseFuncScope } from "./types.ts";
import { getMulti } from "./util.ts";


export class  Validation {
    private static instance: Validation | null = null;
    private debug: boolean;
    // Debugging
    private _debugger: Debug 

    private constructor(debug: boolean) {
        if ( Validation.instance ) {
            throw new Error("Error: Instantiation failed: Use Validation.getInstance() instead of new.");
        }
        this.debug = debug;
        this._debugger = Debug.getInstance(debug)
    }
    
    static getInstance (debug: boolean): Validation {
        if ( ! Validation.instance ) {
            Validation.instance = new Validation(debug);      
        }
        return Validation.instance;
    }

    static progress = <L extends string,T extends string,U>(s: ParseFuncScope<L,T,U>, pos: number) : boolean => ( pos > s.isc.goingInPos )

    static inRange =  <L extends string, T extends string,U>(s: ParseFuncScope<L,T,U>): boolean => { 
        let ret = false
        try {
            if ( s.iMatcher ) {
                const rtOffset = s.iMatcher.branchFailed() ? -1 : 0 
                // ret = (s.isc.roundTrips + rtOffset) >= s.iMatcher.min && (s.isc.roundTrips + rtOffset) <= s.iMatcher.max 
                ret = (s.isc.roundTrips + rtOffset) <= s.iMatcher.max 
            }
        }
        catch (err) { 
            console.error(err)
            throw err 
        }
        return ret
    }

    static branchFailed = <T extends string,U>( 
        iMatcher: InternMatcherExt<T,U>
        ): boolean => { 
            return ( iMatcher.status && iMatcher.status.includes('branchFailed') ) ?? false 
        }
    
    static funcScopeBranchFailed = <L extends string,T extends string,U>( 
        s: ParseFuncScope<L,T,U>
        ): boolean => { 
            return Validation.branchFailed(s.iMatcher) 
        }
    
        // matched = (s: ParseFuncScope<T,U>, pos: number): boolean => ( ! this.branchFailed(s) && this.progress(s, pos) && this.inRange(s) )

    static matched  = <L extends string,T extends string,U>(
        s: ParseFuncScope<L,T,U>, 
        // p: ParserSharedScope<T,U>, 
        pos: number
        ): boolean => {
            const  last = s.matchers.length -1
            const iMatcher = s.matchers[last]
            return ( this.branchFailed(iMatcher) && this.progress(s, pos) && this.inRange(s) ) 
        }


    static validLogicGroup = <L extends string,T extends string,U>(
        s: ParseFuncScope<L,T,U>, 
        idx = s.matchers.length -1,
        ): ValidationRT => {
            // Validation of logic groups:
            // When we matched or not matched the last element in 
            // the currently active Logic Group, we check if it has failed or not
            let ret = { ok: true, err: '' }
            try {
                if ( idx < 0 || ( idx >= s.matchers.length ) ) {
                    ret = { ok: false, err: `Logic group index out of range: ${idx}` }
                }
                else {
                    const iMatcher = s.matchers[idx]
                    if ( iMatcher.logicApplies ) {
                        if ( iMatcher.matchCnt > iMatcher.max ) {
                            ret = { ok: false, err: 'Max allowed matches exceeded' }
                        }      
                    }
                    if ( iMatcher.logicLast ) {
                        // __debug__(Colors.bgBrightYellow(`${getIndent(s.isc.level+1)} Logic for ${s.iMatcher.keyExt}: ${s.iMatcher.logicLast}`) )
                        if ( ! s.logic.isMatched(iMatcher.logicGroup, s.isc.roundTrips)  ) { 
                            // Logic group is not matched
                            Debug.__debug__( {
                                level: s.isc.level+1,
                                color: 'bgBrightYellow',
                                text: `Logic match failure for ${iMatcher.keyExt}`
                                }   
                            ) 
                            const failBranchMsg = `Logic match constraint is violated for ${iMatcher.keyExt}`
                            ret = { ok: false, err: failBranchMsg }
                        }
                        else {
                            Debug.__debug__( {
                                level: s.isc.level+1,
                                color: 'bgBrightYellow',
                                text: `Logic matched for ${iMatcher.keyExt}`
                                }   
                            ) 
                        }
                    }
                    if ( ret.ok && iMatcher.logicApplies && iMatcher.matchCnt < iMatcher.min ) {
                        ret = { ok: false, err: `Match count failed minimum count for ${iMatcher.keyExt}` }
                    }
                }
            }
            catch (err) { 
                console.error(err)
                throw err 
            }
            return ret
        }

    static validLogic = <L extends string,T extends string,U>( s: ParseFuncScope<L,T,U>, optimistic = false ): ValidationRT => {
        let ret = { ok: true, err: '' }
        try {
           
            const logicChk = [] as boolean[]
            const logicApplies = s.eMap.expect.some( e => e.logicApplies )
            if ( ! logicApplies ) {
                return ret
            }
            else {
                s.eMap.expect.every( ( eMatcher: InternMatcher<T,U>, idx: number ) => { 
                    if ( eMatcher.logicApplies ) {
                        // Optimistic Matching of logic groups
                        if ( optimistic && ( eMatcher.logic === 'xor' || eMatcher.logic === 'or' ) ) {        
                            if ( eMatcher.logicIdx === 0 ) {
                                logicChk[eMatcher.logicGroup] = false
                            }
                            const oRet = this.validLogicGroup(s, idx)
                            if ( ! logicChk[eMatcher.logicGroup] ) logicChk[eMatcher.logicGroup] = oRet.ok
                        }
                        // Full validation of logic groups
                        else {
                            ret = this.validLogicGroup(s, idx)
                            if ( ! ret.ok) {
                                s.iMatcher.setStatus('branchFailed', ret.err ?? `Logic group failed for ${eMatcher.keyExt}`)
                                return false
                            }
                        }
                    }
                    return true
                })
            }
            // Final check of optimistic logic group matching
            if ( optimistic ) {
                for ( let i = 0 ; i < logicChk.length ; i++ ) {
                    if ( logicChk[i] === false ) {
                        ret = { ok: false, err: `Optimistic check of logic group ${i} failed` }
                        break
                    }
                }
            }
        }
        catch (err) { 
            console.error(err)
            throw err 
        }
        return ret
    }

    static matchInRange = <T extends string,U>(iMatcher: InternMatcherExt<T,U> ): ValidationRT => {
        const ret = { ok: true, err: ''}
        if ( iMatcher.logic  === 'none' ) {
            ret.ok = ( iMatcher.matchCnt >=  iMatcher.min ) && ( iMatcher.matchCnt <= iMatcher.max )
            if ( ! ret.ok ) {
                ret.err = `Match count out of range for ${iMatcher.keyExt}`
            }
        }
        else {
            ret.ok = ! ( iMatcher.matchCnt > iMatcher.max )
            if ( ! ret.ok ) {
                ret.err = `Match count exceded range for ${iMatcher.keyExt}`
            }
        }
        return ret 
    }

    static validMatchCounts = <L extends string,T extends string,U>(s: ParseFuncScope<L,T,U>): ValidationRT => {
        assert(s.isc.token, `validMatchCounts(): s.isc.token is undefined`)
        assert( s.eMap.expect.length > 0, `validMatchCounts(): eMap.expect.length is 0`)

        let ret = { ok: true, err: '' }
        try {
            s.matchers.every( ( iMatcher: InternMatcherExt<T,U>, _idx: number ) => { 
                if ( iMatcher.logic === 'none') {
                    const inRange = Validation.matchInRange(iMatcher)
                    if ( ! inRange.ok ) {
                        ret = { ok: false, err: `Match count out of range for ${iMatcher.keyExt}: ${inRange.err}` }
                        s.iMatcher.setStatus('branchFailed', ret.err)
                        return false
                    }
                }
                return true
            })
        }
        catch (err) { 
            console.error(err)
            throw err 
        }
        return ret
    }

    /*
    static matchInRangeDEL = <L extends string,T extends string,U>(s: ParseFuncScope<L,T,U>, idx = s.matchers.length -1): ValidationRT => {
        const ret = { ok: true, err: ''}
        try {
            assert ( idx >= 0 && s.eMap.expect.length > idx, `IDX ERROR in matchInRange(): index out of range: ${idx}`)
            const iMatcher = s.matchers[idx]
            if ( iMatcher ) {
                if ( iMatcher.logic  === 'none' ) {
                    ret.ok = ( iMatcher.matchCnt >=  iMatcher.min ) && ( iMatcher.matchCnt <= iMatcher.max )
                    if ( ! ret.ok ) {
                        ret.err = `Match count out of range for ${iMatcher.keyExt}`
                    }
                }
                else {
                    ret.ok = ! ( iMatcher.matchCnt > s.iMatcher.max )
                    if ( ! ret.ok ) {
                        ret.err = `Match count exceded range for ${iMatcher.keyExt}`
                    }
                }
            }
            else {
                const [min, _max] = getMulti(s.eMap.expect[idx].multi)
                ret.ok = min === 0 || s.eMap.expect[idx].logicApplies
                if ( ! ret.ok ) ret.err = `Match failed minimum count for ${s.eMap.expect[idx].keyExt}`
            }
        }
        catch (err) { 
            console.error(err)
            throw err 
        }
        return ret
    }
    */ 

    static validExpect = <L extends string,T extends string,U>(s: ParseFuncScope<L,T,U>, optimistic = false): boolean => {
        let valid = s.iMatcher.matched  // && s.iMatcher.offsets.at(-1)! > s.isc.goingInPos 
        try { 
            if ( ! this.validLogic(s, optimistic).ok ) {
                valid = false
            }
            else if ( ! this.validMatchCounts(s).ok ) {
                valid = false
            }
        }
        catch (err) { 
            console.error(err)
            throw err 
        }
        return valid
    }
}