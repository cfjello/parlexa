import { assert, assertEquals } from "https://deno.land/std/assert/mod.ts";
import { Parser } from "../../Parser.ts";
import  LR  from "./lexerRules.ts"
import { PR } from "./parserRules.ts"


const _debugHook = 0

Deno.test({
    name: '01 - Parsing an int assignment', 
    fn: () => {  
        const input = "     let øæå  = 12345;"
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(input)
        assert( parser.result.size >= 18 )
        const tree = parser.getParseTree()
        assert( tree.length >= 10 )
    },
    sanitizeResources: false,
    sanitizeOps: false
})
/*
Deno.test({
    name: '02 - Parsing an string assignment', 
    fn: () => {  
        const input = `     let øæå  = 'I am a string;'
        `;
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(input)
        assert( parser.result.size > 10 )
        const tree = parser.getParseTree()
        const matcher = tree.filter( v => v.type === 'IDENT' )
        assert( matcher.length > 0  )
        assertEquals( matcher[0].value, 'øæå')
        const matcher2 = tree.filter( v => v.type === 'STR' )
        assert( matcher2.length > 0  )
        assertEquals( matcher2[0].value, 'I am a string')
    },
    sanitizeResources: false,
    sanitizeOps: false
})


Deno.test({
    name: '03 - Parsing an array assignment', 
    fn: () => {  
        const input = `     let øæå  = [ 1234, 'I am a string', 5678, 'ÆØÅ string with numbers 123456' ];`
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(input)
        assert( parser.result.size >  40)
        const tree = parser.getParseTree()
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
        const input = `     let øæå  = [ 1234, 'I am a string', [ 5678, 6789, 78910], 'ÆØÅ string with numbers 123456' ];`
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(input)
        assert( parser.result.size > 70)
        const tree = parser.getParseTree()
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

/*
Deno.test({
    name: '05 - Parsing can fail and reset to the correct position', 
    fn: () => {  
        const input = `     let øæå  = [ 1234, 'I am a string', [ 5678, 6789, 78910], 'ÆØÅ']`;
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = true
        parser.reset(input)
        // assert( parser.result.size > 70)
        const tree = parser.getParseTree()
        // console.debug(JSON.stringify(tree, undefined, 2))
        // const matcher = tree.filter( v => v.type === 'INT' )

        assertEquals( matcher.length, 4 )
        assertEquals( matcher[0].value, '1234')
        assertEquals( matcher[1].value, '5678')
        assertEquals( matcher[2].value, '6789')
        assertEquals( matcher[3].value, '78910')
       
    },
    sanitizeResources: false,
    sanitizeOps: false
})
*/
/*
Deno.test({
    name: '05 - Parser can read a nested Object', 
    fn: () => {  
        const typeStr = `
        let obj = { 
            init:       'true',
            note:       56, 
            sharpFlat:  '#',
            chord: { 
                majMin:     'Major', 
                ext:        '7', 
                ext2:       '#11',
                inv:        1,
                minus:      [1,5],
                bass:       'C',
            },
            tie:        'false', 
          };`
        const parser2 = new Parser( LR, PR, 'reset')
       
        parser2.debug = true
        parser2.reset(typeStr)
        assert( parser2.result.size > 250)
        const tree = parser2.getParseTree()
        assert( tree.length >  86 )

        const myType = tree.filter( v => v.value === 'Major' )
        assert( myType !== undefined )
        assert( myType.length > 0  )
    },
    sanitizeResources: false,
    sanitizeOps: false
})


Deno.test({
    name: '06 - Parsing can handle left recursive reference', 
    fn: () => {  
        try {
        const input = ` , ,  ,, ,`;
        const parser = new Parser( LR, PR, 'leftRecursive')
        parser.debug = false
        parser.reset(input)
        assert( parser.result.size > 5)
        const tree = parser.getParseTree()
        const matcher = tree.filter( v => v.type === 'COMMA' )
        assertEquals( matcher.length, 5 )
        }
        catch (err) {
            // console.debug(err)
            assert( err.toString().indexOf('Left recursive reference: leftRecursive') >= 0 ) 
        }
    },
    sanitizeResources: false,
    sanitizeOps: false
})
*/
