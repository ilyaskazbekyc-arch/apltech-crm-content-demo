import type { Product } from './types';
export const AREAS=['Компьютеры','Мониторы, LED панели и телевизоры','Серверное оборудование','Системы хранения данных','Бесперебойное питание','Активное сетевое оборудование','Пассивное сетевое оборудование','Принтеры и печатная техника','Сканеры','Компьютерные комплектующие','Телефония','Программное обеспечение (софт)','Расходные материалы','Конференц-оборудование','Фото и видео','Презентационное оборудование','Торгово-кассовое оборудование','Штрихкодирование','Мобильные устройства','Видеонаблюдение','Контроль доступа','Радиостанции (рации)','Компьютерная мебель','Аудиотехника','Умный дом','Бытовая Техника','Электротовары','Инструменты','Услуги','НА СОРТИРОВКУ','Игрушки','Бассейны и аксессуары','Автомобильные аксессуары'];
export const PUBLICATIONS=['Не опубликовано','Опубликовано','Удалено','Черновик','Забанен бренд'];
export const catalogValue=(p:Product,key:string)=>String(p.pdp?.[key]??({area:'Принтеры и печатная техника',category:'Аксессуары для печатной техники',vendor:'NO NAME',device:'Лента'} as Record<string,string>)[key]??'');
export function suppliers(p:Product):string[]{try{return [...p.supplier.split(' | ').filter(Boolean),...JSON.parse(String(p.pdp?.distributors||'[]')).map((d:{name:string})=>d.name).filter(Boolean)]}catch{return p.supplier.split(' | ').filter(Boolean)}}
export const publication=(p:Product)=>String(p.pdp?.publication??(p.published?'Опубликовано':'Черновик'));
export interface CatalogQuery {text:string;exact:boolean;area:string;category:string;status:string;vendors:string[];availability:string[];from:string;to:string;distributors:string[];author:string;date:string;extras:string[];device:string;width:string;sort:string}
export const EMPTY_QUERY:CatalogQuery={text:'',exact:false,area:'',category:'',status:'',vendors:[],availability:[],from:'',to:'',distributors:[],author:'',date:'',extras:[],device:'',width:'',sort:'default'};
export function filterProducts(products:Product[],q:CatalogQuery,now:number){
 const text=q.text.trim().toLocaleLowerCase('ru-RU');
 return products.filter(p=>{
   const terms=[p.name,p.description,catalogValue(p,'model'),p.partNumber,p.id,String(Number(p.id)+100000),catalogValue(p,'vendor')].map(v=>v.toLocaleLowerCase('ru-RU'));
   if(text&&(q.exact?!terms.some(v=>v===text):!text.split(/\s+/).every(token=>terms.some(v=>v.includes(token)))))return false;
   if(q.area&&catalogValue(p,'area')!==q.area||q.category&&catalogValue(p,'category')!==q.category||q.status&&publication(p)!==q.status||q.vendors.length&&!q.vendors.includes(catalogValue(p,'vendor')))return false;
   if(q.from&&p.price<Number(q.from)||q.to&&p.price>Number(q.to))return false;
   const availability=[...(p.stock>0?['В наличии']:['Нет в наличии']),...(p.pdp?.order?['Под заказ']:[]),...(p.pdp?.order&&!p.pdp?.replaceOrder?['Под заказ 12 дней']:[]),...(Number(p.pdp?.reserve)>0?['В резерве']:[]),...(Number(p.pdp?.await)>0?['Ожидается']:[])];
   if(q.availability.length&&!q.availability.some(v=>availability.includes(v)))return false;
   if(q.distributors.length&&!q.distributors.some(v=>suppliers(p).includes(v)))return false;
   if(q.author&&(p.pdp?.publishedBy??p.lastEditorId)!==q.author)return false;
   if(q.date){const at=Number(p.pdp?.publishedAt??p.lastEditedAt);const day=(n:number)=>new Date(n+5*3600000).toISOString().slice(0,10);const current=day(now),date=day(at);if(q.date==='Сегодня'&&date!==current||q.date==='Вчера'&&date!==day(now-86400000)||q.date==='В этом месяце'&&date.slice(0,7)!==current.slice(0,7)||q.date==='В этом году'&&date.slice(0,4)!==current.slice(0,4))return false;if(q.date==='На этой неделе'){const dateNow=new Date(now+5*3600000),offset=(dateNow.getUTCDay()+6)%7;if(date<day(now-offset*86400000)||date>current)return false}}
   if(q.device&&catalogValue(p,'device')!==q.device||q.width&&!p.name.includes(q.width+' мм'))return false;
   return q.extras.every(v=>v==='без изображений'?(!p.image || (p.pdp?.crmSample === true && p.pdp?.hasSourceImage === false)):v==='с ценой на сайте'?p.price>0&&p.pdp?.pricePublished!==false:v==='с непустыми дистрибьюторами'?suppliers(p).length>0:v==='с RRP ценой'?Number(p.pdp?.rrp)>0:v==='с акциями'?!!p.pdp?.promo:v==='выгружаются на Яндекс.Маркет'?p.pdp?.direct!==false:v==='синхронизированы'?!!p.pdp?.syncedAt:v==='созданы из заказа'?!!p.pdp?.fromOrder:v==='с плохой упаковкой'?!!p.pdp?.badPackaging:v==='с неактивными дистрибьюторами'?!!p.pdp?.inactiveDistributor:true);
 }).sort((a,b)=>q.sort==='priceAsc'?a.price-b.price:q.sort==='priceDesc'?b.price-a.price:q.sort==='name'?a.name.localeCompare(b.name,'ru'):0);
}
