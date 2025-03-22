// @deno-types='https://deno.land/x/xregexp/types/index.d.ts'
import XRegExp from  'https://deno.land/x/xregexp@v1.0.1/src/index.js'
import { _ , ulid, assert} from './imports.ts';
import { getMulti } from "./util.ts";
import * as Colors from "https://deno.land/std/fmt/colors.ts" 

import { 
    Cardinality, 
    Expect, 
    ExpectEntry, 
    Logical, 
    InternMatcher, 
    Matcher, 
    ParserRules, 
    ShortExpectEntry, 
    Callback, 
    logicOpers, 
    ExpectMap,
    LexerRules
} from "./types.ts"
import { Logic } from "./Logic.ts";
import { Debug } from './Debug.ts';

export interface IIndexable<T> { [key: string]: T }

export class Rules<L extends string, T extends string, U> {
    // Debugging
    msg
    debugHook = 0
    
    // Logic groups initialization
    logicMap = new Map<string, Logic>() 

    // Lexer and Parser Maps
    LRMap         = new Map<T, Matcher<T,U>>()           // Maps the Lexer object
    LRReverseMap  = new Map<RegExp | Matcher<T,U>, T>()
    PRMap         = new Map<T, ExpectMap<T,U>>()         // Maps the Parser object  

    constructor( public LR: LexerRules<L,U>,  public PR: ParserRules<T,U> , public debugging: Debug<T,U> ) {
        this.msg = debugging.msg
        const multiDefault: Cardinality  = '0:m'
        try {
        // Map Building 
        Object.keys( LR ).forEach( key => {
            // const m = (LR as MIndexable<RegExp | Matcher<T>>)[key]
            const m = LR[key as L]
            assert ( m !== undefined,`LS, Undefined Lexer entry for key: '${key}' - probably due to bad regular expression` )
            // assert ( m instanceof RegExp || XRegExp.isRegExp(m.match), `Bad Lexer regular expression for key: '${key}'` )
            assert ( key !== undefined , `Undefined LR key for: ${JSON.stringify(m,undefined,2)}`)
            
            // Convert ALL entries to Matcher entries
            const token = key as T

            let matcher: Matcher<T,U>
            if ( ! ( 'match' in m ) ) {    
                matcher = {
                    match:  m as unknown as RegExp,
                    // deno-lint-ignore no-explicit-any
                    multi: ( m as any).multi ?? multiDefault,
                    cb: undefined
                }
            }
            else {
                matcher = m as unknown as Matcher<T,U>
            }

            // Test that the match expression can be executed
            try {
                XRegExp.test('XXX', matcher.match)
            }
            catch(err) {
                console.error( Colors.red(`Matcher: ${key} regexp has a bug: ${err}`))
            }

            if ( ! ( 'multi' in matcher ) ) matcher.multi = multiDefault
            this.LRMap.set(token, matcher)
            this.LRReverseMap.set(matcher.match, token)  
            
            assert( matcher === this.LRMap.get( token ), `LR_03 - Bad LRMap Key`)
            assert( token === this.LRReverseMap.get(matcher.match), `LR_03 - Bad LRReverseMap Object Key`)
        })

        Object.keys( PR ).forEach( key => {
            const pr = (PR as IIndexable<Expect<T,U>>)[key] 
            const expect:  InternMatcher<T,U>[] = []
            /*
            this.msg ({
                level: 0,
                text: `Mapping key: ${key} with type: ${typeof key}`,
                color: 'green'
            })
            */
            pr.expect.forEach( ( e: ExpectEntry<T,U>) => {
                if ( typeof e === 'string') {
                    expect.push( this.resolveString(e as string) )
                }
                else if ( Array.isArray(e)) {
                    const m = this.resolveExpectArray( e, multiDefault, key)
                    expect.push( this.resolveLogic(key, m) )
                }
                else if ( e instanceof RegExp ) {
                    const regKey = this.LRReverseMap.get(e as RegExp)!
                    assert ( regKey !== undefined, `PR_02 , LRReverseMap key is missing for key: ${key} as ${typeof e} --> ${JSON.stringify(e)}`)
                    const m =  this.resolveRegExp(regKey, e as RegExp)
                    expect.push( this.resolveLogic(key, m) )
                }   
                else if ( e instanceof Object  && 'match' in e  ) { 
                    // We have a Parser Match type object pointing to: 
                    //  1) a Lexer Match type object, OR
                    //  2) a Lexer RegExp type object
                    assert ( e !== undefined, `PR_03 , Match object is undefined for: ${key}`) 
                    const regKey = this.LRReverseMap.has(e as Matcher<T,U>) ? this.LRReverseMap.get(e as Matcher<T,U> ) : this.LRReverseMap.get(e.match as RegExp ) 
                    assert ( regKey !== undefined, `PR_03 , Reverse Lookup returned undefined for: ${JSON.stringify(e, undefined, 2)}`) 
                    const m =  this.resolveMatcher(regKey!, e as Matcher<T,U> )
                    expect.push( this.resolveLogic(key, m) )
                }    
                else {
                    assert ( false, `PR_03 , LRReverseMap unknown TYPE for key: ${key} as ${typeof e} --> ${JSON.stringify(e)}`)
                }         
            })

            const breakOn = (pr.breakOn ?? []).filter( ent => ent instanceof RegExp ? ent : (ent as Matcher<T,U>).match as RegExp)
            const breakOnStr = [] as string[] 
            (breakOn ?? []).forEach( ent  => breakOnStr.push(ent.toString() as string) )

            const startOn = (pr.startOn ?? []).filter( ent => ent instanceof RegExp ? ent : (ent as Matcher<T,U>).match as RegExp)
            const startOnStr = [] as string[]
            (startOn ?? []).forEach( ent  => startOnStr.push(ent.toString() as string) )    

            const [min, max] = getMulti( pr.multi ?? '0:m'  )

            this.PRMap.set(
                key as T,
                {
                    rootKey:    key as T,
                    multi:      pr.multi ?? '0:m',
                    min:        min,
                    max:        max,    
                    expect:     expect,
                    // line:       pr.line ?? false,
                    // startOn:    startOn as Array<RegExp>,
                    // startOnStr: startOnStr,
                    breaks:    breakOn as Array<RegExp>,
                    starts:    startOn as Array<RegExp>,
                    breakOnStr: breakOnStr,
                    cb:         pr.cb ?? undefined
                } satisfies  ExpectMap<T,U>
            )
        })
    }
    catch (err) { 
        console.error((err as Error).message) 
        console.error((err as Error).stack)
        }
    }

