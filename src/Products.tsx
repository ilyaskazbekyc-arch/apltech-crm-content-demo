import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Complexity, Priority, Product, ScreenProps } from './types';
import { ACTORS } from './seed';
import { RequestForm } from './RequestForm';
import { catalogValue as pdpValue } from './catalog';
import { CatalogFilters } from './CatalogFilters';
import { EMPTY_QUERY,filterProducts,catalogValue,publication } from './catalog';
import { formatDate, getProductBaseWU } from './engine';

const PRIORITIES: Priority[] = ['Critical', 'High', 'Normal', 'Low'];
const COMPLEXITIES: Record<Complexity, string> = { easy: 'Лёгкая', medium: 'Средняя', complex: 'Сложная' };
const STATUS_NAMES = { queued: 'Свободная очередь', in_progress: 'В работе', waiting_manager: 'Ожидает менеджера', completed: 'Выполнен' };
const money = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);
const wu = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
const actorName = (id: string) => ACTORS.find(person => person.id === id)?.name ?? 'Не назначен';

function placeholder(product: Product) {
  const isPrinter = /картридж|лента|RL-BR/i.test(product.name + product.partNumber);
  const shape = isPrinter
    ? '<rect x="25" y="26" width="45" height="64" rx="7" fill="#404c5a"/><rect x="31" y="35" width="33" height="24" rx="2" fill="#fff"/><path d="M36 67h23M36 74h23" stroke="#99aabb" stroke-width="3"/>'
    : /монитор/i.test(product.name)
      ? '<rect x="12" y="24" width="71" height="48" rx="4" fill="#263847"/><rect x="17" y="29" width="61" height="37" rx="2" fill="#d8e9f7"/><path d="M47 73v15M30 89h34" stroke="#718a9a" stroke-width="5"/>'
      : /ноутбук/i.test(product.name)
        ? '<rect x="16" y="22" width="62" height="45" rx="3" fill="#3c5162"/><rect x="21" y="27" width="52" height="33" fill="#d8e9f7"/><path d="M16 67L7 83h79L78 67" fill="#b5c4cf"/>'
        : '<rect x="25" y="24" width="46" height="63" rx="6" fill="#dae6ee" stroke="#8da9bd" stroke-width="2"/><path d="M37 40h22M37 48h22M37 56h22" stroke="#8da9bd" stroke-width="3"/><circle cx="48" cy="73" r="4" fill="#2c74da"/>';
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="116" viewBox="0 0 96 116">${shape}</svg>`)}`;
}

function ProductImage({ product, className }: { product: Product; className: string }) {
  return <img className={className} src={product.image || placeholder(product)} alt={product.name} onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = placeholder(product); }} />;
}

function PriorityTag({ value }: { value: Priority }) {
  return <span className={`crm-tag crm-tag-priority priority-${value}`}>{value}</span>;
}

function EditIcon() {
  return <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m14 4 6 6M4 20l5-1 12-12a2.2 2.2 0 0 0-3-3L6 16l-2 4Z"/><path d="M12 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7"/></svg>;
}

