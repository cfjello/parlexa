import { assert, assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { Parser } from "../Parser.ts";
import  LR  from "../examples/basics/lexerRules.ts"
import { PR } from "../examples/basics/parserRules.ts"
// export interface PIndexable { [key: string]: any }


Deno.test({
    name: '01 - Parsing an int assignment', 
    fn: () => {  
        const input = "     let øæå  = 12345;"
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(input)
        assertEquals( parser.result.size, 18 )
        const tree = parser.getParseTree()
        // console.log(`${JSON.stringify(tree, undefined, 2)}`)
        assertEquals( tree.length, 10 )
    },
    sanitizeResources: false,
    sanitizeOps: false
})

Deno.test({
    name: '01 - Parsing an string assignment', 
    fn: () => {  
        const input = `     let øæå  = 'I am a string'
        `;
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(input)
        assertEquals( parser.result.size, 20 )
        // const tree = parser.getParseTree()
        // console.log(`${JSON.stringify(tree, undefined, 2)}`)
        // assertEquals( tree.length, 10 )
    },
    sanitizeResources: false,
    sanitizeOps: false
})


Deno.test({
    name: '01 - Parsing an array assignment', 
    fn: () => {  
        const input = `     let øæå  = [ 1234, 'I am a string', 5678, 'ÆØÅ string with numbers 123456' ]`;
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(input)
        assertEquals( parser.result.size, 51)
        // const tree = parser.getParseTree()
        // console.log(`${JSON.stringify(tree, undefined, 2)}`)
        // assertEquals( tree.length, 10 )
    },
    sanitizeResources: false,
    sanitizeOps: false
})


Deno.test({
    name: '01 - Parsing an recursive array assignment', 
    fn: () => {  
        const input = `     let øæå  = [ 1234, 'I am a string', [ 5678, 6789, 78910], 'ÆØÅ string with numbers 123456' ]`;
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(input)
        assertEquals( parser.result.size, 76)
        // const tree = parser.getParseTree()
        // console.log(`${JSON.stringify(tree, undefined, 2)}`)
        // assertEquals( tree.length, 10 )
    },
    sanitizeResources: false,
    sanitizeOps: false
})