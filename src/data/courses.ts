import {lessons,type Slide} from './lessons';
export type CourseModule={id:string;title:string;lessons:string[]};
export type Course={id:string;title:string;subtitle:string;level:'Начальный'|'Средний'|'Продвинутый';skills:string[];modules:CourseModule[];
 /** Сколько уроков запланировано всего; если больше готовых — курс помечается «в разработке». */
 plannedLessons:number;
 /** Миссии, в которых применяются навыки курса. */
 missions:string[];color:'blue'|'teal'|'gold'|'indigo'|'slate'};
export const courses:Course[]=[
 {id:'analytics',title:'Основы продуктовой аналитики',subtitle:'Метрики, деревья, воронки, удержание и диагностика проблем',level:'Начальный',color:'blue',plannedLessons:10,missions:['market','stream','interface','recommend','ecommerce'],
  skills:['Дерево метрик','Воронки','Retention и когорты','Сегментация','Диагностика'],
  modules:[{id:'m1',title:'Метрики и деревья',lessons:['A1','A2','A3','A4','A5']},{id:'m2',title:'Воронки, удержание и сегменты',lessons:['A6','A7','A8','A9']},{id:'m3',title:'Диагностика',lessons:['A10']}]},
 {id:'hypotheses',title:'Продуктовые гипотезы',subtitle:'От проблемы к проверяемой гипотезе и плану эксперимента',level:'Средний',color:'teal',plannedLessons:8,missions:['market','stream','ads','saas'],
  skills:['Сильный диагноз','Исследования','Приоритизация','Метрики эксперимента'],
  modules:[{id:'m1',title:'Проблема и диагноз',lessons:['B1','B2','B3']},{id:'m2',title:'Исследования и приоритизация',lessons:['B6','B7']},{id:'m3',title:'План проверки и ограничения',lessons:['B4','B8','B5']}]},
 {id:'abtest',title:'A/B-тестирование',subtitle:'Эффект, значимость, мощность, качество теста и решения',level:'Средний',color:'indigo',plannedLessons:10,missions:['market','stream','quality','fitness','food'],
  skills:['Конверсия и эффект','Значимость и интервал','Мощность','SRM','Решение после теста'],
  modules:[{id:'m1',title:'Основы эксперимента',lessons:['C1','C6','C2']},{id:'m2',title:'Выборка и качество',lessons:['C7','C3','C4','C8']},{id:'m3',title:'Интерпретация и запуск',lessons:['C9','C5','C10']}]},
 {id:'economics',title:'Юнит-экономика',subtitle:'Маржа, CAC, ARPU, LTV и устойчивость модели',level:'Средний',color:'gold',plannedLessons:9,missions:['food','ads','price'],
  skills:['Маржа на единицу','CAC','ARPU / ARPPU','LTV и окупаемость','Чувствительность'],
  modules:[{id:'m1',title:'Единица и привлечение',lessons:['E1','E2','E3']},{id:'m2',title:'Срок жизни клиента',lessons:['E4','E5','E6']}]},
 {id:'practice',title:'Продуктовый менеджмент на практике',subtitle:'Видение, discovery, цели, roadmap и итоговый проект',level:'Продвинутый',color:'slate',plannedLessons:10,missions:['fintech','saas','final'],
  skills:['Видение и стратегия','Discovery','OKR и KPI','Roadmap','Итоговый проект'],
  modules:[{id:'m1',title:'Стратегия и discovery',lessons:['P1','P2']},{id:'m2',title:'Цели и планирование',lessons:['P3','P4']},{id:'m3',title:'Итоговый проект',lessons:['P5']}]}
];
export const courseLessons=(c:Course)=>c.modules.flatMap(m=>m.lessons);
export const getCourse=(id:string)=>courses.find(c=>c.id===id);
/** Курс, модуль и позиция урока в программе. */
export function locateLesson(lessonId:string){for(const course of courses){const list=courseLessons(course);const index=list.indexOf(lessonId);if(index>=0){const module=course.modules.find(m=>m.lessons.includes(lessonId))!;return {course,module,index,list,prev:list[index-1]??null,next:list[index+1]??null};}}return null;}
export const lessonById=(id:string):Slide|undefined=>lessons.find(l=>l.id===id);
export function courseProgress(c:Course,completed:string[]){const list=courseLessons(c);const done=list.filter(id=>completed.includes(id)).length;return {done,total:list.length,percent:list.length?Math.round(done/list.length*100):0,next:list.find(id=>!completed.includes(id))??null};}
/** Поиск по курсам и урокам: название, тема, текст. */
export function searchLessons(query:string){const q=query.trim().toLowerCase();if(q.length<2)return [];return lessons.filter(l=>[l.title,l.problem,l.body,l.summary].join(' ').toLowerCase().includes(q)).slice(0,12).map(l=>({lesson:l,where:locateLesson(l.id)}));}