export function ProductList(props: ScreenProps & { createProduct: () => void; selectedIds: string[]; onSelection: (ids: string[]) => void; bulkPriority: () => void; createRequest: () => void; editSelection:()=>void; editProduct:(id:string)=>void }) {
 const {state,actor,selectedIds,onSelection}=props;
 const [query,setQuery]=useState({...EMPTY_QUERY,status:'Опубликовано'});
 const [descriptionId,setDescriptionId]=useState<string|null>(null);
 const [page,setPage]=useState(1),[perPage,setPerPage]=useState(20);
 const visible=filterProducts(state.products,query,props.now),pages=Math.max(1,Math.ceil(visible.length/perPage)),current=Math.min(page,pages);
 const rows=visible.slice((current-1)*perPage,current*perPage);
 const allSelected=rows.length>0&&rows.every(p=>selectedIds.includes(p.id));
 const updateQuery=(q:typeof query)=>{setQuery(q);setPage(1)};
 return <div className="crm-exact-catalog"><h1>Товары</h1><CatalogFilters products={state.products} value={query} onChange={q=>updateQuery({...q})} actions={<>
 {actor.role==='specialist'&&<button className="crm-btn crm-btn-primary" onClick={props.createProduct}>＋ Создать товар</button>}
 {actor.role==='manager'&&<button className="crm-btn crm-btn-primary" onClick={props.createRequest}>Создать запрос{selectedIds.length?' · '+selectedIds.length:''}</button>}
 {actor.role==='lead'&&<button className="crm-btn crm-btn-primary" disabled={!selectedIds.length} onClick={props.bulkPriority}>Изменить приоритет</button>}
 <button className="crm-btn crm-btn-soft" onClick={props.editSelection}>Массовое редактирование{selectedIds.length?' · '+selectedIds.length:''}</button>
 </>}/>
 <section className="crm-panel crm-panel-pad"><div className="crm-table-toolbar"><span className="crm-small">Показаны записи <b>{visible.length?(current-1)*perPage+1:0}–{Math.min(current*perPage,visible.length)}</b> из <b>{visible.length}</b>.</span><label className="crm-small">На странице <select aria-label="Товаров на странице" value={perPage} onChange={e=>{setPerPage(Number(e.target.value));setPage(1)}}>{[10,20,50].map(n=><option key={n}>{n}</option>)}</select></label></div>
 {selectedIds.length>0&&<div className="crm-selection-bar">Выбрано: {selectedIds.length} <button className="crm-link" onClick={()=>onSelection([])}>Снять выделение</button></div>}
 <div className="crm-table-wrap"><table className="crm-table crm-exact-product-table"><colgroup><col style={{width:55}}/><col style={{width:'22%'}}/><col style={{width:'25%'}}/><col style={{width:'39%'}}/><col style={{width:'14%'}}/></colgroup><thead><tr><th><span>#</span> <input type="checkbox" aria-label="Выбрать все товары" checked={allSelected} onChange={()=>onSelection(allSelected?selectedIds.filter(id=>!rows.some(p=>p.id===id)):[...new Set([...selectedIds,...rows.map(p=>p.id)])])}/></th><th>Направление</th><th><button className="crm-link" onClick={()=>updateQuery({...query,sort:'name'})}>Наименование</button></th><th>Информация о товаре</th><th><button className="crm-link" aria-label="Сортировать по цене на сайте" onClick={()=>updateQuery({...query,sort:query.sort==='priceAsc'?'priceDesc':'priceAsc'})}>Цена на сайте {query.sort==='priceAsc'?'↑':'↓'}</button></th></tr></thead><tbody>{rows.map((product,index)=>{
 let extra:Array<{name:string;price:string;stock:string;reserve:string;await:string}>=[];try{extra=JSON.parse(String(product.pdp?.distributors||'[]'))}catch{/* Keep primary supplier visible. */}
 const suppliers=[...(product.supplier?[{name:product.supplier,price:String(product.pdp?.incomingPrice??Math.round(product.price/1.14)),stock:String(product.stock),reserve:String(product.pdp?.reserve??0),await:String(product.pdp?.await??0)}]:[]),...extra];
 return <tr key={product.id} className={selectedIds.includes(product.id)?'selected':''}><td><input type="checkbox" aria-label={'Выбрать '+product.partNumber} checked={selectedIds.includes(product.id)} onChange={()=>onSelection(selectedIds.includes(product.id)?selectedIds.filter(id=>id!==product.id):[...selectedIds,product.id])}/><p className="crm-tiny">{(current-1)*perPage+index+1}</p></td>
 <td><div className="crm-exact-direction"><a href={'#products/'+product.id+'?edit=1'} aria-label={'Открыть карточку '+product.partNumber} onClick={e=>{if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();props.openProduct(product.id)}}}><ProductImage product={product} className="crm-exact-thumb"/></a><div><span className="crm-small">{catalogValue(product,'category')} <b>{catalogValue(product,'vendor')}</b></span><p className={'crm-tiny '+(product.stock>0?'crm-text-success':'crm-muted')}>{product.stock>0?'В наличии':product.pdp?.order?'Под заказ':'Нет в наличии'}</p></div></div></td>
 <td><button className="crm-link crm-exact-name" onClick={()=>props.openProduct(product.id)}>{product.pdp?.syncedAt?'⇄ ':''}{product.name}</button><div className="crm-product-pn">pn: {product.partNumber} <button className="crm-link" aria-label={'Скопировать партномер '+product.partNumber} onClick={()=>navigator.clipboard.writeText(product.partNumber)}>⧉</button></div><button className="crm-link crm-small" onClick={()=>setDescriptionId(descriptionId===product.id?null:product.id)}>Описание</button>{descriptionId===product.id&&<p className="crm-small">{product.description}</p>}
