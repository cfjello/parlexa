import "https://deno.land/x/lodash@4.17.19/dist/lodash.js";
// now `_` is imported in the global variable, which in deno is `self`
// deno-lint-ignore no-explicit-any
export const _ = (self as any)._;