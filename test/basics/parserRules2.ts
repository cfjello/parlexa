import { Keys, Matcher, MatchRecordExt, ParserRules } from "../../interfaces.ts";
import LR2 from "./lexerRules2.ts";

//
// User defined group-tokens for this set of parser rules
//
export type ParserTokens =  'reset' | 'allways' | 
                            'assignment' | 'rhsAssign' | 
                             'intAssign' | 'strAssign' |
                            'arrAssign' | 'objAssign' | 'assignEnd' | 
                            'arrElement' | 'arrListElem'
                            
                            
                            /*|
                            'typeBody' | 'space' | 
                            'qoutedIdent' | 'rhsAssign' | 'typeList' | 
                            'typeListSep' | 'typeDef' | 'SQBrackets'
                            */
//
// ParserRules groups (key tokens below) are typed as the combination of the user defined  
// ParserTokens (above) and the LexerRules instanse (LR) keys
// 
export const PR: ParserRules<Keys<ParserTokens, typeof LR2>> = {
    always : {  
        multi: '0:m',
        expect: [
            [ LR2.WS , '0:1', 'ignore'],
            [ LR2.NL,  '0:1' ]
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
            [LR2.SEMICOLON, '1:1', 'xor'],
            [LR2.NL, '1:1' ]
        ] 
    },
    intAssign: {
        multi: '0:1',
        expect: [ 
            [LR2.INT, '1:1', (m, s) => { 
                s.intWasHere = 'integer was here'; 
                // (m as MatchRecordExt).intAssignCB = `${m.token} Callback was here`
                return m 
            }],
            [ 'assignEnd', '1:1' ]
        ],
    },
    strAssign: {
        multi: '0:1',
        expect: [ 
            [LR2.STR, '1:1'],
            ['assignEnd', '1:1']
        ] 
    },
    arrElement: {
        expect: [ 
            {   match: LR2.STR, 
                multi: '1:1', 
                logic: 'or',
                cb: (m, s) => { s.comment = 'This is parser global user defined data' ;return m }
            } as Matcher,
            [LR2.INT, '1:1', 'or', (m, s) => { 
                s.intWasHere = 'integer was here'; 
                (m as MatchRecordExt).intAssignCB = `${m.type} Callback was here`
                // console.log( `m for LR2.INT: ${JSON.stringify(m)}`)
                return m 
            }],
            ['arrAssign', '1:1']
        ] 
    },

    arrListElem: {
        expect: [ 
            [LR2.COMMA, '1:1'],
            [ 'arrElement', '1:1'],
        ] 
    },

    arrAssign: {
        expect: [ 
            [ LR2.SQB_BEGIN, '1:1'],
            ['arrElement', '1:1'],
            ['arrListElem', '0:m'],
            [ LR2.SQB_END, '1:1']
        ],
        cb: (m,s) => { 
            (m as MatchRecordExt).arrAssignCB = `${m.value} Callback was here`
            s.recId = m.id
            s.callBackFound = true
            return m 
        }
    },

    rhsAssign: {
        multi: '1:1',
        expect: [ 
            ['intAssign', '1:1', 'or'],
            ['strAssign',   '1:1', 'or'],
            ['arrAssign',  '1:1'],
            // ['objAssign', '1:1']     
        ],
    },
    assignment: {
        multi: '1:1',
        expect: [ 
            [LR2.LET, '1:1'],
            [LR2.IDENT,  '1:1'],
            [LR2.EQSIGN, '1:1'],
            ['rhsAssign', '1:m']
        ] 
    },
}

export default PR