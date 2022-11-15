import { assert, assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { angie } from "./angieData3.ts"
import { Parser } from "../../Parser.ts";
import  LR  from "../leadSheet/lexerRules.ts"
import { PR } from "./parserRules.ts"
// deno-lint-ignore no-explicit-any
export interface PIndexable { [key: string]: any }

const DebugHook = 'dummy'

Deno.test({
    name: '01 - Parser Redirect on newline', 
    fn: () => {  
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(angie)
        const tree = parser.getParseTree()
        const keyMatches = tree.filter( v => v.type === 'SECTION')  
        // console.log(JSON.stringify(tree, undefined, 2))
        assertEquals(keyMatches.length, 4) 
        // const form = tree.filter( v => v.type === 'FORM')
        // assertEquals(form.length, 1) 
    },
    sanitizeResources: false,
    sanitizeOps: false
})