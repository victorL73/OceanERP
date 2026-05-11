import type { AuthResponse, DashboardSummary, DriveFolder, DriveItem, NotificationItem, PagedResult, Product, Quote, Customer } from '../types';

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
  }

  summary() {
    return this.request<DashboardSummary>('/api/dashboard/summary', { auth: true });
  }

  customers() {
    return this.request<PagedResult<Customer>>('/api/customers', { auth: true });
  }

  products() {
    return this.request<PagedResult<Product>>('/api/products', { auth: true });
  }

  quotes() {
    return this.request<PagedResult<Quote>>('/api/quotes', { auth: true });
  }

  folders(parentFolderId?: string) {
    const query = parentFolderId ? `?parentFolderId=${parentFolderId}` : '';
    return this.request<DriveFolder[]>(`/api/drive/folders${query}`, { auth: true });
  }

  files(folderId?: string) {
    const query = folderId ? `?folderId=${folderId}` : '';
    return this.request<DriveItem[]>(`/api/drive/files${query}`, { auth: true });
  }

  notifications() {
    return this.request<NotificationItem[]>('/api/notifications', { auth: true });
  }

  private setAuth(auth: AuthResponse) {
    this.accessToken = auth.accessToken;
    this.refreshToken = auth.refreshToken;
    localStorage.setItem('oceanerp.accessToken', auth.accessToken);
    localStorage.setItem('oceanerp.refreshToken', auth.refreshToken);
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json');
    }

    if (options.auth && this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `HTTP ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }
}

export const api = new ApiClient();

