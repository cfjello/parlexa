// @deno-types='https://deno.land/x/xregexp/types/index.d.ts'
import XRegExp from  'https://deno.land/x/xregexp/src/index.js'
import { assert } from "https://deno.land/std/assert/mod.ts"
import { _ } from './lodash.ts'
import * as Colors from "https://deno.land/std/fmt/colors.ts" 
import { Rules } from "./Rules.ts"
import {  
    ParserRules, 
    ParseFuncScope, 
    Sealed, 
    Breaks, 
    MatchRecordExt, 
    ValidationRT, 
    InternMatcher,
    MatchRecord, 
    IIndexable, 
    LexerRules,
    ExpectMap,
    InternMatcherExt
} from './types.ts'
import { iMatcherFac } from './iMatcherFac.ts'
import { parserSharedFac, ParserSharedScope } from './parserSharedFac.ts'
import { getMulti } from './util.ts'
import { Debug } from './Debug.ts'
import { parseFuncInit } from './parseFuncFac.ts'
import { matchRecInit } from './matchRecFac.ts'
import { Validation } from './Validation.ts'
import { HierarKey } from './imports.ts';

// Parser state
export class Parser<L extends string, T extends string, U = unknown> {
    // Debugging
    private _debugger: Debug<T,U> 
    private _debug = false;
    public get debug() { return this._debugger.debug }
    public set debug(value) { 
        this._debug = value
        this._debugger.debug = value
    }
    // Optimistic parsing of xor groups
    private _optimistic = true
    public get optimistic() {
        return this._optimistic
    }
    public set optimistic(value) {
        this._optimistic = value
    }
    // Whitespace non-terminal token
    private _always = 'always';
    public get always() {
      return this.p.always;
    }
    public set always(value) {
      this._always = value;
      this.p.always = value;
    }

    msg
    // Parser Rules and Validation
    rules: Rules<L,T,U>  
    validation: Validation<L,T,U>
    
    debugHook    = 0

    // Parser Global Scope
    p = parserSharedFac(this) satisfies ParserSharedScope<L,T,U>
    
    // Name af remove whitespace token
    alwaysExpect: ExpectMap<T,U> | undefined

    // Max of match count for any token 
    // for use with the hierarkey node size
    maxCount    = 0
    
    // Match positions
    matchPositions = new Map<string, Map<number,number>> ()
    nameResolution = new Map<string, string[]>
    prevMatch =  XRegExp( '__undef__') 

    // breakON positions and tokens
    prevBreakOn = { pos: -1 , token: '__undef__' }

    // Top level tokens
    topNode: string | undefined = undefined
    topToken: T | undefined

    // The Parser Result map
    result      =  new Map<string, MatchRecordExt<T>>()
    reverseIdx  =  [] as string[]

    constructor( 
        public LR: LexerRules<L,U>,  
        public PR: ParserRules<T,U>,  
        public initState: T, 
        public userScope = {} as U, 
        debug = false,
        public multiDefault = '1:1' 
    ) {
        this._debugger = new Debug(debug)
        this.debug = debug
        this.msg = this._debugger.msg
        this.rules = new Rules( LR, PR, this._debugger ) 
        this.validation = new Validation(this._debugger)
           
    }

    // Check functions  
    isTried( matchToken: string, pos: number ): boolean { 
        const refCount = this.matchPositions.get( matchToken )?.get(pos) ?? 0
        return  ( refCount > 0 )
    }
    isEOF() { return ( this.p.pos >= this.p.input.length || this.p.lastPosMatched ) }
    isBoF() { return ( this.p.pos === 0 ) }
    isWS( s: ParseFuncScope<L,T,U> ): boolean {
        const iMatcher = s.matchers ? s.matchers.at(-1) : undefined
        if ( this.p.inclAlwaysInDebug || ! iMatcher ) return false
        return ( iMatcher.key === this.p.always || iMatcher.keyExt?.startsWith(this.p.always + '.') )
    }

    // Parser entry point
    reset( inputStr: string ) {
        try {
            this.p.input        = inputStr
            this.p.line         = 1
            this.p.col          = 1 
            this.p.bol          = 0 
            this.p.pos          = 0
            this.p.firstSymbol  = ''
            this.p.lastPosMatched = false
            // this.p.prevToken    = '__undef__'
            this.result         = new Map<string, MatchRecordExt<T>>()
            this.p.ignoreWS     = false
            this.matchPositions = new Map<string, Map<number,number>> ()
            if ( this.always?.length > 0 && ! this.rules.PRMap.has(this.always as T) ) {
                throw Error(`reset(): The always token '${this.always}' is not defined in the parser rules`)
            }
            this.alwaysExpect = this.rules.PRMap.get(this.always as T) ! satisfies ExpectMap<T,U>
            this._debugger.reset()
            this.parse( this.initState, undefined )
        }
        catch(err) {
            console.error(err)
            throw err
        }   
    }

