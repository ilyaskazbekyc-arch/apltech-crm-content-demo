import type { RequestKind, Priority } from './types';
export const REQUEST_LABELS: Record<RequestKind,string> = { image:'Исправить изображение', description:'Доработать карточку', 'remove-distributor':'Удалить дистрибьютора', split:'Разъединить карточку', publish:'Добавить / опубликовать товар' };
export const PRIORITY_LABELS: Priority[] = ['Critical','High','Normal','Low'];
export const number = (v:number) => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}).format(v);
export const localInput = (at:number) => new Date(at+5*3600000).toISOString().slice(0,16);
export const inputDate = (value:string) => new Date(value+'+05:00').getTime();
