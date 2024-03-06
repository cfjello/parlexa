// @deno-types='https://deno.land/x/xregexp/types/index.d.ts'
// import XRegExp from  'https://deno.land/x/xregexp/src/index.js'

import * as  z  from "https://deno.land/x/zod@v3.22.4/mod.ts"
import { Logic } from "./Logic.ts";
import { Parser } from "./Parser.ts";
import { XRegExp } from "./imports.ts";

export interface IIndexable<T> { [key: string]: T }

// Debug types
export const colorNames = [ 'none', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white', 'gray', 
    'bgRed', 'bgGreen', 'bgYellow', 'bgBlue', 'bgMagenta', 'bgCyan', 'bgWhite',
    'bgBrightRed', , 'bgBrightGreen', , 'bgBrightYellow', 'bgBrightBlue', 'bgBrightMagenta', 'bgBrightCyan' ] as const
export type Color = typeof colorNames[number]

export const debugArgs = {
    level: 0, 
    color:'none' as Color, 
    text: '__debug was here__'
}

export type DebugArgs = typeof debugArgs
export type DebugLogFunc = (args: DebugArgs) => unknown

export class XorGroup {
    matched: boolean[] = []
    constructor( public start = 0, public end = 0) {}
    isMatched =  () => {
        let trueCount = 0 
        this.matched.forEach(( m, _i) => {
                trueCount += m ? 1 : 0
            })
           return trueCount ===  1 
        }
}

export const logicOpers = [ 'or', 'xor', 'ignore', 'NOP', 'none' ] as const 
export type Logical     = typeof logicOpers[number] // This is the typescript magic that makes the integration work

// The output representation from the parser
export type MatchRecord<T extends string> = {
    level:      number,
    id:         string,
    ident?:     string, 
    type:       string,
    token:      T,
    value:      number | string,
    tokenExt:   string,
    text:       string,
    ws:         boolean,
    // offset:     number,
    offsets:    number[],   
    // newPos:     number,
    ofLen:      number,
    line:       number,
    col:        number,
    matched:    boolean,
    matchCnt:   number,
    matchErr?:  string,
    xor?:       XorGroup[],
    xorMatched?: boolean,
    ignore?:    boolean,
    parent?:    string, 
    parentId:   string,
    children:   string[]
}

// export type MatchRecordSealed<T> = Required<MatchRecordT> 

// deno-lint-ignore no-explicit-any
export type GenericObject = { [key: string]: any }
export type MatchRecordExt<T extends string> = MatchRecord<T> & GenericObject


export type Matched = { 
    foundToken:     boolean, 
    foundSubToken:  boolean, 
    id?:            string, 
    ignore:         boolean,
    doBreak:        boolean
} 

export type MRecIterator<T extends string> = { value: MatchRecord<T>, done: boolean }

export type Info<T extends string> = {
    line:     number,
    col:      number,
    result:   Map< string, MatchRecord<T> >,
    nextIdx:  number,
    ignoreWS: boolean,
    initState: string
}

//
// Lexer and Parser type integration magic
// 

export type Cardinality = `${0|1}:${(number|'m')}`

/// deno-lint-ignore no-explicit-any
export type Callback<T extends string,U> =  ( m: MatchRecordExt<T>, s: U) => MatchRecordExt<T> | undefined

export type  Matcher<T extends string,U> = {
    match  : RegExp,
    multi? : Cardinality,
    logic?:  Logical,
    ignore?: boolean,
    cb?    : Callback<T,U>
}

export type LogicDescriptor = {
    key:        string,
    logic:      Logical,
    group:      number,
    idx:        number,
    matched:    boolean,
    roundTrip:  number,
    tries:      number,
    matchCnt:   number
}


export type Breaks<T> = {
    token:      T,
    roundTrips: number,
    idx:        number, 
    level:      number,
    lastPos:    number,
    breakOnPPGT: RegExp[],
    // eMap:        ExpectMap<T>,
    debug?:      boolean
}

// Args for iMatcherInit()
export type callerIM = 'parseNT' | 'parseExpect' | 'reset'

export type InternMatcherArgs<L extends string,T extends string,U> = {
    caller: 'parseExpect' | 'parseNT' | 'reset',
    s:      ParseFuncScope<L,T,U>,
    idx:    number, 
}

// The internal representation within the parser
export type InternMatcher<T extends string,U> = {
    token:      T,
    key:        string, 
    id:         string,
    idx:        number,
    multi:      Cardinality, 
    breaks:     RegExp[],
    roundTrips: number,
    tries:      number,
    matchCnt:   number,
    logic:      Logical,
    logicGroup: number,
    logicIdx:   number,
    logicLast:  boolean,
    ignore:     boolean, 
    type:       string,
    regexp?:    RegExp,
    cbLex?:     Callback<T,U>,
    cb?:        Callback<T,U>,
    parent?:     string,
    parentId?:  string,
    keyExt?:    string,
    logicApplies: boolean,
    matched:    boolean,
    // failed:     boolean
}

export type InternMatcherExt<T extends string,U> = InternMatcher<T,U> & {  
    token:      T, 
    level:      number,  
    min:        number,
    max:        number,
    offsets:    number[],
    // newPos:     number,
    status:     retValuesArrayT,
    retry:      boolean,    
    errors:     string[],
    branchFailed: () => boolean,
    setStatus: ( s: retValuesT, errMsg: string ) => void   
}


