export function conversion(x:number,n:number){if(!Number.isSafeInteger(n)||n<=0||!Number.isSafeInteger(x)||x<0||x>n)throw new Error('Некорректное число участников или конверсий');return x/n;}
export const absoluteChange=(a:number,b:number)=>b-a;
export function relativeChange(a:number,b:number){return a===0?null:(b/a-1);}
/** Типографский минус вместо дефиса в отрицательных числах. */
const minus=(s:string)=>s.replace('-','−');
export function percent(v:number,digits=1){return minus(new Intl.NumberFormat('ru-RU',{style:'percent',maximumFractionDigits:digits}).format(v));}
export function points(v:number){return `${v>0?'+':''}${minus((v*100).toLocaleString('ru-RU',{maximumFractionDigits:2}))} п.п.`;}
/** Число для подписей осей и подсказок графиков: запятая, минус, без лишних нулей. */
export function axisNumber(v:number,digits=2){return minus(v.toLocaleString('ru-RU',{maximumFractionDigits:digits}));}
/** Круглые деления оси: шаг 1, 2, 2,5 или 5 × 10ⁿ, ноль всегда среди делений, если входит в диапазон. */
export function niceTicks(min:number,max:number,count=5):number[]{if(!(max>min))return [min];const raw=(max-min)/Math.max(1,count-1);const pow=10**Math.floor(Math.log10(raw));const step=[1,2,2.5,5,10].map(m=>m*pow).find(s=>s>=raw)??raw;const start=Math.floor(min/step+1e-9)*step;const ticks:number[]=[];for(let v=start;v<max+step-1e-9;v+=step)ticks.push(Math.round(v*1e6)/1e6);return ticks;}
function normalCDF(z:number){const t=1/(1+0.2316419*Math.abs(z));const p=1-Math.exp(-z*z/2)/Math.sqrt(2*Math.PI)*(0.319381530*t-0.356563782*t**2+1.781477937*t**3-1.821255978*t**4+1.330274429*t**5);return z>=0?p:1-p;}
export function compareProportions(xA:number,nA:number,xB:number,nB:number){
 if(!Number.isSafeInteger(nA+nB))throw new Error('Размер объединённой выборки слишком велик');
 const a=conversion(xA,nA),b=conversion(xB,nB),pool=(xA+xB)/(nA+nB),delta=b-a;
 const applicable=[xA,nA-xA,xB,nB-xB].every(v=>v>=10);
 const seNull=Math.sqrt(pool*(1-pool)*(1/nA+1/nB));
 const z=seNull===0?0:delta/seNull;
 const se=Math.sqrt(a*(1-a)/nA+b*(1-b)/nB);
 return {a,b,delta,uplift:relativeChange(a,b),z,applicable,pValue:applicable?Math.max(0,Math.min(1,2*(1-normalCDF(Math.abs(z))))):null,ci:applicable?[delta-1.96*se,delta+1.96*se] as [number,number]:null};
}

/**
 * Размер выборки на группу для сравнения двух долей (нормальное приближение):
 * n = (z₁₋α/₂ + z₁₋β)² · [p₁(1−p₁) + p₂(1−p₂)] / (p₂ − p₁)².
 * Поддерживаются α = 0,05 / 0,01 и мощность 0,8 / 0,9.
 */
export function sampleSizePerGroup(base:number,mde:number,alpha:.05|.01=.05,power:.8|.9=.8){
 if(!(base>0&&base<1)||!Number.isFinite(mde)||mde===0||!(base+mde>0&&base+mde<1))throw new Error('Некорректная база или минимальный эффект');
 const za=alpha===.05?1.959963984540054:2.5758293035489;const zb=power===.8?.8416212335729143:1.2815515655446004;const p2=base+mde;
 return Math.ceil((za+zb)**2*(base*(1-base)+p2*(1-p2))/mde**2);
}
/** Wilson score interval for one binomial proportion; defined at 0 and n successes. */
export function proportionCI(x:number,n:number):[number,number]{
 const p=conversion(x,n),z=1.959963984540054,z2=z*z,denominator=1+z2/n;
 const center=(p+z2/(2*n))/denominator;
 const half=z*Math.sqrt(p*(1-p)/n+z2/(4*n*n))/denominator;
 return [x===0?0:Math.max(0,center-half),x===n?1:Math.min(1,center+half)];
}
/** Pearson goodness-of-fit against the assignment plan; SRM is a diagnostic, not a cause. */
export function sampleRatioMismatch(nA:number,nB:number,expectedA=.5){
 if(!Number.isSafeInteger(nA)||!Number.isSafeInteger(nB)||!Number.isSafeInteger(nA+nB)||nA<=0||nB<=0||!Number.isFinite(expectedA)||expectedA<=0||expectedA>=1)throw new Error('Некорректный план распределения групп');
 const total=nA+nB,eA=total*expectedA,eB=total*(1-expectedA);
 const chiSquare=(nA-eA)**2/eA+(nB-eB)**2/eB;
 const applicable=eA>=5&&eB>=5;
 const pValue=applicable?Math.max(0,Math.min(1,2*(1-normalCDF(Math.sqrt(chiSquare))))):null;
 return {chiSquare,pValue,mismatch:pValue!==null&&pValue<.001,applicable};
}
