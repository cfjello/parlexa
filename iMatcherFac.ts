import { ulid } from "./imports.ts";
import { InternMatcherSealed, ParseFuncScope } from "./types.ts";
import { ParserSharedScope } from "./parserSharedFac.ts";
import { getMulti } from "./util.ts";

export const iMatcherFac = <L extends string,T extends string,U>( 
    caller: 'parseExpect' | 'parseNT' | 'reset',
    s:      ParseFuncScope<L,T,U>,
    _idx:    number, 
    p: ParserSharedScope<L,T,U>
    ): InternMatcherSealed<T,U> => {
        try {
            // deno-lint-ignore no-explicit-any
            let iMatcher = {} as any
            let idx      = _idx 
            const pos    = p.pos // s.isc.goingInPos

            if ( caller === 'parseExpect' ) {
                idx = idx < 0 ? s.matchers.length -1 : _idx
                iMatcher = s.matchers[idx]
                iMatcher.parentId = iMatcher.parentId ?? s.iMatcher.id
            }
            else if ( caller === 'parseNT' ) {
                // Called from ParseNT
                iMatcher.regexp = undefined
                iMatcher.parentId = s.isc.parentId
            }
            else { // reset
                iMatcher.regexp = undefined
                iMatcher.parentId = '__root__'
            }

            iMatcher.id = ulid()
            if ( iMatcher.regexp ) iMatcher.regexp.lastIndex = pos
            
            // Get the current token's multi-cardinality
            if ( ! iMatcher.multi ) {
                    iMatcher.multi = p.pRef.rules.PRMap.get(s.isc.token)?.multi ?? p.pRef.multiDefault
            }
            const [min, max] = getMulti( iMatcher.multi )

            iMatcher.key            = iMatcher.key ?? s.isc.token 
            iMatcher.idx            = idx
            iMatcher.min            = min
            iMatcher.max            = max
            if ( iMatcher.parent ) {
                iMatcher.keyExt =  iMatcher.parent + '.' + iMatcher.key
            }
            else {
                iMatcher.keyExt     = iMatcher.key
            }
           
            iMatcher.roundTrips = ! iMatcher.roundTrips || iMatcher.roundTrips < 1 ? s.isc.roundTrips: iMatcher.roundTrips   
            if ( caller === 'parseExpect' ) {
                s.mRec.children.push(iMatcher.id)
            }
            iMatcher.level          = s.isc.level 
            iMatcher.offsets        = [ pos ]
            iMatcher.matchCnt       = 0 
            iMatcher.tries          = 0
            iMatcher.breaks         = s.breaks
            iMatcher.ignore         = iMatcher.ignore ?? false
            // Logic Part
            iMatcher.logicLast      = false
            iMatcher.logicGroup     = -1 
            iMatcher.logic          = iMatcher.logic ?? 'none'  
            iMatcher.logicApplies   = ( iMatcher.logic !== 'none'  )
            iMatcher.matched        = false
            iMatcher.status         = [] satisfies string[]
            iMatcher.errors         = [] satisfies string[]
            iMatcher.branchFailed   =  function() { return this.status.includes('branchFailed') }
            iMatcher.setStatus      =  function( status: string, errMsg: string ): void { 
                                        if ( ! this.status.includes(status) ) this.status.push(status) 
                                        this.errors.push(errMsg)
                                    }
            
            return iMatcher satisfies InternMatcherSealed<T,U>
    }
    catch (err) { 
        console.error(err)
        throw err 
    }   
}