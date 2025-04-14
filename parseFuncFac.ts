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
import { _ } from "./lodash.ts";
import { callerIM } from "./types.ts";

export const parseFuncInit = <L extends string,T extends string,U>( 
    token:  T,
    caller: callerIM,
    shared:      ParserSharedScope<L,T,U>, 
    parent: ParseFuncScope<L,T,U> | undefined,
    hasIMatcher: boolean,
    roundTrips = 1
    ): ParseFuncScope<L,T,U>  => {
        try {

            const args = {
                token:          token, 
                caller:         caller,
                parentId:       parent?.iMatcher.id ?? '__root__',
                parentIdx:      parent ? parent.matchers.length - 1 : -1,
                level:          ( parent?.args.level ?? 0 ) + 1, 
                roundTrips:     roundTrips,
                goingInPos:     shared.pos,
                breaks:         parent?.args.breaks.slice() ?? []
            } satisfies ParseArgs<T>
            
            const s = parseInit( args, shared, parent, hasIMatcher )
            return s
        }
        catch (err) { 
            console.error(err)
            throw err 
        }   
    }

export const parseInit = <L extends string,T extends string ,U>( 
    args:   ParseArgs<T>,
    shared: ParserSharedScope<L,T,U>, 
    parent: ParseFuncScope<L,T,U> | undefined = undefined,
    hasIMatcher: boolean
    ): Sealed<ParseFuncScope<L,T,U>, 'eMap' | 'mRec' | 'iMatcher' | 'logic'>  => {
        // Initialize
        const parser: Partial<ParseFuncScope<L,T,U>> = { args: args }
        try {
            // Get the ExpectMap for the token
            if ( ! shared.self.rules.PRMap.has(args.token) ) throw new Error(`parseInit(): Unknown parser token: '${args.token}'`)
            parser.eMap = shared.self.rules.PRMap.get(args.token)! satisfies ExpectMap<T,U>
       
            // create the result match record for the token  
            if ( parent && hasIMatcher) {
                parser.iMatcher = parent!.matchers[args.parentIdx] 
            }
            else {
                parser.iMatcher = iMatcherFac( 
                    parent ? args.caller: 'reset', 
                    parent as Sealed<ParseFuncScope<L,T,U>, 'eMap' | 'args'>, 
                    -1, 
                    shared, 
                    args.token
                )
            }
            parser.iMatcher.roundTrips = args.roundTrips

            // Add Logic object to the state
            if ( ! shared.self.rules.logicMap.has(args.token) ) {
                parser.logic = undefined
            }
            else {
                if ( ! parser.logic ) parser.logic = {} as Logic[]
                parser.logic[args.roundTrips] = new Logic( 
                    parser.iMatcher.id, 
                    _.cloneDeep( shared.self.rules.logicMap.get(args.token)!.logicGroups)
                ) 
                // s.logic = shared.self.rules.logicMap.get(args.token)!.logicGroups   // Assert that none of the logicGroups have a matched entry
                if (parser.logic[args.roundTrips] .logicGroups[0].some(entry => entry.matched)) {
                    throw new Error(`Initialized Logic group for token '${args.token}' contains a matched entry.`);
                }
            }
  
           

            if ( parser.iMatcher.key === 'arrElement')    {
                const _debugHook = 1

            }
            
            // Add Match Record to the state
            parser.mRec = matchRecInit(
                        parser as Sealed<ParseFuncScope<L,T,U>, 'eMap' | 'args' | 'iMatcher'> , 
                        shared, 
                        parser.iMatcher as Sealed<InternMatcherExt<T,U>, 'ignore'| 'keyExt' | 'breaks'>
                    ) satisfies MatchRecord<T>
            // Mark any whitespace tokens
            if ( parent && parent.mRec.ws ) parser.mRec.ws = true
            if ( parser.mRec.token === shared.always || parser.mRec.token.startsWith(shared.always + '.') ) parser.mRec.ws = true

            // Add Array of iMatchers to the state
            parser.matchers = [] as InternMatcherSealed<T,U>[]
            return parser as Sealed<ParseFuncScope<L,T,U>, 'eMap' | 'mRec' | 'iMatcher' | 'logic'>
        }
        catch (err) { 
            console.error(err)
            throw err 
        }
    }
