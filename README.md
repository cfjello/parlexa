# Parlexa for DENO

Parlexa is a Lexer and Parser in Deno that takes advantage of TypeScript's type system to provide an tight integration between the two. It also does not require you to do any generation steps, instead it runs directly after importing the Lexer and Parser rules.

The algorithm is a top down recursive parser with extra bells and whistles that are described below. 

### Demo

Run the `demo.ts` file found in the `/examples` directory:
```
deno run ./demo.ts
```
The `demo.ts` file looks like this:
```
import { angie } from "./angieData.ts"   // The input data
import { Parser } from "../Parser.ts"
import  LR  from "./lexerRules.ts"
import { PR } from "./parserRules.ts"

const parser = new Parser( LR, PR, 'reset')
parser.debug = false                    // The default
parser.reset(angie)
const tree = parser.getParseTree()
console.log(`${JSON.stringify(tree, undefined, 2)}`)
```
The step by step walkthrough if this file is like this:

1. Import some input data
2. Import the Parser
3. Import the LexerRules - the regular expressions called by the Parser to match the input data
4. Import the ParserRules - this defines the grammer of what is being parsed 
5. Instantiate a new Parser using the LexerRules, ParserRules and a *top-level non-terminal token* starting point (`'reset'` in the above example)
6. The parser will run once `parser.reset(angie)` is called, the argument of this call being the input-string to parse
7. The `parser.getParseTree()` returns the resulting successfully parsed nodes as an Array. If `parser.debug = true`, the complete parser tree is returned. This can then be pretty-printed

### Parlexa Output 

The `parser.getParseTree()` function returns an array of parsed entries, presented here with comments:

```
   {
    "id": "01FXA5DWRP6FQ8Y16F6Y4CX3YV", // An ULID identifier for this entry, ULID is a sortable version of an UUID
    "type": "AUTHOR",                   // The type/name of the matched Token
    "value": "Rolling Stones",          // The the value field of the match
    "text": "Author: Rolling Stones",   // The whole text of the match
    "offset": 13,                       // The start position of this match
    "newPos": 35,                       // The new position after the match
    "ofLen": 2062,                      // The length of the whole match string
    "line": 2,                          // Line number of the match
    "col": 1,                           // Column number within the line of the match
    "matched": true,                    // Is this a match. Setting 'parser.debug = true' will include the failed matches
    "parent": "01FXA5DWRMPD8TR5HEFJ1FF72F", // An ULID identifier for the parent parser node
    "level": 2,                         // A parser depth level number
    "children": [],                     // An ULID array of identifiers for any child nodes of this node
    "token": "Author",                  // Extra field, defined within the LexerRules
    "colon": ":",                       // Extra field, defined within the LexerRules
    "ident": "01.01.03"                 // A sortable hierarchy identifier, placing the node within the parser tree  
  },
  ```

### Lexer Rules

This lexer is inspired by the mpm package *moo*, but is does away with the limitations that *moo* imposes on the use of regular expression. Also, it does not run the lexer before the parser, rather the lexer matching patterns are called in context from within the parser.

Lexer rules are defined that utilizes the **xregexp** deno package. This is a great package that allows for regular expressions with support for unicode, named match-groups that will be available within the parser and regexp style look-ahead:

```
// @deno-types='https://deno.land/x/xregexp/types/index.d.ts'
import XRegExp from  'https://deno.land/x/xregexp/src/index.js'
import { LexerRules } from "../interfaces.ts";
const LR: LexerRules = {
    TITLE:      XRegExp( '(?<token>Title)[ \\t]*(?<colon>:)[ \\t]*(?<value>[\\p{L}0-9\\- \\t]+?)[ \\t]*(?=$|\\n)', 'xuig' ),
    AUTHOR:     XRegExp( '(?<token>Author)[ \\t]*(?<colon>:)[ \\t]*(?<value>[\\p{L}0-9\\- \\t]+?)[ \\t]*(?=$|\\n)', 'xuig' ),
    FORM:       XRegExp( '(?<token>Form)[ \\t]*(?<colon>:)[ \\t]*(?=$|\\n)', 'gi' ),
    LIST_ENTRY: {
        match:  XRegExp( '(?<token>\-)[ \\t]*(?<value>[\\p{L}0-9\\- \\t]+?)[ \\t]*(?=$|\\n)', 'xuig'),
        multi: '1:m'
    },
    (...)
```

The `LexerRules` entries comes in two form:
- A named `XRegExp` entry like `TITLE: XRegExp(...)`, or
- An object containing a `match: XRegExp` field and a `multi` field that defines the local cardinality.
 
The cardinality/multiplicity of the match is how many matches to expect, that is the minimun and maximum given as a number (or 'm' for many). The format is `'0:m'` for zero or many (the default) or i.e. `'1:1'` for one and only one or `'2:7'` for a minimum of 2 and a maximum of 7.

The lexer match object also provides an optional callback function the allows you to modify the matched object:

```
TEXT2:   { 
        match: XRegExp( '(?<value0>[\\p{L}0-9\\- \\t\\p{P}]+?_)(?<value>[\\p{L}0-9\\- \\t\\p{P}]+)[ \\t]*(?=$|\\n)', 'xug' ),
        // deno-lint-ignore no-explicit-any
        cb: ( e: any ) => { 
            e.value = e.value0.trim() + e.value.trim()
            return e
        }
    },        
```

