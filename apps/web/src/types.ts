export type Role = 'ADMIN' | 'STUDENT';

export interface User {
  id: string;
  collegeId: string;
  name: string;
  email?: string;
  role: Role;
  mustChangePassword?: boolean;
}

export type ItemNature = 'RETURNABLE' | 'CONSUMABLE';
export type TrackingMode = 'SERIALIZED' | 'BULK';
export type UnitStatus = 'AVAILABLE' | 'ALLOCATED' | 'UNAVAILABLE' | 'RETIRED';

export interface InventoryUnit {
  id: string;
  assetCode: string;
  status: UnitStatus;
  conditionNote?: string;
}

export interface StockBalance {
  id: string;
  availableQuantity: number;
  allocatedQuantity: number;
  location: { name: string };
}

export interface InventoryItem {
  id: string;
  name: string;
  model?: string;
  description?: string;
  nature: ItemNature;
  trackingMode: TrackingMode;
  unitOfMeasure: string;
  categoryId: string;
  categoryName: string;
  defaultLocation: string;
  lowStockThreshold?: number | null;
  totalQuantity: number;
  availableQuantity: number;
  isLowStock: boolean;
  units: InventoryUnit[];
  balances: StockBalance[];
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  _count?: { items: number };
}

export interface LocationHierarchy {
  id: string;
  name: string;
  type: string;
  parentId?: string | null;
  parent?: LocationHierarchy | null;
  children?: LocationHierarchy[];
}

export type RequestDecisionStatus = 'PENDING' | 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED' | 'CANCELLED';
export type FulfilmentStatus = 'NOT_ISSUED' | 'PARTIALLY_ISSUED' | 'FULFILLED';

export interface RequestLine {
  id: string;
  itemId: string;
  requestedQty: number;
  approvedQty: number;
  issuedQty: number;
  rejectionReason?: string;
  item: {
    id: string;
    name: string;
    nature: ItemNature;
    trackingMode: TrackingMode;
    unitOfMeasure: string;
  };
}

export interface EquipmentRequest {
  id: string;
  targetType: 'PERSONAL' | 'PROJECT';
  purpose: string;
  expectedReturnDate?: string;
  decisionStatus: RequestDecisionStatus;
  fulfilmentStatus: FulfilmentStatus;
  decisionReason?: string;
  createdAt: string;
  requester: {
    id: string;
    name: string;
    collegeId: string;
  };
  project?: {
    id: string;
    name: string;
  } | null;
  lines: RequestLine[];
}

export interface AllocationIssue {
  id: string;
  requestId: string;
  studentId: string;
  expectedReturnDate?: string;
  createdAt: string;
  note?: string;
  student: {
    id: string;
    name: string;
    collegeId: string;
  };
  project?: {
    id: string;
    name: string;
  } | null;
  lines: Array<{
    id: string;
    quantity: number;
    returnedQty: number;
    requestLine?: {
      item: {
        id: string;
        name: string;
        nature: ItemNature;
        trackingMode: TrackingMode;
      };
    };
    units: Array<{
      id: string;
      unit: {
        id: string;
        assetCode: string;
        status: UnitStatus;
      };
    }>;
  }>;
  isFullyReturned?: boolean;
}

export interface KitItem {
  id: string;
  quantity: number;
  item: {
    id: string;
    name: string;
    model?: string;
    nature: ItemNature;
    trackingMode: TrackingMode;
    unitOfMeasure: string;
  };
}

export interface Kit {
  id: string;
  name: string;
  description?: string;
  items: KitItem[];
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

export interface StockMovement {
  id: string;
  itemId: string;
  quantity: number;
  type: 'RECEIPT' | 'ISSUE' | 'RETURN' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'LOCATION_TRANSFER';
  reason?: string;
  createdAt: string;
  item: {
    name: string;
    nature: ItemNature;
    trackingMode: TrackingMode;
  };
  actor: {
    name: string;
    collegeId: string;
  };
  unit?: {
    assetCode: string;
  };
  destLocation?: {
    name: string;
  };
  sourceLocation?: {
    name: string;
  };
}

