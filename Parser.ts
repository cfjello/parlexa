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
    maxCount        = 0

    public get debug() {
        return this._debug;
    }
    public set debug(value: boolean) {
        this._debug = value;
    }

    // Match positions
    line    = 1
    col     = 1 
    bol     = 0 
    pos     = 0
    matchPositions = new Map()
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
            // console.log (`Mapping key: ${key} with type: ${typeof key}`)
            pr.expect.forEach( ( e: ExpectEntry<T>) => {
                if ( Array.isArray( e ) ) {
                    expect.push( this.resolveExpectArray(e, multiDefault) ) 
                }

                if ( typeof e === 'string') {
                    expect.push( this.resolveString(e as string) )
                }
                else if ( Array.isArray(e)) {
                    expect.push( this.resolveExpectArray( e, '0:m', key) )
                }
                else {
                    const regKey = ( 'match' in e ) ? this.LRReverseMap.get(e as Matcher)! : this.LRReverseMap.get(e as RegExp)!
                    assert ( regKey !== undefined, `PR_02 , LRReverseMap key is missing for key: ${key} as ${typeof e} --> ${JSON.stringify(e)}`)
                    expect.push( ( 'match' in e ) ? this.resolveMatcher(regKey, e as Matcher ) : this.resolveRegExp(regKey, e as RegExp ) )
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
            xorGroup:   -1,
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
            logic:  'NOP',
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
        // Figure out the type of the entries within the array
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
    getParseTree() {
        const res: MatchRecord[] = []
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
            }
        }
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
        this.parse(this.initState)
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

    doMatch( iMatcher: InternMatcher, parentId: string ): Matched {
        const ret: Matched = { foundToken: false, id: undefined, ignore: false } 
        if ( this.EOF() || this.pos === this.matchPositions.get(iMatcher.key) ) {
            return ret
        }
        if ( this.debug ) console.log(`TRYING: ${iMatcher.key} at ${this.pos} against: "${this.input.substring(this.pos,this.pos + 30)}"`)
        /*
        if (  iMatcher.key === 'KEY' || iMatcher.key === 'BAR' ) {
            const debugHook = 0
        }
        */
        const res: XRegExp.ExecArray | null = XRegExp.exec(this.input, iMatcher.regexp!, this.pos, 'sticky' )

        this.matchPositions.set(iMatcher.key, this.pos )
        if ( res !== null ) {
            if ( this.debug ) console.log(`MATCHING: ${iMatcher.key}`)
            // Handle position and line numbering
            this.col = this.pos - this.bol + 1
            if ( iMatcher.key === 'NL' ) {
                this.line++
                this.col = 1
                this.bol = iMatcher.regexp!.lastIndex 
            }
            const lastPos = this.pos
           
            this.pos = iMatcher.regexp!.lastIndex

            if ( this.debug ) console.log(`NEW POS: ${this.pos}`)
            
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

            // check for and call callback 
            const outObjFinal =  iMatcher.cb !== undefined ? iMatcher.cb(outObj): outObj

            // Store the result 
            if ( ! iMatcher.ignore ) {
                this.result.set( id, outObjFinal)
                if (  this.result.get(iMatcher.parent ?? '-1.-1') ) this.result.get(iMatcher.parent!)!.matched = true
            }
            else {
                ret.ignore = true
            }

            // Check if the matched object has a LHS Parser entry and an expect group
            // If new match group(s), then call parse() recursively
            if ( this.PRMap.get(iMatcher.key) !== undefined ) // The matched Lexer object has a parser entry of its own
                this.parse(iMatcher.key as unknown as  T, id)
        }
        return ret
    }

    EOF() {
        return ( this.pos >= this.input.length )
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

    failBranch( id: string, errMsg = '') {
        const entry    = this.result.get(id)!
        entry.matched  = false
        entry.matchErr = errMsg
        entry.children ?? ([] as string[]).forEach( child => {
            this.failBranch(child)
        });
        // Adjust the overall match position
        if ( this.debug ) console.log(`POS (failBranch: ${entry.value}) ${this.pos} = ${entry.offset}  --> ${errMsg}`)
        this.pos = entry.offset
    }

    // Main Parser function
    parse ( token: T, parentId: string | undefined = undefined) {
        assert( this.PRMap.has( token as unknown as string ), `Unknown parser token: ${token}`)        
        const eMap: ExpectMap = this.PRMap.get(token as unknown as string)!
        const [pMin, pMax] = this.getMulti( eMap.multi ?? '0:m' )
        let roundTrips = 0 
        let finalCount = 0
        let id: string 
        let xorGroup = -1
        let failBranch = false
       
        do {
            // Remenber the cardinality of the whole match group
            // Remember any grouping of matched that has an 'xor' 
           
            let xorGroupActive = false
            const xorGroups: XorGroup[] = []
            let validateXor = false
            let prevMatched = true

            // Handle the hierarchy numbering     
            id = ulid()
            if ( this.topNode === undefined ) {
                this.topToken = token
                this.topNode = id
            }
            // this.level = token === this.topToken! ? 0 : this.level + 1
 
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

            // Do the matches 
            eMap.expect.forEach( ( iMatcher: InternMatcher, i: number ) => {  
                // Do a recursive call or a match if the match entry is a user defined token 
                // if ( this.debug ) console.log(`iMatcher: ${JSON.stringify(iMatcher)}`)
                if ( iMatcher.regexp === undefined ) {  
                        this.parse( iMatcher.key as unknown as T, id )
                }
                else {
                    // Handling internal xor groups
                    if ( iMatcher.logic === 'xor' && ! xorGroupActive ) {
                        iMatcher.xorGroup = ++xorGroup
                        xorGroups.push( new XorGroup(i, i) )
                        xorGroupActive = true
                    } 
                    else if ( iMatcher.logic !== 'xor' && xorGroupActive ) {
                        iMatcher.xorGroup = xorGroup
                        xorGroups[ xorGroups.length -1 ].end = i
                        xorGroupActive = false
                    }          
                    let match: Matched
                    const [min, max] = this.getMulti( iMatcher.multi )
                    let count = 0 
                    const always = 'always' as unknown as T 
                    do {
                        // Handling White space/ newline entries
                        if ( prevMatched && token !== always ) {
                            this.parse( always, id )
                        }
                        
                        //  Do the actual match, taking the cardinality into account
                        iMatcher.parent = id
                        match = this.doMatch(iMatcher, id)  
                        if ( match.foundToken ) {
                            prevMatched = match.foundToken
                            assert( match.id !== undefined , `Match id is not set in: ${JSON.stringify(match)}`) 
                            if ( ! match.ignore ) this.result.get( id )!.children.push( match.id! )
                            count++
                           
                            }
                        // Check if currently active xorGroup has failed - if so fail and exit the branch
                        if ( validateXor && ! xorGroups[ xorGroups.length -1 ].isMatched() ) {
                            this.failBranch(id, `xor match constraint is violated`)
                            failBranch = true
                            break
                        }
                        else {
                            validateXor = false
                        }
                    } while ( match.foundToken && count < max && ! this.EOF() )

                    if ( failBranch ) return

                    // Evaluation of match count
                    if ( iMatcher.xorGroup! < 0 && ( ( count > max || count < min ) ) ) { 
                        // Fail this branch of matching due to failed cardinality constraint
                        const parent = this.result.get( id )! 
                        parent.matched  = false
                        parent.matchErr = `Number of matches out of ${iMatcher.multi} range for ${iMatcher.key}`    
                        return
                    }
                    else {
                        if (count > this.maxCount ) this.maxCount = count
                        finalCount += count
                    }
                    prevMatched = count > 0 ? true : false
                }   
            });

            // Final evaluation of match count
            if ( pMin > 0 || pMax  < Number.MAX_SAFE_INTEGER ) {
                if ( finalCount < pMin || finalCount > pMax) {
                    // Fail this branch due to failed cardinality constraint
                    this.failBranch(id, `Number of matches:${finalCount} for ${token} is out of range: '${pMin}:${pMax}`) 
                    return
                }  
            }
           
            // After passing the above checks: if one of the rule's RHS tokens 
            // has matched then main object has matched
            if ( ! failBranch ) {
                const matchObj = this.result.get( id )! 
                matchObj.children!.forEach( (_id: string)  =>  {
                    const mr = this.result.get( _id)! 
                    if ( mr.matched ) {
                        matchObj.matched = true
                        return
                    }
                })
            }
        }
        while( 
            this.result.get( id )!.matched && 
            ! failBranch && 
            // ++roundTrips >= pMin &&
            ++roundTrips <= pMax && 
            ! this.EOF() 
        )
    }
}