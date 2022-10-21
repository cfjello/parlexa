// @deno-types='https://deno.land/x/xregexp/types/index.d.ts'
import XRegExp, { match } from  'https://deno.land/x/xregexp/src/index.js'
import { ulid } from "https://raw.githubusercontent.com/ulid/javascript/master/dist/index.js"
import { HierarKey } from "https://deno.land/x/hierarkey@v1.0/mod.ts"
import { assert } from "https://deno.land/std@0.113.0/testing/asserts.ts";
import { _ } from './lodash.ts';
import { Cardinality, Expect, ExpectEntry, Logical, Matched, MatchRecord, InternMatcher, Matcher, LexerRules, ParserRules, Info, ShortExpectEntry, Callback, MatchRecordExt, LogicDescriptor } from "./interfaces.ts"
import { ExpectMap } from "./interfaces.ts";
import * as Colors from "https://deno.land/std/fmt/colors.ts" 
import { Logic } from "./Logic.ts";

export interface IIndexable<T> { [key: string]: T }
export interface MIndexable<T> { [key: string]: RegExp | Matcher }


// Parser state
// deno-lint-ignore no-explicit-any
export class Parser<T, S = any>  {
    public debug  = false;
    debugHook     = 0
    public always = 'always';
    maxCount      = 0
    // Match positions
    line    = 1
    col     = 1 
    bol     = 0 
    pos     = 0
    firstSymbol = true
    prevToken = '__undef__'
    
    // Keep track of what tokens and rexexp has already been 
    // matched at a specific position in the inpu
    matchPositions = new Map<string, Map<number,number>> ()
    input = ''

    // Top level tokens
    topNode: string | undefined
    topToken: T | undefined

    // The Parser Result map
    result   =  new Map<string, MatchRecordExt>()
    reverseIdx =  [] as string[]

    nextIdx  = 0 
    ignoreWS = true

    // Logic groups initialization
    logicMap = new Map<string,Logic>() 

    // Lexer and Parser Maps
    private LRMap         = new Map<string, Matcher>()
    private LRReverseMap  = new Map<Matcher | RegExp, string>()
    private PRMap         = new Map<string, ExpectMap>()
    private _parseTree: {[key: string]: MatchRecord} = {}
    public get parseTree() {
        return this._parseTree;
    }

    public set parseTree( tree ) {
        this._parseTree = tree;
    }

