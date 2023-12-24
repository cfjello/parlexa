// @deno-types='https://deno.land/x/xregexp/types/index.d.ts'
// import XRegExp from  'https://deno.land/x/xregexp/src/index.js'

import * as  z  from "https://deno.land/x/zod@v3.22.4/mod.ts"
import { Logic } from "./Logic.ts";

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

// The output representation from the parser
export type MatchRecord<T> = {
    level:      number,
    id:         string,
    ident?:     string, 
    type:       string,
    token?:     T,
    value:      number | string,
    tokenExt:   string,
    tokenStr:   string,
    text:       string,
    offset:     number,
    newPos:     number,
    ofLen:      number,
    line:       number,
    col:        number,
    matched:    boolean,
    matchCnt:   number,
    matchErr?:  string,
    xor?:       XorGroup[],
    xorMatched?: boolean,
    ignore?:    boolean,
    parentId:   string,
    children:   string[]
}

export type MatchRecordSealed<T> = Required<MatchRecord<T>> 

// deno-lint-ignore no-explicit-any
export type GenericObject = { [key: string]: any }
export type MatchRecordExt<T> = MatchRecord<T> & GenericObject

export type Matched = { 
    foundToken:     boolean, 
    foundSubToken:  boolean, 
    id?:            string, 
    ignore:         boolean,
    doBreak:        boolean
} 

export type MRecIterator<T> = { value: MatchRecord<T>, done: boolean }

export type Info<T> = {
    line:     number,
    col:      number,
    result:   Map< string, MatchRecord<T>>,
    nextIdx:  number,
    ignoreWS: boolean,
    initState: T
}

//
// Lexer and Parser type integration magic
// 
export type Cardinality = `${0|1}:${(number|'m')}`
// deno-lint-ignore no-explicit-any
export type Callback =  ( m: MatchRecord<any>, s: any) => MatchRecordExt<any> 