</td>
 <td><table className="crm-supplier-grid"><thead><tr><th>Поставщик</th><th>Нал</th><th>Рез</th><th>Ожид</th><th>Входная</th><th>Актуальность</th></tr></thead><tbody>{suppliers.map((d,i)=><tr key={i}><td>{d.name}</td><td>{d.stock}</td><td>{d.reserve}</td><td>{d.await}</td><td>{money(Number(d.price))}</td><td>{formatDate(product.lastEditedAt)}</td></tr>)}</tbody></table>{!suppliers.length&&<span className="crm-small crm-muted">Нет дистрибьюторов</span>}</td>
 <td><span className="crm-tiny crm-muted">Стандартная</span><p className="crm-exact-price">{money(product.price)} <span className="crm-tiny">({product.pdp?.markup??14}%)</span></p>{publication(product)!=='Опубликовано'&&<span className="crm-tag">{publication(product)}</span>}</td></tr>})}</tbody></table></div>
 {!visible.length&&<p role="status" className="crm-panel-pad crm-muted">По выбранным фильтрам товары не найдены.</p>}
 <nav className="crm-catalog-pages" aria-label="Страницы товаров"><button disabled={current===1} onClick={()=>setPage(current-1)}>«</button>{Array.from({length:pages},(_,i)=><button key={i} aria-current={current===i+1?'page':undefined} onClick={()=>setPage(i+1)}>{i+1}</button>)}<button disabled={current===pages} onClick={()=>setPage(current+1)}>»</button></nav></section><div className="crm-footer">CRM AplTech Казахстан (1.00) © 2026</div></div>;
}

type DrawerAction = 'priority' | 'weight' | 'error' | 'appeal' | 'resolve' | null;

