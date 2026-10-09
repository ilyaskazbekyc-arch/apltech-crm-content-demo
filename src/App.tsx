import { useEffect, useRef, useState } from 'react';
import { Package, ClipboardList, BarChart3, Settings, Bell, Users, ArrowLeft, X, RotateCcw, Clock3, Plus, Layers } from 'lucide-react';
import type { Action, DemoState, View, ScreenProps } from './types';
import { ACTORS, createSeed } from './seed';
import { applyAction, formatDate } from './engine';
import { ProductList, ProductDrawer } from './Products';
import { TicketList, TicketDrawer } from './Tickets';
import { RequestForm, NewProductForm } from './RequestForm';
import { ImportedAnalytics } from './ImportedAnalytics';
import { SettingsScreen } from './Settings';
import { BulkEditor } from './BulkEditor';
import { ProductPdp } from './ProductPdp';
import './pdp.css';
import { NotificationCenter } from './NotificationCenter';
import './crm.css';
import './analytics.css';
import './demo.css';
import './workspace.css';

const STORE='apltech-isolated-crm-demo-v1',CLOCK='apltech-isolated-crm-clock-v1',ROLE='apltech-isolated-crm-role-v1';
const DEMO_START=Date.parse('2026-10-08T10:00:00+05:00');
interface DemoClock { base:number; wall:number }
function read<T>(key:string):T|undefined{try{return JSON.parse(localStorage.getItem(key)||'null')||undefined}catch{return undefined}}
function write(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value))}catch{/* Keep the working in-memory demo if browser storage is unavailable. */}}
function clockNow(clock:DemoClock){return clock.base+Math.max(0,Date.now()-clock.wall)}
interface RequestDraft { productId?:string; productIds?:string[]; error?:boolean }
function route(){const [path,query='']=location.hash.slice(1).split('?');const [view,id]=path.split('/');const params=new URLSearchParams(query);return {view:(['products','tickets','bulk','analytics','settings'].includes(view)?view:'products') as View,id,draft:{productId:params.get('product')||undefined,productIds:params.get('products')?.split(',').filter(Boolean),error:params.get('error')==='1'} as RequestDraft}}

const nav=[{id:'products' as View,label:'Товары',icon:Package},{id:'tickets' as View,label:'Тикеты',icon:ClipboardList},{id:'bulk' as View,label:'Массовое редактирование',icon:Layers},{id:'analytics' as View,label:'KPI и аналитика',icon:BarChart3},{id:'settings' as View,label:'Настройки',icon:Settings}];

