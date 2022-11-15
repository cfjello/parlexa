import { ArrToObject, Expect, Keys, OnObject, ParserRules } from "../../interfaces.ts";
import LR from "../leadSheet/lexerRules.ts";
//
// User defined group-tokens for this set of parser rules
//
export type ParserTokens = 'reset' | 'header' | 'space' | 'form' |'always' | 'duration' | 'chord' | 
                           'common' | 'commonList' | 'minor' | 'scaleMode' | 'note' | 'scale' | 'testDummy' | 'key'
//
// ParserRules groups (key tokens below) are typed as the combination of the user defined  
// ParserTokens (above) and the LexerRules instanse (LR) keys


const lexerKeys = Object.keys(LR)
type lexKeyType = typeof lexerKeys[number] 


export type Keys2<P,L, A extends readonly string[]> = P | L |  ArrToObject<A,P> | 'NOP' | '__undef__' | 'unknown'
export type ParserRules2<T>  = Record<string, Expect<T>>

// 
export const PR: ParserRules<Keys<ParserTokens, typeof LR>> = {
    // init:  (){ this.self = this },
    always2 : {  
        expect: [
            [ LR.WS , '0:m', 'ignore'],
            [ LR.NL,  '0:m' ]  
        ]
    },
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
            LR.BAR,
            LR.SQ_BRACKET
        ]
    },
    header: {
        expect: [
            [ LR.TITLE,  '0:1' ],
            [ LR.AUTHOR, '0:1' ], 
            [ 'key',  '0:1' ],
            [ LR.FORM,   '0:1' ]
        ] 
    },
    reset: { 
        multi: '1:m',
        expect: [
           'header' ,
           'common', 
            LR.SECTION,
            LR.BAR,
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
    BAR: {
        multi: '1:m',
        expect: [
            [ LR.REPEAT_COUNT, '0:m'],
            [ LR.CHORD_NOTE , '0:1', 'xor'],
            [ LR.REST,        '0:1', 'xor'],
            [ LR.REPEAT_LAST, '0:1', 'xor'],
            [ LR.SQ_BRACKET,  '0:1', 'xor'],
            [ LR.REPEAT_END,  '0:1' ]
        ]
    },
    CHORD_NOTE: {
        multi: '1:1',
        on : { match: 'NL', action: 'break'},
        expect: [
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
}