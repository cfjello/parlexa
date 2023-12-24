import { Keys, Matcher, MatchRecordExt, ParserRules } from "../../types.ts";
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
const _LRKeys = typeof LR


const LRKeys = Object.keys(LR) as const
type AllKeys = ParserTokens & LRKeys
const _oneKey: AllKeys = 'DUMMY'
// export const PR: ParserRules<Keys<ParserTokens, typeof LR>> = {