    // Main Parser function
    parse( 
        token: T, 
        parent:  ParseFuncScope<L,T,U> | undefined = undefined ,
        hasIMatcher = true,
        roundTrips = 1
    ) {
       
        let currNode = '__undef__'
        try {
            assert( this.rules.PRMap.has( token ),`Parse(): Unknown parser token: '${token}'`)
            if  ( this.isEOF() ) return

            // Remember first Token 
            if ( this.p.firstSymbol.length === 0  ) this.p.firstSymbol = token
          
            // Create the ParseFuncScope
            const s = parseFuncInit( token, this.p, parent, hasIMatcher, roundTrips ) satisfies Sealed<ParseFuncScope<L,T,U>, 'eMap' | 'mRec' | 'iMatcher' | 'logic'>
            this.reverseIdx.push(s.iMatcher.id)
            this.result.set(s.iMatcher.id, s.mRec)

            // Setup topToken and topNode
            if ( ! this.topNode ) {
                this.topToken = token
                this.topNode = s.iMatcher.id
            }
            currNode = s.iMatcher.id
            // Initial checks 
            if ( this.isTried( s.mRec.tokenExt, s.args.goingInPos ) ) {     
                // s.iMatcher.status.push('alreadyMatched')
                s.iMatcher.retry = false
                    this.msg({
                        oper: 'SKIP',
                        iMatcher: s.iMatcher,
                        level: s.args.level+1,
                        color: 'gray',
                        text:   `Parse(L${s.args.level}) Skip ${token} at ${s.args.goingInPos} (tried already)`
                    })
                return s.iMatcher  
            }
            else if ( ! this.isEOF()  ) {
                if ( ! this.p.inclAlwaysInDebug && token !== this.p.always ) {
                    this.msg({
                        iMatcher: s.iMatcher,
                        oper: `${ s.args.roundTrips > 1 ? 'RETRY' : 'TRY'}`,
                        level: s.args.level+1,
                        color: 'blue',
                        text:   `${ s.args.roundTrips > 1 ? 'RETRY' : 'TRY'} Non-Terminal: ${token}(L${s.args.level},R${s.args.roundTrips}) at ${s.args.goingInPos}`
                    })
                }
                this.setMatchPos(s.mRec.tokenExt, s.args.goingInPos, s.args.level, 'parse()')
                s.mRec.offsets.push(this.p.pos)
                s.iMatcher.offsets.push(this.p.pos) 

                // Main loop 
                this.parseExpect(token, s);  
                if ( ! s.iMatcher.matched ) {
                    // Reset the match position
                    this.resetMatchPos(s.mRec.tokenExt, s.args.goingInPos, s.args.level)
                }
                else {
                    this.prevMatch = s.iMatcher.regexp!
                    /// s.iMatcher.retry = true
                    /// s.iMatcher.matchCnt += 1
                }
              
                // Call recursively on retry
                if ( s.iMatcher.matchCnt > 0 && 
                    s.iMatcher.retry && 
                    s.args.roundTrips < s.iMatcher.max 
                ) {
                // Update parent state for recursive call
                    s.args.roundTrips += 1
                    // s.iMatcher.roundTrips = s.args.roundTrips  
                    s.args.goingInPos = this.p.pos
                    s.args.parentId = s.iMatcher.id
                    this.parse( token, s, false, s.args.roundTrips )
                }
            }
            // Remove/parse trailing white space at end-of-file
            if ( currNode === this.topNode && roundTrips === 1 && this.p.pos < this.p.input.length ) {   
                this.removeWS( s )
            }
            return s.iMatcher
        }
        catch(err) {
            console.error(err)
            throw err
        }
        finally {
            // In case we did not parse the whole input string:
            // Parser Error message with pointer to the specific 
            // line and position in the input where the parsing failed.
            if ( token === this.topToken && 
                 currNode === this.topNode && 
                 roundTrips === 1 && 
                 this.p.pos < this.p.input.length 
            ) {
                let nlPos = this.p.input.substring(0, this.p.maxPos > 2 ? this.p.maxPos -2 : 0 ).lastIndexOf('\n')
                nlPos = nlPos < 0 ? nlPos = 0 : nlPos + 1
                const fill: string[] = []
                for ( let i = nlPos; i < this.p.maxPos; i++ ) {  fill.push('-') }
                const cursor = fill.join('') + '^'
                console.error( Colors.red(`Parser cannot match at line ${this.p.maxLine} column ${this.p.maxCol}:`))
                console.error( this.p.input.substring(0, this.p.maxPos + 20 ) )
                console.error( Colors.red( cursor )) 
                console.error(`Parse was imcomplete: ${this.p.maxPos} < ${this.p.input.length} (length of input)`)
            }
        }
    }
    //
    // Set functions
    // 
    setMatchPos( matchToken: string, pos: number, level = 0, _caller: string) {
        try {
            assert( ! _.isEmpty(matchToken), `setMatchPos() got an undefined token name from caller: ${_caller}`) 
            /*
            const [key, subKey] = matchToken.split('.')
            assert ( key && key !== "__undef__", `setMatchPos() got an undefined key: '${key}'`)

            if ( ! subKey ) this.nameResolution.set( key, [key] )
            if ( ! this.nameResolution.has(key) ) {
                if ( subKey ) this.nameResolution.set( key, [subKey] )
            }
            else {
                const subArr = this.nameResolution.get( key )!
                if ( subKey && !subArr.includes(subKey) ) this.nameResolution.get(key)?.push(subKey)
            }
            */
            let count = this.matchPositions.get( matchToken)?.get(pos) ?? 0
            if ( ! this.matchPositions.has(matchToken) ) {
                this.matchPositions.set( matchToken, new Map<number,number>() )
            }    
            this.matchPositions.get( matchToken)!.set(pos, ++count)

            // this.msg( {
            //     level: level+2,
            //     color: 'gray',
            //     text: `Set Match Position: ${pos} for "${matchToken}"`
            // })
        }
        catch (err) {   
            console.error(err)
            throw err
        }
    }

