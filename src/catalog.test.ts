import {describe,it,expect} from 'vitest';
import {createSeed} from './seed';
import {filterProducts,EMPTY_QUERY,suppliers} from './catalog';
const now=Date.parse('2026-10-09T10:00:00+05:00');
describe('Catalog search and combined filters',()=>{
 it('finds an exact part number and rejects partial exact matches',()=>{const p=createSeed(now).products;expect(filterProducts(p,{...EMPTY_QUERY,text:p[0].partNumber,exact:true},now).map(x=>x.id)).toEqual([p[0].id]);expect(filterProducts(p,{...EMPTY_QUERY,text:'RL-BR',exact:true},now)).toHaveLength(0)});
 it('combines price, availability and publication filters',()=>{const p=createSeed(now).products;const matches=filterProducts(p,{...EMPTY_QUERY,from:'2000',to:'3000',availability:['В наличии'],status:'Опубликовано'},now);expect(matches.length).toBeGreaterThan(0);expect(matches.every(x=>x.price>=2000&&x.price<=3000&&x.stock>0&&x.published)).toBe(true)});
 it('finds additional distributors saved in the PDP',()=>{const p=createSeed(now).products[0];p.pdp={...p.pdp,distributors:JSON.stringify([{name:'Test supplier'}])};expect(suppliers(p)).toContain('Test supplier');expect(filterProducts([p],{...EMPTY_QUERY,distributors:['Test supplier']},now)).toHaveLength(1)});
});
