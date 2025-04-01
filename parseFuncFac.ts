import { ParserSharedScope } from "./parserSharedFac.ts";
import { iMatcherFac } from "./iMatcherFac.ts";
import { Sealed } from "./types.ts";
import { ExpectMap } from "./types.ts";
import { ParseArgs } from "./types.ts";
import { ParseFuncScope } from "./types.ts";
import { matchRecInit } from "./matchRecFac.ts";
import { MatchRecord } from "./types.ts";
import { Logic } from "./Logic.ts";
import { InternMatcherSealed } from "./types.ts";
import { InternMatcherExt } from "./types.ts";

export const parseFuncInit = <L extends string,T extends string,U>( 
    token:  T,
    p:      ParserSharedScope<L,T,U>, 
    parent: ParseFuncScope<L,T,U> | undefined,
    hasIMatcher: boolean,
    roundTrips = 1
    ): ParseFuncScope<L,T,U>  => {
        try {

            const args = {
                token:      token, 
                parentId:   parent?.iMatcher.id ?? '__root__',
                parentIdx:  parent ? parent.matchers.length - 1 : -1,
                level:      ( parent?.args.level ?? 0 ) + 1, 
                roundTrips:  roundTrips ??  1,
                goingInPos: p.pos,
                breaks:     parent?.args.breaks.slice() ?? []
            } satisfies ParseArgs<T>
            
            const s = parseInit( args, p, parent, hasIMatcher )
            return s
        }
        catch (err) { 
            console.error(err)
            throw err 
        }   
    }

export const parseInit = <L extends string,T extends string ,U>( 
    args:   ParseArgs<T>,
    p:      ParserSharedScope<L,T,U>, 
    parent: ParseFuncScope<L,T,U> | undefined = undefined,
    hasIMatcher: boolean
    ): Sealed<ParseFuncScope<L,T,U>, 'eMap' | 'mRec' | 'iMatcher' | 'logic'>  => {
        // Initialize
        const s: Partial<ParseFuncScope<L,T,U>> = { args: args }
        try {
            // Get the ExpectMap for the token
            if ( ! p.pRef.rules.PRMap.has(args.token) ) throw new Error(`parseInit(): Unknown parser token: '${args.token}'`)
            s.eMap = p.pRef.rules.PRMap.get(args.token)! satisfies ExpectMap<T,U>
       
            // create the result match record for the token  
            if ( parent && hasIMatcher) {
                s.iMatcher = parent!.matchers[args.parentIdx]
            }
            else {
                s.iMatcher = iMatcherFac( parent ? 'parseNT' : 'reset', s as Sealed<ParseFuncScope<L,T,U>, 'eMap' | 'args'>, -1, p, args.token)
            }
            s.iMatcher.roundTrips = args.roundTrips
            // Add Match Record to the state
            s.mRec = matchRecInit(
                        s as Sealed<ParseFuncScope<L,T,U>, 'eMap' | 'args' | 'iMatcher'> , 
                        p, 
                        s.iMatcher as Sealed<InternMatcherExt<T,U>, 'ignore'| 'keyExt' | 'breaks'>
                    ) satisfies MatchRecord<T>
            // Mark any whitespace tokens
            if ( parent && parent.mRec.ws ) s.mRec.ws = true
            if ( s.mRec.token === p.always || s.mRec.token.startsWith(p.always + '.') ) s.mRec.ws = true

            // Add Logic object to the state
            s.logic = p.pRef.rules.logicMap.has(args.token)  ? new Logic( s.iMatcher.id, p.pRef.rules.logicMap.get(args.token)!.logicGroups ) : undefined
            
            // Add Array of iMatchers to the state
            s.matchers = [] as InternMatcherSealed<T,U>[]
            return s as Sealed<ParseFuncScope<L,T,U>, 'eMap' | 'mRec' | 'iMatcher' | 'logic'>
        }
        catch (err) { 
            console.error(err)
            throw err 
        }
    }
