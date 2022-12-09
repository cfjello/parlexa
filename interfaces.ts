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

export type Matched = { foundToken: boolean, id?: string, ignore: boolean } 

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
    multi:   Cardinality,
    line?:   boolean,
    cb?:     Callback, 
    expect:  Array<InternMatcher> 
}

export type LexerRules  = Record<string, Matcher | RegExp >
export type Logical     =  'or' | 'xor' | 'NOP' | 'none' | 'ignore'
// export type TryType<T>  = `try:${keyof T}`
// export type OnTypes     =  'break' | 'continue' |  'fail'  
// export type OnObject = {match: string , action: OnTypes, msgId?: string }

// export type OnTypes     =  'BOL' 

export type Expect<T>       = { 
    multi?: Cardinality, 
    expect: Array<ExpectEntry<T>>, 
    line?:  boolean,
    cb?:    Callback  
}

export type ShortExpectEntry<T> = Array<Matcher | RegExp | T | Cardinality | Logical | Callback>
export type ExpectEntry<T>  = ShortExpectEntry<T> | Matcher | RegExp | T
export type MatchEntry<T>   = Matcher | RegExp | T | Array<Matcher | T | Cardinality>
export type ParserRules<T>  = Record<string, Expect<T>>

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