import { assert, assertEquals } from "https://deno.land/std/assert/mod.ts"
import { Parser } from "../../Parser.ts";
import  LR  from "../basics/lexerRules.ts"
import  { PR, T }  from "../basics/parserRules.ts"

// deno-lint-ignore prefer-const
let _debugHook = true

function jsonOut( obj: object | string) {

    if ( typeof obj === 'string' ) {
        console.debug(obj)
    }
    else  {
        console.debug(JSON.stringify(obj, undefined, 2) )
    }
}

Deno.test({
    name: '01 - Parsing an int assignment', 
    fn: () => {  
        const input = "     let øæå  = 12345"
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(input)
        console.debug(`parser.result.size: ${parser.result.size}`)
        assert( parser.result.size >= 15 )
  
        // for ( const [_key, value] of parser.result.entries()  ) {
        //      console.log(`${JSON.stringify(value, undefined, 2)}`);
        // }
       //  console.debug(JSON.stringify(parser.result, undefined, 2) )


        const tree = parser.getParseTree()
        // console.debug(JSON.stringify(tree, undefined, 2))
        console.debug(`tree.length: ${tree.length}`)
        assert( tree.length > 5 )
        const matcher = tree.filter( v => v.type === 'INT' )
        console.debug(`INT tree.length: ${matcher.length}`)
        assert( matcher.length > 0  )
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
        assert( matcher.length > 0  )
        assertEquals( matcher[0].value, 'øæå')
        if ( parser.debug ) {
            jsonOut(tree)
        }
        const matcher2 = tree.filter( v => v.type === 'STR' )
        assert( matcher2.length > 0  )
        assert( matcher2[0].value, 'I am a string')
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

Deno.test({
    name: '05 - Parser can call match callback function', 
    fn: () => {  
        const input = `     let øæå  = [1234]`
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(input)
        const tree = parser.getParseTree()
        // deno-lint-ignore no-explicit-any
        const matcher : any[] = tree.filter( v => v.type === 'INT' )
        // console.debug(`${JSON.stringify(tree,undefined,2)}`)
        assertEquals( matcher[0].intAssignCB,'INT Callback was here')
    },
    sanitizeResources: false,
    sanitizeOps: false
})

type UserScope = { recId: string, callBackFound: boolean, intWasHere: string, comment: string }

Deno.test({
    name: '06 - Parser can utilize user defined scope', 
    fn: () => {  
        const input = `     let øæå  = [ 1234, 'I am a string']`
        const parser = new Parser<T,UserScope>( LR, PR, 'reset', {recId: 'record1', callBackFound: false, intWasHere: 'NO', comment: 'EMPTY'})
        parser.debug = false
        parser.reset(input)
        const userData = parser.getUserScope()
        // console.debug(`${JSON.stringify(userData,undefined,2)}`)
        assert( userData.recId !== undefined)
        assert( userData.callBackFound)
        assertEquals( userData.comment, 'This is parser global user defined data')
        assertEquals(userData.intWasHere, 'integer was here' )

    },
    sanitizeResources: false,
    sanitizeOps: false
})

Deno.test({
    name: '07 - Parser can parse complex syntax and then "reset"', 
    fn: () => { 

        let input = `     let øæå  = [ 1234, 'I am a string', [ 5678, 6789, 78910], 'ÆØÅ string with numbers 123456' ]`;
        let parser = new Parser( LR, PR, 'reset')
        parser.reset(input)
        parser.debug = false
        // assert( parser.result.size > 70)
        let tree = parser.getParseTree()
        let matcher = tree.filter( v => v.type === 'INT' )
        assertEquals( matcher.length, 4 )
        assertEquals( matcher[0].value, '1234')
        assertEquals( matcher[1].value, '5678')
        assertEquals( matcher[2].value, '6789')
        assertEquals( matcher[3].value, '78910')

        input = "     let øæå  = 12345;"
        parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(input)
        assert( parser.result.size >= 18 )
        tree = parser.getParseTree()
        matcher = tree.filter( v => v.type === 'INT' )
        // console.log(`${JSON.stringify(matcher)}`)
        assertEquals( matcher[0].value, '12345')
    },
    sanitizeResources: false,
    sanitizeOps: false
})

Deno.test({
    name: '09 - NewLine is matched correctly', 
    fn: () => {  
        const input = `     
            let øæå  = [1234]
        `
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(input)
        const tree = parser.getParseTree(true)
        // console.debug(`${JSON.stringify(tree,undefined,2)}`)
        // deno-lint-ignore no-explicit-any
        const matcher : any[] = tree.filter( v => v.type === 'NL' )
       
        assertEquals( matcher.length, 2)
    },
    sanitizeResources: false,
    sanitizeOps: false
})

/*
Deno.test({
    name: '10 - Parser backtracks on wrong path taken', 
    fn: () => {  
        const input = `let backTrackDummy  = @_DUMMY_@`
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = true
        parser.reset(input)
        const tree = parser.getParseTree()
        // deno-lint-ignore no-explicit-any
        const matcher : any[] = tree.filter( v => v.type === 'DUMMY' )
        assertEquals( matcher.length, 1)
    },
    sanitizeResources: false,
    sanitizeOps: false
})
*/