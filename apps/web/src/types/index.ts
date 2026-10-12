// ---------------------------------------------------------------------------
// Deep-Tech Lab Inventory — Domain Types
// Mirrors the live API response shapes (apps/api) and Prisma enums.
// ---------------------------------------------------------------------------

export type Role = 'ADMIN' | 'STUDENT';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export type ItemNature = 'RETURNABLE' | 'CONSUMABLE';
export type TrackingMode = 'SERIALIZED' | 'BULK';
export type UnitStatus = 'AVAILABLE' | 'ALLOCATED' | 'UNAVAILABLE' | 'RETIRED';

export type RequestTarget = 'PERSONAL' | 'PROJECT';
export type DecisionStatus = 'PENDING' | 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED' | 'CANCELLED';
export type FulfilmentStatus = 'NOT_ISSUED' | 'PARTIALLY_ISSUED' | 'FULFILLED';
export type ReturnCondition = 'WORKING' | 'NEEDS_CHECKING' | 'NOT_WORKING';
export type MovementType = 'RECEIPT' | 'ISSUE' | 'RETURN' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'LOCATION_TRANSFER';
export type LocationType = 'LAB' | 'ROOM' | 'CABINET' | 'SHELF' | 'DRAWER' | 'BIN';

export interface UserProfile {
  id: string;
  collegeId: string;
  name: string;
  email: string | null;
  role: Role;
  status?: UserStatus;
  mustChangePassword: boolean;
  csrfToken?: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  _count?: { items: number };
}

export interface Location {
  id: string;
  name: string;
  type: LocationType;
  parentId: string | null;
  isActive: boolean;
  parent?: Location | null;
  children?: Location[];
  _count?: { balances: number; unitsHome: number };
}

export interface InventoryUnit {
  id: string;
  itemId?: string;
  assetCode: string;
  serialNumber?: string | null;
  status: UnitStatus;
  conditionNote: string | null;
  homeLocationId?: string | null;
  currentLocationId?: string | null;
}

export interface StockBalance {
  id: string;
  itemId?: string;
  locationId?: string;
  availableQuantity: number;
  allocatedQuantity: number;
  location?: { id: string; name: string };
}

export interface Item {
  id: string;
  name: string;
  model: string | null;
  description: string | null;
  categoryId: string;
  categoryName: string;
  nature: ItemNature;
  trackingMode: TrackingMode;
  unitOfMeasure: string;
  lowStockThreshold: number | null;
  defaultLocation?: string | null;
  defaultLocationId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string };
  units?: InventoryUnit[];
  balances?: StockBalance[];
  availableQuantity: number;
  totalQuantity: number;
  isLowStock: boolean;
}

export interface KitItem {
  id: string;
  kitId: string;
  itemId: string;
  quantity: number;
  item: Pick<Item, 'id' | 'name' | 'model' | 'nature' | 'trackingMode' | 'unitOfMeasure'>;
}

export interface Kit {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  items: KitItem[];
}

export interface RequestLine {
  id: string;
  requestId: string;
  itemId: string;
  requestedQty: number;
  approvedQty: number;
  issuedQty: number;
  rejectionReason: string | null;
  item: Pick<Item, 'id' | 'name' | 'nature' | 'trackingMode' | 'unitOfMeasure'>;
}

export interface LabRequest {
  id: string;
  requesterId: string;
  targetType: RequestTarget;
  projectId: string | null;
  purpose: string;
  expectedReturnDate: string | null;
  decisionStatus: DecisionStatus;
  fulfilmentStatus: FulfilmentStatus;
  decisionReason: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  requester: { id: string; name: string; collegeId: string };
  project: { id: string; name: string } | null;
  lines: RequestLine[];
}

export interface IssuedUnit {
  id: string;
  assetCode: string;
  status: UnitStatus;
  conditionNote: string | null;
}

export interface IssueLine {
  id: string;
  issueId: string;
  requestLineId: string | null;
  quantity: number;
  returnedQty: number;
  requestLine: RequestLine | null;
  units: { id: string; unitId: string; unit: InventoryUnit }[];
}

export interface Allocation {
  id: string;
  requestId: string;
  studentId: string;
  projectId: string | null;
  issuedById: string;
  expectedReturnDate: string | null;
  note: string | null;
  createdAt: string;
  student: { id: string; name: string; collegeId: string };
  project: { id: string; name: string } | null;
  lines: IssueLine[];
  outstandingLines: IssueLine[];
  isFullyReturned: boolean;
}

export interface StockMovement {
  id: string;
  itemId: string;
  unitId: string | null;
  quantity: number;
  type: MovementType;
  reason: string | null;
  createdAt: string;
  item: { name: string; nature: ItemNature; trackingMode: TrackingMode };
  actor: { name: string; collegeId: string };
  unit?: { assetCode: string } | null;
  sourceLocation?: { name: string } | null;
  destLocation?: { name: string } | null;
}

export interface DashboardMetrics {
  totalItemsCount: number;
  activeProjectsCount: number;
  totalUnits: number;
  allocatedUnits: number;
  availableUnits: number;
  unavailableUnits: number;
  lowStockCount: number;
  pendingRequestsCount: number;
}

export interface DashboardPayload {
  metrics: DashboardMetrics;
  lowStockItems: { id: string; name: string; threshold: number; current: number }[];
  recentMovements: StockMovement[];
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  user: { id: string; collegeId: string; name: string; status?: UserStatus };
}

export interface LabProject {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt?: string;
  members: ProjectMember[];
  _count?: { requests: number; issues: number };
}

export interface ManagedUser {
  id: string;
  collegeId: string;
  name: string;
  email: string | null;
  role: Role;
  status: UserStatus;
  mustChangePassword: boolean;
  createdAt: string;
}

// ------------------------------------------------------------------ Cart ----

export interface CartLine {
  itemId: string;
  name: string;
  unitOfMeasure: string;
  nature: ItemNature;
  trackingMode: TrackingMode;
  quantity: number;
  availableQuantity: number;
}

// ---------------------------------------------------------------- Payloads --

export interface CreateRequestPayload {
  targetType: RequestTarget;
  projectId?: string;
  purpose: string;
  expectedReturnDate?: string | null;
  lines: { itemId: string; quantity: number }[];
}

export interface DecisionPayload {
  status: 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED';
  decisionReason?: string;
  lines: { lineId: string; approvedQuantity: number; rejectionReason?: string }[];
}

export interface IssuePayload {
  requestId: string;
  collectorCollegeId: string;
  expectedReturnDate?: string | null;
  note?: string;
  clientCommandId: string;
  lines: { requestLineId: string; quantity: number; unitIds?: string[] }[];
}

export interface ReturnPayload {
  issueId: string;
  clientCommandId: string;
  note?: string;
  lines: { issueLineId: string; quantity: number; condition: ReturnCondition; note?: string; unitIds?: string[] }[];
}

export interface StockReceiptPayload {
  itemId: string;
  locationId: string;
  quantity?: number;
  assetCodes?: string[];
  note?: string;
  referenceNumber?: string;
  clientCommandId: string;
}

export interface CreateItemPayload {
  name: string;
  model?: string;
  description?: string;
  categoryId: string;
  nature: ItemNature;
  trackingMode: TrackingMode;
  unitOfMeasure?: string;
  lowStockThreshold?: number | null;
  defaultLocationId?: string | null;
}
