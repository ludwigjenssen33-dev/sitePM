import {beforeEach,describe,expect,it} from 'vitest';
import {analyticsConsent,getEvents,isAnalyticsEvent,sanitizeParams,setAnalyticsConsent,track,type AnalyticsEvent,type EventName} from './events';
import {calculateFunnel,funnelCsv,funnelPresets} from './funnels';
import {analyticsSummary,retention} from './metrics';
import {demoEvents} from './demo';
import {getContentAudit,getDrafts,persistDraft,validateContent,type ContentDraft} from './content';
const storage=()=>{const map=new Map<string,string>();return {getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>map.set(k,v),removeItem:(k:string)=>map.delete(k)};};
beforeEach(()=>{Object.defineProperty(globalThis,'localStorage',{value:storage(),configurable:true});Object.defineProperty(globalThis,'sessionStorage',{value:storage(),configurable:true});});
const event=(type:EventName,hours:number,actor='a',session='s'):AnalyticsEvent=>({id:`event-${type}-${hours}-${actor}`,schemaVersion:1,type,timestamp:new Date(Date.UTC(2026,9,1)+hours*3600000).toISOString(),actorId:actor,sessionId:session,device:'desktop',source:'direct',params:{},mode:'local'});
describe('Приватность событий',()=>{
 it('без согласия не собирает даже session_started',()=>{expect(analyticsConsent()).toBeNull();track('page_view',{route:'home'});expect(getEvents()).toEqual([]);});
 it('не пропускает email, текст, пароли, произвольные поля и неверные значения',()=>{expect(sanitizeParams({caseId:'market',score:80,note:'личный текст',email:'test@example.com',password:'private',step:-1,durationMs:Infinity,route:'/profile?email=private'})).toEqual({caseId:'market',score:80});});
 it('создаёт анонимную сессию и выключение удаляет данные',()=>{setAnalyticsConsent(true);track('page_view',{route:'home'});track('case_started',{caseId:'market'});const events=getEvents();expect(events.map(e=>e.type)).toEqual(['session_started','page_view','case_started']);expect(new Set(events.map(e=>e.sessionId)).size).toBe(1);expect(events.every(isAnalyticsEvent)).toBe(true);setAnalyticsConsent(false);expect(getEvents()).toEqual([]);expect(analyticsConsent()).toBe(false);});
 it('локальная коллекция не смешивается с demo',()=>{const demo=demoEvents(new Date('2026-10-22T20:00:00Z'));expect(demo.length).toBeGreaterThan(100);expect(demo.every(e=>e.mode==='demo')).toBe(true);expect(demo.every(isAnalyticsEvent)).toBe(true);localStorage.setItem('product-lab-events-v1',JSON.stringify(demo));expect(getEvents()).toEqual([]);});
});
describe('Последовательная воронка',()=>{
 const steps=funnelPresets.marketing.steps;
 it('повторные клики не создают новых участников',()=>{const list=[event('page_view',0),event('page_view',.1),event('course_viewed',1),event('course_viewed',1.1),event('case_started',2)];expect(calculateFunnel(list,steps).map(r=>r.count)).toEqual([1,1,1]);});
 it('обратный порядок не засчитывает конверсию',()=>{const list=[event('case_started',0),event('course_viewed',1),event('page_view',2)];expect(calculateFunnel(list,steps).map(r=>r.count)).toEqual([1,0,0]);});
 it('соблюдает окно, единицу учёта и сегмент',()=>{const list=[event('page_view',0),event('course_viewed',1),event('case_started',25),event('page_view',0,'b','s2')];const r=calculateFunnel(list,steps,{windowHours:24});expect(r.map(v=>v.count)).toEqual([2,1,0]);expect(r[1].fromPrevious).toBe(.5);expect(r[1].lost).toBe(1);expect(calculateFunnel(list,steps,{device:'mobile'}).map(v=>v.count)).toEqual([0,0,0]);});
 it('различает сессии одного участника',()=>{const list=[event('page_view',0,'a','s1'),event('course_viewed',1,'a','s2'),event('case_started',2,'a','s2')];expect(calculateFunnel(list,steps).map(r=>r.count)).toEqual([1,0,0]);expect(calculateFunnel(list,steps,{identity:'actorId'}).map(r=>r.count)).toEqual([1,1,1]);});
 it('нулевая база не делится на ноль, CSV сохраняет пустую долю',()=>{const r=calculateFunnel([],steps);expect(r[0].fromStart).toBeNull();expect(funnelCsv(r)).toContain('Этап;Участники');expect(()=>calculateFunnel([],steps,{windowHours:0})).toThrow();});
});
describe('Метрики и достаточность данных',()=>{
 it('пустая выборка не маскируется нулевым retention',()=>{const m=analyticsSummary([]);expect(m.mean).toBeNull();expect(m.retention30).toBeNull();expect(m.signupConversion).toBeNull();});
 it('retention требует созревшей когорты и считает уникальные возвраты',()=>{const events=[event('page_view',0),event('page_view',24),event('page_view',25),event('page_view',0,'b','s2')];expect(retention(events,1,new Date('2026-10-03T12:00:00Z'))).toBe(.5);expect(retention(events,7,new Date('2026-10-03T12:00:00Z'))).toBeNull();});
 it('среднее, медиана и различие попыток согласованы',()=>{const e1={...event('case_completed',1),params:{caseId:'market',score:50,hints:1}};const e2={...event('case_completed',2),params:{caseId:'market',score:90,hints:0}};const m=analyticsSummary([event('case_started',0),e1,e2],new Date('2026-10-02T00:00:00Z'));expect(m.mean).toBe(70);expect(m.median).toBe(70);expect(m.improvement).toBe(40);expect(m.noHints).toBe(.5);});
});
describe('Песочница контента',()=>{
 const draft=():ContentDraft=>({id:'lesson-demo',title:'Новый материал',description:'Достаточно подробное описание учебной задачи.',lessonIds:['A1'],illustration:'/favicon.svg',stages:[{title:'Диагноз',question:'Что изменилось?',options:['Метрика','Цвет'],correct:0,hint:'Разложите результат.'}],metrics:[{name:'Выручка',before:10,after:9}],status:'draft',version:0,updated:'2026-10-22T10:00:00Z'});
 it('схема отвергает неверный ответ и опасный URL',()=>{const d=draft();d.stages[0].correct=8;d.illustration='javascript:alert(1)';expect(validateContent(d).length).toBeGreaterThan(1);});
 it('версии и журнал сохраняются отдельно от попыток',()=>{localStorage.setItem('product-lab-v1','preserved');const a=persistDraft(draft(),'save');const b=persistDraft({...a,title:'Новая версия'},'publish');expect(a.version).toBe(1);expect(b.version).toBe(2);expect(getDrafts()).toHaveLength(2);expect(getContentAudit()).toHaveLength(2);expect(localStorage.getItem('product-lab-v1')).toBe('preserved');expect(b.status).toBe('published-demo');});
});
