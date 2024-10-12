import { assert, assertEquals } from "https://deno.land/std/assert/mod.ts"
import { Parser } from "../../Parser.ts";
import  { LR, LexerTokens } from "../basics/lexerRules.ts"
import  { PR, Tokens, UserData}  from "../basics/parserRules.ts"

// deno-lint-ignore prefer-const
let _debugHook = true

Deno.test({
    name: '01 - Parsing an int assignment', 
    fn: () => {  
        const input_01 = "     let øæå  = 12345"
        const parser = new Parser<LexerTokens, Tokens, UserData>( LR, PR, 'reset')
        parser.debug = false
        parser.reset(input_01)
  
        const tree = parser.getParseTree()
        const matcher_01 = tree.filter( v => v.token === 'INT' )
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
        const matcher = tree.filter( v => v.token === 'IDENT' )
  
        assert( matcher.length === 1  )
        assertEquals( matcher[0].value, 'øæå')
        const matcher2 = tree.filter( v => v.token === 'STR' )
        assert( matcher2.length === 1  )
        assert( matcher2[0].value, 'I am a string')
    },
    sanitizeResources: true,
    sanitizeOps: true
})