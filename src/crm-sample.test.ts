import {describe,it,expect} from 'vitest';
import {createSeed} from './seed';
import {migrateCrmSample,getCatalogProducts,CRM_SAMPLE_PRODUCTS} from './crm-sample';
import {applyAction} from './engine';

const now=Date.parse('2026-11-11T10:00:00+05:00');
describe('CRM product sample and content requests',()=>{
 it('imports ten source cards while retaining existing tickets and product references',()=>{
  const original=createSeed(now),updated=migrateCrmSample(original);
  expect(getCatalogProducts(updated.products)).toHaveLength(10);
  expect(updated.tickets).toEqual(original.tickets);
  expect(updated.operations).toEqual(original.operations);
  expect(original.products.every(p=>updated.products.some(q=>q.id===p.id))).toBe(true);
  expect(updated.products.find(p=>p.id==='55975')?.partNumber).toBe('27011668');
  expect(updated.products.find(p=>p.id==='495233')?.pdp?.publication).toBe('Черновик');
 });
 it('does not overwrite edits or reimport on subsequent loads',()=>{
  const original=createSeed(now),existing=structuredClone(CRM_SAMPLE_PRODUCTS[1]);
  existing.description='Изменено пользователем';original.products.push(existing);
  const updated=migrateCrmSample(original);
  expect(updated.products.find(p=>p.id===existing.id)?.description).toBe('Изменено пользователем');
  expect(migrateCrmSample(updated)).toBe(updated);
  expect(updated.products.filter(p=>p.id===existing.id)).toHaveLength(1);
 });
 it('routes a copied card to content with its source ID and no quality penalty',()=>{
  const original=migrateCrmSample(createSeed(now));
  const updated=applyAction(original,{type:'create_ticket',kind:'description',productIds:['55975'],source:'https://admin.apltech.kz/product/update/55975',description:'Уточнить описание антенны'},now,'manager1');
  const ticket=updated.tickets[0];
  expect(ticket.productIds).toEqual(['55975']);expect(ticket.teamId).toBe('content');
  expect(ticket.status).toBe('queued');expect(ticket.assigneeId).toBeUndefined();
  expect(updated.issues).toEqual(original.issues);expect(updated.operations).toEqual(original.operations);
 });
});
