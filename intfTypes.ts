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
/*
// The output representation from the parser
export  class MatchRecord {
    // deno-lint-ignore no-inferrable-types
    level:  number = NaN
    id:     string = ''
    ident?: string = ''
    type:   string = ''
    token: string = ''
    value:  number | string  = ''
    text:   string  = ''
    offset: number  = NaN
    newPos: number  = NaN
    ofLen:  number  = NaN
    line:   number  = NaN
    col:    number  = NaN
    matched? : boolean  = false
    matchErr?: string = ''
    xor?:   XorGroup[] = []
    xorMatched?: boolean = false
    parent: string = ''
    children: string[] = []
}
*/ 

// The output representation from the parser
abstract class MatchRecordClass  {
    level   = ''
    id      = ''
    ident   = '' 
    type    = ''
    token   = ''
    value   = ''
    text    = ''
    offset  = NaN
    newPos  = NaN
    ofLen   = NaN
    line    = NaN
    col     = NaN
    matched: boolean | null = null
    matchErr: string | undefined = ''
    xor:  XorGroup[]  = []
    xorMatched: boolean | null = null
    parent: string | null = null
    children: string[] = []
}


export type MatchRecord = InstanceType<typeof MatchRecordClass>



/*
try {
let T: MatchRecord  = {}
}
catch ( err ) { if ( err instanceof TypeError ) console.error(JSON.stringify( err, undefined,2 ))}
*/ 

/*
export type Keys<G>       =  G | 'unknown'
export type fieldNames = `${(number|'m')}`

// type TypedObjectKeys = <TInput>(input: TInput) => Array<keyof MatchRecord>

Object.keys(MatchRecordClass).forEach( key => console.log(key) )
*/

