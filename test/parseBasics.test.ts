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
        assert( parser.result.size >= 18 )
        const tree = parser.getParseTree()
        // console.log(`${JSON.stringify(tree, undefined, 2)}`)
        assert( tree.length >= 10 )
    },
    sanitizeResources: false,
    sanitizeOps: false
})

Deno.test({
    name: '02 - Parsing an string assignment', 
    fn: () => {  
        const input = `     let øæå  = 'I am a string'
        `;
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(input)
        assert( parser.result.size > 10 )
        const tree = parser.getParseTree()
        const matcher = tree.filter( v => v.type === 'IDENT' )
        // console.log(`${JSON.stringify(tree, undefined, 2)}`)
        assert( matcher.length > 0  )
        assertEquals( matcher[0].value, 'øæå')
        const matcher2 = tree.filter( v => v.type === 'STR' )
        // console.log(`${JSON.stringify(tree, undefined, 2)}`)
        assert( matcher2.length > 0  )
        assertEquals( matcher2[0].value, 'I am a string')
    },
    sanitizeResources: false,
    sanitizeOps: false
})


Deno.test({
    name: '03 - Parsing an array assignment', 
    fn: () => {  
        const input = `     let øæå  = [ 1234, 'I am a string', 5678, 'ÆØÅ string with numbers 123456' ]`;
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(input)
        assert( parser.result.size >  40)
        const tree = parser.getParseTree()
        // console.log(`${JSON.stringify(tree, undefined, 2)}`)
        const matcher = tree.filter( v => v.type === 'INT' )
        assertEquals( matcher.length, 2 )
        assertEquals( matcher[0].value, '1234')
        assertEquals( matcher[1].value, '5678')
        const matcher2 = tree.filter( v => v.type === 'STR' )
        assertEquals( matcher2.length, 2 )
        assertEquals( matcher2[0].value, 'I am a string')
        assertEquals( matcher2[1].value, 'ÆØÅ string with numbers 123456')
    },
    sanitizeResources: false,
    sanitizeOps: false
})


Deno.test({
    name: '04 - Parsing an recursive array assignment', 
    fn: () => {  
        const input = `     let øæå  = [ 1234, 'I am a string', [ 5678, 6789, 78910], 'ÆØÅ string with numbers 123456' ]`;
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(input)
        assert( parser.result.size > 70)
        const tree = parser.getParseTree()
        // console.log(`${JSON.stringify(tree, undefined, 2)}`)
        const matcher = tree.filter( v => v.type === 'INT' )
        assertEquals( matcher.length, 4 )
        assertEquals( matcher[0].value, '1234')
        assertEquals( matcher[1].value, '5678')
        assertEquals( matcher[2].value, '6789')
        assertEquals( matcher[3].value, '78910')
    },
    sanitizeResources: false,
    sanitizeOps: false
})