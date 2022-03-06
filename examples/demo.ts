import { angie } from "./angieData.ts"
import { Parser } from "../Parser.ts";
import  LR  from "./lexerRules.ts"
import { PR } from "./parserRules.ts"

const parser = new Parser( LR, PR, 'reset')
parser.debug = false
parser.reset(angie)
const tree = parser.getParseTree()
console.log(`${JSON.stringify(tree, undefined, 2)}`)