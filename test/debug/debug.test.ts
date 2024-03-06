import { assert, assertEquals } from "https://deno.land/std/assert/mod.ts"
import { Debug } from "../../Debug.ts"
import { DebugArgs } from "../../types.ts";
import { assertExists } from "https://deno.land/std@0.215.0/assert/assert_exists.ts";
import { Colors } from "../../imports.ts";

Deno.test({
    name: '01 - Debug can take a Callback', 
    fn: () => {  
        const input_02 = "This is a green string"
        Debug.getInstance(
            true, 
            'none' , 
            ( args: DebugArgs) =>  { 
                const str = args.text + ' from a callback'
                console.debug( Colors.green(str) ) 
                return str
            }  
        )
        const res = Debug.msg({
            level: 0, 
            color: 'none', 
            text: input_02
        })
        assertEquals(res, input_02 + ' from callback')

        Debug.setCallback( undefined )
        const res_1 = Debug.msg({
            level: 0, 
            color: 'red', 
            text: "This is a red test string"
        })
        assert( res_1 === undefined )
        
    },
    sanitizeResources: false,
    sanitizeOps: false
})