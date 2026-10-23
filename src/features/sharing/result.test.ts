import {it,expect} from 'vitest';
import {resultShareUrl,resultShareText,sharedResult} from './result';
it('ссылка содержит только миссию и балл',()=>{const r={caseId:'market',score:98};const url=resultShareUrl('https://product.example',r);expect(url).toBe('https://product.example/shared?case=market&score=98');expect(sharedResult(new URL(url).searchParams)).toEqual(r);expect(resultShareText(r)).toContain('98/100');});
it.each(['case=market&score=-1','case=market&score=101','case=bad&score=99','case=market&score=NaN','case=market&score=','case=market&score=99.1'])('отклоняет неподтверждённый формат %s',query=>expect(sharedResult(new URLSearchParams(query))).toBeNull());
