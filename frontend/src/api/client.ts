import type {
  AuthResponse,
  AuditLog,
  Customer,
  DashboardSummary,
  DocumentLink,
  DriveFolder,
  DriveItem,
  EmailMessage,
  EmailSyncSummary,
  EmailTemplate,
  Invoice,
  InvoiceDocument,
  MailAccount,
  MailServerSettings,
  NotificationItem,
  PagedResult,
  Permission,
  PrestashopConnection,
  PrestashopSyncLog,
  Product,
  ProductSupplier,
  PurchaseOrder,
  Quote,
  QuoteDocument,
  QuoteSettings,
  Role,
  SalesOrder,
  StockItem,
  StockMovement,
  User,
  Warehouse
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

type RequestOptions = RequestInit & { auth?: boolean };

export class ApiClient {
  private accessToken: string | null = localStorage.getItem('oceanerp.accessToken');
  private refreshToken: string | null = localStorage.getItem('oceanerp.refreshToken');
  private currentUser: User | null = this.readStoredUser();

  get token() {
    return this.accessToken;
  }

  get user() {
    return this.currentUser;
  }

  async login(email: string, password: string) {
    const auth = await this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setAuth(auth);
    return auth;
  }

  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    this.currentUser = null;
    localStorage.removeItem('oceanerp.accessToken');
    localStorage.removeItem('oceanerp.refreshToken');
    localStorage.removeItem('oceanerp.user');
    window.dispatchEvent(new Event('oceanerp.authChanged'));
  }

  async me() {
    const user = await this.request<User>('/api/auth/me', { auth: true });
    this.setUser(user);
    return user;
  }

  async updateProfile(payload: { email: string; displayName: string }) {
    const user = await this.request<User>('/api/auth/me', { method: 'PUT', auth: true, body: JSON.stringify(payload) });
    this.setUser(user);
    return user;
  }

  changePassword(payload: { currentPassword: string; newPassword: string }) {
    return this.request<void>('/api/auth/change-password', { method: 'POST', auth: true, body: JSON.stringify(payload) });
  }

  summary() {
    return this.request<DashboardSummary>('/api/dashboard/summary', { auth: true });
  }

  customers(search = '', page = 1, pageSize = 100) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search.trim()) {
      params.set('search', search.trim());
    }

    return this.request<PagedResult<Customer>>(`/api/customers?${params.toString()}`, { auth: true });
  }

  createCustomer(payload: {
    code: string;
    companyName: string;
    legalName?: string | null;
    tradeName?: string | null;
    sirenNumber?: string | null;
    siretNumber?: string | null;
    vatNumber?: string | null;
    email?: string | null;
    phone?: string | null;
    mobilePhone?: string | null;
    website?: string | null;
    industry?: string | null;
    customerType?: string | null;
    source?: string | null;
    accountingCode?: string | null;
    paymentTerms?: string | null;
    defaultDiscountRate?: number | null;
    notes?: string | null;
    contacts?: Array<{ firstName: string; lastName: string; email?: string | null; phone?: string | null; jobTitle?: string | null; isPrimary: boolean }>;
    addresses?: Array<{ label: string; line1: string; line2?: string | null; postalCode: string; city: string; country: string; isBilling: boolean; isShipping: boolean }>;
  }) {
    return this.request<Customer>('/api/customers', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ ...payload, contacts: payload.contacts ?? [], addresses: payload.addresses ?? [] })
    });
  }

  updateCustomer(
    customerId: string,
    payload: {
      companyName: string;
      legalName?: string | null;
      tradeName?: string | null;
      sirenNumber?: string | null;
      siretNumber?: string | null;
      vatNumber?: string | null;
      email?: string | null;
      phone?: string | null;
      mobilePhone?: string | null;
      website?: string | null;
      industry?: string | null;
      customerType?: string | null;
      source?: string | null;
      accountingCode?: string | null;
      paymentTerms?: string | null;
      defaultDiscountRate?: number | null;
      notes?: string | null;
      isActive: boolean;
      contacts: Array<{ firstName: string; lastName: string; email?: string | null; phone?: string | null; jobTitle?: string | null; isPrimary: boolean }>;
      addresses: Array<{ label: string; line1: string; line2?: string | null; postalCode: string; city: string; country: string; isBilling: boolean; isShipping: boolean }>;
    }
  ) {
    return this.request<Customer>(`/api/customers/${customerId}`, { method: 'PUT', auth: true, body: JSON.stringify(payload) });
  }

  products() {
    return this.request<PagedResult<Product>>('/api/products?pageSize=500', { auth: true });
  }

  productSuppliers() {
    return this.request<ProductSupplier[]>('/api/products/suppliers', { auth: true });
  }

  createProduct(payload: { reference: string; name: string; description?: string; imageUrl?: string; purchasePrice: number; salePrice: number; vatRate: number }) {
    return this.request<Product>('/api/products', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ ...payload, categoryId: null, mainSupplierId: null })
    });
  }

  updateProduct(productId: string, payload: { reference: string; name: string; description?: string; imageUrl?: string; purchasePrice: number; salePrice: number; vatRate: number; isActive: boolean }) {
    return this.request<Product>(`/api/products/${productId}`, {
      method: 'PUT',
      auth: true,
      body: JSON.stringify({ ...payload, categoryId: null, mainSupplierId: null })
    });
  }

  quotes() {
    return this.request<PagedResult<Quote>>('/api/quotes', { auth: true });
  }

  createQuote(payload: { customerId: string; validUntil: string; lines: Array<{ productId?: string | null; description: string; quantity: number; unitPrice: number; discountRate: number; vatRate: number }> }) {
    return this.request<Quote>('/api/quotes', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(payload)
    });
  }

  updateQuote(quoteId: string, payload: { customerId: string; validUntil: string; lines: Array<{ productId?: string | null; description: string; quantity: number; unitPrice: number; discountRate: number; vatRate: number }> }) {
    return this.request<Quote>(`/api/quotes/${quoteId}`, {
      method: 'PUT',
      auth: true,
      body: JSON.stringify(payload)
    });
  }

  changeQuoteStatus(quoteId: string, status: string, comment?: string | null) {
    return this.request<Quote>(`/api/quotes/${quoteId}/status`, { method: 'POST', auth: true, body: JSON.stringify({ status, comment }) });
  }

  generateQuotePdf(quoteId: string) {
    return this.request<QuoteDocument>(`/api/quotes/${quoteId}/pdf`, { method: 'POST', auth: true });
  }

  sendQuoteEmail(quoteId: string, payload: { mailAccountId: string; to: string; subject?: string | null; body?: string | null; cc?: string | null; bcc?: string | null }) {
    return this.request<Quote>(`/api/quotes/${quoteId}/email`, { method: 'POST', auth: true, body: JSON.stringify(payload) });
  }

  quoteSettings() {
    return this.request<QuoteSettings>('/api/quotes/settings', { auth: true });
  }

  updateQuoteSettings(payload: {
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
  }) {
    return this.request<QuoteSettings>('/api/quotes/settings', { method: 'PUT', auth: true, body: JSON.stringify(payload) });
  }

  uploadQuoteLogo(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.request<QuoteSettings>('/api/quotes/settings/logo', { method: 'POST', auth: true, body: form });
  }

  deleteQuoteLogo() {
    return this.request<QuoteSettings>('/api/quotes/settings/logo', { method: 'DELETE', auth: true });
  }

  async downloadQuoteDocument(quoteId: string, documentId: string, fileName: string) {
    await this.download(`/api/quotes/${quoteId}/documents/${documentId}/download`, fileName);
  }

  folders(parentFolderId?: string | null, search = '', includeTrashed = false) {
    const params = new URLSearchParams();
    if (parentFolderId) {
      params.set('parentFolderId', parentFolderId);
    }
    if (search.trim()) {
      params.set('search', search.trim());
    }
    if (includeTrashed) {
      params.set('includeTrashed', 'true');
    }
    const query = params.toString();
    return this.request<DriveFolder[]>(`/api/drive/folders${query ? `?${query}` : ''}`, { auth: true });
  }

  createFolder(payload: { parentFolderId?: string | null; name: string }) {
    return this.request<DriveFolder>('/api/drive/folders', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(payload)
    });
  }

  renameFolder(folderId: string, name: string) {
    return this.request<DriveFolder>(`/api/drive/folders/${folderId}/rename`, { method: 'PUT', auth: true, body: JSON.stringify({ name }) });
  }

  moveFolder(folderId: string, destinationFolderId?: string | null) {
    return this.request<DriveFolder>(`/api/drive/folders/${folderId}/move`, { method: 'PUT', auth: true, body: JSON.stringify({ folderId: destinationFolderId ?? null }) });
  }

  trashFolder(folderId: string) {
    return this.request<void>(`/api/drive/folders/${folderId}`, { method: 'DELETE', auth: true });
  }

  restoreFolder(folderId: string) {
    return this.request<DriveFolder>(`/api/drive/folders/${folderId}/restore`, { method: 'POST', auth: true });
  }

  files(folderId?: string | null, search = '', includeTrashed = false) {
    const params = new URLSearchParams();
    if (folderId) {
      params.set('folderId', folderId);
    }
    if (search.trim()) {
      params.set('search', search.trim());
    }
    if (includeTrashed) {
      params.set('includeTrashed', 'true');
    }
    const query = params.toString();
    return this.request<DriveItem[]>(`/api/drive/files${query ? `?${query}` : ''}`, { auth: true });
  }

  uploadDriveFile(file: File, folderId?: string | null) {
    const form = new FormData();
    if (folderId) {
      form.append('folderId', folderId);
    }
    form.append('file', file);
    return this.request<{ item: DriveItem; sha256: string }>('/api/drive/files', {
      method: 'POST',
      auth: true,
      body: form
    });
  }

  async downloadDriveFile(fileId: string, fileName: string) {
    await this.download(`/api/drive/files/${fileId}/download`, fileName);
  }

  driveFileBlob(fileId: string): Promise<Blob> {
    return this.blob(`/api/drive/files/${fileId}/download`);
  }

  renameDriveFile(fileId: string, name: string) {
    return this.request<DriveItem>(`/api/drive/files/${fileId}/rename`, { method: 'PUT', auth: true, body: JSON.stringify({ name }) });
  }

  moveDriveFile(fileId: string, folderId?: string | null) {
    return this.request<DriveItem>(`/api/drive/files/${fileId}/move`, { method: 'PUT', auth: true, body: JSON.stringify({ folderId: folderId ?? null }) });
  }

  trashDriveFile(fileId: string) {
    return this.request<void>(`/api/drive/files/${fileId}`, { method: 'DELETE', auth: true });
  }

  restoreDriveFile(fileId: string) {
    return this.request<DriveItem>(`/api/drive/files/${fileId}/restore`, { method: 'POST', auth: true });
  }

  documentLinks(module: string, entityId: string) {
    return this.request<DocumentLink[]>(`/api/drive/links/${module}/${entityId}`, { auth: true });
  }

  linkDocument(payload: { driveItemId: string; module: string; entityId: string }) {
    return this.request<DocumentLink>('/api/drive/links', { method: 'POST', auth: true, body: JSON.stringify(payload) });
  }

  unlinkDocument(linkId: string) {
    return this.request<void>(`/api/drive/links/${linkId}`, { method: 'DELETE', auth: true });
  }

  notifications() {
    return this.request<NotificationItem[]>('/api/notifications', { auth: true });
  }

  markNotificationRead(notificationId: string) {
    return this.request<void>(`/api/notifications/${notificationId}/read`, { method: 'POST', auth: true });
  }

  users() {
    return this.request<User[]>('/api/users', { auth: true });
  }

  createUser(payload: { email: string; displayName: string; password: string; roles: string[] }) {
    return this.request<User>('/api/users', { method: 'POST', auth: true, body: JSON.stringify(payload) });
  }

  updateUserRoles(userId: string, payload: { roles: string[]; isActive: boolean }) {
    return this.request<User>(`/api/users/${userId}/roles`, { method: 'PUT', auth: true, body: JSON.stringify(payload) });
  }

  roles() {
    return this.request<Role[]>('/api/users/roles', { auth: true });
  }

  permissions() {
    return this.request<Permission[]>('/api/users/permissions', { auth: true });
  }

  auditLogs(take = 100) {
    return this.request<AuditLog[]>(`/api/users/audit-logs?take=${take}`, { auth: true });
  }

  createRole(payload: { name: string; description: string; permissions: string[] }) {
    return this.request<Role>('/api/users/roles', { method: 'POST', auth: true, body: JSON.stringify(payload) });
  }

  updateRole(roleId: string, payload: { description: string; permissions: string[] }) {
    return this.request<Role>(`/api/users/roles/${roleId}`, { method: 'PUT', auth: true, body: JSON.stringify(payload) });
  }

  orders() {
    return this.request<PagedResult<SalesOrder>>('/api/orders', { auth: true });
  }

  createOrder(payload: { customerId: string; warehouseId?: string | null; lines: Array<{ productId?: string | null; description: string; quantity: number; unitPrice: number }> }) {
    return this.request<SalesOrder>('/api/orders', { method: 'POST', auth: true, body: JSON.stringify(payload) });
  }

  createOrderFromQuote(quoteId: string, warehouseId?: string | null) {
    return this.request<SalesOrder>('/api/orders/from-quote', { method: 'POST', auth: true, body: JSON.stringify({ quoteId, warehouseId }) });
  }

  changeOrderStatus(orderId: string, status: string) {
    return this.request<SalesOrder>(`/api/orders/${orderId}/status`, { method: 'POST', auth: true, body: JSON.stringify({ status }) });
  }

  async openOrderShipmentSlip(orderId: string, orderNumber: string) {
    const fileName = `bon-expedition-${orderNumber}.pdf`;
    const opened = this.openPendingDocumentWindow("Preparation du bon d'expedition...");
    try {
      const pdf = await this.blob(`/api/orders/${orderId}/shipment-slip`);
      const url = URL.createObjectURL(pdf);
      if (!opened) {
        await this.download(`/api/orders/${orderId}/shipment-slip`, fileName);
        URL.revokeObjectURL(url);
        return;
      }

      opened.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      opened?.close();
      throw err;
    }
  }

  async openOrderColissimoLabel(orderId: string, orderNumber: string) {
    const fileName = `etiquette-colissimo-${orderNumber}.pdf`;
    const opened = this.openPendingDocumentWindow("Recherche de l'etiquette Colissimo...");
    try {
      const label = await this.blob(`/api/orders/${orderId}/colissimo-label`);
      const url = URL.createObjectURL(label);
      if (!opened) {
        await this.download(`/api/orders/${orderId}/colissimo-label`, fileName);
        URL.revokeObjectURL(url);
        return;
      }

      opened.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      opened?.close();
      throw err;
    }
  }

  purchaseOrders() {
    return this.request<PagedResult<PurchaseOrder>>('/api/purchases/orders?pageSize=100', { auth: true });
  }

  createPurchaseOrder(payload: {
    supplierId: string;
    warehouseId?: string | null;
    expectedAt?: string | null;
    comment?: string | null;
    lines: Array<{ productId?: string | null; description: string; quantity: number; unitPrice: number; vatRate?: number | null }>;
    charges?: Array<{ label: string; amount: number; vatRate: number }>;
  }) {
    return this.request<PurchaseOrder>('/api/purchases/orders', { method: 'POST', auth: true, body: JSON.stringify(payload) });
  }

  updatePurchaseOrder(orderId: string, payload: {
    supplierId: string;
    warehouseId?: string | null;
    expectedAt?: string | null;
    comment?: string | null;
    lines: Array<{ productId?: string | null; description: string; quantity: number; unitPrice: number; vatRate?: number | null }>;
    charges?: Array<{ label: string; amount: number; vatRate: number }>;
  }) {
    return this.request<PurchaseOrder>(`/api/purchases/orders/${orderId}`, { method: 'PUT', auth: true, body: JSON.stringify(payload) });
  }

  changePurchaseOrderStatus(orderId: string, status: string) {
    return this.request<PurchaseOrder>(`/api/purchases/orders/${orderId}/status`, { method: 'POST', auth: true, body: JSON.stringify({ status }) });
  }

  updatePurchaseOrderExpectedAt(orderId: string, expectedAt?: string | null) {
    return this.request<PurchaseOrder>(`/api/purchases/orders/${orderId}/expected-date`, { method: 'PUT', auth: true, body: JSON.stringify({ expectedAt }) });
  }

  updatePurchaseOrderWarehouse(orderId: string, warehouseId?: string | null) {
    return this.request<PurchaseOrder>(`/api/purchases/orders/${orderId}/warehouse`, { method: 'PUT', auth: true, body: JSON.stringify({ warehouseId }) });
  }

  receivePurchaseOrderToStock(orderId: string, warehouseId?: string | null) {
    return this.request<PurchaseOrder>(`/api/purchases/orders/${orderId}/receive-to-stock`, { method: 'POST', auth: true, body: JSON.stringify({ warehouseId }) });
  }

  invoices() {
    return this.request<PagedResult<Invoice>>('/api/invoices', { auth: true });
  }

  createInvoiceFromOrder(salesOrderId: string) {
    return this.request<Invoice>('/api/invoices/from-order', { method: 'POST', auth: true, body: JSON.stringify({ salesOrderId }) });
  }

  addInvoicePayment(invoiceId: string, payload: { amount: number; paidOn: string }) {
    return this.request<Invoice>(`/api/invoices/${invoiceId}/payments`, { method: 'POST', auth: true, body: JSON.stringify(payload) });
  }

  generateInvoicePdf(invoiceId: string) {
    return this.request<InvoiceDocument>(`/api/invoices/${invoiceId}/pdf`, { method: 'POST', auth: true });
  }

  async downloadInvoiceDocument(invoiceId: string, documentId: string, fileName: string) {
    await this.download(`/api/invoices/${invoiceId}/documents/${documentId}/download`, fileName);
  }

  warehouses() {
    return this.request<Warehouse[]>('/api/stock/warehouses', { auth: true });
  }

  createWarehouse(payload: { name: string; addressLine1?: string; addressLine2?: string; postalCode?: string; city?: string; country?: string; representativeName?: string; phone?: string; email?: string; notes?: string }) {
    return this.request<Warehouse>('/api/stock/warehouses', { method: 'POST', auth: true, body: JSON.stringify(payload) });
  }

  updateWarehouse(warehouseId: string, payload: { name: string; addressLine1?: string; addressLine2?: string; postalCode?: string; city?: string; country?: string; representativeName?: string; phone?: string; email?: string; notes?: string }) {
    return this.request<Warehouse>(`/api/stock/warehouses/${warehouseId}`, { method: 'PUT', auth: true, body: JSON.stringify(payload) });
  }

  deleteWarehouse(warehouseId: string) {
    return this.request<void>(`/api/stock/warehouses/${warehouseId}`, { method: 'DELETE', auth: true });
  }

  stockItems() {
    return this.request<StockItem[]>('/api/stock/items', { auth: true });
  }

  stockMovements() {
    return this.request<StockMovement[]>('/api/stock/movements', { auth: true });
  }

  adjustStock(payload: { productId: string; warehouseId: string; quantity: number; reason: string; alertThreshold?: number }) {
    return this.request('/api/stock/adjustments', { method: 'POST', auth: true, body: JSON.stringify(payload) });
  }

  updateStockItem(stockItemId: string, payload: { warehouseId: string; quantityOnHand: number; alertThreshold?: number }) {
    return this.request<StockItem>(`/api/stock/items/${stockItemId}`, { method: 'PUT', auth: true, body: JSON.stringify(payload) });
  }

  mailAccounts() {
    return this.request<MailAccount[]>('/api/emails/accounts', { auth: true });
  }

  mailServerSettings() {
    return this.request<MailServerSettings>('/api/emails/server-settings', { auth: true });
  }

  updateMailServerSettings(payload: { smtpHost: string; smtpPort: number; imapHost: string; imapPort: number; useSsl: boolean; imapAutoSyncEnabled?: boolean; imapSyncIntervalMinutes?: number }) {
    return this.request<MailServerSettings>('/api/emails/server-settings', { method: 'PUT', auth: true, body: JSON.stringify(payload) });
  }

  emailMessages(search?: string, accountId?: string) {
    const query = new URLSearchParams();
    query.set('pageSize', '100');
    if (search) {
      query.set('search', search);
    }
    if (accountId) {
      query.set('accountId', accountId);
    }
    const suffix = query.toString() ? `?${query}` : '';
    return this.request<PagedResult<EmailMessage>>(`/api/emails/messages${suffix}`, { auth: true });
  }

  emailMessage(messageId: string) {
    return this.request<EmailMessage>(`/api/emails/messages/${messageId}`, { auth: true });
  }

  createMailAccount(payload: { email: string; displayName?: string; signatureHtml?: string; smtpHost?: string; imapHost?: string; smtpPort?: number; imapPort?: number; useSsl?: boolean; userName?: string; passwordSecretName?: string; password?: string; isActive?: boolean; authorizedUserIds?: string[] }) {
    return this.request<MailAccount>('/api/emails/accounts', { method: 'POST', auth: true, body: JSON.stringify(payload) });
  }

  updateMailAccount(accountId: string, payload: { email: string; displayName?: string; signatureHtml?: string; smtpHost?: string; imapHost?: string; smtpPort?: number; imapPort?: number; useSsl?: boolean; userName?: string; passwordSecretName?: string; password?: string; clearPassword?: boolean; isActive?: boolean; authorizedUserIds?: string[] }) {
    return this.request<MailAccount>(`/api/emails/accounts/${accountId}`, { method: 'PUT', auth: true, body: JSON.stringify(payload) });
  }

  deleteMailAccount(accountId: string) {
    return this.request<void>(`/api/emails/accounts/${accountId}`, { method: 'DELETE', auth: true });
  }

  testMailAccount(accountId: string) {
    return this.request<{ status: string }>(`/api/emails/accounts/${accountId}/test-smtp`, { method: 'POST', auth: true });
  }

  syncMailAccount(accountId: string) {
    return this.request<{ imported: number }>(`/api/emails/accounts/${accountId}/sync-imap`, { method: 'POST', auth: true });
  }

  syncMailAccounts() {
    return this.request<EmailSyncSummary>('/api/emails/sync-imap', { method: 'POST', auth: true });
  }

  markEmailRead(messageId: string, isRead: boolean) {
    return this.request<EmailMessage>(`/api/emails/messages/${messageId}/read?isRead=${isRead}`, { method: 'POST', auth: true });
  }

  deleteEmailMessage(messageId: string) {
    return this.request<void>(`/api/emails/messages/${messageId}`, { method: 'DELETE', auth: true });
  }

  async downloadEmailAttachment(messageId: string, attachmentId: string, fileName: string) {
    await this.download(`/api/emails/messages/${messageId}/attachments/${attachmentId}/download`, fileName);
  }

  sendEmail(payload: { mailAccountId: string; to: string; subject: string; body: string; cc?: string | null; bcc?: string | null }) {
    return this.request<EmailMessage>('/api/emails/send', { method: 'POST', auth: true, body: JSON.stringify(payload) });
  }

  emailTemplates() {
    return this.request<EmailTemplate[]>('/api/emails/templates', { auth: true });
  }

  createEmailTemplate(payload: { name: string; subject: string; body: string; isActive?: boolean }) {
    return this.request<EmailTemplate>('/api/emails/templates', { method: 'POST', auth: true, body: JSON.stringify(payload) });
  }

  updateEmailTemplate(templateId: string, payload: { name: string; subject: string; body: string; isActive?: boolean }) {
    return this.request<EmailTemplate>(`/api/emails/templates/${templateId}`, { method: 'PUT', auth: true, body: JSON.stringify(payload) });
  }

  deleteEmailTemplate(templateId: string) {
    return this.request<void>(`/api/emails/templates/${templateId}`, { method: 'DELETE', auth: true });
  }

  prestashopConnections() {
    return this.request<PrestashopConnection[]>('/api/prestashop/connections', { auth: true });
  }

  prestashopLogs() {
    return this.request<PrestashopSyncLog[]>('/api/prestashop/sync-logs', { auth: true });
  }

  createPrestashopConnection(payload: { shopUrl: string; apiKey?: string; warehouseId?: string }) {
    return this.request<PrestashopConnection>('/api/prestashop/connections', { method: 'POST', auth: true, body: JSON.stringify(payload) });
  }

  updatePrestashopConnection(connectionId: string, payload: { shopUrl: string; apiKey?: string; isActive: boolean; clearApiKey: boolean; warehouseId?: string }) {
    return this.request<PrestashopConnection>(`/api/prestashop/connections/${connectionId}`, { method: 'PUT', auth: true, body: JSON.stringify(payload) });
  }

  runPrestashopSync(connectionId: string) {
    return this.request<PrestashopSyncLog>(`/api/prestashop/connections/${connectionId}/sync`, { method: 'POST', auth: true });
  }

  private setAuth(auth: AuthResponse) {
    this.accessToken = auth.accessToken;
    this.refreshToken = auth.refreshToken;
    localStorage.setItem('oceanerp.accessToken', auth.accessToken);
    localStorage.setItem('oceanerp.refreshToken', auth.refreshToken);
    this.setUser(auth.user);
    window.dispatchEvent(new Event('oceanerp.authChanged'));
  }

  private setUser(user: User) {
    this.currentUser = user;
    localStorage.setItem('oceanerp.user', JSON.stringify(user));
  }

  private readStoredUser() {
    const raw = localStorage.getItem('oceanerp.user');
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as User;
    } catch {
      localStorage.removeItem('oceanerp.user');
      return null;
    }
  }

  private async request<T>(path: string, options: RequestOptions = {}, retryOnUnauthorized = true): Promise<T> {
    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    if (options.auth && this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    if (response.status === 401 && options.auth && retryOnUnauthorized && (await this.refreshAuth())) {
      return this.request<T>(path, options, false);
    }

    if (!response.ok) {
      const message = await this.readError(response);
      throw new Error(message || `HTTP ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  private async readError(response: Response) {
    const text = await response.text();
    if (!text) {
      return '';
    }

    try {
      const payload = JSON.parse(text) as { error?: string; title?: string; detail?: string };
      return payload.error || payload.detail || payload.title || text;
    } catch {
      return text;
    }
  }

  private async refreshAuth() {
    if (!this.refreshToken) {
      this.logout();
      return false;
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken })
    });

    if (!response.ok) {
      this.logout();
      return false;
    }

    this.setAuth((await response.json()) as AuthResponse);
    return true;
  }

  private async download(path: string, fileName: string, retryOnUnauthorized = true) {
    const headers = new Headers();
    if (this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, { headers });
    if (response.status === 401 && retryOnUnauthorized && (await this.refreshAuth())) {
      await this.download(path, fileName, false);
      return;
    }

    if (!response.ok) {
      throw new Error(await this.readErrorMessage(response));
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  private openPendingDocumentWindow(message: string) {
    const opened = window.open('', '_blank');
    if (!opened) {
      return null;
    }

    opened.document.title = 'OceanERP';
    opened.document.body.style.fontFamily = 'Arial, sans-serif';
    opened.document.body.style.padding = '24px';
    opened.document.body.textContent = message;
    return opened;
  }

  private async blob(path: string, retryOnUnauthorized = true): Promise<Blob> {
    const headers = new Headers();
    if (this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, { headers });
    if (response.status === 401 && retryOnUnauthorized && (await this.refreshAuth())) {
      return this.blob(path, false);
    }

    if (!response.ok) {
      throw new Error(await this.readErrorMessage(response));
    }

    return response.blob();
  }

  private async readErrorMessage(response: Response) {
    const text = await response.text();
    if (!text.trim()) {
      return `HTTP ${response.status}`;
    }

    try {
      const json = JSON.parse(text) as { error?: string; title?: string; detail?: string };
      return json.error ?? json.detail ?? json.title ?? text;
    } catch {
      return text;
    }
  }
}

export const api = new ApiClient();
