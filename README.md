# Parlexa for DENO - Pre-Release for testing with other projecs! WORK IN PROGRESS

Parlexa is a Lexer and Parser in Deno that takes advantage of TypeScript's type system to provide an tight integration between the two. It also does not require you to do any generation steps, instead it runs directly after importing the Lexer and Parser rules.

The algorithm is a top down recursive non-determistic parser with backtracking. It also has some additional bells and whistles that are described below. It is not not Left Recursive, so write your parser rules accordingly.

**Note: This new version has some breaking changes** 


# Overview

You specify a a set of Lexer Rules and a set of Parser Rules and the Parser executes directly based on these rules, with no compilation step involved:
```
import { Parser } from "https://deno.land/x/parlexa/mod.ts"
import  LR        from "./lexerRules.ts"
import { PR }     from "./parserRules.ts"
import { data }   from "../yourInputData.ts"

const parser = new Parser( LR, PR, 'reset')
```
Here `'reset'` is the named top level parser token. After that you can run the parser against some input data and get the result:

```
parser.reset(data)
const tree = parser.getParseTree()
console.log(`${JSON.stringify(tree, undefined, 2)}`)
```

Here is the step by step walkthrough:

1. Import the Parser
2. Import the LexerRules - the regular expressions to be called by the Parser to match the input data
3. Import the ParserRules - this defines the grammer for the parser 
4. Import some input data
5. Instantiate a new Parser using the LexerRules, ParserRules and a *top-level non-terminal token* starting point (`'reset'` in the above example)
6. The parser will run once `parser.reset(angie)` is called, the argument of this call being the input-string to parse
7. The `parser.getParseTree()` returns the resulting successfully parsed nodes as an Array. If `parser.debug = true`, the complete parser tree, including failed branches, is returned. 
8. The parser tree is flattened, but with an `ident` that identifies every nodes place within the parsing hierarchy.


### Demo

Run the demo directly from your terminal:
```
deno run -A "https://deno.land/x/parlexa/examples/demo.ts"
```

### Parlexa Output 

The `parser.getParseTree()` function returns an array of parsed entries, here one record is presented here with comments:

```
   {
    "id": "01FXA5DWRP6FQ8Y16F6Y4CX3YV", // An ULID identifier for this entry, ULID is a sortable version of an UUID
    "type": "AUTHOR",                   // The type/name of the matched Token
    "value": "Rolling Stones",          // The the value field of the match
    "text": "Author: Rolling Stones",   // The whole text of the match
    "offset": 13,                       // The start position of this match
    "newPos": 35,                       // The new position after the match
    "ofLen": 2062,                      // The length of the whole match string/file
    "line": 2,                          // Line number of the match
    "col": 1,                           // Column number within the line of the match
    "matched": true,                    // Is this a match. 
                                        // Setting 'parser.debug = true' will include the failed matches
    "parent": "01FXA5DWRMPD8TR5HEFJ1FF72F", // An sortable ULID identifier for the parent parser node
    "level": 2,                         // A parser depth level number
    "children": [],                     // An ULID array of identifiers that list the child nodes of this node
    "token": "Author",                  // Extra field(s), that can be defined within the LexerRules
    "colon": ":",                       // Another extra field, defined within the LexerRules
    "ident": "01.01.03"                 // A sortable hierarchy identifier of the node within the parser tree  
  },
  ```

### Lexer Rules

This lexer is inspired by the mpm package *moo*, but does away with the limitations that *moo* imposes on the use of regular expression. Also, it does not run the lexer before the parser, rather the lexer matching patterns are called in context from within the parser.

The way Lexer Rules are defined utilizes the **xregexp** Deno package. This is a great package that allows for regular expressions with support for unicode, regexp style look-ahead and named match-groups. These groups will be available within the parser.

A word of caution: I you are unfamiliar with regular expressions, or the XRegExp variant, you should study them in some datail before using this package. Parsers are notorious for being difficult and regular expressions is one of the tricky parts. 

Let us define a set of Lexer Rules for a simple assigment statement:

```
// @deno-types='https://deno.land/x/xregexp/types/index.d.ts'
import XRegExp from  'https://deno.land/x/xregexp/src/index.js'

const LR = {
    IDENT:      XRegExp( '(?<value>\\p{L}[\\p{L}0-9]*)', 'xuig' ),
    INT:        XRegExp( '(?<value>[0-9]+)', 'xug' ),
    STR:        XRegExp( '[\'"](?<value>[^\'"\\n]+)[\'"]', 'xuig' ),
    LET:        XRegExp( '(?<value>let[\\t ]+)', 'xug' ),
    EQSIGN:     XRegExp( '(?<EQSIGN>\\=)', 'gi' ),
    ROB_BEGIN:  XRegExp( '(?<ROB>\\()', 'gi' ),
    ROB_END:    XRegExp( '(?<ROE>\\))', 'gi' ),
    SQB_BEGIN:  XRegExp( '(?<SQB>\\[)', 'gi' ),
    SQB_END:    XRegExp( '(?<SQE>\\])', 'gi' ),
    COMMA:      XRegExp('(?<value>,)', 'xug'),
    SEMICOLON:  XRegExp('(?<value>;)', 'xug'),
    NL:         XRegExp('(?<value>[\\n\\r]+?)', 'g'), 
    WS:         XRegExp('(?<value>[ \\t]+)', 'g'),
    WSNL:       XRegExp('(?<value>[ \\t]+[\\n\\r]+)', 'g'),
}

export default LR
```
Here is what happens:

