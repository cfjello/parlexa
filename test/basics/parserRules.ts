
import { Matcher, MatchRecordExt, ParserRules} from "../../types.ts";
import  LR  from "./lexerRules.ts";



// Type gymnastics
export const parserTokens = [ 
    'reset', 'always', 'assignment', 'rhsAssign', 'intAssign', 'strAssign', 
    'arrAssign', 'assignEnd', 'arrElement', 'arrListElem', 
    'assign4BackTrack', 'assign4Real' ] as const 

export type ParserTokens = typeof parserTokens[number]  

// User defined data for this parser and testing
export type UserData = { 
    comment: string, 
    intWasHere: string, 
    callBackFound: boolean, 
    recId: string, 
    intAssignCB: string, 
    arrAssignCB: Array<string> 
}  

export type LexerTokens = keyof typeof LR 

export type Tokens = LexerTokens | ParserTokens 

// User defined non-terminal for this set of parser rules
export const PR: ParserRules<Tokens, UserData> = {
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
            // ['XXX', '1:m'],
            ['assignment', '1:m'],
        ] 
    },
    assignEnd: {
        multi: '1:1',
        expect: [ 
            [LR.SEMICOLON, '1:1']
            // [LR.SEMICOLON, '1:1', 'xor'],
            // [LR.WSNL, '1:1' ]
        ] 
    },
    intAssign: {
        multi: '0:1',
        expect: [ 
            [LR.INT, '1:1', (_m: MatchRecordExt<Tokens>, s: UserData) => { 
                s.intWasHere = 'integer was here'; 
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
                multi: '0:1', 
                logic: 'xor',
                cb: (m, s) => { s.comment = 'This is parser global user defined data' ;return m }
            } satisfies Matcher<Tokens, UserData>,
            [LR.INT, '0:1', 'xor', (m: MatchRecordExt<Tokens>, u: UserData) => { 
                u.intWasHere = 'integer was here';
                u.callBackFound = true;
                m.intAssignCB = `${m.token} Callback was here`
            }],
            ['arrAssign', '0:1']
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
        cb: (matchRec: MatchRecordExt<Tokens>, userData: UserData) => { 
            matchRec.arrAssignCB = [`${matchRec.value} Callback was here`]
            userData.recId = matchRec.id
            userData.callBackFound = true
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
        multi: '1:m',
        expect: [ 
            ['assign4Real', '1:1', 'xor'],
            ['assign4BackTrack',  '1:1']
        ] 

    },
}

export default PR