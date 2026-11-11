import {useState} from 'react';
import type {ScreenProps} from './types';
export function TicketProductLink(props:ScreenProps & {ticketId:string}){
 const [search,setSearch]=useState(''),[id,setId]=useState('');
 const products=props.state.products.filter(p=>(p.partNumber+' '+p.name+' '+p.id).toLowerCase().includes(search.toLowerCase())||p.id===id);
 return <section className="crm-soft-box"><h3>Прикрепить существующую карточку</h3><p className="crm-small">Можно выбрать неопубликованную карточку. Номер тикета и его история сохранятся.</p><label className="crm-field">Поиск по P/N, названию или ID<input className="crm-input" value={search} onChange={e=>setSearch(e.target.value)}/></label><label className="crm-field">Карточка товара<select className="crm-input" value={id} onChange={e=>setId(e.target.value)}><option value="">Выберите карточку</option>{products.map(p=><option key={p.id} value={p.id}>{p.partNumber} · {p.name} · {p.published?'опубликовано':'не опубликовано'}</option>)}</select></label><button className="crm-btn crm-btn-primary" disabled={!id} onClick={()=>props.dispatch({type:'attach_ticket_product',ticketId:props.ticketId,productId:id})}>Прикрепить к этому тикету</button></section>
}
