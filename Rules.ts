// @deno-types='https://deno.land/x/xregexp/types/index.d.ts'
import XRegExp from  'https://deno.land/x/xregexp/src/index.js'
import {  encodeTime, ulid } from "https://raw.githubusercontent.com/ulid/javascript/master/dist/index.js"
import { HierarKey } from "https://deno.land/x/hierarkey@v1.0/mod.ts"
import { assert } from "https://deno.land/std/assert/mod.ts";
import { _ } from './lodash.ts';
import * as Colors from "https://deno.land/std/fmt/colors.ts" 

import { 
    Cardinality, 
    Expect, 
    ExpectEntry, 
    Logical, 
    MatchRecord, 
    InternMatcher, 
    Matcher, 
    LexerRules, 
    ParserRules, 
    ShortExpectEntry, 
    Callback, 
    MatchRecordExt, 
    logicOpers, 
    InternMatcherSealed,
    ExpectMap
} from "./types.ts"
import { Logic } from "./Logic.ts";
import {Validate } from "./Validate.ts";

export interface IIndexable<T> { [key: string]: T }
// export interface MIndexable<T> { [key: string]: RegExp | Matcher<T> }

export class Rules<T>  {
    util: Validate = new Validate()
    // Debugging
    private _debug = false;
    public get debug() {
        return this._debug;
    }
    public set debug(value) {
        this._debug    = value;
        this.util.debug = value
    }
    debugHook     = 0
    // deno-lint-ignore no-explicit-any
    private __debug__ = ( args: any ) => { if ( this.debug ) console.debug(args) }
    
    // Logic groups initialization
    logicMap = new Map<string, Logic>() 

    // Lexer and Parser Maps
    LRMap         = new Map<string, Matcher<T>>()           // Maps the Lexer object
    LRReverseMap  = new Map<RegExp | Matcher<T>, string>()
    PRMap         = new Map<string, ExpectMap<T>>()         // Maps the Parser object  

