import { assert, assertEquals } from "https://deno.land/std/assert/mod.ts"
import { Logic } from "../../Logic.ts";

const DebugHook = 'dummy'


Deno.test({
    name: '01 - Logic can store and match LogicDescriptors', 
    fn: () => {  
        const key = 'key_01'
        let idx = 0
        let group = 0
        const logic = new Logic(key)
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'xor',  tries: 1, matched: false, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'xor',  tries: 1, matched: true, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'xor',  tries: 1, matched: true, matchCnt: 0 } )
        group++
        idx = 0
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'or',  tries: 1, matched: false, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'or',  tries: 1, matched: true, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'or',  tries: 1, matched: true, matchCnt: 0 } )
        assertEquals( logic.isMatched(0), false)
        assertEquals( logic.isMatched(1), true)
    },
    sanitizeResources: false,
    sanitizeOps: false
})

Deno.test({
    name: '02 - Logic can store and handle NOP operators', 
    fn: () => {  
        const key = 'key_01'
        let idx = 0
        let group = 0
        const logic = new Logic(key)
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'xor', tries: 1, matched: false, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'NOP', tries: 1, matched: true, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'xor', tries: 1, matched: true, matchCnt: 0 } )
        let res = logic.isMatched(group)
        assertEquals( res , true)

        group = 1
        idx = 0
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'xor', tries: 1, matched: true, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'NOP', tries: 1, matched: false, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'xor', tries: 1, matched: false, matchCnt: 0 } )
        assertEquals( logic.isMatched(group), true)

        group = 2
        idx = 0
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'or', tries: 1, matched: true, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'or', tries: 1, matched: true, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'NOP', tries: 1, matched: true, matchCnt: 0 } )
        res = logic.isMatched(group)
        assertEquals( res, true)

        group = 3
        idx = 0
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'or',  tries: 1, matched: false, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'or',  tries: 1, matched: false, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'NOP',  tries: 1, matched: true, matchCnt: 0 } )
        res = logic.isMatched(group)
        assertEquals( res, false)

        group = 4
        idx = 0
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'or',   tries: 1, matched: true, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'NOP',  tries: 1, matched: false, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'NOP',  tries: 1, matched: false, matchCnt: 0 } )
        assertEquals( logic.isMatched(group), true)
        
        // console.log(`${JSON.stringify(logic.getCopy(), undefined,2)}`)
    },
    sanitizeResources: false,
    sanitizeOps: false
})
