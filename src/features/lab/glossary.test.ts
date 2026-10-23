import { expect, it } from 'vitest';
import { glossary } from './glossary';
import { lessons } from '../../data/lessons';
it('ссылки глоссария ведут в существующие уроки новой программы',()=>{for(const term of glossary)expect(lessons.some(lesson=>lesson.id===term.lesson),term.term).toBe(true);});
