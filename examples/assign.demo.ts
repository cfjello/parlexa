import { Parser } from "../Parser.ts";
import  LR  from "../test/basics/lexerRules.ts"
import  PR  from "../test/basics/parserRules.ts"
const input = `     let myVar = [ 1234, 'I am a string', [ 5678, 6789, 78910], 'ÆØÅ string with numbers 123456' ]`;
const parser = new Parser( LR, PR, 'reset')
parser.debug = false
parser.reset(input)
const tree = parser.getParseTree()
console.log(`${JSON.stringify(tree, undefined, 4)}`)