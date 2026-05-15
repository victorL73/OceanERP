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
  categoryId?: string;
  categoryName?: string;
  brandId?: string;
  brandName?: string;
  mainSupplierId?: string;
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
  statusHistory: QuoteStatusHistory[];
};

export type QuoteLine = {
  id: string;
  productId?: string;
  productReference?: string;
  productName?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountRate: number;
  vatRate: number;
  lineNetTotal: number;
  lineVatTotal: number;
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

export type QuoteStatusHistory = {
  id: string;
  status: string;
  comment?: string;
  changedByUserId?: string;
  changedByDisplayName?: string;
  changedByEmail?: string;
  changedAt: string;
};

export type QuoteSettings = {
  id?: string;
  companyName: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  vatNumber?: string;
  siret?: string;
  legalText?: string;
  footerText?: string;
  logoFileName?: string;
  logoMimeType?: string;
  logoSize?: number;
  logoDataUrl?: string;
  hasLogo: boolean;
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
  linkUrl?: string;
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

export type ProductSupplier = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
};

export type PurchaseOrderLine = {
  id: string;
  productId?: string;
  productReference?: string;
  productName?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  receivedQuantity: number;
  lineNetTotal: number;
  lineVatTotal: number;
  lineTotal: number;
};

export type PurchaseOrderCharge = {
  id: string;
  label: string;
  amount: number;
  vatRate: number;
  vatTotal: number;
  total: number;
};

export type PurchaseOrder = {
  id: string;
  number: string;
  supplierId: string;
  supplierName?: string;
  warehouseId?: string;
  warehouseName?: string;
  status: string;
  expectedAt?: string;
  comment?: string;
  linesNetTotal: number;
  linesVatTotal: number;
  chargesNetTotal: number;
  chargesVatTotal: number;
  total: number;
  lines: PurchaseOrderLine[];
  charges: PurchaseOrderCharge[];
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
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  representativeName?: string;
  phone?: string;
  email?: string;
  notes?: string;
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
  createdByUserId?: string;
  createdByDisplayName?: string;
  createdByEmail?: string;
};

export type MailAccount = {
  id: string;
  email: string;
  displayName?: string;
  signatureHtml?: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
  useSsl: boolean;
  userName?: string;
  passwordSecretName?: string;
  hasPassword: boolean;
  isActive: boolean;
  authorizedUserIds: string[];
};

export type MailServerSettings = {
  id?: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
  useSsl: boolean;
  imapAutoSyncEnabled: boolean;
  imapSyncIntervalMinutes: number;
  isConfigured: boolean;
};

export type EmailSyncAccountResult = {
  mailAccountId: string;
  email: string;
  imported: number;
  error?: string;
  notificationUserIds: string[];
};

export type EmailSyncSummary = {
  imported: number;
  accounts: EmailSyncAccountResult[];
};

export type EmailAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  storagePath: string;
};

export type EmailLink = {
  id: string;
  module: string;
  entityId: string;
};

export type EmailMessage = {
  id: string;
  mailAccountId?: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  direction: string;
  status: string;
  isRead: boolean;
  errorMessage?: string;
  createdAt: string;
  sentAt?: string;
  receivedAt?: string;
  attachments: EmailAttachment[];
  links: EmailLink[];
};

export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  isActive: boolean;
  createdAt: string;
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
