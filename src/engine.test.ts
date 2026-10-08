import { describe, expect, it } from 'vitest';
import { applyAction, getAnalytics, getProductBaseWU, getTicketBaseWU, getTicketSla, workingMinutes, addWorkingMinutes } from './engine';
import { createSeed } from './seed';
import type { DemoState, Ticket } from './types';

const start = Date.parse('2026-10-08T10:00:00+05:00');
const minute = 60_000;
const fresh = () => { const state = createSeed(start); state.tickets = []; state.operations = []; state.notifications = []; return state; };
const create = (state: DemoState, at = start, productIds = ['526005'], kind: Ticket['kind'] = 'description') => applyAction(state, { type: 'create_ticket', kind, productIds, source: 'Источник', description: 'Заполнить описание' }, at, 'manager1');
const claim = (state: DemoState, at = start, promisedDueAt?: number) => {
  const id = state.tickets[0].id;
  const acknowledged = applyAction(state, { type: 'ack_ticket', ticketId: id }, at, 'specialist1');
  return applyAction(acknowledged, { type: 'claim_ticket', ticketId: id, promisedDueAt }, at, 'specialist1');
};

describe('Рабочий календарь +05', () => {
  it('выходные, ночь и заданные праздники не расходуют SLA', () => {
    const settings = fresh().settings;
    const friday = Date.parse('2026-10-09T17:59:00+05:00');
    const monday = Date.parse('2026-10-12T09:01:00+05:00');
    expect(workingMinutes(friday, monday, settings)).toBe(2);
    expect(addWorkingMinutes(friday, 2, settings)).toBe(monday);
    settings.holidays = ['2026-10-12'];
    expect(addWorkingMinutes(friday, 2, settings)).toBe(Date.parse('2026-10-13T09:01:00+05:00'));
    expect(workingMinutes(Date.parse('2026-10-10T12:00:00+05:00'), Date.parse('2026-10-12T09:00:00+05:00'), settings)).toBe(0);
  });
});

describe('Очередь, подтверждение и SLA', () => {
  it('уведомляет обоих специалистов; подтверждение не назначает исполнителя и не останавливает 2 минуты', () => {
    let state = create(fresh());
    const id = state.tickets[0].id;
    expect(state.notifications.filter(n => n.requiresAck).map(n => n.recipientId).sort()).toEqual(['specialist1', 'specialist2']);
    state = applyAction(state, { type: 'ack_ticket', ticketId: id }, start + minute, 'specialist1');
    expect(state.tickets[0].assigneeId).toBeUndefined();
    state = applyAction(state, { type: 'tick' }, start + 3 * minute, 'manager1');
    expect(state.slaPenalties).toHaveLength(1);
    expect(state.slaPenalties[0].target).toBe('team');
    expect(state.slaPenalties[0].penaltyPP).toBe(1);
    expect(getTicketSla(state.tickets[0], state, start + 3 * minute).responseMinutes).toBe(3);
  });
  it('требует подтверждение и не допускает двойное взятие', () => {
    let state = create(fresh()); const id = state.tickets[0].id;
    expect(() => applyAction(state, { type: 'claim_ticket', ticketId: id }, start, 'specialist1')).toThrow('подтвердите');
    state = claim(state);
    expect(() => applyAction(state, { type: 'claim_ticket', ticketId: id }, start, 'specialist2')).toThrow('уже взят');
  });
  it('2 минуты на взятие и 10 на выполнение включительно; бонус начисляется один раз', () => {
    let state = claim(create(fresh()), start + 2 * minute);
    const id = state.tickets[0].id;
    state = applyAction(state, { type: 'complete_ticket', ticketId: id }, start + 12 * minute, 'specialist1');
    expect(state.operations).toHaveLength(1);
    expect(state.operations[0].totalWU).toBe(1.5);
    expect(state.slaPenalties).toHaveLength(0);
    state = applyAction(state, { type: 'complete_ticket', ticketId: id }, start + 13 * minute, 'specialist1');
    expect(state.operations).toHaveLength(1);
  });
  it('не складывает командное и личное нарушение одного запроса', () => {
    let state = claim(create(fresh()), start + 3 * minute);
    const id = state.tickets[0].id;
    state = applyAction(state, { type: 'complete_ticket', ticketId: id }, start + 14 * minute, 'specialist1');
    expect(state.tickets[0].responseBreached).toBe(true);
    expect(state.tickets[0].executionBreached).toBe(true);
    expect(state.slaPenalties).toHaveLength(1);
    expect(state.slaPenalties[0].target).toBe('team');
    expect(state.operations[0].multiplier).toBe(1);
  });
  it('предупреждает на 5-й минуте, штрафует после 10-й личного исполнителя', () => {
    let state = claim(create(fresh()));
    expect(getTicketSla(state.tickets[0], state, start + 5 * minute).warning).toBe(true);
    state = applyAction(state, { type: 'tick' }, start + 11 * minute, 'manager1');
    expect(state.slaPenalties[0].employeeId).toBe('specialist1');
    expect(getAnalytics(state).employees.find(e => e.actorId === 'specialist1')!.slaPP).toBe(1);
  });
});

