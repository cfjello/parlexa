// @deno-types='https://deno.land/x/xregexp/types/index.d.ts'
import XRegExp from  'https://deno.land/x/xregexp/src/index.js'
import { LexerRules } from "https://deno.land/x/parlexa/mod.ts";

const LR: LexerRules = {
    IDENT:      XRegExp( '(?<value>\\p{L}[\\p{L}0-9]*)', 'xuig' ),
    INT:        XRegExp( '(?<value>[0-9]+)', 'xug' ),
    STR:        XRegExp( '[\'"](?<value>[^\'"\\n]+)[\'"]', 'xuig' ),
    LET:        XRegExp( '(?<value>let[\t ]+)', 'xug' ),
    SET:        XRegExp( '(?<value>set[\t ]+)', 'xug' ),
    EXPORT:     XRegExp( '(?<value>export)', 'xug' ),
    TYPE:       XRegExp( '(?<token>type)', 'xug' ),
    PRIMARY:    XRegExp( '(?<token>string|number|boolean|bigint|any|unknown|never)', 'xuig' ),
    EQSIGN:     XRegExp( '(?<EQSIGN>\\=)', 'gi' ),
    ROB_BEGIN:  XRegExp( '(?<SQB>\\()', 'gi' ),
    ROB_END:    XRegExp( '(?<SQE>\\))', 'gi' ),
    CUB_BEGIN:  XRegExp( '(?<SBB>\\{)', 'gi' ),
    CUB_END:    XRegExp( '(?<SBE>\\})', 'gi' ),
    SQB_BEGIN:  XRegExp( '(?<SQB>\\[)', 'gi' ),
    SQB_END:    XRegExp( '(?<SQE>\\])', 'gi' ),
    OR:         XRegExp('(?<value>\\|{2})','xug'),
    AMBERS:     XRegExp('(?<value>\&{2})','xug'),
    COMMA:      XRegExp('(?<value>,)', 'xug'),
    SEMICOLON:  XRegExp('(?<value>;)', 'xug'),
    COLON:      XRegExp('(?<value>:)', 'xug'),
    COMMENT:    XRegExp('(?<value>//.*(?=$|\\n))', 'xug'),
    NL:         XRegExp('(?<value>[\\n\\r]+?)', 'g'), 
    WS:         XRegExp('(?<value>[ \\t]+)', 'g'),
}

export default LR