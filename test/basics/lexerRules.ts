// @deno-types='https://deno.land/x/xregexp/types/index.d.ts'
import XRegExp from  'https://deno.land/x/xregexp/src/index.js'

export const LR = {
    IDENT:      XRegExp( '(?<value>\\p{L}[\\p{L}0-9]*)', 'xuig' ),
    INT:        XRegExp( '(?<value>[0-9]+)', 'xug' ),
    STR:        XRegExp( '[\'"](?<value>[^\'"\\n]+)[\'"]', 'xuig' ),
    DUMMY:      XRegExp( '(?<value>@_DUMMY_@)', 'xuig' ),
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
    WSNL:       XRegExp('(?<value>[ \\t]*[\\n\\r]+)', 'g'),
}

export type LexerTokens = keyof typeof LR

export default LR