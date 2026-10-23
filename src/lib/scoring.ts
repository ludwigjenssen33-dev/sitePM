import type { Case } from '../data/cases';
import { compareProportions,points,sampleRatioMismatch } from './statistics';
export type Answers={node:string;hypothesis:number;primary:number;guardrail:number;interpretation:number;decision:number;note:string;reasons?:number[];hints?:number[]};
export const emptyAnswers:Answers={node:'',hypothesis:-1,primary:-1,guardrail:-1,interpretation:-1,decision:-1,note:'',reasons:[],hints:[]};
/** Причины из документа доработок + денежная неопределённость (кейс QuickFood). Одинаковы для всех миссий. */
export const reasonOptions=[
 'p-value меньше 0,05 — различие по основной метрике статистически значимо.',
 'Доверительный интервал эффекта включает ноль.',
 'Выборка не добрана до запланированной.',
 'Нарушено распределение групп (SRM).',
 'Ухудшилась контрольная метрика.',
 'Эффект на итоговую метрику бизнеса положительный.',
 'Денежный эффект не оценён: метрики двигаются в разные стороны.'
];
/** Этап миссии, к которому относится критерий: подсказка этапа отмечается в разборе. */
export const criterionStage=[0,1,1,2,3];
/** Урок, на который ведёт подсказка каждого этапа. */
export const hintLesson=['A3','B2','C2','C5'];
function facts(c:Case){const nB=c.nB??c.n;const s=compareProportions(c.xA,c.n,c.xB,nB);return {s,nB,srm:c.srm==='failed'||sampleRatioMismatch(c.n,nB).mismatch,sig:s.pValue!==null&&s.pValue<.05,ciZero:!s.ci||(s.ci[0]<=0&&s.ci[1]>=0),reached:c.n>=c.planned&&nB>=c.planned};}
export function recommendedDecision(c:Case){
 const f=facts(c);
 if(f.srm||c.guardrailStatus==='failed'||c.economicsUncertain||c.guardrailStatus==='unknown')return 1;
 if(!f.reached)return 2;
 return f.sig&&f.s.delta>0?0:1;
}
/** Верные причины вычисляются из рассчитанной статистики, так же как верное решение. */
export function correctReasons(c:Case):number[]{
 const f=facts(c);
 if(f.srm)return [3];
 if(!f.reached)return f.ciZero?[1,2]:[2];
 if(c.economicsUncertain)return f.sig?[0,6]:[1,6];
 if(c.guardrailStatus==='failed')return f.sig?[0,4]:[4];
 if(f.sig)return f.s.delta>0?[0,5]:[0];
 return [1];
}
/** Истинно ли утверждение причины для этих данных — для пояснения неверно выбранных причин. */
function reasonTrue(c:Case,i:number){const f=facts(c);return [f.sig,f.ciZero,!f.reached,f.srm,c.guardrailStatus==='failed',recommendedDecision(c)===0,!!c.economicsUncertain][i];}
export function reasonFeedback(c:Case,a:Answers){const f=facts(c);const expected=correctReasons(c);const data=`Данные: p ${f.s.pValue===null?'не рассчитан':f.s.pValue<.001?'< 0,001':'≈ '+f.s.pValue.toLocaleString('ru-RU',{maximumFractionDigits:3})}; 95% ДИ ${f.s.ci?`${points(f.s.ci[0])} … ${points(f.s.ci[1])}`:'не рассчитан'}; выборка ${Math.min(c.n,f.nB).toLocaleString('ru-RU')} из ${c.planned.toLocaleString('ru-RU')}; SRM ${f.srm?'есть':'нет'}.`;
 return {data,lines:[...new Set(a.reasons||[])].filter(i=>!expected.includes(i)&&reasonOptions[i]).map(i=>reasonTrue(c,i)?`«${reasonOptions[i]}» — верно для этих данных, но не определяет решение.`:`«${reasonOptions[i]}» — для этих данных неверно.`)};}
