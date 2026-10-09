import type {DemoState} from './types';
export const TICKET_WORKSPACE_VERSION=1;
export function clearTicketWorkspace(state:DemoState):DemoState {
 return {...state,revision:state.revision+1,ticketWorkspaceVersion:TICKET_WORKSPACE_VERSION,tickets:[],notifications:state.notifications.filter(n=>!n.ticketId),operations:state.operations.filter(o=>!o.ticketId),issues:state.issues.filter(i=>!i.ticketId),slaPenalties:[]};
}
