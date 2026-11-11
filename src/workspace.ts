import type {DemoState} from './types';
export const TICKET_WORKSPACE_VERSION=2;
export function clearTicketWorkspace(state:DemoState):DemoState {
 return {...state,revision:state.revision+1,ticketWorkspaceVersion:TICKET_WORKSPACE_VERSION,tickets:[],notifications:state.notifications.filter(n=>!n.ticketId),operations:state.operations.filter(o=>!o.ticketId),issues:state.issues.filter(i=>!i.ticketId),slaPenalties:[]};
}

export function migrateTicketWorkspace(state:DemoState):DemoState {
 if(state.ticketWorkspaceVersion===TICKET_WORKSPACE_VERSION)return state;
 const clean=clearTicketWorkspace(state);
 return {...clean,settings:{...clean.settings,responseMinutes:3,warningMinutes:4,executionMinutes:5,requestWeights:{...clean.settings.requestWeights,description:1,merge:1}}};
}