    //
    // Checks
    //
    chkBreakOn( breaks : Breaks<T> ): boolean {
        let   breakMatched = false
        try {
            if ( breaks.breakOnPPGT.length > 0  ) {
                for ( const exp of breaks.breakOnPPGT ) {
                    // LookBack
                    if ( this.prevMatch.toString() === exp.toString() ){
                        this.msg({
                            oper: 'BreakOn',
                            iMatcher: undefined,
                            level: breaks.level+1,
                            color: 'gray',
                            text:   `BreakOn on prevMatch for '${breaks.token}'` + ': ' + exp.toString()
                        })
                        breakMatched = true
                        break
                    }
                    else {
                        // lookAhead
                        const res: XRegExp.ExecArray | null = XRegExp.exec(this.p.input, exp, breaks.lastPos, 'sticky' )
                        if ( res !== null ) {
                            this.msg({
                                oper: 'BreakOn',
                                iMatcher: undefined,
                                level: breaks.level+1,
                                color: 'gray',
                                text:   `BreakOn on lookAhead for '${breaks.token}'` + ': ' + exp.toString()
                            })
                            breakMatched = true
                            break
                        }
                    }
                }
                if ( breakMatched ) {
                    this.prevBreakOn = { pos: breaks.lastPos, token: breaks.token + '' }
                }
                else {
                    this.prevBreakOn = { pos: -1, token: '__undef__' }
                }
            }
        }
        catch (err) { 
            console.error(err)
            throw err 
        }       
        return breakMatched
    }

    
    chkStartOn( starts: Breaks<T> ): boolean {
         const res = { active: false, ok: false, match: '' }
         try {
            if ( (starts.startOn ?? []).length > 0 ) {
                for( const exp of starts.startOn! ) {
                    res.active = true
                    if ( this.prevMatch.toString() === exp.toString() ) {
                        res.match = exp.toString()
                        res.ok = true
                        this.msg({
                            oper: 'StartOn',
                            iMatcher: undefined,
                            level: starts.level+1,
                            color: 'gray',
                            text:  `StartOn look-behind matched for '${starts.token}'` + ': ' + exp.toString()
                        })
                        break
                    }
                }
            }
            else {
                return true // No startOn conditions
            }
        }
        catch (err) { 
            console.error(err)
            throw err 
        }       
         return res.active && res.ok
    }

    tryNextExpectToken = (s: ParseFuncScope<L,T,U>): ValidationRT => {
        let tryNext: ValidationRT = { ok: true, msg: '' }
        try {
            const iMatcher = s.matchers[s.matchers.length-1]
            const [min, max] = getMulti( iMatcher.multi )

            if ( s.iMatcher.roundtripFailed ) {
                // The last roundTrip failed, but the match may still be ok
                tryNext = { ok: false, msg: 'The last roundtrip/retry failed' }
            }
            else if ( s.iMatcher.branchFailed() && min > 0 ) {
                tryNext = { ok: false, msg: 'Branch Failed' }
                // iMatcher.failed = iMatcher.roundTrips == 1 ? true :false
            }
            else if ( iMatcher.matchCnt > max ) {
                tryNext = { ok: false, msg: 'Max allowed matches exceded' }
                // iMatcher.failed = true 
            }
            else {
                if ( iMatcher.logicLast ) {
                    tryNext = this.validation.validLogicGroup(s)
                    // iMatcher.failed = iMatcher.roundTrips == 1 ? ! tryNext.ok : false
                    // iMatcher.failed = ! tryNext.ok
                }
                else if ( iMatcher.logic  === 'none' ) {
                    if ( iMatcher.matchCnt < min ) {
                        tryNext = { ok: false, msg: 'Min allowed matches not reached' }
                        // if ( iMatcher.roundTrips == 1 ) iMatcher.failed = true
                    }
                }
            }
        }
        catch (err) {
            console.error(err)
            throw err
        }   
        return tryNext
    }

