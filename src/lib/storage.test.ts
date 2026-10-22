import {beforeEach,expect,it} from 'vitest';
import {freshProgress,load,save} from './storage';
let raw:string|null=null;
beforeEach(()=>{raw=null;Object.defineProperty(globalThis,'localStorage',{value:{getItem:()=>raw,setItem:(_k:string,v:string)=>{raw=v;}},configurable:true});});
it('пустой браузер',()=>expect(load()).toEqual({}));
it('сохраняет и восстанавливает ответы и лучший балл',()=>{const p=freshProgress();p.answers.node='conversion';p.best=85;expect(save({market:p})).toBe(true);expect(load().market).toEqual(p);});
it('повреждённый JSON не ломает приложение',()=>{raw='{broken';expect(load()).toEqual({});});
it('неполная или недопустимая запись игнорируется',()=>{raw=JSON.stringify({market:{step:3,finished:true},food:{...freshProgress(),step:9}});expect(load()).toEqual({});});
it('отказ хранилища сообщается вызывающему коду',()=>{Object.defineProperty(globalThis,'localStorage',{value:{setItem:()=>{throw new Error('quota');}},configurable:true});expect(save({})).toBe(false);});
