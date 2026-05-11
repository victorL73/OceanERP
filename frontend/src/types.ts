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
  purchasePrice: number;
  salePrice: number;
  vatRate: number;
  categoryName?: string;
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