    //
    // Error handling and backtracking
    //
    resetMatchPos( matchToken: string, offset: number, _level: number): void {
        try {
            assert( matchToken && ! _.isEmpty(matchToken) , `failAlreadyMatched() got an undefined token name: '${matchToken}'`)
            if ( this.matchPositions.get(matchToken)?.has(offset) ) {
                const _ret = this.matchPositions.get(matchToken)!.delete(offset)
                // if ( _ret ) this.msg( {
                //     level: _level,
                //     color: 'gray',
                //     text: `Delete Match Position: ${offset} for "${matchToken}" -> ${_ret}`
                // })
            }
        }
        catch (err) { 
            console.error(err)
            throw err 
        }
    }

    resetFailedResultRec( matchRec: MatchRecord<T>, errMsg = '', level: number): void {
        // Modify the match record of the result entry
        try {
            assert( matchRec !== undefined && matchRec.tokenExt !== undefined,  `failBranch() got an undefined result entry or tokenExt for ${JSON.stringify(matchRec ?? {}, undefined, 2)}`)
            let i = 0
            const offsets = _.uniq(matchRec.offsets) 
            let offset = offsets.at(--i) ?? -1
            while( offset >= 0 ) {
                this.resetMatchPos(matchRec.tokenExt, offset, level)
                matchRec.matched = false
                matchRec.matchCnt = 0
                matchRec.matchErr = `BackTrack due to: ${errMsg}`
                offset = offsets.at(--i) ?? -1
            }
        }
        catch (err) { 
            console.error(err)
            throw err 
        }
    }

    resetFailedIMatcher( 
        iMatcher: InternMatcherExt<T,U>,
        matchRec:  MatchRecord<T> | undefined,  
        errMsg = '', 
        level: number, 
        _caller = '__unknown__') {

        try {
            const id = matchRec ? matchRec.id! : iMatcher.id!
            assert( iMatcher.offsets.length > 0, `resetFailedBranch() got an empty offsets array`)

            this.msg({
                oper: 'NoMatch',
                iMatcher: iMatcher,
                level: level+1,
                color: 'gray',
                text: `NO MATCH for ${iMatcher.keyExt}(L${level},R${iMatcher.roundTrips}) - adjust pos ${this.p.pos} to ${iMatcher.offsets.at(0)} - (caller: ${_caller})`
            })  
            // Reset the match position
            let idx =  -1
            let ident: string | undefined = ''
            if (iMatcher.keyExt === 'funcArgs.objectDecl') {
                this.debugHook = 1
            }
            while( ( ident = this.reverseIdx.at(idx) ) && ident >= id ) {
                const matchRec = this.result.get(ident)! satisfies MatchRecord<T>
                this.resetFailedResultRec( matchRec, errMsg, level+2  )  
                --idx
            } 
            /*
            this.msg({
                level: level+1,
                color: 'gray',
                text: `Resetting to pos: ${this.p.pos} for ${iMatcher.keyExt} at ${iMatcher.offsets[0]}`
            })  
            */
            // Remove any additional directly preceding white space
            while ( ( ident = this.reverseIdx.at(idx) )  && ( this.result.get(ident)?.ws ?? false ) ) {
                const matchRec = this.result.get(ident)! satisfies MatchRecord<T>
                this.resetFailedResultRec( matchRec, errMsg, level+2  )
                --idx
            }
            this.p.pos = iMatcher.offsets.at(0)!
        }
        catch(err) {
            console.error(err)
            throw err
        }
    }

    resetFailedBranch( 
        s: ParseFuncScope<L,T,U>,
        errMsg = '', 
        level: number, 
        _caller = '__unknown__') {

        try {
            if ( this.isEOF() ) return // || this.p.pos === offsets.at(-1) 
            const iMatcher = s.iMatcher
            assert( s.mRec !== undefined,  `resetFailedBranch() got an undefined result entry`)
            assert(s.mRec.tokenExt ,  `resetFailedBranch() got undefined tokenExt for  'id': ${JSON.stringify(s.mRec)}`)

            this.resetFailedIMatcher( s.iMatcher, s.mRec, errMsg, level, _caller)
            iMatcher.setStatus('branchFailed', errMsg)
        }
        catch( err ) {
            console.error(err)
            throw err
        }
    }

    // Recursive call to parse with non-terminal this.always symbol
    removeWS( s: ParseFuncScope<L,T,U> ): void {
        try {
            const iMatcherCurr = s.matchers.at(-1)!

            // iMatcherCurr.offsets.push(this.p.pos)
            // Call the parser with the always token
            const hasIMatcher = false
            this.parse( this.always as T, s, hasIMatcher, 1 )

            s.args.goingInPos = this.p.pos
            iMatcherCurr.offsets.push(this.p.pos)
            }
        catch (err) { 
            console.error(err)
            throw err 
        }
    }

