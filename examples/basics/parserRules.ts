import { Keys, ParserRules } from "../../interfaces.ts";
import LR from "./lexerRules.ts";

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
            [LR.SEMICOLON, '1:1', 'xor'],
            [LR.NL, '1:1' ]
        ] 
    },
    intAssign: {
        multi: '0:1',
        expect: [ 
            [LR.INT, '1:1'],
            [ 'assignEnd', '1:1' ]
        ] 
    },
    strAssign: {
        multi: '0:1',
        expect: [ 
            [LR.STR, '1:1'],
            ['assignEnd', '1:1']
        ] 
    },

    arrElement: {
        expect: [ 
            [LR.STR, '1:1', 'xor'],
            [LR.INT, '1:1', 'xor'],
            ['arrAssign', '1:1']
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
            ['intAssign', '1:1', 'xor'],
            ['strAssign',   '1:1', 'xor'],
            ['arrAssign',  '1:1'],
            // ['objAssign', '1:1']     
        ] 
    },
    assignment: {
        multi: '1:1',
        expect: [ 
            [LR.LET, '1:1'],
            [LR.IDENT,  '1:1'],
            [LR.EQSIGN, '1:1'],
            ['rhsAssign', '1:m']
        ] 
    },
        /*
    PRIMARY: {
        multi: '0:m',
        expect: [ 
            ['SQBrackets', '0:1'] 
        ]
    },
    

    typeEntry : {
        expect: [
            ['typeObj', '1:1', 'xor' ],
            [LR.IDENT,  '1:1', 'xor'],
            ['qoutedIdent', '1:1']
        ]
    },
    qoutedIdent: {
        expect: [
            [LR.QIDENT, '1:1'],
            [LR.IDENT,  '1:1'],
            [LR.QIDENT, '1:1']
        ]
    },
    typeListSep: {
        multi: '1:1',
        expect: [
            [ LR.OR,     '1:1', 'xor'],
            [ LR.AMBERS, '1:1']
        ]
    },
    commaList:  {
        multi: '0:m',
        expect: [
            ['typeListSep', '1:1'],
            ['typeEntry', '1:1']
        ]
    },
    typeObj:  {
        multi: '0:1',
        expect: [
            [LR.CUB_BEGIN,   '1:1'],
            ['typeBody',    '1:1' ],
            [LR.CUB_END,    '1:1']
        ]
    },
    typeBody: {
        multi: '1:m',
        expect: [ 
            [LR.COMMA, '0:1', 'xor'],
            [LR.IDENT, '1:1' ],
            [LR.COLON, '1:1'],
            [LR.PRIMARY, '1:1', 'xor'],
            [LR.IDENT, '1:1']
        ]
    },
    */
}

export default PR