export function ProductDrawer(props: ScreenProps & { productId: string; onClose: () => void; editProduct: (id:string)=>void }) {
  const { state, actor, productId, dispatch, onClose } = props;
  const product = state.products.find(item => item.id === productId);
  const [editing, setEditing] = useState(false);
  const [rework,setRework]=useState(false);
  const [infoTab,setInfoTab]=useState('Инфо');
  const [action, setAction] = useState<DrawerAction>(null);
  const [reason, setReason] = useState('');
  const [priority, setPriority] = useState<Priority>(product?.priority ?? 'Normal');
  const [weight, setWeight] = useState(product?.weightOverride?.toString() ?? '');
  const [automaticWeight, setAutomaticWeight] = useState(product?.weightOverride === undefined);
  const [critical, setCritical] = useState(false);
  const [issueId, setIssueId] = useState('');
  const [cancelError, setCancelError] = useState(true);
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [image, setImage] = useState(product?.image ?? '');
  const [supplier, setSupplier] = useState(product?.supplier ?? '');
  const [complexity, setComplexity] = useState<Complexity>(product?.complexity ?? 'easy');
  const [published, setPublished] = useState(product?.published ?? false);
  const [countPlan, setCountPlan] = useState(false);
  useEffect(() => {
    if (!product) return;
    setName(product.name); setDescription(product.description); setImage(product.image); setSupplier(product.supplier); setComplexity(product.complexity); setPublished(product.published); setPriority(product.priority); setWeight(product.weightOverride?.toString() ?? ''); setAutomaticWeight(product.weightOverride === undefined); setCountPlan(false);
  }, [productId, product?.version, product?.priority, product?.weightOverride]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); if(rework) setRework(false); else if (action) setAction(null); else if (editing) setEditing(false); else onClose(); } };
    document.addEventListener('keydown', listener);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', listener); document.body.style.overflow = previous; };
  }, [onClose, editing, action, rework]);
  useEffect(() => { if (action) document.getElementById('pdp-action-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [action, issueId]);
  if (!product) return null;
  const relatedTickets = state.tickets.filter(ticket => ticket.productIds.includes(product.id));
  const activeTickets = relatedTickets.filter(ticket => ticket.status !== 'completed');
  const productIssues = state.issues.filter(issue => issue.productId === product.id && issue.status !== 'cancelled');
  const contentChanged = name.trim() !== product.name || description.trim() !== product.description || image.trim() !== product.image || supplier.trim() !== product.supplier || complexity !== product.complexity || published !== product.published;
  const openAction = (value: DrawerAction, id = '') => { setAction(value); setReason(''); setIssueId(id); setCritical(false); setCancelError(true); };
  const save = (event: FormEvent) => {
    event.preventDefault();
    const saved = dispatch({ type: 'edit_product', productId, changes: { name: name.trim(), description: description.trim(), image: image.trim(), supplier: supplier.trim(), complexity, published }, countPlan: countPlan && activeTickets.length === 0 });
    if (saved) { setEditing(false); setCountPlan(false); }
  };
  const submitAction = (event: FormEvent) => {
    event.preventDefault();
    let accepted = false;
    if (action === 'priority') accepted = dispatch({ type: 'set_priority', productIds: [productId], priority, reason });
    if (action === 'weight') accepted = dispatch({ type: 'set_weight', productId, weight: automaticWeight ? undefined : Number(weight), reason });
    if (action === 'error') accepted = dispatch({ type: 'mark_error', productId, reason, critical });
    if (action === 'appeal') accepted = dispatch({ type: 'appeal_error', issueId, reason });
    if (action === 'resolve') accepted = dispatch({ type: 'resolve_error', issueId, cancel: cancelError, reason });
    if (accepted) { setAction(null); setReason(''); }
  };
  return <>
    <div className="crm-drawer-overlay" onClick={onClose} aria-hidden="true"/>
    <section className="crm-drawer" role="dialog" aria-modal="true" aria-label={`Карточка товара ${product.partNumber}`}>
      <button className="crm-drawer-close" onClick={onClose} aria-label="Закрыть карточку">×</button>
      <h1>{editing ? 'Редактирование товара' : 'Информация о товаре'}</h1>
      {editing ? <form onSubmit={save}>
        <div className="crm-edit-preview">{name}</div>
        <div className="crm-product-edit-image-wrap"><ProductImage product={{ ...product, image }} className="crm-product-edit-image"/><div className="crm-small crm-muted">Part number: <strong className="crm-bold">{product.partNumber}</strong><br/>Автор после сохранения: {actor.name}</div></div>
        <div className="crm-form-grid">
          <div className="crm-field crm-span2"><label htmlFor="pdp-name" className="crm-required">Наименование</label><input id="pdp-name" value={name} onChange={event => setName(event.target.value)} required maxLength={260}/></div>
          <div className="crm-field crm-span2"><label htmlFor="pdp-description" className="crm-required">Короткое описание</label><textarea id="pdp-description" value={description} onChange={event => setDescription(event.target.value)} required maxLength={4000}/></div>
          <div className="crm-field crm-span2"><label htmlFor="pdp-image">Изображение</label><input id="pdp-image" value={image} onChange={event => setImage(event.target.value)} placeholder="URL изображения или /assets/product-photo.jpg"/><span className="crm-field-hint">Поле изображения обязательно для публикации. Демонстрационная картинка: /assets/product-photo.jpg.</span></div>
          <div className="crm-field"><label htmlFor="pdp-supplier">Поставщик</label><input id="pdp-supplier" value={supplier} onChange={event => setSupplier(event.target.value)} maxLength={180}/></div>
          <div className="crm-field"><label htmlFor="pdp-complexity">Сложность карточки</label><select id="pdp-complexity" value={complexity} onChange={event => setComplexity(event.target.value as Complexity)}><option value="easy">Лёгкая</option><option value="medium">Средняя</option><option value="complex">Сложная</option></select></div>
          <label className="crm-check crm-span2"><input type="checkbox" checked={published} onChange={event => setPublished(event.target.checked)}/>Опубликовать карточку</label>
        </div>
        <div className="crm-edit-note">{activeTickets.length > 0 ? <>У товара есть открытый запрос. WU за запрос начислятся после его завершения; сохранение карточки обновляет контент и последнего автора.</> : <><label className="crm-check"><input type="checkbox" checked={countPlan} onChange={event => setCountPlan(event.target.checked)}/>Учесть как завершённую плановую работу</label><p className="crm-tiny crm-mt8">Начисление {wu(getProductBaseWU({ ...product, complexity }, state.settings))} WU без бонуса запроса. Используйте только при завершении отдельной плановой операции.</p></>}</div>
        {!contentChanged && <p className="crm-note crm-mt16">Измените контент, чтобы сохранить новую версию карточки.</p>}
        <div className="crm-form-actions"><button type="button" className="crm-btn crm-btn-soft" onClick={() => setEditing(false)}>Отмена</button><button type="submit" className="crm-btn crm-btn-primary" disabled={!contentChanged}>Сохранить карточку</button></div>
      </form> : <>
        <div className="crm-pdp-hero"><div className="crm-pdp-photo-column"><a className="crm-pdp-photo" href={'#products/'+product.id+'?edit=1'} target="_blank" rel="noopener" aria-label="Открыть PDP товара"><ProductImage product={product} className="crm-pdp-main-image"/></a>{actor.role==='manager'&&<button className="crm-btn crm-btn-primary crm-rework-button" onClick={()=>setRework(true)}>Отправить на доработку</button>}</div><div><h2 className="crm-pdp-title">{product.name}</h2><div className="crm-mt16"><span className={`crm-tag crm-status-pill ${product.published ? 'crm-tag-success' : ''}`}>{product.stock>0?'В наличии':'Нет в наличии'}</span></div><div className="crm-pdp-price-label">Цена на сайте (Стандартная)</div><div className="crm-pdp-price">{money(product.price)} тг.</div><div className="crm-mt16"><a className="crm-btn crm-btn-icon" href={'#products/'+product.id+'?edit=1'} target="_blank" rel="noopener" aria-label="Редактировать карточку"><EditIcon/></a></div></div></div>
        <table className="crm-supplier-grid"><thead><tr><th>Поставщик</th><th>Нал</th><th>Рез</th><th>Ожид</th><th>Входная</th><th>Актуальность</th></tr></thead><tbody><tr><td>{product.supplier || 'Не указан'}</td><td>{product.stock}</td><td>{String(product.pdp?.reserve??0)}</td><td>{String(product.pdp?.await??0)}</td><td>{money(Number(product.pdp?.incomingPrice??Math.round(product.price/1.14)))}</td><td>{formatDate(product.lastEditedAt)}</td></tr></tbody></table>
        <div className="crm-pdp-description"><h3>Короткое описание</h3><div className="crm-soft-box">{product.description || 'Описание пока не заполнено'}</div></div>

        {action && <form id="pdp-action-form" className="crm-inline-form" onSubmit={submitAction}>
          <h3>{({ priority: 'Приоритет товара', weight: 'Индивидуальный вес карточки', error: 'Зафиксировать ошибку', appeal: 'Оспорить ошибку', resolve: 'Решение по ошибке' })[action]}</h3>
          {action === 'priority' && <><div className="crm-field crm-mb16"><label htmlFor="pdp-priority">Новый приоритет</label><select id="pdp-priority" value={priority} onChange={event => setPriority(event.target.value as Priority)}>{PRIORITIES.map(value => <option key={value}>{value}</option>)}</select></div><p className="crm-note crm-mb16">Открытые запросы этого товара сразу наследуют новый приоритет. Завершённые начисления сохраняют прежнее правило.</p></>}
          {action === 'weight' && <><label className="crm-check crm-mb16"><input type="checkbox" checked={automaticWeight} onChange={event => setAutomaticWeight(event.target.checked)}/>Рассчитывать по сложности и приоритету</label>{!automaticWeight && <div className="crm-field crm-mb16"><label htmlFor="pdp-weight" className="crm-required">Вес, WU</label><input type="number" id="pdp-weight" value={weight} min="0.01" max="10000" step="0.01" onChange={event => setWeight(event.target.value)} required/></div>}<p className="crm-note crm-mb16">Изменение действует для будущих операций. История начислений не пересчитывается.</p></>}
          {action === 'error' && <><div className="crm-error-box crm-small crm-mb16">Сразу после отметки {actorName(product.lastEditorId)} получит −{wu(state.settings.qualityPenaltyPP)} п.п. KPI за версию {product.version}. Автор сможет оспорить ошибку.</div><label className="crm-check crm-mb16"><input type="checkbox" checked={critical} onChange={event => setCritical(event.target.checked)}/>Критическая ошибка</label></>}
          {action === 'appeal' && <p className="crm-note crm-mb16">Штраф остаётся видимым до решения руководителя. Если ошибка отменена, KPI восстанавливается.</p>}
          {action === 'resolve' && <div className="crm-field crm-mb16"><label htmlFor="pdp-error-resolution">Решение руководителя</label><select id="pdp-error-resolution" value={cancelError ? 'cancel' : 'keep'} onChange={event => setCancelError(event.target.value === 'cancel')}><option value="cancel">Отменить ошибку и восстановить KPI</option><option value="keep">Подтвердить ошибку</option></select></div>}
          <div className="crm-field"><label htmlFor="pdp-reason" className="crm-required">{action === 'appeal' ? 'Причина оспаривания' : 'Причина'}</label><textarea id="pdp-reason" value={reason} onChange={event => setReason(event.target.value)} required minLength={3} maxLength={1500} placeholder={action === 'error' ? 'Опишите конкретную ошибку в карточке' : 'Укажите основание изменения'}/></div><div className="crm-form-actions"><button type="button" className="crm-btn crm-btn-soft" onClick={() => setAction(null)}>Отмена</button><button type="submit" className={`crm-btn ${action === 'error' ? 'crm-btn-danger' : 'crm-btn-primary'}`}>{action === 'error' ? 'Зафиксировать ошибку' : action === 'appeal' ? 'Отправить оспаривание' : action === 'resolve' ? 'Сохранить решение' : 'Сохранить изменение'}</button></div>
        </form>}
        <div className="crm-tabs crm-reference-info-tabs">{['Инфо','Стоимость','Характеристики'].map(tab=><button key={tab} className={'crm-tab '+(infoTab===tab?'active':'')} onClick={()=>setInfoTab(tab)}>{tab}</button>)}</div>{infoTab==='Стоимость'&&<div className="crm-soft-box crm-pdp-info"><div>Клиентская цена: {money(product.price)} тг.</div><div>Процент наценки: {String(product.pdp?.markup??14)}%</div><div>Входная цена: {money(Number(product.pdp?.incomingPrice??Math.round(product.price/1.14)))} тг.</div></div>}{infoTab==='Характеристики'&&<div className="crm-soft-box crm-pdp-info"><div>Тип устройства: {String(product.pdp?.device||'Не задано')}</div><div>Вес в упаковке: {String(product.pdp?.weight||'Не задано')}</div><div>Габариты: {[product.pdp?.length,product.pdp?.width,product.pdp?.height].filter(Boolean).join(' × ')||'Не задано'}</div></div>}{infoTab==='Инфо'&&<><h3 className="crm-drawer-section-title">Основная информация</h3><div className="crm-soft-box crm-pdp-info"><div className="crm-info-row"><span>Направление</span><span className="crm-info-dots"/><span>{pdpValue(product,'area')}</span></div><div className="crm-info-row"><span>Категория</span><span className="crm-info-dots"/><span>{pdpValue(product,'category')}</span></div><div className="crm-info-row"><span>Вендор</span><span className="crm-info-dots"/><span>{pdpValue(product,'vendor')}</span></div><div className="crm-info-row"><span>Гарантия</span><span className="crm-info-dots"/><span>{String(product.pdp?.warranty||'Нет гарантии')}</span></div><div className="crm-info-row"><span>Product ID</span><span className="crm-info-dots"/><span>{product.id}</span></div><div className="crm-info-row"><span>Part number</span><span className="crm-info-dots"/><span>{product.partNumber}</span></div><div className="crm-info-row"><span>Сложность</span><span className="crm-info-dots"/><span>{COMPLEXITIES[product.complexity]}</span></div><div className="crm-info-row"><span>На складе</span><span className="crm-info-dots"/><span>{product.stock}</span></div></div></>}
        <div className="crm-content-strip"><div className="crm-content-top"><h3>Контент</h3><PriorityTag value={product.priority}/></div><div className="crm-flex crm-between crm-wrap"><span className="crm-small">{wu(getProductBaseWU(product, state.settings))} WU · {COMPLEXITIES[product.complexity]}</span><span className="crm-tiny crm-muted">{product.weightOverride === undefined ? 'Вес по правилам' : 'Индивидуальный вес'}</span></div><div className="crm-content-meta crm-mt8">Последний автор: {actorName(product.lastEditorId)} · v{product.version}<br/>{formatDate(product.lastEditedAt)}</div><div className="crm-content-actions">
          {actor.role === 'manager' && <span className="crm-small crm-muted">Запрос на доработку создаётся кнопкой рядом с фото товара.</span>}
          {actor.role === 'lead' && <><button className="crm-btn crm-btn-soft" onClick={() => openAction('priority')}>Изменить приоритет</button><button className="crm-btn crm-btn-soft" onClick={() => openAction('weight')}>Изменить вес</button></>}
          {actor.role === 'specialist' && <button className="crm-btn crm-btn-primary" onClick={()=>props.editProduct(product.id)}>Редактировать контент</button>}
        </div></div>
        {relatedTickets.length > 0 && <><h3 className="crm-drawer-section-title">Связанные запросы</h3><div className="crm-soft-box">{relatedTickets.map(ticket => <button className="crm-linked-ticket" key={ticket.id} onClick={() => props.openTicket(ticket.id)}><span>{ticket.id} · {ticket.batch ? `Список из ${ticket.productIds.length} товаров` : product.partNumber}</span><span className="crm-tag">{STATUS_NAMES[ticket.status]}</span></button>)}</div></>}
        {productIssues.length > 0 && <><h3 className="crm-drawer-section-title">Ошибки и оспаривания</h3>{productIssues.map(issue => <div className="crm-quality-card" key={issue.id}><div className="crm-flex crm-between crm-wrap"><strong className="crm-small">{issue.id} · {actorName(issue.authorId)}</strong><span className={`crm-tag ${issue.status === 'appealed' ? 'crm-tag-warning' : 'crm-tag-error'}`}>{issue.status === 'appealed' ? 'Оспаривается' : `−${wu(issue.penaltyPP)} п.п.`}</span></div><p>{issue.reason}</p><span className="crm-tiny crm-muted">Версия {issue.version} · {formatDate(issue.at)}</span>{issue.appeal && <p className="crm-soft-box">Оспаривание: {issue.appeal}</p>}<div className="crm-content-actions">{issue.authorId === actor.id && issue.status === 'active' && <button className="crm-btn crm-btn-soft crm-btn-sm" onClick={() => openAction('appeal', issue.id)}>Оспорить</button>}{actor.role === 'lead' && <button className="crm-btn crm-btn-soft crm-btn-sm" onClick={() => openAction('resolve', issue.id)}>Рассмотреть ошибку</button>}</div></div>)}</>}
      </>}
    </section>
    {rework&&<RequestForm {...props} fixedProduct initialProductId={productId} onClose={()=>setRework(false)} onCreated={()=>setRework(false)}/>}
  </>;
}
