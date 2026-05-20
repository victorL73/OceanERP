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

export type BackupArchive = {
  name: string;
  path: string;
  createdAt: string;
  postgresSizeBytes: number;
  documentsSizeBytes: number;
  totalSizeBytes: number;
  hasPostgresDump: boolean;
  hasDocumentsArchive: boolean;
};

export type BackupOperationResult = {
  succeeded: boolean;
  message: string;
  backupName?: string;
  output: string;
  completedAt: string;
};

export type BackupSchedule = {
  enabled: boolean;
  intervalHours: number;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
};

export type AuditLog = {
  id: string;
  userId?: string;
  userEmail?: string;
  userDisplayName?: string;
  action: string;
  entityName: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadataJson?: string;
  createdAt: string;
};

export type Customer = {
  id: string;
  code: string;
  companyName: string;
  legalName?: string;
  tradeName?: string;
  sirenNumber?: string;
  siretNumber?: string;
  vatNumber?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  website?: string;
  industry?: string;
  customerType?: string;
  source?: string;
  accountingCode?: string;
  paymentTerms?: string;
  defaultDiscountRate: number;
  notes?: string;
  isActive: boolean;
  contacts: CustomerContact[];
  addresses: CustomerAddress[];
};

export type CustomerContact = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  isPrimary: boolean;
};

