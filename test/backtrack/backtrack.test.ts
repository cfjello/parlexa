import { assert, assertEquals } from "https://deno.land/std/assert/mod.ts";
// import { angie } from "./angieData3.ts"
import { Parser } from "../../Parser.ts";
import  LR  from "../basics/lexerRules.ts"
import { PR } from "../basics/parserRules.ts"
// deno-lint-ignore no-explicit-any
export interface PIndexable { [key: string]: any }

const DebugHook = 'dummy'

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

