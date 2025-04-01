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
    roundTrips = 0 
    
    constructor(
        public logicKey: string, 
        public logicGroups: LogicDescriptor[][][] = [],
        public debug = false
    ) {}

    getLength() {
        return this.logicGroups.length
    }

    setMatch( ld: LogicDescriptor) {
        if ( ! this.logicGroups[ld.group] ) this.logicGroups[ld.group] = []
        if ( ! this.logicGroups[ld.group][ld.roundTrip] ) this.logicGroups[ld.group][ld.roundTrip] = []

        if ( this.logicGroups[ld.group][ld.roundTrip].length === 0 ) {
            assert( ld.logic !== 'NOP', `Logic in group for ${this.logicKey} - first entry cannot be 'NOP'`)
            this.logicGroups[ld.group][ld.roundTrip].push(ld)
        }
        else {
            const logic = this.logicGroups[ld.group][ld.roundTrip][0].logic
            assert( ld.logic === logic || ld.logic === 'NOP' || ld.logic === 'none', `Logic in group for ${this.logicKey}: ${ld.logic} <> ${logic} must be the same or 'NOP' within each group`)
            this.logicGroups[ld.group][ld.roundTrip].push(ld)
        }
        this.roundTrips = ld.roundTrip > this.roundTrips ? ld.roundTrip : this.roundTrips 
    }

    setIMatch<T extends string,U>( m: InternMatcher<T,U>, matched: boolean) {
        assert ( m.logicGroup > -1, `Logic.setIMatch(): logicGroup is not set for token: ${m.token}`)
        assert ( m.roundTrips > 0, `Logic.setIMatch(): roundTrips is not set for token: ${m.token}`)
        this.setMatch({ key: m.keyExt!, group: m.logicGroup, idx: m.logicIdx, roundTrip: m.roundTrips, tries: m.tries, logic: m.logic, matched: matched, matchCnt: matched ? 1 : 0 })
    }

    isMatched( group: number, roundTrips = 1 ): boolean {
        let res = false
        let logic = ''
        try {
            assert ( this.logicGroups[group], `Logic.isMatched(): logicGroup: ${group} is not set`)
            assert ( this.logicGroups[group][roundTrips], `Logic.isMatched(): logicGroup: ${group} at roundTrip: ${roundTrips} is not set`)
            logic = this.logicGroups[group][roundTrips][0].logic

            assert ( logic !== '' && logic !== undefined, `Logic.isMatched(): logic for group: ${group} at roundTrip: ${roundTrips} is empty or undefined`)
            const matches = this.logicGroups[group][roundTrips]
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

    validate() {
        let isAllMatched = true
        outerLoop: for( let group = 0; group < this.logicGroups.length; group++ ) {
            for( let roundTrip = 0; roundTrip < this.logicGroups[group].length; roundTrip++ ) {
                if ( ! this.logicGroups[group][roundTrip] ) continue
                const isMatched = this.isMatched(group, roundTrip)
                if ( !isMatched ) {
                    isAllMatched = false
                    break outerLoop
                }
            }
        }
        return isAllMatched
    }

    getCopy() {
        return _.clone(this.logicGroups) as typeof this.logicGroups
    }
}