1. Import XRegExp, the types and the package
2. Using XRegExp expressions, define the Lexer terminal tokens:
   1. IDENT matches an identifier that is defined as a named match group, the `(?<value>...)` notation, and matches a Posix string starting with a alfabetic character and continuing with alfanumeric characters.
   2. INT is a simple match of 0-9 digits
   3. STR is a simple string beginning and terminated by single or double quotes which are in turn both excluded from within the string.
3. The rest is matching single characters like parentheses, brackets, commas, white space and the like.

The LexerRules is a set of XRegExp matching patterns that will be called by the Parser when applicable within the ParserRules context.

### Parser Rules

The Parser Rules groups the Lexer matching patterns to provide the Parser context.

The Parser Rules are defined as a set of *terminal symbols*, that refers directly to individual Lexer Rule entries and a set of *non-terminal symbols*, which is a set of user defined parser tokens.

A LHS (left hand side) non-terminal token refers directly to a set of RHS (right hand side) terminal Lexer Rules or non-terminal symbols:

```
assignment: {                // The non-terminal symbol assignment has the following definition
    multi: '1:1',            // The multiplicity/cardinality of `assignment`, in this case match once and only once
    expect: [                // This is what the Parser should expect the following match pattern 
        [LR.LET,    '1:1'],  // Lexer **terminal** match pattern for 'let', that must be matched once and only once
        [LR.IDENT,  '1:1'],  // Lexer **terminal** for 'IDENT/identifier', that must be matched once and only once
        [LR.EQSIGN, '1:1'],  // Lexer **terminal** for 'EQSIGN/equal sign', that must be matched once and only once
        ['rhsAssign', '1:m'] // Parser **non-terminal** for 'rhsAssign', that must be matched once or many times
    ] 
},
```
The Parser traverses the `expect` array and match the **terminal** symbols directly and the `LR.LET` is in fact a direct reference to the Lexer match token. The **non-terminal** symbols are in turn looked up in the Parser Rules and their respective `expect` arrays is executed.

If the Parser fails to match the patterns or fails any of the multiplicity conditions, it backtracks. When it has exhausted all matching options without reaching the end of the input, it errors with an indication of how far it got.  

Note that the default for `multi` is '0:m', zero or many, and that the '1:1' in the `expect`array above effectively acts as an AND clause. 

In between each match in the `expect`array the Parser calls a *special* case, the `'always'` token/section, that is normally used to remove any leading white space:
```
always : {  
    expect: [
        [ LR.WS , '0:m', 'ignore'],
        [ LR.NL,  '0:m' ]
    ]
},
```
The `'ignore'` as part of `LR.WS` that matches spaces and tabs. This has the effect that `LR.WS` will not be part of the parser tree output. In contrast, `LR.NL` that matches newlines will be part of the parser output. The Lexer or Parser you use within the `always` expect array should be unique to this section as not to interfere with similar matching done elsewhere. 

The whole thing is started of by the `reset` section, that is the Parser entry point:  
```
 reset: { 
        multi: '1:m',
        expect: [ 
            ['assignment', '1:m'],
        ] 
    },
 ```
 The `'reset'` expect array also has a defined cardinality/multiplicity of `'1:m'`, one or many, that the parser will check and fail the branch if the conditioon is not meet.

A sligthly more complicated example shows how you can specify conditions. The two entries are in an **exclusive OR** relationship, denoted by the `'xor'`, meaning that either one and only one `LR.SEMICOLON` or one and only one `LR.WSNL` must be matched:

```
  assignEnd: {
        multi: '1:1',
        expect: [ 
            [LR.SEMICOLON, '1:1', 'xor'],
            [LR.WSNL, '1:1' ]
        ] 
    },
```

The logical operators are `'xor'` and `'or'`. Other operators are not supported since the multiplicity of the entries are a good way to specify AND conditions. You can have multiple logical operators within your `expect`array, but they cannot be nested. The Parser will avaluate these conditions and fail the match branch if they are not met.

### No Left recursive rules