    _logicActive    = false
    // _logicKey       = ''
    _logicGroup     = -1
    _logicIdx       = -1
    _logic: Logical = 'none'
    resolveLogic( logicKey: string, m: InternMatcher<T,U>): InternMatcher<T,U> {
        if ( m.logic !== 'none' ) {
            if ( ! this._logicActive ) { 
                // Initialize new group when encountering FIRST member of a logic group
                const exist = this.logicMap.has( logicKey )
                if ( ! exist ) this.logicMap.set(logicKey, new Logic(logicKey))
                this._logicActive = true
                // this._logicKey    = logicKey
                this._logicGroup  = this.logicMap.get(logicKey)!.getLength()
                this._logicIdx    = -1    
                this._logic       = m.logic
            }
            // Set all entries but the last one by one
            m.logicGroup = this._logicGroup
            m.logicIdx   = ++this._logicIdx
            m.logicLast  = false
            m.logicApplies = true
            
            this.logicMap.get(logicKey)!.setMatch({ key: m.key, group: m.logicGroup, idx: m.logicIdx, logic: m.logic, matched: false, roundTrip:0, tries: 0, matchCnt: 0 })
            this.msg ({
                oper: 'Create Logic',
                iMatcher: undefined,
                level: 0,
                text: `Create Logic for entry -> ${logicKey}: ${JSON.stringify(this.logicMap.get(logicKey), undefined, 2 )}`,
                color: 'green'
            })
        }
        else {
            // Set the index for the LAST member of the group
            if ( this._logicActive ) { 
                m.logicGroup    = this._logicGroup
                m.logicIdx      = ++this._logicIdx
                m.logicLast     = true
                m.logicApplies  = true
                m.logic         = this._logic
                this._logicActive = false
               
                // this.__debug__(`Create Logic for -> ${logicKey}: ${JSON.stringify(this.logicMap.get(logicKey))}`)
                this.logicMap.get(logicKey)!.setMatch({ key: m.key, group: m.logicGroup, idx: m.logicIdx, logic: m.logic, roundTrip:0, tries: 0,  matched: false, matchCnt: 0 })
                this.msg ({
                    oper: 'Create Logic',
                    iMatcher: undefined,
                    level: 0,
                    text: `Create Logic for last entry -> ${logicKey}: ${JSON.stringify(this.logicMap.get(logicKey), undefined, 2 )}`,
                    color: 'green'
                })
            }
            else {
                // NO active logic group 
                m.logicGroup    = -1
                m.logicIdx      = -1
                m.logicLast     = false
                m.logicApplies  = false
                m.logic         = 'none'
            }
        }
        return m
    }

