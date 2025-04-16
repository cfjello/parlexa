// @deno-types='https://deno.land/x/xregexp/types/index.d.ts'
import XRegExp from  'https://deno.land/x/xregexp/src/index.js'
import { MatchRecordExt } from '../../mod.ts';
import { UserData } from './parserRules.ts';
import { Cardinality } from '../../types.ts';

const LR = {
    TITLE:      XRegExp( '(?<keyWord>Title)[ \\t]*(?<colon>:)[ \\t]*(?<value>[\\p{L}0-9\\- \\t]+?)[ \\t]*(?=$|\\n)', 'xuig' ),
    AUTHOR:     XRegExp( '(?<keyWord>Author)[ \\t]*(?<colon>:)[ \\t]*(?<value>[\\p{L}0-9\\- \\t]+?)[ \\t]*(?=$|\\n)', 'xuig' ),
    FORM:       XRegExp( '(?<keyWord>Form)[ \\t]*(?<colon>:)', 'gi' ),
    LIST_ENTRY: {
        match:  XRegExp( '(?<keyWord>-)[ \\t]*(?<value>[\\p{L}0-9\\- \\t]+)', 'xuig'),
        multi: '1:1' as Cardinality
    },
    BAR:        XRegExp('(?<value>\\|{1,2})','xug'),
    BAR_EOL:   XRegExp('(?<value>\\|{1,2})[ \\t]*(?=$|\\n)','xug'),
    SECTION:    XRegExp( '(?<value>[\\p{L}0-9\\- \\t]+?)[ \\t]*(?<colon>:)', 'xug' ),
    TEXT:    { 
        match: XRegExp( '(?<keyWord>_)[\\t ]*(?<value>[^\\|\\n]+)[ \\t]*(?=$|\\n)', 'xug' ),
        cb: ( matchRec: MatchRecordExt<string>, _userData: UserData ) => { 
            try {
                matchRec.value = ( matchRec.value as string).trim()
            }
            catch(err) {
                console.error(`${JSON.stringify(matchRec)} got: ${err}`)
            }
        }
    },
    NL:     XRegExp('(?<value>[\\n\\r]+?)', 'g'), 
    WS:     XRegExp('(?<value>[ \\t]+)', 'g'),
    // KEY:    XRegExp( '(?<keyWord>Key)[ \\t]*:[ \\t]*(?<note>[A|B|C|D|E|F|G|a|b|c|d|e|f|g])(?<sh_fl>[#|b]{0,1})[ \\t]*(?<mode>Major|Minor)[ \\t]*(?=,|\\]|$|\\n)', 'xig' ),
    KEY:    XRegExp( '(?<keyWord>Key)[ \\t]*:', 'xig' ),
    METER:  XRegExp( '(?<keyWord>Meter)[ \\t]*:[ \\t]*(?<counter>[0-9]{1,2})\/(?<denominator>[0-9]{1,2})[ \\t]*(?=,|\\]|$|\\n)', 'xig' ),
    TEMPO:  XRegExp( '(?<keyWord>Tempo)[ \\t]*:[ \\t]*(?<value>[0-9]{1,3})[ \\t]*(?=,|\\]|$|\\n)', 'nxig' ),
    // MODE:   XRegExp('(?<value>Ionian|Ion|Dorian|Dor|Phygian|Phy|Lydian|Lyd|Mixolydian|mixo|mix|Aeolian|Aeo|Locrian|Loc)','ig'),
    USE:    XRegExp('(?<keyWord>Use)[ \\t]*(?<colon>[\:])[ \\t]*(?<value>[\\p{L}0-9\- \\t]+?)[ \\t]*(?<=,|\\]|$|\\n)', 'xuig'),
    TEXT_NOTE:  XRegExp('(?<keyWord>Note)[ \t]*\:[ \t]*(?<value>[\\p{L}0-9\- \\t]+?)[ \\t]*(?=,|\\]|$|\\n)', 'xuig'),
    TEXT_NOTE2: XRegExp('(?<keyWord>@)(?<who>[\\p{L}0-9\- \\t]+?)[ \t]*(?<colon>[\:])[ \t]*(?<value>[\\p{L}0-9\- \\t]+?)[ \\t]*(?=,|\\]|$|\\n)', 'xuig'),
    SCALE: XRegExp( '(?<keyWord>Scale|S)[ \\t]*:', 'xig' ),
    SWING:  XRegExp( '(?<keyWord>Swing)[ \t]*:[ \t]*(?<value>[0-9]{1,2}%)[ \\t]*(?=,|\\]|$|\\n)','xig'),
    // REPEAT_END_COUNT:   { match: XRegExp('(?<colon>:)[ \\t]*(?<value>[1-9]{0,2})(?=[ \\t]*\\|)', 'xg') },
    // BAR:                { match: XRegExp( '(?<value>\\|{1,2})', 'xg') },
    REPEAT_COUNT:   XRegExp('(?<value>[1-9]{0,2})[ \\t]*(?<keyWord>:)', 'xg'), 
    REPEAT_END:     XRegExp('[ \\t]*(?<colon>:)[ \\t]*(?=\\|)', 'xg'),
    SQ_BRACKET:     XRegExp( '(?<keyWord>[\\[])', 'g' ),
    SQ_BRACKET_END: XRegExp( '(?<keyWord>[\\]])', 'g'),
    IN_BRACKET:     XRegExp( '(?<keyWord>[\\[])', 'g' ),
    IN_BRACKET_END: XRegExp( '(?<keyWord>[\\]])', 'g'),
    BRACKET:        XRegExp( '(?<keyWord>[\\(])', 'g' ),
    BRACKET_END:    XRegExp( '(?<keyWord>[\\)])', 'g'),
    COMMA:          XRegExp( '(?<value>,)', 'g'),
    COLON:          XRegExp( '(?<value>:)', 'g'),
    IN_KEY:         XRegExp( '(?<keyWord>Key)[ \\t]*(?=:)','xig'),  // IN_* are Dummies
    IN_METER:       XRegExp( '(?<keyWord>Meter)[ \\t]*(?=:)','xig'),
    IN_NOTE:        XRegExp( '(?<keyWord>Note)[ \\t]*(?=:)','xig'),
    IN_SWING:       XRegExp( '(?<keyWord>Swing)[ \\t]*(?=:)','xig'),
    IN_KEY_RHS:     XRegExp( '(?<value>[0-9]{1,3})','xig'),
    IN_METER_RHS:   XRegExp( '(?<value>[A-Z]{1,3})','xig'),
    IN_NOTE_RHS:    XRegExp( '(?<value>[a-k]{1,3})','xig'),
    IN_SWING_RHS:   XRegExp( '(?<value>[l-z]{1,3})','xig'),
    DURATION:       XRegExp('(?<keyWord>,)(?<value>[0-9]{1,2})', 'xg'),
    DURATION2:  { 
        match: XRegExp('(?<keyWord>,)(?<value>[whtq])', 'xg'),
        cb: (matchRec: MatchRecordExt<string>, _userData: UserData) => {
            const tokens = ['w','h','t','q']
            matchRec.value = tokens.indexOf(matchRec.token) + 1
            matchRec.token  = 'DURATION'
        }
    },
    DURATION_ADD:   XRegExp('(?<keyWord>[\-\+]{1})(?<value>[0-9]{1,2})', 'xg'),
    GROOVE_ADJUST:  XRegExp('(?<direction>[<|>])(?<value>[0-9]{1,3})', 'xg'),
    CHORD_NOTE: { 
        match: XRegExp('(?<value>A|B|C|D|E|F|G)(?<sharpFlat>[#|b]{0,1})', 'xg'),
        multi: '1:1' as Cardinality
    },
    REST:       XRegExp('(?<value>R)', 'xig'),
    CHORD_TYPE: XRegExp('(?<value>[S|s]us2|[S|s]us4|[D|d]im|[A|a]ug|[M|m]ajor|[M|m]aj|[M|m]inor|[Q|q]uatal|[M|m]in|M|m|Q|q|5)', 'xg'),
    CHORD_EXT:  XRegExp('(?<value>b5|6|7|9|b9|#9|11|#11|b13|13)', 'g'),
    CHORD_EXT2: XRegExp('(?<value>add9|add11|add#11|add13)', 'g'),
    CHORD_BASS: XRegExp('(?<keyWord>\/)(?<value>[A|B|C|D|E|F|G|a|b|c|d|e|f|g][#|b]{0,1})', 'xg'),
    CHORD_INVERSION: XRegExp('(?<keyWord>[\\^|v])(?<value>[0-5])', 'xg'),
    CHORD_MINUS_NOTE:XRegExp('(?<value>\\-1|\\-3|\\-5)', 'xg'),
    REPEAT_PREV: XRegExp('(?<keyWord>%)', 'xg'),
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
    REPEAT_LAST: XRegExp('(?<keyWord>\/)', 'xg'),
}

// export type LexerTokens = keyof typeof LR

export default LR