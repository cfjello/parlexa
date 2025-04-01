import { ulid } from "./imports.ts";
import { InternMatcher, InternMatcherSealed, ParseFuncScope } from "./types.ts";
import { ParserSharedScope } from "./parserSharedFac.ts";
import { getMulti } from "./util.ts";

export const iMatcherFac = <L extends string,T extends string,U>( 
    caller: 'parseExpect' | 'parseNT' | 'reset',
    s:      ParseFuncScope<L,T,U>,
    _idx:    number, 
    p: ParserSharedScope<L,T,U>,
    token:  T ,
    imatcherRaw: InternMatcher<T,U> | undefined = undefined
    ): InternMatcherSealed<T,U> => {
        try {
            // deno-lint-ignore no-explicit-any
            const iMatcher = imatcherRaw ?? {} as any 
            let idx      = _idx 
            const pos    = p.pos // s.isc.goingInPos

            if ( caller === 'parseExpect' ) {
                idx = idx < 0 ? s.matchers.length -1 : _idx
                iMatcher.parentId = iMatcher.parentId ?? s.iMatcher.id
                iMatcher.type = iMatcher.regexp ? 'terminal' : 'non-terminal'
            }
            else if ( caller === 'parseNT' ) {
                // Called from Parse non-terminal
                iMatcher.regexp = undefined
                iMatcher.type = 'non-terminal'
                iMatcher.parentId = s.args.parentId
            }
            else { // reset
                iMatcher.regexp = undefined
                iMatcher.type = 'non-terminal'
                iMatcher.parentId = '__root__'
            }

            iMatcher.id = ulid()
            iMatcher.parent = token

            if ( iMatcher.regexp ) iMatcher.regexp.lastIndex = pos
            
            // Get the current token's multi-cardinality
            if ( ! iMatcher.multi ) {
                    iMatcher.multi = p.pRef.rules.PRMap.get(s.args.token)?.multi ?? p.pRef.multiDefault
            }
            const [min, max] = getMulti( iMatcher.multi )

            iMatcher.key            = iMatcher.key ?? s.args.token 
            iMatcher.idx            = idx
            iMatcher.min            = min
            iMatcher.max            = max
            if ( iMatcher.parent ) {
                iMatcher.keyExt =  iMatcher.parent + '.' + iMatcher.key
            }
            else {
                iMatcher.keyExt     = iMatcher.key
            }
           
            iMatcher.roundTrips = s.args.roundTrips   
            iMatcher.roundtripFailed = false
            if ( caller === 'parseExpect' ) {
                s.mRec.children.push(iMatcher.id)
            }
            iMatcher.level          = s.args.level 
            iMatcher.offsets        = [ pos ]
            iMatcher.matchCnt       = 0 
            iMatcher.tries          = 0
            iMatcher.breaks         = s.breaks
            iMatcher.breakIdx       = -1
            iMatcher.startIdx       = -1
            iMatcher.starts         = s.starts
            iMatcher.ignore         = iMatcher.ignore ?? false
            // Logic Part
            iMatcher.logicApplies   = ( iMatcher.logic !== 'none'  )
            iMatcher.logicLast      = iMatcher.logicLast ?? false
            iMatcher.logicGroup     = iMatcher.logicGroup ?? -1 
            iMatcher.logicIdx       = iMatcher.logicIdx ?? -1
            iMatcher.logic          = iMatcher.logic ?? 'none'  
           
            iMatcher.matched        = false
            iMatcher.status         = [] satisfies string[]
            iMatcher.errors         = [] satisfies string[]
            iMatcher.branchFailed   =  function() { return this.status.includes('branchFailed') }
            iMatcher.branchMatched  =  function() { return this.status.includes('branchMatched') }
            iMatcher.setStatus      =  function( status: string, msg: string ): void { 
                                        if ( ! this.status.includes(status) ) this.status.push(status) 
                                        this.errors.push(msg)
                                    }
            
            return iMatcher satisfies InternMatcherSealed<T,U>
    }
    catch (err) { 
        console.error(err)
        throw err 
    }   
}