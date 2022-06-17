import { assert, assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { angie } from "../examples/leadSheet/angieData.ts"
import { checkData } from "./checkData.ts"
import { Parser } from "../Parser.ts";
import  LR  from "../examples/leadSheet/lexerRules.ts"
import { PR } from "../examples/leadSheet/parserRules.ts"
export interface PIndexable { [key: string]: any }

// const decoder = new TextDecoder('utf-8'); 
// const angie = decoder.decode(Deno.readFileSync('./Angie.txt'))

//const parser = new Parser( LR, PR, 'reset')
// parser.debug = false
// parser.reset(angie)

Deno.test({
    name: '01 - Parser can read a header Title and Auther', 
    fn: () => {  
        const titleStr = "     Title: Angie\nAuthor: Rolling Stones\n"
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(titleStr)
        assertEquals( parser.result.size, 11 )
        const tree = parser.getParseTree()
        // console.log(`${JSON.stringify(tree, undefined, 2)}`)
        assertEquals( tree.length, 8 )
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
        assert(parser.result.size >= 38)
        assert(tree.length >=  26)
    },
    sanitizeResources: false,
    sanitizeOps: false
})

/*
Deno.test({
    name: '03 - Parser can read the complete sheet', 
    fn: () => {  
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(angie)
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
*/
Deno.test({
    name: '03 - ParseTree has only the matched child references', 
    fn: () => {  
        const idMap = new Map<string,any>()
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(angie)
        const tree = parser.getParseTree()
        // console.log(`${JSON.stringify(tree, undefined, 2)}`)
        const parsed = tree[Symbol.iterator]()
        let p = parsed.next()
        while ( ! p.done ) { 
            idMap.set(p.value.id, p.value)
            p = parsed.next()
        } 
        const check = tree[Symbol.iterator]()
        let c = check.next()
        while ( ! c.done ) { 
            c.value.children.forEach( id => {
                assert( idMap.has(id))
                assert( idMap.get(id).matched ) 
            })
            c = check.next()
        } 
    },
    sanitizeResources: false,
    sanitizeOps: false
})


Deno.test({
    name: '04 - Parser can provide a parser tree iterator', 
    fn: () => {  
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(angie)
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