export default function App(){
 const [clock,setClock]=useState<DemoClock>(()=>read<DemoClock>(CLOCK)||{base:DEMO_START,wall:Date.now()});
 const clockRef=useRef(clock);clockRef.current=clock;
 const [now,setNow]=useState(()=>clockNow(clock));
 const [state,setState]=useState<DemoState>(()=>{const saved=read<DemoState>(STORE);return saved?.schema===1&&Array.isArray(saved.products)&&saved.products.length>=20?saved:createSeed(clockNow(clock))});
 const stateRef=useRef(state);stateRef.current=state;
 const [actorId,setActorId]=useState(()=>read<string>(ROLE)||'manager1');const actor=ACTORS.find(a=>a.id===actorId)||ACTORS[0];
 const [view,setView]=useState<View>(route().view);const [productId,setProductId]=useState<string|undefined>(()=>route().view==='products'?route().id:undefined);const [ticketId,setTicketId]=useState<string|undefined>(()=>route().view==='tickets'&&route().id!=='new'?route().id:undefined);
 const [request,setRequest]=useState<RequestDraft|null>(()=>route().view==='tickets'&&route().id==='new'?route().draft:null);const [newProduct,setNewProduct]=useState<{ticketId?:string}|null>(null);const [selected,setSelected]=useState<string[]>([]);const [bulk,setBulk]=useState(false);const [notifications,setNotifications]=useState(false);const [resetConfirm,setResetConfirm]=useState(false);const [toast,setToast]=useState<{text:string;error:boolean}|null>(null);
 const [bulkPriority,setBulkPriority]=useState<'Critical'|'High'|'Normal'|'Low'>('High');const [bulkReason,setBulkReason]=useState('');
 const actorRef=useRef(actorId);actorRef.current=actorId;
 function flash(text:string,error=false){setToast({text,error})}
 function commit(next:DemoState){stateRef.current=next;write(STORE,next);setState(next)}
 function dispatch(action:Action){try{const fresh=read<DemoState>(STORE);const base=fresh?.schema===1&&fresh.revision>stateRef.current.revision?fresh:stateRef.current;const next=applyAction(base,action,clockNow(clockRef.current),actorRef.current);commit(next);if(action.type!=='tick'&&action.type!=='ack_ticket'&&action.type!=='read_notification')flash(action.type==='create_error_ticket'?'Ошибка подтверждена и направлена на исправление':action.type==='create_ticket'?'Запрос отправлен в общую очередь Content AplTech':action.type==='complete_ticket'?'Результат принят. KPI и аналитика обновлены':action.type==='return_manager'?'Запрос передан менеджеру; исполнение на паузе':action.type==='manager_reply'?'Ответ отправлен. Тот же запрос вернулся в свободную очередь':action.type==='report_delay'?'Менеджеру отправлены причина и новый срок':'Изменения сохранены');return true}catch(e){flash(e instanceof Error?e.message:'Не удалось выполнить действие',true);return false}}
 useEffect(()=>{write(STORE,stateRef.current);write(CLOCK,clockRef.current);const interval=setInterval(()=>{const time=clockNow(clockRef.current);setNow(time);try{const next=applyAction(stateRef.current,{type:'tick'},time,actorRef.current);if(next.revision!==stateRef.current.revision)commit(next)}catch{/* No action on passive clock errors. */}},1000);return()=>clearInterval(interval)},[]);
 useEffect(()=>{write(ROLE,actorId)},[actorId]);
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(null),5000);return()=>clearTimeout(timer)},[toast]);
 useEffect(()=>{const sync=(event:StorageEvent)=>{if(event.key===STORE){const next=read<DemoState>(STORE);if(next?.schema===1&&next.revision>=stateRef.current.revision){stateRef.current=next;setState(next)}}if(event.key===CLOCK){const next=read<DemoClock>(CLOCK);if(next){clockRef.current=next;setClock(next);setNow(clockNow(next))}}};addEventListener('storage',sync);return()=>removeEventListener('storage',sync)},[]);
 useEffect(()=>{const sync=()=>{const r=route();setView(r.view);setProductId(r.view==='products'?r.id:undefined);setTicketId(r.view==='tickets'&&r.id!=='new'?r.id:undefined);setRequest(r.view==='tickets'&&r.id==='new'?r.draft:null)};addEventListener('hashchange',sync);return()=>removeEventListener('hashchange',sync)},[]);
 function go(v:View,id?:string){setRequest(null);setNewProduct(null);setBulk(false);setView(v);setProductId(v==='products'?id:undefined);setTicketId(v==='tickets'?id:undefined);location.hash=v+(id?'/'+id:'')}
 function startRequest(draft:RequestDraft={}){if(actor.role!=='manager'){flash('Запрос создаёт менеджер.',true);return}go('tickets');setRequest(draft);const params=new URLSearchParams();if(draft.productId)params.set('product',draft.productId);if(draft.productIds?.length)params.set('products',draft.productIds.join(','));if(draft.error)params.set('error','1');location.hash='tickets/new'+(params.size?'?'+params.toString():'')}
 function openCreatedTicket(){const fresh=stateRef.current;const issue=request?.error?fresh.issues.find(i=>i.productId===request.productId&&i.version===fresh.products.find(p=>p.id===i.productId)?.version):undefined;const id=issue?.ticketId||fresh.tickets[0]?.id;go('tickets',id)}
 function closeDrawer(){setProductId(undefined);setTicketId(undefined);location.hash=view}
 function advance(minutes:number){const next={base:clockNow(clockRef.current)+minutes*60000,wall:Date.now()};clockRef.current=next;write(CLOCK,next);setClock(next);setNow(next.base);dispatch({type:'tick'})}
 function reset(){const nextClock={base:DEMO_START,wall:Date.now()};clockRef.current=nextClock;setClock(nextClock);write(CLOCK,nextClock);const next=createSeed(DEMO_START);commit(next);setNow(DEMO_START);setResetConfirm(false);setSelected([]);setNotifications(false);go('products');flash('Исходный демонстрационный пример восстановлен')}
 const props:ScreenProps={state,actor,now,dispatch,openTicket:id=>go('tickets',id),openProduct:id=>go('products',id),requestProduct:id=>startRequest({productId:id}),reportProductError:id=>startRequest({productId:id,error:true})};
 const unread=state.notifications.filter(n=>n.recipientId===actor.id&&!n.read);
 const mandatory=actor.role==='specialist'?unread.find(n=>n.requiresAck&&n.ticketId&&state.tickets.some(t=>t.id===n.ticketId&&t.status==='queued'&&!t.acknowledgedBy.includes(actor.id))):undefined;
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!mandatory&&!productId){setRequest(null);setNewProduct(null);setBulk(false);setResetConfirm(false);setNotifications(false);closeDrawer()}};addEventListener('keydown',key);return()=>removeEventListener('keydown',key)},[mandatory?.id,view,productId]);

 return <><aside className="crm-sidebar"><div className="crm-brand"><img src="/assets/logoCRM.svg" alt="apltech"/><span className="crm-brand-back"><ArrowLeft size={13}/></span></div><nav>{nav.map(item=><button key={item.id} className={'crm-nav-link '+(view===item.id?'active':'')} onClick={()=>go(item.id)}><item.icon size={17}/>{item.label}{item.id==='tickets'&&state.tickets.some(t=>t.status==='queued')&&<span className="crm-nav-count">{state.tickets.filter(t=>t.status==='queued').length}</span>}</button>)}</nav><div className="crm-sidebar-demo"><b>Демо CRM</b><p>{state.products.length} товаров · Content AplTech</p><p>Данные этого браузера</p><button onClick={()=>setResetConfirm(true)}><RotateCcw size={13}/> Начать заново</button></div></aside>
 <header className="crm-header"><button className="crm-events-control" onClick={()=>setNotifications(v=>!v)}><Bell size={17}/> Мои события{unread.length>0&&<span>{unread.length}</span>}</button><div className="crm-exchange"><span><b>$</b>453</span><span><b>€</b>509</span><span><b>₽</b>5.7056</span></div><Users size={19} className="crm-head-team"/><label className="crm-role-select"><span className="crm-small crm-muted">Демо-роль</span><select aria-label="Демо-роль" value={actor.id} onChange={e=>{setActorId(e.target.value);setRequest(null);setNewProduct(null);setBulk(false)}}>{ACTORS.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label></header>
 <main className="crm-main"><div className="crm-demo-toolbar"><div className="crm-flex"><Clock3 size={15}/><span>Демо-время: {formatDate(now)} · UTC+5</span></div><div className="crm-flex"><button className="crm-btn crm-btn-sm crm-btn-soft" onClick={()=>advance(1)}>+1 мин</button><button className="crm-btn crm-btn-sm crm-btn-soft" onClick={()=>advance(5)}>+5 мин</button><button className="crm-btn crm-btn-sm crm-btn-soft" onClick={()=>advance(60)}>+1 час</button></div></div><div className="crm-breadcrumb">Главная › <span>{nav.find(n=>n.id===view)?.label}</span></div>
 {view==='products'&&!productId&&<ProductList {...props} createProduct={()=>setNewProduct({})} selectedIds={selected} onSelection={setSelected} bulkPriority={()=>setBulk(true)} editSelection={()=>go('bulk',selected.join(','))} createRequest={()=>startRequest({productIds:selected})}/>}
 {view==='products'&&productId&&(actor.role==='lead'?<ProductDrawer key={productId} {...props} productId={productId} onClose={closeDrawer}/>:<ProductPdp key={productId} {...props} productId={productId} onClose={closeDrawer}/>)}
 {view==='tickets'&&<section className={'crm-ticket-workspace '+(ticketId?'has-detail':request&&actor.role==='manager'?'has-form':'queue-only')}><div><TicketList {...props} createRequest={()=>startRequest()}/></div>{request&&actor.role==='manager'&&<RequestForm key={JSON.stringify(request)} {...props} inline initialProductId={request.productId} initialProductIds={request.productIds} initialError={request.error} onClose={()=>go('tickets')} onCreated={openCreatedTicket}/>} {ticketId&&<TicketDrawer key={ticketId} {...props} inline ticketId={ticketId} onClose={closeDrawer} editBatch={ids=>go('bulk',ids.join(','))} createBoundProduct={id=>setNewProduct({ticketId:id})}/>}</section>}
 {view==='bulk'&&<BulkEditor key={route().id||'catalog'} {...props} initialIds={route().id?.split(',').filter(Boolean)} createRequest={ids=>startRequest({productIds:ids})}/>}
 {view==='analytics'&&<ImportedAnalytics {...props}/>}
 {view==='settings'&&<SettingsScreen {...props}/>}
 <p className="crm-demo-footer">Демонстрационный стенд · Все изменения сохраняются в этом браузере и обновляются в открытых вкладках.</p></main>

 {newProduct&&<NewProductForm {...props} ticketId={newProduct.ticketId} onClose={()=>{const linked=newProduct.ticketId;setNewProduct(null);if(linked)go('tickets',linked)}}/>}
 {bulk&&<div className="crm-modal-overlay"><section className="crm-modal" role="dialog" aria-label="Массовый приоритет"><div className="crm-flex crm-between"><h1>Приоритет {selected.length} товаров</h1><button className="crm-btn crm-btn-icon" onClick={()=>setBulk(false)} aria-label="Закрыть приоритет"><X size={20}/></button></div><form onSubmit={e=>{e.preventDefault();if(dispatch({type:'set_priority',productIds:selected,priority:bulkPriority,reason:bulkReason})){setBulk(false);setBulkReason('')}}}><label className="crm-field">Приоритет<select className="crm-input" value={bulkPriority} onChange={e=>setBulkPriority(e.target.value as typeof bulkPriority)}>{['Critical','High','Normal','Low'].map(p=><option key={p}>{p}</option>)}</select></label><label className="crm-field">Причина<textarea className="crm-input" value={bulkReason} onChange={e=>setBulkReason(e.target.value)} required rows={3}/></label><p className="crm-small crm-muted">Связанные открытые запросы обновятся сразу. Уже начисленные WU сохранят прежние условия.</p><div className="crm-form-actions"><button type="button" className="crm-btn crm-btn-soft" onClick={()=>setBulk(false)}>Отмена</button><button className="crm-btn crm-btn-primary">Сохранить приоритет</button></div></form></section></div>}
 {(notifications||mandatory)&&<NotificationCenter key={actor.id} {...props} mandatory={!!mandatory} onClose={()=>setNotifications(false)} openRequest={id=>{setNotifications(false);go('tickets',id)}}/>}
 {resetConfirm&&<div className="crm-modal-overlay"><section className="crm-modal crm-reset-modal" role="dialog" aria-label="Сброс демо"><h2>Начать демонстрацию заново?</h2><p>Вернутся исходные 20 товаров и примеры запросов. Изменения этого демо будут сброшены.</p><div className="crm-form-actions"><button className="crm-btn crm-btn-soft" onClick={()=>setResetConfirm(false)}>Отмена</button><button className="crm-btn crm-btn-primary" onClick={reset}>Восстановить пример</button></div></section></div>}
 {toast&&<div className={'crm-toast '+(toast.error?'crm-toast-error':'')} role="status">{toast.text}<button onClick={()=>setToast(null)} aria-label="Закрыть сообщение"><X size={16}/></button></div>}
 </>
}

import './catalog.css';