    // Procedure to match a regexp
    doMatch( s: ParseFuncScope<L,T,U>, matchRec: MatchRecord<T> ):  ValidationRT  {
        let ret = { ok: false, msg: 'No Match' }
        try {
            // Initialize
            const iMatcher = s.matchers.at(-1)!
            // matchRec.offsets.push(this.p.pos)
            const level = s.mRec.level

            // Run the iMatcher RegExp 
            const offset = iMatcher.offsets.at(-1)!
            const res: XRegExp.ExecArray | null = XRegExp.exec(this.p.input, iMatcher.regexp!, offset, 'sticky' )
            this.setMatchPos( iMatcher.keyExt, offset, level ,'doMatch()' )
            //
            // Handle the match, that is any non-null result
            // 
            if ( res !== null ) {
                this.msg({
                    oper: 'MATCHED',    
                    iMatcher: iMatcher,
                    level: s.args.level+2,
                    color: 'bgGreen',
                    text: `MATCHED: ${iMatcher.key} at pos: ${this.p.pos} to ${iMatcher.regexp!.lastIndex}, matched: "${this.p.input.substring(this.p.pos,iMatcher.regexp!.lastIndex)}"`
                    })  

                // Update regex math-position
                this.p.pos = iMatcher.regexp!.lastIndex
                // Check if we have matched the last position in the input
                if ( this.p.pos === this.p.input.length - 1 && iMatcher.matched ) { this.p.lastPosMatched = true }
                this.p.col = this.p.pos - this.p.bol + 1
                iMatcher.offsets.push(this.p.pos)

                // Line numbering
                if ( iMatcher.key === this.p.newLine ) {
                    this.p.line++
                    this.p.col = 1
                    this.p.bol = iMatcher.regexp!.lastIndex 
                    this.p.BoL = true
                }
                else if ( ! (iMatcher.ignore ?? false ) ) {
                    this.p.BoL = false
                }

                // Update the match record
                matchRec!.matched = iMatcher.matched = true
                matchRec!.value = res[2]
                matchRec!.text  = res[0] 
                matchRec!.type       = 'terminal' 
                matchRec!.matchCnt   = ++iMatcher.matchCnt     
                matchRec!.parentId   = iMatcher.parentId ?? '__undef__'
            
                // Add any additional named XregExp match groups to the match record
                if ( ! _.isUndefined(res.groups ) ) {
                    for ( const k in res.groups  ) {
                        // deno-lint-ignore no-explicit-any
                        (matchRec as IIndexable<any>)[k] = res.groups[k]
                    }
                }
                // if exists, run the Lexer and parser callback function 
                if ( iMatcher.cbLex !== undefined ) iMatcher.cbLex(matchRec as MatchRecordExt<T>, this.userScope as U)
                if ( iMatcher.cb !== undefined ) iMatcher.cb(matchRec as MatchRecordExt<T>, this.userScope as U)
                if ( ! iMatcher.ignore ) this.prevMatch = iMatcher.regexp!
                ret = { ok: true, msg: '' }
            }
            else {
                if ( iMatcher.min > 0 && ! iMatcher.logicApplies ) ret = { ok: false,  msg: 'Failed mandatory match'}
            }
            return ret
        } catch(err) { 
            console.error(err)
            throw err           
        }
    }