describe('Срок списка, переносы и ожидание менеджера', () => {
  it('у списка только общий срок, без 5/10-минутного SLA отдельных карточек', () => {
    let state = create(fresh(), start, ['526005', '526006']);
    expect(() => claim(state, start)).toThrow('общий срок');
    state = claim(state, start, start + 60 * minute);
    state = applyAction(state, { type: 'tick' }, start + 20 * minute, 'manager1');
    expect(state.slaPenalties).toHaveLength(0);
    expect(getTicketSla(state.tickets[0], state, start + 20 * minute).warning).toBe(false);
    expect(getTicketSla(state.tickets[0], state, start + 20 * minute).executionRemaining).toBe(40);
  });
  it('заранее сообщённая задержка снимает только штраф выполнения, но не даёт бонус по новому сроку', () => {
    let state = claim(create(fresh(), start, ['526005', '526006']), start, start + 60 * minute);
    const id = state.tickets[0].id;
    state = applyAction(state, { type: 'report_delay', ticketId: id, reason: 'Большой объём', newDueAt: start + 180 * minute }, start + 30 * minute, 'specialist1');
    expect(state.tickets[0].originalDueAt).toBe(start + 60 * minute);
    expect(state.tickets[0].dueAt).toBe(start + 180 * minute);
    expect(state.notifications.some(n => n.recipientId === 'manager1' && n.title === 'Изменён плановый срок')).toBe(true);
    for (const productId of ['526005', '526006']) state = applyAction(state, { type: 'complete_item', ticketId: id, productId }, start + 90 * minute, 'specialist1');
    state = applyAction(state, { type: 'complete_ticket', ticketId: id }, start + 90 * minute, 'specialist1');
    expect(state.slaPenalties).toHaveLength(0);
    expect(state.operations[0].multiplier).toBe(1);
    expect(state.tickets[0].executionBreached).toBe(true);
  });
  it('позднее уведомление не снимает уже возникший штраф', () => {
    let state = claim(create(fresh())); const id = state.tickets[0].id;
    state = applyAction(state, { type: 'report_delay', ticketId: id, reason: 'Позднее сообщение', newDueAt: start + 90 * minute }, start + 11 * minute, 'specialist1');
    expect(state.tickets[0].delay?.eligible).toBe(false);
    expect(state.slaPenalties).toHaveLength(1);
  });
  it('передаёт ответственность менеджеру, ставит выполнение на паузу и возвращает тот же ID в свободную очередь', () => {
    let state = claim(create(fresh())); const id = state.tickets[0].id;
    state = applyAction(state, { type: 'return_manager', ticketId: id, reason: 'Нет данных', question: 'Пришлите источник', newDueAt: start + 90 * minute }, start + 3 * minute, 'specialist1');
    expect(state.tickets[0].assigneeId).toBe('manager1');
    expect(getTicketSla(state.tickets[0], state, start + 60 * minute).executionMinutes).toBe(3);
    state = applyAction(state, { type: 'manager_reply', ticketId: id, reply: 'Источник добавлен' }, start + 60 * minute, 'manager1');
    expect(state.tickets[0].id).toBe(id);
    expect(state.tickets[0].status).toBe('queued');
    expect(state.tickets[0].assigneeId).toBeUndefined();
    expect(state.tickets[0].acknowledgedBy).toEqual([]);
    expect(getTicketSla(state.tickets[0], state, start + 60 * minute).executionRemaining).toBe(7);
    expect(state.notifications.filter(n => n.requiresAck)).toHaveLength(2);
  });
});

