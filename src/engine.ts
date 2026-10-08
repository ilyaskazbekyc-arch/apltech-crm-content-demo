import type { Action, Actor, Analytics, DemoState, Notification, Operation, Product, Settings, Ticket } from './types';
import { ACTORS } from './seed';

const MINUTE = 60_000;
const DAY = 86_400_000;
const OFFSET = 5 * 60 * MINUTE;
const round = (n: number) => Math.round(n * 100) / 100;
const localDay = (at: number) => Math.floor((at + OFFSET) / DAY) * DAY - OFFSET;
const dateKey = (at: number) => new Date(at + OFFSET).toISOString().slice(0, 10);
const isWorkingDay = (at: number, settings: Settings) => {
  const day = new Date(at + OFFSET).getUTCDay();
  return day !== 0 && day !== 6 && !settings.holidays.includes(dateKey(at));
};

/** Minutes in the team's fixed +05:00 Mon–Fri 09:00–18:00 calendar. */
export function workingMinutes(from: number, to: number, settings: Settings): number {
  if (to <= from) return 0;
  let result = 0;
  for (let day = localDay(from); day <= localDay(to); day += DAY) {
    if (isWorkingDay(day, settings)) {
      result += Math.max(0, Math.min(to, day + 18 * 60 * MINUTE) - Math.max(from, day + 9 * 60 * MINUTE)) / MINUTE;
    }
  }
  return result;
}

export function addWorkingMinutes(at: number, minutes: number, settings: Settings): number {
  let day = localDay(at);
  let remaining = minutes;
  for (let i = 0; i < 3660; i++, day += DAY) {
    if (!isWorkingDay(day, settings)) continue;
    const start = Math.max(at, day + 9 * 60 * MINUTE);
    const end = day + 18 * 60 * MINUTE;
    if (start > end) continue;
    const available = (end - start) / MINUTE;
    if (remaining <= available) return start + remaining * MINUTE;
    remaining -= available;
  }
  throw new Error('Срок слишком далеко от текущей даты.');
}

function pausedMinutes(ticket: Ticket, until: number, settings: Settings) {
  return ticket.pauses.reduce((sum, pause) => sum + workingMinutes(pause.start, Math.min(pause.end ?? until, until), settings), 0);
}

export function getProductBaseWU(product: Product, settings: Settings): number {
  return round(product.weightOverride ?? settings.complexityRates[product.complexity] * settings.priorityRates[product.priority]);
}

export function getTicketBaseWU(ticket: Ticket, state: DemoState): number {
  const products = ticket.productIds.map(id => state.products.find(p => p.id === id)).filter((p): p is Product => !!p);
  if (ticket.kind === 'publish') return round(products.reduce((sum, p) => sum + getProductBaseWU(p, state.settings), 0));
  if (ticket.kind === 'split') return round(state.settings.requestWeights.split);
  return round(state.settings.requestWeights[ticket.kind] * Math.max(1, ticket.productIds.length));
}

export function getTicketSla(ticket: Ticket, state: DemoState, now: number) {
  const stoppedAt = ticket.completedAt ?? now;
  const responseEnd = ticket.claimedAt ?? stoppedAt;
  const responseMinutes = workingMinutes(ticket.claimCycleStartedAt, responseEnd, state.settings);
  const paused = ticket.status === 'waiting_manager';
  const executionMinutes = ticket.firstClaimedAt === undefined ? 0 : Math.max(0,
    workingMinutes(ticket.firstClaimedAt, stoppedAt, state.settings) - pausedMinutes(ticket, stoppedAt, state.settings));
  const budget = ticket.batch
    ? ticket.originalDueAt !== undefined && ticket.firstClaimedAt !== undefined ? workingMinutes(ticket.firstClaimedAt, ticket.originalDueAt, state.settings) : 0
    : state.settings.executionMinutes;
  const executionRemaining = ticket.firstClaimedAt === undefined && ticket.batch ? 0 : budget - executionMinutes;
  return {
    responseMinutes: round(responseMinutes), executionMinutes: round(executionMinutes),
    responseRemaining: round(state.settings.responseMinutes - responseMinutes), executionRemaining: round(executionRemaining),
    warning: !ticket.batch && ticket.firstClaimedAt !== undefined && executionMinutes >= state.settings.warningMinutes && ticket.status !== 'completed',
    late: ticket.responseBreached || ticket.executionBreached || responseMinutes > state.settings.responseMinutes || (ticket.firstClaimedAt !== undefined && executionRemaining < 0), paused,
  };
}

