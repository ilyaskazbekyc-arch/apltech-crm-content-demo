import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowLeftRight, ChevronDown, CircleAlert, Globe, History, Info, Link2, Pencil } from 'lucide-react';
import type { ScreenProps } from './types';
import './product-pdp-top.css';

type Props = ScreenProps & { productId: string; onClose: () => void };

function ReferenceField({ label, value, required, select, muted, wide, hint }: {
  label: ReactNode; value: string; required?: boolean; select?: boolean; muted?: boolean; wide?: boolean; hint?: string;
}) {
  return <label className={'crm-reference-field' + (wide ? ' is-wide' : '')}>
    <span className="crm-reference-field-label">{label}{required && <span className="crm-reference-required">*</span>}</span>
    <span className={'crm-reference-field-box' + (muted ? ' is-muted' : '')}>
      <input readOnly value={value} />
      {select && <span className="crm-reference-field-icons" aria-hidden="true">{!muted && <History size={13} />}<ChevronDown size={15} /></span>}
    </span>
    {hint && <span className="crm-reference-field-hint">{hint}</span>}
  </label>;
}

export function ProductPdpTop(props: Props) {
  const product = props.state.products.find(item => item.id === props.productId);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dismiss = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) menuRef.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menuRef.current) menuRef.current.open = false;
    };
    document.addEventListener('click', dismiss);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('click', dismiss); document.removeEventListener('keydown', escape); };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  if (!product) return <section className="crm-panel crm-panel-pad"><h1>Товар не найден</h1><button className="crm-btn crm-btn-soft crm-mt16" onClick={props.onClose}>Вернуться к товарам</button></section>;
  const data = product.pdp || {};
  const value = (key: string, fallback = '') => typeof data[key] === 'string' ? data[key] as string : fallback;
  const availability = value('availability', product.stock > 0 ? 'В наличии' : 'Нет в наличии');
  const inStock = availability === 'В наличии';
  const title = value('title', product.name);
  const sourceUrl = value('sourceUrl');
  const chooseAction = (error: boolean) => {
    if (menuRef.current) menuRef.current.open = false;
    if (error) props.reportProductError(product.id); else props.requestProduct(product.id);
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}${location.pathname}#products/${encodeURIComponent(product.id)}?edit=1`);
      setCopied(true);
    } catch { setCopied(false); }
  };

  return <div className="crm-reference-pdp">
    <nav className="crm-reference-crumbs" aria-label="Путь к товару">
      <span>Главная</span><span aria-hidden="true">›</span><button onClick={props.onClose}>Товары</button>
      {[value('area'), value('category'), value('vendor')].filter(Boolean).map((item, index) => <span className="crm-reference-crumb-part" key={`${item}-${index}`}><span aria-hidden="true">›</span><span>{item}</span></span>)}
      <span aria-hidden="true">›</span><strong>{product.partNumber}</strong>
    </nav>
    <div className="crm-reference-pdp-layout">
      <aside className="crm-reference-sections" aria-label="Разделы карточки">
        <span className="is-current" aria-current="page">Информация</span>
        {['Стоимость', 'Остатки', 'Характеристики', 'Медиа', 'Гарантия', 'Акции'].map(label => <span key={label} className="is-unavailable">{label}</span>)}
        <button onClick={props.onClose} className="crm-reference-back"><ArrowLeft size={13} />К списку товаров</button>
      </aside>

      <section className="crm-panel crm-reference-pdp-card" aria-label={`Карточка товара ${product.partNumber}`}>
        <div className="crm-reference-pdp-hero">
          <div className="crm-reference-pdp-photo"><img src={product.image} alt={title} /></div>
          <div className="crm-reference-pdp-summary">
            <div className="crm-reference-summary-top">
              <div className="crm-reference-product-meta"><span className={'crm-reference-availability ' + (inStock ? 'in-stock' : 'out-stock')}>{availability}</span>
                {value('createdLabel') && <span className="crm-reference-created">{value('createdLabel').startsWith('Добавлено') ? value('createdLabel') : `Добавлено ${value('createdLabel')}`} <Info size={12} aria-hidden="true" /></span>}
              </div>
              <details ref={menuRef} className="crm-reference-content-menu">
                <summary className="crm-btn crm-btn-primary">Отправить в контент <ChevronDown size={15} /></summary>
                <div className="crm-reference-content-menu-items">
                  <button type="button" onClick={() => chooseAction(false)}><Pencil size={16} />Отправить на доработку</button>
                  <button type="button" onClick={() => chooseAction(true)}><CircleAlert size={16} />Сообщить об ошибке</button>
                </div>
              </details>
            </div>
            <h1 className={'crm-reference-pdp-heading' + (data.synced ? ' is-synced' : '')}>{data.synced && <ArrowLeftRight size={22} aria-label="Товар синхронизирован" />}{title}</h1>
            <div className="crm-reference-publication"><ReferenceField label="Статус состояния" value={value('publication', product.published ? 'Опубликовано' : 'Не опубликовано')} select /></div>
            <div className="crm-reference-pdp-shortcuts">
              {sourceUrl && <a className="crm-btn crm-btn-icon" href={sourceUrl} target="_blank" rel="noreferrer" aria-label="Открыть исходную карточку в CRM" title="Открыть исходную карточку в CRM"><Globe size={19} /></a>}
              <button type="button" className="crm-btn crm-btn-icon" onClick={copyLink} aria-label="Скопировать ссылку на карточку демо" title="Скопировать ссылку на карточку демо"><Link2 size={19} /></button>
              {copied && <span className="crm-reference-copy-result" role="status">Ссылка скопирована</span>}
            </div>
          </div>
        </div>

        <h2 className="crm-reference-information-title">Основная информация</h2>
        <div className="crm-reference-information-grid">
          <ReferenceField label="Направление" value={value('area', 'Выберите')} required select />
          <ReferenceField label={<>Категория <small>!направление</small></>} value={value('category', 'Выберите')} required select />
          <ReferenceField label={<>Вендор <small>!направление</small></>} value={value('vendor', 'Выберите')} required select />
          <ReferenceField label="Линейка" value={value('line') || 'Выберите'} select muted />
          <ReferenceField label="Модель" value={value('model') || 'Выберите'} select muted />
          <div className="crm-reference-grid-spacer" aria-hidden="true" />
          <ReferenceField label="Справочник" value={value('manual') || 'Не выбран'} select wide hint="Можно выбрать конкретный документ справочника. Начните вводить название — список большой." />
          <ReferenceField label="Наименование" value={value('listName', product.name)} required />
          <ReferenceField label="Партномер" value={product.partNumber} required muted />
          <ReferenceField label="Внутренний артикул" value={value('internalArticle', product.id)} muted />
          <div className="crm-reference-grid-spacer" aria-hidden="true" />
          <label className="crm-reference-field is-wide"><span className="crm-reference-field-label">Номенклатура в CRM и 1С</span><textarea readOnly value={value('nomenclature')} placeholder="Номенклатура товара (добавляется при создании счета)" rows={3} /></label>
        </div>
      </section>
    </div>
  </div>;
}
