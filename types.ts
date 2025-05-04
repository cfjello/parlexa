// @deno-types='https://deno.land/x/xregexp/types/index.d.ts'
// import XRegExp from  'https://deno.land/x/xregexp/src/index.js'
import { Logic } from "./Logic.ts";
import { Parser } from "./Parser.ts";

export interface IIndexable<T> { [key: string]: T }

// Debug types
export const colorNames = [ 'none', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white', 'gray', 
    'bgRed', 'bgGreen', 'bgYellow', 'bgBlue', 'bgMagenta', 'bgCyan', 'bgWhite',
    'bgBrightRed', , 'bgBrightGreen', , 'bgBrightYellow', 'bgBrightBlue', 'bgBrightMagenta', 'bgBrightCyan' ] as const
export type Color = typeof colorNames[number]

export type DebugArgs<T extends string ,U> = {
    oper: string,
    iMatcher:  InternMatcherExt<T,U> | undefined,
    level: number, 
    color: Color, 
    text: string
}
export type DebugLogFunc<T extends string,U> = (args: DebugArgs<T,U>) => unknown

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

export type TypeVal = 'terminal' | 'non-terminal' | 'regexp' | 'matcher' | 'unknown'

// The output representation from the parser
export type MatchRecord<T extends string> = {
    level:      number,
    id:         string,
    ident?:     string, 
    type:       TypeVal,
    token:      T,
    value:      number | string,
    tokenExt:   string,
    text:       string,
    ws:         boolean,
    offsets:    number[],   
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
export type Callback<T extends string,U> =  ( m: MatchRecordExt<T>, u: U) => void

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
    // roundTrip:  number,
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
    startOn:    RegExp[],
    // eMap:        ExpectMap<T>,
    debug?:      boolean
}

// Args for iMatcherInit()
export type callerIM = 'parse' | 'parseExpect' | 'reset' | 'matchTerminal' | 'removeWS'

export type InternMatcherArgs<L extends string,T extends string,U> = {
    caller: callerIM,
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
    breakIdx?:  number,
    starts:     RegExp[],  
    startIdx?:  number, 
    roundTrips: number,
    tries:      number,
    matchCnt:   number,
    logic:      Logical,
    logicGroup: number,
    logicIdx:   number,
    logicLast:  boolean,
    ignore:     boolean, 
    type:       TypeVal,
    regexp?:    RegExp,
    cbLex?:     Callback<T,U>,
    cb?:        Callback<T,U>,
    parentToken?: string,
    parentId?:  string,
    keyExt?:    string,
    logicApplies: boolean,
    matched:    boolean
    // failed:     boolean
}

export type InternMatcherExt<T extends string,U> = InternMatcher<T,U> & {  
    // token:      T, 
    level:      number,  
    min:        number,
    max:        number,
    offsets:    number[],
    status:     retValuesArrayT,
    retry:      boolean,    
    roundtripFailed: boolean,
    errors:     string[],
    branchFailed: () => boolean,
    branchMatched: () => boolean,
    setStatus: ( s: retValuesT, errMsg: string ) => void   
}


export type retValuesArrayT = Array<retValuesT>
export type ParseFuncReturns = 'EOF' | 'branchMatched' | 'branchFailed' | 'skipped' | 'parseMatched' | 'parseFailed' 


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
    starts:         Array<RegExp>,
    breakOnStr:     Array<string>,
    expect:         Array<InternMatcher<T,U>> 
    cb?:            Callback<T,U>, 
}


export type ShortEntryKey<T extends string,U>    = RegExp | T | Matcher<T,U>
export type ShortExpectEntry<T extends string,U> = ShortEntryKey<T,U>  | Cardinality  | Logical | Callback<T,U>
export type ExpectEntry<T extends string,U>      = Array<ShortExpectEntry<T,U>> | Matcher<T,U> | T | RegExp

export type Expect<T extends string,U> = { 
    multi?:     Cardinality, 
    breakOn?:   Array<RegExp>,
    startOn?:   Array<RegExp>,
    expect:     Array<ExpectEntry<T,U>>, 
    cb?:        Callback<T,U>  
}

export type ParserRules<T extends string, U> = Partial<Record<T, Expect<T,U>>>
export type LexerRules<T extends string, U> = Record< T, RegExp | Matcher<T,U> > 

export type ParseArgs<T extends string> = {
    token:      T, 
    caller:     callerIM,
    parentId:   string, 
    parentIdx:  number,
    level:      number, 
    roundTrips: number, 
    breaks:     Array<RegExp>,
    goingInPos: number
}

export type ParseFuncScope<L extends string, T extends string, U = unknown> = {
    pRef:       Parser<L,T,U>,
    args:       ParseArgs<T>, 
    eMap:       ExpectMap<T,U>, 
    iMatcher:   InternMatcherExt<T,U>, 
    mRec:       MatchRecordExt<T>, 
    logic:      Logic[], 
    breaks:     Array<RegExp>, 
    starts:     Array<RegExp>, 
    matchers:   Array<InternMatcherSealed<T,U>>,
    iMatchers:  Map<string, InternMatcher<T,U>>
    result:     Map<string, MatchRecordExt<T>>
}

export const retValues = [ 
    'matched', 
    'branchMatched',
    'parseMatched',
    'parseFailed',
    'notMatched',
    'skipped',
    'EOF',
    'branchFailed',
    'parserFailed',
    'breakOnFound',
    'alreadyMatched', 
    'MatchOutOfRange',
    'logicGroupFailed',
    'other' 
] as const
export type retValuesT    = typeof retValues[number]
export type ValidationRT  = { ok: boolean, msg: string }
export type ValidationMap = Map<number, ValidationRT>
