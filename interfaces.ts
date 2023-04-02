// @deno-types='https://deno.land/x/xregexp/types/index.d.ts'
import XRegExp from  'https://deno.land/x/xregexp/src/index.js'

export class XorGroup {
    matched: boolean[] = []

    constructor( public start = 0, public end = 0) {}

    isMatched =  () => {
        let trueCount = 0 
        this.matched.forEach(( m, i) => {
                trueCount += m ? 1 : 0
            })
           return trueCount ===  1 
        }
}

// The output representation from the parser
export type MatchRecord = {
    level:  number,
    id:     string,
    ident?: string, 
    type:   string,
    token?: string
    value:  number | string,
    text:   string,
    offset: number,
    newPos: number,
    ofLen:  number,
    line:   number,
    col:    number,
    matched? : boolean,
    matchErr?: string,
    xor?:   XorGroup[],
    xorMatched?: boolean,
    parent?: string,
    children: string[]
}

// deno-lint-ignore no-explicit-any
export type GenericObject = { [key: string]: any }
export type MatchRecordExt = MatchRecord & GenericObject

export type Matched = { 
    foundToken:     boolean, 
    foundSubToken:  boolean, 
    id?:            string, 
    ignore:         boolean,
    doBreak:        boolean
} 

export type MRecIterator = { value: MatchRecord, done: boolean }

export type Info<T> = {
    line:     number,
    col:      number,
    result:   Map< string, MatchRecord>,
    nextIdx:  number,
    ignoreWS: boolean,
    initState: T
}

//
// Lexer and Parser type integration magic
// 
export type Cardinality = `${0|1}:${(number|'m')}`
// deno-lint-ignore no-explicit-any
export type Callback<S=any> =  ( m: MatchRecord, s: S ) => MatchRecordExt 

export interface Matcher {
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


// The internal representation within the parser
export type InternMatcher = { 
    key:        string, 
    id:         string,
    multi:      Cardinality, 
    startOn?:    Array<RegExp>,
    breakOn?:    Array<RegExp>,
    roundTrip:  number,
    tries:      number,
    matchCnt:   number,
    logic:      Logical,
    logicGroup: number,
    logicIdx:   number,
    logicLast:  boolean,
    ignore?:    boolean, 
    type:       string,
    regexp?:    RegExp,
    lRRef:      RegExp | Matcher,
    cbLex?:     Callback,
    cb?:        Callback,
    parent?:    string,
    keyExt?:    string
}

// The internal representation within the parser
export type ExpectMap       = { 
    multi:      Cardinality,
    line?:      boolean,
    startOn?:   Array<RegExp>,
    breakOn?:   Array<RegExp>,
    startOnStr?: Array<string>,
    breakOnStr?: Array<string>,
    expect:     Array<InternMatcher> 
    cb?:        Callback, 
}
export type LexerRules  = Record<string, Matcher | RegExp >
export type Logical     =  'or' | 'xor' | 'NOP' | 'none' | 'ignore'

export type Expect<T> = { 
    multi?: Cardinality, 
    line?:  boolean,
    startOn?: Array<RegExp | Matcher>,
    breakOn?: Array<RegExp | Matcher>,
    expect: Array<ExpectEntry<T>>, 
    cb?:    Callback  
}

export type ShortExpectEntry<T> = Array<Matcher | RegExp | T | Cardinality | Logical | Callback>
export type ExpectEntry<T>      = ShortExpectEntry<T> | Matcher | RegExp | T
export type MatchEntry<T>       = Matcher | RegExp | T | Array<Matcher | T | Cardinality>
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

export type BreakOnS<T> = {
    token:      T,
    roundTrips: number,
    idx:        number, 
    level:      number,
    lastPos:    number,
    breakOnPPGT: RegExp[],
    startOnPPGT: RegExp[],
    eMap:        ExpectMap,
    debug?:      boolean
}

export class BreakOnFac<T> {
    constructor(
        public token:   T,
        public roundTrips: number,
        public idx:     number, 
        public level:   number,
        public lastPos: number,
        public breakOnPPGT: RegExp[],
        public startOnPPGT: RegExp[],
        public eMap: ExpectMap ) {}
}

type BreakOnT = typeof BreakOnFac

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

