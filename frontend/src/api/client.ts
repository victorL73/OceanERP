import type {
  AuthResponse,
  Customer,
  DashboardSummary,
  DriveFolder,
  DriveItem,
  EmailMessage,
  Invoice,
  InvoiceDocument,
  MailAccount,
  NotificationItem,
  PagedResult,
  PrestashopConnection,
  PrestashopSyncLog,
  Product,
  Quote,
  QuoteDocument,
  SalesOrder,
  StockItem,
  StockMovement,
  Warehouse
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

type RequestOptions = RequestInit & { auth?: boolean };

export class ApiClient {
  private accessToken: string | null = localStorage.getItem('oceanerp.accessToken');
  private refreshToken: string | null = localStorage.getItem('oceanerp.refreshToken');

  get token() {
    return this.accessToken;
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
    localStorage.removeItem('oceanerp.accessToken');
    localStorage.removeItem('oceanerp.refreshToken');
    window.dispatchEvent(new Event('oceanerp.authChanged'));
  }

  summary() {
    return this.request<DashboardSummary>('/api/dashboard/summary', { auth: true });
  }

  customers() {
    return this.request<PagedResult<Customer>>('/api/customers', { auth: true });
  }

  createCustomer(payload: { code: string; companyName: string; vatNumber?: string; notes?: string }) {
    return this.request<Customer>('/api/customers', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ ...payload, contacts: [], addresses: [] })
    });
  }

  products() {
    return this.request<PagedResult<Product>>('/api/products', { auth: true });
  }

  createProduct(payload: { reference: string; name: string; description?: string; purchasePrice: number; salePrice: number; vatRate: number }) {
    return this.request<Product>('/api/products', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ ...payload, categoryId: null, mainSupplierId: null })
    });
  }

  quotes() {
    return this.request<PagedResult<Quote>>('/api/quotes', { auth: true });
  }

  createQuote(payload: { customerId: string; validUntil: string; lines: Array<{ description: string; quantity: number; unitPrice: number; discountRate: number; vatRate: number }> }) {
    return this.request<Quote>('/api/quotes', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(payload)
    });
  }

  generateQuotePdf(quoteId: string) {
    return this.request<QuoteDocument>(`/api/quotes/${quoteId}/pdf`, { method: 'POST', auth: true });
  }

  async downloadQuoteDocument(quoteId: string, documentId: string, fileName: string) {
    await this.download(`/api/quotes/${quoteId}/documents/${documentId}/download`, fileName);
  }

  folders(parentFolderId?: string) {
    const query = parentFolderId ? `?parentFolderId=${parentFolderId}` : '';
    return this.request<DriveFolder[]>(`/api/drive/folders${query}`, { auth: true });
  }

  createFolder(payload: { parentFolderId?: string | null; name: string }) {
    return this.request<DriveFolder>('/api/drive/folders', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(payload)
    });
  }

  files(folderId?: string) {
    const query = folderId ? `?folderId=${folderId}` : '';
    return this.request<DriveItem[]>(`/api/drive/files${query}`, { auth: true });
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

  notifications() {
    return this.request<NotificationItem[]>('/api/notifications', { auth: true });
  }

  orders() {
    return this.request<PagedResult<SalesOrder>>('/api/orders', { auth: true });
  }

  createOrder(payload: { customerId: string; warehouseId?: string | null; lines: Array<{ productId?: string | null; description: string; quantity: number; unitPrice: number }> }) {
    return this.request<SalesOrder>('/api/orders', { method: 'POST', auth: true, body: JSON.stringify(payload) });
  }

  changeOrderStatus(orderId: string, status: string) {
    return this.request<SalesOrder>(`/api/orders/${orderId}/status`, { method: 'POST', auth: true, body: JSON.stringify({ status }) });
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

  stockItems() {
    return this.request<StockItem[]>('/api/stock/items', { auth: true });
  }

  stockMovements() {
    return this.request<StockMovement[]>('/api/stock/movements', { auth: true });
  }

  adjustStock(payload: { productId: string; warehouseId: string; quantity: number; reason: string; alertThreshold?: number }) {
    return this.request('/api/stock/adjustments', { method: 'POST', auth: true, body: JSON.stringify(payload) });
  }

  mailAccounts() {
    return this.request<MailAccount[]>('/api/emails/accounts', { auth: true });
  }

  emailMessages() {
    return this.request<PagedResult<EmailMessage>>('/api/emails/messages', { auth: true });
  }

  createMailAccount(payload: { email: string; smtpHost: string; imapHost: string; smtpPort?: number; imapPort?: number; useSsl?: boolean; userName?: string; passwordSecretName?: string }) {
    return this.request<MailAccount>('/api/emails/accounts', { method: 'POST', auth: true, body: JSON.stringify(payload) });
  }

  sendEmail(payload: { mailAccountId: string; to: string; subject: string; body: string }) {
    return this.request<EmailMessage>('/api/emails/send', { method: 'POST', auth: true, body: JSON.stringify(payload) });
  }

  prestashopConnections() {
    return this.request<PrestashopConnection[]>('/api/prestashop/connections', { auth: true });
  }

  prestashopLogs() {
    return this.request<PrestashopSyncLog[]>('/api/prestashop/sync-logs', { auth: true });
  }

  createPrestashopConnection(payload: { shopUrl: string; apiKeySecretName: string }) {
    return this.request<PrestashopConnection>('/api/prestashop/connections', { method: 'POST', auth: true, body: JSON.stringify(payload) });
  }

  runPrestashopSync(connectionId: string) {
    return this.request<PrestashopSyncLog>(`/api/prestashop/connections/${connectionId}/sync`, { method: 'POST', auth: true });
  }

  private setAuth(auth: AuthResponse) {
    this.accessToken = auth.accessToken;
    this.refreshToken = auth.refreshToken;
    localStorage.setItem('oceanerp.accessToken', auth.accessToken);
    localStorage.setItem('oceanerp.refreshToken', auth.refreshToken);
    window.dispatchEvent(new Event('oceanerp.authChanged'));
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
      const message = await response.text();
      throw new Error(message || `HTTP ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
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
      throw new Error(await response.text());
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
}

export const api = new ApiClient();
