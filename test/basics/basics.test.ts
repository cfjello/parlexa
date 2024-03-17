import { assert, assertEquals } from "https://deno.land/std/assert/mod.ts"
import { delay } from 'https://deno.land/x/delay@v0.2.0/mod.ts'
import { Parser } from "../../Parser.ts";
import  { LR, LexerTokens } from "../basics/lexerRules.ts"
import  { PR, Tokens, UserData}  from "../basics/parserRules.ts"

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
        const input_01 = "     let øæå  = 12345"
        const parser = new Parser<LexerTokens, Tokens, UserData>( LR, PR, 'reset')
        parser.debug = false
        parser.reset(input_01)
  
        const tree = parser.getParseTree()
        const matcher_01 = tree.filter( v => v.type === 'INT' )
        assert( matcher_01.length === 1  )
    },
    sanitizeResources: false,
    sanitizeOps: false
})

Deno.test({
    name: '02 - Parsing an string assignment', 
    fn: () => {  
        const input = `     let øæå  = 'I am a string';
        `;
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(input)
  
        assert( parser.result.size > 15 )
        const tree = parser.getParseTree()
        const matcher = tree.filter( v => v.type === 'IDENT' )
  
        assert( matcher.length === 1  )
        assertEquals( matcher[0].value, 'øæå')
        const matcher2 = tree.filter( v => v.type === 'STR' )
        assert( matcher2.length === 1  )
        assert( matcher2[0].value, 'I am a string')
    },
    sanitizeResources: true,
    sanitizeOps: true
})

Deno.test({
    name: '03 - Parsing an array assignment', 
    fn: () => {  
        const input = `     let øæå  = [ 1234, 'I am a string', 5678, 'ÆØÅ string with numbers 123456' ]`;
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(input)
       
        const tree = parser.getParseTree()
        // Deno.writeTextFileSync('./tree.txt', JSON.stringify(tree, undefined, 2))
        const matcher = tree.filter( v => v.token === 'INT' )
        const matcher2 = tree.filter( v => v.token === 'STR' )
        assert(  parser.result.size >  30)
        assertEquals(  matcher.length, 2)
        assertEquals(  matcher[0].value, '1234')
        assertEquals(  matcher[1].value, '5678')
        assertEquals(  matcher2.length, 2 )
        assertEquals(  matcher2[0].value, 'I am a string')
        assertEquals(  matcher2[1].value, 'ÆØÅ string with numbers 123456') 
 
    },
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
    name: '05 - Parser callback function to update a matcher works', 
    fn: () => {  
        const input = `     let øæå  = [1234]`
        const parser = new Parser( LR, PR, 'reset' )
        parser.debug = false
        parser.reset(input)
        const tree = parser.getParseTree()
        // deno-lint-ignore no-explicit-any
        const matcher : any[] = tree.filter( v => v.type === 'INT' )
        // console.debug(`05: ${JSON.stringify(matcher,undefined,2)}`)
        assertEquals( matcher[0].intAssignCB,'INT Callback was here')
    },
    sanitizeResources: false,
    sanitizeOps: false
})

type UserScope = { recId: string, callBackFound: boolean, intWasHere: string, comment: string, intAssignCB: string,  arrAssignCB: string[]}

Deno.test({
    name: '06 - Parser can utilize user defined scope', 
    fn: () => {  
        const input = `     let øæå  = [ 1234, 'I am a string']`
        const parser = new Parser( LR, PR, 'reset', {recId: 'record1', callBackFound: false, intWasHere: 'NO', comment: 'EMPTY'} as UserScope)
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
    name: '08 - NewLine is matched correctly', 
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


Deno.test({
    name: '09 - Parser backtracks on wrong path taken', 
    fn: () => {  
        const input = `let backTrackDummy  = @_DUMMY_@`
        // deno-lint-ignore no-explicit-any
        const parser = new Parser( LR, PR, 'reset', {} as any, false)
        // parser.debug = true
        parser.reset(input)
        const tree = parser.getParseTree()
        // deno-lint-ignore no-explicit-any
        const matcher : any[] = tree.filter( v => v.type === 'DUMMY' )
        assertEquals( matcher.length, 1)
    },
    sanitizeResources: false,
    sanitizeOps: false
})

/*
Deno.test({
    name: '10 - Parser backtracks with more complex input', 
    fn: () => {  
        const input = `let æøå = [ 1234, 'A string' ]
        let backTrackDummy  = @_DUMMY_@
        let abc = 5678`
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(input)
        const tree = parser.getParseTree()
        // deno-lint-ignore no-explicit-any
        const matcher : any[] = tree.filter( v => v.type === 'DUMMY' )
        assertEquals( matcher.length, 1)
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