export type CustomerAddress = {
  id: string;
  label: string;
  line1: string;
  line2?: string;
  postalCode: string;
  city: string;
  country: string;
  isBilling: boolean;
  isShipping: boolean;
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
  customer?: QuoteCustomer;
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

export type QuoteCustomer = {
  id: string;
  code: string;
  companyName: string;
  legalName?: string;
  tradeName?: string;
  sirenNumber?: string;
  siretNumber?: string;
  vatNumber?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  website?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  addressLabel?: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  country?: string;
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
  driveItemId?: string;
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

export type DocumentLink = {
  id: string;
  driveItemId: string;
  fileName: string;
  mimeType: string;
  size: number;
  module: string;
  entityId: string;
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
  draftQuotes: number;
  sentQuotes: number;
  signedQuotes: number;
  expiredQuotes: number;
  quotesToExpireSoon: number;
  pendingQuoteAmount: number;
  unpaidInvoices: number;
  overdueInvoices: number;
  openOrders: number;
  draftOrders: number;
  confirmedOrders: number;
  preparingOrders: number;
  shippedOrders: number;
  openPurchaseOrders: number;
  purchaseOrdersExpectedSoon: number;
  lowStockItems: number;
  outOfStockItems: number;
  stockQuantityOnHand: number;
  stockQuantityReserved: number;
  openServiceTickets: number;
  newEmails: number;
  unreadNotifications: number;
  recentDocuments: number;
  totalDocuments: number;
  trashedDocuments: number;
  totalCustomers: number;
  activeCustomers: number;
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  suppliers: number;
  warehouses: number;
  mailAccounts: number;
  activePrestashopConnections: number;
};

export type FlowceanWorkspaceSummary = {
  id: string;
  slug: string;
  name: string;
  version: number;
  isPersonal: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type FlowceanWorkspace = FlowceanWorkspaceSummary & {
  dataJson: string;
};

export type SalesOrder = {
  id: string;
  number: string;
  customerId: string;
  customerName?: string;
  warehouseId?: string;
  warehouseName?: string;
  status: string;
  externalStatusName?: string;
  total: number;
  orderedAt?: string;
  paymentMethod?: string;
  paymentModule?: string;
  paidTotal?: number;
  productsTotal?: number;
  shippingTotal?: number;
  shippingWeightKg?: number;
  invoiceReference?: string;
  shippingServiceName?: string;
  shippingCarrierName?: string;
  shippingTrackingNumber?: string;
  shippingAddress?: {
    name?: string;
    line1?: string;
    line2?: string;
    postalCode?: string;
    city?: string;
    country?: string;
    phone?: string;
    email?: string;
  };
  canPrintShippingSlip: boolean;
  canPrintColissimoLabel?: boolean;
  createdAt: string;
  confirmedAt?: string;
  shippedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  lines: Array<{ id: string; productId?: string; description: string; quantity: number; unitPrice: number; lineTotal: number }>;
  statusHistory: Array<{ id: string; status: string; changedAt: string }>;
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
  kind: string;
  customerId: string;
  customerName: string;
  salesOrderId?: string;
  salesOrderNumber?: string;
  creditOfInvoiceId?: string;
  creditOfInvoiceNumber?: string;
  status: string;
  issueDate: string;
  dueDate: string;
  total: number;
  paidTotal: number;
  balanceDue: number;
  facturXProfile: string;
  facturXReady: boolean;
  lines: Array<{ id: string; description: string; quantity: number; unitPrice: number; lineTotal: number }>;
  documents: InvoiceDocument[];
  statusHistory: Array<{ id: string; status: string; changedAt: string }>;
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
  cc?: string;
  bcc?: string;
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

export type EmailDistributionListMember = {
  id: string;
  name?: string;
  email: string;
};

export type EmailDistributionList = {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  members: EmailDistributionListMember[];
};

export type PrestashopConnection = {
  id: string;
  shopUrl: string;
  apiKeySecretName: string;
  hasApiKey: boolean;
  isActive: boolean;
  warehouseId?: string;
  colissimoLabelEndpointTemplate?: string;
  hasColissimoBridgeToken: boolean;
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

export type ServiceTicketMessage = {
  id: string;
  authorUserId?: string;
  authorName?: string;
  body: string;
  isInternal: boolean;
  attachmentDriveItemId?: string;
  createdAt: string;
};

export type ServiceTicketStatusHistory = {
  id: string;
  status: string;
  comment?: string;
  changedByUserId?: string;
  changedByName?: string;
  changedAt: string;
};

export type ServiceTicket = {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  productId?: string;
  productReference?: string;
  productName?: string;
  salesOrderId?: string;
  salesOrderNumber?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  subject: string;
  description?: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  messages: ServiceTicketMessage[];
  statusHistory: ServiceTicketStatusHistory[];
};

export type ServiceTicketAssignmentSettings = {
  initialResponderUserIds: string[];
};

export type CalendarReminder = {
  id: string;
  remindAt: string;
  isSent: boolean;
};

export type CalendarEventLink = {
  id: string;
  module: string;
  entityId: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startsAt: string;
  endsAt: string;
  isPrivate: boolean;
  createdAt: string;
  reminders: CalendarReminder[];
  links: CalendarEventLink[];
};

export type MeetingLanguage = {
  code: string;
  label: string;
};

export type MeetingRoom = {
  id: string;
  code: string;
  title: string;
  calendarEventId?: string;
  inviteToken?: string;
  scheduledStartAt?: string;
  createdAt: string;
  lastActivityAt: string;
  isLocked: boolean;
  createdByName?: string;
};

export type MeetingParticipant = {
  id: string;
  userId?: string;
  clientId: string;
  displayName: string;
  sourceLanguage: string;
  targetLanguage: string;
  microphoneEnabled: boolean;
  cameraEnabled: boolean;
  screenEnabled: boolean;
  connectionState: string;
  joinedAt: string;
  lastSeenAt: string;
};

export type MeetingSignal = {
  id: string;
  senderClientId: string;
  recipientClientId: string;
  signalType: string;
  payloadJson: string;
  createdAt: string;
};

export type MeetingTranscript = {
  id: string;
  userId?: string;
  clientId: string;
  speakerName: string;
  sourceLanguage: string;
  text: string;
  translatedText?: string;
  isFinal: boolean;
  createdAt: string;
};

export type MeetingChatMessage = {
  id: string;
  userId?: string;
  clientId: string;
  senderName: string;
  message: string;
  fileName?: string;
  fileMimeType?: string;
  fileSize?: number;
  hasFile: boolean;
  createdAt: string;
};

export type MeetingDashboard = {
  rooms: MeetingRoom[];
  languages: MeetingLanguage[];
  chatAttachmentMaxBytes: number;
};

export type MeetingMediaState = {
  microphoneEnabled: boolean;
  cameraEnabled: boolean;
  screenEnabled: boolean;
  connectionState?: string;
};

export type MeetingRoomState = {
  room: MeetingRoom;
  participants: MeetingParticipant[];
  signals: MeetingSignal[];
  transcripts: MeetingTranscript[];
  chatMessages: MeetingChatMessage[];
  serverTime: string;
};

export type SignatureRecipient = {
  id: string;
  email: string;
  name?: string;
  status: string;
  signedAt?: string;
  signingUrl?: string;
};

export type SignatureEvidence = {
  id: string;
  signatureRecipientId?: string;
  action: string;
  documentSha256: string;
  conditionsAccepted: boolean;
  signatureMode?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
};

export type SignedDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  documentSha256: string;
  createdAt: string;
};

export type SignatureRequest = {
  id: string;
  driveItemId: string;
  driveItemName?: string;
  title: string;
  status: string;
  expiresAt: string;
  completedAt?: string;
  recipients: SignatureRecipient[];
  evidence: SignatureEvidence[];
  signedDocuments: SignedDocument[];
};

export type PublicSignature = {
  requestId: string;
  recipientId: string;
  title: string;
  fileName: string;
  expiresAt: string;
  status: string;
  requiresOtp: boolean;
  documentUrl: string;
  signedDocumentUrl?: string;
  signerName?: string;
  signerEmail?: string;
};

export type OnlyOfficeConfig = {
  documentServerUrl: string;
  documentType: string;
  type: string;
  token?: string;
  document: {
    fileType: string;
    key: string;
    title: string;
    url: string;
    permissions?: {
      edit: boolean;
      download: boolean;
      print: boolean;
    };
  };
  editorConfig: {
    mode: string;
    callbackUrl: string;
    lang?: string;
    region?: string;
    user: {
      id: string;
      name: string;
    };
    customization?: {
      autosave: boolean;
      forcesave: boolean;
      chat: boolean;
      comments: boolean;
    };
  };
};