Parlexa does not support Left recursiveness, so write your rules accordingly. Here is how to write a Right recursive rule, that does the same. Here we implement parsing for an `Array` of comma separated **integer (LR.INT)**, **string (LR.STR)** or **array (arrAssign)** entries:
```
arrAssign: {                     // Defines an Array of strings/integers or arrays
    expect: [ 
        [ LR.SQB_BEGIN, '1:1'],  // The left bracket '['
        ['arrElement', '1:1'],   // A minimum of one element in the array
        ['arrListElem', '0:m'],  // Additional optional comma separated array elements 
        [ LR.SQB_END, '1:1']     // The right bracket ']'
    ],
},

arrElement: {                     // Defines an element/entry within the Array
    expect: [ 
        [ LR.STR, '1:1', 'xor'],  // A string 
        [ LR.INT, '1:1', 'xor'],  // An integer
        ['arrAssign', '1:1']      // RIGHT RECURSIVE reference to an Array within an Array 
    ] 
    },

arrListElem: {                        // Defines additional elements/entries, each with a preceding comma
        expect: [ 
            [ LR.COMMA, '1:1'],       // A mandatory comma
            ['arrElement', '1:1'],    // A mandatory additional Array element
        ] 
    },

```

### Parser Rules Implementation 

Here are the full Parser Rules implementation with comments for the simple assignment statement:
```
import { Keys, Matcher, MatchRecordExt, ParserRules } from "../../interfaces.ts";
import LR from "./lexerRules.ts";
//
// Type of a UserData object that your supply and control, an object that can modified using callbacks - se below in the parser definition   
//
export type UserData = { 
    comment: string, 
    intWasHere: string, 
    callBackFound: boolean, 
    recId: string, 
    intAssignCB: string, 
    arrAssignCB: Array<string> 
} 
//
// User defined non-terminal symbols for this set of parser rules
//
export type ParserTokens =  
    'reset' | 'always' | 'assignment' | 'rhsAssign' | 
    'intAssign' | 'strAssign' | 'arrAssign' | 'objAssign' | 
    'assignEnd' | 'arrElement' | 'arrListElem'

//
// The definition of the rules
// 
export const PR: ParserRules<ParserTokens | keyof typeof LR, UserData> = { 
    always : {  
        multi: '0:m',                     // This is in fact the default, should you omit the 'multi' declaration
        expect: [
            [ LR.WS , '0:1', 'ignore'],   // Matching of white space will not be added to the parser tree due to 'ignore'
            [ LR.NL,  '0:1' ]
        ]
    },
    reset: {                            // The Parser entry point
        multi: '1:m',                   // Should be matched at least once to succede
        expect: [ 
            ['assignment', '1:m'],  
        ] 
    },
    assignEnd: {
        multi: '1:1',                     // Try to match once and succede if found  
        expect: [ 
            [LR.SEMICOLON, '1:1', 'xor'], // Match Semicolon once XOR optional white space + newline once
            [LR.WSNL, '1:1' ]
        ] 
    },
    intAssign: {
        multi: '0:1',
        expect: [ 
            [LR.INT, '1:1', (m, s) => {             // You can provide a callback (more on this later)
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
        expect: [ 
            //
            // This is the alternative full match object notation for a match entry 
            // 
            {   match: LR.STR, 
                multi: '1:1', 
                logic: 'or',
                cb: (m, s) => { s.comment = 'This is parser global user defined data' ;return m }
            } as Matcher,
            //
            // And this is the short hand array notation that has the same features
            // 
            [LR.INT, '1:1', 'or', (m, s) => { 
                s.intWasHere = 'integer was here'; 
                (m as MatchRecordExt).intAssignCB = \`${m.type} Callback was here\`
                return m 
            }],
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
            ['arrAssign',  '1:1']    
        ],
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
}
export default PR
```
Now you can instantiate the Parser:
```
import { Parser } from "./Parser.ts";
import  LR  from "./test//basics/lexerRules.ts"
import  LR  from "./test//basics/lexerRules.ts"

const input = `     let øæå  = [ 1234, 'I am a string', [ 5678, 6789, 78910], 'ÆØÅ string with numbers 123456' ]`;
const parser = new Parser( LR, PR, 'reset' )
parser.debug = false
parser.reset(input)
const tree = parser.getParseTree()
```

For more details, have a look at the `'./test/parserRules.ts'` file.

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


### More Advanced LexerRules

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

A Lexer Rule reference, say `LR.FORM` may also have a LHS Parser Rule: 
```
    FORM: {
        multi: '1:m',
        expect: [ 
            [LR.LIST_ENTRY, '1:m' ]
        ]
    },
```
In this case, when the Lexer Rule `LR.FORM` is matched, then the RHS Parser Rule `FORM` is automatically called.

Look in `'test'` directory for a more examples.
