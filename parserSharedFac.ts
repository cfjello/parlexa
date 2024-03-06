import { Parser } from "./Parser.ts";
import { _ } from "./lodash.ts";

// Shared Parser Scope
export const parserSharedFac = <L extends string,T extends string,U>( pRef: Parser<L,T,U>) => {
    return {
        pRef:       pRef,
        // White space and new line
        newLine:    'NL',
        whiteSpace: 'WS',
        ignoreWS:   true,
        BoF:        true,
        BoL:        true,
        always:     'always',
        inclAlwaysInDebug: false,
        maxCount:   0,
        // input with positione and Line and column numbers for error reporting and matching
        input:      '',
        pos:        0,
        line:       1,
        col:        1, 
        bol:        0, 
        // Memory for previous tokens
        firstSymbol: true,
    }
}

export type ParserSharedScope<L extends string,T  extends string,U> = ReturnType<typeof parserSharedFac<L,T,U>>
