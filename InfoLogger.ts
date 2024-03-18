import { Colors } from "./imports.ts"
import { indent } from "./util.ts";
import { Color, DebugArgs, debugArgs, DebugLogFunc  } from "./types.ts";

export class Debug {
    debug = false
    colorDef: Color = 'none'
    __debug__
    private callback: DebugLogFunc | undefined
   
    constructor( debug: boolean, colorDef: Color = 'none', callback: DebugLogFunc | undefined = undefined ) {
        this.debug = debug;
        this.colorDef = colorDef
        this.__debug__ = this.msg
        if ( callback ) this.setCallback(callback!)
    }

    msg: DebugLogFunc = ( args: DebugArgs = debugArgs ): void => {
        try {
            if ( this.debug ) {
                if ( this.callback ) {
                    this.callback(args)
                }
                else {
                    const msg = args.level > 0 ? `${indent(args.level)}${args.text}` : args.text
                    const color = args.color ?? this.colorDef!
                    if ( color === 'none' ) {
                        console.debug(msg)
                    }
                    else {
                        console.debug(Colors[color](msg))
                    }
                }
            }
        }
        catch (err) {
            console.error(err)
            throw err
        }
    }

    setCallback = ( callback: DebugLogFunc | undefined ) => {
        this.callback = callback
    }
}
