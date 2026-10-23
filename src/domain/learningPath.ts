import {cases} from '../data/cases';
import {bestAttempts,type ProgressState} from './progress';
export function missionAccess(state:ProgressState,id:string,isAdmin=false){const index=cases.findIndex(c=>c.id===id);if(index<0)return {allowed:false,reason:'Миссия не найдена',previous:null};const previous=index>0?cases[index-1]:null;
 // Старые попытки сохраняют доступ после перехода с открытого каталога на последовательный путь.
 const existing=state.attempts.some(a=>a.caseId===id&&!a.summaryOnly);
 const completed=new Set(bestAttempts(state).map(a=>a.caseId));
 const allowed=isAdmin||index===0||existing||!!previous&&completed.has(previous.id);
 return {allowed,reason:allowed?'':`Сначала завершите миссию «${previous!.title}». Балл не ограничивает открытие следующей.`,previous};}
export function nextMission(state:ProgressState){const done=new Set(bestAttempts(state).map(a=>a.caseId));const unfinished=state.attempts.filter(a=>!a.finished&&state.active[a.caseId]===a.id).sort((a,b)=>b.updated.localeCompare(a.updated));const resume=unfinished.find(a=>missionAccess(state,a.caseId).allowed);return resume?cases.find(c=>c.id===resume.caseId)!:cases.find(c=>!done.has(c.id))||null;}
const day=(iso:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Yekaterinburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
export function learningActivity(state:ProgressState,now=new Date()){const dates=[...new Set(state.attempts.filter(a=>a.finished&&!a.summaryOnly).map(a=>day(a.updated)))].sort().reverse();const today=day(now.toISOString());const yesterday=day(new Date(now.getTime()-86400000).toISOString());let streak=0;if(dates[0]===today||dates[0]===yesterday){let cursor=Date.parse(dates[0]+'T00:00:00Z');for(const date of dates){if(Date.parse(date+'T00:00:00Z')!==cursor)break;streak++;cursor-=86400000;}}return {streak,days:dates.length,todayCompleted:dates.includes(today),next:nextMission(state)};}
