

const s = {
    myVal: 'Hey' as const,
    myVal2: 'Hey2',
    getVal () { return this.myVal }
}

console.log ( s.myVal)

s.myVal2 = 'Hello'