export type retValuesArrayT = Array<retValuesT>
/*
export type parserReturnT<T> = MatchRecord<T> & {
    status:     retValuesArrayT, 
    tokenStr:   string,
    level:      number,
    roundTrips: number,
    min:        number,
    max:        number,
    retry:      boolean,    
    errors:     string[],
    branchFailed: () => boolean,
    setStatus: ( s: retValuesT, errMsg: string ) => void        
}
*/
/*
export type Required<T> = {
    [P in keyof T]-?: T[P]
}
*/


export type Sealed<T, K extends keyof T> = T & { [P in K]-?: T[P] }

export type InternMatcherSealed<T extends string,U> = Sealed<InternMatcherExt<T,U>, 'ignore'| 'keyExt' | 'breaks'>

// The internal representation within the parser
export type ExpectMap<T extends string, U>       = {
    rootKey:        T,
    multi:          Cardinality,
    min:            number,
    max:            number,
    breaks:         Array<RegExp>,
    // startOnStr?:    Array<string>,
    breakOnStr:     Array<string>,
    expect:         Array<InternMatcher<T,U>> 
    cb?:            Callback<T,U>, 
}


export type ShortEntryKey<T>    = RegExp | T 
export type ShortExpectEntry<T extends string,U> = ShortEntryKey<T> | Cardinality | Logical | Callback<T,U>
export type ExpectEntry<T extends string,U>      = Array<ShortExpectEntry<T,U>> | Matcher<T,U>

export type Expect<T extends string,U> = { 
    multi?: Cardinality, 
    // line?:  boolean,
    breakOn?: Array<RegExp>, //  | Matcher<T,U>>,
    expect: Array<ExpectEntry<T,U>>, 
    cb?:    Callback<T,U>  
}

export type ParserRules<T extends string, U> = Partial<Record<T, Expect<T,U>>>
// export type ParserFields<T extends string, L extends string> = Record< T, string> 
// export type LHS<P extends string, L extends string> = ParserFields<P,L>
// export type ParserRules<T extends string, U> = Record< T, Expect<T,U>>  
export type LexerRules<T extends string, U> = Record< T, RegExp | Matcher<T,U> > 

/*
export type ShortExpectEntry<T> = Array< MatcherT<T> | RegExp | T | Cardinality | Logical | Callback >
export type ExpectEntry<T>      = ShortExpectEntry<T> | MatcherT<T> | RegExp | T
export type MatchEntry<T>       = MatcherT<T> | RegExp | T | Array<MatcherT<T> | T | Cardinality>
*/
// export type ParserTokens = z.infer<typeof ZT.allTokens>
/// export type ParserRules<T extends string, U>     = Record<T, Expect>  

// 'BOL' | 'BOF' | 
/*
export type Keys<G,L>       = G | L | 'NOP' | '__undef__' | 'unknown' | 'init'
// export func = () => typeof P
export type ArrToObject<A extends readonly string[], E> = {
    [K in A[number]]: E;
}

// export type ParserRules2<A,L> = Record<Keys< ArrToObject<A>, typeof L>, Expect<T>>
export interface ArgsObject {
  [key: string]: string
}
*/ 
export type ParseArgs<T extends string> = {
    token:      T, 
    parentId:   string, 
    parentIdx:  number,
    level:      number, 
    roundTrips: number, 
    breaks:     Array<RegExp>,
    goingInPos: number
}

export type ParseFuncScope<L extends string, T extends string, U = unknown> = {
    pRef:       Parser<L,T,U>,
    isc:        ParseArgs<T>, 
    eMap:       ExpectMap<T,U>, 
    iMatcher:   InternMatcherExt<T,U>, 
    mRec:       MatchRecordExt<T>, 
    logic:      Logic, 
    breaks:     Array<RegExp> 
    matchers:   Array<InternMatcherSealed<T,U>>,
}

/*
export class BreaksFac<T> {
    constructor(
        public token:   T,
        public roundTrips: number,
        public idx:     number, 
        public level:   number,
        public lastPos: number,
        public breakOnPPGT: RegExp[],
        // public startOnPPGT: RegExp[],
        // public eMap: ExpectMap<T,U> 
    ) {}
}
*/

export const retValues = [ 
    'matched', 
    'EOF',
    'branchFailed',
    'parserFailed',
    'breakOnFound',
    'alreadyMatched', 
    'MatchOutOfRange',
    'logicGroupFailed',
    '__unknown__' 
] as const
export type retValuesT    = typeof retValues[number]
export type ValidationRT  = { ok: boolean, err: string }
export type ValidationMap = Map<number, ValidationRT>

/*
export type parserReturnT<T> = { 
    id:         string,
    offset:     number,
    status:     retValuesArrayT, 
    token:      T,
    tokenStr:   string,
    tokenExt:   string,
    level:      number,
    roundTrips: number,
    min:        number,
    max:        number,
    matches:    number,
} 
*/




/*
export class parseArgsD implements ParseArgsS { 
    constructor( 
        public token: string, 
        public parentId = '__undefined__', 
        public level = 1, 
        public roundTrips = 1, 
        public breaks: BreakOnS
        ) {}
} 

export type parseFuncScopeT = {
    args:       ParseArgsS,
    breaks:     BreakOnS
}
*/

