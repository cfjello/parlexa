import { Parser } from "./Parser.ts";
import { _ } from "./lodash.ts";

// Shared Parser Scope
export const parserSharedFac = <L extends string,T extends string,U>( pRef: Parser<L,T,U>) => {
    return {
        self:       pRef,
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
        _pos:        0,
        set pos (v: number) {
            this._pos = v
            if ( v > this.maxPos ) {
                this.maxPos = v
                this.maxLine = this.line
                this.maxCol = this.col
            }
        },
        get pos () { return this._pos },
        maxPos:     0,
        lastPosMatched: false,
        line:       1,
        maxLine:    1,
        col:        1, 
        maxCol:     1,
        bol:        0, 
        // Memory for first symbol token
        firstSymbol: '',
    }
}

export type ParserSharedScope<L extends string,T  extends string,U> = ReturnType<typeof parserSharedFac<L,T,U>>
