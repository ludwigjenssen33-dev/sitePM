import {afterEach,expect,it,vi} from 'vitest';
import {analyticsDeliveryState,flushAnalytics,installAnalyticsSync} from './transport';
afterEach(()=>vi.unstubAllGlobals());
it('локальный режим не отправляет событий даже при согласии',async()=>{const fetch=vi.fn();vi.stubGlobal('fetch',fetch);vi.stubGlobal('localStorage',{getItem:()=> 'yes'});await flushAnalytics();expect(fetch).not.toHaveBeenCalled();expect(analyticsDeliveryState()).toEqual({configured:false,pending:0});});
it('установка локального режима не запускает сетевой таймер',()=>{const fetch=vi.fn(),timer=vi.fn();vi.stubGlobal('fetch',fetch);vi.stubGlobal('setInterval',timer);const dispose=installAnalyticsSync();dispose();expect(fetch).not.toHaveBeenCalled();expect(timer).not.toHaveBeenCalled();});