export function formatDate(at: number): string {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Almaty', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(at);
}
export function formatDuration(minutes: number): string {
  const secs = Math.round(Math.abs(minutes) * 60);
  return `${minutes < 0 ? '−' : ''}${Math.floor(secs / 60).toString().padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`;
}

function requireRole(actor: Actor, roles: Actor['role'][]) {
  if (!roles.includes(actor.role)) throw new Error('Это действие недоступно для вашей роли.');
}
function required(text: string, label: string) {
  if (!text.trim()) throw new Error(`Заполните поле «${label}».`);
}
function history(state: DemoState, ticket: Ticket, now: number, actorId: string, text: string) {
  ticket.history.push({ id: `history-${ticket.id}-${state.revision}-${ticket.history.length}`, at: now, actorId, text });
}
function notify(state: DemoState, recipientId: string, now: number, title: string, message: string, ticketId?: string, requiresAck = false) {
  const notification: Notification = { id: `notification-${state.revision}-${state.notifications.length}-${now}`, recipientId, at: now, title, message, ticketId, read: false, requiresAck };
  state.notifications.unshift(notification);
}
function notifyQueue(state: DemoState, ticket: Ticket, now: number) {
  for (const actor of ACTORS.filter(a => a.role === 'specialist')) notify(state, actor.id, now, 'Новый запрос Content AplTech', `${ticket.id}: ${ticket.description}. Приоритет ${ticket.priority}. Подтвердите получение и возьмите запрос в работу.`, ticket.id, true);
}
function addPenalty(state: DemoState, ticket: Ticket, at: number, cause: 'response' | 'execution') {
  if (state.slaPenalties.some(p => p.ticketId === ticket.id)) return;
  state.slaPenalties.push({ ticketId: ticket.id, at, target: cause === 'response' ? 'team' : 'employee', employeeId: cause === 'execution' ? ticket.assigneeId : undefined, cause, penaltyPP: state.settings.slaPenaltyPP });
}
function checkSla(state: DemoState, now: number) {
  for (const ticket of state.tickets) {
    if (ticket.status === 'completed') continue;
    const sla = getTicketSla(ticket, state, now);
    if (ticket.status === 'queued' && sla.responseMinutes > state.settings.responseMinutes && !ticket.responseBreached) {
      ticket.responseBreached = true;
      addPenalty(state, ticket, addWorkingMinutes(ticket.claimCycleStartedAt, state.settings.responseMinutes, state.settings), 'response');
      notify(state, 'lead1', now, 'Нарушен командный SLA', `${ticket.id}: никто не взял запрос за ${state.settings.responseMinutes} минуты.`, ticket.id);
    }
    if (ticket.status === 'in_progress' && sla.executionRemaining < 0 && !ticket.executionBreached) {
      ticket.executionBreached = true;
      if (!ticket.delay?.eligible) addPenalty(state, ticket, now, 'execution');
      notify(state, ticket.createdBy, now, 'Срок запроса истёк', `${ticket.id}: срок выполнения истёк${ticket.delay?.eligible ? '; задержка сообщена заранее, штраф за выполнение снят' : ''}.`, ticket.id);
    }
  }
}
function validateDue(at: number, now: number) {
  if (!Number.isFinite(at) || at <= now) throw new Error('Новый срок должен быть позже текущего времени.');
}
function mandatoryProduct(product: Product, kind: Ticket['kind'], allowEmptySupplier = false) {
  const supplierRequired = kind !== 'remove-distributor' && !allowEmptySupplier;
  if (!product.name.trim() || !product.partNumber.trim() || !product.description.trim() || !product.image.trim() || (supplierRequired && !product.supplier.trim())) {
    throw new Error(`Карточка ${product.partNumber || product.id}: заполните название, партномер, описание, изображение и источник / поставщика.`);
  }
  if ((kind === 'publish' || (kind === 'split' && product.splitFromId)) && !product.published) throw new Error(`Сначала опубликуйте карточку ${product.partNumber}.`);
}
function validateSettings(settings: Settings) {
  const positives = [settings.responseMinutes, settings.warningMinutes, settings.executionMinutes, settings.targetWU, settings.workedDays, ...Object.values(settings.priorityRates), ...Object.values(settings.complexityRates), ...Object.values(settings.requestWeights)];
  if (positives.some(v => !Number.isFinite(v) || v <= 0)) throw new Error('SLA, нормы и веса должны быть больше нуля.');
  if (settings.warningMinutes >= settings.executionMinutes) throw new Error('Предупреждение должно наступать раньше нарушения SLA.');
  if (settings.slaBonus < 1 || !Number.isFinite(settings.slaBonus)) throw new Error('Множитель SLA должен быть не меньше 1.');
  if ([settings.slaPenaltyPP, settings.qualityPenaltyPP, settings.productivityCap, settings.criticalGate].some(v => !Number.isFinite(v) || v < 0)) throw new Error('Штрафы и ограничения KPI должны быть неотрицательными.');
  if (settings.criticalGate > settings.productivityCap) throw new Error('Ограничение при критической ошибке не должно превышать потолок блока A.');
  if (settings.holidays.some(v => !/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)))) throw new Error('Укажите праздники в формате ГГГГ-ММ-ДД.');
  if (!['Critical', 'High', 'Normal', 'Low'].includes(settings.newProductPriority)) throw new Error('Выберите исходный приоритет нового товара.');
}

