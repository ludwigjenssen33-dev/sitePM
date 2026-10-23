import { expect, it } from 'vitest';
import { glossary } from './glossary';
import { lessons } from '../../data/lessons';
it('ссылки глоссария ведут в существующие уроки новой программы',()=>{for(const term of glossary)expect(lessons.some(lesson=>lesson.id===term.lesson),term.term).toBe(true);});
it('ссылки глоссария ведут в урок, где термин действительно разбирается',()=>{
  const expected:Record<string,string>={'North Star Metric':'A1','Vanity Metric':'A4','Statistical Power':'C3','SRM':'C3','Confidence Interval':'C2','p-value':'C2','Guardrail Metrics':'C4','CAC':'A3'};
  for(const [term,lesson] of Object.entries(expected))expect(glossary.find(g=>g.term===term)?.lesson,term).toBe(lesson);
});
