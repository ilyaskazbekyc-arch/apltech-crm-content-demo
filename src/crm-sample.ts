import sourceProducts from './crm-products-sample.json';
import type {DemoState,Product} from './types';

export const CRM_SAMPLE_VERSION=1;
export const CRM_SAMPLE_PRODUCTS=sourceProducts as Product[];
const legacySeedIds=new Set(Array.from({length:20},(_,i)=>String(526005+i)));

// Keep previous products for existing ticket and operation references.
// Import only missing source cards, never overwrite a user's demo edits.
export function migrateCrmSample(state:DemoState):DemoState {
 if(state.crmSampleVersion===CRM_SAMPLE_VERSION)return state;
 const existing=new Set(state.products.map(p=>p.id));
 const added=CRM_SAMPLE_PRODUCTS.filter(p=>!existing.has(p.id));
 return {...state,crmSampleVersion:CRM_SAMPLE_VERSION,revision:state.revision+1,
  products:[...structuredClone(added),...state.products]};
}

export function getCatalogProducts(products:Product[]):Product[]{
 return products.filter(p=>p.pdp?.crmSample||!legacySeedIds.has(p.id));
}
