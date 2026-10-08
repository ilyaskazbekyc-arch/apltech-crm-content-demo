import { useEffect, useState } from 'react';
import type { Complexity, Priority, RequestKind, ScreenProps, Settings } from './types';
import './analytics.css';

const PRIORITIES: Priority[] = ['Critical', 'High', 'Normal', 'Low'];
const COMPLEXITIES: [Complexity, string][] = [['easy', 'Лёгкая карточка'], ['medium', 'Средняя карточка'], ['complex', 'Сложная карточка']];
const REQUESTS: [RequestKind, string][] = [['image', 'Исправить изображение'], ['description', 'Доработать описание'], ['remove-distributor', 'Удалить дистрибьютора'], ['split', 'Разъединить карточку и создать новую']];
const clone = (settings: Settings): Settings => ({ ...settings, priorityRates: { ...settings.priorityRates }, complexityRates: { ...settings.complexityRates }, requestWeights: { ...settings.requestWeights }, holidays: [...settings.holidays] });
type ScalarKey = 'responseMinutes' | 'warningMinutes' | 'executionMinutes' | 'slaBonus' | 'slaPenaltyPP' | 'qualityPenaltyPP' | 'targetWU' | 'workedDays' | 'productivityCap' | 'criticalGate';

export function SettingsScreen({ state, actor, dispatch }: ScreenProps) {
  const [draft, setDraft] = useState(() => clone(state.settings));
  const [holidaysText, setHolidaysText] = useState(state.settings.holidays.join('\n'));
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const editable = actor.role === 'lead';
  const settingsVersion = JSON.stringify(state.settings);
  useEffect(() => { setDraft(clone(state.settings)); setHolidaysText(state.settings.holidays.join('\n')); }, [settingsVersion]);
  const update = (key: ScalarKey, value: string) => { setDraft(current => ({ ...current, [key]: value === '' ? Number.NaN : Number(value) })); setSaved(false); setError(''); };
  const setRate = (group: 'priorityRates' | 'complexityRates' | 'requestWeights', key: string, value: string) => {
    setDraft(current => ({ ...current, [group]: { ...current[group], [key]: value === '' ? Number.NaN : Number(value) } }));
    setSaved(false); setError('');
  };
  const input = (key: ScalarKey, title: string, note: string, options?: { min?: number; step?: number }) => <label className="crm-field"><span>{title}</span><input className="crm-input" type="number" min={options?.min ?? 0} step={options?.step ?? 1} value={Number.isNaN(draft[key]) ? '' : draft[key]} disabled={!editable} onChange={event => update(key, event.target.value)} /><small className="crm-muted">{note}</small></label>;
  const save = () => {
    const positive = [draft.responseMinutes, draft.warningMinutes, draft.executionMinutes, draft.targetWU, draft.workedDays, ...Object.values(draft.priorityRates), ...Object.values(draft.complexityRates), ...Object.values(draft.requestWeights)];
    if (positive.some(value => !Number.isFinite(value) || value <= 0)) { setError('Время SLA, план, рабочие дни и все веса должны быть больше нуля.'); return; }
    if (!Number.isFinite(draft.slaBonus) || draft.slaBonus < 1) { setError('Множитель SLA должен быть не меньше 1.'); return; }
    if (draft.warningMinutes >= draft.executionMinutes) { setError('Предупреждение должно наступать раньше срока выполнения.'); return; }
    if ([draft.slaPenaltyPP, draft.qualityPenaltyPP, draft.productivityCap, draft.criticalGate].some(value => !Number.isFinite(value) || value < 0)) { setError('Штрафы и ограничения должны быть неотрицательными числами.'); return; }
    if (draft.criticalGate > draft.productivityCap) { setError('Предел KPI при критической ошибке не должен быть выше лимита производительности.'); return; }
    const holidays = [...new Set(holidaysText.split(/[\n,;]+/).map(value => value.trim()).filter(Boolean))].sort();
    if (holidays.some(value => !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value)) { setError('Укажите существующие даты праздников в формате ГГГГ-ММ-ДД, по одной на строку.'); return; }
    if (dispatch({ type: 'save_settings', settings: { ...clone(draft), holidays } })) { setError(''); setSaved(true); }
  };

  return <div className="crm-settings-screen">
    <div className="crm-flex crm-between crm-wrap crm-settings-heading"><div><h1>Настройки KPI и SLA</h1><p className="crm-muted">Правила команды Content AplTech</p></div><span className="crm-tag">{editable ? 'Руководитель' : 'Просмотр правил'}</span></div>
    {!editable && <div className="crm-soft-box crm-settings-role-note">Изменение правил доступно руководителю. Вы можете ознакомиться с весами, сроками и расчётом KPI.</div>}
    <section className="crm-panel crm-panel-pad">
      <div className="crm-settings-section-title"><h2>Приоритет и сложность товара</h2><p className="crm-muted">Руководитель задаёт приоритет в карточке или списке товаров. Открытый запрос автоматически наследует его.</p></div>
      <div className="crm-settings-rate-grid">{PRIORITIES.map(priority => <label className="crm-field" key={priority}><span>{priority} · множитель</span><input className="crm-input" type="number" min="0.01" step="0.05" value={Number.isNaN(draft.priorityRates[priority]) ? '' : draft.priorityRates[priority]} disabled={!editable} onChange={event => setRate('priorityRates', priority, event.target.value)} /></label>)}</div>
      <div className="crm-settings-three-grid">{COMPLEXITIES.map(([complexity, label]) => <label className="crm-field" key={complexity}><span>{label} · WU</span><input className="crm-input" type="number" min="0.01" step="0.1" value={Number.isNaN(draft.complexityRates[complexity]) ? '' : draft.complexityRates[complexity]} disabled={!editable} onChange={event => setRate('complexityRates', complexity, event.target.value)} /></label>)}</div>
      <div className="crm-settings-new-profile"><label className="crm-field"><span>Исходный приоритет нового товара</span><select className="crm-input" value={draft.newProductPriority} disabled={!editable} onChange={event => { setDraft(current => ({ ...current, newProductPriority: event.target.value as Priority })); setSaved(false); }}>{PRIORITIES.map(priority => <option key={priority}>{priority}</option>)}</select><small className="crm-muted">Используется до создания карточки по партномеру и источнику.</small></label><div className="crm-soft-box"><b>База карточки = сложность × приоритет</b><div className="crm-small crm-muted">Индивидуальный вес можно задать в товаре с причиной. После публикации карточка получает выбранную сложность; запрос на её добавление рассчитывается по итоговой карточке.</div></div></div>
    </section>

    <section className="crm-panel crm-panel-pad">
      <div className="crm-settings-section-title"><h2>Вес типов запросов</h2><p className="crm-muted">Одна операция по запросу начисляется один раз. Эти веса используются для соответствующих работ.</p></div>
      <div className="crm-settings-rate-grid">{REQUESTS.map(([kind, label]) => <label className="crm-field" key={kind}><span>{label} · WU</span><input className="crm-input" type="number" min="0.01" step="0.1" value={Number.isNaN(draft.requestWeights[kind]) ? '' : draft.requestWeights[kind]} disabled={!editable} onChange={event => setRate('requestWeights', kind, event.target.value)} /></label>)}</div>
      <div className="crm-soft-box"><b>Публикация нового товара</b><div className="crm-small crm-muted">Вес рассчитывается по сложности и приоритету карточки, с учётом индивидуального веса. Для списка складываются веса результатов; таймеры отдельных карточек не запускаются.</div></div>
    </section>

    <section className="crm-panel crm-panel-pad">
      <div className="crm-settings-section-title"><h2>SLA, бонус и штрафы</h2><p className="crm-muted">Время считается только в рабочие часы. Подтверждение уведомления не заменяет взятие запроса.</p></div>
      <div className="crm-settings-three-grid">{input('responseMinutes', 'Взятие запроса · минуты', 'От создания запроса до назначения специалиста.', { min: 1 })}{input('warningMinutes', 'Предупреждение · минуты', 'Для одной карточки, после взятия в работу.', { min: 1 })}{input('executionMinutes', 'Выполнение карточки · минуты', 'Для одной карточки; у списка только общий срок.', { min: 1 })}</div>
      <div className="crm-settings-three-grid">{input('slaBonus', 'Множитель WU за SLA', 'Отклик и выполнение в исходный срок соблюдены.', { min: 1, step: 0.1 })}{input('slaPenaltyPP', 'Штраф SLA · п.п.', 'Максимум один штраф за весь запрос.', { min: 0, step: 0.1 })}{input('qualityPenaltyPP', 'Ошибка контента · п.п.', 'Применяется сразу к последнему автору контента.', { min: 0, step: 0.1 })}</div>
      <div className="crm-settings-rules"><div><b>Возврат менеджеру</b><p>Исполнитель меняется на менеджера; выполнение на паузе. После ответа тот же запрос возвращается в свободную очередь Content AplTech.</p></div><div><b>Перенос и небольшая задержка</b><p>Специалист указывает причину и новый срок — менеджер получает уведомление. До нарушения уведомление снимает штраф выполнения без ограничения длительности в пилоте. Бонус проверяется по первоначальному сроку.</p></div></div>
    </section>

    <section className="crm-panel crm-panel-pad">
      <div className="crm-settings-section-title"><h2>План и формула KPI</h2><p className="crm-muted">Карточки и запросы учитываются отдельно, без повторного начисления одной работы.</p></div>
      <div className="crm-settings-rate-grid">{input('targetWU', 'Дневной план специалиста · WU', 'Основа плана на демонстрационный период.', { min: 1 })}{input('workedDays', 'Рабочие дни в периоде', 'Общий для специалистов план периода.', { min: 0.5, step: 0.5 })}{input('productivityCap', 'Предел вклада карточек · %', 'Ограничивает производственную часть KPI.', { min: 0 })}{input('criticalGate', 'Предел при критической ошибке · %', 'Применяется при действующей критической ошибке.', { min: 0 })}</div>
      <div className="crm-soft-box crm-settings-formula">KPI = вклад карточек до установленного предела + WU запросов ÷ план × 100 − штрафы ошибок − штрафы SLA<div className="crm-small crm-muted">При критической ошибке применяется дополнительный предел. При отмене ошибки штраф снимается. «Доработать» не снижает KPI.</div></div>
    </section>

    <section className="crm-panel crm-panel-pad">
      <div className="crm-settings-section-title"><h2>Рабочий календарь</h2><p className="crm-muted">Пн–Пт, 09:00–18:00 · UTC+5. Запрос выходного дня начинает SLA в 09:00 следующего рабочего дня.</p></div>
      <label className="crm-field crm-settings-holidays"><span>Праздники и нерабочие даты</span><textarea className="crm-input" rows={4} value={holidaysText} disabled={!editable} onChange={event => { setHolidaysText(event.target.value); setSaved(false); setError(''); }} placeholder={'2026-10-26\n2026-12-16'} /><small className="crm-muted">Формат ГГГГ-ММ-ДД, по одной дате на строку. Выходные исключаются автоматически.</small></label>
    </section>

    <div className="crm-settings-save-bar"><div><span className="crm-small crm-muted">Новые веса применяются к следующим начислениям. Журнал WU сохраняет прежние расчёты.</span>{error && <div className="crm-analytics-negative crm-small" role="alert">{error}</div>}{saved && <div className="crm-settings-saved" role="status">Настройки сохранены</div>}</div><div className="crm-flex"><button className="crm-btn crm-btn-outline" disabled={!editable} onClick={() => { setDraft(clone(state.settings)); setHolidaysText(state.settings.holidays.join('\n')); setError(''); setSaved(false); }}>Отменить изменения</button><button className="crm-btn crm-btn-primary" disabled={!editable} onClick={save}>Сохранить настройки</button></div></div>
  </div>;
}