describe('Живой приоритет и единый учёт WU', () => {
  it('начальный список наследует самый высокий приоритет входящих товаров', () => {
    const state = createSeed(start);
    expect(state.tickets.find(t => t.id === 'CT-1046')!.priority).toBe('Critical');
  });
  it('приоритет руководителя обновляет открытый тикет; история начислений не пересчитывается', () => {
    let state = claim(create(fresh(), start, ['526005'], 'publish')); const id = state.tickets[0].id;
    state = applyAction(state, { type: 'set_priority', productIds: ['526005'], priority: 'Critical', reason: 'Срочная продажа' }, start + minute, 'lead1');
    expect(state.tickets[0].priority).toBe('Critical');
    expect(getTicketBaseWU(state.tickets[0], state)).toBe(6);
    state = applyAction(state, { type: 'complete_ticket', ticketId: id }, start + 2 * minute, 'specialist1');
    expect(state.operations[0].totalWU).toBe(9);
    state = applyAction(state, { type: 'set_weight', productId: '526005', weight: 20, reason: 'Исключение для новой работы' }, start + 3 * minute, 'lead1');
    expect(getProductBaseWU(state.products[0], state.settings)).toBe(20);
    expect(state.operations[0].totalWU).toBe(9);
    expect(state.tickets[0].priority).toBe('Critical');
  });
  it('не позволяет одновременно начислить плановую карточку и запрос', () => {
    const state = claim(create(fresh()));
    expect(() => applyAction(state, { type: 'edit_product', productId: '526005', changes: { description: 'Другое описание' }, countPlan: true }, start, 'specialist1')).toThrow('один раз');
  });
  it('не начисляет второй результат после возврата завершённого запроса', () => {
    let state = claim(create(fresh())); const id = state.tickets[0].id;
    state = applyAction(state, { type: 'complete_ticket', ticketId: id }, start + minute, 'specialist1');
    state = applyAction(state, { type: 'reopen_ticket', ticketId: id, reason: 'Ещё один вопрос' }, start + 2 * minute, 'manager1');
    state = claim(state, start + 2 * minute);
    state = applyAction(state, { type: 'complete_ticket', ticketId: id }, start + 3 * minute, 'specialist1');
    expect(state.operations).toHaveLength(1);
    expect(state.operations[0].totalWU).toBe(1.5);
  });
  it('время между завершением и возвратом менеджера не расходует бюджет доработки', () => {
    let state = claim(create(fresh())); const id = state.tickets[0].id;
    state = applyAction(state, { type: 'complete_ticket', ticketId: id }, start + minute, 'specialist1');
    state = applyAction(state, { type: 'reopen_ticket', ticketId: id, reason: 'Уточнить после проверки' }, start + 120 * minute, 'manager1');
    expect(getTicketSla(state.tickets[0], state, start + 120 * minute).executionRemaining).toBe(9);
    state = claim(state, start + 120 * minute);
    expect(state.slaPenalties).toHaveLength(0);
  });
  it('новый товар получает настроенный приоритет до публикации, создаётся и связывается с запросом', () => {
    let state = fresh(); state.settings.newProductPriority = 'High';
    state = applyAction(state, { type: 'create_ticket', kind: 'publish', productIds: [], source: 'https://example.com', description: 'Новый товар', newProduct: { partNumber: 'NEW-221', source: 'https://example.com' } }, start, 'manager1');
    state = claim(state); const id = state.tickets[0].id;
    expect(() => applyAction(state, { type: 'complete_ticket', ticketId: id }, start, 'specialist1')).toThrow('Создайте');
    state = applyAction(state, { type: 'create_product', name: 'Новый картридж', partNumber: 'NEW-221', description: 'Заполненное описание', source: 'Официальный источник', complexity: 'medium', ticketId: id }, start + minute, 'specialist1');
    const productId = state.tickets[0].productIds[0];
    expect(state.products.find(p => p.id === productId)!.priority).toBe('High');
    expect(() => applyAction(state, { type: 'complete_ticket', ticketId: id }, start + minute, 'specialist1')).toThrow('опубликуйте');
    state = applyAction(state, { type: 'edit_product', productId, changes: { published: true } }, start + 2 * minute, 'specialist1');
    state = applyAction(state, { type: 'complete_ticket', ticketId: id }, start + 3 * minute, 'specialist1');
    expect(state.operations[0].totalWU).toBe(4.5);
  });
  it('кнопка создания и публикации плановой карточки публикует её и начисляет одну операцию', () => {
    let state = fresh();
    state = applyAction(state, { type: 'create_product', name: 'Плановый картридж', partNumber: 'PLAN-221', description: 'Готовое описание', source: 'Дистрибьютор C', complexity: 'medium', publishNow: true, countPlan: true }, start, 'specialist1');
    expect(state.products[0].published).toBe(true);
    expect(state.operations).toHaveLength(1);
    expect(state.operations[0].source).toBe('plan');
    expect(state.operations[0].totalWU).toBe(2);
    expect(() => applyAction(fresh(), { type: 'create_product', name: 'Неполный товар', partNumber: 'PLAN-222', description: '', source: 'Источник', complexity: 'easy', publishNow: true, countPlan: true }, start, 'specialist1')).toThrow('Описание');
    expect(() => applyAction(state, { type: 'edit_product', productId: state.products[0].id, changes: { description: state.products[0].description }, countPlan: true }, start, 'specialist1')).toThrow('Измените контент');
  });
  it('разъединение связывает две карточки и начисляет один вес типа запроса', () => {
    let state = claim(create(fresh(), start, ['526005'], 'split')); const id = state.tickets[0].id;
    expect(() => applyAction(state, { type: 'complete_ticket', ticketId: id }, start, 'specialist1')).toThrow('связанную новую карточку');
    state = applyAction(state, { type: 'create_product', name: 'Новая карточка другого дистрибьютора', partNumber: 'SPLIT-221', description: 'Самостоятельная карточка', source: 'Дистрибьютор C', complexity: 'easy', ticketId: id, publishNow: true }, start + minute, 'specialist1');
    const childId = state.products[0].id;
    expect(state.products[0].splitFromId).toBe('526005');
    expect(state.products.find(p => p.id === '526005')!.splitChildIds).toEqual([childId]);
    expect(state.tickets[0].batch).toBe(false);
    expect(state.tickets[0].productIds).toEqual(['526005', childId]);
    expect(getTicketBaseWU(state.tickets[0], state)).toBe(2);
    state = applyAction(state, { type: 'edit_product', productId: '526005', changes: { supplier: '' } }, start + 2 * minute, 'specialist1');
    state = applyAction(state, { type: 'complete_ticket', ticketId: id }, start + 3 * minute, 'specialist1');
    expect(state.operations).toHaveLength(1);
    expect(state.operations[0].totalWU).toBe(3);
    expect(state.operations[0].productIds).toHaveLength(2);
  });
  it('удаление дистрибьютора выполняется только после реального удаления из карточки', () => {
    let state = claim(create(fresh(), start, ['526005'], 'remove-distributor')); const id = state.tickets[0].id;
    expect(() => applyAction(state, { type: 'complete_ticket', ticketId: id }, start, 'specialist1')).toThrow('удалите дистрибьютора');
    state = applyAction(state, { type: 'edit_product', productId: '526005', changes: { supplier: '' } }, start + minute, 'specialist1');
    state = applyAction(state, { type: 'complete_ticket', ticketId: id }, start + 2 * minute, 'specialist1');
    expect(state.operations[0].totalWU).toBe(0.75);
    expect(state.products.find(p => p.id === '526005')!.supplier).toBe('');
  });
  it('создание опубликованной карточки внутри запроса не добавляет отдельную плановую операцию', () => {
    let state = fresh();
    state = applyAction(state, { type: 'create_ticket', kind: 'publish', productIds: [], source: 'Источник', description: 'Новый товар', newProduct: { partNumber: 'REQUEST-221', source: 'Источник' } }, start, 'manager1');
    state = claim(state); const id = state.tickets[0].id;
    state = applyAction(state, { type: 'create_product', name: 'Товар по запросу', partNumber: 'REQUEST-221', description: 'Готовое описание', source: 'Источник', complexity: 'easy', ticketId: id, publishNow: true, countPlan: true }, start + minute, 'specialist1');
    expect(state.operations).toHaveLength(0);
    state = applyAction(state, { type: 'complete_ticket', ticketId: id }, start + 2 * minute, 'specialist1');
    expect(state.operations).toHaveLength(1);
    expect(state.operations[0].source).toBe('request');
  });
});