export function applyAction(original: DemoState, action: Action, now: number, actorId: string): DemoState {
  const actor = ACTORS.find(a => a.id === actorId);
  if (!actor) throw new Error('Неизвестный пользователь.');
  if (action.type === 'create_error_ticket') {
    requireRole(actor, ['manager']);
    required(action.reason, 'Описание ошибки');
    required(action.source, 'Источник');
    const product = original.products.find(p => p.id === action.productId);
    if (!product) throw new Error('Карточка товара не найдена.');
    const existing = original.issues.find(i => i.productId === product.id && i.version === product.version);
    if (existing?.status === 'cancelled') throw new Error('Ошибка этой версии уже отменена. Проверьте актуальную версию карточки.');
    if (existing?.ticketId && original.tickets.some(t => t.id === existing.ticketId)) return original;
    const queued = applyAction(original, { type: 'create_ticket', kind: 'description', productIds: [product.id], source: action.source, description: action.reason }, now, actorId);
    const ticketId = queued.tickets[0].id;
    const confirmed = applyAction(queued, { type: 'mark_error', productId: product.id, ticketId, reason: action.reason, critical: action.critical }, now, actorId);
    const issue = confirmed.issues.find(i => i.productId === product.id && i.version === product.version)!;
    const ticket = confirmed.tickets.find(t => t.id === ticketId)!;
    issue.ticketId = ticketId;
    ticket.qualityIssueId = issue.id;
    history(confirmed, ticket, now, actorId, `Менеджер подтвердил ошибку ${issue.id}: версия v${issue.version}, автор ${ACTORS.find(a => a.id === issue.authorId)?.name}. Штраф качества ${issue.penaltyPP} п.п. применён сразу; исправление направлено в Content AplTech.`);
    return confirmed;
  }
  const state: DemoState = structuredClone(original);
  state.revision++;
  checkSla(state, now);
  const getTicket = (id: string) => {
    const ticket = state.tickets.find(t => t.id === id);
    if (!ticket) throw new Error('Запрос не найден.');
    return ticket;
  };
  const getProduct = (id: string) => {
    const product = state.products.find(p => p.id === id);
    if (!product) throw new Error('Карточка товара не найдена.');
    return product;
  };
  const assigned = (ticket: Ticket) => {
    requireRole(actor, ['specialist']);
    if (ticket.assigneeId !== actor.id || ticket.status !== 'in_progress') throw new Error('Сначала возьмите этот запрос в работу.');
  };
  switch (action.type) {
    case 'tick': break;
    case 'create_ticket': {
      requireRole(actor, ['manager']);
      required(action.description, 'Описание запроса');
      const ids = [...new Set(action.productIds)];
      if (!ids.length && !action.newProduct) throw new Error('Выберите товар или укажите партномер нового товара.');
      if (ids.length && action.newProduct) throw new Error('Запрос нового товара не должен содержать существующие карточки.');
      if (action.kind === 'split' && ids.length !== 1) throw new Error('Для разъединения выберите одну исходную карточку.');
      if (action.newProduct) {
        if (action.kind !== 'publish') throw new Error('Для нового товара выберите запрос на публикацию.');
        required(action.newProduct.partNumber, 'Партномер'); required(action.newProduct.source, 'Источник');
      }
      const products = ids.map(getProduct);
      const order = ['Critical', 'High', 'Normal', 'Low'];
      const priority = products.length ? [...products].sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority))[0].priority : state.settings.newProductPriority;
      let next = 1049;
      while (state.tickets.some(t => t.id === `CT-${next}`)) next++;
      const ticket: Ticket = { id: `CT-${next}`, kind: action.kind, productIds: ids, newProduct: action.newProduct, priority, source: action.source.trim(), description: action.description.trim(), createdAt: now, createdBy: actorId, status: 'queued', acknowledgedBy: [], claimCycleStartedAt: now, responseBreached: false, executionBreached: false, pauses: [], batch: ids.length > 1, items: ids.map(productId => ({ productId })), history: [] };
      history(state, ticket, now, actorId, `Запрос создан. Направлен всей команде Content AplTech. Приоритет ${priority} наследуется от товара.`);
      state.tickets.unshift(ticket); notifyQueue(state, ticket, now); break;
    }
    case 'ack_ticket': {
      requireRole(actor, ['specialist']);
      const ticket = getTicket(action.ticketId);
      if (ticket.status !== 'queued') throw new Error('Запрос уже распределён.');
      if (!ticket.acknowledgedBy.includes(actorId)) {
        ticket.acknowledgedBy.push(actorId);
        history(state, ticket, now, actorId, 'Получение подтверждено. SLA взятия продолжает отсчёт.');
      }
      state.notifications.filter(n => n.recipientId === actorId && n.ticketId === ticket.id && n.requiresAck).forEach(n => { n.read = true; n.requiresAck = false; });
      break;
    }
    case 'claim_ticket': {
      requireRole(actor, ['specialist']);
      const ticket = getTicket(action.ticketId);
      if (ticket.status !== 'queued' || ticket.assigneeId) throw new Error('Запрос уже взят другим исполнителем.');
      if (!ticket.acknowledgedBy.includes(actorId)) throw new Error('Сначала подтвердите получение уведомления.');
      if (ticket.batch) {
        if (action.promisedDueAt === undefined) throw new Error('Для списка укажите общий срок выполнения.');
        validateDue(action.promisedDueAt, now);
      }
      ticket.status = 'in_progress'; ticket.assigneeId = actorId; ticket.claimedAt = now;
      if (ticket.firstClaimedAt === undefined) {
        ticket.firstClaimedAt = now;
        ticket.originalDueAt = ticket.batch ? action.promisedDueAt : addWorkingMinutes(now, state.settings.executionMinutes, state.settings);
        ticket.dueAt = ticket.originalDueAt;
      } else if (ticket.batch && action.promisedDueAt !== undefined) ticket.dueAt = action.promisedDueAt;
      history(state, ticket, now, actorId, `Взят в работу. ${ticket.batch ? `Общий срок ${formatDate(ticket.dueAt!)}. Внутренних таймеров карточек нет.` : `SLA выполнения ${state.settings.executionMinutes} рабочих минут.`}`);
      state.notifications.filter(n => n.ticketId === ticket.id && n.requiresAck).forEach(n => { n.read = true; n.requiresAck = false; });
      notify(state, ticket.createdBy, now, 'Запрос взят в работу', `${ticket.id}: ${actor.name}. Срок ${formatDate(ticket.dueAt!)}.`, ticket.id);
      break;
    }
    case 'complete_item': {
      const ticket = getTicket(action.ticketId); assigned(ticket);
      if (!ticket.batch) throw new Error('У одиночного запроса завершите запрос целиком.');
      const item = ticket.items.find(i => i.productId === action.productId);
      if (!item) throw new Error('Карточка не входит в этот список.');
      mandatoryProduct(getProduct(action.productId), ticket.kind);
      if (!item.completedAt) {
        item.completedAt = now; item.authorId = actorId;
        history(state, ticket, now, actorId, `Карточка ${getProduct(action.productId).partNumber} выполнена. WU начисляется при завершении всего запроса.`);
      }
      break;
    }
    case 'complete_ticket': {
      const ticket = getTicket(action.ticketId);
      requireRole(actor, ['specialist']);
      if (ticket.status === 'completed') break;
      assigned(ticket);
      if (!ticket.productIds.length) throw new Error('Создайте карточку нового товара и свяжите её с запросом.');
      if (ticket.kind === 'split' && ticket.productIds.length !== 2) throw new Error('Создайте связанную новую карточку для разъединения товара.');
      if (ticket.kind === 'remove-distributor' && ticket.productIds.some(id => getProduct(id).supplier.trim())) throw new Error('Сначала удалите дистрибьютора из карточки товара.');
      ticket.productIds.map(getProduct).forEach((p, index) => mandatoryProduct(p, ticket.kind, ticket.kind === 'split' && index === 0));
      if (ticket.batch && ticket.items.some(i => !i.completedAt)) throw new Error('Сначала отметьте все карточки списка выполненными.');
      const sla = getTicketSla(ticket, state, now);
      const multiplier = !ticket.responseBreached && !ticket.executionBreached && sla.executionRemaining >= 0 ? state.settings.slaBonus : 1;
      if (!state.operations.some(o => o.ticketId === ticket.id)) {
        const baseWU = getTicketBaseWU(ticket, state);
        const operation: Operation = { id: `operation-${ticket.id}`, ticketId: ticket.id, productIds: [...ticket.productIds], authorId: actorId, at: now, baseWU, multiplier, totalWU: round(baseWU * multiplier), source: 'request', ruleSnapshot: `Тип ${ticket.kind}; базовый вес ${baseWU} WU; оба SLA ${multiplier > 1 ? 'соблюдены' : 'не соблюдены'}; ×${multiplier}. ${ticket.batch ? 'Первоначальный общий срок, документированные паузы.' : 'Одна карточка, рабочие минуты.'}` };
        state.operations.push(operation);
      }
      ticket.status = 'completed'; ticket.completedAt = now;
      history(state, ticket, now, actorId, `Запрос выполнен. Поля проверены. Итог начислен один раз${multiplier > 1 ? ` с множителем ×${multiplier}` : ''}.`);
      notify(state, ticket.createdBy, now, 'Запрос выполнен', `${ticket.id}: карточки обновлены. При необходимости верните запрос на доработку.`, ticket.id);
      break;
    }
    case 'return_manager': {
      const ticket = getTicket(action.ticketId); assigned(ticket);
      required(action.reason, 'Причина'); required(action.question, 'Вопрос менеджеру'); validateDue(action.newDueAt, now);
      ticket.pauses.push({ start: now, reason: action.reason.trim() });
      ticket.status = 'waiting_manager'; ticket.assigneeId = ticket.createdBy;
      ticket.managerQuestion = action.question.trim(); ticket.managerReply = undefined; ticket.dueAt = action.newDueAt;
      history(state, ticket, now, actorId, `Возвращён менеджеру: ${action.reason}. ${action.question} Новый плановый срок ${formatDate(action.newDueAt)}. SLA выполнения на паузе.`);
      notify(state, ticket.createdBy, now, 'Запрос ожидает вашего ответа', `${ticket.id}: ${action.question}. Причина: ${action.reason}. Новый срок ${formatDate(action.newDueAt)}. Вы назначены ответственным.`, ticket.id);
      break;
    }
    case 'manager_reply': {
      requireRole(actor, ['manager']);
      const ticket = getTicket(action.ticketId);
      if (ticket.status !== 'waiting_manager' || ticket.assigneeId !== actorId) throw new Error('Этот запрос не ожидает вашего ответа.');
      required(action.reply, 'Ответ');
      const pause = ticket.pauses.find(p => p.end === undefined); if (pause) pause.end = now;
      ticket.managerReply = action.reply.trim(); ticket.status = 'queued'; ticket.assigneeId = undefined;
      ticket.claimedAt = undefined; ticket.claimCycleStartedAt = now; ticket.acknowledgedBy = [];
      history(state, ticket, now, actorId, `Ответ менеджера: ${action.reply}. Запрос вернулся в свободную очередь Content AplTech. Новый цикл SLA взятия.`);
      notifyQueue(state, ticket, now); break;
    }
    case 'report_delay': {
      const ticket = getTicket(action.ticketId); assigned(ticket);
      required(action.reason, 'Причина задержки'); validateDue(action.newDueAt, now);
      const sla = getTicketSla(ticket, state, now);
      const eligible = ticket.delay?.eligible || sla.executionRemaining > 0;
      ticket.delay = { at: now, newDueAt: action.newDueAt, reason: action.reason.trim(), eligible: !!eligible };
      ticket.dueAt = action.newDueAt;
      history(state, ticket, now, actorId, `Сообщена задержка: ${action.reason}. Новый срок ${formatDate(action.newDueAt)}. ${eligible ? 'Штраф выполнения не начисляется; бонус проверяется по первоначальному сроку.' : 'Первоначальный SLA уже истёк; штраф сохраняется.'}`);
      notify(state, ticket.createdBy, now, 'Изменён плановый срок', `${ticket.id}: ${action.reason}. Новый срок ${formatDate(action.newDueAt)}. Первоначальный срок сохранён для бонуса.`, ticket.id);
      break;
    }
    case 'reopen_ticket': {
      requireRole(actor, ['manager']);
      const ticket = getTicket(action.ticketId);
      if (ticket.createdBy !== actorId || ticket.status !== 'completed') throw new Error('Вернуть можно свой завершённый запрос.');
      required(action.reason, 'Причина возврата');
      if (ticket.completedAt !== undefined && ticket.completedAt < now) ticket.pauses.push({ start: ticket.completedAt, end: now, reason: 'Запрос был завершён; ожидание проверки менеджером' });
      ticket.status = 'queued'; ticket.assigneeId = undefined; ticket.completedAt = undefined;
      ticket.claimedAt = undefined; ticket.claimCycleStartedAt = now; ticket.acknowledgedBy = [];
      ticket.items.forEach(i => { i.completedAt = undefined; i.authorId = undefined; });
      history(state, ticket, now, actorId, `Возвращён на доработку: ${action.reason}. Повторное завершение не начисляет WU повторно.`);
      notifyQueue(state, ticket, now); break;
    }
    case 'edit_product': {
      requireRole(actor, ['specialist']);
      const product = getProduct(action.productId);
      const changed = Object.entries(action.changes).some(([key, value]) => product[key as keyof Product] !== value);
      if (!changed) {
        if (action.countPlan) throw new Error('Измените контент для завершения плановой работы.');
        break;
      }
      if (action.changes.name !== undefined) required(action.changes.name, 'Название');
      Object.assign(product, action.changes, { lastEditorId: actorId, lastEditedAt: now, version: product.version + 1 });
      const activeRequest = state.tickets.some(t => t.productIds.includes(product.id) && t.status !== 'completed');
      if (action.countPlan && activeRequest) throw new Error('Карточка участвует в запросе: WU начислится за запрос один раз.');
      if (action.countPlan) {
        mandatoryProduct(product, 'description'); const baseWU = getProductBaseWU(product, state.settings);
        state.operations.push({ id: `plan-${product.id}-v${product.version}`, productIds: [product.id], authorId: actorId, at: now, baseWU, multiplier: 1, totalWU: baseWU, source: 'plan', ruleSnapshot: `Плановая работа, версия ${product.version}. Вес ${baseWU} WU; без множителя запроса.` });
      }
      break;
    }
    case 'create_product': {
      requireRole(actor, ['specialist']);
      required(action.name, 'Название'); required(action.partNumber, 'Партномер'); required(action.source, 'Источник');
      if (action.publishNow) required(action.description, 'Описание');
      if (action.countPlan && !action.ticketId && !action.publishNow) throw new Error('Для начисления плановой работы сначала опубликуйте карточку.');
      if (state.products.some(p => p.partNumber.toLowerCase() === action.partNumber.trim().toLowerCase())) throw new Error('Товар с таким партномером уже существует.');
      let id = 526026; while (state.products.some(p => p.id === String(id))) id++;
      const ticket = action.ticketId ? getTicket(action.ticketId) : undefined;
      const splitting = ticket?.kind === 'split';
      if (ticket) {
        assigned(ticket);
        if (splitting ? ticket.productIds.length !== 1 : !ticket.newProduct || ticket.productIds.length) throw new Error('Запрос уже связан с новой карточкой.');
      }
      const parent = splitting ? getProduct(ticket!.productIds[0]) : undefined;
      const product: Product = { id: String(id), name: action.name.trim(), partNumber: action.partNumber.trim(), description: action.description.trim(), supplier: action.source.trim(), image: '/assets/product-photo.jpg', price: 0, stock: 0, priority: ticket?.priority ?? state.settings.newProductPriority, complexity: action.complexity, lastEditorId: actorId, lastEditedAt: now, version: 1, published: !!action.publishNow, ...(parent ? { splitFromId: parent.id } : {}) };
      state.products.unshift(product);
      if (ticket) {
        if (parent) {
          parent.splitChildIds = [...(parent.splitChildIds ?? []), product.id];
          ticket.productIds.push(product.id); ticket.items.push({ productId: product.id });
        } else { ticket.productIds = [product.id]; ticket.items = [{ productId: product.id }]; }
        history(state, ticket, now, actorId, `Создана карточка ${product.id} / ${product.partNumber}. Приоритет ${product.priority}; сложность определена специалистом. Связь с запросом сохранена.`);
      } else if (action.countPlan) {
        mandatoryProduct(product, 'publish');
        const baseWU = getProductBaseWU(product, state.settings);
        state.operations.push({ id: `plan-${product.id}-v1`, productIds: [product.id], authorId: actorId, at: now, baseWU, multiplier: 1, totalWU: baseWU, source: 'plan', ruleSnapshot: `Создание и публикация плановой карточки, версия 1. Вес ${baseWU} WU; без множителя запроса.` });
      }
      break;
    }
    case 'set_priority': {
      requireRole(actor, ['lead']); required(action.reason, 'Причина изменения приоритета');
      const ids = [...new Set(action.productIds)]; if (!ids.length) throw new Error('Выберите карточки.');
      ids.map(getProduct).forEach(p => { p.priority = action.priority; });
      const order = ['Critical', 'High', 'Normal', 'Low'];
      for (const ticket of state.tickets.filter(t => t.status !== 'completed' && t.productIds.some(id => ids.includes(id)))) {
        ticket.priority = [...ticket.productIds.map(getProduct)].sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority))[0].priority;
        history(state, ticket, now, actorId, `Приоритет автоматически обновлён до ${ticket.priority}. ${action.reason}.`);
      }
      break;
    }
    case 'set_weight': {
      requireRole(actor, ['lead']); required(action.reason, 'Причина изменения веса');
      if (action.weight !== undefined && (!Number.isFinite(action.weight) || action.weight <= 0)) throw new Error('Вес должен быть больше нуля.');
      const product = getProduct(action.productId); product.weightOverride = action.weight;
      for (const ticket of state.tickets.filter(t => t.status !== 'completed' && t.productIds.includes(product.id))) history(state, ticket, now, actorId, `Вес карточки: ${action.weight ?? 'по общим правилам'}. ${action.reason}. Завершённые начисления сохранены.`);
      break;
    }
    case 'mark_error': {
      requireRole(actor, ['manager']); required(action.reason, 'Описание ошибки');
      const product = getProduct(action.productId);
      if (action.ticketId && !getTicket(action.ticketId).productIds.includes(product.id)) throw new Error('Карточка не связана с указанным запросом.');
      if (state.issues.some(i => i.productId === product.id && i.version === product.version)) break;
      const issue = { id: `ERR-${String(state.issues.length + 21).padStart(3, '0')}`, productId: product.id, ticketId: action.ticketId, authorId: product.lastEditorId, reporterId: actorId, at: now, version: product.version, reason: action.reason.trim(), penaltyPP: state.settings.qualityPenaltyPP, critical: !!action.critical, status: 'active' as const };
      state.issues.push(issue);
      notify(state, issue.authorId, now, 'Ошибка в карточке — KPI уменьшен', `${product.partNumber}, версия ${product.version}: ${action.reason}. Сразу −${issue.penaltyPP} п.п. Можно оспорить.`, action.ticketId);
      break;
    }
    case 'appeal_error': {
      requireRole(actor, ['specialist']); required(action.reason, 'Причина оспаривания');
      const issue = state.issues.find(i => i.id === action.issueId);
      if (!issue || issue.authorId !== actorId || issue.status === 'cancelled') throw new Error('Оспорить можно только свою действующую ошибку.');
      issue.status = 'appealed'; issue.appeal = action.reason.trim();
      notify(state, 'lead1', now, 'Ошибка оспорена', `${issue.id}: ${action.reason}. Штраф действует до решения.`, issue.ticketId); break;
    }
    case 'resolve_error': {
      requireRole(actor, ['lead']); required(action.reason, 'Решение');
      const issue = state.issues.find(i => i.id === action.issueId); if (!issue) throw new Error('Ошибка не найдена.');
      issue.status = action.cancel ? 'cancelled' : 'active';
      notify(state, issue.authorId, now, action.cancel ? 'Штраф отменён' : 'Ошибка подтверждена', `${issue.id}: ${action.reason}. ${action.cancel ? 'KPI восстановлен.' : 'Штраф сохранён.'}`, issue.ticketId); break;
    }
    case 'save_settings': {
      requireRole(actor, ['lead']); validateSettings(action.settings); state.settings = structuredClone(action.settings); break;
    }
    case 'read_notification': {
      const notification = state.notifications.find(n => n.id === action.notificationId);
      if (!notification || notification.recipientId !== actorId) throw new Error('Уведомление не найдено.');
      if (notification.requiresAck) throw new Error('Подтвердите получение запроса отдельной кнопкой.');
      notification.read = true; break;
    }
  }
  checkSla(state, now);
  return state;
}

