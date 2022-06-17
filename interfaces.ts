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

export interface Matcher {
    match  : RegExp,
    multi? : Cardinality,
    logic?:  Logical,
    // deno-lint-ignore no-explicit-any
    cb?    : ( e: any ) => any
}

// The internal representation within the parser
export type InternMatcher = { 
    key:        string, 
    multi:      Cardinality, 
    logic?:     Logical,
    xorGroup?:  number,
    xorIdx?:    number,
    ignore?:    boolean, 
    type:       string,
    regexp?:    RegExp,
    lRRef:      RegExp | Matcher,
    // deno-lint-ignore no-explicit-any
    cb?:        ( e: any ) => any,
    parent?:    string
}

// The internal representation within the parser
export type ExpectMap       = { multi: Cardinality, expect:  Array<InternMatcher> }
export type LexerRules      = Record<string, Matcher | RegExp >
export type Logical         =  'xor' | 'NOP' | 'ignore'
export type Expect<T>       = { multi?: Cardinality, expect:  Array<ExpectEntry<T>> }
export type ExpectEntry<T>  = Array<Matcher | RegExp | T | Cardinality | Logical> | Matcher | RegExp | T
export type MatchEntry<T>   = Matcher | RegExp | T | Array<Matcher | T | Cardinality>
export type ParserRules<T>  = Record<string, Expect<T>>
export type Keys<G,L>       = G | L | '__undef__' | 'unknown'

export interface ArgsObject {
  [key: string]: string
}

export type unmatchedTokenType = { token: string, pos: number }