    matchTerminal(  s: Sealed<ParseFuncScope<L,T,U>, 'eMap' | 'mRec' | 'args'> ): void {
        try {
            // TERMINAL SYMBOLS
            // RHS INNER LOOP for regexp matching
            const iMatcher = s.matchers.at(-1)!
            const matchRec: MatchRecord<T> = matchRecInit(s, this.p, iMatcher)
            // Special handling for mem of white space tokens
            if ( iMatcher.key === this.always || ( iMatcher.keyExt?.startsWith(this.always + '.') ?? false ) )  {
                matchRec.ws = true
            }
            if ( ! matchRec.ws && iMatcher.parentId ) {
                matchRec.ws = this.result.get(iMatcher.parentId)!.ws
            }

            this.reverseIdx.push(matchRec.id)
            this.result.set(matchRec.id, matchRec)

            if ( ! this.isWS(s) ) {
                const inpSubstr = this.p.input.substring( this.p.pos, this.p.pos + 30 )
                this.msg({
                    oper: 'TRY',
                    iMatcher: iMatcher,
                    level: s.args.level+1,
                    color: 'cyan',
                    text: `TRY: ${iMatcher.keyExt}(L${s.args.level},R${s.args.roundTrips}) at ${this.p.pos} against: "${inpSubstr}"`
                })
            }
            if ( iMatcher.key === 'tilde' ) {
                this.debugHook = 1
            }

            // Main Match loop for terminal symbols
            let matchCnt = 0
            do {
                if ( ! this.isWS(s) ) {
                    // Remove leading white space
                    if ( s.eMap.rootKey !== this.always) {
                        const wsPos = this.p.pos
                        this.removeWS(s)
                        if ( this.p.pos > wsPos ) {
                            if ( this.isEOF() ) {
                                this.msg({
                                    oper: 'EOF',
                                    iMatcher: iMatcher,
                                    level: s.args.level+1,
                                    color: 'cyan',
                                    text: `Removed WS and reached EOF: ${this.p.pos}`
                                })
                                this.p.lastPosMatched = true
                                break
                            }
                        }
                    }
                    if ( matchCnt > 0 && matchCnt <= iMatcher.max ) {    
                        this.msg({     
                            oper: 'RETRY',
                            iMatcher: iMatcher,
                            level: s.args.level+2,       
                            color: 'cyan',  
                            text: `RETRY Terminal: ${iMatcher.keyExt}(L${s.args.level},R${s.args.roundTrips}) at ${this.p.pos} against: "${this.p.input.substring(this.p.pos,this.p.pos + 30).replace(/\n.*/mg, '')}"`     
                        })
                    }
                }
             

                iMatcher.tries += 1 
                if ( s.eMap.rootKey !== this.always && matchCnt > 0 ) {
                    if ( this.chkBreakOn( {
                        level: s.args.level,
                        roundTrips: s.args.roundTrips,
                        idx: s.iMatcher.idx,   
                        lastPos: this.p.pos,
                        token: iMatcher.key as T,
                        breakOnPPGT: iMatcher.breaks ?? [],
                        startOn: iMatcher.starts ?? []
                    }) ) {
                        break
                    }
                }
 
                //  Do the actual match, taking the cardinality into account
                if ( ! this.isTried(iMatcher.keyExt!, this.p.pos ) ) {
                    // Main match function
                    const ret = this.doMatch( s, matchRec )                 
                    // Remember/Add the match to the result record
                    if ( ret.ok && matchRec.matched ) {
                        //Match
                        matchCnt++
                        if ( ! matchRec.ignore ) s.mRec.children.push(matchRec.id!)
                        // Logic
                        if ( iMatcher.logicApplies ) s.logic.setIMatch(iMatcher, matchRec.matched)
                        const logicChk = this.validation.validLogicGroup(s)
                        if ( ! logicChk.ok ) s.iMatcher.setStatus('branchFailed', logicChk.msg ?? `Logic group failed for ${iMatcher.keyExt}`)

                        // if the matched object RegExp name has a corresponding 
                        // LHS Parser entry with an expect group
                        // If new match group(s), then call parse() recursively
                        if ( this.validation.matched(s, this.p.pos) && this.rules.PRMap.has(iMatcher.key as T) ) {
                            // If the matched Lexer object has a parser LHS non-terminal entry of its own of the same name, then call it
                            this.msg({
                                oper: 'CallOwnMatcher',
                                iMatcher: iMatcher,
                                level: s.args.level+2,
                                color: 'cyan',
                                text: `Terminal symbol has own non-terminal matcher, so call: ${iMatcher.key}`
                            })
                            const hasIMatcher = false
                            this.parse( iMatcher.key as T , s, hasIMatcher, 1 )
                        }
                    }
                    else {
                        if ( iMatcher.logicApplies ) s.logic.setIMatch(iMatcher, matchRec.matched)
                        if ( ! this.isWS(s) )
                            this.msg({
                                oper: 'NO MATCH',
                                iMatcher: iMatcher,
                                level: s.args.level+2,
                                color: 'red',
                                text: `Match failed for: ${iMatcher.keyExt}`
                            })
                    }
                }        
            }
            while (  
                matchRec.matched            && 
                this.p.pos > iMatcher.offsets.at(-1)! && 
                matchCnt < iMatcher.max     && 
                ! iMatcher.branchFailed()   && 
                ! this.isEOF() 
            ) // End of do-while loop
           

            if ( ! this.isWS(s) ) {
                this.msg({
                    oper: 'TRY END',
                    iMatcher: iMatcher,
                    level: s.args.level+1,
                    color: 'cyan',
                    text: `TRY END: ${iMatcher.key}(L${s.args.level},R${s.args.roundTrips}), matchCnt: ${matchRec.matchCnt}`
                })
            }
            // Check if the match count is within the cardinality constraints
            if ( ! this.p.lastPosMatched && ! this.validation.matchInRange( iMatcher ).ok ) {
                this.resetFailedIMatcher(iMatcher, matchRec, s.iMatcher.errors.at(-1), s.args.level, 'matchTerminal()')
            }
            else {
                // Take note of the overall max match for use with the hierarkey node size
                if (matchCnt > this.maxCount ) this.maxCount = matchCnt
            }
        }
        catch(err) {
            console.error(err)
            throw err
        }
    }

