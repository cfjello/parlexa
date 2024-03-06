import { ParseArgs } from "./types.ts";

export const  getMulti = (multi: string): number[] => {
    let res: number[] = [] 
    try {
        const [minS, maxS] = multi.split(':')
        const min = parseInt(minS)
        const max = maxS === 'm' ? Number.MAX_SAFE_INTEGER : parseInt(maxS)
        res = [min, max]
    }
    catch(err) {
        throw err
    }
    return res
}

export const indent = ( level: number, filler = '  ') => {
    return Array<string>(level).fill(filler, 0 ).join('')
}
