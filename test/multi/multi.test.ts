import { assert, assertEquals } from "https://deno.land/std/assert/mod.ts";
import { angie } from "./angieData2.ts"
import { Parser } from "../../Parser.ts";
import  LR  from "../leadSheet/lexerRules.ts"
import { PR } from "../leadSheet/parserRules.ts"
// deno-lint-ignore no-explicit-any
export interface PIndexable { [key: string]: any }

const DebugHook = 'dummy'

Deno.test({
    name: '01 - Parser top level multiplicity', 
    fn: () => {  
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(angie)
        const tree = parser.getParseTree()
        const keyMatches = tree.filter( v => v.token === 'KEY')  
        // console.log(JSON.stringify(tree, undefined, 2))
        assertEquals(keyMatches.length, 1) 
        // const form = tree.filter( v => v.token === 'FORM')
        // assertEquals(form.length, 1) 
    },
    sanitizeResources: false,
    sanitizeOps: false
})

Deno.test({
    name: '03 - Parser can handle more than one XOR parse descriptor', 
    fn: () => {  
        const str = "[KEY:xyz]"
        const parser = new Parser( LR, PR, 'testDummy')
        parser.debug = false
        parser.reset(str)
        assert( parser.result.size >= 5 )
        const minor = parser.getParseTree().filter( v => v.token !== 'IN_SWING_RHS')    
        assertEquals( minor[0].matched, true )
    },
    sanitizeResources: false,
    sanitizeOps: false
})

Deno.test({
    name: '04 - Parser can read multi level Scale Directive', 
    fn: () => {  
        const titleStr = "S: C Dorian"
        const parser = new Parser( LR, PR, 'scale')
        parser.debug = false
        parser.reset(titleStr)
        assert( parser.result.size >= 5 )
        const tree = parser.getParseTree().filter( v => v.type !== 'non-terminal')
        // console.log(JSON.stringify(tree, undefined, 2))
        assertEquals( tree.length, 3 )
    },
    sanitizeResources: false,
    sanitizeOps: false
})


Deno.test({
    name: '05 - Parser can read multi level Key Directive with logic', 
    fn: () => {  
        const titleStr = "Key: C Harm. Minor"
        const parser = new Parser( LR, PR, 'key')
        parser.debug = false
        parser.reset(titleStr)
        assert( parser.result.size >= 5 )
        const tree = parser.getParseTree().filter( v => v.type !== 'non-terminal')
        // console.log(JSON.stringify(tree, undefined, 2))
        // assertEquals( tree.length, 4 )
    },
    sanitizeResources: false,
    sanitizeOps: false
})
