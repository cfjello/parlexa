import { assert, assertEquals, assertExists  } from "https://deno.land/std/assert/mod.ts"
import { Debug } from "../../InfoLogger.ts"
import { DebugArgs, DebugLogFunc } from "../../types.ts";
import { Colors } from "../../imports.ts";

Deno.test({
    name: '01 - Debug can take a Callback - not a real test, just look at the output', 
    fn: () => {  
        const input_02 = "This is a green string"
        const debug = new Debug(
            true, 
            'none' , 
            ( args: DebugArgs) =>  { 
                const str = args.text + ' from a callback'
                console.debug( Colors.green(str) ) 
                return str
            }  
        )
        debug.msg({
            level: 0, 
            color: 'none', 
            text: input_02
        })

        debug.setCallback( undefined )
        debug.msg({
            level: 0, 
            color: 'red', 
            text: "This is a red test string after reset of the callback"
        })
        // assert( res_1 === undefined )

    },
    sanitizeResources: false,
    sanitizeOps: false
})
