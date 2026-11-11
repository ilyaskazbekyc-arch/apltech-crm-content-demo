import {useState} from 'react';
import {KpiGuide} from './KpiGuide';
import {AnalyticsScreen} from './Analytics';
import {ProductProfile} from './ProductProfile';
import type {ScreenProps} from './types';
export function Instructions(props:ScreenProps){
 const [tab,setTab]=useState<'guide'|'live'|'profiles'>('guide');const [profile,setProfile]=useState<string|null>(null);
 return <><h1>Инструкция · как это работает</h1><div className="crm-flex crm-wrap crm-queue-tabs">{([['guide','Правила работы'],['live','Операции демо · в реальном времени'],['profiles','Профили карточек']] as const).map(([id,label])=><button key={id} className={'crm-btn '+(tab===id?'crm-btn-primary':'crm-btn-soft')} onClick={()=>setTab(id)}>{label}</button>)}</div>{tab==='guide'?<KpiGuide settings={props.state.settings}/>:tab==='live'?<AnalyticsScreen {...props}/>:<section className="crm-panel crm-panel-pad"><h2>Сложность и приоритет карточек</h2><p>Профиль хранится в товаре. Изменять его может руководитель. Для объединения берётся наивысший приоритет выбранных товаров.</p>{props.state.products.map(p=><div key={p.id} className="crm-flex crm-between crm-soft-box"><span>{p.partNumber} · {p.priority} · {{easy:'Лёгкая',medium:'Средняя',complex:'Сложная'}[p.complexity]}</span><button className="crm-btn crm-btn-sm crm-btn-soft" onClick={()=>setProfile(p.id)}>Настроить</button></div>)}</section>}{profile&&<ProductProfile {...props} productId={profile} onClose={()=>setProfile(null)}/>}</>;
}
