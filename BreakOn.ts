import { BreakOnS } from "./interfaces.ts";
import { ExpectMap } from "./interfaces.ts";
import { _ } from './lodash.ts';

export class BreakOnScope {
    constructor( public state: BreakOnScope ) {}

    update( stateUpd: Partial<BreakOnS> ) {
        this.state = _.merge( this.state, stateUpd )
    }
}

export class BreakOn {

    constructor( eMap: ExpectMap, public startOn  = eMap.startOn, public breakOn = eMap.breakOn ) {}

    merge( eMap: ExpectMap, scope: BreakOnScope ) {
        if ( ( eMap.breakOn ?? []).length > 0 ) this.breakOn = _.uniq( _.merge(this.breakOn, eMap.breakOn) ) 
        if ( ( eMap.startOn ?? []).length > 0 ) this.startOn = _.uniq( _.merge(this.startOn, eMap.startOn) ) 
    }

    chkBreakOn( 
        token:   string,
        roundTrips: number,
        idx:     number, 
        level:   number,
        lastPos: number,
        breakOnPPGT: RegExp[],
        eMap: ExpectMap
    ): boolean {
        let matched = false
        let startMatched: string | null = null
        if ( idx === 0 && (eMap.startOn ?? []).length > 0  ) {
            startMatched = this.chkStartOn( eMap, level )
        }
        if ( breakOnPPGT.length > 0  ) {
            for ( const exp of breakOnPPGT ) {
                // if ( ! (eMap.startOnStr ?? []).includes( exp.toString() ) ) {
                    if ( this.prevMatch.toString() === exp.toString() && ) {
                        if ( this.debug ) console.debug( Colors.red(`${this.getIndent(level+1)}BreakOn on prevMatch for '${token}'`) + ': ' + exp.toString())
                        matched = true
                        break
                    }
                    else {
                        const res: XRegExp.ExecArray | null = XRegExp.exec(this.input, exp, lastPos, 'sticky' )
                        if ( res !== null  && !( startMatched && exp.toString() === this.prevMatch.toString() )) {
                            if ( this.debug ) console.debug(Colors.red(`${this.getIndent(level+1)}BreakOn on lookAhead for '${token}'`) + ': ' + exp.toString())
                            matched = true
                            break
                        }
                    }
                // }
            }
            if ( matched ) {
                this.prevBreakOn = { pos: lastPos, token: token }
            }
            else {
                this.prevBreakOn = { pos: -1, token: '__undefined__' }
            }
        }
        return matched
    }

    chkStartOn( 
        eMap:    ExpectMap,
        level:   number,
    ): ChkStartScope {
        let res = { active: false, checks: false, match: '' }
        if ( (eMap.startOn ?? []).length > 0 ) {
            for( const exp of eMap.startOn! ) {
                res.active = true
                if ( this.debug) console.debug(Colors.blue(`${this.getIndent(level+1)}StartOn: ${exp} against ${this.prevMatch}`) ) 
                if ( this.prevMatch.toString() === exp.toString() ) {
                    res.match = exp.toString()
                    res.checks = true
                    break
                }
            }
        }
        return res
    }
*/
}