The LexerRules is just a set of XRegExp matching patterns that will be grouped within the ParserRules. They will be called from the parser when applicable to the parser context.

Look at `'./examples/lexerRules.ts'` for a more examples.

### Parser Rules

As Parser Rules are defined as a set of *terminal symbols*, that refers directly to individual Lexer Rule entries and a set of *non-terminal symbols*, which is a set of user defined parser tokens.

In it's most simple form a LHS (left hand side) non-terminal token refers directly to a set of RHS (right hand side) Lexer Rules:

```
    common: {
        expect: [
            LR.KEY,
            LR.METER,
            LR.TEMPO,
            LR.TEXT_NOTE,
            LR.SCALE,
            LR.SWING
        ]
    },
```
Here, the LR.KEY (...) entries within the `expect` array are direct JavaScript references to the Lexer Rules (LR) object

Besides Lexer Rules the RHS can also refer to other **non-terminal** LHS symbols:

```
reset: { 
        multi: '1:m',
        expect: [
           'header' ,
           'common', 
            LR.SECTION,
            LR.BAR,
            LR.TEXT,
            LR.TEXT2,
        ] 
    },
 ```
 The `'reset'` expect array also has a defined cardinality/multiplicity of `'1:m'`, one or many, that the parser will check and fail the branch if the conditioon is not meet.

A sligthly more complicated example shows how you can specify the cardinality of each individual expect-entry. Also note, that the first two entries are in an exclusive OR relationship, denoted by the `'xor'`, meaning that either one and only one `LR.DURATION` or one and only one `LR.DURATION2` must be matched:

```
duration: {     
        expect: [ 
            [ LR.DURATION,     '1:1', 'xor' ] , 
            [ LR.DURATION2,    '1:1' ],
            [ LR.DURATION_ADD, '0:m' ]
        ] 
    },
```

Other logical operators, besides `'xor'`, are not supported since the cardinalities of the entries is a good way to specify any OR and AND relationships.

A *special* case is the `'always'` token, that will be matched always before each of the other matches. This is normally used to remove any leading white space:
```
    always : {  
        expect: [
            [ LR.WS , '0:m', 'ignore'],
            [ LR.NL,  '0:m' ]
        ]
    },
```
Note the `'ignore'` as part of `LR.WS` that matches spaces and tabs. This has the effect that `LR.WS` will not be part of the parser tree output. In contrast, `LR.NL` that matches newlines will be part of the parser output. 

A RHS Lexer Rule reference, i.e. `LR.FORM` may also have a LHS Parser Rule: 
```
    FORM: {
        multi: '1:m',
        expect: [ 
            [LR.LIST_ENTRY, '1:m' ]
        ]
    },
```
In this case, when the Lexer Rule `LR.FORM` is matched, then the RHS Parser Rule `FORM` is automatically called (in this specific case we will try to match a list of one or more list entries).

### Write you own set of Parser Rules

First import some needed TypeScript type and a set of LexerRules:
```
import { Keys, ParserRules } from "../interfaces.ts";
import LR from "./lexerRules.ts";
```
Then define the parser group-token you need as a TypeScript type, that is the LHS non-terminal symbols to be used within the parser:
```
export type ParserTokens = 'reset' | 'header' | 'space' | 'form' |'always' | 'duration' | 'chord' | 'common' | 'commonList' 
```
Now you can instantiate the ParserRules object:
```
export const PR: ParserRules<Keys<ParserTokens, typeof LR>> = {
    always : {  
        expect: [
            [ LR.WS , '0:m', 'ignore'],
            [ LR.NL,  '0:m' ]
        ]
    },
    reset: { 
        multi: '1:m',
        expect: [
           'header' ,
           'common', 
            LR.SECTION,
            LR.BAR,
            LR.TEXT,
            LR.TEXT2,
        ] 
    },
    (...)
```

The `Keys` type above is a Typescript type that allows you to access and use both your `ParserTokens` and your `LR:LexerRules` within the `PR:ParserRules` object.

For more details, have a look at the `'./examples/parserRules.ts'` file.

### Debug your Parser

To see how the parser runs, you can set the debug flag `parser.debug = true`. This will give you information about what the parser is trying to match and on calling `parser.getParseTree()` it will return the complete parser tree including the failed branches. This can then be pretty-printed.

The output you get looks like this:
```
TRYING: WS at 358 against: "
|Am     |E7      | Gsus4 G Fs"
TRYING: NL at 358 against: "
|Am     |E7      | Gsus4 G Fs"
MATCHING: NL
NEW POS: 359
TRYING: NL at 359 against: "|Am     |E7      | Gsus4 G Fsu"
TRYING: WS at 359 against: "|Am     |E7      | Gsus4 G Fsu"
TRYING: TEXT at 359 against: "|Am     |E7      | Gsus4 G Fsu"
(...)
TRYING: SECTION at 359 against: "|Am     |E7      | Gsus4 G Fsu"
TRYING: BAR at 359 against: "|Am     |E7      | Gsus4 G Fsu"
MATCHING: BAR
```
