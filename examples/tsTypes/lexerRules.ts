// @deno-types='https://deno.land/x/xregexp/types/index.d.ts'
import XRegExp from  'https://deno.land/x/xregexp/src/index.js'
import { LexerRules } from "https://deno.land/x/parlexa/mod.ts";

const LR: LexerRules = {
    LHS_IDENT:  XRegExp( '(?<value>\\p{L}[\\p{L}0-9]*)[ \\t]*(?=:|=)', 'xuig' ),
    IDENT:      XRegExp( '(?<value>\\p{L}[\\p{L}0-9]*)', 'xuig' ),
    STR1:       XRegExp( '(?<value>[\'][^\']*[\'])', 'xuig' ),
    STR2:       XRegExp( '(?<value>[\"][^\"]*[\"])', 'xuig' ),
    STR3:       XRegExp( '(?<value>[\`][^\`]*[\`])', 'xuig' ),
    QIDENT:     XRegExp( '(?<value>[\'"])', 'xuig' ),
    EXPORT:     XRegExp( '(?<value>export)', 'xuig' ),
    TYPE:       XRegExp( '(?<token>type)', 'xuig' ),
    TSTYPE:     XRegExp( '(?<token>string|number|boolean|bigint|any|unknown|never)', 'xuig' ),
    EQSIGN:     XRegExp( '(?<EQSIGN>\\=)', 'gi' ),
    /*
    BRACKETS_BEGIN:  {
        match: XRegExp( '(?<value>\\{|\\(|\\[|<)', 'gi' ),
        cb: (e: any ) => {
            switch( e.value ) {
                case '{' :  e.type = 'CURLY_BEGIN'
                            break
                case '(' :  e.type = 'ROUND_BEGIN'
                            break
                case '[' :  e.type = 'SQUARE_BEGIN'
                            break
                case '<' :  e.type = 'ANGLE_BEGIN'
                            break
            }
            return e
        }
    },
    BRACKETS_END:  {
        match: XRegExp( '(?<value>\\}|\\)|\\]|>)', 'gi' ),
        cb: (e: any ) => {
            switch( e.value ) {
                case '{' :  e.type = 'CURLY_END'
                            break
                case '(' :  e.type = 'ROUND_END'
                            break
                case '[' :  e.type = 'SQUARE_END'
                            break
                case '<' :  e.type = 'ANGLE_END'
                            break
            }
            return e
        }
    },
    */
    ROUND_BEGIN:  XRegExp( '(?<value>\\()', 'gi' ),
    ROUND_END:    XRegExp( '(?<value>\\))', 'gi' ),
    CURLY_BEGIN:  XRegExp( '(?<value>\\{)', 'gi' ),
    CURLY_END:    XRegExp( '(?<value>\\})', 'gi' ),
    SQUARE_BEGIN:  XRegExp( '(?<value>\\[)', 'gi' ),
    SQUARE_END:    XRegExp( '(?<value>\\])', 'gi' ),
    ANGLE_BEGIN:  XRegExp( '(?<value><)', 'gi' ),
    ANGLE_END:    XRegExp( '(?<value>>)', 'gi' ),
    OR:         XRegExp('(?<value>\\|{1})','xug'),
    AMBERS:     XRegExp('(?<value>\&{1})','xug'),
    COMMA:      XRegExp('(?<value>,)', 'xug'),
    SIMICOLON:  XRegExp('(?<value>;)', 'xug'),
    COLON:      XRegExp('(?<value>:)', 'xug'),
    COMMENT:    XRegExp('(?<value>//.*(?=$|\\n))', 'xug'),
    NL:         XRegExp('(?<value>[\\n\\r]+?)', 'g'), 
    WS:         XRegExp('(?<value>[ \\t]+)', 'g'),
}

export default LR