import { assert } from "https://deno.land/std/assert/mod.ts";
import { InternMatcher, LogicDescriptor } from "./types.ts";
import { _ } from "./lodash.ts";
// import * as jp  from "npm:jsonpath"

/* 
    Logic is provided for parser 'expect' groups:
        - The logic is always read forwards
        - Sequences of same logic are evaluated together, but can include 
        - The NOP (no operation) logic entry is simply ignored within the match group 
        - If an expect group is active and we encounter an entry with no logic specified, 
          this entry is considered the last entry of the active group  
*/
export class Logic {
   
    constructor(
        public logicKey: string, 
        public logicGroups: LogicDescriptor[][] = [],
        public debug = false
    ) {}

    getLength() {
        return this.logicGroups.length
    }

    initMatch( ld: LogicDescriptor ) {
        if ( ! this.logicGroups[ld.group] ) this.logicGroups[ld.group] = []
     
        const firstEntry = this.logicGroups[ld.group].length === 0 
        if ( firstEntry ) {
            assert( ld.logic !== 'NOP', `Logic in group for ${this.logicKey} - first entry cannot be 'NOP'`)   
        }
        this.logicGroups[ld.group].push(ld)
    }

    setMatch( ld: LogicDescriptor) {
        if ( ! this.logicGroups[ld.group] ) this.logicGroups[ld.group] = []

        const firstEntry = this.logicGroups[ld.group].length === 0 
        if ( firstEntry ) {
            assert( ld.logic !== 'NOP', `Logic in group for ${this.logicKey} - first entry cannot be 'NOP'`)
        }
        const logic = this.logicGroups[ld.group][0].logic
        assert( ld.logic === logic || ld.logic === 'NOP' || ld.logic === 'none', `Logic in group for ${this.logicKey}: ${ld.logic} <> ${logic} must be the same or 'NOP' within each group`)
        
        this.logicGroups[ld.group][ld.idx].matched = ld.matched
        this.logicGroups[ld.group][ld.idx].matchCnt = ld.matchCnt
        this.logicGroups[ld.group][ld.idx].tries = ld.tries
    }

    setIMatch<T extends string,U>( m: InternMatcher<T,U>, matched: boolean ) {
        assert ( m.logicGroup > -1, `Logic.setIMatch(): logicGroup is not set for token: ${m.token}`)
        this.setMatch({ key: m.keyExt!, group: m.logicGroup, idx: m.logicIdx, tries: m.tries, logic: m.logic, matched: matched, matchCnt: matched ? 1 : 0 })
    }

    isMatched( group: number ): boolean {
        let res = false
        let logic = ''
        try {
            assert ( this.logicGroups[group], `Logic.isMatched(): logicGroup: ${group} is not set`)
            logic = this.logicGroups[group][0].logic

            assert ( logic !== '' && logic !== undefined, `Logic.isMatched(): logic for group: ${group} is empty or undefined`)
            const matches = this.logicGroups[group]
                .filter( f => { if ( f.logic !== 'NOP' && f.matched === true ) return f } )
            
            if ( matches.length === 0 )
                res = false
            else if ( logic === 'or' )
                res = ( matches.length > 0 )
            else if ( logic === 'xor' )
                res = ( matches.length == 1 )
        }
        catch (err) { 
            console.error(err)
        }
        return res
    }

    validate(): boolean {
        let isMatched = true
        for( let group = 0; group < this.logicGroups.length; group++ ) {
            isMatched = this.isMatched( group )
            if ( !isMatched ) break
        }
        return isMatched
    }

    validateGroup( group: number): boolean {
        let isMatched = true
        try {
            isMatched = this.isMatched(group)
        }
        catch (err) { 
            console.error(err)
        }
        return isMatched
    }

    getCopy() {
        return _.cloneDeep(this.logicGroups) as typeof this.logicGroups
    }
}
