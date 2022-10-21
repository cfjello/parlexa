import { assert, assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { Parser } from "../../Parser.ts";
import  LR  from "./lexerRules.ts"
import  PR  from "./parserRules.ts"

export interface IIndexable<T> { [key: string]: T }

Deno.test({
    name: '00 - Parser can read a comma separated list', 
    fn: () => {  
        const typeStr = `NoteType, OtherType, ThirdType, ForthType, FifthType`
        const parser = new Parser( LR, PR, 'typeEntryList')
        parser.debug = false
        parser.reset(typeStr)
        assert( parser.result.size > 13)
        const tree = parser.getParseTree()
        const fifthType = tree.filter( v => v.value === 'FifthType')
        assert( fifthType !== undefined)
        assert( fifthType.length > 0 )
    },
    sanitizeResources: false,
    sanitizeOps: false
})

Deno.test({
    name: '01 - Parser can read TYPE AND and OR Logic ', 
    fn: () => {  
        const typeStr = `NoteType | OtherType & ThirdType`
        const parser = new Parser( LR, PR, 'typeDef')
        parser.debug = false
        parser.reset(typeStr)
        assert( parser.result.size > 13)
        const tree = parser.getParseTree()
        const thirdType = tree.filter( v => v.value === 'ThirdType')
        assert( thirdType !== undefined)
        assert( thirdType.length > 0 )
    },
    sanitizeResources: false,
    sanitizeOps: false
})

Deno.test({
    name: '02 - Parser can read Grouped TYPE AND and OR Logic ', 
    fn: () => {  
        const typeStr = `(NoteType | OtherType) & ThirdType  | ( FifthType & EightsType)`
        const parser = new Parser( LR, PR, 'typeDef')
        parser.debug = false
        parser.reset(typeStr)
        assert( parser.result.size > 13)
        const tree = parser.getParseTree()
    
        const otherType = tree.filter( v => v.value === 'OtherType' )
        assert( otherType !== undefined)
        assert( otherType.length > 0  )

        // console.log(JSON.stringify(tree, undefined, 2))
        assertEquals( otherType[0].offset, 12 )

        const eightsType = tree.filter( v => v.value === 'EightsType' )
        assertEquals( eightsType[0].value,'EightsType' )

    },
    sanitizeResources: false,
    sanitizeOps: false
})

Deno.test({
    name: '03 - Parser can assign Grouped TYPE AND and OR Logic ', 
    fn: () => {  
        const typeStr = `type MyType  = (NoteType | OtherType) & ThirdType  | ( FifthType & EightsType)`
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(typeStr)
        assert( parser.result.size > 13)
        const tree = parser.getParseTree()
    
        const myType = tree.filter( v => v.value === 'MyType' )
        assert( myType !== undefined)
        assert( myType.length > 0  )

        // console.log(JSON.stringify(tree, undefined, 2))
        assertEquals( myType[0].value, 'MyType' )

        const eightsType = tree.filter( v => v.value === 'EightsType' )
        assertEquals( eightsType[0].value,'EightsType' )

    },
    sanitizeResources: false,
    sanitizeOps: false
})

Deno.test({
    name: '04 - Parser can read an Angled and nested TYPE definition', 
    fn: () => {  
        const  typeStr = `Map< string, SomeType>`
        const parser = new Parser( LR, PR, 'typeEntry')
        parser.debug = false
        parser.reset(typeStr)

        assert( parser.result.size > 10)
        const tree = parser.getParseTree()
        const endAngle = tree.filter( v => v.value === '>' )
        assert( endAngle !== undefined)
        assert( endAngle.length > 0  )
        assertEquals( endAngle[0].value, '>' ) 

    },
    sanitizeResources: false,
    sanitizeOps: false
})

Deno.test({
    name: '05 - Parser can read an Angled and nested TYPE definition', 
    fn: () => {  
        const typeStr = `Map< (NoteType | OtherType) & ThirdType , ThirdType> | ( FifthType & EightsType)`
        const parser = new Parser( LR, PR, 'typeDef')
        parser.debug = false
        parser.reset(typeStr)
        assert( parser.result.size > 10)
        const tree3 = parser.getParseTree()
      
        const EightsType = tree3.filter( v => v.value === 'EightsType' )
        assert( EightsType !== undefined)
        assert( EightsType.length > 0  )
        assertEquals( EightsType[0].value, 'EightsType' ) 
    },
    sanitizeResources: false,
    sanitizeOps: false
})

Deno.test({
    name: '06 - Parser can read an Angled and nested TYPE definition', 
    fn: () => {  
        const typeStr = `type MyType = Map< (NoteType | OtherType) & ThirdType , ThirdType  | ( FifthType & EightsType)>`
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(typeStr)

        assert( parser.result.size > 10)
        const tree2 = parser.getParseTree()
        const myType = tree2.filter( v => v.value === 'MyType' )
        assert( myType !== undefined)
        assert( myType.length > 0  )
        assertEquals( myType[0].value, 'MyType' ) 

        const eightsType = tree2.filter( v => v.value === 'EightsType' )
        assert( eightsType !== undefined)
        assert( eightsType.length > 0  )
        assertEquals( eightsType[0].value, 'EightsType' ) 
    },
    sanitizeResources: false,
    sanitizeOps: false
})

Deno.test({
    name: '07 - Parser can fail on bad TYPE definition', 
    fn: () => {  
        const typeStr = `type MyType = Map< (NoteType | OtherType & ThirdType , ThirdType  | ( FifthType & EightsType)>`
        try {
            const parser = new Parser( LR, PR, 'reset')
            parser.debug = false
            parser.reset(typeStr)
        }
        catch( err ) {
            assert( err.indexOf( 'Parse was imcomplete') === 0  )
        }
    },
    sanitizeResources: false,
    sanitizeOps: false
})

Deno.test({
    name: '08 - Parser can read simple TYPE Object', 
    fn: () => {  
        const typeStr = `    
        export type  NoteEntry = { v: NoteType, i: boolean}
        `
        const parser = new Parser( LR, PR, 'reset')
        parser.debug = false
        parser.reset(typeStr)
        assert( parser.result.size > 5)
        const tree = parser.getParseTree()
        const myType = tree.filter( v => v.value === 'boolean' )
        assert( myType !== undefined)
        assert( myType.length > 0  )
    },
    sanitizeResources: false,
    sanitizeOps: false
})

Deno.test({
    name: '09 - Parser can read a larger multi line TYPE Object', 
    fn: () => {  
        const typeStr = `
        export type ChordType09 = { 
            init:       boolean,
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
            tie:        boolean 
          }`
        const parser = new Parser( LR, PR, 'reset')
       
        parser.debug = false
        parser.reset(typeStr)
        assert( parser.result.size > 15)
        const tree = parser.getParseTree()
        const myType = tree.filter( v => v.value === 'boolean' )
        assert( myType !== undefined)
        assert( myType.length > 0  )
    },
    sanitizeResources: false,
    sanitizeOps: false
})

Deno.test({
    name: '10 - Parser can read a nested TYPE Object', 
    fn: () => {  
        const typeStr = `
        export type ChordType10 = { 
            init:       boolean,
            // checks:     Map<string, () => boolean>, 
            note:       NoteEntry, 
            sharpFlat:  string,
            chord: { 
                majMin:     string, 
                ext:        string, 
                ext2:       string,
                inv:        number,
                minus:      number[],
                bass:       string,
            },
            tie:        boolean, 
          }`
        const parser2 = new Parser( LR, PR, 'reset')
       
        parser2.debug = false
        parser2.reset(typeStr)
        assert( parser2.result.size > 250)
        const tree = parser2.getParseTree()
        assert( tree.length >  86 )

        const myType = tree.filter( v => v.value === 'number' )
        assert( myType !== undefined )
        assert( myType.length > 0  )
    },
    sanitizeResources: false,
    sanitizeOps: false
})
