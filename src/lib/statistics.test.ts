import { describe,it,expect } from 'vitest';
import { absoluteChange,axisNumber,compareProportions,conversion,niceTicks,percent,points,relativeChange,sampleSizePerGroup } from './statistics';
import { cases } from '../data/cases';
import { validateTree } from './metrics';
import { score,emptyAnswers,correctReasons } from './scoring';
describe('Статистические вычисления',()=>{
it('одинаковые доли',()=>{const s=compareProportions(100,1000,100,1000);expect(s.pValue).toBeCloseTo(1,5);expect(s.delta).toBe(0);expect(s.ci![0]).toBeLessThan(0);expect(s.ci![1]).toBeGreaterThan(0);});
it('положительный эффект',()=>{const s=compareProportions(100,1000,200,1000);expect(s.delta).toBeCloseTo(.1);expect(s.pValue).toBeLessThan(.05);expect(s.ci![0]).toBeGreaterThan(0);});
it('отрицательный эффект симметричен',()=>{const s=compareProportions(200,1000,100,1000);expect(s.delta).toBeCloseTo(-.1);expect(s.pValue).toBeCloseTo(compareProportions(100,1000,200,1000).pValue!,8);expect(s.ci![1]).toBeLessThan(0);});
it('нулевые конверсии не используют непригодное приближение',()=>{const s=compareProportions(0,100,0,100);expect(s.a).toBe(0);expect(s.uplift).toBeNull();expect(s.applicable).toBe(false);expect(s.pValue).toBeNull();expect(s.ci).toBeNull();});
it('малые и крайние выборки не используют z-тест',()=>{expect(compareProportions(1,100,4,100).pValue).toBeNull();expect(compareProportions(100,100,100,100).pValue).toBeNull();});
it.each([[1,0],[1,-1],[-1,100],[101,100],[1,1.5],[.5,100],[NaN,100],[1,Infinity]])('невалидный ввод %s / %s',(x,n)=>expect(()=>conversion(x,n)).toThrow());
it('маркетплейс',()=>{const s=compareProportions(500,10000,550,10000);expect(s.a).toBe(.05);expect(s.b).toBe(.055);expect(s.delta).toBeCloseTo(.005);expect(s.uplift).toBeCloseTo(.1);expect(s.pValue).toBeCloseTo(.1129,3);expect(s.ci![0]).toBeLessThan(0);});
it('подписочный сервис',()=>{const s=compareProportions(3500,5000,3750,5000);expect(s.delta).toBeCloseTo(.05);expect(s.uplift).toBeCloseTo(.07142857);expect(s.pValue).toBeLessThan(.000001);expect(s.ci![0]).toBeGreaterThan(0);});
it('доставка',()=>{const s=compareProportions(4000,20000,3800,20000);expect(s.delta).toBeCloseTo(-.01);expect(s.pValue).toBeLessThan(.05);expect(.19*65).toBeCloseTo(12.35);expect(relativeChange(9,12.35)).toBeCloseTo(.372222);});
it('отрицательные значения выводятся с типографским минусом',()=>{expect(points(-.0012)).toBe('−0,12 п.п.');expect(percent(-.1)).toMatch(/^−10/);expect(axisNumber(-.5)).toBe('−0,5');});
it('деления оси круглые и включают границы',()=>{expect(niceTicks(-.12,1.12)).toEqual([-.5,0,.5,1,1.5]);expect(niceTicks(0,28)).toEqual([0,10,20,30]);const t=niceTicks(.48,1.52);expect(t[0]).toBeLessThanOrEqual(.48);expect(t[t.length-1]).toBeGreaterThanOrEqual(1.52);});
it('единицы эффекта',()=>{expect(absoluteChange(.05,.055)).toBeCloseTo(.005);expect(points(.005)).toBe('+0,5 п.п.');expect(percent(.05)).toBe('5 %');expect(relativeChange(0,1)).toBeNull();});
});
describe('Данные и рубрика',()=>{for(const c of cases){it(`${c.company}: дерево согласовано`,()=>expect(validateTree(c)).toBe(true));it(`${c.company}: верные ответы = 100`,()=>{const a={...emptyAnswers,node:c.diagnosis,hypothesis:1,primary:0,guardrail:0,interpretation:0,decision:c.decision,reasons:correctReasons(c)};expect(score(c,a).reduce((s,r)=>s+r.points,0)).toBe(100);});it(`${c.company}: неверные ответы = 0`,()=>{const a={...emptyAnswers,node:c.metrics[0].id,hypothesis:0,primary:1,guardrail:1,interpretation:1,decision:c.decision===0?1:0};expect(score(c,a).reduce((s,r)=>s+r.points,0)).toBe(0);});}it('частичный диагноз QuickFood',()=>expect(score(cases[2],{...emptyAnswers,node:'margin'})[0].points).toBe(15));it('частичный диагноз: верная ветка на уровень выше',()=>{expect(score(cases[0],{...emptyAnswers,node:'orders'})[0].points).toBe(15);expect(score(cases.find(c=>c.id==='ads')!,{...emptyAnswers,node:'spend'})[0].points).toBe(15);expect(score(cases[0],{...emptyAnswers,node:'revenue'})[0].points).toBe(0);expect(score(cases[0],{...emptyAnswers,node:'visitors'})[0].points).toBe(0);});});
describe('Размер выборки',()=>{
 it('классическая формула для двух долей',()=>{const n=sampleSizePerGroup(.05,.005);expect(n).toBeGreaterThan(30000);expect(n).toBeLessThan(32500);const big=sampleSizePerGroup(.05,.01);expect(big).toBeGreaterThan(7800);expect(big).toBeLessThan(8500);});
 it('больше мощность и строже α — больше выборка',()=>{expect(sampleSizePerGroup(.1,.02,.05,.9)).toBeGreaterThan(sampleSizePerGroup(.1,.02));expect(sampleSizePerGroup(.1,.02,.01)).toBeGreaterThan(sampleSizePerGroup(.1,.02));});
 it('некорректные входы отклоняются',()=>{expect(()=>sampleSizePerGroup(0,.01)).toThrow();expect(()=>sampleSizePerGroup(.5,0)).toThrow();expect(()=>sampleSizePerGroup(.95,.1)).toThrow();});
});
