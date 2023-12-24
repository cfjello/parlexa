// @deno-types='https://deno.land/x/xregexp/types/index.d.ts'
import XRegExp from  'https://deno.land/x/xregexp/src/index.js'
import { ulid } from "https://raw.githubusercontent.com/ulid/javascript/master/dist/index.js"
import { HierarKey } from "https://deno.land/x/hierarkey@v1.0/mod.ts"
import { assert } from "https://deno.land/std/assert/mod.ts";
import { _ } from './lodash.ts';

import { 
    Matched, 
    MatchRecord, 
    InternMatcher, 
    Matcher, 
    LexerRules, 
    ParserRules, 
    Info,
    MatchRecordExt, 
    parserReturnT, 
    retValuesArrayT,
    retValuesT,
    InternMatcherSealed,
    ParseFuncState,
    ParseArgs,
    parseArgsSchema,
    Sealed,
    DoMatchRet,
    BreaksT,  
    StartOnRS
} from "./types.ts"
import { ExpectMap } from "./types.ts";
import * as Colors from "https://deno.land/std/fmt/colors.ts" 
import { Logic } from "./Logic.ts";
import {Validate } from "./Validate.ts";
import { Rules } from "./Rules.ts";

export interface IIndexable<T> { [key: string]: T }
export interface MIndexable<T> { [key: string]: RegExp | Matcher<T> }

declare global {
    interface Array<T> {
        last(): T;
    }
}
Array.prototype.last = function (idx = -1) {
    return this[this.length - idx];
};

// Parser state
export class Parser<T, S = unknown>  {
    util: Validate = new Validate()
    rules: Rules<T>   
    // Debugging
    private _debug = false;
    public get debug() {
        return this._debug;
    }
    public set debug(value) {
        this._debug    = value;
        this.util.debug = value
    }
    // deno-lint-ignore no-explicit-any
    private __debug__ = ( args: any ) => { if ( this.debug ) console.debug(args) }

    //
    // White space and new line
    //
    public newLine    = 'NL'
    public whiteSpace = 'WS'
    public BoF  = true
    public BoL  = true
    debugHook     = 0
    public always = 'always';
    public inclAlwaysInDebug = false
    maxCount      = 0
    // Line number and column for error reporting and matching
    line    = 1
    col     = 1 
    bol     = 0 
    //
    // Parser input position
    //
    pos = 0;
    firstSymbol = true
    prevToken = '__undef__'
    
    // Keep track of what tokens and rexexp has already been 
    // matched at a specific position in the inpu
    input = ''
    matchPositions = new Map<string, Map<number,number>> ()
    nameResolution = new Map<string, string[]>
    prevMatch =  XRegExp( '__undef__') 
    prevBreakOn = { pos: -1 , token: '__undef__' }

    // Top level tokens
    topNode: string | undefined
    topToken: T | undefined

    // The Parser Result map
    result      =  new Map<string, MatchRecordExt<T>>()
    reverseIdx  =  [] as string[]
    // Imatcher State map
    // IMState     = new Map<string, InternMatcherSealed<T>[]>()
    // nextIdx     = 0 
    ignoreWS    = true

    // Logic groups initialization
    logicMap = new Map<string, Logic>() 

    private alwaysList: Array<InternMatcher<T>>    = []          // List of always Lexer rules

    public parseTree: {[key: string]: MatchRecord<T>} = {}
  
    constructor( public LR: LexerRules,  public PR: ParserRules<T>,  public initState: T, public userScope = {} as S ) {
        this.rules = new Rules<T>( LR, PR ) 
    }

    //
    // Run Parser entry point
    //
    reset( inputStr: string , info: Info<T> | undefined = undefined ) {
        this.input      = inputStr
        this.line       = info ? info.line : 1
        this.col        = info ? info.col : 1 
        this.bol        = 0 
        // this.pos        = 0
        this.firstSymbol = true
        this.prevToken  = '__undef__'
        this.result     = info ? info.result : this.result.size > 0 ? new Map<string, MatchRecordExt<T>>() : this.result
        this.parseTree  = {}
        // this.nextIdx    = info ? info.nextIdx : 0
        this.ignoreWS   = info ? info.ignoreWS : false
        this.initState  = info ? info.initState : this.initState 
        this.matchPositions = new Map<string, Map<number,number>> ()
        this.parse( this.initState, parseArgsSchema.parse({ tokenStr: this.initState + ''}) )
    }

