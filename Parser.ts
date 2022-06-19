// @deno-types='https://deno.land/x/xregexp/types/index.d.ts'
import XRegExp from  'https://deno.land/x/xregexp/src/index.js'
import { ulid } from "https://raw.githubusercontent.com/ulid/javascript/master/dist/index.js"
import { HierarKey } from "https://deno.land/x/hierarkey@v1.0/mod.ts"
import { assert } from "https://deno.land/std@0.113.0/testing/asserts.ts";
import { Cardinality, Expect, ExpectEntry, Logical, Matched, MatchRecord, InternMatcher, XorGroup, Matcher, LexerRules, ParserRules, Info } from "./interfaces.ts"
import { lodash as _ } from 'https://deno.land/x/deno_ts_lodash/mod.ts'
import { ExpectMap } from "./interfaces.ts";

export interface IIndexable<T> { [key: string]: T }
export interface MIndexable<T> { [key: string]: RegExp | Matcher }

export class Parser<T>  {
    private _debug  = false;
    public get debug() {
        return this._debug;
    }
    public set debug(value: boolean) {
        this._debug = value;
    }

    private _always = 'always';
    public get always() {
        return this._always;
    }
    public set always(value:string) {
        this._always = value;
    }

    maxCount        = 0
    // Match positions
    line    = 1
    col     = 1 
    bol     = 0 
    pos     = 0
    firstSymbol = true
    prevToken = '__undef__'
    matchPositions = new Map<string, Map<number,number>> ()
    input = ''

    // Top level tokens
    topNode: string | undefined
    topToken: T | undefined

    // Parser state
    result                = new Map< string, MatchRecord>()
    nextIdx = 0 
    ignoreWS = true

    // Lexer and Parser Maps
    private LRMap         = new Map<string, Matcher>()
    private LRReverseMap  = new Map<RegExp | Matcher, string>()
    private PRMap         = new Map<string, ExpectMap>()

    private _parseTree: {[key: string]: MatchRecord} = {}
    public get parseTree() {
        return this._parseTree;
    }

