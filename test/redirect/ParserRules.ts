import { ArrToObject, Expect, Keys, ParserRules } from "../../interfaces.ts";
import LR from "../leadSheet/lexerRules.ts";
//
// User defined group-tokens for this set of parser rules
//
export type ParserTokens = 'reset' | 'header' | 'space' | 'form' |'always' | 'duration' | 'chord' | 
                           'common' | 'commonList' | 'minor' | 'scaleMode' | 'note' | 'scale' | 
                           'testDummy' | 'key' | 'keyCmd' | 'barLine' | 'barEntry'
//
// ParserRules groups (key tokens below) are typed as the combination of the user defined  
// ParserTokens (above) and the LexerRules instanse (LR) keys


const lexerKeys = Object.keys(LR)
type lexKeyType = typeof lexerKeys[number] 


export type Keys2<P,L, A extends readonly string[]> = P | L |  ArrToObject<A,P> | 'NOP' | '__undef__' | 'unknown'
export type ParserRules2<T>  = Record<string, Expect<T>>

// 
export const PR: ParserRules<Keys<ParserTokens, typeof LR>> = {
    // init: { },
    always: {  
        expect: [
            [ LR.WS , '0:m', 'ignore'],
            [ LR.NL,  '0:m' ]
        ]
    },
    duration: {    
        multi: '0:m', 
        expect: [ 
            [ LR.DURATION,     '1:1', 'xor' ] , 
            [ LR.DURATION2,    '1:1' ],
            [ LR.DURATION_ADD, '0:m' ]
        ]
    },
    SECTION: { 
        expect: [
            'barLine',
            LR.SQ_BRACKET
        ]
    },
    header: {
        expect: [
            [ LR.TITLE,  '0:1' ],
            [ LR.AUTHOR, '0:1' ], 
            [ 'keyCmd',  '0:1' ],
            [ LR.FORM,   '0:1' ]
        ] 
    },
    reset: { 
        multi: '1:m',
        expect: [
           'header' ,
           'common', 
            LR.SECTION,
            'barLine',
            LR.TEXT
        ] 
    },
    FORM: {
        multi: '1:m',
        expect: [ 
            [LR.LIST_ENTRY, '1:m' ]
        ]
    },
    commonList : {
        multi: '1:m',
        expect: [
            [ 'common', '1:1' ],
            [ LR.COMMA, '1:1'  ]
        ]
    }, 
    common: {
        expect: [
            'key',
            LR.METER,
            LR.TEMPO,
            LR.MODE,
            LR.TEXT_NOTE,
            LR.TEXT_NOTE2,
            'scale',
            LR.SWING,
            LR.USE
        ]
    },
    testDummy:  { 
        expect: [
            [ LR.IN_BRACKET, '1:1'],
            [ LR.IN_KEY, '1:1', 'xor'],
            [ LR.IN_METER, '1:1', 'xor'],
            [ LR.IN_SWING, '1:1'],
            [ LR.COLON, '1:1'],
            [ LR.IN_KEY_RHS, '1:1', 'or'],
            [ LR.IN_METER_RHS, '1:1', 'or'],
            [ LR.IN_SWING_RHS, '1:1'],
            [ LR.IN_BRACKET_END, '1:1']
        ]
    },
    SQ_BRACKET: {
        expect: [ 
            [ 'commonList', '0:m'],
            [ 'common',     '1:1'],
            [ LR.SQ_BRACKET_END]
        ]
    },
    barEntry: {
        multi: '1:m',
        expect: [
            [ 'chord' , '1:1', 'xor'],
            [ LR.REST,        '1:1', 'xor'],
            [ LR.REPEAT_LAST, '1:1'],
        ]
    },
    barLine: {
        multi: '1:m',
        line: true,
        expect: [
            [ LR.BAR, '1:2'],
            [ LR.REPEAT_COUNT, '0:1' ],
            [ 'barEntry' , '0:m'],
            [ LR.SQ_BRACKET,  '0:1' ],
            [ LR.REPEAT_END,  '0:1' ]
        ]
    },
    'chord': {
        multi: '1:m',
        expect: [
            [ LR.CHORD_NOTE, '1:1' ],
            LR.CHORD_TYPE,
            LR.CHORD_EXT,
            LR.CHORD_EXT2,
            LR.SQ_BRACKET,
            LR.CHORD_BASS,
            LR.CHORD_MINUS_NOTE,
            [ 'duration', '0:1' ],
            LR.GROOVE_ADJUST
        ]
    },
    REST: {
        expect: [
            [ 'duration', '0:1']
        ]
    },
    note: {
        expect: [
            [LR.NOTE_UPPER, 'xor'],
            [LR.NOTE_LOWER, 'xor'],
            [LR.NOTE_BOTH]
        ]
    },
    minor: {
        expect: [
            [LR.MINOR_MOD, '0:1'],
            [LR.MINOR, '1:1']
        ]
    },
    scaleMode: {
        multi: '1:1',
        expect: [
            [LR.NOTE_BOTH, '1:1'],
            [LR.MODE, '0:1', 'xor'],
            ['minor', '0:1', 'xor'],
            [LR.MAJOR, '0:1']
        ]
    },
 
    scale: {
        multi: '0:1',
        expect: [
            [LR.SCALE,    '1:1' ],
            ['scaleMode', '1:1']
        ],
    },
    key: {
        multi: '0:1',
        expect: [
            [LR.KEY, '1:1'],
            ['scaleMode', '0:1']
        ]
    },
    keyCmd: {
        multi: '0:1',
        line: true,
        expect: [
            'key'
        ]
    },
}