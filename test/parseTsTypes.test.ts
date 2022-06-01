import { assert, assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { Parser } from "../Parser.ts";
import  LR  from "../examples/tsTypes/lexerRules.ts"
import  PR  from "../examples/tsTypes/parserRules.ts"
// export interface PIndexable { [key: string]: any }

const dummy = 0


export type   NoteUpperType = 'A' | 'B' |'C' 
export type NoteLowerType = 'a' | 'b' | 'c' 
export type NoteType = NoteUpperType | NoteLowerType | 'NULL'

type Checks = Map<string, () => boolean>

export type  NoteEntry = { v: NoteType, i: boolean}

export type ChecksMapType = Map<string, () => boolean>

export type ChordType = { 
  init:       boolean
  // checks:     Map<string, () => boolean>, 
  note:       NoteEntry, 
  sharpFlat:  string, 
  chord:      string, 
  majMin:     string, 
  ext:        string, 
  ext2:       string,
  inv:        number,
  minus:      number[],
  bass:       string,
  tie:        boolean, 
  // meta:       {}
}
// const decoder = new TextDecoder('utf-8'); 
// const angie = decoder.decode(Deno.readFileSync('./Angie.txt'))

// const parser = new Parser( LR, PR, 'reset')
// parser.debug = false
// parser.reset("export type  NoteEntry = { v: NoteType, i: boolean}")

Deno.test({
    name: '01 - Parser can read simple type Object', 
    fn: () => {  
        const typeStr = `    
        export type  NoteEntry = { v: NoteType, i: boolean}
        `
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(typeStr)
        assert( parser.result.size > 5)
        // assertEquals( parser.result.size, 13 )
        // const tree = parser.getParseTree()
        // assertEquals( tree.length, 13 )
    },
    sanitizeResources: false,
    sanitizeOps: false
})


Deno.test({
    name: '01 - Parser can read a larger multi line  type Object', 
    fn: () => {  
        const typeStr = `
        export type ChordType = { 
            init:       boolean
            // checks:     Map<string, () => boolean>, 
            note:       NoteEntry, 
            sharpFlat:  string, 
            chord:      string, 
            majMin:     string, 
            ext:        string, 
            ext2:       string,
            inv:        number,
            minus:      number[],
            bass:       string,
            tie:        boolean, 
          }`
        const parser2 = new Parser( LR, PR, 'reset')
       
        parser2.debug = false
        parser2.reset(typeStr)
        assert( parser2.result.size > 15)
        // assertEquals( parser.result.size, 13 )
        // const tree = parser.getParseTree()
        // assertEquals( tree.length, 13 )
    },
    sanitizeResources: false,
    sanitizeOps: false
})
