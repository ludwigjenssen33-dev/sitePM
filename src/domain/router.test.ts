import {expect,it} from 'vitest';
import {resolveRoute} from './router';
it('new browser paths',()=>expect(resolveRoute('/admin')).toBe('/admin'));
it('legacy case deep link',()=>expect(resolveRoute('/','#case/market')).toBe('/mission/market'));
it('legacy theory and progress',()=>{expect(resolveRoute('/','#theory')).toBe('/learn');expect(resolveRoute('/','#progress')).toBe('/skills');});
it('auth callback goes to account',()=>expect(resolveRoute('/','#access_token=placeholder')).toBe('/account'));
