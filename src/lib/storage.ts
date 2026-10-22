import { emptyAnswers, type Answers } from './scoring';
export type Progress={step:number;answers:Answers;confirmed:boolean;finished:boolean;best:number;score:number;updated:string};
export type Store=Record<string,Progress>;
export const freshProgress=():Progress=>({step:0,answers:{...emptyAnswers},confirmed:false,finished:false,best:0,score:0,updated:new Date().toISOString()});
const key='product-lab-v1';
export function load():Store{
 try{const data:unknown=JSON.parse(localStorage.getItem(key)||'{}');if(!data||typeof data!=='object'||Array.isArray(data))return {};
 const result:Store={};
 for(const [id,raw] of Object.entries(data)){
  if(!['market','stream','food'].includes(id)||!raw||typeof raw!=='object')continue;
  const v=raw as Progress;
  if(!Number.isInteger(v.step)||v.step<0||v.step>3||!v.answers||typeof v.answers.node!=='string'||typeof v.answers.note!=='string'||typeof v.finished!=='boolean'||typeof v.confirmed!=='boolean'||!Number.isFinite(v.best)||v.best<0||v.best>100||!Number.isFinite(v.score)||v.score<0||v.score>100||typeof v.updated!=='string'||!Number.isFinite(Date.parse(v.updated)))continue;
  const a=v.answers;
  if(!['hypothesis','primary','guardrail','interpretation','decision'].every(k=>{const n=a[k as keyof Answers];return typeof n==='number'&&Number.isInteger(n)&&n>=-1&&n<=(k==='hypothesis'?3:2);}))continue;
  if(v.step>0&&(!v.confirmed||!a.node))continue;
  if(v.step>1&&[a.hypothesis,a.primary,a.guardrail].some(n=>n<0))continue;
  if(v.step>2&&a.interpretation<0)continue;
  if(v.finished&&(v.step!==3||a.decision<0))continue;
  result[id]=v;
 }return result;
 }catch{return {};}
}
export function save(data:Store){try{localStorage.setItem(key,JSON.stringify(data));return true;}catch{return false;}}
