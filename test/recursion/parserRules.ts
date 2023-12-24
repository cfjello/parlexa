import { Keys, Matcher, MatchRecordExt, ParserRules } from "../../types.ts";
import LR from "./lexerRules.ts";
//
// User defined group-tokens for this set of parser rules
//
/*
export type ParserTokens_ =  'reset' | 'allways' | 
                            'assignment' | 'rhsAssign' | 
                             'intAssign' | 'strAssign' |
                            'arrAssign' | 'objAssign' | 'assignEnd' | 
                            'arrElement' | 'arrListElem' | 'typeBody' | 'typeBodyList'
*/

const ParserTokensArr = [
    'reset' , 'allways' ,
    'assignment' , 'rhsAssign' ,
    'intAssign' , 'strAssign' ,
    'arrAssign' , 'objAssign' , 'assignEnd' , 
    'arrElement' , 'arrListElem' , 
    'typeBody' , 'typeBodyList',
    'leftRecursive'
] as const;

export type ParserTokens = typeof ParserTokensArr[number];

//
// ParserRules groups (key tokens below) are typed as the combination of the user defined  
// ParserTokens (above) and the LexerRules instanse (LR) keys
// 
export const PR: ParserRules<Keys<ParserTokens, typeof LR>> = {
    always : {  
        multi: '0:m',
        expect: [
            [ LR.WS , '0:1', 'ignore'],
            [ LR.COMMENT , '0:1', 'ignore'],
            [ LR.NL,  '0:1' ]
        ]
    },
    reset: { 
        multi: '1:m',
        expect: [ 
            ['assignment', '0:m'],
        ] 
    },
    assignEnd: {
        multi: '1:1',
        expect: [ 
            [LR.SEMICOLON, '1:1', 'or'],
            [LR.COMMA, '1:1']
        ] 
    },
    intAssign: {
        multi: '0:1',
        expect: [ 
            [LR.INT, '1:1'],
        ],
        cb: (m) => { 
            // deno-lint-ignore no-explicit-any
            (m as MatchRecordExt<any>).intAssignCB = `${m.value} Callback was here`
            return m 
        }
    },
    strAssign: {
        multi: '0:1',
        expect: [ 
            [LR.STR, '1:1'],
        ] 
    },

    arrElement: {
        expect: [ 
            {   match: LR.STR, 
                multi: '0:1', 
                logic: 'or',
                cb: (m) => { return m }
            // deno-lint-ignore no-explicit-any
            } as Matcher<any>,
            [LR.INT, '0:1', 'or', (m) => { return m } ] ,
        ] 
    },
    
    arrListElem: {
        expect: [ 
            [LR.COMMA, '1:1'],
            [ 'arrElement', '1:1'],
        ] 
    },

    arrAssign: {
        expect: [ 
            [ LR.SQB_BEGIN, '1:1'],
            ['arrElement', '1:1'],
            ['arrListElem', '0:m'],
            [ LR.SQB_END, '1:1']
        ] 
    },

    rhsAssign: {
        multi: '1:1',
        expect: [ 
            ['intAssign', '1:1', 'or'],
            ['strAssign',   '1:1', 'or'],
            ['arrAssign',  '1:1', 'or'],
            ['objAssign', '1:1']     
        ],
    },
    assignment: {
        multi: '0:m',
        expect: [ 
            [LR.LET, '1:1'],
            [LR.IDENT,  '1:1'],
            [LR.EQSIGN, '1:1'],
            ['rhsAssign', '1:m'],
            ['assignEnd', '1:1']
        ] 
    },
    objAssign:  {
        multi: '1:m',
        expect: [
            [LR.CUB_BEGIN, '1:1'],
            ['typeBody',   '0:1' ],
            [LR.CUB_END,   '1:1']
        ]
    },
    typeBody: {
        multi: '0:m',
        expect: [   
            [LR.IDENT, '1:1' ],
            [LR.COLON, '1:1'],
            ['rhsAssign', '1:1'],
            ["typeBodyList", '0:m']
        ]
    },
    typeBodyList: {
        expect: [
            [LR.COMMA, '1:1'],
            ['typeBody', '1:1']
        ]
    },
    leftRecursive: {
        multi: '0:m',
        expect: [
            ['leftRecursive', '0:m'],
            [LR.COMMA, '1:1']
        ]
    }
}

export default PR