    constructor( public LR: LexerRules,  public PR: ParserRules<T>,  public initState: T, public scope = {} as S ) {
        const multiDefault: Cardinality  = '0:m'
        try {
        // Map Building 
        Object.keys( LR ).forEach( key => {
            const m: RegExp | Matcher  = (LR as MIndexable<RegExp | Matcher>)[key]
            assert ( m !== undefined,`LS, Undefined Lexer entry for key: '${key}' - probably due to bad regular expression` )
            assert ( m instanceof RegExp || XRegExp.isRegExp(m.match), `Bad Lexer regular expression for key: '${key}'` )
            assert ( key !== undefined , `Undefined LR key for: ${JSON.stringify(m,undefined,2)}`)
            
            // Convert ALL entries to Matcher entries
            let matcher: Matcher
            if ( ! ( 'match' in m ) ) {    
                matcher = {
                    match:  m as RegExp,
                    // deno-lint-ignore no-explicit-any
                    multi: ( m as any).multi ?? multiDefault,
                    cb: undefined
                }
            }
            else {
                matcher = m as Matcher
            }

            // Test that the match expression can be executed
            try {
                XRegExp.test('XXX', matcher.match)
            }
            catch(err) {
                console.log( Colors.red(`Matcher: ${key} regexp has a bug: ${err}`))
            }

            if ( ! ( 'multi' in matcher ) ) matcher.multi = multiDefault
            this.LRMap.set(key, matcher)
            this.LRReverseMap.set((LR as MIndexable<Matcher | RegExp>)[key], key)  
            
            assert( matcher === this.LRMap.get( key ), `LR_03 - Bad LRMap Key`)
            assert( key === this.LRReverseMap.get(m), `LR_03 - Bad LRReverseMap Object Key`)
        })

        if ( this.debug ) console.debug( `KEYS: ${Object.keys( PR )}`)

        Object.keys( PR ).forEach( key => {
            const pr = (PR as IIndexable<Expect<T>>)[key] 
            const expect:  InternMatcher[] = []
            if ( this.debug ) console.log (`Mapping key: ${key} with type: ${typeof key}`)

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
                    const regKey = this.LRReverseMap.has(e as Matcher ) ? this.LRReverseMap.get(e as Matcher ) : this.LRReverseMap.get(e.match as RegExp ) 
                    assert ( regKey !== undefined, `PR_03 , Reverse Lookup returned undefined for: ${JSON.stringify(e, undefined, 2)}`) 
                    const m =  this.resolveMatcher(regKey, e as Matcher )
                    expect.push( this.resolveLogic(key, m) )
                }    
                else {
                    assert ( false, `PR_03 , LRReverseMap unknown TYPE for key: ${key} as ${typeof e} --> ${JSON.stringify(e)}`)
                }         
            })
            this.PRMap.set(
                key,
                {
                    multi: pr.multi ?? '0:m',
                    expect: expect,
                    cb: pr.cb ?? undefined
                } as ExpectMap 
            )
        })
    }
    catch (err) { 
        console.error(err.message) 
        console.error(err.stack)
        }
    }
    //
    // Utilities
    // 
    lookBehind = ( 
            matchRec :  MatchRecordExt,
            _keys:       string | string[] = ['NL'],
            _ignore:     string | string[] = ['WS'],
            _backStop:   string | string[] = ['NL']
    ): MatchRecordExt | undefined  => {
        assert( matchRec && matchRec.id && matchRec.id !== '', `lookBehind() 'id' must have a value: ${JSON.stringify(matchRec, undefined, 2)}` )

        let res: MatchRecordExt | undefined = undefined
        const keys      = Array.isArray( _keys ) ? _keys : [_keys]
        const ignore    = Array.isArray( _ignore ) ? _ignore : [_ignore]
        const backStop  = Array.isArray( _backStop ) ? _backStop : [_backStop]
        let idx  = this.reverseIdx.length - 1

        while ( --idx >= 0 ) {
            const id = this.reverseIdx[idx]
            const entry = this.result.has(id) ? this.result.get(id) : undefined
            if ( entry === undefined || ignore.includes(entry.type) ) continue
            if ( keys.includes(entry.type) || backStop.includes(entry.type) ) {
                res = entry
                break
            }
        } 
        return res
    }

    _logicActive    = false
    _logicGroup     = -1
    _logicIdx       = -1
    resolveLogic( token: string, m: InternMatcher): InternMatcher  {
        if ( m.logic !== 'none' ) {
            if ( ! this._logicActive ) { 
                // Initialize new group when encountering FIRST member of a logic group
                const exist = this.logicMap.has( token )
                if ( ! exist ) this.logicMap.set(token, new Logic(token))
                this._logicActive = true
                this._logicGroup  = this.logicMap.get(token)!.getLength()
                this._logicIdx    = -1    
            }
            // Set all entries but the last one by one
            m.logicGroup = this._logicGroup
            m.logicIdx   = ++this._logicIdx
            m.logicLast  = false
            this.logicMap.get(token)!.setMatch({ key: m.key, group: m.logicGroup, idx: m.logicIdx, logic: m.logic, matched: false, roundTrip:0, tries: 0, matchCnt: 0 })
        }
        else {
            // Set the index for the LAST member of the group
            if ( this._logicActive ) { 
                m.logicGroup = this._logicGroup
                m.logicIdx   = ++this._logicIdx
                m.logicLast  = true
                this._logicActive = false
                this.logicMap.get(token)!.setMatch({ key: m.key, group: m.logicGroup, idx: m.logicIdx, logic: m.logic, roundTrip:0, tries: 0,  matched: false, matchCnt: 0 })
                // console.debug(`Created Logic -> ${token}: ${JSON.stringify(this.logicMap.get(token))}`)
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

    // Map builder help functions
    resolveString( 
        key: string,
        multiDefault: Cardinality = '0:m',
        parent: string | undefined = undefined
    ): InternMatcher {
        return { 
            key:        key, 
            id:         ulid(),
            multi:      multiDefault,
            logic:      'none',
            ignore:     false, 
            type:       'PR Token',
            regexp:     undefined,
            cb:         undefined,
            parent:     parent
        } as InternMatcher
    }

    resolveMatcher( 
        key: string,
        e: Matcher,
        multiDefault: Cardinality = '0:m',
        parent: string | undefined = undefined
    ): InternMatcher {
        assert( e !== undefined, `Matcher: '${e}' is undefined` )
        assert( key !== undefined, `Matcher.key is undefined` )           
        return { 
            key:    key, 
            id:     ulid(),
            multi:  e.multi ?? multiDefault,
            matchCnt: 0, 
            logic:  e.logic ?? 'none',
            ignore: false, 
            type:   'Matcher',
            regexp: e.match as RegExp,
            lRRef:  e as unknown as Matcher,
            cb:     e.cb ?? undefined,
            parent: parent
        } as InternMatcher
    }

    resolveRegExp( 
        key: string,
        e: RegExp,
        multiDefault: Cardinality = '0:m',
        parent: string | undefined = undefined
    ): InternMatcher {
        
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
            cb:     matcher.cb ?? undefined,
            parent: parent
        } as InternMatcher
    }

    resolveExpectArray( 
        e: ShortExpectEntry<T>, 
        multiDefault: Cardinality,
        parent: string | undefined = undefined
    ): InternMatcher {
        const res: InternMatcher = { 
            key:    '__undef__', 
            id:     ulid(),
            multi:  multiDefault,
            roundTrip:  0,
            tries:      0,
            matchCnt: 0, 
            logic:  'none',
            logicGroup: -1,
            logicIdx: -1,
            logicLast: false,
            ignore: false,
            type:   'unknown',
            regexp: undefined,
            lRRef:  ('match' in e ) ? e as unknown as Matcher : e as unknown as RegExp,
            cb: undefined,
            parent:  parent
        } 
        // Checks 
        let i = 0
        for (; i < e.length; i++ ) {
            assert( e[i] !== undefined , `resolveExpectArray() got undefined match array[${i}] from '${ parent ? parent : 'unknown'}' parent - check your parser rules and lexer regexp.`)
        }
        assert( i > 0, `resolveExpectArray() got an empty match array from '${ parent ? parent : 'unknown'}' parent  - check your lexer regexp.`)

        e.forEach( v  => {
            if ( typeof v === 'function' ) {
                res.type = 'function'
                res.cb   = v as unknown as Callback
            }
            else if ( typeof v === 'string' ) {
                if ( v.indexOf(':') > 0  ) { // Cardinality
                    res.multi = v as Cardinality
                }
                else if ( ['or', 'xor', 'ignore', 'NOP', 'none'].includes(v) ) { // Logical
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
                res.key = this.LRReverseMap.get(v as Matcher)!
                res.regexp = this.LRMap.get(res.key)!.match
            }
        })
        assert( res.key !== undefined , `Key is missing in ParserRules entry ${JSON.stringify(e)}`)
        assert( res.type === 'PR Token' || res.regexp !== undefined , `RegExp is missing in ParserRules entry ${JSON.stringify(e)}`)
        return res
    }

    // User defined scope, that is passed to the the parser 
    // csllbacks along with the match record
    getScope(): S { return this.scope }

    //
    // Output function
    //
    getParseTree(): MatchRecord[] {
        const res: MatchRecord[] = []
        const unMatched = new Map<string, boolean>()
        if ( this.topNode ) {
            const maxDigits = this.maxCount.toString().length + 1
            const hk = new HierarKey(1, maxDigits)  
            let prevLevel = 0 
            for ( const [id, e] of this.result ) {
                // let newLevel = Math.abs( e.level - prevLevel ) 
                if ( e.matched || this.debug ) {
                    const  node = _.clone(e)
                    let  level = node.level
                    if ( level === 0 ) {
                        node.ident = hk.jumpToLevel('0')
                    }
                    else if ( level > prevLevel ) {
                        while ( level >  prevLevel ) {
                            node.ident = hk.nextLevel()
                            level--
                        }
                    }
                    else if ( node.level < prevLevel ) {
                        while ( level < prevLevel ) {
                            node.ident = hk.prevLevel()
                            level++
                        }
                    }
                    else {
                        node.ident = hk.nextLeaf()
                    }
                    res.push(node)
                    prevLevel = node.level
                }
                else {
                    unMatched.set(e.id, false)
                }
            }
        }

        // Second pass to remove child references to unmatched entries
        // deno-lint-ignore no-explicit-any
        res.forEach( (e: any) => {
            if ( e.children.length > 0 ) {
                const children: string[] = []
                e.children.forEach( (id: string) => {
                    if ( ! unMatched.has(id) ) 
                        children.push(id)
                })
                if (  e.children.length  > children.length )
                    e.children = _.clone(children)
            }
        })
        return _.sortBy(res, ['ident'])
    }

    // Interface functions
    //
    // get an result iterator
    getIterator() {
        const tree = this.getParseTree()
        return tree[Symbol.iterator]()
    }

    formatError(token: string , message = '' ): string {
        const text = this.input.substring(this.pos)
        let messageNull = ''
        if (token == null) {
            const _token: MatchRecord = {
                id:    ulid(),
                level:  -1,
                type:   token,
                value:  message,
                text:   text.substring(0, text.indexOf('\n')),
                offset: this.pos,
                newPos: this.pos,
                ofLen:  this.input.length,
                line:   this.line,
                col:    this.col,
                children: []
            }
            messageNull +=  `${JSON.stringify(_token)}` 
        }
        message += `Error at line ${this.line}, col ${this.col}:\n  ${text.substring(0, text.indexOf('\n')) }\n ${messageNull}`
        return message
    }
    
    reset( inputStr: string , info: Info<T> | undefined = undefined ) {
        this.input      = inputStr
        this.line       = info ? info.line : 1
        this.col        = info ? info.col : 1 
        this.bol        = 0 
        this.pos        = 0
        this.firstSymbol = true
        this.prevToken  = '__undef__'
        this.result     = info ? info.result : this.result.size > 0 ? new Map<string, MatchRecordExt>() : this.result
        this.parseTree  = {}
        this.nextIdx    = info ? info.nextIdx : 0
        this.ignoreWS   = info ? info.ignoreWS : false
        this.initState  = info ? info.initState : this.initState 
        this.matchPositions = new Map<string, Map<number,number>> ()
        this.parse(this.initState)
    }

    EOF() {
        return ( this.pos >= this.input.length )
    }

    setMatchPos( matchToken: string, pos: number) {
        if ( (matchToken ?? 'undefined') === 'undefined' || matchToken === '' ) {
            // force a stack trace
            throw Error( `setMatchPos() got an undefined token name` )
        }
        let count = this.matchPositions.get( matchToken)?.get(pos) ?? 1
        if ( ! this.matchPositions.has(matchToken) ) {
            this.matchPositions.set( matchToken, new Map<number,number>() )
        }    
        this.matchPositions.get( matchToken)!.set(pos, ++count)
    }

    alreadyMatched( matchToken: string, pos: number): boolean {
        assert( (matchToken ?? 'undefined') !== 'undefined' && matchToken !== '' , `alreadyMatched() got an undefined token name: '${matchToken}'`)
        if ( this.matchPositions.has(matchToken) ) {
            return this.matchPositions.get( matchToken )!.has(pos)
        }
        else
            return false
    }

    // Match functions
    matchRecFac( m: Partial<MatchRecord> ): MatchRecord {
            return {
                id:      m.id   ? m.id   : ulid(),
                type:    m.type ? m.type : '__undef__',
                value:   m.value !== undefined ? m.value : '',
                text:    m.text !== undefined ? m.text : '',
                offset:  m.offset !== undefined ? m.offset : -1 ,
                newPos:  this.pos,
                ofLen:   this.input.length,
                line:    this.line,
                col:     this.col,
                matched: m.matched !== undefined ? m.matched : false,
                parent:  m.parent ,
                level:   m.parent ? this.result.get(m.parent)!.level + 1 : 0 ,
                children: []
            } as MatchRecord
    }

    getIndent( level: number, filler = '  ') {
        return Array<string>(level).fill(filler, 0 ).join('')
    }

    doMatch( iMatcher: InternMatcher, parentId: string, level: number, roundTrips = 1 ): Matched {
        const ret: Matched = { foundToken: false, id: undefined, ignore: false } 
        if ( this.EOF() || this.alreadyMatched( iMatcher.keyExt!, this.pos) ) {
            if ( this.debug ) console.debug(`${this.getIndent(level+1)}doMatch() SKIP: ${iMatcher.key}(${level}) at ${this.pos} ALREADY TRIED against: "${this.input.substring(this.pos,this.pos + 30).replace(/\n.*/mg, '')}"`)
            return ret
        }
        if ( this.debug && this.result.get(parentId)!.value !== this.always ) {
            // ${this.result.get(parentId)!.value}.
            console.debug(Colors.blue(`${this.getIndent(level+1)}TRY: ${iMatcher.keyExt}(${level}) at ${this.pos} against: "${this.input.substring(this.pos,this.pos + 30).replace(/\n.*/mg, '')}"`))
        }
        // Run the iMatcher RegExp 
        const goingInPos = this.pos
        const res: XRegExp.ExecArray | null = XRegExp.exec(this.input, iMatcher.regexp!, goingInPos, 'sticky' )
        this.setMatchPos( iMatcher.keyExt!, goingInPos )
       
        if ( res !== null ) {
            if ( this.debug ) 
                console.debug(Colors.green(`${this.getIndent(level+1)}MATCHED: ${iMatcher.key} at pos: ${this.pos} to ${iMatcher.regexp!.lastIndex}, matched: "${this.input.substring(this.pos,iMatcher.regexp!.lastIndex)}"`) )
            // Handle position and line numbering
            this.col = this.pos - this.bol + 1
            if ( iMatcher.key === 'NL' ) { // TODO: Make this configurable
                this.line++
                this.col = 1
                this.bol = iMatcher.regexp!.lastIndex 
            }
            this.pos = iMatcher.regexp!.lastIndex
            ret.foundToken = true 
            
            // Add matched record to the result 
            const id = ulid()
            ret.id   = id
            const matchRec = this.matchRecFac({
                id:     id,
                type:   iMatcher.key,
                value:  res[2],  // This may be overwritten below, when assigning the match groups
                text:   res[0],
                matched: true,
                offset: goingInPos,
                parent: parentId
            })
           
            // Add any additional named match groups
            if ( ! _.isUndefined(res.groups ) ) {
                for ( const k in res.groups  ) {
                    // deno-lint-ignore no-explicit-any
                    (matchRec as IIndexable<any>)[k] = res.groups[k]
                }
            }
            
            // if it exists, run the callback function on the result 
            if ( iMatcher.cb !== undefined ) iMatcher.cb(matchRec, this.scope as S)

            // Store the result 
            if ( ! iMatcher.ignore ) {
                this.reverseIdx.push(id)
                this.result.set( id, matchRec)
                if (  this.result.get(iMatcher.parent ?? '-1.-1') ) this.result.get(iMatcher.parent!)!.matched = true
            }
            else {
                ret.ignore = true
            }

            // Check if the matched object RegExp name has a corresponding 
            // LHS Parser entry with an expect group
            // If new match group(s), then call parse() recursively
            if ( 
                this.pos > goingInPos && 
                this.PRMap.has(iMatcher.key) &&
                ! this.alreadyMatched( iMatcher.keyExt!, this.pos)

            ) {// The matched Lexer object has a parser entry of its own
                ret.foundToken  = this.parse(iMatcher.key as unknown as  T, id, level + 1, roundTrips)
            }
        }
        return ret
    }
  
    getMulti( multi: string): number[] {
        let res: number[] = [] 
        try {
            const [minS, maxS] = multi.split(':')
            const min = parseInt(minS)
            const max = maxS === 'm' ? Number.MAX_SAFE_INTEGER : parseInt(maxS)
            res = [min, max]
        }
        catch(err) {
            throw err
        }
        return res
    }

    failBranch( id: string, errMsg = '', level: number) {
        try {
            assert(id !== 'undefined',  `failBranch() got an 'id': ${id}`) 
            const entry    = this.result.get(id)! as MatchRecord
            assert( entry !== undefined,  `failBranch() got an undefined result entry`)
            if ( this.debug ) { `${this.getIndent(level)}failBranch(${id}) match entry: ${JSON.stringify(entry)}`}
            entry.matched  = false
            entry.matchErr = errMsg

            entry.children ?? ([] as string[]).forEach( child => {
                this.failBranch(child, '', level)
            });
            
            const name = entry.type === 'Token' ? entry.value : entry.value
            assert(name ?? 'undefined' !== 'undefined',  `failBranch() got an 'undefined' token name ${JSON.stringify(entry)}`) 
            this.setMatchPos(name as string, entry.offset)

            // Adjust the overall match position
            if ( this.debug ) console.debug( Colors.gray(`${this.getIndent(level+1)}PR Skip ${entry.value}(${level}) adjust pos ${this.pos} to ${entry.offset} --> ${errMsg}`) )
            this.pos = entry.offset
        }
        catch( err ) {
            console.log(err)
        }
    }

    // Main Parser function
    parse ( token: T, parentId: string | undefined = undefined, level = 1, roundTrips = 1): boolean {
        const tokenStr =  token + ''
        assert ( (token ?? 'undefined') !== 'undefined',`Parse(): Undefined parser token: '${token}'`)
        assert( this.PRMap.has( tokenStr ),`Parse(): Unknown parser token: '${token}'`)
        if  ( this.EOF() ) {
            if ( this.debug ) 
                console.debug(Colors.gray(`${this.getIndent(level)}Parse Skip ${token}(${level}) at ${this.pos} due to EOF `) )
            return false
        }
        //
        // Initialize
        //
        // Remember if this token is the initial token
        const firstSymbol = this.firstSymbol 
        if ( firstSymbol ) this.firstSymbol = false

        const always = this.always as unknown as T 
        const eMap: ExpectMap = this.PRMap.get(token as unknown as string)!
        const [tokenMin, tokenMax] = this.getMulti( eMap.multi ?? '0:m' )
        const hasCallback  = eMap.cb ?? false ? true : false
        let failBranch = false
        
        if ( this.debug  && tokenStr !== this.always ) {
            console.debug(`${this.getIndent(level)}PARSE: ${ tokenStr === this.prevToken ? 'retry ' : ''}${token}, roundTrip:${roundTrips}, level: ${level}`)
        }
        this.prevToken = tokenStr
       
        const goingInPos         = this.pos
        let   lastPos            = this.pos     
        const id = ulid()

        
        let parentToken = '' 
        if ( parentToken !== undefined && this.result.has(parentId!) ) {
            parentToken = `${(this.result.get(parentId!) as MatchRecord).value}`
        }
        const tokenExt =  ( parentToken !== '' ?  `${parentToken}.` : '' ) + tokenStr 
 
        if ( this.alreadyMatched( tokenExt, this.pos ) ) {
            if ( this.debug ) 
                console.debug(Colors.gray(`${this.getIndent(level)}Parse() Skips ${token}(${level}) at ${this.pos} (tried already)`))
            return false
        }
        else {
            this.setMatchPos(tokenExt, goingInPos)
        }

        const logicApplies =  this.logicMap.has(tokenStr)
        let logicKey = ''
        let logic = undefined
        if ( logicApplies ) {
            logicKey    = `${parentToken}_${tokenStr}_${roundTrips}_${id}`
            // let logic = logicApplies ? new Logic( logicKey, this.logicMap.get(tokenStr)!.getCopy(), this.debug): undefined
            this.logicMap.set( `${parentToken}_${tokenStr}_${roundTrips}_${id}`, new Logic( logicKey, this.logicMap.get(tokenStr)!.getCopy() ) )
            logic =  this.logicMap.get( `${parentToken}_${tokenStr}_${roundTrips}_${id}` )
        }

        if ( this.topNode === undefined ) {
            this.topToken = token
            this.topNode = id
        }
        // create the match record for the token
        const tokenMatchRec = this.matchRecFac({
            id:   id,
            type: 'Token',
            value: tokenStr,
            text:  tokenStr,
            offset: this.pos,
            parent: parentId 
        })
        if ( parentId ) this.result.get(parentId)!.children.push(id)
        
        this.reverseIdx.push(id)
        this.result.set( id, tokenMatchRec)

        //
        // EXPECT OUTER LOOP
        // Do the matches of the expect groups entries
        // let xorGroupMatched = false
        eMap.expect.every( ( _iMatcher: InternMatcher, i: number ) => { 
            if ( this.EOF() ) return false
            const iMatcher: InternMatcher = _.clone(_iMatcher)
            assert( iMatcher !== undefined, `eMap.expect.every(): Undefined iMatcher in 'expect array'`)
            assert( iMatcher.key !== undefined && iMatcher.key !== 'undefined', Colors.red(`eMap.expect.every(): Undefined iMatcher.key in 'expect array'`))
            assert((iMatcher.key !== tokenStr || i > 0), Colors.red(`Left recursive reference: ${iMatcher.key} to own parent token position 0` ))
            const [min, max] = this.getMulti( iMatcher.multi )
            iMatcher.id        =   id
            iMatcher.keyExt    = `${tokenStr}.${iMatcher.key}`
            iMatcher.roundTrip = roundTrips
            //
            // NON-TERMINAL SYMBOLS
            // Handle parser non-regexp grouping symbols by doing a recursive call
            if ( iMatcher.regexp === undefined ) {  
                //
                // NON-TERMINAL SYMBOLS
                // Do a recursive call for the user defined non-terminal token 
                if ( this.alreadyMatched( iMatcher.keyExt, this.pos) ) {
                    if ( this.debug ) 
                        console.debug(`${this.getIndent(level)}parse() SKIP: ${iMatcher.key}(${level}) at ${this.pos} ALREADY TRIED against: "${this.input.substring(this.pos,this.pos + 30).replace(/\n.*/mg, '')}"`)
                }
                else {
                    const childFailed = this.parse( iMatcher.key as unknown as T, id, level + 1, roundTrips )
                    iMatcher.tries++

                    if ( logic ) logic.setIMatch( iMatcher, !childFailed)

                    // Check If a mandatory child has failed 
                    if (  
                        childFailed && 
                        roundTrips === 1 && // this is not an additional retry after success
                        ! logicApplies      // This is not part of some logic e.g. XOR group
                    ) { 
                        if ( min > 0 && tokenMin > 0 ) {  // Mandatory child failed, so this branch fails
                            this.failBranch(id, `Missing mandatory child match for ${token}.${iMatcher.key} at roundtrip: ${roundTrips}`, level)
                            failBranch = true
                        }  
                    }

                    if ( logicApplies && iMatcher.logicGroup > -1  ) {
                        if ( iMatcher.logicLast ) {
                            // If this is the last token within a logic group 
                            // then we test the group
                            if ( ! logic!.isMatched(iMatcher.logicGroup, roundTrips) && // Logic Group failed 
                                  tokenMin > 0            // and the parent token is not allowed to fail
                            ) {
                                this.failBranch(id, `Missing mandatory Logic group match for ${token}.${iMatcher.key} at roundtrip: ${roundTrips}`, level)
                                failBranch = true
                            }
                        }   
                    }
                }
            }
            else {
                //
                // TERMINAL SYMBOLS
                // RHS INNER LOOP for regexp matching
                //
                let match: Matched = { foundToken: false, id: undefined, ignore: false}
                let matchCnt = 0
                let loopCnt  = 0
                iMatcher.roundTrip = roundTrips
                iMatcher.parent = id
                do {
                    iMatcher.tries = ++loopCnt
                    // Handling White space/ newline entries
                    if ( token !== always ) { 
                        this.parse( always, id, level )
                        tokenMatchRec.offset = this.pos
                        this.result.get(id)!.offset = this.pos 
                    }   
                    lastPos = lastPos < this.pos ? this.pos : lastPos
                    //
                    //  Do the actual match, taking the cardinality into account
                    //
                    if ( ! this.alreadyMatched(iMatcher.keyExt, this.pos ) ) {
                        // Main match function
                        match = this.doMatch(iMatcher, id, level, roundTrips)
                        iMatcher.tries++

                        // Remember the match
                        if ( match.foundToken ) {
                            assert( match.id !== undefined , `Match id is not set in: ${JSON.stringify(match)}`) 
                            iMatcher.matchCnt = ++matchCnt  
                            if ( ! match.ignore ) this.result.get( id )!.children.push( match.id! )
                        }
                           
                        // Remember any Logic, if applicable
                        if ( logicApplies ) {
                            logic!.setIMatch(iMatcher, match.foundToken)
                        }

                        // Match validation
                        // Step 1: Check if currently active Logic Group has failed
                        // if so, fail and exit the whole branch
                        if ( iMatcher.logicGroup > -1  ) {
                            if ( iMatcher.logicLast ) {
                                if ( ! logic!.isMatched(iMatcher.logicGroup, roundTrips)  ) {
                                    if ( matchCnt < min && // Logic Group failed 
                                         tokenMin > 0     // and the parent token is not allowed to fail) 
                                    ) 
                                    {
                                        this.failBranch(id, `Logic match constraint is violated for ${iMatcher.keyExt}`, level)
                                        failBranch = true
                                    }
                                }
                            }
                        }
                    } 
                }
                while ( 
                    match.foundToken && 
                    matchCnt < max      && 
                    !failBranch      && 
                    ( iMatcher.logicGroup < 0 || min > 1 ) &&
                    ! this.EOF() 
                ) 
                //
                // Final Evaluation of match count
                if ( iMatcher.logicGroup < 0 && ( matchCnt > max || matchCnt < min ) ) {
                        // Fail this branch of matching due to failed cardinality constraint
                        this.failBranch(id, `Failed match count: ${matchCnt} for ${iMatcher.keyExt} at roundtrip: ${roundTrips}`, level)
                        failBranch = true
                }

                if ( failBranch ) {
                    if ( this.debug ) console.debug(`${this.getIndent(level)}TRY_END: ${token}(${level}).${iMatcher.key}`)
                }
                else {
                    if (matchCnt > this.maxCount ) this.maxCount = matchCnt
                }
            } 
            return !failBranch 
        });
        //
        // Token level Evaluation 
        //
        const progress  = this.pos > goingInPos
        const rtOffset  = failBranch ? -1 : -0 
        const inRange   = (roundTrips + rtOffset) >= tokenMin && (roundTrips + rtOffset) <= tokenMax
        const matched   = progress && inRange

        this.result.get(id)!.matched = matched
        
        // If defined, call the ParserRules token callback: cb( curretMatchRecord, userDefinedScopeObject)
        if ( matched && hasCallback ) {
            eMap.cb!( tokenMatchRec, this.scope as S )
        }
        // this.setMatchPos(tokenExt, goingInPos)

        // Check whether to retry the current symbol:
        //  - the branch did not fail
        //  - we are below the allowed maximum number of matches
        //  - and not at EOF
        const proceed = matched && roundTrips < tokenMax && ! this.alreadyMatched(tokenExt, this.pos ) && ! this.EOF() 
        if ( tokenStr === 'reset' ) {
            this.debugHook = 1
        }
        if  ( proceed ) {
            // Retry the same token for additional matches 
            logic = undefined
            this.logicMap.delete(logicKey)
            if ( this.debug ) console.log(`${this.getIndent(level)}RETRY token: ${token}`)
            this.parse( token, id, level, roundTrips + 1 )
        }
      
        // In case we did not parse the whole input string:
        // Parser Error message with pointer to the specific 
        // line and position in the input where the parsing failed.
        if ( firstSymbol && this.pos < this.input.length ) {
            let nlPos = this.input.substring(0, this.pos > 2 ? this.pos -2 : 0 ).lastIndexOf('\n')
            nlPos = nlPos < 0 ? nlPos = 0 : nlPos + 1
            // let fill = this.pos - nlPos 
            const fill: string[] = []
            for ( let i = nlPos; i < this.pos; i++ ) {  fill.push('-') }
            const cursor = fill.join('') + '^'
            console.error( Colors.red(`Parser cannot match at line ${this.line} column ${this.col}:`))
            console.error( this.input.substring(0, this.pos + 20 ) )
            console.error( Colors.red( cursor )) 
            throw Error( `Parse was imcomplete: ${this.pos} < ${this.input.length} (length of input)`)
        }

        if ( this.debug  && tokenStr !== this.always ) console.debug( ( `${this.getIndent(level)}PARSE_END: ${token}(${level})`)) 
        return failBranch
    }
}