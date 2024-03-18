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
import { Debug } from './InfoLogger.ts'
import { parseFuncFac } from './parseFuncFac.ts'
import { matchRecFac } from './matchRecFac.ts'
import { Validation } from './Validation.ts'
import { HierarKey } from './imports.ts';

// Parser state
export class Parser<L extends string, T extends string, U = unknown> {
    // Debugging
    private _debugger: Debug 
    private _debug = false;
    public get debug() {
        return this._debugger.debug
    }
    public set debug(value) {
        this._debug = value
        this._debugger.debug = value
    }
    msg
    // Parser Rules and Validation
    rules: Rules<L,T,U>  
    validation: Validation<L,T,U>
    
    debugHook    = 0

    // Parser Global Scope
    p = parserSharedFac(this) satisfies ParserSharedScope<L,T,U>
    
    // Name af remove whitespace token
    always      = 'always';
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
    isTried( matchToken: string, pos: number ): boolean { return  this.matchPositions.get( matchToken )?.has(pos) ?? false}
    isEOF() { return ( this.p.pos >= this.p.input.length ) }
    isBoF() { return ( this.p.pos === 0 ) }
    isWS( s: ParseFuncScope<L,T,U> ): boolean {
        const iMatcher = s.matchers ? s.matchers[s.matchers.length -1] : { key: '__undef__', keyExt: '__undef__' }
        return ( ! this.p.inclAlwaysInDebug && iMatcher && ( iMatcher.key === this.p.always || iMatcher.keyExt!.startsWith(this.p.always + '.') ) ) 
    }

    // Parser entry point
    reset( inputStr: string ) {
        try {
            this.p.input        = inputStr
            this.p.line         = 1
            this.p.col          = 1 
            this.p.bol          = 0 
            this.p.pos          = 0
            this.p.firstSymbol  = true
            // this.p.prevToken    = '__undef__'
            this.result         = new Map<string, MatchRecordExt<T>>()
            this.p.ignoreWS     = false
            this.matchPositions = new Map<string, Map<number,number>> ()
            if ( this.always?.length > 0 && ! this.rules.PRMap.has(this.always as T) ) {
                throw Error(`reset(): The always token '${this.always}' is not defined in the parser rules`)
            }
            this.alwaysExpect = this.rules.PRMap.get(this.always as T) ! satisfies ExpectMap<T,U>
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
        hasIMatcher = true 
    ) {
        try {
            assert( this.rules.PRMap.has( token ),`Parse(): Unknown parser token: '${token}'`)
            if  ( this.isEOF() ) return

            // Setup firstSymbol 
            const _firstSymbol = this.p.firstSymbol 
            this.p.firstSymbol = false
              
            // Create the ParseFuncScope
            const s = parseFuncFac( token, this.p, parent, hasIMatcher ) satisfies Sealed<ParseFuncScope<L,T,U>, 'eMap' | 'mRec' | 'iMatcher' | 'logic'>
            this.reverseIdx.push(s.iMatcher.id)
            this.result.set(s.iMatcher.id, s.mRec)

            // Setup topToken and topNode
            if ( ! this.topNode ) {
                this.topToken = token
                this.topNode = s.iMatcher.id
            }

            // Initial checks 
            if ( this.isTried( s.mRec.tokenExt, s.isc.goingInPos ) ) {     
                s.iMatcher.status.push('alreadyMatched')
                s.iMatcher.retry = false
                    this.msg({
                        level: s.isc.level+1,
                        color: 'gray',
                        text:   `Parse(L${s.isc.level}) Skips ${token} at ${s.isc.goingInPos} (tried already)`
                    })
                return s.iMatcher  
            }
            else {
                this.msg({
                    level: s.isc.level+1,
                    color: 'blue',
                    text:   `${ s.isc.roundTrips > 1 ? 'RETRY' : 'TRY'} Non-Terminal: ${token}(L${s.isc.level},R${s.isc.roundTrips}) at ${s.isc.goingInPos}`
                })
            }
            
            this.setMatchPos(s.mRec.tokenExt, s.isc.goingInPos, s.isc.level, 'parse()')
            s.mRec.offsets.push(this.p.pos)

            // Main loop 
            this.parseExpect(s)  
            if ( ! s.iMatcher.matched ) {
                // Reset the match position
                this.resetMatchPos(s.mRec.tokenExt, s.isc.goingInPos, s.isc.level)
            }
            else {
                this.prevMatch = s.iMatcher.regexp!
            }
            // Call recursively on retry
            if ( s.iMatcher.matchCnt > 0 && s.iMatcher.retry ) {
               // Update parent state for recursive call
                s.iMatcher.roundTrips = ++s.isc.roundTrips  
                s.isc.goingInPos = this.p.pos
                s.isc.parentId = s.iMatcher.id
                this.parse( token, s, false )
            }
        }
        catch(err) {
            console.error(err)
            throw err
        }
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
    
            let count = this.matchPositions.get( matchToken)?.get(pos) ?? 0
            if ( ! this.matchPositions.has(matchToken) ) {
                this.matchPositions.set( matchToken, new Map<number,number>() )
            }    
            this.matchPositions.get( matchToken)!.set(pos, ++count)
        }
        catch (err) {   
            console.error(err)
            throw err
        }
    }