    parseExpect( token: T, s: ParseFuncScope<L,T,U> ): void {
        try {
            //
            // Iterate over the expect array
            //
            let tryNext = { ok: false, msg: '' }
            let firstLogicGroup = true
            
            const expectLen = s.eMap.expect.length - 1
            let lastEntry = false 

            // Simple local tracking for optimistic matching of XOR groups
            const xorGroup: boolean[] = []
            // let xorIndex = -1

            s.eMap.expect.every( ( _iMatcher: InternMatcher<T,U>, idx: number ) => { 
                lastEntry = ( idx === expectLen ) 
                if ( this.isEOF() ) return false
                
                const iMatcherRaw = _.cloneDeep(_iMatcher) satisfies InternMatcher<T,U>
                assert( iMatcherRaw !== undefined, `eMap.expect.every(): Undefined iMatcher in 'expect array'`)
                assert((iMatcherRaw.key !== s.args.token || idx > 0), Colors.red(`Left recursive reference: ${iMatcherRaw.key} to own parent token position 0` ))

                /*
                this.msg({
                    level: s.args.level+1,
                    color: 'green',
                    text: `expect loop with: ${iMatcherRaw.key}(L${s.args.level},R${s.args.roundTrips})`
                }) 
                */
               
                const iMatcher = iMatcherFac('parseExpect', s, idx, this.p, token, iMatcherRaw) satisfies InternMatcherExt<T,U>

                s.matchers.push(iMatcher)

                // Check for startOn on idx 0 and subsequent idx > 0 that belong to the same initial logic group
                firstLogicGroup = firstLogicGroup  || ( idx === 0 && iMatcher.logicApplies ) 

                 // Handle XOR groups
                 if ( iMatcherRaw.logic === 'xor' ) {
                    // Initialize the XOR group
                    if ( iMatcherRaw.logicIdx === 0 ) {
                        xorGroup[ iMatcherRaw.logicGroup ] = false
                    }
                    else if ( xorGroup[ iMatcherRaw.logicGroup  ] && this.optimistic ) {
                        // Optimistic XOR Group matching
                        // Skip this iMatcher if the XOR group has already been matched
                        // 
                        // If skipping the actual last entry of the expect array
                        // 'lastEntry' must be set to false to facilitate 
                        // optimistic checking of the next XOR group
                        lastEntry = lastEntry ? false : true
                        s.logic.setIMatch(iMatcher, false)
                        this.msg({
                            oper: 'SKIP',
                            iMatcher: iMatcherRaw,
                            level: s.args.level+1,
                            color: 'gray',
                            text: `Skip matching due to already matched XOR group: ${iMatcher.keyExt}(L${s.args.level},R${s.args.roundTrips})`
                        }) 
                        return true
                    }
                }

                if ( idx === 0 || firstLogicGroup ) {
                    if ( ! this.chkStartOn( {
                        level: s.args.level,
                        roundTrips: s.args.roundTrips,
                        idx: idx,
                        lastPos: this.p.pos,
                        token: iMatcher.key as T,
                        breakOnPPGT: iMatcher.breaks ?? [],
                        startOn : iMatcher.starts ?? []
                    }) ) {
                        this.msg({
                            oper: 'SKIP',
                            iMatcher: iMatcher,
                            level: s.args.level+1,
                            color: 'gray',
                            text: `SKIP Due to missed StartOn condition for ${iMatcher.keyExt}(L${s.args.level},R${s.args.roundTrips})`
                        }) 
                        if ( idx === 0 && ! iMatcher.logicApplies )  return false
                        if ( firstLogicGroup && iMatcher.logicLast ) return false
                    }
                }
                //
                // Handle TERMINAL SYMBOLS
                //
                if ( iMatcher.regexp ) {
                    if ( this.chkBreakOn( {
                        level: s.args.level,
                        roundTrips: s.args.roundTrips,
                        idx: s.iMatcher.idx,   
                        lastPos: this.p.pos,
                        token: iMatcher.key as T,
                        breakOnPPGT: iMatcher.breaks ?? [],
                        startOn : iMatcher.starts ?? []
                        }) 
                    ) {
                        this.msg({
                            oper: 'SKIP',
                            iMatcher: iMatcher,
                            level: s.args.level+1,
                            color: 'gray',
                            text: `SKIP Due to BreakOn condition for ${iMatcher.keyExt}(L${s.args.level},R${s.args.roundTrips})`
                        }) 
                        return false   
                    }

                    this.matchTerminal( s )
             
                    if (    iMatcher.logic === 'xor' && 
                            iMatcher.matched && 
                            iMatcher.matchCnt >= iMatcher.min && 
                            iMatcher.matchCnt <= iMatcher.max 
                    ) {
                        xorGroup[ iMatcher.logicGroup ] = true
                    }
                }
                else  {
                    // Handle NON-TERMINAL SYMBOLS
                    this.parse( iMatcher.key as T, s, true, 1)

                    if ( iMatcher.logicApplies ?? false ) s.logic.setIMatch(iMatcher, iMatcher.matched ?? false)
                    if (    iMatcher.logic === 'xor' && 
                            iMatcher.matched && 
                            iMatcher.matchCnt >= iMatcher.min && 
                            iMatcher.matchCnt <= iMatcher.max 
                    ) {
                        xorGroup[ iMatcher.logicGroup ] = true
                    }
                }
                // To continue the loop, we need to have a match (if mandatory) and not have failed mandatory branch 
                
                tryNext   = this.tryNextExpectToken(s)

                if ( s.args.token !== this.always ) {      
                    this.msg({
                        oper: 'TRY NEXT',
                        iMatcher: iMatcher,
                        level: s.args.level+1,
                        color: 'gray',
                        text: `TRY NEXT after ${iMatcher.keyExt}(L${s.args.level},R${s.args.roundTrips}): ${tryNext.ok}`
                    })  
                }
                return tryNext.ok
            }); // End of expect.every()

            // Validate all XOR iMachers in the expect array or be optimistic and match until first success
            const optimistic = (this.optimistic && this.isEOF()) || ( this.optimistic && ! lastEntry )
            
            // The whole loop has been completed successfully or validates according to the parser rules
            // If tryNext.ok is false and we are missing a mandatory match
            // if we have tried last iMatcher and the children are incompeletely macthed 
            // ( failure or success of sub-branches must have been propogated up through the call structure )

            // if branch is incomplete or failed, then reset the failed branch

            if  ( s.iMatcher.keyExt === 'rhsAssign.arrAssign' ) {
                this.debugHook = 1
            }
           
            const validBranch = this.validation.validExpect( s, optimistic )

            if ( validBranch ) {
                // We have validated the expect array and we are ok
                // Any failed terminals or sub-branch non-terminals within the expect array 
                // are not mandatory at this point, so they can be ignored
                s.iMatcher.setStatus('branchMatched', 'success')   
                s.iMatcher.matched = s.mRec.matched = true
                s.iMatcher.matchCnt += 1 
                s.mRec.matchCnt = s.iMatcher.matchCnt
                // This branch may have been triad multiple times, 
                // so next retry depends on the number of roundtrips
                s.iMatcher.retry = s.iMatcher.roundTrips < s.iMatcher.max 
                if ( s.args.token !== this.always && s.iMatcher.matchCnt > 0 ) {
                    this.msg({ 
                        oper: 'BRANCH MATCHED',
                        iMatcher: s.iMatcher,
                        level: s.args.level+1,
                        color: 'green',
                        // text: `BRANCH MATCHED for ${s.args.token} (L${s.args.level},R${s.args.roundTrips})`
                        text: `BRANCH MATCHED for ${s.iMatcher.keyExt} (L${s.args.level},R${s.args.roundTrips})`
                    }) 
                }
            }
            else {
                if ( ! this.isEOF() ) { 
                    if ( s.args.token !== this.always ) { 
                        this.msg({
                            oper: 'BRANCH FAIL',
                            iMatcher: s.iMatcher,
                            level: s.args.level+1,
                            color: 'yellow',
                            text: `BRANCH FAIL for ${s.iMatcher.keyExt} (L${s.args.level},R${s.args.roundTrips})`
                        })
                    }
                    s.iMatcher.retry = false
                    this.resetFailedBranch(s, s.iMatcher.errors.at(-1), s.args.level, 'parseExpect()')
                }
                if ( s.iMatcher.roundTrips === s.iMatcher.min ) s.iMatcher.status = [ 'branchFailed' ]
            }
        }
        catch (err) {
            console.error(err)
            throw err
        }
    }

