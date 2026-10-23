import {cases} from '../../data/cases';
export type SharedResult={caseId:string;score:number};
export function sharedResult(params:URLSearchParams):SharedResult|null{const caseId=params.get('case')||'';const raw=params.get('score')||'';const score=Number(raw);return cases.some(c=>c.id===caseId)&&/^\d{1,3}$/.test(raw)&&Number.isInteger(score)&&score>=0&&score<=100?{caseId,score}:null;}
export function resultShareUrl(origin:string,result:SharedResult){const url=new URL('/shared',origin);url.searchParams.set('case',result.caseId);url.searchParams.set('score',String(result.score));return url.toString();}
export function resultShareText(result:SharedResult){const c=cases.find(c=>c.id===result.caseId);return `Мой результат в Product Lab: ${result.score}/100 за миссию «${c?.title||'Продуктовое решение'}». Попробуй принять решение на основе данных!`;}