    resolveString( 
        key: string,
        multiDefault: Cardinality = '0:m',
        parent: string | undefined = undefined
    ): InternMatcher<T,U> {
        return { 
            token:      key as T,
            key:        key, 
            id:         ulid(),
            multi:      multiDefault,
            breaks:     [] as Array<RegExp>,
            starts:     [] as Array<RegExp>,
            logic:      'none',
            ignore:     false, 
            type:       'non-terminal',
            regexp:     undefined,
            cb:         undefined,
            cbLex:      undefined,
            parent:   parent,
            idx:        0,
            roundTrips: 0,
            tries:      0,
            matched:    false,
            matchCnt:   0,
            logicGroup: -1, 
            logicIdx:   -1,
            logicLast:    false, 
            logicApplies: false 
        } satisfies InternMatcher<T,U>
    }

    resolveMatcher( 
        key: string,
        e: Matcher<T,U>,
        multiDefault: Cardinality = '0:m',
        parent: string | undefined = undefined
    ): InternMatcher<T,U> {
        assert( e !== undefined, `Matcher: '${e}' is undefined` )
        assert( key !== undefined, `Matcher.key is undefined` )   
        const lexCb = this.LRMap.get(key as T)?.cb
        return { 
            token:  key as T,
            key:    key, 
            id:     ulid(),
            multi:  e.multi ?? multiDefault,
            breaks: [] as Array<RegExp>,
            starts: [] as Array<RegExp>,
            logic:  e.logic ?? 'none',
            ignore: false, 
            type:   'terminal',
            regexp: e.match as RegExp,
            // lRRef:  e as unknown as Matcher<T,U>,
            cb:     e.cb ?? undefined,
            cbLex:  lexCb ?? undefined, 
            parent: parent,
            idx:        0,
            roundTrips: 0,
            tries:      0,
            matched:    false,
            matchCnt: 0, 
            logicGroup: -1, 
            logicIdx:   -1,
            logicLast:    false, 
            logicApplies: false 
        } satisfies InternMatcher<T,U>
    }

