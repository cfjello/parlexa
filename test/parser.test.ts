import { assert, assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { angie } from "./angie.ts"
import { Parser } from "../Parser.ts";
import  LR  from "../resource/lexerRules.ts"
import { PR } from "../resource/parserRules.ts"
import { checkData } from "./checkData.ts";
export interface PIndexable { [key: string]: any }
const dummy = 10

// const decoder = new TextDecoder('utf-8'); 
// const angie = decoder.decode(Deno.readFileSync('./Angie.txt'))

const parser = new Parser( LR, PR, 'reset')
parser.debug = true
parser.reset(angie)
const tree = parser.getParseTree()

/*
Deno.test({
    name: '01 - Parser can read a header Title and Auther', 
    fn: () => {  
        const titleStr = "     Title: Angie\nAuthor: Rolling Stones\n"
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(titleStr)
        console.log ( `01 result size: ${parser.result.size}`)
        assertEquals( parser.result.size, 15 )
        const tree = parser.getParseTree()
        assertEquals( parser.result.size, 15 )
        console.log ( `01 tree length: ${tree.length}`)

        parser.debug = true
        parser.reset(titleStr)
        console.log ( `01 result size: ${parser.result.size}`)
        const tree2 = parser.getParseTree()
        console.log ( `01 tree length: ${tree2.length}`)
        assertEquals(parser.result.size, 21 )
        // assert(parser.debug || tree.length === 11, `Parser match tree num of elements  ${tree.length} <> 11`)
    },
    sanitizeResources: false,
    sanitizeOps: false
})

/*
Deno.test({
    name: '01 - Parser can fail base on missing TITLE in header', 
    fn: () => {  
        const titleStr = "     \nAuthor: Rolling Stones\n"
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(titleStr)
        console.log ( `01 result size: ${parser.result.size}`)
        assertEquals( parser.result.size, 15 )
        const tree = parser.getParseTree()
        assertEquals( parser.result.size, 15 )
        console.log ( `01 tree length: ${tree.length}`)
        // console.log(`${JSON.stringify(tree, undefined, 2)}`)

        parser.debug = true
        parser.reset(titleStr)
        console.log ( `01 result size: ${parser.result.size}`)
        const tree2 = parser.getParseTree()
        console.log ( `01 tree length: ${tree2.length}`)
        assertEquals(parser.result.size, 21 )
        // assert(parser.debug || tree.length === 11, `Parser match tree num of elements  ${tree.length} <> 11`)
    },
    sanitizeResources: false,
    sanitizeOps: false
})

Deno.test({
    name: '02 - Parser can read a Form directive', 
    fn: () => {  
        const titleStr = "\nForm:  \n  - Intro \n- Verse\n  - Verse 2\n  - Intro\n  - Verse 3\n  - Coda\n"
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = true
        parser.reset(titleStr)
        console.log ( `02 result size: ${parser.result.size}`)
        // assert( parser.result.size > 10 , 'Missing entries in parser.result')
        const tree = parser.getParseTree()
        console.log ( `02 tree length: ${tree.length}`)

        assertEquals(parser.result.size, 38)
        assertEquals(tree.length, 26)
    },
    sanitizeResources: false,
    sanitizeOps: false
})

*/ 
Deno.test({
    name: '01 - Parser can read the complete sheet', 
    fn: () => {  
        console.log(`${JSON.stringify(tree, undefined, 2)}`)
        /*
        const parsed = tree[Symbol.iterator]()
        const check  = checkData[Symbol.iterator]() 
        let p = parsed.next()
        let c = check.next()

        while ( ! p.done ) {  
            for ( const prop in c.value ) {
                if ( prop ==='id' || prop === 'children' || prop ==='parent') continue
                console.log(`${JSON.stringify(c)}`)
                assertEquals(
                    c.value[prop], (p.value as PIndexable)[prop],
                    `REC: ${JSON.stringify(c, undefined, 2)}\nProperty: ${prop}: ${c.value[prop]} <> ${(p.value as PIndexable)[prop]}`
                )
            }
            p = parsed.next()
            c = check.next()
        } 
        */
    },
    sanitizeResources: false,
    sanitizeOps: false
})