export function getAnalytics(state: DemoState): Analytics {
  const specialists = ACTORS.filter(a => a.role === 'specialist');
  const individualPlan = state.settings.targetWU * state.settings.workedDays;
  const activeIssues = state.issues.filter(i => i.status !== 'cancelled');
  const score = (cardWU: number, requestWU: number, plan: number, quality: number, sla: number, critical: boolean) => {
    const result = Math.max(0, Math.min(cardWU / plan * 100, state.settings.productivityCap) + requestWU / plan * 100 - quality - sla);
    return round(critical ? Math.min(result, state.settings.criticalGate) : result);
  };
  const employees = specialists.map(actor => {
    const operations = state.operations.filter(o => o.authorId === actor.id);
    const cardWU = round(operations.filter(o => o.source === 'plan').reduce((s, o) => s + o.totalWU, 0));
    const requestWU = round(operations.filter(o => o.source === 'request').reduce((s, o) => s + o.totalWU, 0));
    const issues = activeIssues.filter(i => i.authorId === actor.id);
    const qualityPP = round(issues.reduce((s, i) => s + i.penaltyPP, 0));
    const slaPP = round(state.slaPenalties.filter(p => p.target === 'employee' && p.employeeId === actor.id).reduce((s, p) => s + p.penaltyPP, 0));
    return { actorId: actor.id, planWU: individualPlan, cardWU, requestWU, qualityPP, slaPP, kpi: score(cardWU, requestWU, individualPlan, qualityPP, slaPP, issues.some(i => i.critical)), completed: operations.reduce((s, o) => s + o.productIds.length, 0) };
  });
  const cardWU = round(employees.reduce((s, e) => s + e.cardWU, 0));
  const requestWU = round(employees.reduce((s, e) => s + e.requestWU, 0));
  const qualityPP = round(activeIssues.reduce((s, i) => s + i.penaltyPP, 0));
  const slaPP = round(state.slaPenalties.reduce((s, p) => s + p.penaltyPP, 0));
  const planWU = individualPlan * specialists.length;
  const responded = state.tickets.filter(t => t.firstClaimedAt !== undefined || t.responseBreached);
  const completed = state.tickets.filter(t => t.status === 'completed');
  return { planWU, cardWU, requestWU, totalWU: round(cardWU + requestWU), qualityPP, slaPP, kpi: score(cardWU, requestWU, planWU, qualityPP, slaPP, activeIssues.some(i => i.critical)), completed: employees.reduce((s, e) => s + e.completed, 0), errors: activeIssues.length, responseOnTime: responded.filter(t => !t.responseBreached).length, responseTotal: responded.length, executionOnTime: completed.filter(t => !t.executionBreached).length, executionTotal: completed.length, employees };
}