    resolveRegExp( 
        key: string,
        e: RegExp,
        multiDefault: Cardinality = '0:m',
        parent: string | undefined = undefined
    ): InternMatcher<T,U> {
        assert( e !== undefined, `RegExp: '${e}' is undefined` )
        const regKey  = this.LRReverseMap.get(e as RegExp)!
        assert( regKey !== undefined, `regKey: '${e}'  regKey is undefined in LRReverseMap` )
        const matcher = this.LRMap.get(regKey)!
        return { 
            token:      key as T,
            key:        key, 
            id:         ulid(),
            multi:      multiDefault,
            breaks:     [] as Array<RegExp>,
            starts:     [] as Array<RegExp>,
            logic:      'none',
            logicGroup: -1,
            logicIdx:   -1,
            logicLast:  false,
            ignore:     false, 
            type:       'terminal',
            regexp:     matcher.match as RegExp,
            // lRRef:  e as unknown as RegExp,
            cb:         undefined,
            cbLex:      matcher.cb as Callback<T, unknown> ?? undefined,
            parent:   parent,
            idx:        0,
            roundTrips: 0,
            tries:      0,
            matched:    false,
            matchCnt:   0, 
            logicApplies: false 
        } satisfies InternMatcher<T,U>
    }

    resolveExpectArray( 
        e: Array<ShortExpectEntry<T,U>>, 
        multiDefault: Cardinality,
        parent: string | undefined = undefined
    ): InternMatcher<T,U> {
        const res: InternMatcher<T,U> = { 
            token:      '__undef__' as T,
            key:        '__undef__', 
            id:         ulid(),
            idx:        -1,
            multi:      multiDefault,
            breaks:     [] as Array<RegExp>,
            starts:     [] as Array<RegExp>,
            roundTrips: 0,
            tries:      0,
            matchCnt:   0, 
            logic:      'none',
            logicApplies: false,
            logicGroup: -1,
            logicIdx:   -1,
            logicLast:  false,
            ignore:     false,
            type:       'unknown',
            regexp:     undefined,
            cb:         undefined,
            cbLex:      undefined,
            parent:   parent,
            matched:    false
        } satisfies InternMatcher<T,U>
        // Checks 
        let i = 0
        for (; i < e.length; i++ ) {
            assert( e[i] !== undefined , `resolveExpectArray() got undefined match array[${i}] from '${ parent ? parent : 'unknown'}' parent - check your parser rules and lexer regexp.`)
        }
        assert( i > 0, `resolveExpectArray() got an empty match array from '${ parent ? parent : 'unknown'}' parent  - check your lexer regexp.`)
        // Resolve
        for ( const v of e ) {
            if ( typeof v === 'function' ) {
                // res.type = 'function'
                res.cb   = v as Callback<T,U>
            }
            else if ( typeof v === 'string' ) {
                if ( (v as string).indexOf(':') > 0  ) { // Cardinality
                    res.multi = v as Cardinality
                }
                else if ( logicOpers.includes(v as Logical) ) { // Logical
                    if ( v === 'ignore') 
                        res.ignore  = true
                    else {
                        res.logic = v as Logical
                        res.logicApplies = true
                    }
                }
                else { // assume T token 
                    // res.type = 'PR Token'
                    res.type = 'non-terminal'
                    res.token = v as T
                    res.key = v
                }
            }
            // deno-lint-ignore no-explicit-any
            else if ( (v as any) instanceof RegExp ) {
                res.type    = 'terminal'
                res.token   = this.LRReverseMap.get(v as RegExp)!
                res.key     = res.token
                res.regexp  = this.LRMap.get(res.token)!.match as RegExp
            }
            else { // Assume Matcher
                 'Matcher'
                // res.token   = this.LRReverseMap.get(v as unknown as Matcher<T,U>)!
                res.token   = this.LRReverseMap.get((v as Matcher<T,U>).match) as T
                const m     = this.LRMap.get(res.token)
                res.key     = res.token
                res.regexp  = m!.match
                res.type    = m!.match !== undefined ? 'terminal' : 'non-terminal'
                res.cbLex   = m!.cb
            }
        }
        assert( res.key !== undefined , `Key is missing in ParserRules entry ${JSON.stringify(e)}`)
        assert( res.key !== '__undef__' , `Key is has not been set in ParserRules entry ${JSON.stringify(e)}`)
        assert( res.type === 'non-terminal' || res.regexp !== undefined , `RegExp is missing in ParserRules entry ${JSON.stringify(e)}`)
        return res
    }
}