    constructor( public LR: LexerRules,  public PR: ParserRules<T> ) {
        // this.__debug__('INTO Parser constructor()')
        const multiDefault: Cardinality  = '0:m'
        try {
        // Map Building 
        Object.keys( LR ).forEach( key => {
            // const m = (LR as MIndexable<RegExp | Matcher<T>>)[key]
            const m = LR[key]
            assert ( m !== undefined,`LS, Undefined Lexer entry for key: '${key}' - probably due to bad regular expression` )
            assert ( m instanceof RegExp || XRegExp.isRegExp(m.match), `Bad Lexer regular expression for key: '${key}'` )
            assert ( key !== undefined , `Undefined LR key for: ${JSON.stringify(m,undefined,2)}`)
            
            // Convert ALL entries to Matcher entries
            let matcher: Matcher<T>
            if ( ! ( 'match' in m ) ) {    
                matcher = {
                    match:  m as RegExp,
                    // deno-lint-ignore no-explicit-any
                    multi: ( m as any).multi ?? multiDefault,
                    cb: undefined
                }
            }
            else {
                matcher = m as unknown as Matcher<T>
            }

            // Test that the match expression can be executed
            try {
                XRegExp.test('XXX', matcher.match)
            }
            catch(err) {
                console.error( Colors.red(`Matcher: ${key} regexp has a bug: ${err}`))
            }

            if ( ! ( 'multi' in matcher ) ) matcher.multi = multiDefault
            this.LRMap.set(key, matcher)
            this.LRReverseMap.set(LR[key] , key)  
            
            assert( matcher === this.LRMap.get( key ), `LR_03 - Bad LRMap Key`)
            assert( key === this.LRReverseMap.get(m), `LR_03 - Bad LRReverseMap Object Key`)
        })

        this.__debug__( `KEYS: ${Object.keys( PR )}`)

        Object.keys( PR ).forEach( key => {
            const pr = (PR as IIndexable<Expect<T>>)[key] 
            const expect:  InternMatcher<T>[] = []
            this.__debug__ (`Mapping key: ${key} with type: ${typeof key}`)

            pr.expect.forEach( ( e: ExpectEntry<T>) => {
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
                    const regKey = this.LRReverseMap.has(e as Matcher<T> ) ? this.LRReverseMap.get(e as Matcher<T> ) : this.LRReverseMap.get(e.match as RegExp ) 
                    assert ( regKey !== undefined, `PR_03 , Reverse Lookup returned undefined for: ${JSON.stringify(e, undefined, 2)}`) 
                    const m =  this.resolveMatcher(regKey, e as Matcher<T> )
                    expect.push( this.resolveLogic(key, m) )
                }    
                else {
                    assert ( false, `PR_03 , LRReverseMap unknown TYPE for key: ${key} as ${typeof e} --> ${JSON.stringify(e)}`)
                }         
            })

            const startOn = (pr.startOn ?? []).filter( ent => ent instanceof RegExp ? ent : (ent as Matcher<T>).match as RegExp)
            const startOnStr = [] as string[] 
            (startOn ?? []).forEach( ent => startOnStr.push(ent.toString() as string) )

            const breakOn = (pr.breakOn ?? []).filter( ent => ent instanceof RegExp ? ent : (ent as Matcher<T>).match as RegExp)
            const breakOnStr = [] as string[] 
            (breakOn ?? []).forEach( ent  => breakOnStr.push(ent.toString() as string) )

            const [min, max] = this.util.getMulti( pr.multi ?? '0:m'  )

            this.PRMap.set(
                key,
                {
                    rootKey:    key,
                    multi:      pr.multi ?? '0:m',
                    min:        min,
                    max:        max,    
                    expect:     expect,
                    line:       pr.line ?? false,
                    startOn:    startOn as Array<RegExp>,
                    startOnStr: startOnStr,
                    breakOn:    breakOn as Array<RegExp>,
                    breakOnStr: breakOnStr,
                    cb:         pr.cb ?? undefined
                } satisfies  ExpectMap<T> 
            )
        })
    }
    catch (err) { 
        console.error(err.message) 
        console.error(err.stack)
        }
    }

    _logicActive    = false
    _logicGroup     = -1
    _logicIdx       = -1
    resolveLogic( logicKey: string, m: InternMatcher<T>): InternMatcher<T>  {
        if ( m.logic !== 'none' ) {
            if ( ! this._logicActive ) { 
                // Initialize new group when encountering FIRST member of a logic group
                const exist = this.logicMap.has( logicKey )
                if ( ! exist ) this.logicMap.set(logicKey, new Logic(logicKey))
                this._logicActive = true
                this._logicGroup  = this.logicMap.get(logicKey)!.getLength()
                this._logicIdx    = -1    
            }
            // Set all entries but the last one by one
            m.logicGroup = this._logicGroup
            m.logicIdx   = ++this._logicIdx
            m.logicLast  = false
            this.logicMap.get(logicKey)!.setMatch({ key: m.key, group: m.logicGroup, idx: m.logicIdx, logic: m.logic, matched: false, roundTrip:0, tries: 0, matchCnt: 0 })
        }
        else {
            // Set the index for the LAST member of the group
            if ( this._logicActive ) { 
                m.logicGroup = this._logicGroup
                m.logicIdx   = ++this._logicIdx
                m.logicLast  = true
                this._logicActive = false
                this.__debug__(`Create Logic for -> ${logicKey}: ${JSON.stringify(this.logicMap.get(logicKey))}`)
                this.logicMap.get(logicKey)!.setMatch({ key: m.key, group: m.logicGroup, idx: m.logicIdx, logic: m.logic, roundTrip:0, tries: 0,  matched: false, matchCnt: 0 })
            }
            else {
                // NO active logic group 
                m.logicGroup = -1
                m.logicIdx   = -1
                m.logicLast  = false
            }
        }
        return m
    }

    // Map builder help functionstokenEx
    resolveString( 
        key: string,
        multiDefault: Cardinality = '0:m',
        parent: string | undefined = undefined
    ): InternMatcher<T> {
        return { 
            key:        key, 
            id:         ulid(),
            multi:      multiDefault,
            logic:      'none',
            ignore:     false, 
            type:       'PR Token',
            regexp:     undefined,
            cb:         undefined,
            cbLex:      undefined,
            parentId:     parent
        } as InternMatcher<T>
    }

    resolveMatcher( 
        key: string,
        e: Matcher<T>,
        multiDefault: Cardinality = '0:m',
        parent: string | undefined = undefined
    ): InternMatcher<T> {
        assert( e !== undefined, `Matcher: '${e}' is undefined` )
        assert( key !== undefined, `Matcher.key is undefined` )   
        const lexCb = this.LRMap.get(key)?.cb
        return { 
            key:    key, 
            id:     ulid(),
            multi:  e.multi ?? multiDefault,
            matchCnt: 0, 
            logic:  e.logic ?? 'none',
            ignore: false, 
            type:   'Matcher',
            regexp: e.match as RegExp,
            lRRef:  e as unknown as Matcher<T>,
            cb:     e.cb ?? undefined,
            cbLex:  lexCb, 
            parentId: parent
        } as InternMatcher<T>
    }

    resolveRegExp( 
        key: string,
        e: RegExp,
        multiDefault: Cardinality = '0:m',
        parent: string | undefined = undefined
    ): InternMatcher<T> {
        
        assert( e !== undefined, `RegExp: '${e}' is undefined` )
        const regKey  = this.LRReverseMap.get(e as RegExp)!
        assert( regKey !== undefined, `regKey: '${e}'  regKey is undefined in LRReverseMap` )
        const matcher = this.LRMap.get(regKey)!
        return { 
            key:    key, 
            id:     ulid(),
            multi:  multiDefault,
            matchCnt: 0, 
            logic:  'none',
            logicGroup: -1,
            logicIdx: -1,
            logicLast: false,
            ignore: false, 
            type:   'RegExp',
            regexp: matcher.match as RegExp,
            lRRef:  e as unknown as RegExp,
            cb:     undefined,
            cbLex:  matcher.cb,
            parentId: parent
        } as InternMatcher<T>
    }

    resolveExpectArray( 
        e: ShortExpectEntry<T>, 
        multiDefault: Cardinality,
        parent: string | undefined = undefined
    ): InternMatcher<T> {
        const res: InternMatcher<T> = { 
            key:        '__undef__', 
            id:         ulid(),
            idx:        -1,
            multi:      multiDefault,
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
            lRRef:      ('match' in e ) ? e as unknown as Matcher<T> : e as unknown as RegExp,
            cb:         undefined,
            cbLex:      undefined,
            parentId:     parent,
            failed:     false,
            matched:    false
        } 
        // Checks 
        let i = 0
        for (; i < e.length; i++ ) {
            assert( e[i] !== undefined , `resolveExpectArray() got undefined match array[${i}] from '${ parent ? parent : 'unknown'}' parent - check your parser rules and lexer regexp.`)
        }
        assert( i > 0, `resolveExpectArray() got an empty match array from '${ parent ? parent : 'unknown'}' parent  - check your lexer regexp.`)

        e.forEach(  v => {
            if ( typeof v === 'function' ) {
                res.type = 'function'
                res.cb   = v as Callback
            }
            else if ( typeof v === 'string' ) {
                if ( v.indexOf(':') > 0  ) { // Cardinality
                    res.multi = v as Cardinality
                }
                else if ( logicOpers.includes(v as Logical) ) { // Logical
                    if ( v === 'ignore') 
                        res.ignore  = true
                    else
                        res.logic = v as Logical
                }
                else { // assume T token 
                    res.type = 'PR Token'
                    res.key = v
                }
            }
            else if ( v instanceof RegExp ) {
                res.type = 'RegExp'
                res.key = this.LRReverseMap.get(v as RegExp)!
                res.regexp = this.LRMap.get(res.key)!.match as RegExp
            }
            else { // Assume Matcher
                res.type = 'Matcher'
                res.key = this.LRReverseMap.get(v as Matcher<T>)!
                const m = this.LRMap.get(res.key)
                res.regexp = m!.match
                res.cbLex = m!.cb
            }
        })
        assert( res.key !== undefined , `Key is missing in ParserRules entry ${JSON.stringify(e)}`)
        assert( res.type === 'PR Token' || res.regexp !== undefined , `RegExp is missing in ParserRules entry ${JSON.stringify(e)}`)
        return res
    }
}
