import { assert, ulid } from "./imports.ts";
import { ParserSharedScope } from "./parserSharedFac.ts";
import { InternMatcherSealed } from "./types.ts";
import { MatchRecord, ParseFuncScope } from "./types.ts";

export const matchRecInit = <L extends string,T extends string, U>( 
    s: ParseFuncScope<L,T,U>, 
    p: ParserSharedScope<L,T,U>,
    _iMatcher: InternMatcherSealed<T,U> | undefined ) => {
        try {
            const iMatcher = _iMatcher ?? s.iMatcher
            assert( ! p.pRef.result.has(iMatcher.id), `matchRecFac(): iMatcher.id: ${iMatcher.id} already exists in result for: ${iMatcher.key}`)  
            const mRec =  {
              id:       iMatcher.id,
              type:     iMatcher.type,
              token:    iMatcher.key as T,
              tokenExt: iMatcher.keyExt!,
              value:    '',
              text:     '',
              ws:       false,
              ignore:   iMatcher.ignore,
              offsets:  iMatcher.offsets, 
              ofLen:    p.input.length,
              line:     p.line,
              col:      p.col,
              matched:  false,
              matchCnt: 0,
              parentId: iMatcher.parentId!,
              level:    s.args.level,
              children: []
            } satisfies MatchRecord<T> 
            // this.result.set( mRec.id, mRec)
            return mRec
        }
        catch (err) { 
            console.error(err)
            throw err 
        }
    }