function reasonPoints(c:Case,a:Answers){
 const chosen=[...new Set(a.reasons||[])];if(chosen.length<1||chosen.length>2||chosen.some(v=>!Number.isInteger(v)||v<0||v>=reasonOptions.length))return 0;
 const expected=correctReasons(c);const matches=chosen.filter(i=>expected.includes(i)).length;
 return Math.max(0,Math.round(8*(matches-(chosen.length-matches))/expected.length));
}
export function hintPenalty(a:Answers){return [...new Set(a.hints||[])].filter(v=>Number.isInteger(v)&&v>=0&&v<=3).length*2;}
/** Узел на уровень выше правильного ответа в той же ветке: верное направление, частичный балл. */
export function isParentOfDiagnosis(c:Case,node:string){const m=c.metrics.find(x=>x.id===node);return !!m&&m.level>0&&!!c.checks?.some(k=>k.target===node&&k.inputs.includes(c.diagnosis));}
export const DIAGNOSIS_PARTIAL=15;
function diagnosisPoints(c:Case,node:string){return node===c.diagnosis?25:isParentOfDiagnosis(c,node)?DIAGNOSIS_PARTIAL:0;}
/** Пояснение к выбранному узлу диагностики. */
export function diagnosisFeedback(c:Case,node:string){const m=c.metrics.find(x=>x.id===node);const right=c.metrics.find(x=>x.id===c.diagnosis)!;if(!m)return 'Узел не выбран.';if(node===c.diagnosis)return `Верно: метрика «${m.name}» — самый конкретный изменившийся компонент.`;if(isParentOfDiagnosis(c,node))return `Направление верное: метрика «${m.name}» действительно изменилась, но она производная. Спуститесь на уровень ниже — её изменение объясняется компонентом «${right.name}».`;if(m.level===0)return `Метрика «${m.name}» — итоговый показатель, изменение которого нужно объяснить. Диагностика требует найти составляющую.`;if(m.before===m.after)return `Метрика «${m.name}» не изменилась между периодами, поэтому не может объяснить изменение итогового показателя.`;return `Метрика «${m.name}» изменилась, но это следствие или сопутствующий расчёт, а не источник. Сверьте формулу: изменение итога объясняет «${right.name}».`;}
const why=(list:string[]|undefined,i:number)=>i>=0&&list?.[i]?` Почему не так: ${list[i]}`:'';
export function score(c:Case,a:Answers){
 const reasons=correctReasons(c);const rf=reasonFeedback(c,a);
 const diagSlides=['A2','A3',...(c.id==='market'||c.id==='recommend'?['A4']:[])];
 return [
  {name:'Диагностика',max:25,points:diagnosisPoints(c,a.node),correct:c.metrics.find(m=>m.id===c.diagnosis)!.name,selected:c.metrics.find(m=>m.id===a.node)?.name??'Не выбрано',explanation:`${a.node===c.diagnosis?'':diagnosisFeedback(c,a.node)+' '}${c.diagnosticExplanation}`,slides:diagSlides},
  {name:'Гипотеза',max:20,points:a.hypothesis===1?20:0,correct:c.hypotheses[1],selected:c.hypotheses[a.hypothesis]??'Не выбрано',explanation:`Гипотеза должна быть связана с диагностикой и описывать проверяемый механизм. Она остаётся предположением, пока не проверена.${a.hypothesis===1?'':why(c.why?.hypotheses,a.hypothesis)}`,slides:['B2','B3']},
  {name:'Метрики эксперимента',max:15,points:(a.primary===0?10:0)+(a.guardrail===0?5:0),correct:`Основная: ${c.primary[0]}. Контрольная: ${c.guardrails[0]}.`,selected:`Основная: ${c.primary[a.primary]??'не выбрана'}. Контрольная: ${c.guardrails[a.guardrail]??'не выбрана'}.`,explanation:`Основная метрика — 10 баллов, контрольная — 5. Контрольный показатель нужен для оценки побочных эффектов.${a.primary===0?'':why(c.why?.primary,a.primary)}${a.guardrail===0?'':why(c.why?.guardrails,a.guardrail)}`,slides:['B4','C4']},
  {name:'Интерпретация',max:20,points:a.interpretation===c.correctInterpretation?20:0,correct:c.interpretations[c.correctInterpretation],selected:c.interpretations[a.interpretation]??'Не выбрано',explanation:`${c.srm==='failed'?'При нарушении распределения групп p-value основной метрики не устраняет проблему качества.':c.economicsUncertain?'Статистика конверсии не переносится автоматически на денежную метрику.':'Вывод ограничен выбранной метрикой, аудиторией, периодом и качеством дизайна. Отсутствие значимости не доказывает отсутствие эффекта.'}${a.interpretation===c.correctInterpretation?'':why(c.why?.interpretations,a.interpretation)}`,slides:['C2','C3']},
  {name:'Решение',max:20,points:(a.decision===c.decision?12:0)+reasonPoints(c,a),correct:`${['Внедрить изменение','Не внедрять','Продолжить эксперимент'][c.decision]}. Причины: ${reasons.map(i=>reasonOptions[i]).join(' ')}`,selected:`${['Внедрить изменение','Не внедрять','Продолжить эксперимент'][a.decision]??'Не выбрано'}. Причины: ${(a.reasons||[]).map(i=>reasonOptions[i]??'Недопустимый вариант').join(' ')||'не выбраны'}`,explanation:`${c.explanation} ${rf.data}${rf.lines.length?' '+rf.lines.join(' '):''} Выбор решения — 12 баллов, обоснование — 8: доля верных причин с вычетом неверных. Текстовое поле не оценивается.`,slides:['B5','C5']}
 ];
}
export function totalScore(c:Case,a:Answers){return Math.max(0,score(c,a).reduce((sum,row)=>sum+row.points,0)-hintPenalty(a));}
