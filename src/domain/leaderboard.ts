import {cases} from '../data/cases';
import {bestAttempts,type ProgressState} from './progress';
export type LeaderRow={alias:string;points:number;completed:number;average:number;demo:boolean;self?:boolean};
/** Детерминированный генератор, чтобы демо-рейтинг был одинаковым при каждом открытии. */
function rng(seed:number){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};}
const aliases=['retention_hunter','p_value_ok','tree_of_metrics','funnel_fox','cohort_queen','srm_detective','mde_master','north_star','ab_ninja','ltv_wizard','churn_buster','guardrail_guy','pilot_first','null_hypothesis','ice_cold','insight_owl','metric_monk','segment_sam','confidence_95','delta_pp','uplift_kid','sample_size','data_dragon','hypo_hero','okr_owl','cac_crusher','arpu_ace','rollout_rita','vanity_free','decision_daisy','causal_cat','interval_ivan','power_80','bonferroni_bob','holdout_hana','journey_jay','roadmap_ray','discovery_dee','unit_eco','product_pro'];
export type DemoPlayer={alias:string;best:Record<string,number>;week:Record<string,number>};
/** Демонстрационные участники — вымышленные, отмечаются в интерфейсе как «демо». */
export const demoPlayers:DemoPlayer[]=(()=>{const r=rng(20261023);return aliases.map(alias=>{const best:Record<string,number>={};const week:Record<string,number>={};for(const c of cases){if(r()<.62){best[c.id]=Math.round(45+r()*55);if(r()<.3)week[c.id]=best[c.id];}}return {alias,best,week};});})();
function row(alias:string,scores:number[],demo:boolean,self=false):LeaderRow{const points=scores.reduce((s,v)=>s+v,0);return {alias,points,completed:scores.length,average:scores.length?Math.round(points/scores.length):0,demo,self};}
/**
 * Рейтинг: сумма лучших баллов по уникальным миссиям (повторы не накручивают сумму).
 * missionIds — фильтр по миссиям курса; period 'week' — только результаты за 7 дней.
 */
export function demoLeaderboard(state:ProgressState,opts:{period:'all'|'week';missionIds?:string[];includeSelf:boolean;now?:Date}):LeaderRow[]{
 const allowed=(id:string)=>!opts.missionIds||opts.missionIds.includes(id);
 const rows=demoPlayers.map(p=>row(p.alias,Object.entries(opts.period==='week'?p.week:p.best).filter(([id])=>allowed(id)).map(([,v])=>v),true));
 if(opts.includeSelf){const since=(opts.now??new Date()).getTime()-7*86400000;const own=bestAttempts(state).filter(a=>!a.summaryOnly&&allowed(a.caseId)&&(opts.period==='all'||Date.parse(a.updated)>=since));rows.push(row(state.profile.alias||'Вы',own.map(a=>a.score),false,true));}
 return rows.filter(r=>r.completed>0).sort((a,b)=>b.points-a.points||b.completed-a.completed||a.alias.localeCompare(b.alias));
}
