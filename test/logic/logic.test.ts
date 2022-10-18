import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { Logic } from "../../Logic.ts";

const DebugHook = 'dummy'

Deno.test({
    name: '01 - Logic can store and match LogicDescriptors', 
    fn: () => {  
        const key = 'key_01'
        let idx = 0
        let group = 0
        const logic = new Logic(key)
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'xor', roundTrip: 1, tries: 1, matched: false, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'xor', roundTrip: 1, tries: 1, matched: true, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'xor', roundTrip: 1, tries: 1, matched: true, matchCnt: 0 } )
        group++
        idx = 0
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'or', roundTrip: 2, tries: 1, matched: false, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'or', roundTrip: 2, tries: 1, matched: true, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'or', roundTrip: 2, tries: 1, matched: true, matchCnt: 0 } )
        assertEquals( logic.isMatched(0, 1), false)
        assertEquals( logic.isMatched(1, 2), true)
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
        const roundTrip = 2
        const logic = new Logic(key)
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'xor', roundTrip: 2, tries: 1, matched: false, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'NOP', roundTrip: 2, tries: 1, matched: true, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'xor', roundTrip: 2, tries: 1, matched: true, matchCnt: 0 } )
        let res = logic.isMatched(group, roundTrip)
        assertEquals( res , true)

        group = 1
        idx = 0
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'xor', roundTrip: 2, tries: 1, matched: true, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'NOP', roundTrip: 2, tries: 1, matched: false, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'xor', roundTrip: 2, tries: 1, matched: false, matchCnt: 0 } )
        assertEquals( logic.isMatched(group, roundTrip), true)

        group = 2
        idx = 0
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'or', roundTrip: 2, tries: 1, matched: true, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'or', roundTrip: 2, tries: 1, matched: true, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'NOP', roundTrip: 2, tries: 1, matched: true, matchCnt: 0 } )
        res = logic.isMatched(group, roundTrip)
        assertEquals( res, true)

        group = 3
        idx = 0
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'or', roundTrip: 2, tries: 1, matched: false, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'or', roundTrip: 2, tries: 1, matched: false, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'NOP', roundTrip: 2, tries: 1, matched: true, matchCnt: 0 } )
        res = logic.isMatched(group, roundTrip)
        assertEquals( res, false)

        group = 4
        idx = 0
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'or',  roundTrip: 2, tries: 1, matched: true, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'NOP', roundTrip: 2, tries: 1, matched: false, matchCnt: 0 } )
        logic.setMatch({ key: key, group: group, idx: idx++, logic: 'NOP', roundTrip: 2, tries: 1, matched: false, matchCnt: 0 } )
        assertEquals( logic.isMatched(group, roundTrip), true)
        
        // console.log(`${JSON.stringify(logic.getCopy(), undefined,2)}`)
    },
    sanitizeResources: false,
    sanitizeOps: false
})