export interface Matcher<T> {
    match  : RegExp,
    multi? : Cardinality,
    logic?:  Logical,
    ignore?: boolean,
    cb?    : Callback
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

export type BreaksT<T> = {
    token:      T,
    roundTrips: number,
    idx:        number, 
    level:      number,
    lastPos:    number,
    breakOnPPGT: RegExp[],
    startOnPPGT: RegExp[],
    eMap:        ExpectMap<T>,
    debug?:      boolean
}


// The internal representation within the parser
export type InternMatcher<T> = {
    key:        string, 
    id:         string,
    idx:        number,
    multi:      Cardinality, 
    breaks?:    BreaksT<T>,
    roundTrips: number,
    tries:      number,
    matchCnt:   number,
    logic:      Logical,
    logicGroup: number,
    logicIdx:   number,
    logicLast:  boolean,
    ignore?:    boolean, 
    type:       string,
    regexp?:    RegExp,
    lRRef:      RegExp | Matcher<T>,
    cbLex?:     Callback,
    cb?:        Callback,
    parentId?:  string,
    keyExt?:    string,
    logicApplies: boolean,
    matched:    boolean,
    failed:     boolean
}

export type InternMatcherExt<T> = InternMatcher<T> & {  
    token:      T, 
    level:      number,  
    min:        number,
    max:        number,
    offset:     number,
    newPos:     number
}
/*
export type Required<T> = {
    [P in keyof T]-?: T[P]
}
*/

export type Sealed<T, K extends keyof T> = T & { [P in K]-?: T[P] }

export type InternMatcherSealed<T> = Sealed<InternMatcherExt<T>, 'ignore'| 'regexp' | 'parentId' | 'keyExt' | 'breaks'>

// The internal representation within the parser
export type ExpectMap<T>       = {
    rootKey:    string,
    multi:      Cardinality,
    min:        number,
    max:        number,
    line?:      boolean,
    startOn?:   Array<RegExp>,
    breakOn?:   Array<RegExp>,
    startOnStr?: Array<string>,
    breakOnStr?: Array<string>,
    expect:     Array<InternMatcher<T>> 
    cb?:        Callback, 
}
// deno-lint-ignore no-explicit-any
export type LexerRules  = Record<string, RegExp | Matcher<any>>

export const logicOpers = [ 'or', 'xor', 'ignore', 'NOP', 'none' ] as const 
// export type Logical     = typeof logicOpers[number] // This is the typescript magic that makes the integration work
export type Logical     =  'or' | 'xor' | 'ignore' | 'NOP' | 'none' 
// 

export type Expect<T> = { 
    multi?: Cardinality, 
    line?:  boolean,
    startOn?: Array<RegExp | Matcher<T>>,
    breakOn?: Array<RegExp | Matcher<T>>,
    expect: Array<ExpectEntry<T>>, 
    cb?:    Callback  
}

export type ShortExpectEntry<T> = Array< Matcher<T> | RegExp | T | Cardinality | Logical | Callback >
export type ExpectEntry<T>      = ShortExpectEntry<T> | Matcher<T> | RegExp | T
export type MatchEntry<T>       = Matcher<T> | RegExp | T | Array<Matcher<T> | T | Cardinality>
export type ParserRules<T>      = Record<string, Expect<T>>

// 'BOL' | 'BOF' | 
export type Keys<G,L>       = G | L | 'NOP' | '__undef__' | 'unknown' | 'init'
// export func = () => typeof P
export type ArrToObject<A extends readonly string[], E> = {
    [K in A[number]]: E;
}

// export type ParserRules2<A,L> = Record<Keys< ArrToObject<A>, typeof L>, Expect<T>>
export interface ArgsObject {
  [key: string]: string
}

export type StartOnRS = { active: boolean, ok: boolean, match: string }

export const parseArgsSchema = z.object({
    tokenStr:   z.string().default('__undef__'),
    parentId:   z.string().default('__undef__'),
    level:      z.number().default(1),
    roundTrips: z.number().default(1),
    goingInPos: z.number().default(0),
    breakOnPPGT: z.array(z.string()).default([]),                  
    startOnPPGT: z.array(z.string()).default([]),
})  
export type ParseArgs = z.infer<typeof parseArgsSchema> 

export const doMatchRet = z.object({
    foundToken:     z.boolean().default(false),
    id:             z.string().default('__undef__'),
    ignore:         z.boolean().default(false),
    foundSubToken:  z.boolean().default(false),
    doBreak:        z.boolean().default(false)
})
export type DoMatchRet = z.infer<typeof doMatchRet>

export type ParseFuncState<T> = {
    token:       T,
    eMap:        ExpectMap<T>,
    isc:         ParseArgs,
    // iMatcher:    InternMatcherSealed<T>,
    mRec:        MatchRecord<T>
    logic:       Logic,
    matchers:    InternMatcherSealed<T>[],
    funcRet:     parserReturnT<T>,
}


/*
export type parserScopeT<T> = {
    isc: parseArgsT<T>, 
    eMap: ExpectMap<T>, 
    iMatcher: InternMatcherR<T>, 
    mRec: MatchRecordExt<T>, 
    logic: Logic, 
    breakOn: Breaks<T>, startOn: StartOnRS, 
}
*/
/*
export class BreakOnFac<T> {
    constructor(
        public token:   T,
        public roundTrips: number,
        public idx:     number, 
        public level:   number,
        public lastPos: number,
        public breakOnPPGT: RegExp[],
        public startOnPPGT: RegExp[],
        public eMap: ExpectMap<T> ) {}
}
*/
// type BreakOnT = typeof BreakOnFac

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
export type retValuesT = typeof retValues[number]
export type ValidationRT = { ok: boolean, err: string | null }

export type retValuesArrayT = Array<retValuesT>
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
export type ParseArgsS = {
    token:      string, 
    parentId:   string, 
    level:      number, 
    roundTrips: number, 
    breaks:     BreakOnS
}

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

