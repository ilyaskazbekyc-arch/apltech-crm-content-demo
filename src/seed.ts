import type { Actor, DemoState, Product, Settings, Ticket } from './types';

export const ACTORS: Actor[] = [
  { id: 'manager1', name: 'Менеджер', role: 'manager' },
  { id: 'specialist1', name: 'Контент-специалист 1', role: 'specialist' },
  { id: 'specialist2', name: 'Контент-специалист 2', role: 'specialist' },
  { id: 'lead1', name: 'Руководитель', role: 'lead' },
];

export const DEFAULT_SETTINGS: Settings = {
  responseMinutes: 3, warningMinutes: 4, executionMinutes: 5, slaBonus: 1.5, slaPenaltyPP: 1,
  qualityPenaltyPP: 3, targetWU: 150, workedDays: 1, productivityCap: 120, criticalGate: 99,
  newProductPriority: 'Normal', priorityRates: { Critical: 2, High: 1.5, Normal: 1, Low: 0.75 },
  complexityRates: { easy: 1, medium: 2, complex: 3 },
  requestWeights: { image: 0.5, description: 1, 'remove-distributor': 0.5, split: 2, publish: 1, merge: 1 }, holidays: [],
};

export function createSeed(now: number): DemoState {
  const numbers = ['221', '131', '251', '631', '232', '231', '241', '211', '151', '161', '261', '621', '611', '651', '661', '741', '751', '761', '791', '851'];
  const colours = ['чёрный / белый', 'чёрный / прозрачный', 'чёрный / белый', 'чёрный / жёлтый', 'красный / белый', 'чёрный / белый', 'чёрный / белый', 'чёрный / белый', 'чёрный / прозрачный', 'чёрный / прозрачный', 'чёрный / белый', 'чёрный / жёлтый', 'чёрный / жёлтый', 'чёрный / жёлтый', 'чёрный / жёлтый', 'чёрный / зелёный', 'чёрный / зелёный', 'чёрный / зелёный', 'чёрный / зелёный', 'чёрный / золотой'];
  const widths = [9, 12, 24, 12, 12, 12, 18, 6, 24, 36, 36, 9, 6, 24, 36, 18, 24, 36, 12, 24];
  const products: Product[] = numbers.map((number, i) => ({
    id: String(526005 + i), name: `Картридж ленточный RL-BR-TZ${number}, ${widths[i]} мм × 8 м, ${colours[i]}`,
    partNumber: `RL-BR-TZ${number}`, description: `Совместимая ламинированная лента для принтеров Brother P-touch. Ширина ${widths[i]} мм, длина 8 м. Цвет: ${colours[i]}. Используется для маркировки оборудования, проводов и офисных материалов.`,
    image: '/assets/product-photo.jpg', price: 1200 + i * 170, supplier: i % 2 ? 'Дистрибьютор B' : 'Дистрибьютор A', stock: 3 + i * 2,
    priority: i < 2 ? 'High' : i === 4 ? 'Critical' : i > 16 ? 'Low' : 'Normal',
    complexity: i % 7 === 0 ? 'complex' : i % 3 === 0 ? 'medium' : 'easy',
    lastEditorId: i % 2 ? 'specialist1' : 'specialist2', lastEditedAt: now - (20 + i) * 60_000, version: i === 0 ? 12 : 3, published: true,
  }));
  const makeTicket = (id: string, productIds: string[], kind: Ticket['kind'], description: string, age: number): Ticket => ({
    id, kind, productIds, priority: products.filter(p => productIds.includes(p.id)).sort((a, b) => ['Critical', 'High', 'Normal', 'Low'].indexOf(a.priority) - ['Critical', 'High', 'Normal', 'Low'].indexOf(b.priority))[0].priority, source: 'Запрос менеджера в CRM', description,
    createdAt: now - age * 60_000, createdBy: 'manager1', status: 'queued', acknowledgedBy: [],
    claimCycleStartedAt: now - age * 60_000, responseBreached: false, executionBreached: false, pauses: [],
    batch: productIds.length > 1, items: productIds.map(productId => ({ productId })),
    history: [{ id: `history-${id}-0`, at: now - age * 60_000, actorId: 'manager1', text: 'Менеджер создал запрос для команды Content AplTech.' }],
  });
  const queued = makeTicket('CT-1048', ['526005'], 'description', 'Уточнить совместимость и заполнить описание товара', 0.25);
  const progress = makeTicket('CT-1047', ['526006'], 'image', 'Заменить изображение на фотографию производителя', 3);
  progress.status = 'in_progress'; progress.assigneeId = 'specialist1'; progress.acknowledgedBy = ['specialist1'];
  progress.firstClaimedAt = progress.claimedAt = now - 2.5 * 60_000;
  progress.originalDueAt = progress.dueAt = now + 7.5 * 60_000;
  progress.history.push({ id: 'history-CT-1047-1', at: progress.claimedAt, actorId: 'specialist1', text: 'Получение подтверждено. Запрос взят в работу за 30 секунд.' });
  const waiting = makeTicket('CT-1046', ['526007', '526008', '526009'], 'publish', 'Опубликовать список из 3 товаров после проверки источников', 12);
  waiting.status = 'waiting_manager'; waiting.assigneeId = 'manager1'; waiting.acknowledgedBy = ['specialist2'];
  waiting.firstClaimedAt = waiting.claimedAt = now - 11 * 60_000;
  waiting.originalDueAt = now + 60 * 60_000; waiting.dueAt = now + 90 * 60_000;
  waiting.managerQuestion = 'Пришлите актуальный источник с фотографиями и спецификацией для списка.';
  waiting.pauses = [{ start: now - 5 * 60_000, reason: 'Не хватает исходных данных' }];
  waiting.history.push({ id: 'history-CT-1046-1', at: waiting.claimedAt, actorId: 'specialist2', text: 'Список взят в работу. Обещан общий срок; таймеров на отдельные карточки нет.' }, { id: 'history-CT-1046-2', at: now - 5 * 60_000, actorId: 'specialist2', text: 'Запрос передан менеджеру. Ожидание данных, выполнение на паузе. Новый плановый срок сообщён.' });
  return { schema: 1, revision: 1, products, tickets: [queued, progress, waiting], issues: [], slaPenalties: [], settings: structuredClone(DEFAULT_SETTINGS),
    operations: [
      { id: 'history-operation-1', productIds: products.slice(10, 15).map(p => p.id), authorId: 'specialist1', at: now - 45 * 60_000, baseWU: 7, multiplier: 1, totalWU: 7, source: 'plan', ruleSnapshot: 'Ранее выполненная плановая работа. Сохранённый вес 7 WU.' },
      { id: 'history-operation-2', productIds: products.slice(15).map(p => p.id), authorId: 'specialist2', at: now - 35 * 60_000, baseWU: 6.5, multiplier: 1, totalWU: 6.5, source: 'plan', ruleSnapshot: 'Ранее выполненная плановая работа. Сохранённый вес 6,5 WU.' },
      { id: 'history-operation-3', ticketId: 'CT-1038', productIds: ['526012'], authorId: 'specialist1', at: now - 30 * 60_000, baseWU: 0.5, multiplier: 1.5, totalWU: 0.75, source: 'request', ruleSnapshot: 'Исправление изображения, оба SLA соблюдены: 0,5 × 1,5 = 0,75 WU.' },
      { id: 'history-operation-4', ticketId: 'CT-1039', productIds: ['526013'], authorId: 'specialist2', at: now - 20 * 60_000, baseWU: 1, multiplier: 1.5, totalWU: 1.5, source: 'request', ruleSnapshot: 'Описание товара, оба SLA соблюдены: 1 × 1,5 = 1,5 WU.' },
    ],
    notifications: [
      ...['specialist1', 'specialist2'].map((recipientId, i) => ({ id: `seed-notification-${i}`, recipientId, at: queued.createdAt, title: 'Новый запрос Content AplTech', message: `${queued.id}: ${queued.description}. Подтвердите получение. SLA взятия — 2 рабочие минуты.`, ticketId: queued.id, read: false, requiresAck: true })),
      { id: 'seed-notification-manager', recipientId: 'manager1', at: now - 5 * 60_000, title: 'Запрос ожидает вашего ответа', message: `${waiting.id}: ${waiting.managerQuestion} Новый срок сообщён; ответственным назначен менеджер.`, ticketId: waiting.id, read: false, requiresAck: false },
    ],
  };
}
