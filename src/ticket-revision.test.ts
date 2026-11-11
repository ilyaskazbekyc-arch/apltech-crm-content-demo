import {describe,it,expect} from 'vitest';
import {createSeed} from './seed';
import {migrateTicketWorkspace} from './workspace';
import {applyAction,getTicketBaseWU,getTicketSla,getProductBaseWU} from './engine';
const at=Date.parse('2026-11-11T10:00:00+05:00');
describe('Updated ticket rules',()=>{
 it('migrates once, clears related results, preserves products and future tickets',()=>{
 const seed=createSeed(at);const clean=migrateTicketWorkspace(seed);expect(clean.products).toEqual(seed.products);expect(clean.tickets).toEqual([]);expect(clean.operations.every(o=>!o.ticketId)).toBe(true);expect(clean.settings.responseMinutes).toBe(3);expect(clean.settings.executionMinutes).toBe(5);
 const next=applyAction(clean,{type:'create_ticket',kind:'description',productIds:['526005'],source:'CRM',description:'Fix'},at,'manager1');expect(migrateTicketWorkspace(next).tickets).toHaveLength(1);
 });
 it('merge takes highest priority, costs 1 WU and uses a five minute processing budget',()=>{
 let state=migrateTicketWorkspace(createSeed(at));state=applyAction(state,{type:'create_ticket',kind:'merge',productIds:['526005','526009'],source:'CRM',description:'Merge'},at,'manager1');const id=state.tickets[0].id;
 expect(state.tickets[0].priority).toBe('Critical');expect(getTicketBaseWU(state.tickets[0],state)).toBe(1);expect(state.tickets[0].assigneeId).toBeUndefined();
 state=applyAction(state,{type:'ack_ticket',ticketId:id},at,'specialist2');state=applyAction(state,{type:'claim_ticket',ticketId:id},at,'specialist2');expect(getTicketSla(state.tickets[0],state,at).executionRemaining).toBe(5);
 state=applyAction(state,{type:'complete_ticket',ticketId:id},at+60000,'specialist2');expect(state.operations.find(o=>o.ticketId===id)?.baseWU).toBe(1);
 });
 it('saves product profile, updates open priority and publication weight but keeps correction at 1 WU',()=>{
 let state=migrateTicketWorkspace(createSeed(at));state=applyAction(state,{type:'create_ticket',kind:'publish',productIds:['526005'],source:'CRM',description:'Publish'},at,'manager1');
 state=applyAction(state,{type:'set_product_profile',productId:'526005',priority:'Normal',complexity:'easy',reason:'Profile'},at,'lead1');expect(state.products[0].complexity).toBe('easy');expect(state.tickets[0].priority).toBe('Normal');expect(getTicketBaseWU(state.tickets[0],state)).toBe(getProductBaseWU(state.products[0],state.settings));expect(()=>applyAction(state,{type:'set_product_profile',productId:'526005',priority:'High',complexity:'complex',reason:'x'},at,'manager1')).toThrow();
 state=applyAction(state,{type:'create_ticket',kind:'description',productIds:['526005'],source:'CRM',description:'Fix'},at,'manager1');expect(getTicketBaseWU(state.tickets[0],state)).toBe(1);
 });
});