    constructor( public LR: LexerRules,  public PR: ParserRules<T>,  public initState: T ) {
        const multiDefault: Cardinality  = '0:m'

        // Map Building 
        Object.keys( LR ).forEach( key => {
            const m: RegExp | Matcher  = (LR as MIndexable<RegExp | Matcher>)[key]
            assert ( m !== undefined,`LS, Undefined Lexer entry for key: '${key}' - probably due to bad regular expression` )
            assert ( m instanceof RegExp || XRegExp.isRegExp(m.match), `Bad Lexer regular expression for key: '${key}'` )
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
            // Test the match expression
            try {
                XRegExp.test('XXX', matcher.match)
            }
            catch(err) {
                console.log( `Matcher: ${key} regexp has a bug: ${err}`)
            }

            if ( ! ( 'multi' in matcher ) ) matcher.multi = multiDefault
            if ( ! ( 'cb' in matcher ) )    matcher.cb    = undefined
            assert ( XRegExp.isRegExp(matcher.match), `LS, Matcher for ${key} is not a regular expression --> ${JSON.stringify(m)}`)
            this.LRMap.set(key, matcher)
            this.LRReverseMap.set((LR as MIndexable<RegExp | Matcher>)[key], key)   
            
            assert( matcher === this.LRMap.get( key ), `LR_03 - Bad LRMap Key`)
            assert( key === this.LRReverseMap.get( m ) , `LR_03 - Bad LRReverseMap Object Key`)
        })


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
                    expect.push( this.resolveXor(m) )
                }
                else {
                    const regKey = ( 'match' in e ) ? this.LRReverseMap.get(e as Matcher)! : this.LRReverseMap.get(e as RegExp)!
                    assert ( regKey !== undefined, `PR_02 , LRReverseMap key is missing for key: ${key} as ${typeof e} --> ${JSON.stringify(e)}`)
                    const m =  ( 'match' in e ) ? this.resolveMatcher(regKey, e as Matcher ) : this.resolveRegExp(regKey, e as RegExp )
                    expect.push( this.resolveXor(m) )
                }                
            })
            this.PRMap.set(
                key,
                {
                    multi: pr.multi ?? '0:m',
                    expect: expect
                } as ExpectMap 
            )
        })
    }

    _xorActive = false
    _xorGroup  = -1
    _xorIdx    = -1
    resolveXor( m: InternMatcher): InternMatcher  {
        if ( m.logic ) {
            if ( m.logic  === 'xor' )  {
                if ( ! this._xorActive ) {
                    this._xorActive = true
                    this._xorGroup += 1
                    this._xorIdx    = -1 
                }
                m.xorGroup = this._xorGroup
                m.xorIdx   = ++this._xorIdx
            }
            else {
                if ( this._xorActive ) {
                    m.xorGroup = this._xorGroup
                    m.xorIdx   = ++this._xorIdx
                    this._xorActive = false
                }
                else {
                    m.xorGroup = -1
                    m.xorIdx   = -1
                }
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
            multi:      multiDefault,
            logic:      'NOP',
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
        return { 
            key:    key, 
            multi:  e.multi ?? multiDefault,
            logic:  e.logic ?? 'NOP',
            ignore: false, 
            type:   'Matcher',
            regexp: e.match as RegExp,
            lRRef:  e as unknown as Matcher,
            cb:     e.cb,
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
            multi:  multiDefault,
            logic:  'NOP',
            ignore: false, 
            type:   'RegExp',
            regexp: matcher.match as RegExp,
            lRRef:  e as unknown as RegExp,
            cb:     matcher.cb ?? undefined,
            parent: parent
        } as InternMatcher
    }

    resolveExpectArray( 
        e: Array<Matcher | RegExp | T | Cardinality | Logical> , 
        multiDefault: Cardinality,
        parent: string | undefined = undefined
    ): InternMatcher {
        const res: InternMatcher = { 
            key:    '__undef__', 
            multi:  multiDefault, 
            logic:  'NOP',
            ignore: false,
            type:   'unknown',
            regexp: undefined,
            lRRef:  ('match' in e ) ? e as unknown as Matcher : e as unknown as RegExp,
            parent:  parent
        } 
        // Checks 
        let i = 0
        for (; i < e.length; i++ ) {
            assert( e[i] !== undefined , `resolveExpectArray() got undefined match array[${i}] from '${ parent ? parent : 'unknown'}' parent - check your lexer regexp.`)
        }
        assert( i > 0, `resolveExpectArray() got an empty match array from '${ parent ? parent : 'unknown'}' parent  - check your lexer regexp.`)

        e.forEach( v  => {
            if ( typeof v === 'string' ) {
                if ( v.indexOf(':') > 0  ) { // Cardinality
                    res.multi = v as Cardinality
                }
                else if ( ['xor', 'ignore', 'NOP'].includes(v) ) { // Logical
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

    // Output function
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
        this.result     = info ? info.result : this.result
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
        if ( (matchToken ?? 'undefined') === 'undefined' || matchToken === '' ) {
            throw new Error(`alreadyMatched() got an undefined token name: '${matchToken}'`)
        }
        if ( this.matchPositions.has(matchToken) ) {
            if ( this.debug && matchToken  === 'BAR_T' ) {
                console.log(`alreadyMatched: '${this.matchPositions.get( matchToken )!.get(pos)}' matched at ${pos}` )
            }
            return this.matchPositions.get( matchToken )!.has(pos)
        }
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
        if ( this.EOF() || this.alreadyMatched( iMatcher.key, this.pos) ) {
            return ret
        }
        if ( this.debug && this.result.get(parentId)!.value !== this.always ) {
            console.log(`${this.getIndent(level+1)}TRY: ${this.result.get(parentId)!.value}(${level}).${iMatcher.key} at ${this.pos} against: "${this.input.substring(this.pos,this.pos + 30).replace(/\n.*/mg, '')}"`)
        }
        // Run the iMatcher RegExp 
        const res: XRegExp.ExecArray | null = XRegExp.exec(this.input, iMatcher.regexp!, this.pos, 'sticky' )
        const lastPos = this.pos
        this.setMatchPos( iMatcher.key, this.pos )
       
        if ( res !== null ) {
            // if it exists, run the callback function on the result 
            if ( iMatcher.cb !== undefined ) iMatcher.cb(res)
            if ( this.debug ) console.log(`${this.getIndent(level+1)}MATCHED: ${iMatcher.key} at pos: ${this.pos} to ${iMatcher.regexp!.lastIndex}, matched: "${this.input.substring(this.pos,iMatcher.regexp!.lastIndex)}"`)
            // Handle position and line numbering
            this.col = this.pos - this.bol + 1
            if ( iMatcher.key === 'NL' ) {
                this.line++
                this.col = 1
                this.bol = iMatcher.regexp!.lastIndex 
            }
            this.pos = iMatcher.regexp!.lastIndex
            
            // Add matched record to the result 
            ret.foundToken = true 
            const id = ulid()
            ret.id   = id
            const outObj = this.matchRecFac({
                id:     id,
                type:   iMatcher.key,
                value:  res[2],  // This may be overwritten below, when assigning the match groups
                text:   res[0],
                matched: true,
                offset: lastPos,
                parent: parentId
            })
            
            // Add any additional named match groups
            if ( ! _.isUndefined(res.groups ) ) {
                // if ( this.debug ) console.log( `GROUPS: ${JSON.stringify( res.groups )}`)
                for ( const k in res.groups  ) {
                    // deno-lint-ignore no-explicit-any
                    (outObj as IIndexable<any>)[k] = res.groups[k]
                }
            }

            // Store the result 
            if ( ! iMatcher.ignore ) {
                this.result.set( id, outObj)
                if (  this.result.get(iMatcher.parent ?? '-1.-1') ) this.result.get(iMatcher.parent!)!.matched = true
            }
            else {
                ret.ignore = true
            }

            // Check if the matched object has a LHS Parser entry and an expect group
            // If new match group(s), then call parse() recursively
            if ( 
                this.pos > lastPos && 
                this.PRMap.get(iMatcher.key) !== undefined 
            ) {// The matched Lexer object has a parser entry of its own
                ret.foundToken  = this.parse(iMatcher.key as unknown as  T, id, level + 1, roundTrips + 1)
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
            if ( this.debug ) console.log(`${this.getIndent(level)}PR Skip ${entry.value}(${level}) adjust pos ${this.pos} to ${entry.offset} --> ${errMsg}`)
            this.pos = entry.offset
        }
        catch( err ) {
            console.log(err)
        }
    }

    // Main Parser function
    parse ( token: T, parentId: string | undefined = undefined, level = 1, roundTrips = 1): boolean {
        // Checks
        if ( (token ?? 'undefined') === 'undefined' ) throw new Error(`Parse(): Undefined parser token: '${token}'`)
        if ( ! this.PRMap.has( token + '' ) ) throw Error(`Parse(): Unknown parser token: '${token}'`)
        if  ( this.EOF() ) {
            if ( this.debug ) console.log(`${this.getIndent(level)}Parse Skip ${token}(${level}) at ${this.pos} due to EOF `)
            return false
        }
        // Use an '_T' suffix for no-terminal symbols as apposed to terminal symbols of the same name
        if ( token + '' !== this.always && this.alreadyMatched( token + '_T', this.pos ) ) {
            if ( this.debug  && token + '' !== this.always ) console.log(`${this.getIndent(level)}Parse Skip ${token}(${level}) at ${this.pos} (tried already)`)
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
        const [pMin, pMax] = this.getMulti( eMap.multi ?? '0:m' )
        let failBranch = false
        let childFailed = false
        
        if ( this.debug  && token + '' !== this.always ) {
            console.log(`${this.getIndent(level)}PARSE: ${ token + '_T' === this.prevToken ? 'retry ' : ''}${token}(${level})`)
        }
        this.prevToken = token + '_T'
       
        const goingInPos        = this.pos
        let   lastPos           = this.pos 
        let   xorGroupActive    = false
        let   xorGroupWasActive = false
        // let   xorMatched      = false
        let  xorMatched: boolean[] = []
        // let   xorGroupMatched = false
        const xorGroups: XorGroup[] = []

        let   validateXor = false

        // Handle the hierarchy numbering     
        const id = ulid()
        if ( this.topNode === undefined ) {
            this.topToken = token
            this.topNode = id
        }

        // create the match record for the token
        const tokenMatchRec = this.matchRecFac({
            id:   id,
            type: 'Token',
            value: token + '',
            text:  token + '',
            offset: this.pos,
            parent: parentId 
        })
        if ( parentId ) this.result.get(parentId)!.children.push(id)
        
        this.result.set( id, tokenMatchRec)

        //
        // EXPECT OUTER LOOP
        // Do the matches of the expect groups entries
        eMap.expect.every( ( iMatcher: InternMatcher, i: number ) => {  
            assert( iMatcher !== undefined, `eMap.expect.every(): Undefined iMatcher in 'expect array'`)
            assert( iMatcher.key !== undefined || iMatcher.key !== 'undefined', `eMap.expect.every(): Undefined iMatcher.type in 'expect array'`)
            const [min, max] = this.getMulti( iMatcher.multi )
            
            // XOR Handling
            if ( i == 0 ) { // Initialize
                xorGroupActive = false
                xorMatched = []
                xorMatched.push(false)
            }
            xorGroupWasActive = xorGroupActive
            xorGroupActive = ( iMatcher.xorGroup ?? -1 ) > -1

            if ( xorGroupActive && xorMatched[ xorMatched.length -1 ] ) {
                if ( this.debug )  {
                    console.log(`${this.getIndent(level)}XorGroup Skip ${token}.${iMatcher.key}(${level}) at ${this.pos} (group already matched)`)
                }
                return true
            }

            if ( ! xorGroupActive && xorGroupWasActive ) {
                xorGroupWasActive = false
                if ( ! xorMatched[ xorMatched.length -1 ] ) {
                     // XOR group failed, so this branch fails
                     this.failBranch(id, `No match found in ${token} XOR group: ${xorMatched.length -1} at roundtrip: ${roundTrips}`, level)
                     failBranch = true
                }
            }

            // Handle iMathcer that has already been matched
            if ( this.alreadyMatched( iMatcher.key, this.pos ) ) {
                if ( this.debug  && token + '' !== this.always )  {
                    console.log(`${this.getIndent(level+1)}LR Skip ${token}.${iMatcher.key}(${level}) at ${this.pos} (tried already)`)
                }
                if ( min > 0 &&           // symbol or pattern is mandatory
                     ! xorGroupActive &&  // we are not dealing with an xor grouping that must be evaluated later
                     roundTrips === 1     // this is the first time in so the mandatory match has not already succeded
                )  {
                    this.failBranch(id, `Missing mandatory match for ${token}.${iMatcher.key} at roundtrip: ${roundTrips}`, level)
                    failBranch = true
                }
            }
            
            if ( ! failBranch ) {
                // Handle parser non-regexp grouping symbols by doing a recursive call
                if ( iMatcher.regexp === undefined ) {  
                    // Do a recursive call or a match if the match entry is a user defined token 
                    childFailed = this.parse( iMatcher.key as unknown as T, id, level + 1, roundTrips + 1 )
                    //
                    // If mandatory child Failed 
                    if ( childFailed ) {    // Child failed
                        if ( ! xorGroupActive ) {    // we are not dealing with an xor grouping that must be evaluated later
                            if ( 
                                 min > 0 &&          // symbol or pattern is mandatory
                                 roundTrips === 1    // this is the first time in so the mandatory match has not already succeded
                            ) {
                                // Mandatory child failed, so this branch fails
                                this.failBranch(id, `Missing mandatory child match for ${token}.${iMatcher.key} at roundtrip: ${roundTrips}`, level)
                                failBranch = true
                            }
                            else { // we are dealing with an xor grouping
                                if ( this.debug ) console.log(`${this.getIndent(level)}${token} at roundtrip: ${roundTrips}`)
                            }
                        }
                    }
                    
                }
                else {
                    // RHS INNER REPEAT LOOP for regexp matching
                    let match: Matched
                    let count = 0 
                    do {
                        // Handling White space/ newline entries
                        if ( token !== always ) { 
                            let alwaysPos: number 
                            do {
                                alwaysPos = this.pos
                                this.parse( always, id, level )
                                tokenMatchRec.offset = this.pos
                            }
                            while( this.pos > alwaysPos )
                            if ( this.pos > alwaysPos ) this.result.get(id)!.offset = this.pos
                            lastPos = lastPos < this.pos ? this.pos : lastPos
                        }    

                        //  Do the actual match, taking the cardinality into account
                        iMatcher.parent = id
                        match = this.doMatch(iMatcher, id, level, roundTrips)

                        // Remember the match
                        if ( match.foundToken ) {
                            assert( match.id !== undefined , `Match id is not set in: ${JSON.stringify(match)}`) 
                            if ( ! match.ignore ) this.result.get( id )!.children.push( match.id! )
                            count++
                            if ( xorGroupActive ) xorMatched[iMatcher.xorGroup!] = true
                        }
                        else { 
                            if ( xorGroupActive ) {
                                xorMatched[iMatcher.xorGroup!] = false
                            }
                        }
                        // Match validation
                        // Check if currently active xorGroup has failed - if so fail and exit the branch
                        if ( validateXor ) {
                            validateXor     = false
                            if ( ! xorGroups[ xorGroups.length -1 ].isMatched() ) {
                                this.failBranch(id, `xor match constraint is violated`, level)
                                failBranch = true
                                break
                            }
                        }
                        // We may have a normal (non-xor) mandatory match that failed - if so fail and exit the branch
                        if ( iMatcher.logic !== 'xor' && !xorGroupActive ) {
                            // match count validation 
                            if ( count <= min  ) {
                                if ( min > 0 && ! validateXor && ! match.foundToken ) {
                                    // fail branch
                                    this.failBranch(id, `To few matches for ${token}.${iMatcher.key} with count: ${count}`, level)
                                    failBranch = true
                                    break
                                }
                            } 
                            else if ( count > max ) {
                                    // fail branch
                                    this.failBranch(id, `To many matches for ${token}.${iMatcher.key} with count: ${count}`, level)
                                    failBranch = true
                                    break
                            }
                        }
                        this.setMatchPos(iMatcher.key + token + '', lastPos )
                    } while ( match.foundToken && count < max && !failBranch && ! this.EOF() )

                    // Final Evaluation of match count
                    if ( roundTrips <= pMin && ! xorGroupActive && ( ( count > max || count < min ) ) ) { 
                        // Fail this branch of matching due to failed cardinality constraint
                        this.failBranch(id, `Failed match count: ${count} for ${token}.${iMatcher.key} at roundtrip: ${roundTrips}`, level)
                        failBranch = true
                    }

                    if ( failBranch ) {
                        if ( this.debug ) console.log(`${this.getIndent(level)}TRY_END: ${token}(${level}).${iMatcher.key}`)
                    }
                    else {
                        if ( parentId ) {
                            this.result.get(parentId)!.matched = true
                        }
                        if (count > this.maxCount ) this.maxCount = count
                    }
                    
                } 
            }
            return !failBranch 
        });

        // Final evaluation of XOR-Group
        if ( ! xorGroupActive && xorGroupWasActive ) {
            xorGroupWasActive = false
            if ( ! xorMatched[ xorMatched.length -1 ] ) {
                 // XOR group failed, so this branch fails
                 this.failBranch(id, `No match found in ${token} XOR group: ${xorMatched.length -1} at roundtrip: ${roundTrips}`, level)
                 failBranch = true
            }
        }

        // After passing all the above checks: 
        // if the rule's mandatory expect tokens 
        // has matched then main object has matched
        if ( ! failBranch ) {
            const matchObj = this.result.get( id )! 
            matchObj.children!.forEach( (_id: string)  =>  {
                const mr = this.result.get( _id)! 
                if ( mr && mr.matched ) {
                    matchObj.matched = true
                }
            })
        }

        this.setMatchPos(token + '_T', goingInPos)

        if  (                            // When to retry the same match pattern
              this.pos > goingInPos &&   // we have progress
              ! failBranch &&            // the branch did not fail
              roundTrips + 1 <= pMax &&  // we are below the allowed maximum number of matches
              ! this.EOF()               // and not at EOF
            ) {
            // Retry the same token for more matches 
            if ( this.debug ) console.log(`${this.getIndent(level)}PARSE RETRY token: ${token}`)
            this.parse( token, id, level, roundTrips + 1 )
        }
      
        if ( firstSymbol && this.pos < this.input.length ) 
            throw Error( `Parse was imcomplete: ${this.pos} < ${this.input.length} (length of input)`)

        if ( this.debug  && token + '' !== this.always ) console.log( ( `${this.getIndent(level)}PARSE_END: ${token}(${level})`)) 
        return failBranch
    }
}