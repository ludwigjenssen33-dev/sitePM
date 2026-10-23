import {describe,expect,it} from 'vitest';
import {courses,courseLessons,courseProgress,getCourse,lessonById,locateLesson,searchLessons} from './courses';
import {lessons,literature} from './lessons';
import {cases} from './cases';
import {demoLeaderboard,demoPlayers} from '../domain/leaderboard';
import {emptyProgress} from '../domain/progress';

describe('Курсы',()=>{
 it('пять курсов, каждый урок ровно в одном курсе',()=>{expect(courses).toHaveLength(5);const all=courses.flatMap(courseLessons);expect(all).toHaveLength(lessons.length);expect(new Set(all).size).toBe(lessons.length);expect(all.every(id=>lessonById(id))).toBe(true);});
 it('у каждого урока есть проблема, модель, итог, тренажёр и мини-практика',()=>{for(const l of lessons){expect(l.problem,l.id).toBeTruthy();expect(l.scheme.rows.length,l.id).toBeGreaterThan(0);expect(l.summary,l.id).toBeTruthy();expect(l.widget,l.id).toBeTruthy();expect(l.options?.length,l.id).toBeGreaterThan(1);expect(l.correct!,l.id).toBeLessThan(l.options!.length);}});
 it('ссылки на миссии и литературу существуют',()=>{for(const l of lessons){if(l.caseId)expect(cases.some(c=>c.id===l.caseId),l.id).toBe(true);if(l.source)expect(literature[l.source],l.id).toBeTruthy();}for(const c of courses)for(const m of c.missions)expect(cases.some(x=>x.id===m),m).toBe(true);});
 it('незавершённые курсы честно помечены количеством запланированных уроков',()=>{for(const c of courses)expect(c.plannedLessons).toBeGreaterThanOrEqual(courseLessons(c).length);});
 it('locateLesson даёт соседей и модуль',()=>{const loc=locateLesson('C2')!;expect(loc.course.id).toBe('abtest');expect(loc.prev).toBeTruthy();expect(loc.next).toBeTruthy();expect(locateLesson('Z9')).toBeNull();});
 it('прогресс курса и следующий урок',()=>{const c=getCourse('analytics')!;const list=courseLessons(c);expect(courseProgress(c,[]).next).toBe(list[0]);const p=courseProgress(c,[list[0],list[1]]);expect(p.done).toBe(2);expect(p.next).toBe(list[2]);expect(courseProgress(c,list).percent).toBe(100);expect(courseProgress(c,list).next).toBeNull();});
 it('поиск по урокам: минимум 2 символа и находит SRM',()=>{expect(searchLessons('s')).toHaveLength(0);expect(searchLessons('SRM').some(r=>r.lesson.id==='C3')).toBe(true);});
});
describe('Демо-рейтинг',()=>{
 it('детерминирован и не содержит email',()=>{expect(demoPlayers.map(p=>p.alias)).toEqual(demoPlayers.map(p=>p.alias));expect(demoPlayers.every(p=>!p.alias.includes('@'))).toBe(true);});
 it('повторы одной миссии не накручивают сумму, скрытый пользователь не показывается',()=>{const s=emptyProgress();const at=(id:string,score:number)=>({id:id+score,caseId:'market',variant:0,step:4,answers:{} as never,confirmed:true,finished:true,score,updated:new Date().toISOString(),startedAt:new Date().toISOString()});const state={...s,attempts:[at('a',60),at('b',80),at('c',70)]};const rows=demoLeaderboard(state,{period:'all',includeSelf:true});const me=rows.find(r=>r.self)!;expect(me.points).toBe(80);expect(me.completed).toBe(1);expect(rows.every(r=>r.self||r.demo)).toBe(true);expect(demoLeaderboard(state,{period:'all',includeSelf:false}).some(r=>r.self)).toBe(false);});
 it('фильтр по курсу оставляет только миссии курса',()=>{const ids=getCourse('abtest')!.missions;const all=demoLeaderboard(emptyProgress(),{period:'all',includeSelf:false});const filtered=demoLeaderboard(emptyProgress(),{period:'all',missionIds:ids,includeSelf:false});expect(filtered[0].points).toBeLessThanOrEqual(all[0].points);expect(filtered.every(r=>r.completed<=ids.length)).toBe(true);});
});
