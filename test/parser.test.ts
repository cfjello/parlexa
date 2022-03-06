import { assert, assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { angie } from "../examples/angieData.ts"
import { checkData } from "./checkData.ts"
import { Parser } from "../Parser.ts";
import  LR  from "../examples/lexerRules.ts"
import { PR } from "../examples/parserRules.ts"
export interface PIndexable { [key: string]: any }

// const decoder = new TextDecoder('utf-8'); 
// const angie = decoder.decode(Deno.readFileSync('./Angie.txt'))

const parser = new Parser( LR, PR, 'reset')
parser.debug = false
parser.reset(angie)

Deno.test({
    name: '01 - Parser can read a header Title and Auther', 
    fn: () => {  
        const titleStr = "     Title: Angie\nAuthor: Rolling Stones\n"
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(titleStr)
        assertEquals( parser.result.size, 13 )
        // const tree = parser.getParseTree()
        // assertEquals( tree.length, 13 )
    },
    sanitizeResources: false,
    sanitizeOps: false
})

Deno.test({
    name: '02 - Parser can read a Form directive', 
    fn: () => {  
        const titleStr = "\nForm:  \n  - Intro \n- Verse\n  - Verse 2\n  - Intro\n  - Verse 3\n  - Coda\n"
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(titleStr)
        // assert( parser.result.size > 10 , 'Missing entries in parser.result')
        const tree = parser.getParseTree()
        assertEquals(parser.result.size, 38)
        assertEquals(tree.length, 25)
    },
    sanitizeResources: false,
    sanitizeOps: false
})


Deno.test({
    name: '03 - Parser can read the complete sheet', 
    fn: () => {  
        const tree = parser.getParseTree()
        // console.log(`${JSON.stringify(tree, undefined, 2)}`)
        const parsed = tree[Symbol.iterator]()
        const check  = checkData[Symbol.iterator]() 
        let p = parsed.next()
        let c = check.next()

        while ( ! p.done ) {  
            for ( const prop in c.value ) {
                if ( prop ==='id' || prop === 'children' || prop ==='parent') continue
                // console.log(`${JSON.stringify(c)}`)
                assertEquals(
                    c.value[prop], (p.value as PIndexable)[prop],
                    `REC: ${JSON.stringify(c, undefined, 2)}\nProperty: ${prop}: ${c.value[prop]} <> ${(p.value as PIndexable)[prop]}`
                )
            }
            p = parsed.next()
            c = check.next()
        } 
    },
    sanitizeResources: false,
    sanitizeOps: false
})

Deno.test({
    name: '04 - Parser can provide a parser tree iterator', 
    fn: () => {  
        const itor = parser.getIterator()   
        let count = 0
        while ( count++ < 50 ) {
            assert( itor.next().value !== undefined  )
            assert( itor.next().done === false )
        }
    },
    sanitizeResources: false,
    sanitizeOps: false
})