    // ParseTree formatter
    compare( a: MatchRecordExt<T>, b: MatchRecordExt<T> ) {
        if ( a.id < b.id ){
          return -1;
        }
        if ( a.id > b.id ){
          return 1;
        }
        return 0;
      }

    getFullParseTree() { 
        return this.getParseTree(false, true)
    }

    getParseTree( excludeAlways = false, fullTree = false ): MatchRecordExt<T>[] {
        const res: MatchRecordExt<T>[] = []
        const unMatched = new Map<string, boolean>()
        try {
            if ( this.topNode ) {
                const maxDigits = this.maxCount.toString().length + 1
                const hk = new HierarKey(1, maxDigits)  
                let prevLevel = 0 
                const tree = _.sortBy(_.toArray(this.result), ['id'])
                for ( const [_id, e] of tree ) {
                    // let newLevel = Math.abs( e.level - prevLevel )
                    if ( e.token === this.always && excludeAlways && ! fullTree ) e.ignore = true
                    if ( ! fullTree && ( e.matched  && ! e.ignore ) ) {
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
            // return _.sortBy(res, ['id'])
            return res
        }
        catch (err) {   
            console.error(err)
            throw err
        }
    }

    getTreeIterator() {
        try {
            const tree = this.getParseTree()
            return tree[Symbol.iterator]()
        }
        catch (err) {   
            console.error(err)
            throw err
        }
    }

    getIterator() { return this.getTreeIterator }

    getUserScope(): U { return this.userScope }

}