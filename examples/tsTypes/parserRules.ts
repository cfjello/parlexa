import { Keys, ParserRules } from "../../interfaces.ts";
import LR from "./lexerRules.ts";

//
// User defined group-tokens for this set of parser rules
//
export type ParserTokens =  'reset' | 'typeObj' | 'typeBody' | 'space' | 
                            'qoutedIdent' |'allways' | 'typeEntry' | 'typeList' | 
                            'typeListSep' | 'typeDef' | 'SQBrackets'
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
            [ LR.NL,  '0:1', 'ignore' ]
        ]
    },
    reset: { 
        multi: '1:m',
        expect: [ 
            [LR.EXPORT, '0:1'],
            [LR.TYPE,   '1:1'],
            [LR.IDENT,  '1:1'],
            [LR.EQSIGN, '1:1'],
            ['typeDef', '1:m']
           
        ] 
    },
    typeDef: {
        multi: '1:m',
        expect: [
            ['typeEntry', '1:1' ],
            ['typeList',  '0:m' ]
        ]
    },
    SQBrackets: {
        multi: '0:m',
        expect: [
            [LR.SQB_BEGIN, '1:1' ],
            [LR.SQB_END, '1:1' ]
        ]
    },
    IDENT: {
        multi: '0:m',
        expect: [ 
            ['SQBrackets', '0:1'] 
        ]
    },
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
    typeList:  {
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
}

export default PR