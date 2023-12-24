import { assert } from "https://deno.land/std/assert/mod.ts";
import { angie } from "./angieData.ts"
import { Parser } from "../../Parser.ts";
import  LR  from "./lexerRules.ts"
import { PR } from "./parserRules.ts"
export interface PIndexable { [key: string]: any }

Deno.test({
    name: '01 - Parser can read a header Title and Auther', 
    fn: () => {  
        const titleStr = " \n    Title: Angie\nAuthor: Rolling Stones\n"
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(titleStr)
        assert( parser.result.size >= 11 )
        const tree = parser.getParseTree()
        assert( tree.length >= 8 )
    },
    sanitizeResources: false,
    sanitizeOps: false
})

Deno.test({
    name: '02 - Parser can read a Form directive', 
    fn: () => {  
        const titleStr = "\nForm: \n -Intro \n-  Verse \n - Verse 2\n - Intro \n-Verse 3  \n    - Coda"
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(titleStr)
        const tree = parser.getParseTree()
        assert(parser.result.size >= 38)
        assert(tree.length >=  26)
    },
    sanitizeResources: false,
    sanitizeOps: false
})

Deno.test({
    name: '03 - ParseTree has only the matched child references (this will fail if you set debug = true)', 
    fn: () => {  
        // deno-lint-ignore no-explicit-any
        const idMap = new Map<string,any>()
        const parser = new Parser( LR, PR, 'reset')
        // Note: this test wil fail if debug is set to true
        parser.debug = false
        parser.reset(angie)
        const tree = parser.getParseTree()
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
                assert( idMap.get(id).matched, `idMap got: ${JSON.stringify(idMap.get(id))}` ) 
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
        let result = itor.next()
        while ( ! result.done) {
            assert( result.value !== undefined  )
            result = itor.next()
            count++
        }
        assert(result.done === true)
    },
    sanitizeResources: false,
    sanitizeOps: false
})
