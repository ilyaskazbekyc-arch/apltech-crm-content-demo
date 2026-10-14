import { useState } from 'react';
import { Check } from 'lucide-react';
import type { ScreenProps } from './types';
import { ProductPdp } from './ProductPdp';

export function BulkEditor(props: ScreenProps & { initialIds?: string[]; onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>(() => [...new Set(props.initialIds ?? [])]);
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const ids = selected.filter(id => props.state.products.some(p => p.id === id));
  const product = props.state.products.find(p => p.id === ids[index]);
  if (!ids.length) return <section className="crm-panel crm-panel-pad"><h1>Выберите товары</h1><p>Отметьте карточки в разделе «Товары» и нажмите «Массовое редактирование».</p><button className="crm-btn crm-btn-primary" onClick={props.onClose}>Вернуться к товарам</button></section>;
  if (!product) return <section className="crm-panel crm-panel-pad crm-bulk-finish"><Check size={34}/><h1>Список обработан</h1><p>Сохранено: {saved.length} · Пропущено: {skipped.length}</p><div className="crm-flex crm-wrap">{skipped.length > 0 && <button className="crm-btn crm-btn-primary" onClick={() => { setSelected(skipped); setSkipped([]); setIndex(0); }}>Обработать пропущенные</button>}<button className="crm-btn crm-btn-soft" onClick={props.onClose}>Вернуться к товарам</button></div></section>;
  return <ProductPdp key={product.id} {...props} productId={product.id} onClose={props.onClose} sequence={{index,total:ids.length,onPrevious:()=>setIndex(i=>i-1),onSkip:()=>{setSkipped(prev=>saved.includes(product.id)?prev:[...new Set([...prev,product.id])]);setIndex(i=>i+1)},onSaved:()=>{setSaved(prev=>[...new Set([...prev,product.id])]);setSkipped(prev=>prev.filter(id=>id!==product.id));setIndex(i=>i+1)}}}/>;
}
