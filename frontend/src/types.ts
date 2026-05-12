export type PagedResult<T> = {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: User;
};

export type User = {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
};

export type Role = {
  id: string;
  name: string;
  description: string;
  permissions: string[];
};

export type Permission = {
  id: string;
  module: string;
  action: string;
  code: string;
};

export type Customer = {
  id: string;
  code: string;
  companyName: string;
  vatNumber?: string;
  notes?: string;
  isActive: boolean;
};

export type Product = {
  id: string;
  reference: string;
  name: string;
  description?: string;
  imageUrl?: string;
  purchasePrice: number;
  salePrice: number;
  vatRate: number;
  categoryName?: string;
  brandName?: string;
  mainSupplierName?: string;
  isActive: boolean;
};

export type Quote = {
  id: string;
  number: string;
  customerId: string;
  customerName?: string;
  status: string;
  issueDate: string;
  validUntil: string;
  subtotal: number;
  vatTotal: number;
  total: number;
  currency: string;
  lines: QuoteLine[];
  documents: QuoteDocument[];
};

export type QuoteLine = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountRate: number;
  vatRate: number;
  lineTotal: number;
};

export type QuoteDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  version: number;
  createdAt: string;
};

export type DriveItem = {
  id: string;
  folderId?: string;
  name: string;
  mimeType: string;
  size: number;
  currentVersion: number;
  isTrashed: boolean;
  createdAt: string;
};

export type DriveFolder = {
  id: string;
  parentFolderId?: string;
  name: string;
  isTrashed: boolean;
  createdAt: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
};

export type DashboardSummary = {
  monthlyRevenue: number;
  pendingQuotes: number;
  unpaidInvoices: number;
  openOrders: number;
  lowStockItems: number;
  openServiceTickets: number;
  newEmails: number;
  recentDocuments: number;
};

export type SalesOrder = {
  id: string;
  number: string;
  customerId: string;
  warehouseId?: string;
  status: string;
  total: number;
  lines: Array<{ id: string; productId?: string; description: string; quantity: number; unitPrice: number; lineTotal: number }>;
};

export type Invoice = {
  id: string;
  number: string;
  customerId: string;
  salesOrderId?: string;
  status: string;
  issueDate: string;
  dueDate: string;
  total: number;
  paidTotal: number;
  balanceDue: number;
  lines: Array<{ id: string; description: string; quantity: number; unitPrice: number; lineTotal: number }>;
  documents: InvoiceDocument[];
};

export type InvoiceDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  version: number;
  createdAt: string;
};

export type Warehouse = {
  id: string;
  name: string;
};

export type StockItem = {
  id: string;
  productId: string;
  warehouseId: string;
  quantityOnHand: number;
  quantityReserved: number;
  availableQuantity: number;
  alertThreshold: number;
  isLowStock: boolean;
};

export type StockMovement = {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  type: string;
  reason: string;
  referenceModule?: string;
  referenceId?: string;
  createdAt: string;
};

export type MailAccount = {
  id: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
  useSsl: boolean;
  userName?: string;
  passwordSecretName?: string;
};

export type EmailMessage = {
  id: string;
  subject: string;
  from: string;
  to: string;
  direction: string;
  status: string;
  isRead: boolean;
  createdAt: string;
  sentAt?: string;
};

export type PrestashopConnection = {
  id: string;
  shopUrl: string;
  apiKeySecretName: string;
  hasApiKey: boolean;
  isActive: boolean;
  warehouseId?: string;
};

export type PrestashopSyncLog = {
  id: string;
  prestashopConnectionId: string;
  status: string;
  message: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
};
