import type { Case } from '../data/cases';
/** Only explicitly declared identities are validated; arbitrary strings are never evaluated. */
export function validateTree(c:Case){
 if(!c.checks?.length||new Set(c.metrics.map(m=>m.id)).size!==c.metrics.length)return false;
 return (['before','after'] as const).every(period=>c.checks!.every(check=>{
  const target=c.metrics.find(m=>m.id===check.target)?.[period];
  const values=check.inputs.map(id=>c.metrics.find(m=>m.id===id)?.[period]);
  if(target===undefined||!Number.isFinite(target)||values.some(v=>v===undefined||!Number.isFinite(v)))return false;
  const v=values as number[];let result:number;
  switch(check.operation){
   case 'multiply':result=v.reduce((a,b)=>a*b,1);break;
   case 'subtract':if(v.length!==2)return false;result=v[0]-v[1];break;
   case 'balance':if(v.length!==3)return false;result=v[0]+v[1]-v[2];break;
   case 'divide':if(v.length!==2||v[1]===0)return false;result=v[0]/v[1];break;
   default:return false;
  }
  return Number.isFinite(result)&&Math.abs(result-target)<=Math.max(.000001,Math.abs(target)*1e-10);
 }));
}
