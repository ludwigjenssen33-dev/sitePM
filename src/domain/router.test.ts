import {expect,it} from 'vitest';
import {resolveRoute} from './router';
it('new browser paths',()=>expect(resolveRoute('/admin')).toBe('/admin'));
it('legacy case deep link',()=>expect(resolveRoute('/','#case/market')).toBe('/mission/market'));
it('legacy theory and progress',()=>{expect(resolveRoute('/','#theory')).toBe('/courses');expect(resolveRoute('/','#progress')).toBe('/cabinet/skills');});
it('legacy 1.x paths lead to new sections',()=>{expect(resolveRoute('/learn')).toBe('/courses');expect(resolveRoute('/skills')).toBe('/cabinet/skills');expect(resolveRoute('/certificate')).toBe('/cabinet/certificate');expect(resolveRoute('/account/')).toBe('/cabinet/profile');});
it('readable course and lesson paths',()=>{expect(resolveRoute('/courses/abtest/C2')).toBe('/courses/abtest/C2');expect(resolveRoute('/cabinet')).toBe('/cabinet');});
it('auth callback goes to profile',()=>expect(resolveRoute('/','#access_token=placeholder')).toBe('/cabinet/profile'));
