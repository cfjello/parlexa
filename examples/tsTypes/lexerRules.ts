// @deno-types='https://deno.land/x/xregexp/types/index.d.ts'
import XRegExp from  'https://deno.land/x/xregexp/src/index.js'
import { LexerRules } from "https://deno.land/x/parlexa/mod.ts";

const LR: LexerRules = {
    IDENT:      XRegExp( '(?<value>\\p{L}[\\p{L}0-9]*)', 'xuig' ),
    QIDENT:     XRegExp( '(?<value>[\'"])', 'xuig' ),
    EXPORT:     XRegExp( '(?<value>export)', 'xuig' ),
    TYPE:       XRegExp( '(?<token>type)', 'xuig' ),
    PRIMARY:    XRegExp( '(?<token>string|number|boolean|bigint|any|unknown|never)', 'xuig' ),
    EQSIGN:     XRegExp( '(?<EQSIGN>\\=)', 'gi' ),
    CUB_BEGIN:  XRegExp( '(?<SBB>\\{)', 'gi' ),
    CUB_END:    XRegExp( '(?<SBE>\\})', 'gi' ),
    SQB_BEGIN:  XRegExp( '(?<SQB>\\[)', 'gi' ),
    SQB_END:    XRegExp( '(?<SQE>\\])', 'gi' ),
    OR:         XRegExp('(?<value>\\|{1})','xug'),
    AMBERS:     XRegExp('(?<value>\&{1})','xug'),
    COMMA:      XRegExp('(?<value>,)', 'xug'),
    COLON:      XRegExp('(?<value>:)', 'xug'),
    COMMENT:    XRegExp('(?<value>//.*(?=$|\\n))', 'xug'),
    NL:         XRegExp('(?<value>[\\n\\r]+?)', 'g'), 
    WS:         XRegExp('(?<value>[ \\t]+)', 'g'),
}

export default LR