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
    InternMatcherExt,
    retValuesT
} from './types.ts'
import { iMatcherFac } from './iMatcherFac.ts'
import { parserSharedFac, ParserSharedScope } from './parserSharedFac.ts'
import { getMulti } from './util.ts'
import { Debug } from './Debug.ts'
import { parseFuncInit } from './parseFuncFac.ts'
import { matchRecInit } from './matchRecFac.ts'
import { Validation } from './Validation.ts'
import { HierarKey } from './imports.ts';
import { ParseFuncReturns } from './types.ts';
import { callerIM } from './types.ts';

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


    // Parser Shared Scope
    shared = parserSharedFac(this) satisfies ParserSharedScope<L,T,U>

    // Whitespace non-terminal token
    private _always = 'always'
    public get always() {
      return this.shared.always;
    }
    public set always(value) {
      this._always = value;
      this.shared.always = value;
    }

    msg
    // Parser Rules and Validation
    rules: Rules<L,T,U>  
    validation: Validation<L,T,U>
    
    debugHook    = 0

  

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
    isEOF() { return ( this.shared.pos >= this.shared.input.length || this.shared.lastPosMatched ) }
    isBoF() { return ( this.shared.pos === 0 ) }
    isWS( s: ParseFuncScope<L,T,U> ): boolean {
        const iMatcher = s.matchers ? s.matchers.at(-1) : undefined
        if ( this.shared.inclAlwaysInDebug || ! iMatcher ) return false
        return ( iMatcher.key === this.shared.always || iMatcher.keyExt?.startsWith(this.shared.always + '.') )
    }
    isImatcherWS( iMatcher: any  ): boolean {
        if ( this.shared.inclAlwaysInDebug ) return false
        return ( iMatcher.key === this.shared.always || iMatcher.keyExt?.startsWith(this.shared.always + '.') )
    }

    // Parser entry point
    reset( inputStr: string ) {
        try {
            this.shared.input        = inputStr
            this.shared.line         = 1
            this.shared.col          = 1 
            this.shared.bol          = 0 
            this.shared.pos          = 0
            this.shared.firstSymbol  = ''
            this.shared.lastPosMatched = false
            // this.p.prevToken     = '__undef__'
            this.result              = new Map<string, MatchRecordExt<T>>()
            this.shared.always       = this.always
            this.shared.ignoreWS     = false
            this.matchPositions      = new Map<string, Map<number,number>> ()
            if ( this.always?.length > 0 && ! this.rules.PRMap.has(this.always as T) ) {
                throw Error(`reset(): The always token '${this.always}' is not defined in the parser rules`)
            }
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
        caller: callerIM = 'parse',
        parent:  ParseFuncScope<L,T,U> | undefined = undefined ,
        hasIMatcher = true,
        roundTrips = 1,
    ): retValuesT {
       
        let currNode = '__undef__'
        let validBranch: retValuesT  = 'branchFailed'
        try {
            assert( this.rules.PRMap.has( token ),`Parse(): Unknown parser token: '${token}'`)
            if  ( this.isEOF() ) return 'EOF'

            // Remember first Token 
            if ( this.shared.firstSymbol.length === 0  ) this.shared.firstSymbol = token
          
            // Create the ParseFuncScope
            const parser = parseFuncInit( 
                token, caller, 
                this.shared, 
                parent, 
                hasIMatcher,
            ) satisfies Sealed<ParseFuncScope<L,T,U>, 'eMap' | 'mRec' | 'iMatcher' | 'logic'>

            this.reverseIdx.push(parser.iMatcher.id)
            this.result.set(parser.iMatcher.id, parser.mRec)

            // Setup topToken and topNode
            if ( ! this.topNode ) {
                this.topToken = token
                this.topNode = parser.iMatcher.id
            }
            currNode = parser.iMatcher.id
            // Initial checks 
            if ( this.isTried( parser.mRec.tokenExt, parser.args.goingInPos ) ) {     
                // s.iMatcher.status.push('alreadyMatched')
                parser.iMatcher.retry = false
                    this.msg({
                        oper: 'SKIP',
                        iMatcher: parser.iMatcher,
                        level: parser.args.level+1,
                        color: 'gray',
                        text:   `Parse(L${parser.args.level}) Skip ${token} at ${parser.args.goingInPos} (tried already)`
                    })
                return 'skipped' 
            }
            else if ( ! this.isEOF()  ) {
                if ( ! this.isWS(parser) ) {
                    this.msg({
                        iMatcher: parser.iMatcher,
                        oper: `${ parser.args.roundTrips > 1 ? 'RETRY' : 'TRY'}`,
                        level: parser.args.level+1,
                        color: 'blue',
                        text:   `${ parser.args.roundTrips > 1 ? 'RETRY' : 'TRY'} Non-Terminal: ${token}(L${parser.args.level},R${parser.args.roundTrips}) at ${parser.args.goingInPos}`
                    })
                }
                this.setMatchPos(parser.mRec.tokenExt, parser.args.goingInPos, parser.args.level, 'parse()')
                parser.mRec.offsets.push(this.shared.pos)
                parser.iMatcher.offsets.push(this.shared.pos) 

                // Main loop 
                validBranch = this.parseExpect(token, parser);  
                if ( validBranch !== 'branchMatched') {
                    // Reset the match position
                    this.resetMatchPos(parser.mRec.tokenExt, parser.args.goingInPos, parser.args.level)
                }
                else {
                    this.prevMatch = parser.iMatcher.regexp!
                    parser.iMatcher.matched = true
                    // s.iMatcher.matchCnt += 1
                    // s.mRec.matchCnt = s.iMatcher.matchCnt
                    // s.iMatcher.retry = ( s.args.roundTrips < s.iMatcher.max  ) 
                }
              
                // Call recursively on retry
                if ( parser.iMatcher.matchCnt > 0 && 
                    parser.iMatcher.retry && 
                    parser.args.roundTrips < parser.iMatcher.max &&
                    ! this.isEOF()
                ) {
                // Update parent state for recursive call 
                    parser.args.goingInPos = this.shared.pos
                    parser.args.parentId = parser.iMatcher.id
                    validBranch = this.parse( token, 'parse', parser, false, ++parser.args.roundTrips )
                    if ( validBranch === 'branchMatched' ) {
                        parser.iMatcher.matched = true
                        parser.iMatcher.setStatus('branchMatched', '')
                    }
                    else if ( validBranch  === 'branchFailed' ) {
                        this.msg({
                            oper: 'RECURSIVE',
                            iMatcher: parser.iMatcher,
                            level: parser.args.level+2,
                            color: 'red',
                            text:   `Recursive call to ${token}(L${parser.args.level},R${parser.args.roundTrips}) failed at ${this.shared.pos}`
                        })
                    }
                }
            }
            // Remove/parse trailing white space at end-of-file
            if ( currNode === this.topNode && roundTrips === 1 && this.shared.pos < this.shared.input.length ) {   
                this.removeWS( parser )
            }

       
            // In case we did not parse the whole input string:
            // Parser Error message with pointer to the specific 
            // line and position in the input where the parsing failed.
            if ( ! this.isEOF() && 
                 token === this.topToken && 
                 currNode === this.topNode && 
                 roundTrips === 1 && 
                 this.shared.pos < this.shared.input.length 
            ) {
                let nlPos = this.shared.input.substring(0, this.shared.maxPos > 2 ? this.shared.maxPos -2 : 0 ).lastIndexOf('\n')
                nlPos = nlPos < 0 ? nlPos = 0 : nlPos + 1
                const fill: string[] = []
                for ( let i = nlPos; i < this.shared.maxPos; i++ ) {  fill.push('-') }
                const cursor = fill.join('') + '^'
                console.error( Colors.red(`Parser cannot match at line ${this.shared.maxLine} column ${this.shared.maxCol}:`))
                console.error( this.shared.input.substring(0, this.shared.maxPos + 20 ) )
                console.error( Colors.red( cursor )) 
                console.error(`Parse was imcomplete: ${this.shared.maxPos} < ${this.shared.input.length} (length of input)`)
            }
            if ( this.isEOF() ) validBranch = 'EOF'
            return validBranch 
        }
        catch(err) {
            console.error(err)
            throw err
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
                        const res: XRegExp.ExecArray | null = XRegExp.exec(this.shared.input, exp, breaks.lastPos, 'sticky' )
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
            if ( this.isEOF() ) return { ok: false, msg: 'EOF' }

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
                }
                else if ( iMatcher.logic  === 'none' ) {
                    if ( iMatcher.matchCnt < min ) {
                        tryNext = { ok: false, msg: 'Min allowed matches not reached' }
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

            if ( ! this.isImatcherWS(iMatcher) ) {
                this.msg({
                    oper: 'NoMatch',
                    iMatcher: iMatcher,
                    level: level+1,
                    color: 'gray',
                    text: `NO MATCH for ${iMatcher.keyExt}(L${level},R${iMatcher.roundTrips}) - adjust pos ${this.shared.pos} to ${iMatcher.offsets.at(0)} - (caller: ${_caller})`
                })  
            }
            // Reset the match position
            let idx =  -1
            let ident: string | undefined = ''
        
            while( ( ident = this.reverseIdx.at(idx) ) && ident >= id ) {
                const matchRec = this.result.get(ident)! satisfies MatchRecord<T>
                this.resetFailedResultRec( matchRec, errMsg, level+2  )  
                --idx
            } 

            this.msg({
                iMatcher: iMatcher,
                oper: 'ResetMatchPos',
                level: level+1,
                color: 'gray',
                text: `Resetting to pos: ${this.shared.pos} for ${iMatcher.keyExt} at ${iMatcher.offsets[0]}`
            })  

            // Remove any additional directly preceding white space
            if ( ! this.isImatcherWS(iMatcher) ) {
                while ( ( ident = this.reverseIdx.at(idx) )  && ( this.result.get(ident)?.ws ?? false ) ) {
                    const matchRec = this.result.get(ident)! satisfies MatchRecord<T>
                    this.resetFailedResultRec( matchRec, errMsg, level+2  )
                    --idx
                }
            }
            this.shared.pos = iMatcher.offsets.at(0)!
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
            if ( this.isEOF() ) return 
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
    removeWS( parser: ParseFuncScope<L,T,U> ): void {
        try {
            const iMatcherCurr = parser.matchers.at(-1)!

            // iMatcherCurr.offsets.push(this.p.pos)
            // Call the parser with the always token
            const hasIMatcher = false
            this.parse( this.always as T, 'removeWS', parser,  hasIMatcher, 1 )
            parser.args.goingInPos = this.shared.pos
            iMatcherCurr.offsets.push(this.shared.pos)
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
            const res: XRegExp.ExecArray | null = XRegExp.exec(this.shared.input, iMatcher.regexp!, offset, 'sticky' )
            this.setMatchPos( iMatcher.keyExt, offset, level ,'doMatch()' )
            //
            // Handle the match, that is any non-null result
            // 
            if ( res !== null ) {
                this.msg({
                    oper: 'MATCHED',    
                    iMatcher: iMatcher,
                    level: s.args.level+2,
                    color: 'green',
                    text: `MATCHED: ${iMatcher.key} at pos: ${this.shared.pos} to ${iMatcher.regexp!.lastIndex}, matched: "${this.shared.input.substring(this.shared.pos,iMatcher.regexp!.lastIndex)}"`
                    })  

                // Update regex math-position
                this.shared.pos = iMatcher.regexp!.lastIndex
                iMatcher.matched = true
                iMatcher.matchCnt += 1
                // Check if we have matched the last position in the input
                this.shared.lastPosMatched = ( this.shared.pos === this.shared.input.length - 1 && iMatcher.matched );
                this.shared.col = this.shared.pos - this.shared.bol + 1
                iMatcher.offsets.push(this.shared.pos)

                // Line numbering
                if ( iMatcher.key === this.shared.newLine ) {
                    this.shared.line++
                    this.shared.col = 1
                    this.shared.bol = iMatcher.regexp!.lastIndex 
                    this.shared.BoL = true
                }
                else if ( ! (iMatcher.ignore ?? false ) ) {
                    this.shared.BoL = false
                }

                // Update the match record
                matchRec!.matched = true
                matchRec!.value = res[2]
                matchRec!.text  = res[0] 
                matchRec!.type       = 'terminal' 
                matchRec!.matchCnt   = iMatcher.matchCnt     
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

    matchTerminal(  parser: Sealed<ParseFuncScope<L,T,U>, 'eMap' | 'mRec' | 'args'> ): void {
        try {
            // TERMINAL SYMBOLS
            // RHS INNER LOOP for regexp matching
            const iMatcher = parser.matchers.at(-1)!
            const matchRec: MatchRecord<T> = matchRecInit(parser, this.shared, iMatcher)
            // Special handling for mem of white space tokens
            if ( iMatcher.key === this.always || ( iMatcher.keyExt?.startsWith(this.always + '.') ?? false ) )  {
                matchRec.ws = true
            }
            if ( ! matchRec.ws && iMatcher.parentId ) {
                matchRec.ws = this.result.get(iMatcher.parentId)!.ws
            }

            this.reverseIdx.push(matchRec.id)
            this.result.set(matchRec.id, matchRec)

            if ( ! this.isWS(parser) ) {
                const inpSubstr = this.shared.input.substring( this.shared.pos, this.shared.pos + 30 )
                this.msg({
                    oper: 'TRY',
                    iMatcher: iMatcher,
                    level: parser.args.level+1,
                    color: 'cyan',
                    text: `TRY: ${iMatcher.keyExt}(L${parser.args.level},R${parser.args.roundTrips}) at ${this.shared.pos} against: "${inpSubstr}"`
                })
            }
            
            // Main Match loop for terminal symbols
            let matchCnt = 0
            do {
                if ( ! this.isWS(parser) ) {
                    // Remove leading white space
                    if ( parser.eMap.rootKey !== this.always) {
                        const wsPos = this.shared.pos
                        this.removeWS(parser)
                        if ( this.shared.pos > wsPos ) {
                            if ( this.isEOF() ) {
                                this.msg({
                                    oper: 'EOF',
                                    iMatcher: iMatcher,
                                    level: parser.args.level+1,
                                    color: 'cyan',
                                    text: `Removed WS and reached EOF: ${this.shared.pos}`
                                })
                                this.shared.lastPosMatched = true
                                break
                            }
                        }
                    }
                    if ( matchCnt > 0 && matchCnt <= iMatcher.max ) {    
                        this.msg({     
                            oper: 'RETRY',
                            iMatcher: iMatcher,
                            level: parser.args.level+2,       
                            color: 'cyan',  
                            text: `RETRY Terminal: ${iMatcher.keyExt}(L${parser.args.level},R${parser.args.roundTrips}) at ${this.shared.pos} against: "${this.shared.input.substring(this.shared.pos,this.shared.pos + 30).replace(/\n.*/mg, '')}"`     
                        })
                    }
                }
             
                iMatcher.tries += 1 
                if ( parser.eMap.rootKey !== this.always && matchCnt > 0 ) {
                    if ( this.chkBreakOn( {
                        level: parser.args.level,
                        roundTrips: parser.args.roundTrips,
                        idx: parser.iMatcher.idx,   
                        lastPos: this.shared.pos,
                        token: iMatcher.key as T,
                        breakOnPPGT: iMatcher.breaks ?? [],
                        startOn: iMatcher.starts ?? []
                    }) ) {
                        break
                    }
                }
 
                //  Do the actual match, taking the cardinality into account
                if ( ! this.isTried(iMatcher.keyExt!, this.shared.pos ) ) {
                    // Main match function
                    const ret = this.doMatch( parser, matchRec )                 
                    // Remember/Add the match to the result record
                    if ( ret.ok && matchRec.matched ) {
                        //Match
                        matchCnt++
                        if ( ! matchRec.ignore ) parser.mRec.children.push(matchRec.id!)
                        // Logic
                        if ( iMatcher.logicApplies ) {
                            parser.logic[iMatcher.roundTrips].setIMatch(iMatcher, matchRec.matched)
                            if ( iMatcher.logicLast ) {
                                const logicChk = this.validation.validLogicGroup(parser)
                                if ( ! logicChk.ok && iMatcher.roundTrips === 1 ) parser.iMatcher.setStatus('branchFailed', logicChk.msg ?? `Logic group failed for ${iMatcher.keyExt}`)
                            }
                        }

                        // if the matched object RegExp name has a corresponding 
                        // LHS Parser entry with an expect group
                        // If new match group(s), then call parse() recursively
                        if ( this.validation.matched(parser, this.shared.pos) && this.rules.PRMap.has(iMatcher.key as T) ) {
                            // If the matched Lexer object has a parser LHS non-terminal entry of its own of the same name, then call it
                            this.msg({
                                oper: 'CallOwnMatcher',
                                iMatcher: iMatcher,
                                level: parser.args.level+2,
                                color: 'cyan',
                                text: `Terminal symbol has own non-terminal matcher, so call: ${iMatcher.key}`
                            })
                            const hasIMatcher = false
                            this.parse( iMatcher.key as T , 'matchTerminal', parser, hasIMatcher, 1 )
                        }
                    }
                    else {
                        try {
                            if ( iMatcher.logicApplies ) parser.logic[iMatcher.roundTrips].setIMatch(iMatcher, matchRec.matched)
                        }
                        catch (err) {
                            const _debugHook = 1
                            console.error(err)
                            throw err
                        }
                        if ( ! this.isWS(parser) )
                            this.msg({
                                oper: 'NO MATCH',
                                iMatcher: iMatcher,
                                level: parser.args.level+2,
                                color: 'red',
                                text: `Match failed for: ${iMatcher.keyExt}`
                            })
                    }
                }        
            }
            while (  
                matchRec.matched            && 
                this.shared.pos > iMatcher.offsets.at(-1)! && 
                matchCnt < iMatcher.max     && 
                ! iMatcher.branchFailed()   && 
                ! this.isEOF() 
            ) // End of do-while loop
           

            if ( ! this.isWS(parser) ) {
                this.msg({
                    oper: 'TRY END',
                    iMatcher: iMatcher,
                    level: parser.args.level+1,
                    color: 'cyan',
                    text: `TRY END: ${iMatcher.key}(L${parser.args.level},R${parser.args.roundTrips}), matchCnt: ${matchRec.matchCnt}`
                })
            }
            // Check if the match count is within the cardinality constraints
            if ( ! this.shared.lastPosMatched && ! this.validation.matchInRange( iMatcher ).ok ) {
                this.resetFailedIMatcher(iMatcher, matchRec, parser.iMatcher.errors.at(-1), parser.args.level, 'matchTerminal()')
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

    parseExpect( token: T, parser: ParseFuncScope<L,T,U> ): retValuesT {
        try {
            let validBranch: retValuesT = 'branchFailed'
            //
            // Iterate over the expect array
            //
            let tryNext = { ok: false, msg: '' }
            let firstLogicGroup = true
            
            const expectLen = parser.eMap.expect.length - 1
            let _lastEntry = false 

            // Simple local tracking for optimistic matching of XOR groups
            const xorGroup: boolean[] = []
            // let xorIndex = -1

            parser.eMap.expect.every( ( _iMatcher: InternMatcher<T,U>, idx: number ) => { 
                _lastEntry = ( idx === expectLen ) 
                if ( this.isEOF() ) return false
                
                const iMatcherRaw = _.cloneDeep(_iMatcher) satisfies InternMatcher<T,U>
                assert( iMatcherRaw !== undefined, `eMap.expect.every(): Undefined iMatcher in 'expect array'`)
                assert((iMatcherRaw.key !== parser.args.token || idx > 0), Colors.red(`Left recursive reference: ${iMatcherRaw.key} to own parent token position 0` ))

                const iMatcher = iMatcherFac(
                    'parseExpect', 
                    parser, 
                    idx, 
                    this.shared, 
                    iMatcherRaw.key, 
                    iMatcherRaw
                ) satisfies InternMatcherExt<T,U>

                parser.matchers.push(iMatcher)

                // Check for startOn on idx 0 and subsequent idx > 0 that belong to the same initial logic group
                firstLogicGroup = firstLogicGroup  || ( idx === 0 && iMatcher.logicApplies ) 

                 // Handle XOR groups
                 if ( iMatcherRaw.logic === 'xor' ) {
                    // Initialize the XOR group
                    if ( iMatcherRaw.logicIdx === 0 ) {
                        xorGroup[ iMatcherRaw.logicGroup ] = false
                    }
                    // Check if the XOR group has already been matched
                    if ( xorGroup[ iMatcherRaw.logicGroup  ] && this.optimistic ) {
                        // Optimistic XOR Group matching
                        // Skip this iMatcher if the XOR group has already been matched
                        // 
                        // If skipping the actual last entry of the expect array
                        // 'lastEntry' must be set to false to facilitate 
                        // optimistic checking of the next XOR group
                        iMatcher.matched = false
                        parser.logic[iMatcher.roundTrips].setIMatch( iMatcher,  iMatcher.matched )
                        this.msg({
                            oper: 'SKIP',
                            iMatcher: iMatcherRaw,
                            level: parser.args.level+2,
                            color: 'gray',
                            text: `Skip  ${iMatcher.keyExt}(L${parser.args.level},R${parser.args.roundTrips}) due to already matched XOR group: `
                        }) 
                        if ( iMatcher.keyExt === 'arrElement.arrAssign')    {
                            this.debugHook = 1
                        }
                        return true
                    }
                }

                if ( idx === 0 || firstLogicGroup ) {
                    if ( ! this.chkStartOn( {
                        level: parser.args.level,
                        roundTrips: parser.args.roundTrips,
                        idx: idx,
                        lastPos: this.shared.pos,
                        token: iMatcher.key as T,
                        breakOnPPGT: iMatcher.breaks ?? [],
                        startOn : iMatcher.starts ?? []
                    }) ) {
                        this.msg({
                            oper: 'SKIP',
                            iMatcher: iMatcher,
                            level: parser.args.level+1,
                            color: 'gray',
                            text: `SKIP Due to missed StartOn condition for ${iMatcher.keyExt}(L${parser.args.level},R${parser.args.roundTrips})`
                        }) 
                        if ( idx === 0 && ! iMatcher.logicApplies )  return false
                        if ( firstLogicGroup && iMatcher.logicLast ) return false
                    }
                }
                if ( this.chkBreakOn( {
                    level: parser.args.level,
                    roundTrips: parser.args.roundTrips,
                    idx: parser.iMatcher.idx,   
                    lastPos: this.shared.pos,
                    token: iMatcher.key as T,
                    breakOnPPGT: iMatcher.breaks ?? [],
                    startOn : iMatcher.starts ?? []
                    }) 
                ) {
                    this.msg({
                        oper: 'SKIP',
                        iMatcher: iMatcher,
                        level: parser.args.level+1,
                        color: 'gray',
                        text: `SKIP Due to BreakOn condition for ${iMatcher.keyExt}(L${parser.args.level},R${parser.args.roundTrips})`
                    }) 
                    return false   
                }
                //
                // Handle TERMINAL SYMBOLS
                //
                if ( iMatcher.regexp ) {
                    this.matchTerminal( parser )
                    if ( iMatcher.logicApplies ) parser.logic[iMatcher.roundTrips].setIMatch( iMatcher, iMatcher.matched )

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
                    this.parse( iMatcher.key as T, 'parseExpect', parser, true, 1)

                    if ( iMatcher.logicApplies ?? false ) parser.logic[iMatcher.roundTrips].setIMatch( iMatcher, iMatcher.matched )
                    
                        if (    iMatcher.logic === 'xor' && 
                            iMatcher.matched && 
                            iMatcher.matchCnt >= iMatcher.min && 
                            iMatcher.matchCnt <= iMatcher.max 
                    ) {
                        xorGroup[ iMatcher.logicGroup ] = true
                        parser.logic[iMatcher.roundTrips].setIMatch(iMatcher, true)
                    }
                }
                // To continue the loop, we need to have a match (if mandatory) and not have failed mandatory branch 
                
                tryNext   = this.tryNextExpectToken(parser)

                if ( parser.args.token !== this.always ) {      
                    this.msg({
                        oper: 'TRY NEXT',
                        iMatcher: iMatcher,
                        level: parser.args.level+1,
                        color: 'gray',
                        text: `TRY NEXT after ${iMatcher.keyExt}(L${parser.args.level},R${parser.args.roundTrips}): ${tryNext.ok}`
                    })  
                }
                return tryNext.ok
            }); // End of expect.every()

            // Validate all XOR iMachers in the expect array or be optimistic and match until first success
            // const optimistic = this.optimistic || this.isEOF()
            
            // The whole loop has been completed successfully or validates according to the parser rules
            // If tryNext.ok is false and we are missing a mandatory match
            // if we have tried last iMatcher and the children are incompeletely macthed 
            // ( failure or success of sub-branches must have been propogated up through the call structure )

            // if branch is incomplete or failed, then reset the failed branch

            if  ( parser.iMatcher.keyExt === 'rhsAssign.arrAssign' ) {
                this.debugHook = 1
            }
           
            const valid = this.validation.validExpect(parser)

            validBranch = parser.iMatcher.roundTrips > 1 || valid ? 'branchMatched' : 'branchFailed'

            if ( valid ) {
                // We have validated the expect array and we are ok
                // Any failed terminals or sub-branch non-terminals within the expect array 
                // are not mandatory at this point, so they can be ignored
                parser.iMatcher.setStatus('branchMatched', 'success')   
                parser.iMatcher.matched = parser.mRec.matched = true
                parser.iMatcher.matchCnt += 1 
                parser.mRec.matchCnt = parser.iMatcher.matchCnt
                // This branch may have been triad multiple times, 
                // so next retry depends on the number of roundtrips
                parser.iMatcher.retry = parser.iMatcher.roundTrips < parser.iMatcher.max 
                if ( parser.args.token !== this.always && parser.iMatcher.matchCnt > 0 ) {
                    this.msg({ 
                        oper: 'BRANCH MATCHED',
                        iMatcher: parser.iMatcher,
                        level: parser.args.level+1,
                        color: 'green',
                        // text: `BRANCH MATCHED for ${s.args.token} (L${s.args.level},R${s.args.roundTrips})`
                        text: `BRANCH MATCHED for ${parser.iMatcher.keyExt} (L${parser.args.level},R${parser.args.roundTrips})`
                    }) 
                }
            }
            else if ( validBranch === 'branchFailed' ) {
                if ( ! this.isEOF() ) { 
                    if ( parser.args.token !== this.always ) { 
                        this.msg({
                            oper: 'BRANCH FAIL',
                            iMatcher: parser.iMatcher,
                            level: parser.args.level+1,
                            color: 'yellow',
                            text: `BRANCH FAIL for ${parser.iMatcher.keyExt} (L${parser.args.level},R${parser.args.roundTrips})`
                        })
                    }
                    parser.iMatcher.retry = false
                    this.resetFailedBranch(parser, parser.iMatcher.errors.at(-1), parser.args.level, 'parseExpect()')
                }
                if ( parser.iMatcher.roundTrips === parser.iMatcher.min ) parser.iMatcher.status = [ 'branchFailed' ]
            }
            else if ( validBranch !== 'branchMatched' ) {
                this.msg({
                    oper: 'BRANCH CONDITION',
                    iMatcher: parser.iMatcher,
                    level: parser.args.level+1,
                    color: 'yellow',
                    text: `BRANCH CONDITION for ${parser.iMatcher.keyExt} (L${parser.args.level},R${parser.args.roundTrips}): ${validBranch}`
                })
            }
           
            return validBranch
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

    getParseTree( excludeAlways = false, inclUnmatched = false ): MatchRecordExt<T>[] {
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
                    if ( e.token === this.always && excludeAlways ) e.ignore = true
                    if ( e.matched  && ! e.ignore ) {
                        const  node = _.cloneDeep(e)
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
                        if ( ! unMatched.has(id) || inclUnmatched ) {
                            children.push(id)
                        }
                    })
                    if (  e.children.length  > children.length )
                        e.children = _.cloneDeep(children)
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