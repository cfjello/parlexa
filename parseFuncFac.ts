import { ParserSharedScope } from "./parserSharedFac.ts";
import { iMatcherFac } from "./iMatcherFac.ts";
import { Sealed } from "./types.ts";
import { ExpectMap } from "./types.ts";
import { ParseArgs } from "./types.ts";
import { ParseFuncScope } from "./types.ts";
import { matchRecFac } from "./matchRecFac.ts";
import { MatchRecord } from "./types.ts";
import { Logic } from "./Logic.ts";
import { InternMatcherSealed } from "./types.ts";
import { InternMatcherExt } from "./types.ts";

export const parseFuncFac = <L extends string,T extends string,U>( 
    token:  T,
    p:      ParserSharedScope<L,T,U>, 
    parent: ParseFuncScope<L,T,U> | undefined,
    hasIMatcher: boolean
    ): ParseFuncScope<L,T,U>  => {
        try {
            const isc = {
                token:      token, 
                parentId:   parent?.iMatcher.id ?? '',
                parentIdx:  parent ? parent.matchers.length - 1 : -1,
                level:      ( parent?.isc.level ?? 0 ) + 1, 
                roundTrips: parent?.isc.roundTrips ?? 1,
                goingInPos: p.pos,
                breaks:     parent?.isc.breaks.slice() ?? []
            } satisfies ParseArgs<T>
            
            const s = parseInit( isc, p, parent, hasIMatcher )
            return s
        }
        catch (err) { 
            console.error(err)
            throw err 
        }   
    }

export const parseInit = <L extends string,T extends string ,U>( 
    isc:    ParseArgs<T>,
    p:      ParserSharedScope<L,T,U>, 
    parent: ParseFuncScope<L,T,U> | undefined = undefined,
    hasIMatcher: boolean
    ): Sealed<ParseFuncScope<L,T,U>, 'eMap' | 'mRec' | 'iMatcher' | 'logic'>  => {
        // Initialize
        const s: Partial<ParseFuncScope<L,T,U>> = { isc: isc }
        try {
            // Get the ExpectMap for the token
            if ( ! p.pRef.rules.PRMap.has(isc.token) ) throw new Error(`parseInit(): Unknown parser token: '${isc.token}'`)
            s.eMap = p.pRef.rules.PRMap.get(isc.token)! satisfies ExpectMap<T,U>
       
            // create the result match record for the token  
            if ( parent && hasIMatcher) {
                s.iMatcher = parent!.matchers[isc.parentIdx]
            }
            else {
                s.iMatcher = iMatcherFac( 'parseNT', s as Sealed<ParseFuncScope<L,T,U>, 'eMap' | 'isc'>, -1, p)
            }
            // Add Match Record to the state
            s.mRec = matchRecFac(
                        s as Sealed<ParseFuncScope<L,T,U>, 'eMap' | 'isc' | 'iMatcher'> , 
                        p, 
                        s.iMatcher as Sealed<InternMatcherExt<T,U>, 'ignore'| 'keyExt' | 'breaks'>
                    ) satisfies MatchRecord<T>
            // Mark any whitespace tokens
            if ( parent && parent.mRec.ws ) s.mRec.ws = true
            if ( s.mRec.token === p.always || s.mRec.token.startsWith(p.always + '.') ) s.mRec.ws = true

            // Add Logic object to the state
            s.logic = p.pRef.rules.logicMap.has(isc.token)  ? new Logic( s.iMatcher.id, p.pRef.rules.logicMap.get(isc.token)!.logicGroups ) : undefined
            
            // Add Array of iMatchers to the state
            s.matchers = [] as InternMatcherSealed<T,U>[]
            return s as Sealed<ParseFuncScope<L,T,U>, 'eMap' | 'mRec' | 'iMatcher' | 'logic'>
        }
        catch (err) { 
            console.error(err)
            throw err 
        }
    }
