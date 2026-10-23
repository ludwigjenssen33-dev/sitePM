import {describe,it,expect} from 'vitest';
import {cases,caseVariants,decisions,getCase} from '../data/cases';
import {lessons,lessonGroups} from '../data/lessons';
import {score,emptyAnswers,totalScore,hintPenalty,correctReasons,recommendedDecision} from './scoring';
import {proportionCI,sampleRatioMismatch,compareProportions} from './statistics';
import {validateTree} from './metrics';

describe('Версии учебных сценариев',()=>{
 it('9+ самостоятельных миссий и 39 адресуемых уроков в пяти курсах',()=>{expect(cases.length).toBeGreaterThanOrEqual(9);expect(cases.filter(c=>c.isFinal)).toHaveLength(1);expect(lessons).toHaveLength(39);expect(lessonGroups.map(g=>g.count)).toEqual([10,8,10,6,5]);expect(new Set(lessons.map(l=>l.id)).size).toBe(39);});
 for(const c of cases)for(const [i,variant] of caseVariants(c.id).entries()){
  it(`${c.company}: вариант ${i+1} имеет корректные данные и рубрику`,()=>{
   expect(validateTree(variant)).toBe(true);
   expect(variant.decision).toBe(recommendedDecision(variant));
   expect(variant.hints).toHaveLength(4);
   expect(variant.consequences).toHaveLength(decisions.length);
   expect(variant.takeaways?.length).toBeGreaterThan(0);
   const a={...emptyAnswers,node:variant.diagnosis,hypothesis:1,primary:0,guardrail:0,interpretation:0,decision:variant.decision,reasons:correctReasons(variant),hints:[]};
   expect(totalScore(variant,a)).toBe(100);
   expect(score(variant,a).flatMap(r=>r.slides).every(id=>lessons.some(l=>l.id===id))).toBe(true);
  });
 }
 it('повторная попытка маркетплейса меняет обоснованный исход',()=>{expect(getCase('market',0).decision).toBe(2);expect(getCase('market',1).decision).toBe(0);expect(getCase('market',3).variant).toBe(1);expect(()=>getCase('missing')).toThrow();});
 it('рекомендации: клики растут, покупки значимо снижаются',()=>{const c=getCase('recommend');const s=compareProportions(c.xA,c.n,c.xB,c.n);expect(s.delta).toBeLessThan(0);expect(s.pValue).toBeLessThan(.05);expect(c.decision).toBe(1);});
 it('неправильная формула или отсутствующий узел обнаруживаются',()=>{const c=getCase('market');expect(validateTree({...c,metrics:c.metrics.map((m,i)=>i===0?{...m,after:m.after+100}:m)})).toBe(false);expect(validateTree({...c,checks:[{target:'none',operation:'divide',inputs:['visitors','orders']}]})).toBe(false);});
});
describe('Обоснование и подсказки',()=>{
 const c=getCase('market',1);
 const a={...emptyAnswers,node:c.diagnosis,hypothesis:1,primary:0,guardrail:0,interpretation:0,decision:c.decision,reasons:correctReasons(c)};
 it('12 за выбор, 8 за две причины',()=>{expect(score(c,{...a,reasons:[]})[4].points).toBe(12);expect(score(c,{...a,reasons:[0]})[4].points).toBe(16);expect(score(c,a)[4].points).toBe(20);});
 it('ошибочная причина не позволяет получить полный балл',()=>{expect(score(c,{...a,reasons:[0,3]})[4].points).toBe(12);expect(score(c,{...a,reasons:[0,2,5]})[4].points).toBe(12);});
 it('верные причины вычисляются из статистики (как в документе: кейс 1 — ДИ включает ноль и выборка не добрана)',()=>{expect(correctReasons(getCase('market',0))).toEqual([1,2]);expect(correctReasons(getCase('quality'))).toEqual([3]);expect(correctReasons(getCase('food'))).toEqual([0,6]);expect(correctReasons(getCase('recommend'))).toEqual([0,4]);expect(correctReasons(getCase('stream'))).toEqual([0,5]);});
 it('разбор объясняет неверно выбранную причину на данных кейса',()=>{const m=getCase('market',0);const row=score(m,{...emptyAnswers,decision:0,reasons:[5]})[4];expect(row.explanation).toContain('для этих данных неверно');expect(row.explanation).toMatch(/выборка 10\s000 из 15\s000/);});
 it('таблица «что можем утверждать» соответствует данным варианта',()=>{const m=getCase('market',0);expect(m.takeaways).toHaveLength(3);expect(m.takeaways![2].claim).toBe('Тест не завершён.');expect(getCase('market',1).takeaways![2].claim).toContain('можно доверять');expect(getCase('quality').takeaways![2].claim).toContain('SRM');expect(getCase('food').takeaways![2].limit).toContain('поюзерных');});
 it('компромисс метрик (QuickFood) решается ограниченным пилотом, как в уроке C5',()=>{for(const v of caseVariants('food')){expect(v.decision).toBe(3);expect(recommendedDecision(v)).toBe(3);const a={...emptyAnswers,node:v.diagnosis,hypothesis:1,primary:0,guardrail:0,interpretation:0,reasons:correctReasons(v)};expect(score(v,{...a,decision:3})[4].points).toBe(20);expect(score(v,{...a,decision:1})[4].points).toBe(14);expect(score(v,{...a,decision:0})[4].points).toBe(8);}expect(lessons.find(l=>l.id==='C5')!.table!.rows.map(r=>r[0])).toContain('Ограниченный пилот');});
 it('пилот вместо подтверждённого внедрения — частичный балл, при незавершённом тесте — ноль',()=>{expect(score(getCase('stream'),{...emptyAnswers,decision:3})[4].points).toBe(6);expect(score(getCase('market',0),{...emptyAnswers,decision:3})[4].points).toBe(0);});
 it('у каждой миссии свои подсказки по этапам',()=>{const texts=cases.map(c=>c.hints!.join('|'));expect(new Set(texts).size).toBe(cases.length);});
 it('каждая уникальная подсказка стоит 2, повторное открытие бесплатно',()=>{expect(hintPenalty({...a,hints:[0,0,1,3]})).toBe(6);expect(totalScore(c,{...a,hints:[0,1,2,3]})).toBe(92);expect(totalScore(c,{...emptyAnswers,hints:[0,1,2,3]})).toBe(0);});
});
describe('Интервалы и SRM',()=>{
 it('Wilson корректно работает на границах',()=>{expect(proportionCI(0,100)[0]).toBe(0);expect(proportionCI(0,100)[1]).toBeGreaterThan(0);expect(proportionCI(100,100)[1]).toBe(1);expect(proportionCI(50,100)[0]).toBeLessThan(.5);expect(()=>proportionCI(1,0)).toThrow();});
 it('небезопасные целые выборки отклоняются',()=>{expect(()=>compareProportions(1,1e300,1,100)).toThrow();expect(()=>sampleRatioMismatch(Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER)).toThrow();});
 it('SRM отделён от теста эффекта',()=>{expect(sampleRatioMismatch(10000,10000).mismatch).toBe(false);expect(sampleRatioMismatch(12000,8000).mismatch).toBe(true);expect(sampleRatioMismatch(12000,8000).pValue).toBeLessThan(.001);expect(sampleRatioMismatch(1,1).applicable).toBe(false);expect(()=>sampleRatioMismatch(0,100)).toThrow();});
});
