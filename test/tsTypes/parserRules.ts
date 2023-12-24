import { Keys, ParserRules } from "../../types.ts";
import LR from "./lexerRules.ts";

//
// User defined group-tokens for this set of parser rules
//
export type ParserTokens =  'reset' | 'typeObj' | 'typeBody' | 'space' | 
                            'qoutedIdent' | 'typeEntry' | 'typeList' | 
                            'typeLogic' | 'typeDef' | 'SQBrackets' |  'typeBodyList' |
                            'inlineType' |'typeLogicList' | 'identifier' | 'typeBodyEntry' | 'typeEntryList' |
                            'typeDefList' | 'typeObjDef'

// ParserRules groups (key tokens below) are typed as the combination of the user defined  
// ParserTokens (above) and the LexerRules instanse (LR) keys
// 
export type T = ParserTokens & keyof typeof LR
export const PR: ParserRules<T> = {
    always : {  
        multi: '0:m',
        expect: [
            [ LR.WS , '0:1', 'ignore'],
            [ LR.COMMENT , '0:1', 'ignore'],
            [ LR.NL,  '0:1', 'ignore' ]
        ]
    },
    //
    // root assignment of a type
    reset: { 
        multi: '1:m',
        expect: [ 
            [LR.EXPORT, '0:1'],
            [LR.TYPE,   '1:1'],
            [LR.LHS_IDENT,  '1:1'],
            [LR.EQSIGN, '1:1'],
            ['typeDef', '1:m']
           
        ] 
    },
    qoutedIdent: {
        multi: '0:1',
        expect: [
            [LR.STR1, '1:1', 'xor'],
            [LR.STR2,  '1:1', 'xor'],
            [LR.STR3, '1:1']
        ]
    },
    typeList:  {
        multi: '1:m',
        expect: [
            [LR.COMMA, '1:1'],
            ['typeEntry' , '1:1']
        ]
    },
    typeEntryList : {
        expect: [
            ['typeEntry',  '1:1'],
            ['typeList', '0:m']
        ]
    },
    // A basic type identifier or type object 
    typeEntry : {
        expect: [
            [LR.IDENT,  '1:1', 'xor'],
            ['qoutedIdent', '1:1', 'xor'],
            ['typeObj', '1:1' ]
        ]
    },
    typeLogicList:  {
        multi: '0:m',
        expect: [
            [ LR.OR,     '1:1', 'or'],
            [ LR.AMBERS, '1:1'],
            ['typeDef', '1:1'],
        ]
    },
    typeDefList: {
        multi: '0:m',
        expect: [
            [ LR.COMMA, '1:1'],
            [ 'typeDef', '0:m'],
        ]
    },
    typeDef: {
        multi: '0:m',
        expect: [
            [LR.ROUND_BEGIN,'0:1'], 
            ['typeEntry', '1:1' ],
            ['typeLogicList', '0:m'],
            [LR.ROUND_END, '0:1'],
            // ['typeDefList', '0:m' ],
        ]
    },
    typeObjDef: {
        multi: '0:m',
        expect: [
            [LR.ROUND_BEGIN,'0:1'], 
            ['typeEntry', '1:1' ],
            ['typeLogicList', '0:m'],
            [LR.ROUND_END, '0:1']
        ]
    },
    SQBrackets: {
        multi: '0:m',
        expect: [
            [LR.SQUARE_BEGIN, '1:1' ],
            [LR.SQUARE_END, '1:1' ]
        ]
    },
    inlineType: {
        multi: '0:1',
        expect: [
            [LR.ANGLE_BEGIN, '1:1' ],
            [ 'typeDef', '1:1' ],
            [ 'typeDefList', '0:m'],
            [LR.ANGLE_END, '1:1' ]
        ]
    },
    identifier: {
        expect: [
            [LR.LHS_IDENT, '1:1', 'xor'],
            [LR.IDENT, '1:1']
        ]
    },
    IDENT: {
        multi: '0:1',
        expect: [ 
            ['inlineType', '0:1'],
            ['SQBrackets', '0:1'] 
        ]
    },
    typeObj:  {
        multi: '0:1',
        expect: [
            [LR.CURLY_BEGIN,   '1:1'],
            ['typeBody',    '1:1' ],
            [LR.CURLY_END,    '1:1']
        ]
    },
    typeBodyList: {
        multi: '0:m',
        expect: [
            [LR.COMMA,  '0:1', 'xor'],
            [LR.SIMICOLON,  '0:1' ],
            ['typeBody', '0:1' ]
        ]
    },
    typeBody: {
        multi: '0:m',
        expect: [ 
            [LR.LHS_IDENT,  '1:1' ],
            [LR.COLON,  '1:1'],
            ['typeObjDef',  '1:1'],
            ['typeBodyList',  '0:m'],
        ]
    }
}

export default PR