    //
    // Checks
    //
    chkBreakOn( breakOn : Breaks<T> ): boolean {
        let   matched = false
        try {
            if ( breakOn.breakOnPPGT.length > 0  ) {
                for ( const exp of breakOn.breakOnPPGT ) {
                    // LookBack
                    if ( this.prevMatch.toString() === exp.toString() ){
                        this.msg({
                            level: breakOn.level+1,
                            color: 'red',
                            text:   `BreakOn on prevMatch for '${breakOn.token}'` + ': ' + exp.toString()
                        })
                        matched = true
                        break
                    }
                    else {
                        // lookAhead
                        const res: XRegExp.ExecArray | null = XRegExp.exec(this.p.input, exp, breakOn.lastPos, 'sticky' )
                        if ( res !== null ) {
                            this.msg({
                                level: breakOn.level+1,
                                color: 'red',
                                text:   `BreakOn on lookAhead for '${breakOn.token}'` + ': ' + exp.toString()
                            })
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
        }
        catch (err) { 
            console.error(err)
            throw err 
        }       
        return matched
    }

    
    
    tryNextExpectToken = (s: ParseFuncScope<L,T,U>): ValidationRT => {
        let tryNext: ValidationRT = { ok: true, err: '' }
        try {
            const iMatcher = s.matchers[s.matchers.length-1]
            const [min, max] = getMulti( iMatcher.multi )
            
            if ( s.iMatcher.branchFailed() && min > 0 ) {
                tryNext = { ok: false, err: 'Branch Failed' }
                // iMatcher.failed = iMatcher.roundTrips == 1 ? true :false
            }
            else if ( iMatcher.matchCnt > max ) {
                tryNext = { ok: false, err: 'Max allowed matches exceded' }
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
                        tryNext = { ok: false, err: 'Min allowed matches not reached' }
                        // if ( iMatcher.roundTrips == 1 ) iMatcher.failed = true
                    }
                }
            }
            // s.iMatcher.retry = tryNext.ok
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
    resetMatchPos( matchToken: string, offset: number, level: number): void {
        try {
            assert( matchToken && ! _.isEmpty(matchToken) , `failAlreadyMatched() got an undefined token name: '${matchToken}'`)
        
            const matchNames = _.merge( [ matchToken ], this.nameResolution.get(matchToken) )
            for ( const name of matchNames ) {
                const _ret = this.matchPositions.get(name)?.delete(offset)
                if ( _ret ) this.msg( {
                    level: level,
                    color: 'red',
                    text: `Delete Match Position: ${offset} for "${name}" -> ${_ret}`
                })
            }
        }
        catch (err) { 
            console.error(err)
            throw err 
        }
    }

    resetFailedMatch( id: string, errMsg = '', level: number): void {
        try {
            const ent = this.result.get(id)
            assert( ent !== undefined && ent.tokenExt !== undefined,  `failBranch() got an undefined result entry or tokenExt for ${JSON.stringify(ent ?? {}, undefined, 2)}`)
            let i = 0
            let offset: number | undefined = 1000000
            while( ( offset = ent.offsets.at(--i) ) ) {
                this.resetMatchPos(ent.tokenExt, offset, level)
                ent.mached = false
                ent.matchCnt = 0
                ent.matchErr = `BackTrack due to: ${errMsg}`
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

                if ( iMatcher.keyExt === 'arrElement.arrAssign' ) {
                    this.debugHook = 1
                }
                this.msg({
                    level: level+2,
                    color: 'gray',
                    text: `NO MATCH for ${iMatcher.keyExt}(L${level},R${iMatcher.roundTrips}) - adjust pos ${this.p.pos} to ${iMatcher.offsets.at(0)} - (caller: ${_caller})`
                })  
                // Reset the match position
                let idx =  0
                let ident: string | undefined = ''
                while( ( ident = this.reverseIdx.at(--idx) )  && ident >= id ) {
                    this.resetFailedMatch( ident, errMsg, level+2  )  
                } 
                // Remove any additional direct preceding white space
                while ( ( ident = this.reverseIdx.at(idx) )  && ( this.result.get(ident)?.ws ?? false ) ) {
                    this.resetFailedMatch( ident, errMsg, level+2  )
                    --idx
                }
                this.p.pos = iMatcher.offsets[0]
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
            const iMatcherCurr = s.matchers[s.matchers.length -1]

            // Call the parser with the always token
            const hasIMatcher = false
            this.parse( this.always as T, s, hasIMatcher )

            s.isc.goingInPos = this.p.pos
            iMatcherCurr.offsets.push(this.p.pos)
            }
        catch (err) { 
            console.error(err)
            throw err 
        }
    }

    // Procedure to match a regexp
    doMatch( s: ParseFuncScope<L,T,U>, matchRec: MatchRecord<T> ):  ValidationRT  {
        let ret = { ok: false, err: 'No Match' }
        try {
            // Initialize
            const iMatcher = s.matchers.at(-1)!
            matchRec.offsets.push(this.p.pos)
            const level = s.mRec.level

            // Run the iMatcher RegExp 
            const offset = iMatcher.offsets.at(-1)!
            const res: XRegExp.ExecArray | null = XRegExp.exec(this.p.input, iMatcher.regexp!, offset, 'sticky' )
            this.setMatchPos( iMatcher.keyExt, offset, level ,'doMatch()' )
            // iMatcher.offsets.push(this.p.pos) 
            //
            // Handle the match, that is any non-null result
            // 
            if ( res !== null ) {
                this.msg({
                    level: s.isc.level+2,
                    color: 'green',
                    text: `MATCHED: ${iMatcher.key} at pos: ${this.p.pos} to ${iMatcher.regexp!.lastIndex}, matched: "${this.p.input.substring(this.p.pos,iMatcher.regexp!.lastIndex)}"`
                    })  

                if (iMatcher.key === 'STR' ) {
                    this.debugHook = 1
                }
 
                // Update regex math-position
                this.p.pos = iMatcher.regexp!.lastIndex
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
                matchRec!.type       = iMatcher.key 
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
                this.prevMatch = iMatcher.regexp!
                ret = { ok: true, err: '' }
            }
            return ret
        } catch(err) { 
            console.error(err)
            throw err           
        }
    }

    matchTerminal(  s: Sealed<ParseFuncScope<L,T,U>, 'eMap' | 'mRec' | 'isc'> ): void {
        try {
            // TERMINAL SYMBOLS
            // RHS INNER LOOP for regexp matching
            const iMatcher = s.matchers.at(-1)!
            const matchRec: MatchRecord<T> = matchRecFac(s, this.p, iMatcher)
            // Special handling for mem of white space tokens
            if ( iMatcher.key === this.always || ( iMatcher.keyExt?.startsWith(this.always + '.') ?? false ) )  matchRec.ws = true
            if ( ! matchRec.ws && iMatcher.parentId ) {
                matchRec.ws = this.result.get(iMatcher.parentId)!.ws
            }

            this.reverseIdx.push(matchRec.id)
            this.result.set(matchRec.id, matchRec)

            if ( ! this.isWS(s) ) {
                const inpSubstr = this.p.input.substring( this.p.pos, this.p.pos + 30 )
                this.msg({
                    level: s.isc.level+1,
                    color: 'cyan',
                    text: `TRY: ${iMatcher.keyExt}(L${s.isc.level}) at ${this.p.pos} against: "${inpSubstr}"`
                })
            }

            // Main Match loop for terminal symbols
            let matchCnt = 0
            do {
                // match = { foundToken: false, foundSubToken: false, id: undefined, doBreak: false , ignore: false};
                if ( ! this.isWS(s) ) {
                    // Remove leading white space
                    if ( s.eMap.rootKey !== this.always) {
                        this.removeWS(s)
                    }
                    if ( matchCnt > 0 ) {    
                        this.msg({     
                            level: s.isc.level+2,       
                            color: 'cyan',  
                            text: `RETRY Terminal: ${iMatcher.keyExt}(L${s.isc.level},R${s.isc.roundTrips}) at ${this.p.pos} against: "${this.p.input.substring(this.p.pos,this.p.pos + 30).replace(/\n.*/mg, '')}"`     
                        })
                    }
                }
                iMatcher.tries += 1 
                if ( s.eMap.rootKey !== this.always && matchCnt > 0 ) {
                    if ( this.chkBreakOn( {
                        level: s.isc.level,
                        roundTrips: s.isc.roundTrips,
                        idx: s.iMatcher.idx,   
                        lastPos: this.p.pos,
                        token: iMatcher.key as T,
                        breakOnPPGT: iMatcher.breaks ?? []
                    }) ) break 
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
                        if ( ! logicChk.ok ) s.iMatcher.setStatus('branchFailed', logicChk.err ?? `Logic group failed for ${iMatcher.keyExt}`)

                        // if the matched object RegExp name has a corresponding 
                        // LHS Parser entry with an expect group
                        // If new match group(s), then call parse() recursively
                        if ( this.validation.matched(s, this.p.pos) && this.rules.PRMap.has(iMatcher.key as T) ) {
                            // If the matched Lexer object has a parser LHS non-terminal entry of its own of the same name, then call it
                            this.msg({
                                level: s.isc.level+1,
                                color: 'cyan',
                                text: `Terminal symbol has own matcher, so call: ${iMatcher.key}`
                            })
                            const hasIMatcher = false
                            this.parse( iMatcher.key as T , s, hasIMatcher )
                        }
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
                    level: s.isc.level+1,
                    color: 'cyan',
                    text: `TRY_END: ${iMatcher.key}(L${s.isc.level},R${s.isc.roundTrips}), matchCnt: ${matchRec.matchCnt}`
                })
            }
            // Check if the match count is within the cardinality constraints
            if ( ! this.validation.matchInRange( iMatcher ).ok ) {
                this.resetFailedIMatcher(iMatcher, matchRec, s.iMatcher.errors.at(-1), s.isc.level, 'matchTerminal()')
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

    parseExpect( s: ParseFuncScope<L,T,U> ): void {
        try {
            //
            // Iterate over the expect array
            //
            let eMapCnt   = 0
            let tryNext = { ok: false, err: '' }
            let anyMatch = false
            s.eMap.expect.every( ( _iMatcher: InternMatcher<T,U>, idx: number ) => { 
                eMapCnt++
                if ( this.isEOF() ) return false
                
                const iMatcherRaw = _.cloneDeep(_iMatcher) satisfies InternMatcher<T,U>
                assert( iMatcherRaw !== undefined, `eMap.expect.every(): Undefined iMatcher in 'expect array'`)
                assert((iMatcherRaw.key !== s.isc.token || idx > 0), Colors.red(`Left recursive reference: ${iMatcherRaw.key} to own parent token position 0` ))

                s.matchers.push(iMatcherRaw)

                const iMatcher = iMatcherFac('parseExpect', s, idx, this.p )
  
                // if ( this.isEOF() ) return tryNext.ok
                // Handle TERMINAL SYMBOLS
                if ( iMatcher.regexp ) {
                    if ( this.chkBreakOn( {
                        level: s.isc.level,
                        roundTrips: s.isc.roundTrips,
                        idx: s.iMatcher.idx,   
                        lastPos: this.p.pos,
                        token: iMatcher.key as T,
                        breakOnPPGT: iMatcher.breaks ?? []
                        }) 
                    ) return false
                    this.matchTerminal( s )
                    anyMatch = (anyMatch || iMatcher.matchCnt > 0 )
                }
                else  {
                    // Handle NON-TERMINAL SYMBOLS
                    this.parse( iMatcher.key as T, s, true)
                    if ( iMatcher.keyExt === 'assign4Real.rhsAssign' ) {
                        this.debugHook = 1
                    }
                    anyMatch = ( anyMatch || ( iMatcher.matchCnt > 0 ) ) ?? false
                }

                // To continue the loop, we need to have a match (if mandatory) and not have failed mandatory branch 
                tryNext   = this.tryNextExpectToken(s)

                if ( s.isc.token !== this.always ) {      
                    this.msg({
                        level: s.isc.level+1,
                        color: 'gray',
                        text: `TRY NEXT after ${iMatcher.keyExt}(L${s.isc.level},R${s.isc.roundTrips}): ${tryNext.ok}`
                    })  
                }
                return tryNext.ok
            }); // End of expect.every()

            // Validate all iMachers in the expect array 
            const optimistic = this.isEOF()
            // The whole loop has been completed successfully or validates according to the parser rules
            // const validBranch = ( ( tryNext.ok || optimistic ) && eMapCnt === eMapLen )  || this.validation.validExpect( s, optimistic )
            const validBranch = this.validation.validExpect( s, optimistic )

            if ( validBranch ) {
                // We have validated the expect array and we are ok
                // Any failed terminals or sub-branch non-terminals within the expect array 
                // are not mandatory on this level, so they can be ignored
                if ( s.isc.token !== this.always ) {
                    this.msg({ 
                        level: s.isc.level+1,
                        color: 'green',
                        text: `BRANCH MATCHED for ${s.isc.token} (L${s.isc.level},R${s.isc.roundTrips})`
                    }) 
                }
                if ( s.isc.token === 'rhsAssign' ) {
                    this.debugHook = 1
                }
                s.iMatcher.status = [ 'matched' ]
                s.iMatcher.matched = true
                if ( anyMatch ) {
                    s.iMatcher.matchCnt += 1
                    s.iMatcher.retry = true
                }
            }
            else {
                if ( s.isc.token !== this.always ) { 
                    this.msg({
                        level: s.isc.level+1,
                        color: 'yellow',
                        text: `BRANCH FAIL for ${s.isc.token} (L${s.isc.level},R${s.isc.roundTrips})`
                    })
                }
                s.iMatcher.retry = false
                // const resetPos = s.mRec.newPos > s.mRec.offset ? s.mRec.newPos : s.mRec.offset
                // this.resetFailedBranch(s, undefined, s.matchers.at(-1)?.offsets ?? [], s.iMatcher.errors.at(-1), s.isc.level, 'parseExpect()')
                this.resetFailedBranch(s, s.iMatcher.errors.at(-1), s.isc.level, 'parseExpect()')
                if ( s.iMatcher.roundTrips === 1 ) s.iMatcher.status = [ 'branchFailed' ]
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

    getParseTree( excludeAlways = false ): MatchRecord<T>[] {
        const res: MatchRecord<T>[] = []
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