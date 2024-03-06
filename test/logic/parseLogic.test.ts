import { assert, assertEquals } from "https://deno.land/std/assert/mod.ts"
import { angie } from "../leadSheet/angieData.ts"
import { Parser } from "../../Parser.ts";
import  LR  from "../leadSheet/lexerRules.ts"
import { PR } from "../leadSheet/parserRules.ts"
// deno-lint-ignore no-explicit-any
export interface PIndexable { [key: string]: any }

const DebugHook = 'dummy'

Deno.test({
    name: '01 - Parser can load initial logic conditions', 
    fn: () => {  
        const parser = new Parser( LR, PR, 'reset')
        const map = parser.rules.logicMap
        const bar = map.get('barEntry')!.logicGroups[0][0]
        assertEquals( bar.length, 4 )
        const note = map.get('note')!.logicGroups[0][0]
        assertEquals( note.length, 3 )
    },
    sanitizeResources: false,
    sanitizeOps: false
})

Deno.test({
    name: '02 - Parser can handle an XOR parse descriptor', 
    fn: () => {  
        const str = "Scale:   F harm. minor"
        const parser = new Parser( LR, PR, 'scale')
        parser.debug = false
        parser.reset(str)
        assert( parser.result.size >= 5 )
        const minor = parser.getParseTree().filter( v => v.type !== 'MINOR')    
        assertEquals( minor[0].matched, true )
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
        const minor = parser.getParseTree().filter( v => v.type !== 'IN_SWING_RHS')    
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
        const tree = parser.getParseTree().filter( v => v.type !== 'Token')
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
        const tree = parser.getParseTree().filter( v => v.type !== 'Token')
        // console.log(JSON.stringify(tree, undefined, 2))
        assertEquals( tree.length, 4 )
    },
    sanitizeResources: false,
    sanitizeOps: false
})