describe('Качество, роли и формула исходного KPI', () => {
  it('ошибка немедленно штрафует последнего автора контента, повторная отметка версии не дублирует штраф; оспаривание не отменяет до решения', () => {
    let state = fresh();
    const original = getAnalytics(state).employees.find(e => e.actorId === 'specialist2')!.qualityPP;
    state = applyAction(state, { type: 'mark_error', productId: '526005', reason: 'Ошибка в совместимости' }, start, 'manager1');
    expect(getAnalytics(state).employees.find(e => e.actorId === 'specialist2')!.qualityPP - original).toBe(3);
    state = applyAction(state, { type: 'mark_error', productId: '526005', reason: 'Та же ошибка' }, start + minute, 'manager1');
    expect(state.issues).toHaveLength(1);
    const issueId = state.issues[0].id;
    state = applyAction(state, { type: 'appeal_error', issueId, reason: 'Источник подтверждает данные' }, start + minute, 'specialist2');
    expect(getAnalytics(state).qualityPP).toBe(3);
    state = applyAction(state, { type: 'resolve_error', issueId, cancel: true, reason: 'Оспаривание принято' }, start + 2 * minute, 'lead1');
    expect(getAnalytics(state).qualityPP).toBe(0);
  });
  it('ограничивает A, но сохраняет B сверх потолка; критическая ошибка включает gate', () => {
    const state = fresh();
    state.operations = [
      { id: 'a', authorId: 'specialist1', productIds: ['526005'], at: start, baseWU: 400, multiplier: 1, totalWU: 400, source: 'plan', ruleSnapshot: 'fixture' },
      { id: 'b', authorId: 'specialist1', productIds: ['526005'], at: start, baseWU: 60, multiplier: 1, totalWU: 60, source: 'request', ruleSnapshot: 'fixture' },
    ];
    expect(getAnalytics(state).employees[0].kpi).toBe(160);
    state.issues = [{ id: 'e', productId: '526005', authorId: 'specialist1', reporterId: 'manager1', at: start, version: 1, reason: 'fixture', penaltyPP: 3, critical: true, status: 'active' }];
    expect(getAnalytics(state).employees[0].kpi).toBe(99);
  });
  it('проверяет роль на каждом действии и валидирует настройки', () => {
    const state = fresh();
    expect(() => create(state)).not.toThrow();
    expect(() => applyAction(state, { type: 'create_ticket', kind: 'description', productIds: ['526005'], source: '', description: 'Запрос' }, start, 'specialist1')).toThrow('роли');
    expect(() => applyAction(state, { type: 'set_priority', productIds: ['526005'], priority: 'High', reason: 'Причина' }, start, 'manager1')).toThrow('роли');
    expect(() => applyAction(state, { type: 'save_settings', settings: { ...state.settings, warningMinutes: 20 } }, start, 'lead1')).toThrow('раньше');
    expect(state.revision).toBe(1);
  });
});
