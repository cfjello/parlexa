//
// Progress and validation functions
//
import { Debug } from "./Debug.ts";
import { assert } from "./imports.ts";
import { DebugLogFunc, InternMatcher, InternMatcherExt, ValidationRT } from "./types.ts";
import { ParseFuncScope } from "./types.ts";


export class  Validation<L,T extends string,U> {
    debugger: Debug<T,U> 
    msg: DebugLogFunc<T,U>
 
    constructor(_debugger: Debug<T,U> ) {
        this.debugger = _debugger
        this.msg = _debugger.msg
    }

    progress = <L extends string,T extends string,U>(s: ParseFuncScope<L,T,U>, pos: number) : boolean => ( pos > s.args.goingInPos )

    inRange =  <L extends string, T extends string,U>(s: ParseFuncScope<L,T,U>): boolean => { 
        let ret = false
        try {
            if ( s.iMatcher ) {
                const rtOffset = s.iMatcher.branchFailed() ? -1 : 0 
                // ret = (s.args.roundTrips + rtOffset) >= s.iMatcher.min && (s.args.roundTrips + rtOffset) <= s.iMatcher.max 
                ret = (s.args.roundTrips + rtOffset) <= s.iMatcher.max 
            }
        }
        catch (err) { 
            console.error(err)
            throw err 
        }
        return ret
    }

    branchFailed = <T extends string,U>( 
        iMatcher: InternMatcherExt<T,U>
        ): boolean => { 
            return ( iMatcher.status && iMatcher.status.includes('branchFailed') ) ?? false 
        }
    
    funcScopeBranchFailed = <L extends string,T extends string,U>( 
        s: ParseFuncScope<L,T,U>
        ): boolean => { 
            return this.branchFailed(s.iMatcher) 
        }

    matched  = <L extends string,T extends string,U>(
        s: ParseFuncScope<L,T,U>, 
        // p: ParserSharedScope<T,U>, 
        pos: number
        ): boolean => {
            const  last = s.matchers.length -1
            const iMatcher = s.matchers[last]
            const failed = this.branchFailed(iMatcher)
            const progress = this.progress(s, pos)
            const inRange = this.inRange(s)
            return ( ! failed && progress && inRange )
        }


    validLogicGroup = <L extends string,T extends string,U> (
        s: ParseFuncScope<L,T,U>, 
        idx = s.matchers.length -1
        ): ValidationRT => {
        // Validation of logic groups:
        // When we matched or not matched the last element in 
        // the currently active Logic Group, we check if it has failed or not
        let ret = { ok: true, msg: '' }
        const level = s.args.level + 2
        const iMatcher = s.matchers[idx]
        const group = iMatcher.logicGroup
        const roundTrip = s.args.roundTrips
        const logic = s.logic[roundTrip]

        try {
            if ( idx < 0 || ( idx >= s.matchers.length ) ) {
                ret = { ok: false, msg: `Logic group index out of range: ${idx}` }
            }
            else if ( iMatcher.matchCnt > iMatcher.max ) {
                ret = { ok: false, msg: 'Max allowed matches exceeded' }
            }  
            else {
                const valid = logic.validateGroup(group)

                if ( valid ) {
                    const msg = `Logic group ${group} for ${iMatcher.keyExt} is valid`
                    ret = { ok: true, msg: msg }
                    /*
                    this.msg( {
                        oper: 'LOGIC',
                        iMatcher: undefined,
                        level: level+2,
                        color: 'yellow',
                        text: msg
                        }   
                    )
                    */
                }
                // else if ( iMatcher.roundTrips > 1 ) { 
                //     ret = { ok: false, msg: `Logic group ${group} for ${iMatcher.keyExt}(L${s.args.level},R${s.args.roundTrips}) is already matched` }
                // }
                else {
                    const msg = `Logic group ${group} for ${iMatcher.keyExt}(L${s.args.level},R${s.args.roundTrips}) is NOT valid`
                    ret = { ok: false, msg: msg }
                    /*
                    this.msg( {
                        oper: 'LOGIC',
                        iMatcher: undefined,
                        level: level,
                        color: 'yellow',
                        text: msg
                        }   
                    ) 
                    */
                }
            }
            return ret
        }
        catch (err) { 
            console.error(err)
            throw err 
        }
    }

    matchInRange = <T extends string,U>(iMatcher: InternMatcherExt<T,U> ): ValidationRT => {
        const ret = { ok: true, msg: ''}
        if ( ! iMatcher.logicApplies ) {
            ret.ok = ( iMatcher.matchCnt >=  iMatcher.min ) && ( iMatcher.matchCnt <= iMatcher.max )
            if ( ! ret.ok ) {
                ret.msg = `Match count out of range for ${iMatcher.keyExt}(L${iMatcher.level},R${iMatcher.roundTrips})`
            }
        }
        else {
            ret.ok = ! ( iMatcher.matchCnt > iMatcher.max )
            if ( ! ret.ok ) {
                ret.msg = `Match count exceded range for ${iMatcher.keyExt}`
            }
        }
        return ret 
    }

    validMatchCounts = <L extends string,T extends string,U>(s: ParseFuncScope<L,T,U>): ValidationRT => {
        assert(s.args.token, `validMatchCounts(): s.args.token is undefined`)
        assert( s.eMap.expect.length > 0, `validMatchCounts(): eMap.expect.length is 0`)

        let ret = { ok: true, msg: '' }
        try {
            s.matchers.every( ( iMatcher: InternMatcherExt<T,U>, _idx: number ) => { 
                if ( iMatcher.logic === 'none') {
                    const inRange = this.matchInRange(iMatcher)
                    if ( ! inRange.ok ) {
                        ret = { ok: false, msg: `Match count out of range for ${iMatcher.keyExt}: ${inRange.msg}` }
                        s.iMatcher.setStatus('branchFailed', ret.msg)
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

    validExpect = <L extends string,T extends string,U>(
        s: ParseFuncScope<L,T,U>, 
    ): boolean => {
        let valid = true 
        try { 
            const roundTrip = s.args.roundTrips
            // if ( ! this.validLogic(s, optimistic).ok ) {
            if ( s.logic && s.logic[roundTrip] && ! s.logic[roundTrip].validate() ) {
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