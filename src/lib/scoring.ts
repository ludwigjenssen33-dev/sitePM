import type { Case } from '../data/cases';
import { compareProportions,sampleRatioMismatch } from './statistics';
export type Answers={node:string;hypothesis:number;primary:number;guardrail:number;interpretation:number;decision:number;note:string;reasons?:number[];hints?:number[]};
export const emptyAnswers:Answers={node:'',hypothesis:-1,primary:-1,guardrail:-1,interpretation:-1,decision:-1,note:'',reasons:[],hints:[]};
export const reasonOptions=[
 'Эффект основной метрики статистически подтверждён и соответствует цели.',
 'Плановая выборка ещё не достигнута; условия позволяют продолжить по плану.',
 'Контрольные показатели не ухудшились.',
 'Выявлен вред или существенная неопределённость бизнес-эффекта.',
 'Есть проблема качества эксперимента или рандомизации.',
 'Любой положительный uplift автоматически гарантирует коммерческий успех.'
];
export function recommendedDecision(c:Case){
 const nB=c.nB??c.n;
 if(c.srm==='failed'||sampleRatioMismatch(c.n,nB).mismatch||c.guardrailStatus==='failed'||c.economicsUncertain||c.guardrailStatus==='unknown')return 1;
 if(c.n<c.planned||nB<c.planned)return 2;
 const s=compareProportions(c.xA,c.n,c.xB,nB);
 return s.pValue!==null&&s.pValue<.05&&s.delta>0?0:1;
}
export function correctReasons(c:Case):number[]{
 if(c.srm==='failed'||sampleRatioMismatch(c.n,c.nB??c.n).mismatch)return [4];
 const decision=recommendedDecision(c);
 return decision===0?[0,2]:decision===2?[1,2]:[3];
}
function reasonPoints(c:Case,a:Answers){
 const chosen=[...new Set(a.reasons||[])];if(chosen.length<1||chosen.length>2||chosen.some(v=>!Number.isInteger(v)||v<0||v>=reasonOptions.length))return 0;
 const expected=correctReasons(c);const matches=chosen.filter(i=>expected.includes(i)).length;
 return Math.max(0,Math.round(8*(matches-(chosen.length-matches))/expected.length));
}
export function hintPenalty(a:Answers){return [...new Set(a.hints||[])].filter(v=>Number.isInteger(v)&&v>=0&&v<=3).length*2;}
export function score(c:Case,a:Answers){
 const reasons=correctReasons(c);
 return [
  {name:'Диагностика',max:25,points:a.node===c.diagnosis?25:c.id==='food'&&a.node==='margin'?15:0,correct:c.metrics.find(m=>m.id===c.diagnosis)!.name,selected:c.metrics.find(m=>m.id===a.node)?.name??'Не выбрано',explanation:c.diagnosticExplanation,slides:['A2','A3']},
  {name:'Гипотеза',max:20,points:a.hypothesis===1?20:0,correct:c.hypotheses[1],selected:c.hypotheses[a.hypothesis]??'Не выбрано',explanation:'Гипотеза должна быть связана с диагностикой и описывать проверяемый механизм. Она остаётся предположением, пока не проверена.',slides:['B1','B2']},
  {name:'Метрики эксперимента',max:15,points:(a.primary===0?10:0)+(a.guardrail===0?5:0),correct:`Основная: ${c.primary[0]}. Контрольная: ${c.guardrails[0]}.`,selected:`Основная: ${c.primary[a.primary]??'не выбрана'}. Контрольная: ${c.guardrails[a.guardrail]??'не выбрана'}.`,explanation:'Основная метрика — 10 баллов, контрольная — 5. Контрольный показатель нужен для оценки побочных эффектов.',slides:['B3','C4']},
  {name:'Интерпретация',max:20,points:a.interpretation===c.correctInterpretation?20:0,correct:c.interpretations[c.correctInterpretation],selected:c.interpretations[a.interpretation]??'Не выбрано',explanation:c.srm==='failed'?'При нарушении распределения групп p-value основной метрики не устраняет проблему качества.':c.economicsUncertain?'Статистика конверсии не переносится автоматически на денежную метрику.':'Вывод ограничен выбранной метрикой, аудиторией, периодом и качеством дизайна. Отсутствие значимости не доказывает отсутствие эффекта.',slides:['C2','C3','C4']},
  {name:'Решение',max:20,points:(a.decision===c.decision?12:0)+reasonPoints(c,a),correct:`${['Внедрить изменение','Не внедрять','Продолжить эксперимент'][c.decision]}. Причины: ${reasons.map(i=>reasonOptions[i]).join(' ')}`,selected:`${['Внедрить изменение','Не внедрять','Продолжить эксперимент'][a.decision]??'Не выбрано'}. Причины: ${(a.reasons||[]).map(i=>reasonOptions[i]??'Недопустимый вариант').join(' ')||'не выбраны'}`,explanation:`${c.explanation} Выбор решения — 12 баллов. Обоснование — 8: доля верных причин с вычетом неверных, не более двух причин. Текстовое поле не оценивается.`,slides:['B5','C5']}
 ];
}
export function totalScore(c:Case,a:Answers){return Math.max(0,score(c,a).reduce((sum,row)=>sum+row.points,0)-hintPenalty(a));}