    //
    // Main Parser function
    //
    parse ( token: T, _isc: ParseArgs | undefined ): parserReturnT<T>  {
        assert ( (token ?? 'undefined') !== 'undefined',`Parse(): Undefined parser token: '${token}'`)

        const isc = ( _isc === undefined  ? parseArgsSchema.parse({}) : _.cloneDeep(_isc) ) satisfies ParseArgs
        isc.tokenStr =  token + ''
        assert( this.rules.PRMap.has( isc.tokenStr ),`Parse(): Unknown parser token: '${token}'`)
        
        // Remember if this token is the initial token
        const firstSymbol = this.firstSymbol 
        if ( firstSymbol ) {
            this.firstSymbol = false
        } 
        else {
            assert( isc.parentId !== '__undef__', `Parse() has no parentId: ${JSON.stringify(isc)}` )
        }

        const s = this.parseInit( token, isc ) satisfies Sealed<ParseFuncState<T>, 'eMap' | 'mRec' | 'funcRet' | 'logic'>
        //
        // Initial checks        
        // 
        if  ( this.isEOF() ) {
            this.__debug__(Colors.gray(`${this.getIndent(isc.level+1)}Parse Skip ${token}(${isc.level}) at ${this.pos} due to EOF `) )
            s.funcRet.status.push('EOF')
            s.funcRet.retry = false
            return s.funcRet  
        }
 
        if ( this.isTried( s.mRec.tokenExt, isc.goingInPos ) ) {
            if ( ! this.isWS(s) ) {
                this.__debug__(Colors.gray(`${this.getIndent(isc.level+1)}Parse(L${isc.level}) Skips ${token} at ${this.pos} (tried already)`))
            }
            s.funcRet.status.push('alreadyMatched')
            s.funcRet.retry = false
            return s.funcRet  
        }
        else  if ( ! this.isWS(s) ) {
            this.__debug__(Colors.blue( `${this.getIndent(isc.level+1)}${ isc.roundTrips > 1 ? 'RETRY' : 'TRY'} Non-Terminal: ${token}(L${isc.level},R${isc.roundTrips}) at ${isc.goingInPos}`) )
        }

        this.setMatchPos(s.mRec.tokenExt, isc.goingInPos, isc.level, 'C2')
   
        //
        // setup logic conditions
        //
       //  s.logic = this.logicInit(s.isc, s.mRec)
        //
        // Setup topNode and the match record
        //
        if ( this.topNode === undefined ) {
            this.topToken = token
            this.topNode = s.mRec.id
        }
        this.parseExpect(s)    
        //
        // Validate the non-terminal token result
        //
        // const logicChk = this.util.validLogicGroup(s)
        // const countChk = this.util.validFinalMatchCnt(s) // && countChk.ok
        const matched = this.util.matched(s, this.pos)
        if ( matched ) {
            //
            // Update the result record and maintain the match count
            // 
            const iMatcher = s.matchers[s.matchers.length -1]
            s.funcRet.setStatus('matched', 'Matched') 
            // Update result record
            s.mRec.matched  = true 
            s.mRec.newPos = this.pos
            iMatcher.roundTrips = s.isc.roundTrips
            s.funcRet.matchCnt  = s.mRec.matchCnt
            iMatcher.matchCnt = s.mRec.matchCnt
            // If defined, call the ParserRules token callback: 
            // cb( currentMatchRecord, userDefinedScopeObject)
            if ( iMatcher.cb && s.eMap.cb instanceof Function ) {
                s.eMap.cb!( s.mRec, this.userScope as S )
            }
            //
            // Retry the same token for additional nin-terminal matches
            //
            if ( s.funcRet.retry ) {
                this.parse( 
                    token as T, 
                    parseArgsSchema.parse({
                        tokenStr:   token + '',
                        parentId:   s.mRec.id, 
                        level:      s.isc.level + 1, 
                        roundTrips: s.isc.roundTrips + 1, 
                        goingInPos: this.pos,
                        breakOn:    s.isc.breakOnPPGT.slice()
                    })
                )
            }
        } else {
            //
            // No Match/secondary try failure/branch failure
            // 
            /*
            this.__debug__(`NO Call recursive for ${s.iMatcher.key} with new roundTrips: ${s.isc.roundTrips+1}`)
            if ( ! logicChk.ok ) { 
                // branch failed due to logic group failure
                s.funcRet.setStatus('branchFailed', logicChk.err ?? `Logic group failed for ${s.iMatcher.keyExt}`)
            }
            */
            /*
            else if ( ! countChk.ok ) {
                // branch failed due to match count failure
                s.funcRet.setStatus('branchFailed', countChk.err ?? `Match count failed for ${s.iMatcher.keyExt}`)   
            }
            */
           /*
            if ( ! this.isEOF() && s.isc.roundTrips === 1 && this.util.branchFailed(s) ) {
                const errIdx = s.funcRet.errors.length - 1
                this.resetFailedBranch(s, undefined, s.iMatcher.offset, ` - ${s.funcRet.errors[errIdx]} `, isc.level, 'parse_A')
            }
            */

        }
        // In case we did not parse the whole input string:
        // Parser Error message with pointer to the specific 
        // line and position in the input where the parsing failed.
        if ( ! this.isEOF() && this.firstSymbol && this.pos < this.input.length ) {
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
        //
        // Build the return object
        //
        if ( this.isEOF() ) s.funcRet.setStatus( 'EOF', 'End of File') 
        return s.funcRet as parserReturnT<T>
    }

    doMatch(s: ParseFuncState<T> ): DoMatchRet {
        //
        // Initialize
        //
        const iMatcher = s.matchers[s.matchers.length -1]
        if ( iMatcher.key === 'STR' ) {
            const _debug_hook = true
        }
        const matchRec  = this.doMatchInit(s.isc, iMatcher)
        const ret: DoMatchRet = { 
            id:             matchRec.id, 
            foundToken:     false, 
            foundSubToken:  false,
            ignore:         matchRec.ignore ?? false,
            doBreak:        false
        } 
        const level = s.mRec.level
        //
        // Run the iMatcher RegExp 
        //
        const res: XRegExp.ExecArray | null = XRegExp.exec(this.input, iMatcher.regexp!, matchRec.offset, 'sticky' )
        this.setMatchPos( iMatcher.keyExt!, matchRec.offset, level ,'C1' )
        //
        // Handle the match, that is any non-null result
        // 
        if ( res !== null ) {
            this.__debug__(Colors.red(`${this.getIndent(level+2)}MATCHED: ${iMatcher.key} at pos: ${this.pos} to ${iMatcher.regexp!.lastIndex}, matched: "${this.input.substring(this.pos,iMatcher.regexp!.lastIndex)}"`) )
            // 
            // Update position and line numbering
            //
            this.pos = iMatcher.regexp!.lastIndex
            this.col = this.pos - this.bol + 1
            if ( iMatcher.key === this.newLine ) {
                this.line++
                this.col = 1
                this.bol = iMatcher.regexp!.lastIndex 
                this.BoL = true
            }
            else if ( ! (iMatcher.ignore ?? false ) ) {
                this.BoL = false
            }
            ret.foundToken = true 
            matchRec.matched = true
            matchRec.value = res[2]
            matchRec.text  = res[0] 
            matchRec.type       = iMatcher.key 
            matchRec.matchCnt   = iMatcher.matchCnt     
            matchRec.parentId   = iMatcher.parentId ?? ''
           
            //
            // Add any additional named match groups
            //
            if ( ! _.isUndefined(res.groups ) ) {
                for ( const k in res.groups  ) {
                    // deno-lint-ignore no-explicit-any
                    (matchRec as IIndexable<any>)[k] = res.groups[k]
                }
            }
            //
            // if exists, run the Lexer callback function 
            //
            if ( iMatcher.cbLex !== undefined ) iMatcher.cbLex(matchRec, this.userScope as S);
            //
            // if exists, run the Parser callback function on the parser result
            // 
            if ( iMatcher.cb !== undefined ) iMatcher.cb (matchRec, this.userScope as S)
            //
            // Store the result 
            //
            this.reverseIdx.push(ret.id)
            this.result.set( ret.id, matchRec )
            // this.__debug__(Colors.brightYellow(`${this.getIndent(level+1)}ADDED: ${iMatcher.keyExt} to Result`) )   
            this.prevMatch = iMatcher.regexp!
        }
        return ret
    }

    parseExpect( s: ParseFuncState<T> ): void {
        //
        // Iterate over the expect array
        //
        s.eMap.expect.every( ( _iMatcher: InternMatcher<T>, idx: number ) => { 
            if ( this.isEOF() ) return false
            let iMatcher = _.cloneDeep(_iMatcher) satisfies InternMatcher<T>
            
            // this.__debug__('INTO Expect Loop')
            assert( iMatcher !== undefined, `eMap.expect.every(): Undefined iMatcher in 'expect array'`)
            assert( iMatcher.key !== undefined && iMatcher.key !== 'undefined', Colors.red(`eMap.expect.every(): Undefined iMatcher.key in 'expect array'`))
            assert((iMatcher.key !== s.isc.tokenStr || idx > 0), Colors.red(`Left recursive reference: ${iMatcher.key} to own parent token position 0` ))
            
            s.matchers.push(iMatcher)
            iMatcher = this.iMatcherInit( s, idx ) satisfies InternMatcherSealed<T>
            //
            // Handle the token
            //
            if ( iMatcher.regexp ) {
                //
                // TERMINAL SYMBOLS
                // 
                // this.__debug__(`INTO Terminal Symbols with: ${s.iMatcher.keyExt}`)

                // Remove leading white space
                if ( s.eMap.rootKey !== this.always) this.removeWS(s)

                // if a breakOn condition is met, then exit the loop
                if ( this.chkBreakOn( iMatcher.breaks  ) ) return false

                this.matchTerminal( s )
            }
            else {
                //
                // NON-TERMINAL SYMBOLS
                //
                // this.__debug__(`INTO Non-Terminal Symbols with: ${iMatcher.keyExt}`)
                if ( this.isTried( iMatcher.keyExt, this.pos) && ! iMatcher.keyExt.startsWith(this.always) ) {
                    this.__debug__(Colors.cyan(`${this.getIndent(s.isc.level+1)}SKIP Match: ${iMatcher.keyExt}(L${s.isc.level}) at ${this.pos} ALREADY TRIED against: "${this.input.substring(this.pos,this.pos + 30).replace(/\n.*/mg, '')}"`) )
                    s.funcRet.status = [ 'alreadyMatched' ]
                }
                else {
                    //
                    // Recursive call to parse with non-terminal symbol
                    //
                    if ( ! this.isTried( iMatcher.keyExt, iMatcher.offset ) && ! this.isEOF() ) {
                        const ret = this.parse( 
                                iMatcher.key as T, 
                                parseArgsSchema.parse({
                                    tokenStr: iMatcher.key,
                                    parentId: s.mRec.id, 
                                    level: s.isc.level + 1, 
                                    roundTrips: s.isc.roundTrips + 1, 
                                    goingInPos: this.pos,
                                    breakOn: s.isc.breakOnPPGT.slice()
                                })
                            )
                        iMatcher.tries++
                        if ( ret && ret.matched && ! ret.branchFailed() ) {
                            iMatcher.roundTrips = ret.roundTrips
                            s.mRec.matchCnt = ( s.mRec.matchCnt ?? 0 ) + 1
                            iMatcher.matchCnt = s.mRec.matchCnt
                            s.funcRet.matchCnt
                        }
                        else if ( ret && ret.branchFailed() ) {
                        iMatcher.failed = true
                        }
                        // Set the logicMatcher match count for the non-terminal symbol
                        if ( iMatcher.logicApplies ) {
                            s.logic.setIMatch( iMatcher, ! this.util.branchFailed(s) )
                        }
                    }
                }
            }

            //
            // To continue the loop, we need to have a match (if mandatory) and not have failed the branch
            //
            // orGroupMatched = this.util.orGroupMatched(s)
            const tryNext   = this.util.tryNextExpectEntry(s)
            s.funcRet.retry =  tryNext.ok && !  this.isEOF()
            /*
            let tryReason = tryNext.ok ? 'TryNext' : 'NoTryNext'
            const branchFailed =  this.util.branchFailed(s)
            tryReason = branchFailed ? 'branchFailed' : tryReason
            const eof = this.EOF()
            tryReason = eof ? 'EOF' : tryReason
            continueLoop =  tryNext.ok && ! ( this.EOF() || this.util.branchFailed(s) )
            */
            
            if ( s.isc.tokenStr !== this.always ) {
                this.__debug__(Colors.yellow(`${this.getIndent(s.isc.level+1)}NEXT at ${iMatcher.keyExt} try next symbol(L${s.isc.level},R${s.isc.roundTrips}): ${s.funcRet.retry} `))  
            }
            return s.funcRet.retry
        }); // End of expect.every()
        //
        // Validate all iMachers in the expect array
        //
        let idx = -1
        for ( const im of s.matchers ) {
            idx++
            if ( im.failed ) {
                s.funcRet.setStatus('branchFailed', `Branch failed for ${im.keyExt}`)
                break
            }
            if ( im.matched ) {
                if ( this.util.matchOutOfRange(s, idx) ) {
                    s.funcRet.setStatus('branchFailed', `Match count out of range for ${im.keyExt}`)
                    break
                }
            }
        }
    }

    matchTerminal(  s: Sealed<ParseFuncState<T>, 'eMap' | 'mRec' | 'isc'> ): void {
        //
        // TERMINAL SYMBOLS
        // RHS INNER LOOP for regexp matching
        //
        const iMatcher = s.matchers[s.matchers.length -1]
        let  match: Matched =  { foundToken: false, foundSubToken: false, id: undefined, doBreak: false , ignore: false}
        // const matchArr: Matched[] = []
        const [_min, max] = this.util.getMulti(iMatcher.multi)
        let matchCnt = 0
        let loopCnt  = 0
        iMatcher.roundTrips = s.isc.roundTrips
        // iMatcher.parent = id
        //
        // Inner loop, repeating for multiple matches if applicable
        //
        if ( ! this.isWS(s) ) {
            const inpSubstr = this.input.substring( this.pos, this.pos + 30 )
            this.__debug__(Colors.cyan(`${this.getIndent(s.isc.level+1)}TRY: ${iMatcher.keyExt}(L${s.isc.level}) at ${this.pos} against: "${inpSubstr}"`))
        }
        //
        // Main Match loop for terminal symbols
        //
        do {
            match = { foundToken: false, foundSubToken: false, id: undefined, doBreak: false , ignore: false};
            if ( ! this.isWS(s) && matchCnt > 0 ) {
                this.__debug__(Colors.cyan(`${this.getIndent(s.isc.level+1)}RETRY Terminal: ${iMatcher.keyExt}(L${s.isc.level},R${s.isc.roundTrips}) at ${this.pos} against: "${this.input.substring(this.pos,this.pos + 30).replace(/\n.*/mg, '')}"`) )
            }
            iMatcher.tries = ++loopCnt  
            //
            // Handling 'always' (White space) entries
            // 
            if ( s.eMap.rootKey !== this.always && matchCnt > 0 ) {
                // Remove leading white space
                if ( s.eMap.rootKey !== this.always) this.removeWS(s)

                // if a breakOn condition is met, then exit the loop
                if ( this.chkBreakOn( iMatcher.breaks  ) ) break
            }
            /*
            // 
            // StartOn conditions and
            // BreakOn conditions
            //
            iMatcher.breaks.idx = idx
            breakOn.lastPos = this.pos
            exitExpectLoop =  this.chkBreakOn(breakOn) 
            
            if ( exitExpectLoop ) break 
            */
            //
            //  Do the actual match, taking the cardinality into account
            //
            if ( ! this.isTried(iMatcher.keyExt, this.pos ) ) {
                // Main match function
                match = this.doMatch( s )                 
                // Remember/Add the match to the result record
                if ( match.foundToken ) {
                    iMatcher.matchCnt = ++matchCnt  
                    if ( ! match.ignore ) s.mRec.children.push(match.id!)

                    if ( iMatcher.logicApplies ) s.logic.setIMatch(iMatcher, match.foundToken)
                    const logicChk = this.util.validLogicGroup(s)
                    if ( ! logicChk.ok ) s.funcRet.setStatus('branchFailed', logicChk.err ?? `Logic group failed for ${iMatcher.keyExt}`)

                    // if the matched object RegExp name has a corresponding 
                    // LHS Parser entry with an expect group
                    // If new match group(s), then call parse() recursively
                    if ( this.util.matched(s, this.pos) && this.rules.PRMap.has(iMatcher.key) ) {
                        //
                        // If the matched Lexer object has a parser LHS non-terminal entry of its own, then call it
                        // 
                        this.__debug__(Colors.blue(`${this.getIndent(s.isc.level+1)} Terminal symbol has own matcher, so call: ${iMatcher.key}`) )
                        match.foundSubToken = true
                        // const symbGoingInPos = this.pos
                        const _fnRet = this.parse( 
                            iMatcher.key as T , 
                            parseArgsSchema.parse({
                                tokenStr:   iMatcher.key,
                                parentId:   s.mRec.id, 
                                level:      s.isc.level + 1, 
                                roundTrips: iMatcher.roundTrips + 1, 
                                goingInPos: this.pos,
                                breakOn:    s.isc.breakOnPPGT.slice()
                            })
                        )
                        // const ret = 
                        // if ( ret && ! this.EOF() && ( ret.status.includes('branchFailed') || ret.roundTrips < ret.min  ) ) { 
                        //         this.resetFailedBranch(s, match, symbGoingInPos, 'Branch Failed', ret.level, 'matchTerminal_A')
                        // }
                    }
                }
            }            
        }
        while (  
            match.foundToken  && 
            matchCnt < max    && 
            ! this.util.branchFailed(s) && 
            // ( iMatcher.logicGroup < 0 || min > 1 ) &&        // Logic group is not active or min > 1
            ! this.isEOF() 
        ) 
        s.mRec.matchCnt = matchCnt
        //
        // Final Evaluation of match count
        // Check if the match count is within the cardinality constraints
        //
        if ( ! this.isWS(s) ) {
            this.__debug__( Colors.brightCyan(`${this.getIndent(s.isc.level+1)}TRY_END: ${iMatcher.key}(L${s.isc.level},R${s.isc.roundTrips}) ${iMatcher.keyExt}, matchCnt: ${s.mRec.matchCnt}`) )
        }
        if ( this.util.matchOutOfRange( s ) ) {
            this.resetFailedBranch(s, undefined, iMatcher.offset, s.funcRet.errors.at(-1), s.isc.level, 'matchTerminal_B')
        }
        else {
            // Take note of the overall max match for use with the hierarkey node size
            if (matchCnt > this.maxCount ) this.maxCount = matchCnt
        }

        // if ( exitExpectLoop )  this.__debug__(`${this.getIndent(isc.level)}EXIT ${logicKey} due to exitExpectLoop -> ${exitExpectLoop}`)
        // const ret = branchFailed() || exitExpectLoop ? false : true 
    }

    //
    // Recursive call to parse with non-terminal symbol
    //
    removeWS( s: ParseFuncState<T> ): void {
        const iMatcher = s.matchers[s.matchers.length -1]
        const _ret = this.parse( 
            this.always as T, 
            parseArgsSchema.parse({ 
                tokenStr: this.always, 
                parentId: iMatcher.id,
                goingInPos: this.pos, 
                level: s.isc.level + 1, 
                roundTrips: 1 
            }) )
        s.mRec.offset     = this.pos
        iMatcher.offset = this.pos
    }

    //
    // Error handling and backtracking
    //
    failAlreadyMatched( matchToken: string, pos: number): void {
        assert( matchToken && ! _.isEmpty(matchToken) , `failAlreadyMatched() got an undefined token name: '${matchToken}'`)
       
        const matchNames = _.merge( [ matchToken ], this.nameResolution.get(matchToken) )
        for ( const name of matchNames ) {
            const _ret = this.matchPositions.get(name)?.delete(pos)
            // if ( _ret ) this.__debug__(`                        --- DEL Match Pos: ${pos} for "${name}" -> ${ret}`)
        }
    }

    resetFailedBranch( 
        s: ParseFuncState<T>,
        match:  Matched | undefined , 
        resetToPos: number, 
        errMsg = '', 
        level: number, 
        _caller = '__unknown__') {
        try {
            const iMatcher = s.matchers[s.matchers.length -1]
            const id = match ? match.id! : s.mRec.id! 
            const roundTrips = s.isc.roundTrips
            // const entry    = this.result.get(id)!
            assert( s.mRec !== undefined,  `failBranch() got an undefined result entry`)
            assert(s.mRec.tokenExt ,  `failBranch() got undefined tokenExt for  'id': ${JSON.stringify(s.mRec)}`)
            
            if ( this.debug ) { `${this.getIndent(level)}failBranch(${id}) match entry: ${JSON.stringify(s.mRec)}`}
            s.mRec.matched  = false
            s.mRec.matchCnt = 0
            s.mRec.matchErr = errMsg
            // Adjust the overall match position
            this.__debug__(
                Colors.green(
                    `${this.getIndent(level+2)}No Match for (caller: ${_caller}(L${level},R${roundTrips})): ${iMatcher.keyExt} - adjust pos ${this.pos} to ${resetToPos}`
                ) 
            )
            this.__debug__(
                Colors.green(
                    `${this.getIndent(level+2)}ERRORS: ${JSON.stringify(s.funcRet.errors)}`
                ) 
            )
            this.pos = resetToPos
            //
            // Update the latter part of result tree (starting with next from the current entry)
            //
            for( let idx = this.reverseIdx.length -1; this.reverseIdx[idx] > id; idx-- ) {
                const ent = this.result.get(this.reverseIdx[idx])!
                assert( ent !== undefined && ent.tokenExt !== undefined,  `failBranch() got an undefined result entry or tokenExt for ${JSON.stringify(ent ?? {}, undefined, 2)}`)
                this.failAlreadyMatched(ent.tokenExt!, ent.offset)
                ent.mached = false
                ent.matchCnt = 0
                ent.matchErr = 'invalidated'
            } 
        }
        catch( err ) {
            console.error(err)
        }
    }

    // 
    // Get Functions
    //
    getUserScope(): S { return this.userScope }
    
    getIndent( level: number, filler = '  ') {
        return Array<string>(level).fill(filler, 0 ).join('')
    }

    getParentToken( isc: ParseArgs ): string {
        let parentToken = '' 
        if ( isc.tokenStr !== this.always && isc.parentId !== '__undef__' && this.result.has(isc.parentId!) ) {
            parentToken = `${(this.result.get(isc.parentId!) as MatchRecord<T>).value}` 
        }
        return parentToken
    }   

    getTokenExt( isc: ParseArgs ): string {
        const parentToken = this.getParentToken(isc)
        const tokenExt =  ( parentToken && ! _.isEmpty(parentToken) ?  `${parentToken}.` : '' ) + isc.tokenStr 
        assert( tokenExt && tokenExt !== 'undefined', `TokenExt is undefined for ${parentToken} and ${isc.tokenStr}` )
        return tokenExt
    }
    //
    // Output formatters
    //
    getParseTree( _excludeAllways = false ): MatchRecord<T>[] {
        const res: MatchRecord<T>[] = []
        const unMatched = new Map<string, boolean>()
        if ( this.topNode ) {
            const maxDigits = this.maxCount.toString().length + 1
            const hk = new HierarKey(1, maxDigits)  
            let prevLevel = 0 
            for ( const [_id, e] of this.result ) {
                // let newLevel = Math.abs( e.level - prevLevel )
                if ( e.tokenStr === this.always && _excludeAllways ) e.ignore = true
                if ( ( e.matched ) && ! ( e.ignore ?? false ) ) {
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
        return _.sortBy(res, ['id'])   //  _.sortBy(res, ['ident'])
    }

    getIterator() {
        const tree = this.getParseTree()
        return tree[Symbol.iterator]()
    }

    //
    // Set functions
    // 
    setMatchPos( matchToken: string, pos: number, _level = 0, _caller: string) {
        try {
            assert( ! _.isEmpty(matchToken), `setMatchPos() got an undefined token name from caller: ${_caller}`) 
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
    
            let count = this.matchPositions.get( matchToken)?.get(pos) ?? 1
            if ( ! this.matchPositions.has(matchToken) ) {
                this.matchPositions.set( matchToken, new Map<number,number>() )
            }    
            this.matchPositions.get( matchToken)!.set(pos, ++count)
        }
        catch( err ) { throw Error(err) }
    }

    //
    // Check functions
    //    
    isTried( matchToken: string, pos: number ): boolean { return  this.matchPositions.get( matchToken )?.has(pos) ?? false}
    isEOF() { return ( this.pos >= this.input.length ) }
    isBoF() { return ( this.pos === 0 ) }
    isWS( s: ParseFuncState<T> ): boolean {
        const iMatcher = s.matchers ? s.matchers[s.matchers.length -1] : { key: '__undef__', keyExt: '__undef__' }
        return ( ! this.inclAlwaysInDebug && iMatcher && ( iMatcher.key === this.always || iMatcher.keyExt.startsWith(this.always + '.') ) ) 
    }

    chkBreakOn( breakOn : BreaksT<T> ): boolean {
        let   matched = false
        const startOn = this.chkStartOn( breakOn ) 
        if ( breakOn.breakOnPPGT.length > 0  ) {
            // this.__debug__( `BreakOn token: ${a.token} against: ${a.breakOnPPGT} for '${this.input.substring(a.lastPos,a.lastPos + 20)}`)
            for ( const exp of breakOn.breakOnPPGT ) {
                // LookBack
                if ( this.prevMatch.toString() === exp.toString() && 
                    ! ( startOn.active && startOn.ok && startOn.match === exp.toString() )
                ) {
                    this.__debug__( Colors.red(`${this.getIndent(breakOn.level+1)}BreakOn on prevMatch for '${breakOn.token}'`) + ': ' + exp.toString())
                    matched = true
                    break
                }
                else {
                    // lookAhead
                    const res: XRegExp.ExecArray | null = XRegExp.exec(this.input, exp, breakOn.lastPos, 'sticky' )
                    if ( res !== null ) {
                        this.__debug__(Colors.red(`${this.getIndent(breakOn.level+1)}BreakOn on lookAhead for '${breakOn.token}'`) + ': ' + exp.toString())
                        matched = true
                        break
                    }
                }
            }
            if ( matched ) {
                this.prevBreakOn = { pos: breakOn.lastPos, token: breakOn.token + '' }
            }
            else {
                this.prevBreakOn = { pos: -1, token: '__undef__' }
            }
        }
        return matched
    }

    chkStartOn( breaks: BreaksT<T>
       // eMap:    ExpectMap,
       //  level:   number,
    ): StartOnRS {
        const res = { active: false, ok: false, match: '' }
        if ( breaks.idx === 0 && (breaks.eMap.startOn ?? []).length > 0 ) {
            for( const exp of breaks.eMap.startOn! ) {
                res.active = true
                // this.__debug__(Colors.green(`${this.getIndent(breaks.level+1)}StartOn: ${exp} against ${this.prevMatch}`) ) 
                const prev =  this.prevMatch.toString()
                const curr =  exp.toString()
                if ( prev === curr ) {
                    // this.__debug__(Colors.green(`${this.getIndent(breaks.level+1)}StartOn: ${exp} against ${this.prevMatch}`) ) 
                    res.match = curr
                    res.ok = true
                    break
                }
            }
        }
        return res
    }

    //
    // Initializers
    //
    formatError(token: string , message = '' ): string {
        const text = this.input.substring(this.pos)
        let messageNull = ''
        if (token == null) {
            const _token: Partial<MatchRecord<T>> = {
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

    MatchRecInit( isc: ParseArgs ): MatchRecord<T> {
        const mRec =  {
            id:         ulid(),
            type:       'Token',
            tokenStr:   isc.tokenStr,
            tokenExt:   this.getTokenExt(isc),
            value:      '',
            text:       '',
            offset:     isc.goingInPos,
            newPos:     isc.goingInPos,
            ofLen:      this.input.length,
            line:       this.line,
            col:        this.col,
            matched:    false,
            matchCnt:   0,
            parentId:     isc.parentId,
            level:      isc.level,
            children:   []
        } as MatchRecord<T> 
        this.reverseIdx.push(mRec.id)
        this.result.set( mRec.id, mRec)
        return mRec
    }

    parseInit( token: T, isc: ParseArgs ): Sealed<ParseFuncState<T>, 'eMap' | 'mRec' | 'funcRet' | 'logic'>  {
        //
        // Initialize
        //   
        const s: Partial<ParseFuncState<T>> = { token: token, isc: isc }

        s.eMap = this.rules.PRMap.get(isc.tokenStr)! satisfies ExpectMap<T>  // Get the ExpectMap for the token

        this.prevToken = isc.tokenStr
        //
        // create the result match record for the token
        //
        s.mRec = this.MatchRecInit(isc) satisfies MatchRecord<T>
        //
        // Init return record
        //
        s.funcRet = this.parserRetInit(s as Sealed<ParseFuncState<T>, 'eMap' | 'mRec' > )
        //
        // Add logic handling
        // 
        s.logic = this.logicMap.has(isc.tokenStr)  ? new Logic( s.mRec.id, this.logicMap.get(isc.tokenStr)!.logicGroups ) : undefined
        //
        // Add Array of iMatchers to the state
        //
        s.matchers = [] as InternMatcherSealed<T>[]
        //
        // state has been initialized, so we can seal it
        //
        return s as Sealed<ParseFuncState<T>, 'eMap' | 'mRec' | 'funcRet' | 'logic'>
    }

    doMatchInit( isc: ParseArgs, iMatcher: InternMatcher<T> ): MatchRecord<T> {
        const mRec = {
            id:         ulid(),
            type:       iMatcher.key,
            tokenStr:   iMatcher.key,
            tokenExt:   iMatcher.keyExt ?? iMatcher.key,  
            value:      '',
            text:       '',
            ignore:     iMatcher.ignore ?? false,
            offset:     this.pos,
            newPos:     this.pos,
            ofLen:      this.input.length,
            line:       this.line,
            col:        this.col,
            matched:    false,
            matchCnt:   0,
            parentId:     isc.parentId,
            level:      isc.level,
            children:   []
        } as MatchRecord<T>
        // this.reverseIdx.push(mRec.id)
        // this.result.set( mRec.id, mRec)
        return mRec 
    }

    parserRetInit(s: Sealed<ParseFuncState<T>, 'eMap' | 'mRec'> ): parserReturnT<T> {
        //
       // Initial return conditions
       //
       const [tokenMin, tokenMax] = this.util.getMulti( s.eMap.multi ?? '0:m'  )
       const ret: parserReturnT<T> = Object.assign(s.mRec, { 
           status:         [] satisfies retValuesArrayT,
           tokenStr:       s.isc.tokenStr,
           level:          s.isc.level,
           roundTrips:     s.isc.roundTrips,
           min:            tokenMin,
           max:            tokenMax,
           matchCnt:       s.isc.roundTrips - 1,
           hasCallback:    s.eMap.cb ?? false ? true : false,
           retry:          false,  
           errors: [],
           branchFailed:   function() { return false },  // Dummy assignment 
           setStatus:      function() {}                    // Dummy assignment
       })
       ret.branchFailed =  function() { return this.status.includes('branchFailed') }
       ret.setStatus    =  function( status: retValuesT, errMsg: string ): void { 
                               if ( ! this.status.includes(status) ) this.status.push(status) 
                               this.errors.push(errMsg)
                           }
       return ret
   }


   iMatcherInit<T>( s: Sealed<ParseFuncState<T>, 'eMap' | 'mRec'>,  idx: number ): InternMatcherSealed<T> {
       const iMatcher = s.matchers[s.matchers.length-1] satisfies InternMatcher<T>
       if ( iMatcher.regexp ) iMatcher.regexp.lastIndex = this.pos
       assert( iMatcher !== undefined, `eMap.expect.every(): Undefined iMatcher in 'expect array'`)
       assert( iMatcher.key !== undefined && iMatcher.key !== 'undefined', Colors.red(`eMap.expect.every(): Undefined iMatcher.key in 'expect array'`))
       assert((iMatcher.key !== s.isc.tokenStr || idx > 0), Colors.red(`Left recursive reference: ${iMatcher.key} to own parent token position 0` ))
       
       const [min, max]    = this.util.getMulti( iMatcher.multi )

       iMatcher.id         = s.mRec.id   
       iMatcher.idx        = idx
       iMatcher.min        = min
       iMatcher.max        = max
       iMatcher.keyExt     = `${s.isc.tokenStr}.${iMatcher.key}`
       iMatcher.roundTrips = s.isc.roundTrips  
       iMatcher.parentId   = s.mRec.parentId 
       if ( s.isc.parentId !== '__undef__' ) this.result.get(s.isc.parentId)!.children.push(s.mRec.id)
       iMatcher.level      = s.isc.level 
       iMatcher.offset     = this.pos
       iMatcher.newPos     = this.pos
       iMatcher.matchCnt   = 0 
       iMatcher.tries      = 0
       iMatcher.breaks     = this.breakOnInit(s) 
       iMatcher.ignore     = iMatcher.ignore ?? false
       // Logic Part
       iMatcher.logicLast  = false
       iMatcher.logicGroup = -1 
       iMatcher.logic = iMatcher.logic ?? 'none'  
       iMatcher.logicApplies = ( s.logic !== undefined  )
       iMatcher.matched    = false
       iMatcher.failed     = false
       /*
       iMatcher.cb         = iMatcher.cb
       */ 

       return iMatcher
   }
   
   breakOnInit<T>( s: ParseFuncState<T> ): BreaksT<T> {
        //
        // Setup Break Conditions
        //
        return {
            token:       s.isc.tokenStr as T,
            roundTrips:  s.isc.roundTrips,
            idx:         0, 
            level:       s.isc.level,
            lastPos:     this.pos,
            breakOnPPGT: _.uniq( _.concat(s.isc.breakOnPPGT, s.eMap.breakOn ?? []) )  ,
            startOnPPGT: _.uniq( _.concat(s.isc.startOnPPGT, s.eMap.startOn ?? []) ) ,
            eMap:        s.eMap
        }
    }
}
