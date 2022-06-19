import { Keys, ParserRules } from "../../interfaces.ts";
import LR from "./lexerRules.ts";
//
// User defined group-tokens for this set of parser rules
//
export type ParserTokens = 'reset' | 'header' | 'space' | 'form' |'always' | 'duration' | 'chord' | 'common' | 'commonList' 
//
// ParserRules groups (key tokens below) are typed as the combination of the user defined  
// ParserTokens (above) and the LexerRules instanse (LR) keys
// 
export const PR: ParserRules<Keys<ParserTokens, typeof LR>> = {
    always : {  
        expect: [
            [ LR.WS , '0:m', 'ignore'],
            [ LR.NL,  '0:m' ]
        ]
    },
    duration: {     
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
            LR.KEY,
            LR.METER,
            LR.TEMPO,
            LR.MODE,
            LR.TEXT_NOTE,
            LR.TEXT_NOTE2,
            LR.SCALE,
            LR.SWING,
            LR.USE
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
            [ LR.CHORD_NOTE , '1:1', 'xor'],
            [ LR.REST,        '1:1', 'xor'],
            [ LR.REPEAT_LAST, '1:1', 'xor'],
            [ LR.SQ_BRACKET,  '1:1', 'xor'],
            [ LR.REPEAT_END,  '1:1' ]
        ]
    },
    CHORD_NOTE: {
        multi: '1:1',
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
    }
}