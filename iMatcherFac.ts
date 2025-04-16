import { ulid } from "./imports.ts";
import { InternMatcher, InternMatcherSealed, ParseFuncScope, callerIM } from "./types.ts";
import { ParserSharedScope } from "./parserSharedFac.ts";
import { getMulti } from "./util.ts";

export const iMatcherFac = <L extends string,T extends string,U>( 
    caller: callerIM,
    parent: ParseFuncScope<L,T,U>,
    _idx:   number, 
    shared: ParserSharedScope<L,T,U>,
    token:  T ,
    imatcherRaw: InternMatcher<T,U> | undefined = undefined
    ): InternMatcherSealed<T,U> => {
        try {
            // deno-lint-ignore no-explicit-any
            const iMatcher  = imatcherRaw ?? {} as any 
            let idx         = _idx 
            const pos       = shared.pos // s.isc.goingInPos

            if ( caller === 'parseExpect' ) {  // We restart roudtrips at 1
                idx = idx < 0 ? parent.matchers.length -1 : _idx
                iMatcher.parentId = iMatcher.parentId ?? parent.iMatcher.id
                iMatcher.type = iMatcher.regexp ? 'terminal' : 'non-terminal'
                iMatcher.roundTrips = 1
            }
            else if ( caller === 'matchTerminal' ) {
                // Called from MatchTerminal non-terminal
                iMatcher.type = 'non-terminal'
               //  iMatcher.parentId = iMatcher.parentId, // s.iMatcher.id
                iMatcher.roundTrips = 1
            }
            else if ( caller === 'parse' || caller === 'removeWS' ) {
                // Called from Parse non-terminal
                iMatcher.regexp = undefined
                iMatcher.type = 'non-terminal'
                iMatcher.parentId = parent.args.parentId
                iMatcher.roundTrips = parent.args.roundTrips 
            }
            else { // reset
                iMatcher.regexp = undefined
                 iMatcher.type = 'non-terminal'
                iMatcher.parentId = '__root__'
                iMatcher.roundTrips = parent ? parent.args.roundTrips : 1
            }

            iMatcher.id = ulid()
            iMatcher.parentToken = parent ? parent.args.token : '__root__'

            if ( iMatcher.regexp ) iMatcher.regexp.lastIndex = pos
            
            // Get the current token's multi-cardinality
            if ( ! iMatcher.multi ) {
                    iMatcher.multi = shared.self.rules.PRMap.get( token )?.multi ?? shared.self.multiDefault
            }
            const [min, max] = getMulti( iMatcher.multi )

            iMatcher.key            = token 
            iMatcher.idx            = idx
            iMatcher.min            = min
            iMatcher.max            = max
          
            iMatcher.keyExt =  iMatcher.parentToken + '.' + iMatcher.key
            iMatcher.roundtripFailed = false
            if ( caller === 'parseExpect' ) {
                parent.mRec.children.push(iMatcher.id)
            }
            iMatcher.level          = parent ? parent.args.level : 1
            iMatcher.offsets        = [ pos ]
            iMatcher.matchCnt       = 0 
            iMatcher.tries          = 0
            iMatcher.breaks         = parent ? parent.breaks : []
            iMatcher.breakIdx       = -1
            iMatcher.startIdx       = -1
            iMatcher.starts         = parent ? parent.starts : []
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