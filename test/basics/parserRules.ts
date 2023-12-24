import { Matcher, MatchRecordExt, ParserRules } from "../../types.ts";
import LR from "./lexerRules.ts";
//
// User defined non-terminal for this set of parser rules
//
export type ParserTokens =  
    'reset' | 'allways' | 'assignment' | 'rhsAssign' | 
    'intAssign' | 'strAssign' | 'arrAssign' | 'objAssign' | 
    'assignEnd' | 'arrElement' | 'arrListElem' | 'assign4BackTrack' | 'assign4Real'

//
// The definition of the rules
// 
export type T = ParserTokens & keyof typeof LR
export const PR: ParserRules<T> = {
    always : {  
        multi: '0:m',
        expect: [
            [ LR.WS , '0:1', 'ignore'],
            [ LR.NL,  '0:1' ]
        ]
    },
    reset: { 
        multi: '1:m',
        expect: [ 
            ['assignment', '1:m'],
        ] 
    },
    assignEnd: {
        multi: '1:1',
        expect: [ 
            [LR.SEMICOLON, '1:1', 'xor'],
            [LR.WSNL, '1:1' ]
        ] 
    },
    intAssign: {
        multi: '0:1',
        expect: [ 
            [LR.INT, '1:1', (m, s) => { 
                s.intWasHere = 'integer was here'; 
                return m 
            }],
            [ 'assignEnd', '1:1' ]
        ],
    },
    strAssign: {
        multi: '0:1',
        expect: [ 
            [LR.STR, '1:1'],
            ['assignEnd', '1:1']
        ] 
    },
    arrElement: {
        // breakOn: [LR.COMMA, LR.SQB_END],
        multi: '1:1',
        expect: [ 
            {   match: LR.STR, 
                multi: '1:1', 
                logic: 'xor',
                cb: (m, s) => { s.comment = 'This is parser global user defined data' ;return m }
            // deno-lint-ignore no-explicit-any
            } as Matcher<any>,
            [LR.INT, '1:1', 'xor', (m, s) => { 
                s.intWasHere = 'integer was here';
                s.callBackFound = true;
                // deno-lint-ignore no-explicit-any
                (m as MatchRecordExt<any>).intAssignCB = `${m.type} Callback was here`
                return m 
            }],
            ['arrAssign', '1:1']
        ] 
    },

    arrListElem: {
        multi: '0:m',
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
        ],
        cb: (m,s) => { 
            (m as MatchRecordExt<T>).arrAssignCB = `${m.value} Callback was here`
            s.recId = m.id
            s.callBackFound = true
            return m 
        }
    },

    rhsAssign: {
        multi: '1:1',
        expect: [ 
            ['intAssign', '1:1', 'xor'],
            ['strAssign',   '1:1', 'xor'],
            ['arrAssign',  '1:1'],
            // ['objAssign', '1:1']     
        ],
    },
    
    assign4Real: {
        multi: '1:1',
        expect: [ 
            [LR.LET, '1:1'],
            [LR.IDENT,  '1:1'],
            [LR.EQSIGN, '1:1'],
            ['rhsAssign', '1:m']
        ] 
    },
    assign4BackTrack: {
        multi: '1:1',
        expect: [ 
            [LR.LET, '1:1'],
            [LR.IDENT,  '1:1'],
            [LR.EQSIGN, '1:1'],
            [LR.DUMMY, '1:1']
        ] 
    },
    assignment: {
        multi: '1:1',
        expect: [ 
            ['assign4Real', '1:1', 'xor'],
            ['assign4BackTrack',  '1:1']
        ] 

    },
}

export default PR