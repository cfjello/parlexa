// @deno-types='https://deno.land/x/xregexp/types/index.d.ts'
import XRegExp from  'https://deno.land/x/xregexp/src/index.js'
import { LexerRules } from "../../types.ts";

const LR: LexerRules = {
    TITLE:      XRegExp( '(?<token>Title)[ \\t]*(?<colon>:)[ \\t]*(?<value>[\\p{L}0-9\\- \\t]+?)[ \\t]*(?=$|\\n)', 'xuig' ),
    AUTHOR:     XRegExp( '(?<token>Author)[ \\t]*(?<colon>:)[ \\t]*(?<value>[\\p{L}0-9\\- \\t]+?)[ \\t]*(?=$|\\n)', 'xuig' ),
    FORM:       XRegExp( '(?<token>Form)[ \\t]*(?<colon>:)', 'gi' ),
    LIST_ENTRY: {
        match:  XRegExp( '(?<token>-)[ \\t]*(?<value>[\\p{L}0-9\\- \\t]+)', 'xuig'),
        multi: '1:1'
    },
    BAR:        XRegExp('(?<value>\\|{1,2})','xug'),
    BAR_EOL:   XRegExp('(?<value>\\|{1,2})[ \\t]*(?=$|\\n)','xug'),
    SECTION:    XRegExp( '(?<value>[\\p{L}0-9\\- \\t]+?)[ \\t]*(?<colon>:)', 'xug' ),
    TEXT:    { 
        match: XRegExp( '(?<token>_)[\\t ]*(?<value>[^\\|\\n]+)[ \\t]*(?=$|\\n)', 'xug' ),
        // deno-lint-ignore no-explicit-any
        cb: ( e: any ) => { 
            try {
                e.value = e.value.trim()
                return e
            }
            catch(err) {
                console.log(`${JSON.stringify(e)} got: ${err}`)
            }
        }
    },
    NL:     XRegExp('(?<value>[\\n\\r]+?)', 'g'), 
    WS:     XRegExp('(?<value>[ \\t]+)', 'g'),
    // KEY:    XRegExp( '(?<token>Key)[ \\t]*:[ \\t]*(?<note>[A|B|C|D|E|F|G|a|b|c|d|e|f|g])(?<sh_fl>[#|b]{0,1})[ \\t]*(?<mode>Major|Minor)[ \\t]*(?=,|\\]|$|\\n)', 'xig' ),
    KEY:    XRegExp( '(?<token>Key)[ \\t]*:', 'xig' ),
    METER:  XRegExp( '(?<token>Meter)[ \\t]*:[ \\t]*(?<counter>[0-9]{1,2})\/(?<denominator>[0-9]{1,2})[ \\t]*(?=,|\\]|$|\\n)', 'xig' ),
    TEMPO:  XRegExp( '(?<token>Tempo)[ \\t]*:[ \\t]*(?<value>[0-9]{1,3})[ \\t]*(?=,|\\]|$|\\n)', 'nxig' ),
    // MODE:   XRegExp('(?<value>Ionian|Ion|Dorian|Dor|Phygian|Phy|Lydian|Lyd|Mixolydian|mixo|mix|Aeolian|Aeo|Locrian|Loc)','ig'),
    USE:    XRegExp('(?<token>Use)[ \\t]*(?<colon>[\:])[ \\t]*(?<value>[\\p{L}0-9\- \\t]+?)[ \\t]*(?<=,|\\]|$|\\n)', 'xuig'),
    TEXT_NOTE:  XRegExp('(?<token>Note)[ \t]*\:[ \t]*(?<value>[\\p{L}0-9\- \\t]+?)[ \\t]*(?=,|\\]|$|\\n)', 'xuig'),
    TEXT_NOTE2: XRegExp('(?<token>@)(?<who>[\\p{L}0-9\- \\t]+?)[ \t]*(?<colon>[\:])[ \t]*(?<value>[\\p{L}0-9\- \\t]+?)[ \\t]*(?=,|\\]|$|\\n)', 'xuig'),
    SCALE: { 
        match:  XRegExp( '(?<token>Scale|S)[ \\t]*:', 'xig' ),
        // deno-lint-ignore no-explicit-any
        cb: (e: any) => {
            e.type  = 'SCALE'
            return e
        }
    },
    SWING:  XRegExp( '(?<token>Swing)[ \t]*:[ \t]*(?<value>[0-9]{1,2}%)[ \\t]*(?=,|\\]|$|\\n)','xig'),
    // REPEAT_END_COUNT:   { match: XRegExp('(?<colon>:)[ \\t]*(?<value>[1-9]{0,2})(?=[ \\t]*\\|)', 'xg') },
    // BAR:                { match: XRegExp( '(?<value>\\|{1,2})', 'xg') },
    REPEAT_COUNT:   XRegExp('(?<value>[1-9]{0,2})[ \\t]*(?<token>:)', 'xg'), 
    REPEAT_END:     XRegExp('[ \\t]*(?<colon>:)[ \\t]*(?=\\|)', 'xg'),
    SQ_BRACKET:     XRegExp( '(?<token>[\\[])', 'g' ),
    SQ_BRACKET_END: XRegExp( '(?<token>[\\]])', 'g'),
    IN_BRACKET:     XRegExp( '(?<token>[\\[])', 'g' ),
    IN_BRACKET_END: XRegExp( '(?<token>[\\]])', 'g'),
    BRACKET:        XRegExp( '(?<token>[\\(])', 'g' ),
    BRACKET_END:    XRegExp( '(?<token>[\\)])', 'g'),
    COMMA:          XRegExp( '(?<value>,)', 'g'),
    COLON:          XRegExp( '(?<value>:)', 'g'),
    IN_KEY:         XRegExp( '(?<token>Key)[ \\t]*(?=:)','xig'),  // IN_* are Dummies
    IN_METER:       XRegExp( '(?<token>Meter)[ \\t]*(?=:)','xig'),
    IN_NOTE:        XRegExp( '(?<token>Note)[ \\t]*(?=:)','xig'),
    IN_SWING:       XRegExp( '(?<token>Swing)[ \\t]*(?=:)','xig'),
    IN_KEY_RHS:     XRegExp( '(?<value>[0-9]{1,3})','xig'),
    IN_METER_RHS:   XRegExp( '(?<value>[A-Z]{1,3})','xig'),
    IN_NOTE_RHS:    XRegExp( '(?<value>[a-k]{1,3})','xig'),
    IN_SWING_RHS:   XRegExp( '(?<value>[l-z]{1,3})','xig'),
    DURATION:       XRegExp('(?<token>,)(?<value>[0-9]{1,2})', 'xg'),
    DURATION2:  { 
        match: XRegExp('(?<token>,)(?<value>[whtq])', 'xg'),
        // deno-lint-ignore no-explicit-any
        cb: (e: any) => {
            const tokens = ['w','h','t','q']
            e.value = tokens.indexOf(e.token) + 1
            e.type  = 'DURATION'
            return e
        }
    },
    DURATION_ADD:   XRegExp('(?<token>[\-\+]{1})(?<value>[0-9]{1,2})', 'xg'),
    GROOVE_ADJUST:  XRegExp('(?<direction>[<|>])(?<value>[0-9]{1,3})', 'xg'),
    CHORD_NOTE: { 
        match: XRegExp('(?<value>A|B|C|D|E|F|G)(?<sharpFlat>[#|b]{0,1})', 'xg'),
        multi: '1:1'
    },
    REST:       XRegExp('(?<value>R)', 'xig'),
    CHORD_TYPE: XRegExp('(?<value>[S|s]us2|[S|s]us4|[D|d]im|[A|a]ug|[M|m]ajor|[M|m]aj|[M|m]inor|[Q|q]uatal|[M|m]in|M|m|Q|q|5)', 'xg'),
    CHORD_EXT:  XRegExp('(?<value>b5|6|7|9|b9|#9|11|#11|b13|13)', 'g'),
    CHORD_EXT2: XRegExp('(?<value>add9|add11|add#11|add13)', 'g'),
    CHORD_BASS: XRegExp('(?<token>\/)(?<value>[A|B|C|D|E|F|G|a|b|c|d|e|f|g][#|b]{0,1})', 'xg'),
    CHORD_INVERSION: XRegExp('(?<token>[\\^|v])(?<value>[0-5])', 'xg'),
    CHORD_MINUS_NOTE:XRegExp('(?<value>\\-1|\\-3|\\-5)', 'xg'),
    REPEAT_PREV: XRegExp('(?<token>%)', 'xg'),
    // DRUM_KIT:           /bd|sn|ki|hh|oh|ht|mt|lt|cy|cr|cow|tam/,
    NOTE:        XRegExp('(?<value>a|b|c|d|e|f|g)(?<sharpFlat>[#|b]{0,1})', 'xg'),
    NOTE_LOWER:  XRegExp('(?<value>a|b|c|d|e|f|g)(?<sharpFlat>[#|b]{0,1})', 'xg'),
    NOTE_UPPER:  XRegExp('(?<value>A|B|C|D|E|F|G)(?<sharpFlat>[#|b]{0,1})', 'xg') ,
    NOTE_BOTH:   XRegExp('(?<value>A|B|C|D|E|F|G)(?<sharpFlat>[#|b]{0,1})', 'xig') ,
    // MAJOR: 
    MINOR_MOD: XRegExp('(?<value>Harmonic|Harm|Har|Melodic|Mel)\\.{0,1}[ \\t]*(?!:)','xig') ,
    MINOR:     XRegExp('(?<value>Minor|minor|Min|min|m)[ \\t]*(?![a-z:])', 'xg'),
    MAJOR:     XRegExp('(?<value>Major|Maj|M)[ \\t]*(?![a-z:])', 'xg'),
    MODE:   XRegExp('(?<value>Ionian|Ion|Dorian|Dor|Phygian|Phy|Lydian|Lyd|Mixolydian|mixo|mix|Aeolian|Aeo|Natural|Nat|Locrian|Loc)\\.{0,1}','xig'),
    REPEAT_LAST: XRegExp('(?<token>\/)', 'xg'),
}

export default LR