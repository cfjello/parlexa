import { assert, assertEquals } from "https://deno.land/std/assert/mod.ts";
import { angie } from "./angieData3.ts"
import { Parser } from "../../Parser.ts";
import  LR  from "../leadSheet/lexerRules.ts"
import { PR } from "./ParserRules.ts"
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
        // Deno.writeTextFile('./log.txt',`${JSON.stringify(tree, undefined, 2)}`, { append: false} )
        const keyMatches = tree.filter( v => v.type === 'SECTION')  
        assertEquals(keyMatches.length, 4) 
        assertEquals(keyMatches[0].value, 'Head')
        assertEquals(keyMatches[1].value, 'Verse 1')
        assertEquals(keyMatches[2].value, 'Bridge Solo')
        assertEquals(keyMatches[3].value, 'Coda') 
    },
    sanitizeResources: false,
    sanitizeOps: false
})