export function conversion(x:number,n:number){if(!Number.isSafeInteger(n)||n<=0||!Number.isSafeInteger(x)||x<0||x>n)throw new Error('Некорректное число участников или конверсий');return x/n;}
export const absoluteChange=(a:number,b:number)=>b-a;
export function relativeChange(a:number,b:number){return a===0?null:(b/a-1);}
export function percent(v:number,digits=1){return new Intl.NumberFormat('ru-RU',{style:'percent',maximumFractionDigits:digits}).format(v);}
export function points(v:number){return `${v>0?'+':''}${(v*100).toLocaleString('ru-RU',{maximumFractionDigits:2})} п.п.`;}
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
