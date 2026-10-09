import {describe,it,expect} from 'vitest';
import {createSeed} from './seed';
import {clearTicketWorkspace} from './workspace';
import {applyAction} from './engine';
const now=Date.parse('2026-10-09T11:00:00+05:00');
describe('Empty live ticket workspace',()=>{
 it('clears tickets and related results while preserving products, rules and plan work',()=>{const before=createSeed(now);const clean=clearTicketWorkspace(before);expect(clean.tickets).toEqual([]);expect(clean.notifications).toEqual([]);expect(clean.operations.every(o=>!o.ticketId)).toBe(true);expect(clean.products).toEqual(before.products);expect(clean.settings).toEqual(before.settings);expect(clean.operations).toHaveLength(2);expect(before.tickets).toHaveLength(3)});
 it('accepts a new request and completes the actual work once',()=>{let s=clearTicketWorkspace(createSeed(now));s=applyAction(s,{type:'create_ticket',kind:'description',productIds:['526005'],source:'Demo source',description:'Update description'},now,'manager1');const id=s.tickets[0].id;expect(s.notifications.filter(n=>n.ticketId===id)).toHaveLength(2);s=applyAction(s,{type:'ack_ticket',ticketId:id},now+1000,'specialist1');s=applyAction(s,{type:'claim_ticket',ticketId:id},now+2000,'specialist1');s=applyAction(s,{type:'edit_product',productId:'526005',changes:{description:'Updated valid description'}},now+3000,'specialist1');s=applyAction(s,{type:'complete_ticket',ticketId:id},now+4000,'specialist1');expect(s.tickets[0].status).toBe('completed');expect(s.operations.filter(o=>o.ticketId===id)).toHaveLength(1);expect(s.operations.find(o=>o.ticketId===id)?.multiplier).toBe(1.5);expect(applyAction(s,{type:'complete_ticket',ticketId:id},now+5000,'specialist1').operations.filter(o=>o.ticketId===id)).toHaveLength(1)});
});

