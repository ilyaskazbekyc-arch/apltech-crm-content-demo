export type Role = 'manager' | 'specialist' | 'lead';
export type View = 'products' | 'tickets' | 'analytics' | 'settings';
export type Priority = 'Critical' | 'High' | 'Normal' | 'Low';
export type Complexity = 'easy' | 'medium' | 'complex';
export type RequestKind = 'image' | 'description' | 'remove-distributor' | 'split' | 'publish';
export interface Actor { id: string; name: string; role: Role }
export interface Product { id: string; name: string; partNumber: string; description: string; image: string; price: number; supplier: string; stock: number; priority: Priority; complexity: Complexity; lastEditorId: string; lastEditedAt: number; version: number; published: boolean; weightOverride?: number; splitFromId?: string; splitChildIds?: string[] }
export interface HistoryEvent { id: string; at: number; actorId: string; text: string }
export interface Pause { start: number; end?: number; reason: string }
export interface BatchItem { productId: string; completedAt?: number; authorId?: string }
export interface Ticket {
  id: string; kind: RequestKind; productIds: string[]; newProduct?: { partNumber: string; source: string; name?: string }; priority: Priority;
  source: string; description: string; createdAt: number; createdBy: string; status: 'queued' | 'in_progress' | 'waiting_manager' | 'completed';
  assigneeId?: string; acknowledgedBy: string[]; claimCycleStartedAt: number; firstClaimedAt?: number; claimedAt?: number;
  responseBreached: boolean; executionBreached: boolean; originalDueAt?: number; dueAt?: number; pauses: Pause[];
  batch: boolean; items: BatchItem[]; delay?: { at: number; newDueAt: number; reason: string; eligible: boolean };
  managerQuestion?: string; managerReply?: string; completedAt?: number; history: HistoryEvent[];
}
export interface Operation { id: string; ticketId?: string; productIds: string[]; authorId: string; at: number; baseWU: number; multiplier: number; totalWU: number; source: 'plan' | 'request'; ruleSnapshot: string }
export interface QualityIssue { id: string; productId: string; ticketId?: string; authorId: string; reporterId: string; at: number; version: number; reason: string; penaltyPP: number; critical: boolean; status: 'active' | 'appealed' | 'cancelled'; appeal?: string }
export interface SlaPenalty { ticketId: string; at: number; target: 'team' | 'employee'; employeeId?: string; cause: 'response' | 'execution'; penaltyPP: number }
export interface Notification { id: string; recipientId: string; at: number; title: string; message: string; ticketId?: string; read: boolean; requiresAck: boolean }
export interface Settings { responseMinutes: number; warningMinutes: number; executionMinutes: number; slaBonus: number; slaPenaltyPP: number; qualityPenaltyPP: number; targetWU: number; workedDays: number; productivityCap: number; criticalGate: number; newProductPriority: Priority; priorityRates: Record<Priority,number>; complexityRates: Record<Complexity,number>; requestWeights: Record<RequestKind,number>; holidays: string[] }
export interface DemoState { schema: 1; revision: number; products: Product[]; tickets: Ticket[]; operations: Operation[]; issues: QualityIssue[]; slaPenalties: SlaPenalty[]; notifications: Notification[]; settings: Settings }
export type Action =
 | { type: 'create_ticket'; kind: RequestKind; productIds: string[]; source: string; description: string; newProduct?: {partNumber:string;source:string;name?:string} }
 | { type: 'ack_ticket'; ticketId: string }
 | { type: 'claim_ticket'; ticketId: string; promisedDueAt?: number }
 | { type: 'complete_ticket'; ticketId: string }
 | { type: 'complete_item'; ticketId: string; productId: string }
 | { type: 'return_manager'; ticketId: string; reason: string; question: string; newDueAt: number }
 | { type: 'manager_reply'; ticketId: string; reply: string }
 | { type: 'report_delay'; ticketId: string; reason: string; newDueAt: number }
 | { type: 'reopen_ticket'; ticketId: string; reason: string }
 | { type: 'edit_product'; productId: string; changes: Partial<Pick<Product,'name'|'description'|'image'|'supplier'|'published'|'complexity'>>; countPlan?: boolean }
 | { type: 'create_product'; name: string; partNumber: string; description: string; source: string; ticketId?: string; complexity: Complexity; publishNow?: boolean; countPlan?: boolean }
 | { type: 'set_priority'; productIds: string[]; priority: Priority; reason: string }
 | { type: 'set_weight'; productId: string; weight?: number; reason: string }
 | { type: 'mark_error'; productId: string; ticketId?: string; reason: string; critical?: boolean }
 | { type: 'appeal_error'; issueId: string; reason: string }
 | { type: 'resolve_error'; issueId: string; cancel: boolean; reason: string }
 | { type: 'save_settings'; settings: Settings }
 | { type: 'read_notification'; notificationId: string }
 | { type: 'tick' };
export interface EmployeeMetrics { actorId: string; planWU: number; cardWU: number; requestWU: number; qualityPP: number; slaPP: number; kpi: number; completed: number }
export interface Analytics { planWU: number; cardWU: number; requestWU: number; totalWU: number; qualityPP: number; slaPP: number; kpi: number; completed: number; errors: number; responseOnTime: number; responseTotal: number; executionOnTime: number; executionTotal: number; employees: EmployeeMetrics[] }
export interface ScreenProps { state: DemoState; actor: Actor; now: number; dispatch: (action: Action) => boolean; openTicket: (id:string) => void; openProduct: (id:string) => void; requestProduct: (id:string) => void }
