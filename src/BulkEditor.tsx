import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Layers } from 'lucide-react';
import type { Complexity, ScreenProps } from './types';
import { ACTORS } from './seed';
import { formatDate, getProductBaseWU } from './engine';
import { number } from './ui-utils';

export function BulkEditor(props: ScreenProps & { initialIds?: string[]; createRequest: (ids: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>(props.initialIds ?? []);
  const [editing, setEditing] = useState(false);
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [supplier, setSupplier] = useState('');
  const [complexity, setComplexity] = useState<Complexity>('easy');
  const [published, setPublished] = useState(false);
  const [countPlan, setCountPlan] = useState(false);
  const [markItem, setMarkItem] = useState(true);
  const ids = selected.filter(id => props.state.products.some(p => p.id === id));
  const product = props.state.products.find(p => p.id === ids[index]);
  const active = props.state.tickets.filter(t => product && t.productIds.includes(product.id) && t.status !== 'completed');
  const ownBatch = active.find(t => t.batch && t.status === 'in_progress' && t.assigneeId === props.actor.id);
  useEffect(() => {
    if (!product) return;
    setName(product.name); setDescription(product.description); setImage(product.image);
    setSupplier(product.supplier); setComplexity(product.complexity); setPublished(product.published);
    setCountPlan(false); setMarkItem(true);
  }, [product?.id, product?.version]);
  function begin() { setSaved([]); setSkipped([]); setIndex(0); setEditing(true); }
  function advance() { setIndex(i => i + 1); }
  function save(e: React.FormEvent) {
    e.preventDefault(); if (!product) return;
    const changes = { name: name.trim(), description: description.trim(), image: image.trim(), supplier: supplier.trim(), complexity, published };
    if (!props.dispatch({ type: 'edit_product', productId: product.id, changes, countPlan: countPlan && active.length === 0 })) return;
    if (ownBatch && markItem && !props.dispatch({ type: 'complete_item', ticketId: ownBatch.id, productId: product.id })) return;
    setSaved(prev => [...new Set([...prev, product.id])]); setSkipped(prev => prev.filter(id => id !== product.id)); advance();
  }
  const changed = product && (name.trim() !== product.name || description.trim() !== product.description || image.trim() !== product.image || supplier.trim() !== product.supplier || complexity !== product.complexity || published !== product.published);
  if (!editing) return <>
    <div className="crm-title-row"><div><h1>Массовое редактирование</h1><p className="crm-small crm-muted">Выберите несколько карточек и обработайте их по очереди.</p></div><span className="crm-tag">{ids.length} выбрано</span></div>
    <div className="crm-bulk-toolbar crm-panel crm-panel-pad"><div className="crm-flex crm-wrap"><button className="crm-btn crm-btn-soft" onClick={() => setSelected(ids.length === props.state.products.length ? [] : props.state.products.map(p => p.id))}>{ids.length === props.state.products.length ? 'Снять выделение' : 'Выбрать все'}</button>{props.actor.role === 'specialist' && <button className="crm-btn crm-btn-primary" disabled={!ids.length} onClick={begin}><Layers size={16}/>Редактировать поэтапно · {ids.length}</button>}{props.actor.role === 'manager' && <button className="crm-btn crm-btn-primary" disabled={!ids.length} onClick={() => props.createRequest(ids)}>Создать тикет на выбранные</button>}</div><p className="crm-small crm-muted">{props.actor.role === 'specialist' ? 'Каждая карточка сохраняется отдельно. Можно пропустить товар и вернуться к нему.' : props.actor.role === 'manager' ? 'Менеджер выбирает список и передаёт его специалисту через общий тикет.' : 'Редактирование контента доступно специалистам. Приоритеты и веса меняются в карточке товара.'}</p></div>
    <section className="crm-panel crm-panel-pad"><div className="crm-table-wrap"><table className="crm-table"><thead><tr><th><input type="checkbox" aria-label="Выбрать все карточки для редактирования" checked={ids.length > 0 && ids.length === props.state.products.length} onChange={e => setSelected(e.target.checked ? props.state.products.map(p => p.id) : [])}/></th><th>Карточка товара</th><th>Приоритет / вес</th><th>Последний автор</th><th>Запрос</th></tr></thead><tbody>{props.state.products.map(p => { const ticket = props.state.tickets.find(t => t.productIds.includes(p.id) && t.status !== 'completed'); return <tr key={p.id} className={ids.includes(p.id) ? 'crm-bulk-selected' : ''}><td><input type="checkbox" aria-label={'Выбрать для редактирования ' + p.partNumber} checked={ids.includes(p.id)} onChange={e => setSelected(e.target.checked ? [...selected, p.id] : selected.filter(id => id !== p.id))}/></td><td><div className="crm-flex"><img src={p.image} alt="" className="crm-bulk-thumb"/><div><button className="crm-link" onClick={() => props.openProduct(p.id)}>{p.partNumber}</button><p className="crm-small">{p.name}</p><span className="crm-small crm-muted">Product ID {p.id}</span></div></div></td><td><span className="crm-tag">{p.priority}</span><p className="crm-small">{number(getProductBaseWU(p, props.state.settings))} WU</p></td><td><div>{ACTORS.find(a => a.id === p.lastEditorId)?.name}</div><span className="crm-small crm-muted">v{p.version} · {formatDate(p.lastEditedAt)}</span></td><td>{ticket ? <button className="crm-link" onClick={() => props.openTicket(ticket.id)}>{ticket.id}</button> : <span className="crm-muted">Плановая работа</span>}</td></tr>; })}</tbody></table></div></section>
  </>;
  if (!product) return <section className="crm-panel crm-panel-pad crm-bulk-finish"><Check size={34}/><h1>Список обработан</h1><p>Сохранено: {saved.length} · Пропущено: {skipped.length}</p><p className="crm-small crm-muted">Карточки и авторы обновлены. Результаты запросов начисляются при завершении тикета.</p><div className="crm-flex crm-wrap">{skipped.length > 0 && <button className="crm-btn crm-btn-primary" onClick={() => { setSelected(skipped); setSkipped([]); setIndex(0); }}>Обработать пропущенные</button>}<button className="crm-btn crm-btn-soft" onClick={() => setEditing(false)}>Вернуться к списку</button></div></section>;
  return <>
    <div className="crm-title-row"><div><h1>Поэтапное редактирование</h1><p className="crm-small crm-muted">Карточка {index + 1} из {ids.length} · Сохранено {saved.length} · Пропущено {skipped.length}</p></div><button className="crm-btn crm-btn-soft" onClick={() => setEditing(false)}><ArrowLeft size={16}/>К выбору карточек</button></div>
    <div className="crm-progress crm-bulk-progress"><span style={{ width: `${index / ids.length * 100}%` }}/></div>
    <div className="crm-bulk-layout"><aside className="crm-panel crm-panel-pad crm-bulk-steps"><h3>Выбранные карточки</h3>{ids.map((id, i) => { const p = props.state.products.find(p => p.id === id)!; return <button key={id} className={'crm-bulk-step ' + (i === index ? 'active' : '')} onClick={() => setIndex(i)}><span>{i + 1}. {p.partNumber}</span><span>{saved.includes(id) ? '✓' : skipped.includes(id) ? 'Пропущено' : ''}</span></button>; })}</aside>
      <section className="crm-panel crm-panel-pad"><div className="crm-flex crm-between"><div><h2>{product.partNumber}</h2><p className="crm-small crm-muted">Product ID {product.id} · v{product.version}</p></div><span className="crm-tag">{product.priority}</span></div>
        <form onSubmit={save}><label className="crm-field">Наименование<input className="crm-input" required value={name} onChange={e => setName(e.target.value)}/></label><label className="crm-field">Описание<textarea className="crm-input" required rows={5} value={description} onChange={e => setDescription(e.target.value)}/></label><div className="crm-form-grid"><label className="crm-field">Изображение<input className="crm-input" value={image} onChange={e => setImage(e.target.value)}/></label><label className="crm-field">Поставщик<input className="crm-input" value={supplier} onChange={e => setSupplier(e.target.value)}/></label><label className="crm-field">Сложность<select className="crm-input" value={complexity} onChange={e => setComplexity(e.target.value as Complexity)}><option value="easy">Лёгкая</option><option value="medium">Средняя</option><option value="complex">Сложная</option></select></label><label className="crm-check"><input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)}/>Опубликовать карточку</label></div>
          {active.length > 0 ? <div className="crm-soft-box"><p className="crm-small">Связанный запрос: {active.map(t => t.id).join(', ')}. Сохранение обновит автора; WU начислятся за результат тикета.</p>{ownBatch && <label className="crm-check"><input type="checkbox" checked={markItem} onChange={e => setMarkItem(e.target.checked)}/>Отметить эту строку готовой в {ownBatch.id}</label>}</div> : <label className="crm-check"><input type="checkbox" checked={countPlan} onChange={e => setCountPlan(e.target.checked)}/>Учесть как завершённую плановую работу · {number(getProductBaseWU({ ...product, complexity }, props.state.settings))} WU</label>}
          <div className="crm-form-actions"><button className="crm-btn crm-btn-soft" type="button" disabled={index === 0} onClick={() => setIndex(i => i - 1)}><ArrowLeft size={16}/>Назад</button><button className="crm-btn crm-btn-soft" type="button" onClick={() => { setSkipped(prev => saved.includes(product.id) ? prev : [...new Set([...prev, product.id])]); advance(); }}>Пропустить</button><button className="crm-btn crm-btn-primary" type="submit" disabled={props.actor.role !== 'specialist' || (!changed && !ownBatch)}>{index === ids.length - 1 ? 'Сохранить и завершить' : 'Сохранить и далее'}<ArrowRight size={16}/></button></div>
        </form>
      </section>
    </div>
  </>;
}
