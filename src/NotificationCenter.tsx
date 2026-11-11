import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import type { ScreenProps } from './types';
import { formatDate, formatDuration, getTicketSla } from './engine';
import { inputDate, localInput } from './ui-utils';

export function NotificationCenter(props: ScreenProps & { mandatory: boolean; onClose: () => void; openRequest: (id: string) => void }) {
  const [onlyNew, setOnlyNew] = useState(true);
  const [defaultDue] = useState(()=>localInput(props.now+120*60000));
  const [due, setDue] = useState<Record<string, string>>({});
  const events = props.state.notifications.filter(n => n.recipientId === props.actor.id);
  const needsAck = (ticketId?: string) => props.actor.role === 'specialist' && props.state.tickets.some(t => t.id === ticketId && t.status === 'queued' && !t.acknowledgedBy.includes(props.actor.id));
  const pending = events.filter(n => !n.read && n.requiresAck && needsAck(n.ticketId));
  const visible = events.filter(n => !onlyNew || !n.read).sort((a,b) => Number(pending.includes(b))-Number(pending.includes(a)) || b.at-a.at);
  function acknowledgeAll() {
    for (const id of new Set(pending.map(n => n.ticketId!))) if (!props.dispatch({ type: 'ack_ticket', ticketId: id })) return;
    if (props.mandatory) props.onClose();
  }
  return <div className="crm-modal-overlay crm-mandatory-overlay"><section className="crm-modal crm-event-center" role="dialog" aria-modal="true" aria-label="Уведомления Content AplTech">
    <div className="crm-flex crm-between"><h2><Bell size={20}/> Уведомления</h2>{!props.mandatory && <button className="crm-btn crm-btn-icon" aria-label="Закрыть уведомления" onClick={props.onClose}><X size={18}/></button>}</div>
    <p className="crm-small crm-muted">Подтверждение получения не назначает исполнителя. SLA взятия останавливается после назначения ответственного.</p>
    <div className="crm-flex crm-wrap"><button className={'crm-btn '+(onlyNew?'crm-btn-primary':'crm-btn-soft')} onClick={()=>setOnlyNew(true)}>Новые · {events.filter(n=>!n.read).length}</button><button className={'crm-btn '+(!onlyNew?'crm-btn-primary':'crm-btn-soft')} onClick={()=>setOnlyNew(false)}>Все события</button>{pending.length>0&&<button className="crm-btn crm-btn-soft" onClick={acknowledgeAll}>Подтвердить получение всех · {new Set(pending.map(n=>n.ticketId)).size}</button>}</div>
    <div className="crm-event-list">{visible.map(n=>{
      const t=props.state.tickets.find(t=>t.id===n.ticketId);
      const ack=n.requiresAck&&!n.read&&needsAck(n.ticketId);
      const claim=n.requiresAck&&props.actor.role==='specialist'&&t?.status==='queued';
      return <article key={n.id} className={'crm-event-card '+(!n.read?'unread':'')}>
        <div className="crm-flex crm-between"><b>{n.title}</b><span className="crm-small crm-muted">{formatDate(n.at)}</span></div><p>{n.message}</p>
        {t&&<div className="crm-flex crm-wrap"><span className="crm-tag">{t.id}</span><span className="crm-tag">{t.productIds.length?t.priority:'Профиль пока не задан'}</span>{claim&&<span className="crm-small">До взятия: {formatDuration(Math.max(0,getTicketSla(t,props.state,props.now).responseRemaining))}</span>}</div>}
        {claim&&t.batch&&<label className="crm-field">Общий срок {t.id}<input className="crm-input" type="datetime-local" value={due[t.id]??defaultDue} onChange={e=>setDue({...due,[t.id]:e.target.value})}/></label>}
        <div className="crm-flex crm-wrap crm-event-actions">
          {ack&&<button className="crm-btn crm-btn-soft" onClick={()=>props.dispatch({type:'ack_ticket',ticketId:t!.id})}>Подтвердить получение</button>}
          {!ack&&!n.read&&<button className="crm-btn crm-btn-soft" onClick={()=>props.dispatch({type:'read_notification',notificationId:n.id})}>Прочитано</button>}
          {t&&<button className="crm-btn crm-btn-soft" onClick={()=>{if(ack&&!props.dispatch({type:'ack_ticket',ticketId:t.id}))return;if(!ack)props.dispatch({type:'read_notification',notificationId:n.id});props.openRequest(t.id)}}>Открыть {t.id}</button>}
          {claim&&<button className="crm-btn crm-btn-primary" onClick={()=>{if(!t.acknowledgedBy.includes(props.actor.id)&&!props.dispatch({type:'ack_ticket',ticketId:t.id}))return;if(props.dispatch({type:'claim_ticket',ticketId:t.id,promisedDueAt:t.batch?inputDate(due[t.id]??defaultDue):undefined}))props.openRequest(t.id)}}>Взять в работу {t.id}</button>}
        </div>
      </article>;
    })}{visible.length===0&&<p className="crm-muted">Новых уведомлений нет.</p>}</div>
  </section></div>;
}
