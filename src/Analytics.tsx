import { useState } from 'react';
import type { QualityIssue, ScreenProps } from './types';
import { getAnalytics, formatDate } from './engine';
import { ACTORS } from './seed';
import './analytics.css';

const number = (value: number, digits = 2) => value.toLocaleString('ru-RU', { maximumFractionDigits: digits });
const actorName = (id: string) => ACTORS.find(actor => actor.id === id)?.name ?? id;
const percent = (value: number, total: number) => total ? `${number(value / total * 100)}%` : '—';

export function AnalyticsScreen({ state, actor, now, dispatch, openTicket, openProduct }: ScreenProps) {
  const analytics = getAnalytics(state);
  const [issueAction, setIssueAction] = useState<{ issue: QualityIssue; mode: 'appeal' | 'cancel' | 'confirm' } | null>(null);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');
  const liveIssues = state.issues.filter(issue => issue.status !== 'cancelled');
  const critical = liveIssues.some(issue => issue.critical);
  const productivity = analytics.planWU ? Math.min(analytics.cardWU / analytics.planWU * 100, state.settings.productivityCap) : 0;
  const requestContribution = analytics.planWU ? analytics.requestWU / analytics.planWU * 100 : 0;
  const bonusOperations = state.operations.filter(operation => operation.source === 'request' && operation.multiplier > 1);
  const grouped = new Map<string, { label: string; plan: number; request: number }>();
  for (const operation of [...state.operations].sort((a, b) => a.at - b.at)) {
    const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Qyzylorda', year: 'numeric', month: '2-digit', day: '2-digit' }).format(operation.at);
    const item = grouped.get(day) ?? { label: new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Qyzylorda', day: 'numeric', month: 'short' }).format(operation.at), plan: 0, request: 0 };
    item[operation.source === 'plan' ? 'plan' : 'request'] += operation.totalWU;
    grouped.set(day, item);
  }
  const days = [...grouped.values()].slice(-7);
  const maxDay = Math.max(1, ...days.map(day => day.plan + day.request));

  const startIssueAction = (issue: QualityIssue, mode: 'appeal' | 'cancel' | 'confirm') => {
    setIssueAction({ issue, mode });
    setReason('');
    setFormError('');
  };
  const submitIssue = () => {
    if (!issueAction || !reason.trim()) {
      setFormError('Укажите причину решения.');
      return;
    }
    const accepted = issueAction.mode === 'appeal'
      ? dispatch({ type: 'appeal_error', issueId: issueAction.issue.id, reason: reason.trim() })
      : dispatch({ type: 'resolve_error', issueId: issueAction.issue.id, cancel: issueAction.mode === 'cancel', reason: reason.trim() });
    if (accepted) setIssueAction(null);
  };

  return <div className="crm-analytics-screen">
    <div className="crm-flex crm-between crm-wrap crm-analytics-heading">
      <div><h1>KPI контента</h1><p className="crm-muted">Команда Content AplTech · все операции демонстрационного периода</p></div>
      <span className="crm-analytics-live"><i />Обновлено {formatDate(now)}</span>
    </div>

    <section className="crm-panel crm-analytics-summary" aria-label="Показатели команды">
      <div><span className="crm-muted">KPI команды</span><strong className={analytics.kpi < 80 ? 'crm-analytics-negative' : ''}>{number(analytics.kpi)}%</strong><small>{critical ? `Критическая ошибка: предел ${number(state.settings.criticalGate)}%` : 'По текущим правилам KPI'}</small></div>
      <div><span className="crm-muted">Карточки</span><strong>{number(analytics.cardWU)} <em>WU</em></strong><small>План {number(analytics.planWU)} WU · вклад {number(productivity)}%</small></div>
      <div><span className="crm-muted">Запросы менеджеров</span><strong>{number(analytics.requestWU)} <em>WU</em></strong><small>Вклад +{number(requestContribution)} п.п. · {bonusOperations.length} с бонусом</small></div>
      <div><span className="crm-muted">Ошибки и SLA</span><strong>{number(analytics.qualityPP + analytics.slaPP)} <em>п.п.</em></strong><small>{analytics.errors} ошибок · {state.slaPenalties.length} штрафов SLA</small></div>
    </section>

    <section className="crm-panel crm-panel-pad crm-analytics-formula">
      <div><b>Расчёт команды:</b> {number(productivity)}% за карточки + {number(requestContribution)} п.п. за запросы − {number(analytics.qualityPP)} п.п. за ошибки − {number(analytics.slaPP)} п.п. за SLA = <b>{number(analytics.kpi)}%</b>{critical && <span className="crm-tag crm-tag-error">Предел {number(state.settings.criticalGate)}%</span>}</div>
      <div className="crm-muted crm-small">План {number(state.settings.targetWU)} WU × {number(state.settings.workedDays)} рабочих дней × {analytics.employees.length} специалистов = {number(analytics.planWU)} WU. Вклад карточек ограничен {number(state.settings.productivityCap)}%. Одно выполнение учитывается один раз.</div>
    </section>

    <div className="crm-analytics-columns">
      <section className="crm-panel crm-panel-pad">
        <div className="crm-analytics-panel-title"><h2>Объём работы по дням</h2><span className="crm-small crm-muted">Начислено {number(analytics.totalWU)} WU</span></div>
        <div className="crm-analytics-legend"><span><i />Карточки</span><span><i />Запросы</span></div>
        {days.length ? <div className="crm-analytics-bars" role="img" aria-label={days.map(day => `${day.label}: карточки ${number(day.plan)} WU, запросы ${number(day.request)} WU`).join('; ')}>
          {days.map(day => <div className="crm-analytics-day" key={day.label}><span className="crm-small">{number(day.plan + day.request)}</span><div className="crm-analytics-bar-space"><div className="crm-analytics-bar" style={{ height: `${Math.max(2, (day.plan + day.request) / maxDay * 100)}%` }}><span className="crm-analytics-bar-request" style={{ height: `${day.plan + day.request ? day.request / (day.plan + day.request) * 100 : 0}%` }} /><span className="crm-analytics-bar-plan" style={{ flex: 1 }} /></div></div><small>{day.label}</small></div>)}
        </div> : <div className="crm-analytics-empty">После первого выполненного запроса или сохранённой карточки здесь появится объём WU.</div>}
        <div className="crm-analytics-footnote">График строится по журналу начислений. Изменение настроек влияет на следующие операции; начисленные WU сохраняют использованное правило.</div>
      </section>

      <section className="crm-panel crm-panel-pad">
        <div className="crm-analytics-panel-title"><h2>Сроки запросов</h2><span className="crm-tag">SLA</span></div>
        <div className="crm-analytics-sla-line"><span>Взяты не позднее {number(state.settings.responseMinutes)} мин.</span><b>{analytics.responseOnTime} из {analytics.responseTotal}</b><small>{percent(analytics.responseOnTime, analytics.responseTotal)}</small></div>
        <div className="crm-analytics-sla-line"><span>Выполнены в первоначальный срок</span><b>{analytics.executionOnTime} из {analytics.executionTotal}</b><small>{percent(analytics.executionOnTime, analytics.executionTotal)}</small></div>
        <div className="crm-soft-box crm-analytics-bonus"><span className="crm-muted crm-small">Оба условия соблюдены</span><strong>Базовый WU × {number(state.settings.slaBonus)}</strong><span className="crm-small">Бонус начисляется один раз при завершении запроса.</span></div>
        <ul className="crm-analytics-rule-list"><li>Одна карточка: предупреждение на {number(state.settings.warningMinutes)}-й минуте, срок — {number(state.settings.executionMinutes)} минут после взятия.</li><li>Список товаров: только общий обещанный срок, без таймеров карточек.</li><li>Штраф SLA — максимум {number(state.settings.slaPenaltyPP)} п.п. за запрос. До взятия отвечает команда, после — специалист.</li><li>Уведомление о задержке до нарушения снимает штраф выполнения. В пилоте длительность задержки не ограничена. Бонус остаётся привязан к первоначальному сроку.</li></ul>
        <div className="crm-analytics-footnote">Рабочий календарь: Пн–Пт 09:00–18:00, UTC+5. Выходные и настроенные праздники исключены; ожидание ответа менеджера ставит выполнение на паузу.</div>
      </section>
    </div>

    <section className="crm-panel crm-analytics-table-panel">
      <div className="crm-analytics-panel-title"><h2>Показатели специалистов</h2><span className="crm-muted crm-small">Командный штраф за отклик учитывается в общем KPI</span></div>
      <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Специалист</th><th>План, WU</th><th>Карточки, WU</th><th>Запросы, WU</th><th>Ошибки, п.п.</th><th>SLA, п.п.</th><th>KPI</th></tr></thead><tbody>{analytics.employees.map(employee => <tr key={employee.actorId}><td><b>{actorName(employee.actorId)}</b><div className="crm-muted crm-small">Карточек в выполненных работах: {employee.completed}</div></td><td>{number(employee.planWU)}</td><td>{number(employee.cardWU)}</td><td>{number(employee.requestWU)}</td><td>{employee.qualityPP ? `−${number(employee.qualityPP)}` : '0'}</td><td>{employee.slaPP ? `−${number(employee.slaPP)}` : '0'}</td><td><b>{number(employee.kpi)}%</b></td></tr>)}</tbody></table></div>
    </section>

    <section className="crm-panel crm-analytics-table-panel">
      <div className="crm-analytics-panel-title"><h2>Ошибки и оспаривание</h2><span className="crm-muted crm-small">Последний автор контента фиксируется при отметке ошибки</span></div>
      {state.issues.length ? <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Отметка</th><th>Товар / причина</th><th>Автор контента</th><th>Штраф</th><th>Статус и действия</th></tr></thead><tbody>{[...state.issues].sort((a, b) => b.at - a.at).map(issue => {
        const product = state.products.find(item => item.id === issue.productId);
        return <tr key={issue.id}><td><b>{issue.id}</b><div className="crm-muted crm-small">{formatDate(issue.at)}</div><div className="crm-muted crm-small">{actorName(issue.reporterId)}</div></td><td><button className="crm-analytics-link" onClick={() => openProduct(issue.productId)}>{product?.partNumber ?? issue.productId}</button><div className="crm-small">{issue.reason}</div><div className="crm-muted crm-small">Версия контента {issue.version}</div>{issue.appeal && <div className="crm-analytics-appeal-text">Оспаривание: {issue.appeal}</div>}</td><td>{actorName(issue.authorId)}</td><td><span className={`crm-tag ${issue.status === 'cancelled' ? 'crm-tag-success' : 'crm-tag-error'}`}>{issue.status === 'cancelled' ? 'Снят' : `−${number(issue.penaltyPP)} п.п.`}</span>{issue.critical && <div className="crm-muted crm-small">Критическая ошибка</div>}</td><td><div className="crm-small">{issue.status === 'cancelled' ? 'Ошибка отменена' : issue.status === 'appealed' ? 'Оспорена · штраф действует' : 'Ошибка отмечена'}</div><div className="crm-flex crm-wrap crm-analytics-row-actions">{actor.id === issue.authorId && issue.status === 'active' && <button className="crm-btn crm-btn-outline crm-btn-sm" onClick={() => startIssueAction(issue, 'appeal')}>Оспорить</button>}{actor.role === 'lead' && issue.status !== 'cancelled' && <><button className="crm-btn crm-btn-outline crm-btn-sm" onClick={() => startIssueAction(issue, 'cancel')}>Отменить ошибку</button>{issue.status === 'appealed' && <button className="crm-btn crm-btn-soft crm-btn-sm" onClick={() => startIssueAction(issue, 'confirm')}>Подтвердить ошибку</button>}</>}</div></td></tr>;
      })}</tbody></table></div> : <div className="crm-analytics-empty">Ошибок контента пока нет. Отметка «Ошибка» в карточке сразу снижает KPI последнего автора; «Доработать» штраф не создаёт.</div>}
      <p className="crm-analytics-footnote">Оспаривание само по себе не снимает штраф. После отмены руководителем KPI пересчитывается сразу. Следующая правка карточки не переносит ошибку другому специалисту.</p>
    </section>

    <section className="crm-panel crm-analytics-table-panel">
      <div className="crm-analytics-panel-title"><h2>Журнал WU</h2><span className="crm-muted crm-small">Фиксирует автора, результат и использованное правило</span></div>
      {state.operations.length ? <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Операция</th><th>Источник / товар</th><th>Автор</th><th>База</th><th>Множитель</th><th>Начислено</th></tr></thead><tbody>{[...state.operations].sort((a, b) => b.at - a.at).slice(0, 30).map(operation => <tr key={operation.id}><td><b>{operation.id}</b><div className="crm-muted crm-small">{formatDate(operation.at)}</div></td><td>{operation.ticketId ? state.tickets.some(ticket => ticket.id === operation.ticketId) ? <button className="crm-analytics-link" onClick={() => openTicket(operation.ticketId!)}>{operation.ticketId} · запрос</button> : <span>{operation.ticketId} · завершённый запрос</span> : <span>Плановая работа</span>}<div className="crm-flex crm-wrap">{operation.productIds.map(id => <button className="crm-analytics-link crm-small" key={id} onClick={() => openProduct(id)}>{state.products.find(product => product.id === id)?.partNumber ?? id}</button>)}</div><div className="crm-muted crm-small">{operation.ruleSnapshot}</div></td><td>{actorName(operation.authorId)}</td><td>{number(operation.baseWU)} WU</td><td>×{number(operation.multiplier)}</td><td><b>{number(operation.totalWU)} WU</b></td></tr>)}</tbody></table></div> : <div className="crm-analytics-empty">Завершите запрос или сохраните плановую работу с карточкой, чтобы увидеть начисление.</div>}
      {state.operations.length > 30 && <p className="crm-analytics-footnote">Показаны 30 последних операций. Общие показатели учитывают весь журнал.</p>}
    </section>

    {issueAction && <div className="crm-modal-overlay" onClick={() => setIssueAction(null)}><section className="crm-modal crm-analytics-issue-modal" role="dialog" aria-modal="true" aria-labelledby="crm-issue-title" onClick={event => event.stopPropagation()}><div className="crm-flex crm-between"><h2 id="crm-issue-title">{issueAction.mode === 'appeal' ? 'Оспорить ошибку' : issueAction.mode === 'cancel' ? 'Отменить ошибку' : 'Подтвердить ошибку'}</h2><button className="crm-btn crm-btn-soft crm-btn-icon" aria-label="Закрыть" onClick={() => setIssueAction(null)}>×</button></div><p className="crm-muted">{issueAction.issue.id} · {actorName(issueAction.issue.authorId)} · −{number(issueAction.issue.penaltyPP)} п.п.</p><label className="crm-field"><span>{issueAction.mode === 'appeal' ? 'Почему вы не согласны с ошибкой?' : 'Причина решения'}</span><textarea className="crm-input" value={reason} onChange={event => setReason(event.target.value)} rows={4} placeholder="Опишите причину" autoFocus /></label>{formError && <p className="crm-analytics-negative" role="alert">{formError}</p>}<div className="crm-flex crm-analytics-modal-actions"><button className="crm-btn crm-btn-outline" onClick={() => setIssueAction(null)}>Отмена</button><button className="crm-btn crm-btn-primary" onClick={submitIssue}>{issueAction.mode === 'appeal' ? 'Отправить оспаривание' : 'Сохранить решение'}</button></div></section></div>}
  </div>;
}
