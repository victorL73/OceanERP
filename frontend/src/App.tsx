import { type ChangeEvent, type DragEvent, type FormEvent, type ReactNode, isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { ArrowDownAZ, ArrowUpAZ, Bell, Box, BriefcaseBusiness, Download, FileText, Folder, Forward, Grid2X2, Image as ImageIcon, KeyRound, LayoutDashboard, List, LogOut, Mail, Package, Paperclip, Pencil, Plus, Reply, ReplyAll, Save, Search, Settings as SettingsIcon, ShieldCheck, ShoppingBag, ShoppingCart, Store, Trash2, Upload, UserRound, Users, Warehouse as WarehouseIcon, X } from 'lucide-react';
import { api } from './api/client';
import type { AuditLog, Customer, DashboardSummary, DocumentLink, DriveFolder, DriveItem, EmailMessage, EmailSyncSummary, EmailTemplate, Invoice, MailAccount, MailServerSettings, NotificationItem, PagedResult, Permission, PrestashopConnection, PrestashopSyncLog, Product, ProductSupplier, PurchaseOrder, Quote, QuoteSettings, Role, SalesOrder, StockItem, StockMovement, User, Warehouse } from './types';

type ViewKey = 'dashboard' | 'settings' | 'customers' | 'products' | 'quotes' | 'drive' | 'notifications' | 'orders' | 'purchases' | 'invoices' | 'stock' | 'emails' | 'prestashop';

const navViews: Array<{ key: Exclude<ViewKey, 'settings'>; label: string; icon: typeof LayoutDashboard; permission?: string }> = [
  { key: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, permission: 'dashboard.read' },
  { key: 'customers', label: 'Clients', icon: Users, permission: 'customers.read' },
  { key: 'products', label: 'Produits', icon: Package, permission: 'products.read' },
  { key: 'quotes', label: 'Devis', icon: FileText, permission: 'quotes.read' },
  { key: 'orders', label: 'Commandes', icon: ShoppingCart, permission: 'orders.read' },
  { key: 'purchases', label: 'Achats', icon: ShoppingBag, permission: 'purchases.read' },
  { key: 'invoices', label: 'Factures', icon: FileText, permission: 'invoices.read' },
  { key: 'stock', label: 'Stock', icon: WarehouseIcon, permission: 'stock.read' },
  { key: 'emails', label: 'Emails', icon: Mail, permission: 'emails.read' },
  { key: 'prestashop', label: 'PrestaShop', icon: Store, permission: 'prestashop.read' },
  { key: 'drive', label: 'Drive', icon: Folder, permission: 'drive.read' },
  { key: 'notifications', label: 'Notifications', icon: Bell, permission: 'notifications.read' }
];

const viewLabels: Record<ViewKey, string> = {
  dashboard: 'Tableau de bord',
  settings: 'Parametres',
  customers: 'Clients',
  products: 'Produits',
  quotes: 'Devis',
  orders: 'Commandes',
  purchases: 'Achats fournisseurs',
  invoices: 'Factures',
  stock: 'Stock',
  emails: 'Emails',
  prestashop: 'PrestaShop',
  drive: 'Drive',
  notifications: 'Notifications'
};

const EMAIL_JOURNAL_AUTO_REFRESH_MS = 15000;

type WarehouseDraft = {
  name: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  country: string;
  representativeName: string;
  phone: string;
  email: string;
  notes: string;
};

const emptyWarehouseDraft: WarehouseDraft = {
  name: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  country: '',
  representativeName: '',
  phone: '',
  email: '',
  notes: ''
};

function warehouseToDraft(warehouse?: Warehouse): WarehouseDraft {
  return {
    name: warehouse?.name ?? '',
    addressLine1: warehouse?.addressLine1 ?? '',
    addressLine2: warehouse?.addressLine2 ?? '',
    postalCode: warehouse?.postalCode ?? '',
    city: warehouse?.city ?? '',
    country: warehouse?.country ?? '',
    representativeName: warehouse?.representativeName ?? '',
    phone: warehouse?.phone ?? '',
    email: warehouse?.email ?? '',
    notes: warehouse?.notes ?? ''
  };
}

function hasPermission(user: User | null, permission?: string) {
  return !permission || Boolean(user && (user.roles.includes('Administrator') || user.permissions.includes(permission)));
}

export default function App() {
  const [isAuthenticated, setAuthenticated] = useState(Boolean(api.token));
  const [view, setView] = useState<ViewKey>('dashboard');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(api.user);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [customers, setCustomers] = useState<PagedResult<Customer> | null>(null);
  const [products, setProducts] = useState<PagedResult<Product> | null>(null);
  const [quotes, setQuotes] = useState<PagedResult<Quote> | null>(null);
  const [quoteSettings, setQuoteSettings] = useState<QuoteSettings | null>(null);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [files, setFiles] = useState<DriveItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [orders, setOrders] = useState<PagedResult<SalesOrder> | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PagedResult<PurchaseOrder> | null>(null);
  const [productSuppliers, setProductSuppliers] = useState<ProductSupplier[]>([]);
  const [invoices, setInvoices] = useState<PagedResult<Invoice> | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [mailAccounts, setMailAccounts] = useState<MailAccount[]>([]);
  const [mailServerSettings, setMailServerSettings] = useState<MailServerSettings | null>(null);
  const [emailMessages, setEmailMessages] = useState<PagedResult<EmailMessage> | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [prestashopConnections, setPrestashopConnections] = useState<PrestashopConnection[]>([]);
  const [prestashopLogs, setPrestashopLogs] = useState<PrestashopSyncLog[]>([]);
  const [stockFocusProductIds, setStockFocusProductIds] = useState<string[]>([]);
  const visibleViews = useMemo(() => navViews.filter((item) => hasPermission(currentUser, item.permission)), [currentUser]);

  async function refreshPrestashopData() {
    const [nextConnections, nextLogs] = await Promise.all([api.prestashopConnections(), api.prestashopLogs()]);
    setPrestashopConnections(nextConnections);
    setPrestashopLogs(nextLogs);
  }

  useEffect(() => {
    const syncAuthState = () => {
      setAuthenticated(Boolean(api.token));
      setCurrentUser(api.user);
    };
    window.addEventListener('oceanerp.authChanged', syncAuthState);
    return () => window.removeEventListener('oceanerp.authChanged', syncAuthState);
  }, []);

  async function load(target: ViewKey) {
    setLoading(true);
    setError(null);
    try {
      if (target === 'dashboard') {
        setSummary(await api.summary());
      }
      if (target === 'settings') {
        const user = await api.me();
        setCurrentUser(user);
        if (hasPermission(user, 'auth.users.read')) {
          const [nextUsers, nextRoles, nextPermissions, nextAuditLogs] = await Promise.all([api.users(), api.roles(), api.permissions(), api.auditLogs()]);
          setUsers(nextUsers);
          setRoles(nextRoles);
          setPermissions(nextPermissions);
          setAuditLogs(nextAuditLogs);
        }
        if (hasPermission(user, 'prestashop.read') && hasPermission(user, 'prestashop.write')) {
          setPrestashopConnections(await api.prestashopConnections());
        }
        if (hasPermission(user, 'stock.read')) {
          setWarehouses(await api.warehouses());
        }
        if (hasPermission(user, 'emails.read')) {
          const [nextMailAccounts, nextTemplates, nextServerSettings] = await Promise.all([api.mailAccounts(), api.emailTemplates(), api.mailServerSettings()]);
          setMailAccounts(nextMailAccounts);
          setEmailTemplates(nextTemplates);
          setMailServerSettings(nextServerSettings);
        }
        if (user.roles.includes('Administrator') && hasPermission(user, 'quotes.read')) {
          setQuoteSettings(await api.quoteSettings());
        }
      }
      if (target === 'customers') {
        setCustomers(await api.customers());
      }
      if (target === 'products') {
        setProducts(await api.products());
      }
      if (target === 'quotes') {
        const [nextQuotes, nextCustomers, nextProducts, nextMailAccounts, nextWarehouses] = await Promise.all([api.quotes(), api.customers(), api.products(), api.mailAccounts(), api.warehouses()]);
        setQuotes(nextQuotes);
        setCustomers(nextCustomers);
        setProducts(nextProducts);
        setMailAccounts(nextMailAccounts);
        setWarehouses(nextWarehouses);
      }
      if (target === 'drive') {
        const [nextFolders, nextFiles] = await Promise.all([api.folders(), api.files()]);
        setFolders(nextFolders);
        setFiles(nextFiles);
      }
      if (target === 'orders') {
        const [nextOrders, nextCustomers, nextProducts, nextWarehouses] = await Promise.all([api.orders(), api.customers(), api.products(), api.warehouses()]);
        setOrders(nextOrders);
        setCustomers(nextCustomers);
        setProducts(nextProducts);
        setWarehouses(nextWarehouses);
      }
      if (target === 'purchases') {
        const [nextPurchaseOrders, nextProducts, nextSuppliers, nextWarehouses, nextStockItems] = await Promise.all([api.purchaseOrders(), api.products(), api.productSuppliers(), api.warehouses(), api.stockItems()]);
        setPurchaseOrders(nextPurchaseOrders);
        setProducts(nextProducts);
        setProductSuppliers(nextSuppliers);
        setWarehouses(nextWarehouses);
        setStockItems(nextStockItems);
      }
      if (target === 'invoices') {
        const [nextInvoices, nextOrders] = await Promise.all([api.invoices(), api.orders()]);
        setInvoices(nextInvoices);
        setOrders(nextOrders);
      }
      if (target === 'stock') {
        const [nextWarehouses, nextStockItems, nextProducts, nextMovements, nextPrestashopConnections, nextPurchaseOrders] = await Promise.all([
          api.warehouses(),
          api.stockItems(),
          api.products(),
          api.stockMovements(),
          hasPermission(currentUser, 'prestashop.read') ? api.prestashopConnections() : Promise.resolve(prestashopConnections),
          hasPermission(currentUser, 'purchases.read') ? api.purchaseOrders() : Promise.resolve(purchaseOrders)
        ]);
        setWarehouses(nextWarehouses);
        setStockItems(nextStockItems);
        setProducts(nextProducts);
        setStockMovements(nextMovements);
        setPrestashopConnections(nextPrestashopConnections);
        setPurchaseOrders(nextPurchaseOrders);
      }
      if (target === 'emails') {
        const [nextAccounts, nextMessages, nextTemplates, nextCustomers] = await Promise.all([
          api.mailAccounts(),
          api.emailMessages(),
          api.emailTemplates(),
          hasPermission(currentUser, 'customers.read') ? api.customers('', 1, 100) : Promise.resolve<PagedResult<Customer> | null>(null)
        ]);
        setMailAccounts(nextAccounts);
        setEmailMessages(nextMessages);
        setEmailTemplates(nextTemplates);
        setCustomers(nextCustomers);
      }
      if (target === 'prestashop') {
        await refreshPrestashopData();
      }
      if (target === 'notifications') {
        setNotifications(await api.notifications());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action impossible');
    } finally {
      setLoading(false);
    }
  }

  async function openNotification(item: NotificationItem) {
    if (item.linkUrl) {
      const link = new URL(item.linkUrl, window.location.origin);
      if (link.pathname === '/stock') {
        const productIds = (link.searchParams.get('products') ?? '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);
        setStockFocusProductIds(productIds);
        setView('stock');
      } else if (link.pathname === '/emails') {
        setView('emails');
      }
    }

    try {
      await api.markNotificationRead(item.id);
      setNotifications((items) => items.map((notification) => notification.id === item.id ? { ...notification, isRead: true } : notification));
    } catch {
      // La navigation reste prioritaire si l'accuse de lecture echoue.
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentUser(null);
      return;
    }

    api.me()
      .then(setCurrentUser)
      .catch(() => setAuthenticated(false));
  }, [isAuthenticated]);

  useEffect(() => {
    const currentView = navViews.find((item) => item.key === view);
    if (currentUser && currentView && !hasPermission(currentUser, currentView.permission)) {
      setView('dashboard');
    }
  }, [currentUser, view]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? window.location.origin;
    const connection = new HubConnectionBuilder()
      .withUrl(`${apiBaseUrl}/hubs/notifications`, { accessTokenFactory: () => api.token ?? '' })
      .withAutomaticReconnect()
      .build();

    connection.on('notificationCreated', (notification: NotificationItem) => {
      setNotifications((items) => [notification, ...items]);
      if (notification.type === 'emails.new') {
        api.emailMessages()
          .then(setEmailMessages)
          .catch(() => undefined);
        api.summary()
          .then(setSummary)
          .catch(() => undefined);
      }
    });

    connection.start().catch(() => undefined);
    return () => {
      connection.stop().catch(() => undefined);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    if (Notification.permission === 'default' && notifications.some((item) => !item.isRead)) {
      Notification.requestPermission().catch(() => undefined);
      return;
    }

    if (Notification.permission !== 'granted') {
      return;
    }

    const storageKey = 'oceanerp.browserNotifications.seen';
    const seen = new Set((localStorage.getItem(storageKey) ?? '').split(',').filter(Boolean));
    const nextSeen = new Set(seen);
    notifications
      .filter((item) => !item.isRead && !seen.has(item.id))
      .slice(0, 5)
      .forEach((item) => {
        new Notification(item.title, { body: item.message, tag: item.id });
        nextSeen.add(item.id);
      });
    localStorage.setItem(storageKey, Array.from(nextSeen).slice(-200).join(','));
  }, [isAuthenticated, notifications]);

  useEffect(() => {
    if (isAuthenticated) {
      load(view);
    }
  }, [isAuthenticated, view]);

  if (!isAuthenticated) {
    return (
      <Login
        onLoggedIn={() => {
          setCurrentUser(api.user);
          setAuthenticated(true);
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">OE</div>
          <div>
            <strong>OceanERP</strong>
            <span>Gestion commerciale</span>
          </div>
        </div>

        <nav className="nav-list">
          {visibleViews.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.key} className={view === item.key ? 'active' : ''} onClick={() => setView(item.key)}>
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <button className={view === 'settings' ? 'account-button active' : 'account-button'} onClick={() => setView('settings')}>
          <UserRound size={18} />
          <span>{currentUser?.displayName ?? 'Compte utilisateur'}</span>
          <small>Parametres</small>
        </button>

        <button
          className="logout"
          onClick={() => {
            api.logout();
            setCurrentUser(null);
            setAuthenticated(false);
          }}
        >
          <LogOut size={18} />
          <span>Deconnexion</span>
        </button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">ERP modulaire</p>
            <h1>{viewLabels[view]}</h1>
          </div>
          <div className="top-actions">
            <div className="search">
              <Search size={16} />
              <input aria-label="Recherche" placeholder="Rechercher" />
            </div>
            <button className="icon-button" title="Notifications" onClick={() => setView('notifications')}>
              <Bell size={18} />
              {notifications.some((item) => !item.isRead) && <span className="dot" />}
            </button>
          </div>
        </header>

        {error && <div className="alert">{error}</div>}
        {loading && <div className="loading">Chargement...</div>}

        {!loading && view === 'dashboard' && <Dashboard summary={summary} />}
        {!loading && view === 'settings' && (
          <Settings
            currentUser={currentUser}
            users={users}
            roles={roles}
            permissions={permissions}
            auditLogs={auditLogs}
            prestashopConnections={prestashopConnections}
            warehouses={warehouses}
            mailAccounts={mailAccounts}
            mailServerSettings={mailServerSettings}
            quoteSettings={quoteSettings}
            onUsersRolesChanged={() => load('settings')}
            onPrestashopChanged={() => load('settings')}
            onWarehousesChanged={() => load('settings')}
            onMailAccountsChanged={() => load('settings')}
            onMailServerSettingsChanged={() => load('settings')}
            onQuoteSettingsChanged={() => load('settings')}
            onUserChanged={setCurrentUser}
            onSignedOut={() => {
              api.logout();
              setCurrentUser(null);
              setAuthenticated(false);
            }}
          />
        )}
        {!loading && view === 'customers' && <Customers items={customers?.items ?? []} onChanged={() => load('customers')} />}
        {!loading && view === 'products' && <Products items={products?.items ?? []} onChanged={() => load('products')} />}
        {!loading && view === 'quotes' && <Quotes items={quotes?.items ?? []} customers={customers?.items ?? []} products={products?.items ?? []} mailAccounts={mailAccounts} warehouses={warehouses} onChanged={() => load('quotes')} />}
        {!loading && view === 'orders' && <Orders items={orders?.items ?? []} customers={customers?.items ?? []} products={products?.items ?? []} warehouses={warehouses} onChanged={() => load('orders')} />}
        {!loading && view === 'purchases' && <Purchases items={purchaseOrders?.items ?? []} suppliers={productSuppliers} products={products?.items ?? []} warehouses={warehouses} stockItems={stockItems} onChanged={() => load('purchases')} />}
        {!loading && view === 'invoices' && <Invoices items={invoices?.items ?? []} orders={orders?.items ?? []} onChanged={() => load('invoices')} />}
        {!loading && view === 'stock' && <Stock items={stockItems} movements={stockMovements} products={products?.items ?? []} warehouses={warehouses} purchaseOrders={purchaseOrders?.items ?? []} focusedProductIds={stockFocusProductIds} onClearFocusedProducts={() => setStockFocusProductIds([])} prestashopConnections={prestashopConnections} onChanged={() => load('stock')} />}
        {!loading && view === 'emails' && <Emails accounts={mailAccounts} messages={emailMessages?.items ?? []} templates={emailTemplates} customers={customers?.items ?? []} onChanged={() => load('emails')} />}
        {!loading && view === 'prestashop' && <Prestashop connections={prestashopConnections} logs={prestashopLogs} onChanged={refreshPrestashopData} />}
        {!loading && view === 'drive' && <Drive folders={folders} files={files} onChanged={() => load('drive')} />}
        {!loading && view === 'notifications' && <Notifications items={notifications} onOpen={openNotification} />}
      </main>
    </div>
  );
}

function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState('admin@oceanerp.local');
  const [password, setPassword] = useState('ChangeMe!12345');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api.login(email, password);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible');
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="brand large">
          <div className="brand-mark">OE</div>
          <div>
            <strong>OceanERP</strong>
            <span>Acces securise</span>
          </div>
        </div>
        <form onSubmit={submit}>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" />
          </label>
          <label>
            Mot de passe
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
          </label>
          {error && <div className="alert">{error}</div>}
          <button className="primary" type="submit">
            <ShieldCheck size={18} />
            Connexion
          </button>
        </form>
      </section>
    </main>
  );
}

function Dashboard({ summary }: { summary: DashboardSummary | null }) {
  const indicators = useMemo(
    () => [
      ['CA du mois', summary?.monthlyRevenue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) ?? '0 EUR'],
      ['Devis en attente', summary?.pendingQuotes ?? 0],
      ['Factures impayees', summary?.unpaidInvoices ?? 0],
      ['Commandes en cours', summary?.openOrders ?? 0],
      ['Stock bas', summary?.lowStockItems ?? 0],
      ['SAV ouverts', summary?.openServiceTickets ?? 0],
      ['Nouveaux emails', summary?.newEmails ?? 0],
      ['Documents recents', summary?.recentDocuments ?? 0]
    ],
    [summary]
  );

  return (
    <section className="grid metrics">
      {indicators.map(([label, value]) => (
        <article className="metric-card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}

function Settings({
  currentUser,
  users,
  roles,
  permissions,
  auditLogs,
  prestashopConnections,
  warehouses,
  mailAccounts,
  mailServerSettings,
  quoteSettings,
  onUsersRolesChanged,
  onPrestashopChanged,
  onWarehousesChanged,
  onMailAccountsChanged,
  onMailServerSettingsChanged,
  onQuoteSettingsChanged,
  onUserChanged,
  onSignedOut
}: {
  currentUser: User | null;
  users: User[];
  roles: Role[];
  permissions: Permission[];
  auditLogs: AuditLog[];
  prestashopConnections: PrestashopConnection[];
  warehouses: Warehouse[];
  mailAccounts: MailAccount[];
  mailServerSettings: MailServerSettings | null;
  quoteSettings: QuoteSettings | null;
  onUsersRolesChanged: () => Promise<void>;
  onPrestashopChanged: () => Promise<void>;
  onWarehousesChanged: () => Promise<void>;
  onMailAccountsChanged: () => Promise<void>;
  onMailServerSettingsChanged: () => Promise<void>;
  onQuoteSettingsChanged: () => Promise<void>;
  onUserChanged: (user: User) => void;
  onSignedOut: () => void;
}) {
  const canManageUsers = hasPermission(currentUser, 'auth.users.read') && hasPermission(currentUser, 'auth.users.write');
  const canManagePrestashop = hasPermission(currentUser, 'prestashop.read') && hasPermission(currentUser, 'prestashop.write');
  const canManageWarehouses = hasPermission(currentUser, 'stock.read') && hasPermission(currentUser, 'stock.write');
  const canManageEmails = hasPermission(currentUser, 'emails.read') && hasPermission(currentUser, 'emails.write');
  const isAdministrator = Boolean(currentUser?.roles.includes('Administrator'));
  const canManageQuoteSettings = isAdministrator && hasPermission(currentUser, 'quotes.read') && hasPermission(currentUser, 'quotes.write');
  const [activeTab, setActiveTab] = useState<'account' | 'emails' | 'quotes' | 'access' | 'audit' | 'warehouses' | 'prestashop'>('account');
  const [email, setEmail] = useState(currentUser?.email ?? '');
  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  useEffect(() => {
    setEmail(currentUser?.email ?? '');
    setDisplayName(currentUser?.displayName ?? '');
  }, [currentUser]);

  useEffect(() => {
    if ((activeTab === 'emails' && !canManageEmails) || (activeTab === 'quotes' && !canManageQuoteSettings) || ((activeTab === 'access' || activeTab === 'audit') && !canManageUsers) || (activeTab === 'warehouses' && !canManageWarehouses) || (activeTab === 'prestashop' && !canManagePrestashop)) {
      setActiveTab('account');
    }
  }, [activeTab, canManageEmails, canManagePrestashop, canManageQuoteSettings, canManageUsers, canManageWarehouses]);

  async function updateProfile(event: FormEvent) {
    event.preventDefault();
    setProfileMessage(null);
    try {
      const user = await api.updateProfile({ email, displayName });
      onUserChanged(user);
      setProfileMessage('Profil mis a jour.');
    } catch (err) {
      setProfileMessage(err instanceof Error ? err.message : 'Mise a jour impossible');
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordMessage(null);
    if (newPassword !== confirmPassword) {
      setPasswordMessage('Les mots de passe ne correspondent pas.');
      return;
    }

    try {
      await api.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage('Mot de passe modifie. Reconnexion requise.');
      window.setTimeout(onSignedOut, 900);
    } catch (err) {
      setPasswordMessage(err instanceof Error ? err.message : 'Modification impossible');
    }
  }

  const tabs = [
    { key: 'account' as const, label: 'Compte' },
    ...(canManageEmails ? [{ key: 'emails' as const, label: 'Boites mail' }] : []),
    ...(canManageQuoteSettings ? [{ key: 'quotes' as const, label: 'Devis' }] : []),
    ...(canManageUsers ? [{ key: 'access' as const, label: 'Utilisateurs/Roles' }] : []),
    ...(canManageUsers ? [{ key: 'audit' as const, label: 'Journal audit' }] : []),
    ...(canManageWarehouses ? [{ key: 'warehouses' as const, label: 'Entrepots' }] : []),
    ...(canManagePrestashop ? [{ key: 'prestashop' as const, label: 'PrestaShop' }] : [])
  ];

  return (
    <>
      <div className="browser-tabs" role="tablist" aria-label="Parametres">
        {tabs.map((tab) => (
          <button key={tab.key} className={activeTab === tab.key ? 'active' : ''} onClick={() => setActiveTab(tab.key)} type="button">
            {tab.label}
          </button>
        ))}
      </div>

      <section className="tab-page">
        {activeTab === 'account' && (
          <>
            <Panel title="Compte personnel">
              <form className="form-grid" onSubmit={updateProfile}>
                <input required type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
                <input required placeholder="Nom affiche" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                <input readOnly value={currentUser?.roles.join(', ') ?? ''} aria-label="Roles" />
                <button className="primary" type="submit">
                  <SettingsIcon size={16} />
                  Enregistrer
                </button>
              </form>
              {profileMessage && <div className="inline-message">{profileMessage}</div>}
            </Panel>

            <Panel title="Mot de passe">
              <form className="form-grid" onSubmit={changePassword}>
                <input required type="password" autoComplete="current-password" placeholder="Mot de passe actuel" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
                <input required type="password" autoComplete="new-password" placeholder="Nouveau mot de passe" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                <input required type="password" autoComplete="new-password" placeholder="Confirmation" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                <button className="primary" type="submit">
                  <KeyRound size={16} />
                  Modifier
                </button>
              </form>
              {passwordMessage && <div className="inline-message">{passwordMessage}</div>}
            </Panel>
          </>
        )}

        {activeTab === 'emails' && canManageEmails && <MailAccountSettings accounts={mailAccounts} serverSettings={mailServerSettings} users={users} currentUser={currentUser} canAssignUsers={canManageUsers} canManageServerSettings={isAdministrator} onChanged={onMailAccountsChanged} onServerSettingsChanged={onMailServerSettingsChanged} />}
        {activeTab === 'quotes' && canManageQuoteSettings && <QuoteSettingsPanel settings={quoteSettings} onChanged={onQuoteSettingsChanged} />}
        {activeTab === 'access' && canManageUsers && <UsersRoles users={users} roles={roles} permissions={permissions} onChanged={onUsersRolesChanged} />}
        {activeTab === 'audit' && canManageUsers && <AuditLogs logs={auditLogs} />}
        {activeTab === 'warehouses' && canManageWarehouses && <WarehousesSettings warehouses={warehouses} onChanged={onWarehousesChanged} />}
        {activeTab === 'prestashop' && canManagePrestashop && <PrestashopSettings connections={prestashopConnections} warehouses={warehouses} onChanged={onPrestashopChanged} />}
      </section>
    </>
  );
}

function QuoteSettingsPanel({ settings, onChanged }: { settings: QuoteSettings | null; onChanged: () => Promise<void> }) {
  const [companyName, setCompanyName] = useState(settings?.companyName ?? 'OceanERP');
  const [addressLine1, setAddressLine1] = useState(settings?.addressLine1 ?? '');
  const [addressLine2, setAddressLine2] = useState(settings?.addressLine2 ?? '');
  const [postalCode, setPostalCode] = useState(settings?.postalCode ?? '');
  const [city, setCity] = useState(settings?.city ?? '');
  const [country, setCountry] = useState(settings?.country ?? '');
  const [phone, setPhone] = useState(settings?.phone ?? '');
  const [email, setEmail] = useState(settings?.email ?? '');
  const [website, setWebsite] = useState(settings?.website ?? '');
  const [vatNumber, setVatNumber] = useState(settings?.vatNumber ?? '');
  const [siret, setSiret] = useState(settings?.siret ?? '');
  const [legalText, setLegalText] = useState(settings?.legalText ?? '');
  const [footerText, setFooterText] = useState(settings?.footerText ?? '');
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setCompanyName(settings?.companyName ?? 'OceanERP');
    setAddressLine1(settings?.addressLine1 ?? '');
    setAddressLine2(settings?.addressLine2 ?? '');
    setPostalCode(settings?.postalCode ?? '');
    setCity(settings?.city ?? '');
    setCountry(settings?.country ?? '');
    setPhone(settings?.phone ?? '');
    setEmail(settings?.email ?? '');
    setWebsite(settings?.website ?? '');
    setVatNumber(settings?.vatNumber ?? '');
    setSiret(settings?.siret ?? '');
    setLegalText(settings?.legalText ?? '');
    setFooterText(settings?.footerText ?? '');
  }, [settings]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setFeedback(null);
    try {
      await api.updateQuoteSettings({ companyName, addressLine1, addressLine2, postalCode, city, country, phone, email, website, vatNumber, siret, legalText, footerText });
      setFeedback('Personnalisation des devis enregistree.');
      await onChanged();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
  }

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setFeedback(null);
    try {
      await api.uploadQuoteLogo(file);
      setFeedback('Logo des devis mis a jour.');
      await onChanged();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Upload du logo impossible.');
    } finally {
      event.target.value = '';
    }
  }

  async function deleteLogo() {
    setFeedback(null);
    try {
      await api.deleteQuoteLogo();
      setFeedback('Logo supprime.');
      await onChanged();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Suppression du logo impossible.');
    }
  }

  return (
    <>
      <Panel title="Identite devis">
        <form className="form-grid quote-settings-form" onSubmit={save}>
          <label className="field">
            <span>Nom entreprise</span>
            <input required value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
          </label>
          <label className="field">
            <span>Adresse</span>
            <input value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} />
          </label>
          <label className="field">
            <span>Complement</span>
            <input value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} />
          </label>
          <label className="field">
            <span>Code postal</span>
            <input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
          </label>
          <label className="field">
            <span>Ville</span>
            <input value={city} onChange={(event) => setCity(event.target.value)} />
          </label>
          <label className="field">
            <span>Pays</span>
            <input value={country} onChange={(event) => setCountry(event.target.value)} />
          </label>
          <label className="field">
            <span>Telephone</span>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="field">
            <span>Site web</span>
            <input value={website} onChange={(event) => setWebsite(event.target.value)} />
          </label>
          <label className="field">
            <span>TVA intracom</span>
            <input value={vatNumber} onChange={(event) => setVatNumber(event.target.value)} />
          </label>
          <label className="field">
            <span>SIRET</span>
            <input value={siret} onChange={(event) => setSiret(event.target.value)} />
          </label>
          <label className="field full-field">
            <span>Mentions legales / conditions devis</span>
            <textarea value={legalText} onChange={(event) => setLegalText(event.target.value)} />
          </label>
          <label className="field full-field">
            <span>Pied de page</span>
            <textarea value={footerText} onChange={(event) => setFooterText(event.target.value)} />
          </label>
          <div className="form-actions">
            <button className="primary" type="submit">
              <Save size={16} />
              Enregistrer
            </button>
          </div>
        </form>
        {feedback && <div className="inline-message">{feedback}</div>}
        <p className="panel-note">Ces informations seront appliquees aux prochains PDF de devis generes.</p>
      </Panel>

      <Panel title="Logo devis">
        <div className="quote-logo-settings">
          <div className="quote-logo-preview">
            {settings?.logoDataUrl ? <img src={settings.logoDataUrl} alt="Logo devis" /> : <span>Aucun logo</span>}
          </div>
          <div className="quote-logo-actions">
            <strong>{settings?.logoFileName ?? 'Logo non configure'}</strong>
            {settings?.logoSize && <span>{Math.round(settings.logoSize / 1024)} Ko</span>}
            <label className="upload-button">
              <Upload size={16} />
              Importer un logo
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo} />
            </label>
            {settings?.hasLogo && (
              <button className="danger" type="button" onClick={deleteLogo}>
                <Trash2 size={16} />
                Supprimer le logo
              </button>
            )}
          </div>
        </div>
      </Panel>
    </>
  );
}

function MailAccountSettings({
  accounts,
  serverSettings,
  users,
  currentUser,
  canAssignUsers,
  canManageServerSettings,
  onChanged,
  onServerSettingsChanged
}: {
  accounts: MailAccount[];
  serverSettings: MailServerSettings | null;
  users: User[];
  currentUser: User | null;
  canAssignUsers: boolean;
  canManageServerSettings: boolean;
  onChanged: () => Promise<void>;
  onServerSettingsChanged: () => Promise<void>;
}) {
  const [editingAccountId, setEditingAccountId] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [signatureHtml, setSignatureHtml] = useState('');
  const [smtpHost, setSmtpHost] = useState(serverSettings?.smtpHost ?? '');
  const [smtpPort, setSmtpPort] = useState(String(serverSettings?.smtpPort ?? 587));
  const [imapHost, setImapHost] = useState(serverSettings?.imapHost ?? '');
  const [imapPort, setImapPort] = useState(String(serverSettings?.imapPort ?? 993));
  const [useSsl, setUseSsl] = useState(serverSettings?.useSsl ?? true);
  const [imapAutoSyncEnabled, setImapAutoSyncEnabled] = useState(serverSettings?.imapAutoSyncEnabled ?? true);
  const [imapSyncIntervalMinutes, setImapSyncIntervalMinutes] = useState(String(serverSettings?.imapSyncIntervalMinutes ?? 5));
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordSecretName, setPasswordSecretName] = useState('');
  const [clearPassword, setClearPassword] = useState(false);
  const [accountActive, setAccountActive] = useState(true);
  const [authorizedUserIds, setAuthorizedUserIds] = useState<string[]>(currentUser?.id ? [currentUser.id] : []);
  const [feedback, setFeedback] = useState<string | null>(null);
  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  useEffect(() => {
    setSmtpHost(serverSettings?.smtpHost ?? '');
    setSmtpPort(String(serverSettings?.smtpPort ?? 587));
    setImapHost(serverSettings?.imapHost ?? '');
    setImapPort(String(serverSettings?.imapPort ?? 993));
    setUseSsl(serverSettings?.useSsl ?? true);
    setImapAutoSyncEnabled(serverSettings?.imapAutoSyncEnabled ?? true);
    setImapSyncIntervalMinutes(String(serverSettings?.imapSyncIntervalMinutes ?? 5));
  }, [serverSettings]);

  function resetAccountForm() {
    setEditingAccountId('');
    setEmail('');
    setDisplayName('');
    setSignatureHtml('');
    setUserName('');
    setPassword('');
    setPasswordSecretName('');
    setClearPassword(false);
    setAccountActive(true);
    setAuthorizedUserIds(currentUser?.id ? [currentUser.id] : []);
  }

  function startEditAccount(account: MailAccount) {
    setEditingAccountId(account.id);
    setEmail(account.email);
    setDisplayName(account.displayName ?? '');
    setSignatureHtml(account.signatureHtml ?? '');
    setUserName(account.userName ?? account.email);
    setPassword('');
    setPasswordSecretName(account.passwordSecretName === 'DATABASE_PROTECTED' ? '' : account.passwordSecretName ?? '');
    setClearPassword(false);
    setAccountActive(account.isActive);
    setAuthorizedUserIds(account.authorizedUserIds.length > 0 ? account.authorizedUserIds : currentUser?.id ? [currentUser.id] : []);
  }

  async function saveServerSettings(event: FormEvent) {
    event.preventDefault();
    setFeedback(null);
    try {
      await api.updateMailServerSettings({
        smtpHost,
        smtpPort: Number(smtpPort),
        imapHost,
        imapPort: Number(imapPort),
        useSsl,
        imapAutoSyncEnabled,
        imapSyncIntervalMinutes: Number(imapSyncIntervalMinutes)
      });
      setFeedback('Serveurs SMTP/IMAP mis a jour.');
      await onServerSettingsChanged();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Configuration serveurs impossible.');
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFeedback(null);
    const payload = {
      email,
      displayName,
      signatureHtml,
      userName,
      password,
      passwordSecretName,
      clearPassword,
      isActive: accountActive,
      authorizedUserIds: canAssignUsers ? authorizedUserIds : undefined
    };

    try {
      if (editingAccountId) {
        await api.updateMailAccount(editingAccountId, payload);
        setFeedback('Boite mail mise a jour.');
      } else {
        await api.createMailAccount(payload);
        setFeedback('Boite mail creee.');
      }

      resetAccountForm();
      await onChanged();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Configuration mail impossible.');
    }
  }

  async function testAccount(account: MailAccount) {
    setFeedback(null);
    try {
      await api.testMailAccount(account.id);
      setFeedback('Test SMTP OK. Si EMAIL_ENABLE_SMTP_SENDING=false, le test valide seulement la configuration locale.');
      await onChanged();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Test SMTP impossible.');
    }
  }

  async function syncAccount(account: MailAccount) {
    setFeedback(null);
    try {
      const result = await api.syncMailAccount(account.id);
      setFeedback(`${result.imported} email(s) importe(s) depuis IMAP.`);
      await onChanged();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Synchronisation IMAP impossible.');
    }
  }

  async function deleteAccount(account: MailAccount) {
    if (!window.confirm(`Supprimer la boite ${account.email} ?`)) {
      return;
    }

    setFeedback(null);
    try {
      await api.deleteMailAccount(account.id);
      setFeedback('Boite mail supprimee.');
      await onChanged();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Suppression impossible.');
    }
  }

  function accessLabel(account: MailAccount) {
    if (account.authorizedUserIds.length === 0) {
      return 'Aucun utilisateur affecte';
    }

    return account.authorizedUserIds
      .map((id) => userById.get(id)?.displayName ?? userById.get(id)?.email ?? id)
      .join(', ');
  }

  return (
    <>
      {canManageServerSettings && (
        <Panel title="Serveurs SMTP / IMAP">
          <form className="email-account-form" onSubmit={saveServerSettings}>
            <label className="field">
              <span>SMTP</span>
              <input required placeholder="smtp.exemple.fr" value={smtpHost} onChange={(event) => setSmtpHost(event.target.value)} />
            </label>
            <label className="field">
              <span>Port SMTP</span>
              <input required type="number" min="1" max="65535" value={smtpPort} onChange={(event) => setSmtpPort(event.target.value)} />
            </label>
            <label className="field">
              <span>IMAP</span>
              <input required placeholder="imap.exemple.fr" value={imapHost} onChange={(event) => setImapHost(event.target.value)} />
            </label>
            <label className="field">
              <span>Port IMAP</span>
              <input required type="number" min="1" max="65535" value={imapPort} onChange={(event) => setImapPort(event.target.value)} />
            </label>
            <label className="check-field">
              <input type="checkbox" checked={useSsl} onChange={(event) => setUseSsl(event.target.checked)} />
              TLS/SSL actif
            </label>
            <label className="check-field">
              <input type="checkbox" checked={imapAutoSyncEnabled} onChange={(event) => setImapAutoSyncEnabled(event.target.checked)} />
              Synchronisation IMAP automatique
            </label>
            <label className="field">
              <span>Frequence IMAP automatique (minutes, 0 = rapide)</span>
              <input required type="number" min="0" max="1440" value={imapSyncIntervalMinutes} onChange={(event) => setImapSyncIntervalMinutes(event.target.value)} />
            </label>
            <div className="form-actions">
              <button className="primary" type="submit">
                <Save size={16} />
                Enregistrer les serveurs
              </button>
            </div>
          </form>
          <p className="panel-note">Ces serveurs sont communs a toutes les boites. Les utilisateurs ne gerent pas les hotes SMTP/IMAP. Mettez 0 pour une releve serveur rapide toutes les 15 secondes.</p>
        </Panel>
      )}

      <Panel title={editingAccountId ? 'Modifier boite mail' : 'Nouvelle boite mail'}>
        <form className="email-account-form" onSubmit={submit}>
          <label className="field">
            <span>Email</span>
            <input required readOnly={!canManageServerSettings} type="email" placeholder="contact@entreprise.fr" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="field">
            <span>Nom affiche</span>
            <input placeholder="Commercial, SAV, Direction..." value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <label className="field">
            <span>Utilisateur</span>
            <input readOnly={!canManageServerSettings} placeholder="Souvent identique a l'email" value={userName} onChange={(event) => setUserName(event.target.value)} />
          </label>
          <label className="field">
            <span>Mot de passe</span>
            <input disabled={!canManageServerSettings} type="password" placeholder={editingAccountId ? 'Laisser vide pour conserver' : 'Mot de passe SMTP/IMAP'} value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label className="field">
            <span>Secret env optionnel</span>
            <input disabled={!canManageServerSettings} placeholder="SMTP_MAIN_PASSWORD" value={passwordSecretName} onChange={(event) => setPasswordSecretName(event.target.value)} />
          </label>
          <label className="field full-field">
            <span>Signature HTML</span>
            <textarea className="mail-body-input" placeholder="<p>Cordialement,<br>OceanERP</p>" value={signatureHtml} onChange={(event) => setSignatureHtml(event.target.value)} />
          </label>
          {canAssignUsers && (
            <MultiSelect label="Utilisateurs autorises" values={authorizedUserIds} options={users.map((user) => user.id)} labels={Object.fromEntries(users.map((user) => [user.id, `${user.displayName} <${user.email}>`]))} onChange={setAuthorizedUserIds} />
          )}
          {canManageServerSettings && <label className="check-field">
            <input type="checkbox" checked={accountActive} onChange={(event) => setAccountActive(event.target.checked)} />
            Boite active
          </label>}
          {editingAccountId && canManageServerSettings && (
            <label className="check-field">
              <input type="checkbox" checked={clearPassword} onChange={(event) => setClearPassword(event.target.checked)} />
              Effacer le mot de passe stocke
            </label>
          )}
          <div className="form-actions">
            {editingAccountId && (
              <button className="secondary" type="button" onClick={resetAccountForm}>
                Annuler
              </button>
            )}
            <button className="primary" type="submit">
              <Save size={16} />
              Enregistrer
            </button>
          </div>
        </form>
        {feedback && <div className="inline-message">{feedback}</div>}
        <p className="panel-note">Les boites configurees ici apparaissent ensuite dans l'onglet Emails et dans l'envoi des devis uniquement pour les utilisateurs autorises.</p>
      </Panel>
      <DataTable
        columns={['Boite', 'Signature', 'Acces', 'Mot de passe', 'Statut', 'Actions']}
        rows={accounts.map((account) => [
          account.displayName ? `${account.displayName} <${account.email}>` : account.email,
          account.signatureHtml ? 'Configuree' : '-',
          accessLabel(account),
          account.hasPassword ? 'Configure' : 'Manquant',
          account.isActive ? 'Actif' : 'Inactif',
          <div className="table-actions" key={account.id}>
            <button className="secondary icon-button" title="Modifier" type="button" onClick={() => startEditAccount(account)}>
              <Pencil size={16} />
            </button>
            <button className="secondary" type="button" onClick={() => testAccount(account)}>
              Test SMTP
            </button>
            <button className="secondary" type="button" onClick={() => syncAccount(account)}>
              Sync IMAP
            </button>
            <button className="danger icon-button" title="Supprimer" type="button" onClick={() => deleteAccount(account)}>
              <Trash2 size={16} />
            </button>
          </div>
        ])}
      />
    </>
  );
}

function AuditLogs({ logs }: { logs: AuditLog[] }) {
  return (
    <Panel title="Journal d'audit">
      <DataTable
        columns={['Date', 'Utilisateur', 'Action', 'Entite', 'Adresse IP']}
        rows={logs.map((log) => [
          new Date(log.createdAt).toLocaleString('fr-FR'),
          log.userDisplayName ? `${log.userDisplayName} <${log.userEmail ?? '-'}>` : (log.userEmail ?? '-'),
          log.action,
          `${log.entityName}${log.entityId ? ` #${log.entityId}` : ''}`,
          log.ipAddress ?? '-'
        ])}
      />
    </Panel>
  );
}

function WarehousesSettings({ warehouses, onChanged }: { warehouses: Warehouse[]; onChanged: () => Promise<void> }) {
  const [draft, setDraft] = useState<WarehouseDraft>(emptyWarehouseDraft);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [editDraft, setEditDraft] = useState<WarehouseDraft>(emptyWarehouseDraft);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const selected = warehouses.find((warehouse) => warehouse.id === selectedWarehouseId);
    setEditDraft(warehouseToDraft(selected));
  }, [selectedWarehouseId, warehouses]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await api.createWarehouse(draft);
      setDraft(emptyWarehouseDraft);
      setMessage('Entrepot cree.');
      await onChanged();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Creation impossible');
    }
  }

  async function updateWarehouse(event: FormEvent) {
    event.preventDefault();
    const warehouse = warehouses.find((item) => item.id === selectedWarehouseId);
    if (!warehouse) {
      setMessage('Selectionnez un entrepot a modifier.');
      return;
    }

    setMessage(null);
    try {
      await api.updateWarehouse(warehouse.id, editDraft);
      setMessage('Entrepot modifie.');
      await onChanged();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Modification impossible');
    }
  }

  async function deleteWarehouse() {
    const warehouse = warehouses.find((item) => item.id === selectedWarehouseId);
    if (!warehouse) {
      setMessage('Selectionnez un entrepot a supprimer.');
      return;
    }

    if (!window.confirm(`Supprimer l'entrepot "${warehouse.name}" ?`)) {
      return;
    }

    setMessage(null);
    try {
      await api.deleteWarehouse(warehouse.id);
      setMessage('Entrepot supprime.');
      setSelectedWarehouseId('');
      await onChanged();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Suppression impossible');
    }
  }

  return (
    <>
      <Panel title="Nouvel entrepot">
        <form className="form-grid" onSubmit={submit}>
          <WarehouseDraftFields draft={draft} onChange={setDraft} />
          <button className="primary" type="submit">
            <Plus size={16} />
            Creer
          </button>
        </form>
        {message && <div className="inline-message">{message}</div>}
      </Panel>
      <Panel title="Modifier un entrepot">
        <form className="form-grid" onSubmit={updateWarehouse}>
          <label className="field">
            <span>Entrepot</span>
            <select value={selectedWarehouseId} onChange={(event) => setSelectedWarehouseId(event.target.value)}>
              <option value="">Selectionner</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>
          <WarehouseDraftFields draft={editDraft} onChange={setEditDraft} disabled={!selectedWarehouseId} />
          <div className="table-actions form-actions">
            <button className="primary" type="submit" disabled={!selectedWarehouseId}>
              <Save size={15} />
              Enregistrer
            </button>
            <button className="danger" type="button" disabled={!selectedWarehouseId} onClick={deleteWarehouse}>
              <Trash2 size={15} />
              Supprimer
            </button>
          </div>
        </form>
      </Panel>
      <DataTable
        columns={['Entrepot', 'Adresse', 'Representant', 'Telephone', 'Email']}
        rows={warehouses.map((warehouse) => [
          warehouse.name,
          formatWarehouseAddress(warehouse) || '-',
          warehouse.representativeName || '-',
          warehouse.phone || '-',
          warehouse.email || '-'
        ])}
      />
    </>
  );
}

function WarehouseDraftFields({ draft, onChange, disabled = false }: { draft: WarehouseDraft; onChange: (draft: WarehouseDraft) => void; disabled?: boolean }) {
  const update = (key: keyof WarehouseDraft, value: string) => onChange({ ...draft, [key]: value });

  return (
    <>
      <label className="field">
        <span>Nom</span>
        <input required disabled={disabled} placeholder="Nom de l'entrepot" value={draft.name} onChange={(event) => update('name', event.target.value)} />
      </label>
      <label className="field">
        <span>Representant</span>
        <input disabled={disabled} placeholder="Nom du responsable" value={draft.representativeName} onChange={(event) => update('representativeName', event.target.value)} />
      </label>
      <label className="field">
        <span>Telephone</span>
        <input disabled={disabled} placeholder="Telephone" value={draft.phone} onChange={(event) => update('phone', event.target.value)} />
      </label>
      <label className="field">
        <span>Email</span>
        <input disabled={disabled} type="email" placeholder="email@entreprise.fr" value={draft.email} onChange={(event) => update('email', event.target.value)} />
      </label>
      <label className="field">
        <span>Adresse</span>
        <input disabled={disabled} placeholder="Adresse" value={draft.addressLine1} onChange={(event) => update('addressLine1', event.target.value)} />
      </label>
      <label className="field">
        <span>Complement</span>
        <input disabled={disabled} placeholder="Complement d'adresse" value={draft.addressLine2} onChange={(event) => update('addressLine2', event.target.value)} />
      </label>
      <label className="field">
        <span>Code postal</span>
        <input disabled={disabled} placeholder="Code postal" value={draft.postalCode} onChange={(event) => update('postalCode', event.target.value)} />
      </label>
      <label className="field">
        <span>Ville</span>
        <input disabled={disabled} placeholder="Ville" value={draft.city} onChange={(event) => update('city', event.target.value)} />
      </label>
      <label className="field">
        <span>Pays</span>
        <input disabled={disabled} placeholder="Pays" value={draft.country} onChange={(event) => update('country', event.target.value)} />
      </label>
      <label className="field wide-field">
        <span>Notes</span>
        <textarea disabled={disabled} placeholder="Informations internes" value={draft.notes} onChange={(event) => update('notes', event.target.value)} />
      </label>
    </>
  );
}

function formatWarehouseAddress(warehouse: Warehouse) {
  return [warehouse.addressLine1, warehouse.addressLine2, [warehouse.postalCode, warehouse.city].filter(Boolean).join(' '), warehouse.country].filter(Boolean).join(', ');
}

function PrestashopSettings({ connections, warehouses, onChanged }: { connections: PrestashopConnection[]; warehouses: Warehouse[]; onChanged: () => Promise<void> }) {
  const [selectedId, setSelectedId] = useState('');
  const [shopUrl, setShopUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [clearApiKey, setClearApiKey] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedConnection = connections.find((connection) => connection.id === selectedId);
  const warehouseById = useMemo(() => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse.name])), [warehouses]);

  useEffect(() => {
    if (selectedConnection) {
      setShopUrl(selectedConnection.shopUrl);
      setWarehouseId(selectedConnection.warehouseId ?? '');
      setIsActive(selectedConnection.isActive);
      setApiKey('');
      setClearApiKey(false);
    }
  }, [selectedConnection]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      if (selectedConnection) {
        await api.updatePrestashopConnection(selectedConnection.id, { shopUrl, apiKey: apiKey || undefined, isActive, clearApiKey, warehouseId: warehouseId || undefined });
        setMessage('Connexion PrestaShop mise a jour.');
      } else {
        await api.createPrestashopConnection({ shopUrl, apiKey: apiKey || undefined, warehouseId: warehouseId || undefined });
        setMessage('Connexion PrestaShop creee.');
      }

      setSelectedId('');
      setShopUrl('');
      setApiKey('');
      setWarehouseId('');
      setIsActive(true);
      setClearApiKey(false);
      await onChanged();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Configuration PrestaShop impossible');
    }
  }

  return (
    <>
      <Panel title="Configuration PrestaShop">
        <form className="form-grid" onSubmit={submit}>
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            <option value="">Nouvelle connexion</option>
            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.shopUrl}
              </option>
            ))}
          </select>
          <input required placeholder="URL boutique" value={shopUrl} onChange={(event) => setShopUrl(event.target.value)} />
          <input type="password" placeholder={selectedConnection?.hasApiKey ? 'Nouvelle cle API, vide = conserver' : 'Cle API PrestaShop'} value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
          <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
            <option value="">Entrepot principal automatique</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
          <label className="check-field">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
            Actif
          </label>
          {selectedConnection && (
            <label className="check-field">
              <input type="checkbox" checked={clearApiKey} onChange={(event) => setClearApiKey(event.target.checked)} />
              Effacer la cle
            </label>
          )}
          <button className="primary" type="submit">
            <Store size={16} />
            {selectedConnection ? 'Mettre a jour' : 'Ajouter'}
          </button>
        </form>
        {message && <div className="inline-message">{message}</div>}
        <p className="panel-note">Cet entrepot sert de valeur par defaut lors de l'import de nouveaux produits. Chaque article peut ensuite etre rattache a son propre entrepot depuis la page Stock.</p>
      </Panel>
      <DataTable columns={['Boutique', 'Entrepot stock', 'Cle API', 'Statut']} rows={connections.map((connection) => [connection.shopUrl, connection.warehouseId ? warehouseById.get(connection.warehouseId) ?? connection.warehouseId : 'Entrepot principal automatique', connection.hasApiKey ? 'Configuree' : 'Manquante', connection.isActive ? 'Actif' : 'Inactif'])} />
    </>
  );
}

function UsersRoles({ users, roles, permissions, onChanged }: { users: User[]; roles: Role[]; permissions: Permission[]; onChanged: () => Promise<void> }) {
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [newUserRoles, setNewUserRoles] = useState<string[]>(['Sales']);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUserRoles, setSelectedUserRoles] = useState<string[]>([]);
  const [selectedUserActive, setSelectedUserActive] = useState(true);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [rolePermissions, setRolePermissions] = useState<string[]>(['dashboard.read']);
  const [editRoleId, setEditRoleId] = useState('');
  const [editRoleDescription, setEditRoleDescription] = useState('');
  const [editRolePermissions, setEditRolePermissions] = useState<string[]>([]);

  const groupedPermissions = useMemo(() => {
    return permissions.reduce<Record<string, Permission[]>>((groups, permission) => {
      groups[permission.module] = [...(groups[permission.module] ?? []), permission];
      return groups;
    }, {});
  }, [permissions]);

  useEffect(() => {
    const user = users.find((item) => item.id === selectedUserId);
    if (user) {
      setSelectedUserRoles(user.roles);
      setSelectedUserActive(user.isActive);
    }
  }, [selectedUserId, users]);

  useEffect(() => {
    const role = roles.find((item) => item.id === editRoleId);
    if (role) {
      setEditRoleDescription(role.description);
      setEditRolePermissions(role.permissions);
    }
  }, [editRoleId, roles]);

  async function createUser(event: FormEvent) {
    event.preventDefault();
    await api.createUser({ email, displayName, password, roles: newUserRoles.length > 0 ? newUserRoles : ['Sales'] });
    setEmail('');
    setDisplayName('');
    setPassword('');
    setNewUserRoles(['Sales']);
    await onChanged();
  }

  async function updateUser(event: FormEvent) {
    event.preventDefault();
    if (!selectedUserId) {
      throw new Error('Selectionner un utilisateur.');
    }

    await api.updateUserRoles(selectedUserId, { roles: selectedUserRoles, isActive: selectedUserActive });
    await onChanged();
  }

  async function createRole(event: FormEvent) {
    event.preventDefault();
    await api.createRole({ name: roleName, description: roleDescription, permissions: rolePermissions });
    setRoleName('');
    setRoleDescription('');
    setRolePermissions(['dashboard.read']);
    await onChanged();
  }

  async function updateRole(event: FormEvent) {
    event.preventDefault();
    if (!editRoleId) {
      throw new Error('Selectionner un role.');
    }

    await api.updateRole(editRoleId, { description: editRoleDescription, permissions: editRolePermissions });
    await onChanged();
  }

  return (
    <>
      <div className="browser-tabs sub-tabs" role="tablist" aria-label="Utilisateurs et roles">
        <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')} type="button">
          Utilisateurs
        </button>
        <button className={activeTab === 'roles' ? 'active' : ''} onClick={() => setActiveTab('roles')} type="button">
          Roles
        </button>
      </div>

      <section className="tab-page inner">
        {activeTab === 'users' && (
          <>
            <Panel title="Nouvel utilisateur">
              <form className="form-grid" onSubmit={createUser}>
                <input required type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
                <input required placeholder="Nom affiche" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                <input required type="password" placeholder="Mot de passe provisoire" value={password} onChange={(event) => setPassword(event.target.value)} />
                <MultiSelect label="Roles" values={newUserRoles} options={roles.map((role) => role.name)} onChange={setNewUserRoles} />
                <button className="primary" type="submit">
                  <Plus size={16} />
                  Creer
                </button>
              </form>
            </Panel>

            <Panel title="Affectation utilisateur">
              <form className="form-grid" onSubmit={updateUser}>
                <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
                  <option value="">Utilisateur</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email}
                    </option>
                  ))}
                </select>
                <MultiSelect label="Roles" values={selectedUserRoles} options={roles.map((role) => role.name)} onChange={setSelectedUserRoles} />
                <label className="check-field">
                  <input type="checkbox" checked={selectedUserActive} onChange={(event) => setSelectedUserActive(event.target.checked)} />
                  Actif
                </label>
                <button className="primary" type="submit">
                  <ShieldCheck size={16} />
                  Enregistrer
                </button>
              </form>
            </Panel>

            <DataTable columns={['Email', 'Nom', 'Roles', 'Statut']} rows={users.map((user) => [user.email, user.displayName, user.roles.join(', '), user.isActive ? 'Actif' : 'Inactif'])} />
          </>
        )}

        {activeTab === 'roles' && (
          <>
            <Panel title="Nouveau role">
              <form className="form-grid" onSubmit={createRole}>
                <input required placeholder="Nom du role" value={roleName} onChange={(event) => setRoleName(event.target.value)} />
                <input placeholder="Description" value={roleDescription} onChange={(event) => setRoleDescription(event.target.value)} />
                <PermissionPicker groupedPermissions={groupedPermissions} selected={rolePermissions} onChange={setRolePermissions} />
                <button className="primary" type="submit">
                  <Plus size={16} />
                  Creer
                </button>
              </form>
            </Panel>

            <Panel title="Permissions du role">
              <form className="form-grid" onSubmit={updateRole}>
                <select value={editRoleId} onChange={(event) => setEditRoleId(event.target.value)}>
                  <option value="">Role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                <input placeholder="Description" value={editRoleDescription} onChange={(event) => setEditRoleDescription(event.target.value)} />
                <PermissionPicker groupedPermissions={groupedPermissions} selected={editRolePermissions} onChange={setEditRolePermissions} />
                <button className="primary" type="submit">
                  <ShieldCheck size={16} />
                  Mettre a jour
                </button>
              </form>
            </Panel>

            <DataTable columns={['Role', 'Description', 'Permissions']} rows={roles.map((role) => [role.name, role.description, role.permissions.length])} />
          </>
        )}
      </section>
    </>
  );
}

function MultiSelect({ label, values, options, labels, onChange }: { label: string; values: string[]; options: string[]; labels?: Record<string, string>; onChange: (values: string[]) => void }) {
  return (
    <label className="multi-select">
      {label}
      <select multiple value={values} onChange={(event) => onChange(Array.from(event.currentTarget.selectedOptions).map((option) => option.value))}>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels?.[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

function PermissionPicker({ groupedPermissions, selected, onChange }: { groupedPermissions: Record<string, Permission[]>; selected: string[]; onChange: (permissions: string[]) => void }) {
  function toggle(permission: string) {
    onChange(selected.includes(permission) ? selected.filter((item) => item !== permission) : [...selected, permission]);
  }

  return (
    <div className="permission-picker">
      {Object.entries(groupedPermissions).map(([module, items]) => (
        <fieldset key={module}>
          <legend>{module}</legend>
          {items.map((permission) => (
            <label key={permission.code}>
              <input type="checkbox" checked={selected.includes(permission.code)} onChange={() => toggle(permission.code)} />
              {permission.action}
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}

type CustomerContactDraft = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  isPrimary: boolean;
};

type CustomerAddressDraft = {
  label: string;
  line1: string;
  line2: string;
  postalCode: string;
  city: string;
  country: string;
  isBilling: boolean;
  isShipping: boolean;
};

type CustomerDraft = {
  companyName: string;
  legalName: string;
  tradeName: string;
  sirenNumber: string;
  siretNumber: string;
  vatNumber: string;
  email: string;
  phone: string;
  mobilePhone: string;
  website: string;
  industry: string;
  customerType: string;
  source: string;
  accountingCode: string;
  paymentTerms: string;
  defaultDiscountRate: string;
  notes: string;
  isActive: boolean;
  contacts: CustomerContactDraft[];
  addresses: CustomerAddressDraft[];
};

function Customers({ items, onChanged }: { items: Customer[]; onChanged: () => Promise<void> }) {
  const [code, setCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sirenNumber, setSirenNumber] = useState('');
  const [siretNumber, setSiretNumber] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const selectedCustomer = selectedCustomerId ? items.find((item) => item.id === selectedCustomerId) ?? null : null;

  useEffect(() => {
    if (selectedCustomerId && !items.some((item) => item.id === selectedCustomerId)) {
      setSelectedCustomerId(null);
    }
  }, [items, selectedCustomerId]);

  function primaryContact(customer: Customer) {
    return customer.contacts?.find((contact) => contact.isPrimary) ?? customer.contacts?.[0];
  }

  function primaryAddress(customer: Customer) {
    return customer.addresses?.find((address) => address.isBilling) ?? customer.addresses?.find((address) => address.isShipping) ?? customer.addresses?.[0];
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const [firstName, ...lastNameParts] = contactName.trim().split(' ').filter(Boolean);
    await api.createCustomer({
      code,
      companyName,
      tradeName: tradeName || null,
      sirenNumber: sirenNumber || null,
      siretNumber: siretNumber || null,
      vatNumber: vatNumber || null,
      email: email || null,
      phone: phone || null,
      contacts: contactName.trim() || email.trim() || phone.trim()
        ? [{ firstName: firstName ?? '', lastName: lastNameParts.join(' '), email: email || null, phone: phone || null, jobTitle: null, isPrimary: true }]
        : [],
      addresses: []
    });
    setCode('');
    setCompanyName('');
    setTradeName('');
    setContactName('');
    setEmail('');
    setPhone('');
    setSirenNumber('');
    setSiretNumber('');
    setVatNumber('');
    await onChanged();
  }

  return (
    <>
      <Panel title="Nouveau client">
        <form className="form-grid" onSubmit={submit}>
          <input required placeholder="Code client" value={code} onChange={(event) => setCode(event.target.value)} />
          <input required placeholder="Nom de l'entreprise" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
          <input placeholder="Nom commercial" value={tradeName} onChange={(event) => setTradeName(event.target.value)} />
          <input placeholder="Contact principal" value={contactName} onChange={(event) => setContactName(event.target.value)} />
          <input placeholder="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <input placeholder="Telephone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <input placeholder="SIREN" value={sirenNumber} onChange={(event) => setSirenNumber(event.target.value)} />
          <input placeholder="SIRET" value={siretNumber} onChange={(event) => setSiretNumber(event.target.value)} />
          <input placeholder="TVA intracommunautaire" value={vatNumber} onChange={(event) => setVatNumber(event.target.value)} />
          <button className="primary" type="submit">
            <Plus size={16} />
            Creer
          </button>
        </form>
      </Panel>
      <DataTable
        columns={['Code', 'Societe', 'Contact', 'Email', 'Telephone', 'SIREN', 'Adresse', 'TVA', 'Statut']}
        rows={items.map((item) => {
          const contact = primaryContact(item);
          const address = primaryAddress(item);
          const contactName = contact ? [contact.firstName, contact.lastName].filter(Boolean).join(' ') : '';
          const addressLine = address ? [address.line1, `${address.postalCode} ${address.city}`.trim()].filter(Boolean).join(', ') : '-';
          return [item.code, item.companyName, contactName || '-', contact?.email ?? item.email ?? '-', contact?.phone ?? item.phone ?? '-', item.sirenNumber ?? '-', addressLine, item.vatNumber ?? '-', item.isActive ? 'Actif' : 'Inactif'];
        })}
        onRowClick={(index) => setSelectedCustomerId(items[index]?.id ?? null)}
        selectedRowIndex={selectedCustomer ? items.findIndex((item) => item.id === selectedCustomer.id) : undefined}
      />
      {selectedCustomer && (
        <CustomerDetailsModal customer={selectedCustomer} onClose={() => setSelectedCustomerId(null)} onSaved={onChanged} />
      )}
    </>
  );
}

function emptyCustomerContactDraft(): CustomerContactDraft {
  return { firstName: '', lastName: '', email: '', phone: '', jobTitle: '', isPrimary: false };
}

function emptyCustomerAddressDraft(): CustomerAddressDraft {
  return { label: 'Adresse principale', line1: '', line2: '', postalCode: '', city: '', country: 'France', isBilling: true, isShipping: true };
}

function CustomerDetailsModal({ customer, onClose, onSaved }: { customer: Customer; onClose: () => void; onSaved: () => Promise<void> }) {
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(() => customerToDraft(customer));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    setDraft(customerToDraft(customer));
    setError(null);
  }, [customer]);

  function resetDraft() {
    setDraft(customerToDraft(customer));
    setError(null);
  }

  function updateContact(index: number, patch: Partial<CustomerContactDraft>) {
    setDraft((current) => ({
      ...current,
      contacts: current.contacts.map((contact, contactIndex) => (contactIndex === index ? { ...contact, ...patch } : contact))
    }));
  }

  function updateContactPrimary(index: number, checked: boolean) {
    setDraft((current) => ({
      ...current,
      contacts: current.contacts.map((contact, contactIndex) => ({ ...contact, isPrimary: checked && contactIndex === index }))
    }));
  }

  function removeContact(index: number) {
    setDraft((current) => ({ ...current, contacts: current.contacts.filter((_, contactIndex) => contactIndex !== index) }));
  }

  function updateAddress(index: number, patch: Partial<CustomerAddressDraft>) {
    setDraft((current) => ({
      ...current,
      addresses: current.addresses.map((address, addressIndex) => (addressIndex === index ? { ...address, ...patch } : address))
    }));
  }

  function removeAddress(index: number) {
    setDraft((current) => ({ ...current, addresses: current.addresses.filter((_, addressIndex) => addressIndex !== index) }));
  }

  async function saveCustomer(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.updateCustomer(customer.id, {
        companyName: draft.companyName.trim(),
        legalName: draft.legalName.trim() || null,
        tradeName: draft.tradeName.trim() || null,
        sirenNumber: draft.sirenNumber.trim() || null,
        siretNumber: draft.siretNumber.trim() || null,
        vatNumber: draft.vatNumber.trim() || null,
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
        mobilePhone: draft.mobilePhone.trim() || null,
        website: draft.website.trim() || null,
        industry: draft.industry.trim() || null,
        customerType: draft.customerType.trim() || null,
        source: draft.source.trim() || null,
        accountingCode: draft.accountingCode.trim() || null,
        paymentTerms: draft.paymentTerms.trim() || null,
        defaultDiscountRate: Number(draft.defaultDiscountRate || 0),
        notes: draft.notes.trim() || null,
        isActive: draft.isActive,
        contacts: draft.contacts.map((contact, index) => ({
          firstName: contact.firstName.trim(),
          lastName: contact.lastName.trim(),
          email: contact.email.trim() || null,
          phone: contact.phone.trim() || null,
          jobTitle: contact.jobTitle.trim() || null,
          isPrimary: contact.isPrimary || (index === 0 && !draft.contacts.some((item) => item.isPrimary))
        })),
        addresses: draft.addresses.map((address, index) => ({
          label: address.label.trim() || `Adresse ${index + 1}`,
          line1: address.line1.trim(),
          line2: address.line2.trim() || null,
          postalCode: address.postalCode.trim(),
          city: address.city.trim(),
          country: address.country.trim(),
          isBilling: address.isBilling || (index === 0 && !draft.addresses.some((item) => item.isBilling)),
          isShipping: address.isShipping || (index === 0 && !draft.addresses.some((item) => item.isShipping))
        }))
      });
      await onSaved();
      setEditMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modification client impossible.');
    } finally {
      setSaving(false);
    }
  }

  function viewContactName(contact: Customer['contacts'][number]) {
    return [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Contact sans nom';
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal-panel customer-modal" role="dialog" aria-modal="true" aria-labelledby="customer-detail-title" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <p className="eyebrow">Client</p>
            <h2 id="customer-detail-title">{customer.companyName}</h2>
          </div>
          <div className="modal-actions">
            {!editMode && (
              <button className="secondary" type="button" onClick={() => setEditMode(true)}>
                <Pencil size={16} />
                Modifier
              </button>
            )}
            <button className="modal-close" type="button" aria-label="Fermer" title="Fermer" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </header>

        {editMode ? (
          <form className="customer-edit-form" onSubmit={saveCustomer}>
            <div className="form-grid customer-main-form">
              <label className="field">
                <span>Code client</span>
                <input readOnly value={customer.code} />
              </label>
              <label className="field">
                <span>Societe</span>
                <input required value={draft.companyName} onChange={(event) => setDraft((current) => ({ ...current, companyName: event.target.value }))} />
              </label>
              <label className="field">
                <span>Raison sociale</span>
                <input value={draft.legalName} onChange={(event) => setDraft((current) => ({ ...current, legalName: event.target.value }))} />
              </label>
              <label className="field">
                <span>Nom commercial</span>
                <input value={draft.tradeName} onChange={(event) => setDraft((current) => ({ ...current, tradeName: event.target.value }))} />
              </label>
              <label className="field">
                <span>SIREN</span>
                <input value={draft.sirenNumber} onChange={(event) => setDraft((current) => ({ ...current, sirenNumber: event.target.value }))} />
              </label>
              <label className="field">
                <span>SIRET</span>
                <input value={draft.siretNumber} onChange={(event) => setDraft((current) => ({ ...current, siretNumber: event.target.value }))} />
              </label>
              <label className="field">
                <span>TVA intracommunautaire</span>
                <input value={draft.vatNumber} onChange={(event) => setDraft((current) => ({ ...current, vatNumber: event.target.value }))} />
              </label>
              <label className="field">
                <span>Email general</span>
                <input type="email" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} />
              </label>
              <label className="field">
                <span>Telephone</span>
                <input value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} />
              </label>
              <label className="field">
                <span>Mobile</span>
                <input value={draft.mobilePhone} onChange={(event) => setDraft((current) => ({ ...current, mobilePhone: event.target.value }))} />
              </label>
              <label className="field">
                <span>Site web</span>
                <input value={draft.website} onChange={(event) => setDraft((current) => ({ ...current, website: event.target.value }))} />
              </label>
              <label className="field">
                <span>Secteur</span>
                <input value={draft.industry} onChange={(event) => setDraft((current) => ({ ...current, industry: event.target.value }))} />
              </label>
              <label className="field">
                <span>Type client</span>
                <input placeholder="Professionnel, particulier..." value={draft.customerType} onChange={(event) => setDraft((current) => ({ ...current, customerType: event.target.value }))} />
              </label>
              <label className="field">
                <span>Origine</span>
                <input placeholder="PrestaShop, salon, recommandation..." value={draft.source} onChange={(event) => setDraft((current) => ({ ...current, source: event.target.value }))} />
              </label>
              <label className="field">
                <span>Code comptable</span>
                <input value={draft.accountingCode} onChange={(event) => setDraft((current) => ({ ...current, accountingCode: event.target.value }))} />
              </label>
              <label className="field">
                <span>Conditions de paiement</span>
                <input placeholder="Comptant, 30 jours..." value={draft.paymentTerms} onChange={(event) => setDraft((current) => ({ ...current, paymentTerms: event.target.value }))} />
              </label>
              <label className="field">
                <span>Remise defaut (%)</span>
                <input type="number" min="0" step="0.01" value={draft.defaultDiscountRate} onChange={(event) => setDraft((current) => ({ ...current, defaultDiscountRate: event.target.value }))} />
              </label>
              <label className="check-field customer-active-field">
                <input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))} />
                Client actif
              </label>
            </div>

            <label className="field full-field">
              <span>Notes</span>
              <textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
            </label>

            <section className="customer-edit-section">
              <div className="section-title-row">
                <h3>Contacts</h3>
                <button className="secondary" type="button" onClick={() => setDraft((current) => ({ ...current, contacts: [...current.contacts, { ...emptyCustomerContactDraft(), isPrimary: current.contacts.length === 0 }] }))}>
                  <Plus size={16} />
                  Ajouter un contact
                </button>
              </div>
              {draft.contacts.length === 0 && <p className="panel-note">Aucun contact renseigne.</p>}
              {draft.contacts.map((contact, index) => (
                <div className="customer-line-card" key={`contact-${index}`}>
                  <div className="customer-contact-grid">
                    <label className="field">
                      <span>Prenom</span>
                      <input value={contact.firstName} onChange={(event) => updateContact(index, { firstName: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>Nom</span>
                      <input value={contact.lastName} onChange={(event) => updateContact(index, { lastName: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>Email</span>
                      <input type="email" value={contact.email} onChange={(event) => updateContact(index, { email: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>Telephone</span>
                      <input value={contact.phone} onChange={(event) => updateContact(index, { phone: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>Fonction</span>
                      <input value={contact.jobTitle} onChange={(event) => updateContact(index, { jobTitle: event.target.value })} />
                    </label>
                    <label className="check-field">
                      <input type="checkbox" checked={contact.isPrimary} onChange={(event) => updateContactPrimary(index, event.target.checked)} />
                      Principal
                    </label>
                  </div>
                  <button className="danger icon-button" title="Supprimer le contact" type="button" onClick={() => removeContact(index)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </section>

            <section className="customer-edit-section">
              <div className="section-title-row">
                <h3>Adresses</h3>
                <button className="secondary" type="button" onClick={() => setDraft((current) => ({ ...current, addresses: [...current.addresses, { ...emptyCustomerAddressDraft(), isBilling: current.addresses.length === 0, isShipping: current.addresses.length === 0 }] }))}>
                  <Plus size={16} />
                  Ajouter une adresse
                </button>
              </div>
              {draft.addresses.length === 0 && <p className="panel-note">Aucune adresse renseignee.</p>}
              {draft.addresses.map((address, index) => (
                <div className="customer-line-card" key={`address-${index}`}>
                  <div className="customer-address-grid">
                    <label className="field">
                      <span>Libelle</span>
                      <input value={address.label} onChange={(event) => updateAddress(index, { label: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>Adresse 1</span>
                      <input required value={address.line1} onChange={(event) => updateAddress(index, { line1: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>Adresse 2</span>
                      <input value={address.line2} onChange={(event) => updateAddress(index, { line2: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>Code postal</span>
                      <input required value={address.postalCode} onChange={(event) => updateAddress(index, { postalCode: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>Ville</span>
                      <input required value={address.city} onChange={(event) => updateAddress(index, { city: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>Pays</span>
                      <input required value={address.country} onChange={(event) => updateAddress(index, { country: event.target.value })} />
                    </label>
                    <label className="check-field">
                      <input type="checkbox" checked={address.isBilling} onChange={(event) => updateAddress(index, { isBilling: event.target.checked })} />
                      Facturation
                    </label>
                    <label className="check-field">
                      <input type="checkbox" checked={address.isShipping} onChange={(event) => updateAddress(index, { isShipping: event.target.checked })} />
                      Livraison
                    </label>
                  </div>
                  <button className="danger icon-button" title="Supprimer l'adresse" type="button" onClick={() => removeAddress(index)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </section>

            <p className="panel-note">Si ce client provient de PrestaShop, l'enregistrement publie aussi la fiche client et la premiere adresse liee a ce client sur la boutique.</p>
            {error && <div className="error-message">{error}</div>}
            <div className="modal-footer">
              <button className="secondary" type="button" disabled={saving} onClick={() => { resetDraft(); setEditMode(false); }}>
                Annuler
              </button>
              <button className="primary" type="submit" disabled={saving}>
                <Save size={16} />
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="detail-grid customer-summary-grid">
              <DetailItem label="Code client" value={customer.code} />
              <DetailItem label="Raison sociale" value={customer.legalName || '-'} />
              <DetailItem label="Nom commercial" value={customer.tradeName || '-'} />
              <DetailItem label="SIREN" value={customer.sirenNumber || '-'} />
              <DetailItem label="SIRET" value={customer.siretNumber || '-'} />
              <DetailItem label="TVA intracommunautaire" value={customer.vatNumber || '-'} />
              <DetailItem label="Email general" value={customer.email || '-'} />
              <DetailItem label="Telephone" value={customer.phone || '-'} />
              <DetailItem label="Mobile" value={customer.mobilePhone || '-'} />
              <DetailItem label="Site web" value={customer.website || '-'} />
              <DetailItem label="Secteur" value={customer.industry || '-'} />
              <DetailItem label="Type client" value={customer.customerType || '-'} />
              <DetailItem label="Origine" value={customer.source || '-'} />
              <DetailItem label="Code comptable" value={customer.accountingCode || '-'} />
              <DetailItem label="Paiement" value={customer.paymentTerms || '-'} />
              <DetailItem label="Remise defaut" value={`${customer.defaultDiscountRate ?? 0}%`} />
              <DetailItem label="Statut" value={customer.isActive ? 'Actif' : 'Inactif'} />
              <DetailItem label="Identifiant interne" value={customer.id} />
            </div>

            <section className="customer-detail-section">
              <h3>Contacts</h3>
              {customer.contacts.length === 0 ? (
                <p className="panel-note">Aucun contact renseigne.</p>
              ) : (
                <div className="customer-card-grid">
                  {customer.contacts.map((contact) => (
                    <article className="customer-info-card" key={contact.id}>
                      <div className="customer-card-heading">
                        <strong>{viewContactName(contact)}</strong>
                        {contact.isPrimary && <span className="pill success">Principal</span>}
                      </div>
                      <span>{contact.jobTitle || '-'}</span>
                      <span>{contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : '-'}</span>
                      <span>{contact.phone || '-'}</span>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="customer-detail-section">
              <h3>Adresses</h3>
              {customer.addresses.length === 0 ? (
                <p className="panel-note">Aucune adresse renseignee.</p>
              ) : (
                <div className="customer-card-grid">
                  {customer.addresses.map((address) => (
                    <article className="customer-info-card" key={address.id}>
                      <div className="customer-card-heading">
                        <strong>{address.label || 'Adresse'}</strong>
                        <span>{[address.isBilling ? 'Facturation' : '', address.isShipping ? 'Livraison' : ''].filter(Boolean).join(' / ') || 'Generale'}</span>
                      </div>
                      <span>{address.line1}</span>
                      {address.line2 && <span>{address.line2}</span>}
                      <span>{address.postalCode} {address.city}</span>
                      <span>{address.country}</span>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="customer-detail-section">
              <h3>Notes</h3>
              <div className="text-block">{customer.notes || 'Aucune note renseignee.'}</div>
            </section>

            <DocumentLinksPanel module="customers" entityId={customer.id} />
          </>
        )}
      </section>
    </div>
  );
}

function customerToDraft(customer: Customer) {
  return {
    companyName: customer.companyName,
    legalName: customer.legalName ?? '',
    tradeName: customer.tradeName ?? '',
    sirenNumber: customer.sirenNumber ?? '',
    siretNumber: customer.siretNumber ?? '',
    vatNumber: customer.vatNumber ?? '',
    email: customer.email ?? '',
    phone: customer.phone ?? '',
    mobilePhone: customer.mobilePhone ?? '',
    website: customer.website ?? '',
    industry: customer.industry ?? '',
    customerType: customer.customerType ?? '',
    source: customer.source ?? '',
    accountingCode: customer.accountingCode ?? '',
    paymentTerms: customer.paymentTerms ?? '',
    defaultDiscountRate: String(customer.defaultDiscountRate ?? 0),
    notes: customer.notes ?? '',
    isActive: customer.isActive,
    contacts: (customer.contacts ?? []).map((contact) => ({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      jobTitle: contact.jobTitle ?? '',
      isPrimary: contact.isPrimary
    })) as CustomerContactDraft[],
    addresses: (customer.addresses ?? []).map((address) => ({
      label: address.label,
      line1: address.line1,
      line2: address.line2 ?? '',
      postalCode: address.postalCode,
      city: address.city,
      country: address.country,
      isBilling: address.isBilling,
      isShipping: address.isShipping
    })) as CustomerAddressDraft[]
  };
}

function Products({ items, onChanged }: { items: Product[]; onChanged: () => Promise<void> }) {
  const [reference, setReference] = useState('');
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [salePrice, setSalePrice] = useState('0');
  const [purchasePrice, setPurchasePrice] = useState('0');
  const [vatRate, setVatRate] = useState('20');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const selectedProduct = items.find((item) => item.id === selectedProductId) ?? null;

  useEffect(() => {
    if (selectedProductId && !items.some((item) => item.id === selectedProductId)) {
      setSelectedProductId(null);
    }
  }, [items, selectedProductId]);

  function formatAmount(value: number) {
    return `${value.toFixed(2)} EUR`;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await api.createProduct({
      reference,
      name,
      imageUrl: imageUrl || undefined,
      purchasePrice: Number(purchasePrice),
      salePrice: Number(salePrice),
      vatRate: Number(vatRate)
    });
    setReference('');
    setName('');
    setImageUrl('');
    setSalePrice('0');
    setPurchasePrice('0');
    setVatRate('20');
    await onChanged();
  }

  return (
    <>
      <Panel title="Nouveau produit">
        <form className="form-grid" onSubmit={submit}>
          <label className="field">
            <span>Reference</span>
            <input required placeholder="REF-001" value={reference} onChange={(event) => setReference(event.target.value)} />
          </label>
          <label className="field">
            <span>Designation</span>
            <input required placeholder="Nom du produit" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="field">
            <span>URL image</span>
            <input placeholder="https://..." value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} />
          </label>
          <label className="field">
            <span>Prix achat HT (€)</span>
            <input required type="number" step="0.01" placeholder="0,00" value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value)} />
          </label>
          <label className="field">
            <span>Prix vente HT (€)</span>
            <input required type="number" step="0.01" placeholder="0,00" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} />
          </label>
          <label className="field">
            <span>TVA (%)</span>
            <input required type="number" step="0.01" placeholder="20" value={vatRate} onChange={(event) => setVatRate(event.target.value)} />
          </label>
          <button className="primary" type="submit">
            <Plus size={16} />
            Creer
          </button>
        </form>
      </Panel>
      <DataTable
        columns={['Image', 'Reference', 'Designation', 'Prix vente', 'TVA', 'Statut']}
        rows={items.map((item) => [<ProductThumb key={item.id} product={item} />, item.reference, item.name, formatAmount(item.salePrice), `${item.vatRate}%`, item.isActive ? 'Actif' : 'Inactif'])}
        onRowClick={(index) => setSelectedProductId(items[index]?.id ?? null)}
        selectedRowIndex={selectedProduct ? items.findIndex((item) => item.id === selectedProduct.id) : undefined}
      />
      {selectedProduct && (
        <ProductDetailsModal product={selectedProduct} formatAmount={formatAmount} onClose={() => setSelectedProductId(null)} onSaved={onChanged} />
      )}
    </>
  );
}

function ProductThumb({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);

  return (
    <span className={product.imageUrl && !failed ? 'product-thumb' : 'product-thumb empty'}>
      {product.imageUrl && !failed ? <img src={product.imageUrl} alt={product.name} onError={() => setFailed(true)} /> : <Package size={18} />}
    </span>
  );
}

function ProductDetailsModal({ product, formatAmount, onClose, onSaved }: { product: Product; formatAmount: (value: number) => string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    reference: product.reference,
    name: product.name,
    description: product.description ?? '',
    imageUrl: product.imageUrl ?? '',
    purchasePrice: product.purchasePrice.toString(),
    salePrice: product.salePrice.toString(),
    vatRate: product.vatRate.toString(),
    isActive: product.isActive
  });
  const hasImage = Boolean(product.imageUrl && !imageFailed);
  const descriptionHtml = useMemo(() => sanitizeRichText(product.description), [product.description]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    setImageFailed(false);
  }, [product.imageUrl]);

  useEffect(() => {
    resetDraft();
  }, [product]);

  function resetDraft() {
    setDraft({
      reference: product.reference,
      name: product.name,
      description: product.description ?? '',
      imageUrl: product.imageUrl ?? '',
      purchasePrice: product.purchasePrice.toString(),
      salePrice: product.salePrice.toString(),
      vatRate: product.vatRate.toString(),
      isActive: product.isActive
    });
    setError(null);
  }

  function updateDraft<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.updateProduct(product.id, {
        reference: draft.reference,
        name: draft.name,
        description: draft.description || undefined,
        imageUrl: draft.imageUrl || undefined,
        purchasePrice: Number(draft.purchasePrice),
        salePrice: Number(draft.salePrice),
        vatRate: Number(draft.vatRate),
        isActive: draft.isActive
      });
      await onSaved();
      setEditMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modification impossible.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal-panel product-modal" role="dialog" aria-modal="true" aria-labelledby="product-detail-title" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <p className="eyebrow">Article</p>
            <h2 id="product-detail-title">{product.name}</h2>
          </div>
          <div className="modal-actions">
            {!editMode && (
              <button className="secondary" type="button" onClick={() => setEditMode(true)}>
                <Pencil size={16} />
                Modifier
              </button>
            )}
            <button className="modal-close" type="button" aria-label="Fermer" title="Fermer" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </header>

        {editMode ? (
          <form className="product-edit-form" onSubmit={saveProduct}>
            <div className="form-grid">
              <label className="field">
                <span>Reference</span>
                <input required value={draft.reference} onChange={(event) => updateDraft('reference', event.target.value)} />
              </label>
              <label className="field">
                <span>Designation</span>
                <input required value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} />
              </label>
              <label className="field">
                <span>URL image</span>
                <input value={draft.imageUrl} onChange={(event) => updateDraft('imageUrl', event.target.value)} />
              </label>
              <label className="field">
                <span>Prix achat HT (EUR)</span>
                <input required type="number" step="0.01" value={draft.purchasePrice} onChange={(event) => updateDraft('purchasePrice', event.target.value)} />
              </label>
              <label className="field">
                <span>Prix vente HT (EUR)</span>
                <input required type="number" step="0.01" value={draft.salePrice} onChange={(event) => updateDraft('salePrice', event.target.value)} />
              </label>
              <label className="field">
                <span>TVA (%)</span>
                <input required type="number" step="0.01" value={draft.vatRate} onChange={(event) => updateDraft('vatRate', event.target.value)} />
              </label>
              <label className="check-field">
                <input type="checkbox" checked={draft.isActive} onChange={(event) => updateDraft('isActive', event.target.checked)} />
                Actif
              </label>
            </div>
            <label className="field full-field">
              <span>Description</span>
              <textarea value={draft.description} onChange={(event) => updateDraft('description', event.target.value)} />
            </label>
            {error && <div className="error-message">{error}</div>}
            <div className="modal-footer">
              <button className="secondary" type="button" disabled={saving} onClick={() => { resetDraft(); setEditMode(false); }}>
                Annuler
              </button>
              <button className="primary" type="submit" disabled={saving}>
                <Save size={16} />
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        ) : (
          <>

        <div className="product-detail-hero">
          <div className="product-image-frame">
            {hasImage ? (
              <img src={product.imageUrl} alt={product.name} onError={() => setImageFailed(true)} />
            ) : (
              <div className="product-image-placeholder">
                <Package size={42} />
                <span>Aucune image</span>
              </div>
            )}
          </div>

          <div className="product-summary">
            <div className="product-summary-line">
              <span className="reference-badge">{product.reference}</span>
              <span className={product.isActive ? 'status-badge active' : 'status-badge'}>{product.isActive ? 'Actif' : 'Inactif'}</span>
            </div>
            <div className="product-facts">
              <DetailItem label="Prix vente HT" value={formatAmount(product.salePrice)} />
              <DetailItem label="Prix achat HT" value={formatAmount(product.purchasePrice)} />
              <DetailItem label="TVA" value={`${product.vatRate}%`} />
            </div>
          </div>
        </div>

        <section className="product-description-section">
          <h3>Description</h3>
          {descriptionHtml ? (
            <div className="product-description" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
          ) : (
            <div className="product-description empty">Aucune description renseignee.</div>
          )}
        </section>

        <div className="detail-grid product-meta-grid">
          <DetailItem label="Categorie" value={product.categoryName || '-'} />
          <DetailItem label="Marque" value={product.brandName || '-'} />
          <DetailItem label="Fournisseur principal" value={product.mainSupplierName || '-'} />
          <DetailItem label="URL image" value={product.imageUrl ? <a href={product.imageUrl} target="_blank" rel="noreferrer">Ouvrir l'image</a> : '-'} />
          <DetailItem label="Identifiant interne" value={product.id} />
        </div>
        <DocumentLinksPanel module="products" entityId={product.id} />
          </>
        )}
      </section>
    </div>
  );
}

const allowedRichTextTags = new Set(['p', 'br', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'blockquote']);

function sanitizeRichText(value?: string) {
  if (!value?.trim()) {
    return '';
  }

  const document = new DOMParser().parseFromString(value, 'text/html');
  const serialize = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.textContent ?? '');
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    const children = Array.from(element.childNodes).map(serialize).join('');
    if (!allowedRichTextTags.has(tag)) {
      return children;
    }

    return tag === 'br' ? '<br>' : `<${tag}>${children}</${tag}>`;
  };

  return Array.from(document.body.childNodes).map(serialize).join('').trim();
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

type QuoteDraftLine = {
  id: string;
  productId: string;
  productSearch: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountRate: string;
  vatRate: string;
};

const quoteStatusLabels: Record<string, string> = {
  Draft: 'Brouillon',
  Sent: 'Envoye',
  Signed: 'Signe',
  Refused: 'Refuse',
  Expired: 'Expire',
  ConvertedToOrder: 'Transforme en commande'
};

function createQuoteDraftLine(): QuoteDraftLine {
  return { id: createClientId('quote-line'), productId: '', productSearch: '', description: '', quantity: '1', unitPrice: '0', discountRate: '0', vatRate: '20' };
}

function defaultQuoteValidUntil() {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function nextQuoteStatuses(status: string) {
  const map: Record<string, string[]> = {
    Draft: ['Sent', 'Refused', 'Expired'],
    Sent: ['Draft', 'Signed', 'Refused', 'Expired'],
    Signed: [],
    Refused: ['Draft'],
    Expired: ['Draft'],
    ConvertedToOrder: []
  };
  return map[status] ?? [];
}

function Quotes({ items, customers, products, mailAccounts, warehouses, onChanged }: { items: Quote[]; customers: Customer[]; products: Product[]; mailAccounts: MailAccount[]; warehouses: Warehouse[]; onChanged: () => Promise<void> }) {
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [validUntil, setValidUntil] = useState(defaultQuoteValidUntil());
  const [lines, setLines] = useState<QuoteDraftLine[]>(() => [createQuoteDraftLine()]);
  const [editingQuoteId, setEditingQuoteId] = useState('');
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [emailQuoteId, setEmailQuoteId] = useState<string | null>(null);
  const [mailAccountId, setMailAccountId] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [emailCc, setEmailCc] = useState('');
  const [emailBcc, setEmailBcc] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [orderQuoteId, setOrderQuoteId] = useState<string | null>(null);
  const [orderWarehouseId, setOrderWarehouseId] = useState('');
  const [quoteFeedback, setQuoteFeedback] = useState<string | null>(null);

  const editingQuote = items.find((item) => item.id === editingQuoteId);
  const selectedQuote = selectedQuoteId ? items.find((item) => item.id === selectedQuoteId) : undefined;
  const emailQuote = emailQuoteId ? items.find((item) => item.id === emailQuoteId) : undefined;
  const orderQuote = orderQuoteId ? items.find((item) => item.id === orderQuoteId) : undefined;
  const activeProducts = products.filter((product) => product.isActive);
  const activeMailAccounts = mailAccounts.filter((account) => account.isActive);

  function customerOptionLabel(customer: Customer) {
    return [customer.companyName, customer.email].filter(Boolean).join(' - ');
  }

  function productOptionLabel(product: Product) {
    return `${product.reference} - ${product.name}`;
  }

  function productSearchLabel(line: QuoteDraftLine) {
    if (line.productSearch) {
      return line.productSearch;
    }

    const product = activeProducts.find((item) => item.id === line.productId);
    return product ? productOptionLabel(product) : '';
  }

  const totals = lines.reduce(
    (sum, line) => {
      const net = Number(line.quantity || 0) * Number(line.unitPrice || 0) * (1 - Math.min(100, Math.max(0, Number(line.discountRate || 0))) / 100);
      const vat = net * Number(line.vatRate || 0) / 100;
      return { net: sum.net + net, vat: sum.vat + vat };
    },
    { net: 0, vat: 0 }
  );

  function resetForm() {
    setCustomerId('');
    setCustomerSearch('');
    setValidUntil(defaultQuoteValidUntil());
    setLines([createQuoteDraftLine()]);
    setEditingQuoteId('');
  }

  function updateLine(lineId: string, patch: Partial<QuoteDraftLine>) {
    setLines((current) => current.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  }

  function selectProduct(lineId: string, productId: string) {
    const product = activeProducts.find((item) => item.id === productId);
    updateLine(lineId, {
      productId,
      productSearch: product ? productOptionLabel(product) : '',
      description: product ? `${product.reference} - ${product.name}` : '',
      unitPrice: product ? String(product.salePrice) : '0',
      vatRate: product ? String(product.vatRate) : '20'
    });
  }

  function selectCustomerFromSearch(value: string) {
    setCustomerSearch(value);
    const normalized = value.trim().toLocaleLowerCase();
    const customer = customers.find((item) =>
      customerOptionLabel(item).toLocaleLowerCase() === normalized
      || item.companyName.toLocaleLowerCase() === normalized
      || item.code.toLocaleLowerCase() === normalized);
    setCustomerId(customer?.id ?? '');
  }

  function commitCustomerSearch() {
    if (customerId || !customerSearch.trim()) {
      return;
    }

    const normalized = customerSearch.trim().toLocaleLowerCase();
    const customer = customers.find((item) =>
      customerOptionLabel(item).toLocaleLowerCase().startsWith(normalized)
      || item.companyName.toLocaleLowerCase().startsWith(normalized)
      || item.code.toLocaleLowerCase().startsWith(normalized));
    if (customer) {
      setCustomerId(customer.id);
      setCustomerSearch(customerOptionLabel(customer));
    }
  }

  function selectProductFromSearch(lineId: string, value: string) {
    const normalized = value.trim().toLocaleLowerCase();
    const product = activeProducts.find((item) =>
      productOptionLabel(item).toLocaleLowerCase() === normalized
      || item.reference.toLocaleLowerCase() === normalized
      || item.name.toLocaleLowerCase() === normalized);

    if (product) {
      selectProduct(lineId, product.id);
      return;
    }

    updateLine(lineId, { productId: '', productSearch: value });
  }

  function commitProductSearch(lineId: string, value: string) {
    const line = lines.find((item) => item.id === lineId);
    if (line?.productId || !value.trim()) {
      return;
    }

    const normalized = value.trim().toLocaleLowerCase();
    const product = activeProducts.find((item) =>
      productOptionLabel(item).toLocaleLowerCase().startsWith(normalized)
      || item.reference.toLocaleLowerCase().startsWith(normalized)
      || item.name.toLocaleLowerCase().startsWith(normalized));
    if (product) {
      selectProduct(lineId, product.id);
    }
  }

  function startEdit(quote: Quote) {
    setEditingQuoteId(quote.id);
    setCustomerId(quote.customerId);
    setCustomerSearch(customers.find((item) => item.id === quote.customerId)?.companyName ?? quote.customerName ?? '');
    setValidUntil(quote.validUntil);
    setLines(
      quote.lines.length > 0
        ? quote.lines.map((line) => ({
            id: createClientId('quote-line'),
            productId: line.productId ?? '',
            productSearch: line.productReference ? `${line.productReference} - ${line.productName ?? ''}` : '',
            description: line.description,
            quantity: String(line.quantity),
            unitPrice: String(line.unitPrice),
            discountRate: String(line.discountRate),
            vatRate: String(line.vatRate)
          }))
        : [createQuoteDraftLine()]
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!customerId) {
      throw new Error('Creer un client avant de creer un devis.');
    }

    const payload = {
      customerId,
      validUntil,
      lines: lines.map((line) => ({
        productId: line.productId || null,
        description: line.description,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        discountRate: Number(line.discountRate),
        vatRate: Number(line.vatRate)
      }))
    };

    if (editingQuoteId) {
      await api.updateQuote(editingQuoteId, payload);
    } else {
      await api.createQuote(payload);
    }

    resetForm();
    await onChanged();
  }

  async function generatePdf(quote: Quote) {
    await api.generateQuotePdf(quote.id);
    await onChanged();
  }

  async function downloadPdf(quote: Quote) {
    const document = quote.documents[0];
    if (document) {
      await api.downloadQuoteDocument(quote.id, document.id, document.fileName);
    }
  }

  async function changeStatus(quote: Quote, status: string) {
    await api.changeQuoteStatus(quote.id, status, null);
    await onChanged();
  }

  function openEmailModal(quote: Quote) {
    setEmailQuoteId(quote.id);
    setMailAccountId(activeMailAccounts[0]?.id ?? '');
    setEmailTo('');
    setEmailCc('');
    setEmailBcc('');
    setEmailSubject(`Devis ${quote.number}`);
    setEmailBody(`Bonjour,\n\nVeuillez trouver ci-joint le devis ${quote.number}.\n\nCordialement`);
    setQuoteFeedback(null);
  }

  async function sendEmail(event: FormEvent) {
    event.preventDefault();
    if (!emailQuoteId) {
      return;
    }

    try {
      await api.sendQuoteEmail(emailQuoteId, { mailAccountId, to: emailTo, cc: emailCc || null, bcc: emailBcc || null, subject: emailSubject, body: emailBody });
      setEmailQuoteId(null);
      setQuoteFeedback('Devis envoye par email.');
      await onChanged();
    } catch (err) {
      setQuoteFeedback(err instanceof Error ? err.message : "Envoi du devis impossible.");
    }
  }

  async function convertToOrder(event: FormEvent) {
    event.preventDefault();
    if (!orderQuoteId) {
      return;
    }

    await api.createOrderFromQuote(orderQuoteId, orderWarehouseId || null);
    setOrderQuoteId(null);
    setOrderWarehouseId('');
    await onChanged();
  }

  return (
    <>
      {quoteFeedback && <div className={quoteFeedback.includes('impossible') || quoteFeedback.includes('desactive') ? 'alert' : 'sync-note'}>{quoteFeedback}</div>}
      <Panel title={editingQuote ? `Modifier devis ${editingQuote.number}` : 'Nouveau devis'}>
        <form className="quote-builder" onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              <span>Client</span>
              <input
                required
                list="quote-customers"
                placeholder="Rechercher un client"
                value={customerSearch}
                onBlur={commitCustomerSearch}
                onChange={(event) => selectCustomerFromSearch(event.target.value)}
              />
              <datalist id="quote-customers">
                {customers.map((customer) => (
                  <option key={customer.id} value={customerOptionLabel(customer)} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <span>Validite</span>
              <input required type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
            </label>
          </div>
          <section className="purchase-section">
            <div className="section-heading">
              <h3>Lignes devis</h3>
              <button className="secondary" type="button" onClick={() => setLines((current) => [...current, createQuoteDraftLine()])}>
                <Plus size={16} />
                Ajouter une ligne
              </button>
            </div>
            <div className="quote-lines">
              {lines.map((line, index) => {
                const net = Number(line.quantity || 0) * Number(line.unitPrice || 0) * (1 - Number(line.discountRate || 0) / 100);
                const vat = net * Number(line.vatRate || 0) / 100;
                return (
                  <div className="quote-line-row" key={line.id}>
                    <label className="field">
                      <span>Produit</span>
                      <input
                        list={`quote-products-${line.id}`}
                        placeholder="Rechercher un produit"
                        value={productSearchLabel(line)}
                        onBlur={(event) => commitProductSearch(line.id, event.target.value)}
                        onChange={(event) => selectProductFromSearch(line.id, event.target.value)}
                      />
                      <datalist id={`quote-products-${line.id}`}>
                        {activeProducts.map((product) => (
                          <option key={product.id} value={productOptionLabel(product)} />
                        ))}
                      </datalist>
                    </label>
                    <label className="field description-cell">
                      <span>Description</span>
                      <input required value={line.description} onChange={(event) => updateLine(line.id, { description: event.target.value })} />
                    </label>
                    <label className="field quote-number-field">
                      <span>Quantite</span>
                      <input required type="number" step="0.001" min="0.001" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: event.target.value })} />
                    </label>
                    <label className="field quote-number-field">
                      <span>Prix HT</span>
                      <input required type="number" step="0.01" min="0" value={line.unitPrice} onChange={(event) => updateLine(line.id, { unitPrice: event.target.value })} />
                    </label>
                    <label className="field quote-number-field">
                      <span>Remise (%)</span>
                      <input required type="number" step="0.01" min="0" max="100" value={line.discountRate} onChange={(event) => updateLine(line.id, { discountRate: event.target.value })} />
                    </label>
                    <label className="field quote-number-field">
                      <span>TVA (%)</span>
                      <input required type="number" step="0.01" min="0" max="100" value={line.vatRate} onChange={(event) => updateLine(line.id, { vatRate: event.target.value })} />
                    </label>
                    <div className="purchase-row-total">
                      <span>Total TTC</span>
                      <strong>{purchaseAmount(net + vat)}</strong>
                    </div>
                    <button className="danger icon-only" type="button" aria-label="Supprimer la ligne" title="Supprimer la ligne" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}>
                      <Trash2 size={16} />
                    </button>
                    <small className="muted-text">Ligne {index + 1}: HT {purchaseAmount(net)} / TVA {purchaseAmount(vat)}</small>
                  </div>
                );
              })}
            </div>
          </section>
          <div className="summary-grid">
            <DetailItem label="Total HT" value={purchaseAmount(totals.net)} />
            <DetailItem label="TVA" value={purchaseAmount(totals.vat)} />
            <DetailItem label="Total TTC" value={purchaseAmount(totals.net + totals.vat)} />
          </div>
          <div className="modal-footer">
            {editingQuote && (
              <button className="secondary" type="button" onClick={resetForm}>
                Annuler
              </button>
            )}
            <button className="primary" type="submit">
              <Save size={16} />
              {editingQuote ? 'Enregistrer' : 'Creer le devis'}
            </button>
          </div>
        </form>
      </Panel>
      <DataTable
        columns={['Numero', 'Client', 'Validite', 'Statut', 'Total TTC', 'Actions']}
        onRowClick={(index) => setSelectedQuoteId(items[index].id)}
        rows={items.map((item) => [
          item.number,
          item.customerName ?? item.customerId,
          item.validUntil,
          quoteStatusLabels[item.status] ?? item.status,
          `${item.total.toFixed(2)} ${item.currency}`,
          <div className="table-actions">
            <button className="secondary" disabled={item.status === 'Signed' || item.status === 'ConvertedToOrder'} onClick={(event) => { event.stopPropagation(); startEdit(item); }} type="button">
              <Pencil size={15} />
              Modifier
            </button>
            {nextQuoteStatuses(item.status).map((status) => (
              <button key={status} className="secondary" onClick={(event) => { event.stopPropagation(); void changeStatus(item, status); }} type="button">
                {quoteStatusLabels[status] ?? status}
              </button>
            ))}
            <button className="secondary" onClick={(event) => { event.stopPropagation(); void generatePdf(item); }} type="button">
              <FileText size={15} />
              Generer
            </button>
            <button className="secondary" disabled={item.documents.length === 0} onClick={(event) => { event.stopPropagation(); void downloadPdf(item); }} type="button">
              <Download size={15} />
              PDF
            </button>
            <button className="secondary" disabled={activeMailAccounts.length === 0 || item.status === 'ConvertedToOrder'} onClick={(event) => { event.stopPropagation(); openEmailModal(item); }} type="button">
              <Mail size={15} />
              Email
            </button>
            <button className="secondary" disabled={item.status !== 'Signed'} onClick={(event) => { event.stopPropagation(); setOrderQuoteId(item.id); }} type="button">
              <ShoppingCart size={15} />
              Commander
            </button>
          </div>
        ])}
      />
      {selectedQuote && <QuoteDetailsModal quote={selectedQuote} onClose={() => setSelectedQuoteId(null)} onDownloadPdf={downloadPdf} />}
      {emailQuote && (
        <div className="modal-backdrop" onClick={() => setEmailQuoteId(null)}>
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="quote-email-title" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <div>
                <span className="eyebrow">EMAIL</span>
                <h2 id="quote-email-title">Envoyer {emailQuote.number}</h2>
              </div>
              <button className="modal-close" type="button" aria-label="Fermer" title="Fermer" onClick={() => setEmailQuoteId(null)}>
                <X size={18} />
              </button>
            </header>
            {quoteFeedback && <div className={quoteFeedback.includes('impossible') || quoteFeedback.includes('desactive') ? 'alert' : 'sync-note'}>{quoteFeedback}</div>}
            <form className="product-edit-form" onSubmit={sendEmail}>
              <div className="form-grid">
                <label className="field">
                  <span>Compte email</span>
                  <select required value={mailAccountId} onChange={(event) => setMailAccountId(event.target.value)}>
                    <option value="">Compte email</option>
                    {activeMailAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.email}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Destinataire</span>
                  <input required multiple type="email" value={emailTo} onChange={(event) => setEmailTo(event.target.value)} />
                </label>
                <label className="field">
                  <span>Cc</span>
                  <input multiple type="email" value={emailCc} onChange={(event) => setEmailCc(event.target.value)} />
                </label>
                <label className="field">
                  <span>Cci</span>
                  <input multiple type="email" value={emailBcc} onChange={(event) => setEmailBcc(event.target.value)} />
                </label>
                <label className="field full-field">
                  <span>Sujet</span>
                  <input required value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} />
                </label>
                <label className="field full-field">
                  <span>Message</span>
                  <textarea value={emailBody} onChange={(event) => setEmailBody(event.target.value)} />
                </label>
              </div>
              <div className="modal-footer">
                <button className="secondary" type="button" onClick={() => setEmailQuoteId(null)}>
                  Annuler
                </button>
                <button className="primary" type="submit">
                  <Mail size={16} />
                  Envoyer
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {orderQuote && (
        <div className="modal-backdrop" onClick={() => setOrderQuoteId(null)}>
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="quote-order-title" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <div>
                <span className="eyebrow">COMMANDE</span>
                <h2 id="quote-order-title">Transformer {orderQuote.number}</h2>
              </div>
              <button className="modal-close" type="button" aria-label="Fermer" title="Fermer" onClick={() => setOrderQuoteId(null)}>
                <X size={18} />
              </button>
            </header>
            <form className="product-edit-form" onSubmit={convertToOrder}>
              <label className="field">
                <span>Entrepot de reservation</span>
                <select value={orderWarehouseId} onChange={(event) => setOrderWarehouseId(event.target.value)}>
                  <option value="">Sans entrepot pour le moment</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="panel-note">La reservation de stock se fera quand la commande sera confirmee.</p>
              <div className="modal-footer">
                <button className="secondary" type="button" onClick={() => setOrderQuoteId(null)}>
                  Annuler
                </button>
                <button className="primary" type="submit">
                  <ShoppingCart size={16} />
                  Transformer
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

function quoteCustomerAddress(customer: Quote['customer']) {
  if (!customer) {
    return '-';
  }

  const cityLine = [customer.postalCode, customer.city].filter(Boolean).join(' ');
  const lines = [customer.addressLine1, customer.addressLine2, cityLine, customer.country].filter(Boolean);
  return lines.length > 0 ? lines.join(', ') : '-';
}

function quoteCustomerContact(customer: Quote['customer']) {
  if (!customer) {
    return '-';
  }

  const values = [customer.contactName, customer.contactEmail, customer.contactPhone].filter(Boolean);
  return values.length > 0 ? values.join(' - ') : '-';
}

function QuoteDetailsModal({ quote, onClose, onDownloadPdf }: { quote: Quote; onClose: () => void; onDownloadPdf: (quote: Quote) => Promise<void> }) {
  const customer = quote.customer;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal-panel quote-modal" role="dialog" aria-modal="true" aria-labelledby="quote-detail-title" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <span className="eyebrow">DEVIS</span>
            <h2 id="quote-detail-title">{quote.number}</h2>
            <p>{customer?.companyName ?? quote.customerName ?? quote.customerId}</p>
          </div>
          <button className="modal-close" type="button" aria-label="Fermer" title="Fermer" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="summary-grid">
          <DetailItem label="Statut" value={quoteStatusLabels[quote.status] ?? quote.status} />
          <DetailItem label="Emission" value={quote.issueDate} />
          <DetailItem label="Validite" value={quote.validUntil} />
          <DetailItem label="Total HT" value={purchaseAmount(quote.subtotal)} />
          <DetailItem label="TVA" value={purchaseAmount(quote.vatTotal)} />
          <DetailItem label="Total TTC" value={purchaseAmount(quote.total)} />
        </div>
        <section className="customer-detail-section">
          <h3>Client</h3>
          <div className="detail-grid customer-summary-grid">
            <DetailItem label="Code client" value={customer?.code ?? '-'} />
            <DetailItem label="Entreprise" value={customer?.companyName ?? quote.customerName ?? '-'} />
            <DetailItem label="Raison sociale" value={customer?.legalName || '-'} />
            <DetailItem label="Nom commercial" value={customer?.tradeName || '-'} />
            <DetailItem label="Contact principal" value={quoteCustomerContact(customer)} />
            <DetailItem label="Email general" value={customer?.email || '-'} />
            <DetailItem label="Telephone" value={customer?.phone || '-'} />
            <DetailItem label="Mobile" value={customer?.mobilePhone || '-'} />
            <DetailItem label="Adresse" value={quoteCustomerAddress(customer)} />
            <DetailItem label="SIREN" value={customer?.sirenNumber || '-'} />
            <DetailItem label="SIRET" value={customer?.siretNumber || '-'} />
            <DetailItem label="TVA intracommunautaire" value={customer?.vatNumber || '-'} />
            <DetailItem label="Site web" value={customer?.website ? <a href={customer.website} target="_blank" rel="noreferrer">{customer.website}</a> : '-'} />
          </div>
        </section>
        <h3>Lignes</h3>
        <DataTable
          columns={['Produit', 'Description', 'Qte', 'PU HT', 'Remise', 'TVA', 'Total TTC']}
          rows={quote.lines.map((line) => [
            line.productReference ? `${line.productReference} - ${line.productName ?? ''}` : 'Ligne libre',
            line.description,
            line.quantity,
            purchaseAmount(line.unitPrice),
            `${line.discountRate}%`,
            `${line.vatRate}%`,
            purchaseAmount(line.lineTotal)
          ])}
        />
        <h3>Documents</h3>
        <DataTable
          columns={['Version', 'Fichier', 'Taille', 'Date', 'Action']}
          rows={quote.documents.map((document) => [
            document.version,
            document.fileName,
            `${Math.round(document.size / 1024)} Ko`,
            document.createdAt,
            <button className="secondary" type="button" onClick={() => onDownloadPdf(quote)}>
              <Download size={15} />
              PDF
            </button>
          ])}
        />
        <h3>Historique</h3>
        <DataTable
          columns={['Statut', 'Commentaire', 'Utilisateur', 'Date']}
          rows={quote.statusHistory.map((history) => [
            quoteStatusLabels[history.status] ?? history.status,
            history.comment ?? '-',
            history.changedByDisplayName || history.changedByEmail || history.changedByUserId || 'Systeme',
            history.changedAt
          ])}
        />
      </section>
    </div>
  );
}

function Orders({ items, customers, products, warehouses, onChanged }: { items: SalesOrder[]; customers: Customer[]; products: Product[]; warehouses: Warehouse[]; onChanged: () => Promise<void> }) {
  const [customerId, setCustomerId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [productId, setProductId] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('0');

  const selectedProduct = products.find((product) => product.id === productId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const selectedCustomerId = customerId || customers[0]?.id;
    const selectedWarehouseId = warehouseId || warehouses[0]?.id;
    if (!selectedCustomerId) {
      throw new Error('Creer un client avant de creer une commande.');
    }

    await api.createOrder({
      customerId: selectedCustomerId,
      warehouseId: selectedWarehouseId ?? null,
      lines: [{ productId: productId || null, description: description || selectedProduct?.name || 'Ligne libre', quantity: Number(quantity), unitPrice: Number(unitPrice) }]
    });
    setProductId('');
    setDescription('');
    setQuantity('1');
    setUnitPrice('0');
    await onChanged();
  }

  async function changeStatus(order: SalesOrder, status: string) {
    await api.changeOrderStatus(order.id, status);
    await onChanged();
  }

  return (
    <>
      <Panel title="Nouvelle commande">
        <form className="form-grid" onSubmit={submit}>
          <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">Client</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.companyName}
              </option>
            ))}
          </select>
          <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
            <option value="">Entrepot</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
          <select
            value={productId}
            onChange={(event) => {
              const nextProduct = products.find((product) => product.id === event.target.value);
              setProductId(event.target.value);
              if (nextProduct) {
                setDescription(`${nextProduct.reference} - ${nextProduct.name}`);
                setUnitPrice(String(nextProduct.salePrice));
              }
            }}
          >
            <option value="">Ligne libre</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.reference} - {product.name}
              </option>
            ))}
          </select>
          <input required placeholder="Ligne" value={description} onChange={(event) => setDescription(event.target.value)} />
          <input required type="number" step="0.001" placeholder="Quantite" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          <input required type="number" step="0.01" placeholder="Prix HT" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} />
          <button className="primary" type="submit">
            <Plus size={16} />
            Creer
          </button>
        </form>
      </Panel>
      <DataTable
        columns={['Numero', 'Client', 'Statut', 'Total', 'Actions']}
        rows={items.map((item) => [
          item.number,
          item.customerId,
          item.status,
          `${item.total.toFixed(2)} EUR`,
          <div className="table-actions">
            {item.status === 'Draft' && (
              <button className="secondary" type="button" onClick={() => changeStatus(item, 'Confirmed')}>
                Confirmer
              </button>
            )}
            {(item.status === 'Confirmed' || item.status === 'Preparing') && (
              <button className="secondary" type="button" onClick={() => changeStatus(item, 'Shipped')}>
                Expedier
              </button>
            )}
            {item.status === 'Shipped' && (
              <button className="secondary" type="button" onClick={() => changeStatus(item, 'Completed')}>
                Terminer
              </button>
            )}
          </div>
        ])}
      />
    </>
  );
}

type PurchaseDraftLine = {
  id: string;
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  vatRate: string;
};

type PurchaseDraftCharge = {
  id: string;
  label: string;
  amount: string;
  vatRate: string;
};

function createClientId(prefix: string) {
  const randomUuid = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (randomUuid) {
    return randomUuid();
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createPurchaseDraftLine(): PurchaseDraftLine {
  return { id: createClientId('purchase-line'), productId: '', description: '', quantity: '1', unitPrice: '0', vatRate: '20' };
}

function createPurchaseDraftCharge(label = ''): PurchaseDraftCharge {
  return { id: createClientId('purchase-charge'), label, amount: '0', vatRate: '20' };
}

function purchaseAmount(value?: number | null) {
  const amount = Number.isFinite(value) ? value! : 0;
  return `${amount.toFixed(2)} EUR`;
}

function Purchases({ items, suppliers, products, warehouses, stockItems, onChanged }: { items: PurchaseOrder[]; suppliers: ProductSupplier[]; products: Product[]; warehouses: Warehouse[]; stockItems: StockItem[]; onChanged: () => Promise<void> }) {
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [comment, setComment] = useState('');
  const [lines, setLines] = useState<PurchaseDraftLine[]>(() => [createPurchaseDraftLine()]);
  const [charges, setCharges] = useState<PurchaseDraftCharge[]>([]);
  const [editingOrderId, setEditingOrderId] = useState('');
  const [dateOrderId, setDateOrderId] = useState('');
  const [dateValue, setDateValue] = useState('');
  const [warehouseOrderId, setWarehouseOrderId] = useState('');
  const [warehouseValue, setWarehouseValue] = useState('');
  const editingOrder = items.find((item) => item.id === editingOrderId);
  const selectedDateOrder = items.find((item) => item.id === dateOrderId);
  const selectedWarehouseOrder = items.find((item) => item.id === warehouseOrderId);
  const selectedWarehouseProductIds = useMemo(() => new Set(stockItems.filter((item) => item.warehouseId === warehouseId).map((item) => item.productId)), [stockItems, warehouseId]);
  const availablePurchaseProducts = useMemo(
    () => (warehouseId && supplierId ? products.filter((product) => product.isActive && product.mainSupplierId === supplierId && selectedWarehouseProductIds.has(product.id)) : []),
    [products, selectedWarehouseProductIds, supplierId, warehouseId]
  );
  const availablePurchaseProductIds = useMemo(() => new Set(availablePurchaseProducts.map((product) => product.id)), [availablePurchaseProducts]);

  useEffect(() => {
    setDateValue(selectedDateOrder?.expectedAt ?? '');
  }, [selectedDateOrder]);

  useEffect(() => {
    setWarehouseValue(selectedWarehouseOrder?.warehouseId ?? '');
  }, [selectedWarehouseOrder]);

  useEffect(() => {
    setLines((current) => {
      let changed = false;
      const next = current.map((line) => {
        if (!line.productId || availablePurchaseProductIds.has(line.productId)) {
          return line;
        }

        changed = true;
        return { ...line, productId: '', description: '', unitPrice: '0', vatRate: '20' };
      });
      return changed ? next : current;
    });
  }, [availablePurchaseProductIds]);

  function resetPurchaseForm() {
    setSupplierId('');
    setWarehouseId('');
    setExpectedAt('');
    setComment('');
    setLines([createPurchaseDraftLine()]);
    setCharges([]);
    setEditingOrderId('');
  }

  function canEditPurchaseOrder(order: PurchaseOrder) {
    return order.status !== 'Received' && order.status !== 'Cancelled' && !(order.lines ?? []).some((line) => line.receivedQuantity > 0);
  }

  function startEdit(order: PurchaseOrder) {
    setEditingOrderId(order.id);
    setSupplierId(order.supplierId);
    setWarehouseId(order.warehouseId ?? '');
    setExpectedAt(order.expectedAt ?? '');
    setComment(order.comment ?? '');
    const nextLines = (order.lines ?? []).map((line) => ({
      id: createClientId('purchase-line'),
      productId: line.productId ?? '',
      description: line.description,
      quantity: String(line.quantity),
      unitPrice: String(line.unitPrice),
      vatRate: String(line.vatRate)
    }));
    setLines(nextLines.length > 0 ? nextLines : [createPurchaseDraftLine()]);
    setCharges((order.charges ?? []).map((charge) => ({
      id: createClientId('purchase-charge'),
      label: charge.label,
      amount: String(charge.amount),
      vatRate: String(charge.vatRate)
    })));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function productsForLine(currentProductId: string) {
    if (!currentProductId || availablePurchaseProducts.some((product) => product.id === currentProductId)) {
      return availablePurchaseProducts;
    }

    const currentProduct = products.find((product) => product.id === currentProductId);
    return currentProduct ? [currentProduct, ...availablePurchaseProducts] : availablePurchaseProducts;
  }

  function updateLine(lineId: string, patch: Partial<PurchaseDraftLine>) {
    setLines((current) => current.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  }

  function selectProduct(lineId: string, nextProductId: string) {
    if (!supplierId) {
      throw new Error('Selectionner le fournisseur avant de choisir un produit.');
    }

    if (!warehouseId) {
      throw new Error("Selectionner l'entrepot de reception avant de choisir un produit.");
    }

    const product = products.find((item) => item.id === nextProductId);
    if (product && product.mainSupplierId !== supplierId) {
      throw new Error("Ce produit n'est pas rattache au fournisseur selectionne.");
    }

    updateLine(lineId, {
      productId: nextProductId,
      description: product ? `${product.reference} - ${product.name}` : '',
      unitPrice: product ? String(product.purchasePrice) : '0',
      vatRate: product ? String(product.vatRate) : '20'
    });
  }

  function updateCharge(chargeId: string, patch: Partial<PurchaseDraftCharge>) {
    setCharges((current) => current.map((charge) => (charge.id === chargeId ? { ...charge, ...patch } : charge)));
  }

  function lineTotals(line: PurchaseDraftLine) {
    const net = Number(line.quantity || 0) * Number(line.unitPrice || 0);
    const vat = net * Number(line.vatRate || 0) / 100;
    return { net, vat, total: net + vat };
  }

  function chargeTotals(charge: PurchaseDraftCharge) {
    const net = Number(charge.amount || 0);
    const vat = net * Number(charge.vatRate || 0) / 100;
    return { net, vat, total: net + vat };
  }

  const linesNetTotal = lines.reduce((sum, line) => sum + lineTotals(line).net, 0);
  const linesVatTotal = lines.reduce((sum, line) => sum + lineTotals(line).vat, 0);
  const chargesNetTotal = charges.reduce((sum, charge) => sum + chargeTotals(charge).net, 0);
  const chargesVatTotal = charges.reduce((sum, charge) => sum + chargeTotals(charge).vat, 0);
  const orderTotal = linesNetTotal + linesVatTotal + chargesNetTotal + chargesVatTotal;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supplierId) {
      throw new Error('Selectionner le fournisseur avant de creer une commande fournisseur.');
    }
    if (!warehouseId) {
      throw new Error("Selectionner l'entrepot de reception avant de saisir les lignes produit.");
    }

    const payload = {
      supplierId,
      warehouseId: warehouseId || null,
      expectedAt: expectedAt || null,
      comment: comment || null,
      lines: lines.map((line) => ({
        productId: line.productId || null,
        description: line.description,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        vatRate: Number(line.vatRate)
      })),
      charges: charges
        .filter((charge) => charge.label.trim() || Number(charge.amount) > 0)
        .map((charge) => ({ label: charge.label, amount: Number(charge.amount), vatRate: Number(charge.vatRate) }))
    };

    if (editingOrderId) {
      await api.updatePurchaseOrder(editingOrderId, payload);
    } else {
      await api.createPurchaseOrder(payload);
    }

    resetPurchaseForm();
    await onChanged();
  }

  async function changeStatus(order: PurchaseOrder, status: string) {
    await api.changePurchaseOrderStatus(order.id, status);
    if (editingOrderId === order.id) {
      resetPurchaseForm();
    }
    await onChanged();
  }

  function hasStockToReceive(order: PurchaseOrder) {
    return (order.lines ?? []).some((line) => line.productId && line.quantity > line.receivedQuantity);
  }

  async function receiveToStock(order: PurchaseOrder) {
    if (!order.warehouseId) {
      throw new Error("Selectionner l'entrepot de reception de la commande avant ajout au stock.");
    }

    await api.receivePurchaseOrderToStock(order.id, order.warehouseId);
    await onChanged();
  }

  async function updateExpectedAt(event: FormEvent) {
    event.preventDefault();
    if (!dateOrderId) {
      throw new Error('Selectionner une commande fournisseur.');
    }

    await api.updatePurchaseOrderExpectedAt(dateOrderId, dateValue || null);
    await onChanged();
  }

  async function updateOrderWarehouse(event: FormEvent) {
    event.preventDefault();
    if (!warehouseOrderId) {
      throw new Error('Selectionner une commande fournisseur.');
    }

    if (!warehouseValue) {
      throw new Error("Selectionner l'entrepot de reception.");
    }

    await api.updatePurchaseOrderWarehouse(warehouseOrderId, warehouseValue);
    await onChanged();
  }

  return (
    <>
      <Panel title={editingOrder ? `Modifier commande fournisseur ${editingOrder.number}` : 'Nouvelle commande fournisseur'}>
        <form className="purchase-builder" onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              <span>Fournisseur</span>
              <select required value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
                <option value="">Selectionner un fournisseur</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Date reception prevue</span>
              <input type="date" value={expectedAt} onChange={(event) => setExpectedAt(event.target.value)} />
            </label>
            <label className="field">
              <span>Entrepot de reception</span>
              <select required value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
                <option value="">Selectionner un entrepot</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field wide-field">
              <span>Commentaires</span>
              <textarea placeholder="Instructions fournisseur, conditions, remarques internes..." value={comment} onChange={(event) => setComment(event.target.value)} />
            </label>
          </div>

          <section className="purchase-section">
            <div className="section-heading">
              <h3>Lignes produits</h3>
              <button className="secondary" type="button" disabled={!supplierId || !warehouseId} title={!supplierId ? "Selectionner le fournisseur avant d'ajouter une ligne" : !warehouseId ? "Selectionner l'entrepot avant d'ajouter une ligne" : undefined} onClick={() => setLines((current) => [...current, createPurchaseDraftLine()])}>
                <Plus size={16} />
                Ajouter une ligne
              </button>
            </div>
            {!supplierId && <p className="panel-note">Selectionnez d'abord le fournisseur pour afficher ses produits.</p>}
            {supplierId && !warehouseId && <p className="panel-note">Selectionnez ensuite l'entrepot de reception pour afficher les produits disponibles.</p>}
            {supplierId && warehouseId && availablePurchaseProducts.length === 0 && <p className="panel-note">Aucun produit actif n'est rattache a ce fournisseur dans cet entrepot.</p>}
            <div className="purchase-lines">
              {lines.map((line, index) => {
                const totals = lineTotals(line);
                return (
                  <div className="purchase-line-row" key={line.id}>
                    <label className="field">
                      <span>Produit</span>
                      <select disabled={!supplierId || !warehouseId} value={line.productId} onChange={(event) => selectProduct(line.id, event.target.value)}>
                        <option value="">Ligne libre</option>
                        {productsForLine(line.productId).map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.reference} - {product.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field description-cell">
                      <span>Description</span>
                      <input required placeholder="Designation fournisseur" value={line.description} onChange={(event) => updateLine(line.id, { description: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>Quantite</span>
                      <input required type="number" step="0.001" min="0.001" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>Prix achat HT</span>
                      <input required type="number" step="0.01" min="0" value={line.unitPrice} onChange={(event) => updateLine(line.id, { unitPrice: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>TVA (%)</span>
                      <input required type="number" step="0.01" min="0" max="100" value={line.vatRate} onChange={(event) => updateLine(line.id, { vatRate: event.target.value })} />
                    </label>
                    <div className="purchase-row-total">
                      <span>Total TTC</span>
                      <strong>{purchaseAmount(totals.total)}</strong>
                    </div>
                    <button className="danger icon-only" type="button" aria-label="Supprimer la ligne" title="Supprimer la ligne" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}>
                      <Trash2 size={16} />
                    </button>
                    <small className="muted-text">Ligne {index + 1}: HT {purchaseAmount(totals.net)} / TVA {purchaseAmount(totals.vat)}</small>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="purchase-section">
            <div className="section-heading">
              <h3>Frais annexes</h3>
              <div className="table-actions">
                <button className="secondary" type="button" onClick={() => setCharges((current) => [...current, createPurchaseDraftCharge('Livraison')])}>
                  Livraison
                </button>
                <button className="secondary" type="button" onClick={() => setCharges((current) => [...current, createPurchaseDraftCharge('Douane')])}>
                  Douane
                </button>
                <button className="secondary" type="button" onClick={() => setCharges((current) => [...current, createPurchaseDraftCharge()])}>
                  <Plus size={16} />
                  Autre frais
                </button>
              </div>
            </div>
            {charges.length === 0 ? (
              <p className="panel-note">Aucun frais annexe ajoute.</p>
            ) : (
              <div className="purchase-charges">
                {charges.map((charge) => {
                  const totals = chargeTotals(charge);
                  return (
                    <div className="purchase-charge-row" key={charge.id}>
                      <label className="field">
                        <span>Libelle</span>
                        <input required placeholder="Livraison, douane..." value={charge.label} onChange={(event) => updateCharge(charge.id, { label: event.target.value })} />
                      </label>
                      <label className="field">
                        <span>Montant HT</span>
                        <input required type="number" step="0.01" min="0" value={charge.amount} onChange={(event) => updateCharge(charge.id, { amount: event.target.value })} />
                      </label>
                      <label className="field">
                        <span>TVA (%)</span>
                        <input required type="number" step="0.01" min="0" max="100" value={charge.vatRate} onChange={(event) => updateCharge(charge.id, { vatRate: event.target.value })} />
                      </label>
                      <div className="purchase-row-total">
                        <span>Total TTC</span>
                        <strong>{purchaseAmount(totals.total)}</strong>
                      </div>
                      <button className="danger icon-only" type="button" aria-label="Supprimer le frais" title="Supprimer le frais" onClick={() => setCharges((current) => current.filter((item) => item.id !== charge.id))}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="purchase-summary">
            <DetailItem label="Articles HT" value={purchaseAmount(linesNetTotal)} />
            <DetailItem label="Frais HT" value={purchaseAmount(chargesNetTotal)} />
            <DetailItem label="TVA" value={purchaseAmount(linesVatTotal + chargesVatTotal)} />
            <DetailItem label="Total TTC" value={purchaseAmount(orderTotal)} />
          </div>
          <div className="form-actions">
            {editingOrder && (
              <button className="secondary" type="button" onClick={resetPurchaseForm}>
                Annuler la modification
              </button>
            )}
            <button className="primary" type="submit" disabled={!warehouseId}>
              {editingOrder ? <Save size={16} /> : <Plus size={16} />}
              {editingOrder ? 'Enregistrer les modifications' : 'Creer la commande'}
            </button>
          </div>
        </form>
      </Panel>

      <Panel title="Date de reception connue">
        <form className="form-grid" onSubmit={updateExpectedAt}>
          <select value={dateOrderId} onChange={(event) => setDateOrderId(event.target.value)}>
            <option value="">Commande fournisseur</option>
            {items
              .filter((item) => item.status !== 'Received' && item.status !== 'Cancelled')
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.number} - {item.supplierName ?? item.supplierId}
                </option>
              ))}
          </select>
          <input type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} />
          <button className="primary" type="submit">
            <Save size={16} />
            Enregistrer
          </button>
        </form>
      </Panel>

      <Panel title="Entrepot de reception">
        <form className="form-grid" onSubmit={updateOrderWarehouse}>
          <select value={warehouseOrderId} onChange={(event) => setWarehouseOrderId(event.target.value)}>
            <option value="">Commande fournisseur</option>
            {items
              .filter((item) => !item.lines.some((line) => line.receivedQuantity > 0))
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.number} - {item.supplierName ?? item.supplierId}
                </option>
              ))}
          </select>
          <select value={warehouseValue} onChange={(event) => setWarehouseValue(event.target.value)}>
            <option value="">Entrepot</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
          <button className="primary" type="submit">
            <Save size={16} />
            Enregistrer
          </button>
        </form>
        <p className="panel-note">La reception stock utilise uniquement cet entrepot. Aucun entrepot n'est choisi automatiquement.</p>
      </Panel>

      <DataTable
        columns={['Numero', 'Fournisseur', 'Entrepot', 'Statut', 'Reception prevue', 'HT', 'TVA', 'Total TTC', 'Lignes', 'Actions']}
        rows={items.map((item) => {
          const orderLines = item.lines ?? [];
          const lineNet = item.linesNetTotal ?? orderLines.reduce((sum, line) => sum + (line.lineNetTotal ?? line.quantity * line.unitPrice), 0);
          const lineVat = item.linesVatTotal ?? orderLines.reduce((sum, line) => sum + (line.lineVatTotal ?? 0), 0);
          const chargesNet = item.chargesNetTotal ?? 0;
          const chargesVat = item.chargesVatTotal ?? 0;
          const stockPending = hasStockToReceive(item);
          return [
            item.number,
            item.supplierName ?? item.supplierId,
            item.warehouseName ?? 'A definir',
            purchaseStatusLabel(item.status),
            item.expectedAt || '-',
            purchaseAmount(lineNet + chargesNet),
            purchaseAmount(lineVat + chargesVat),
            purchaseAmount(item.total),
            orderLines.map((line) => line.productReference ?? line.description).join(', '),
            <div className="table-actions">
              {canEditPurchaseOrder(item) && (
                <button className="secondary" type="button" onClick={() => startEdit(item)}>
                  <Pencil size={16} />
                  Modifier
                </button>
              )}
              {item.status === 'Draft' && (
                <button className="secondary" type="button" onClick={() => changeStatus(item, 'Ordered')}>
                  Commander
                </button>
              )}
              {item.status === 'Ordered' && (
                <button className="secondary" type="button" onClick={() => changeStatus(item, 'Draft')}>
                  Retour brouillon
                </button>
              )}
              {item.status === 'PartiallyReceived' && (
                <button className="secondary" type="button" onClick={() => changeStatus(item, 'Ordered')}>
                  Retour commandee
                </button>
              )}
              {item.status === 'Received' && (
                <button className="secondary" type="button" onClick={() => changeStatus(item, 'Ordered')}>
                  Retour commandee
                </button>
              )}
              {item.status === 'Cancelled' && (
                <button className="secondary" type="button" onClick={() => changeStatus(item, 'Draft')}>
                  Reouvrir
                </button>
              )}
              {(item.status === 'Ordered' || item.status === 'PartiallyReceived') && (
                <button className="secondary" type="button" onClick={() => changeStatus(item, 'Received')}>
                  Recu
                </button>
              )}
              {item.status === 'Received' && stockPending && (
                <>
                  {item.warehouseId ? (
                    <button className="primary" type="button" onClick={() => receiveToStock(item)}>
                      Ajouter au stock
                    </button>
                  ) : (
                    <button className="secondary" type="button" onClick={() => setWarehouseOrderId(item.id)}>
                      Choisir entrepot
                    </button>
                  )}
                </>
              )}
              {item.status !== 'Received' && item.status !== 'Cancelled' && (
                <button className="danger" type="button" onClick={() => changeStatus(item, 'Cancelled')}>
                  Annuler
                </button>
              )}
            </div>
          ];
        })}
      />
    </>
  );
}

function purchaseStatusLabel(status: string) {
  const labels: Record<string, string> = {
    Draft: 'Brouillon',
    Ordered: 'Commandee',
    PartiallyReceived: 'Partiellement recue',
    Received: 'Recue',
    Cancelled: 'Annulee'
  };
  return labels[status] ?? status;
}

function Invoices({ items, orders, onChanged }: { items: Invoice[]; orders: SalesOrder[]; onChanged: () => Promise<void> }) {
  const [orderId, setOrderId] = useState('');
  const [paymentInvoiceId, setPaymentInvoiceId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('0');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const selectedOrderId = orderId || orders.find((order) => order.status === 'Shipped' || order.status === 'Completed')?.id;
    if (!selectedOrderId) {
      throw new Error('Creer une commande avant de creer une facture.');
    }

    await api.createInvoiceFromOrder(selectedOrderId);
    setOrderId('');
    await onChanged();
  }

  async function addPayment(event: FormEvent) {
    event.preventDefault();
    const invoiceId = paymentInvoiceId || items.find((invoice) => invoice.balanceDue > 0)?.id;
    if (!invoiceId) {
      throw new Error('Aucune facture a regler.');
    }

    await api.addInvoicePayment(invoiceId, { amount: Number(paymentAmount), paidOn: new Date().toISOString().slice(0, 10) });
    setPaymentAmount('0');
    await onChanged();
  }

  async function generatePdf(invoice: Invoice) {
    await api.generateInvoicePdf(invoice.id);
    await onChanged();
  }

  async function downloadPdf(invoice: Invoice) {
    const document = invoice.documents[0];
    if (document) {
      await api.downloadInvoiceDocument(invoice.id, document.id, document.fileName);
    }
  }

  return (
    <>
      <Panel title="Nouvelle facture depuis commande">
        <form className="form-grid" onSubmit={submit}>
          <select value={orderId} onChange={(event) => setOrderId(event.target.value)}>
            <option value="">Commande</option>
            {orders
              .filter((order) => order.status === 'Shipped' || order.status === 'Completed')
              .map((order) => (
                <option key={order.id} value={order.id}>
                  {order.number}
                </option>
              ))}
          </select>
          <button className="primary" type="submit">
            <Plus size={16} />
            Facturer
          </button>
        </form>
      </Panel>
      <Panel title="Paiement facture">
        <form className="form-grid" onSubmit={addPayment}>
          <select value={paymentInvoiceId} onChange={(event) => setPaymentInvoiceId(event.target.value)}>
            <option value="">Facture</option>
            {items
              .filter((invoice) => invoice.balanceDue > 0)
              .map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.number} - solde {invoice.balanceDue.toFixed(2)} EUR
                </option>
              ))}
          </select>
          <input required type="number" step="0.01" placeholder="Montant" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} />
          <button className="primary" type="submit">
            <Plus size={16} />
            Regler
          </button>
        </form>
      </Panel>
      <DataTable
        columns={['Numero', 'Client', 'Statut', 'Total', 'Solde', 'PDF']}
        rows={items.map((item) => [
          item.number,
          item.customerId,
          item.status,
          `${item.total.toFixed(2)} EUR`,
          `${item.balanceDue.toFixed(2)} EUR`,
          <div className="table-actions">
            <button className="secondary" onClick={() => generatePdf(item)} type="button">
              <FileText size={15} />
              Generer
            </button>
            <button className="secondary" disabled={item.documents.length === 0} onClick={() => downloadPdf(item)} type="button">
              <Download size={15} />
              PDF
            </button>
          </div>
        ])}
      />
    </>
  );
}

function Stock({
  items,
  movements,
  products,
  warehouses,
  purchaseOrders,
  focusedProductIds,
  onClearFocusedProducts,
  prestashopConnections,
  onChanged
}: {
  items: StockItem[];
  movements: StockMovement[];
  products: Product[];
  warehouses: Warehouse[];
  purchaseOrders: PurchaseOrder[];
  focusedProductIds: string[];
  onClearFocusedProducts: () => void;
  prestashopConnections: PrestashopConnection[];
  onChanged: () => Promise<void>;
}) {
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [alertThreshold, setAlertThreshold] = useState('0');
  const [activeStockTab, setActiveStockTab] = useState<'items' | 'movements'>('items');
  const [stockSearch, setStockSearch] = useState('');
  const [stockFilterColumn, setStockFilterColumn] = useState('all');
  const [stockFilterWarehouseId, setStockFilterWarehouseId] = useState('');
  const [movementSearch, setMovementSearch] = useState('');
  const [movementFilterColumn, setMovementFilterColumn] = useState('all');
  const [movementFilterWarehouseId, setMovementFilterWarehouseId] = useState('');
  const [movementFilterType, setMovementFilterType] = useState('');
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const warehouseById = useMemo(() => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])), [warehouses]);
  const activePrestashopConnections = useMemo(() => prestashopConnections.filter((connection) => connection.isActive), [prestashopConnections]);
  const activePrestashopConnection = activePrestashopConnections[0];
  const activePurchaseOrders = useMemo(() => purchaseOrders.filter((order) => order.status === 'Ordered' || order.status === 'PartiallyReceived'), [purchaseOrders]);
  const selectedStock = selectedStockId ? items.find((item) => item.id === selectedStockId) ?? null : null;
  const selectedMovement = selectedMovementId ? movements.find((item) => item.id === selectedMovementId) ?? null : null;
  const movementTypes = useMemo(() => Array.from(new Set(movements.map((movement) => movement.type))).sort(), [movements]);
  const focusedProductSet = useMemo(() => new Set(focusedProductIds), [focusedProductIds]);

  useEffect(() => {
    if (focusedProductIds.length > 0) {
      setActiveStockTab('items');
      setStockSearch('');
      setStockFilterColumn('product');
      setStockFilterWarehouseId('');
    }
  }, [focusedProductIds]);

  function productLabel(id: string) {
    const product = productById.get(id);
    return product ? `${product.reference} - ${product.name}` : id;
  }

  function warehouseLabel(id: string) {
    return warehouseById.get(id)?.name ?? id;
  }

  function purchaseOrdersForProduct(productId: string) {
    return activePurchaseOrders.filter((order) => order.lines.some((line) => line.productId === productId && line.quantity > line.receivedQuantity));
  }

  function stockStatus(item: StockItem) {
    if (productById.get(item.productId)?.isActive === false) {
      return 'Inactif';
    }

    const incoming = purchaseOrdersForProduct(item.productId);
    if (incoming.length > 0 && item.availableQuantity <= item.alertThreshold) {
      return 'En reapprovisionnement';
    }

    if (item.availableQuantity <= 0) {
      return 'Hors stock';
    }

    if (item.isLowStock) {
      return 'Stock bas';
    }

    return 'En stock';
  }

  function movementAuthor(item: StockMovement) {
    return item.createdByDisplayName || item.createdByEmail || item.createdByUserId || 'Systeme / inconnu';
  }

  function stockColumnText(item: StockItem, column: string) {
    const values: Record<string, string> = {
      product: productLabel(item.productId),
      warehouse: warehouseLabel(item.warehouseId),
      stock: item.quantityOnHand.toString(),
      reserved: item.quantityReserved.toString(),
      available: item.availableQuantity.toString(),
      threshold: (item.isLowStock ? `Bas ${item.alertThreshold}` : item.alertThreshold).toString(),
      status: stockStatus(item)
    };
    return column === 'all' ? Object.values(values).join(' ') : values[column] ?? '';
  }

  function movementColumnText(item: StockMovement, column: string) {
    const values: Record<string, string> = {
      product: productLabel(item.productId),
      warehouse: warehouseLabel(item.warehouseId),
      type: item.type,
      quantity: item.quantity.toString(),
      reason: item.reason,
      date: item.createdAt,
      author: movementAuthor(item)
    };
    return column === 'all' ? Object.values(values).join(' ') : values[column] ?? '';
  }

  const filteredStockItems = useMemo(() => {
    const query = stockSearch.trim().toLowerCase();
    return items.filter((item) => {
      if (stockFilterWarehouseId && item.warehouseId !== stockFilterWarehouseId) {
        return false;
      }

      if (focusedProductSet.size > 0 && !focusedProductSet.has(item.productId)) {
        return false;
      }

      return !query || stockColumnText(item, stockFilterColumn).toLowerCase().includes(query);
    });
  }, [items, stockSearch, stockFilterColumn, stockFilterWarehouseId, focusedProductSet, productById, warehouseById, activePurchaseOrders]);

  const filteredMovements = useMemo(() => {
    const query = movementSearch.trim().toLowerCase();
    return movements.filter((item) => {
      if (movementFilterWarehouseId && item.warehouseId !== movementFilterWarehouseId) {
        return false;
      }

      if (movementFilterType && item.type !== movementFilterType) {
        return false;
      }

      return !query || movementColumnText(item, movementFilterColumn).toLowerCase().includes(query);
    });
  }, [movements, movementSearch, movementFilterColumn, movementFilterWarehouseId, movementFilterType, productById, warehouseById]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const selectedProductId = productId || products[0]?.id;
    const selectedWarehouseId = warehouseId;
    if (!selectedProductId || !selectedWarehouseId) {
      throw new Error('Creer un produit et un entrepot avant de modifier le stock.');
    }

    await api.adjustStock({
      productId: selectedProductId,
      warehouseId: selectedWarehouseId,
      quantity: Number(quantity),
      reason: 'Adjustment from UI',
      alertThreshold: Number(alertThreshold)
    });
    setQuantity('0');
    await onChanged();
  }

  return (
    <>
      <Panel title="Correction de stock">
        <form className="form-grid" onSubmit={submit}>
          <select value={productId} onChange={(event) => setProductId(event.target.value)}>
            <option value="">Produit</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.reference} - {product.name}
              </option>
            ))}
          </select>
          <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
            <option value="">Entrepot</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
          <input required type="number" step="0.001" placeholder="Quantite" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          <input required type="number" step="0.001" placeholder="Seuil alerte" value={alertThreshold} onChange={(event) => setAlertThreshold(event.target.value)} />
          <button className="primary" type="submit">
            <Plus size={16} />
            Ajuster
          </button>
        </form>
      </Panel>
      <nav className="browser-tabs">
        <button type="button" className={activeStockTab === 'items' ? 'active' : ''} onClick={() => setActiveStockTab('items')}>
          Stock
        </button>
        <button type="button" className={activeStockTab === 'movements' ? 'active' : ''} onClick={() => setActiveStockTab('movements')}>
          Mouvements
        </button>
      </nav>
      {activeStockTab === 'items' && (
        <section className="tab-page">
          {focusedProductIds.length > 0 && (
            <div className="inline-filter-banner">
              <span>{filteredStockItems.length} ligne(s) de stock sous surveillance depuis une notification.</span>
              <button className="secondary" type="button" onClick={onClearFocusedProducts}>
                Reinitialiser
              </button>
            </div>
          )}
          <Panel title="Filtres stock">
            <form className="form-grid filter-grid" onSubmit={(event) => event.preventDefault()}>
              <input placeholder="Rechercher un produit, entrepot, quantite..." value={stockSearch} onChange={(event) => setStockSearch(event.target.value)} />
              <select value={stockFilterColumn} onChange={(event) => setStockFilterColumn(event.target.value)}>
                <option value="all">Toutes les colonnes</option>
                <option value="product">Produit</option>
                <option value="warehouse">Entrepot</option>
                <option value="stock">Stock</option>
                <option value="reserved">Reserve</option>
                <option value="available">Disponible</option>
                <option value="threshold">Seuil</option>
                <option value="status">Statut</option>
              </select>
              <select value={stockFilterWarehouseId} onChange={(event) => setStockFilterWarehouseId(event.target.value)}>
                <option value="">Tous les entrepots</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
              <button className="secondary" type="button" onClick={() => { setStockSearch(''); setStockFilterColumn('all'); setStockFilterWarehouseId(''); }}>
                Reinitialiser
              </button>
            </form>
          </Panel>
          <DataTable
            columns={['Produit', 'Entrepot', 'Stock', 'Reserve', 'Disponible', 'Seuil', 'Statut']}
            rows={filteredStockItems.map((item) => [productLabel(item.productId), warehouseLabel(item.warehouseId), item.quantityOnHand, item.quantityReserved, item.availableQuantity, item.isLowStock ? `Bas (${item.alertThreshold})` : item.alertThreshold, stockStatus(item)])}
            onRowClick={(index) => setSelectedStockId(filteredStockItems[index]?.id ?? null)}
            selectedRowIndex={selectedStock ? filteredStockItems.findIndex((item) => item.id === selectedStock.id) : undefined}
          />
        </section>
      )}
      {activeStockTab === 'movements' && (
        <section className="tab-page">
          <Panel title="Filtres mouvements">
            <form className="form-grid filter-grid" onSubmit={(event) => event.preventDefault()}>
              <input placeholder="Rechercher un produit, motif, date..." value={movementSearch} onChange={(event) => setMovementSearch(event.target.value)} />
              <select value={movementFilterColumn} onChange={(event) => setMovementFilterColumn(event.target.value)}>
                <option value="all">Toutes les colonnes</option>
                <option value="product">Produit</option>
                <option value="warehouse">Entrepot</option>
                <option value="type">Type</option>
                <option value="quantity">Quantite</option>
                <option value="reason">Motif</option>
                <option value="date">Date</option>
                <option value="author">Auteur</option>
              </select>
              <select value={movementFilterWarehouseId} onChange={(event) => setMovementFilterWarehouseId(event.target.value)}>
                <option value="">Tous les entrepots</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
              <select value={movementFilterType} onChange={(event) => setMovementFilterType(event.target.value)}>
                <option value="">Tous les types</option>
                {movementTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <button className="secondary" type="button" onClick={() => { setMovementSearch(''); setMovementFilterColumn('all'); setMovementFilterWarehouseId(''); setMovementFilterType(''); }}>
                Reinitialiser
              </button>
            </form>
          </Panel>
          <DataTable
            columns={['Produit', 'Entrepot', 'Type', 'Quantite', 'Motif', 'Date']}
            rows={filteredMovements.map((item) => [productLabel(item.productId), warehouseLabel(item.warehouseId), item.type, item.quantity, item.reason, item.createdAt])}
            onRowClick={(index) => setSelectedMovementId(filteredMovements[index]?.id ?? null)}
            selectedRowIndex={selectedMovement ? filteredMovements.findIndex((item) => item.id === selectedMovement.id) : undefined}
          />
        </section>
      )}
      {selectedStock && (
        <StockDetailsModal
          item={selectedStock}
          productLabel={productLabel(selectedStock.productId)}
          warehouseLabel={warehouseLabel(selectedStock.warehouseId)}
          warehouses={warehouses}
          prestashopConnection={activePrestashopConnection}
          activePrestashopConnections={activePrestashopConnections}
          incomingPurchaseOrders={purchaseOrdersForProduct(selectedStock.productId)}
          stockStatus={stockStatus(selectedStock)}
          onClose={() => setSelectedStockId(null)}
          onSaved={async () => {
            await onChanged();
            setSelectedStockId(null);
          }}
        />
      )}
      {selectedMovement && (
        <StockMovementDetailsModal
          movement={selectedMovement}
          productLabel={productLabel(selectedMovement.productId)}
          warehouseLabel={warehouseLabel(selectedMovement.warehouseId)}
          onClose={() => setSelectedMovementId(null)}
        />
      )}
    </>
  );
}

function StockDetailsModal({
  item,
  productLabel,
  warehouseLabel,
  warehouses,
  prestashopConnection,
  activePrestashopConnections,
  incomingPurchaseOrders,
  stockStatus,
  onClose,
  onSaved
}: {
  item: StockItem;
  productLabel: string;
  warehouseLabel: string;
  warehouses: Warehouse[];
  prestashopConnection?: PrestashopConnection;
  activePrestashopConnections: PrestashopConnection[];
  incomingPurchaseOrders: PurchaseOrder[];
  stockStatus: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [editMode, setEditMode] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(item.warehouseId);
  const [quantityOnHand, setQuantityOnHand] = useState(item.quantityOnHand.toString());
  const [alertThreshold, setAlertThreshold] = useState(item.alertThreshold.toString());
  const [warehouseInfoOpen, setWarehouseInfoOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const warehouseById = useMemo(() => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])), [warehouses]);
  const currentWarehouse = warehouseById.get(item.warehouseId);

  useEffect(() => {
    setSelectedWarehouseId(item.warehouseId);
    setQuantityOnHand(item.quantityOnHand.toString());
    setAlertThreshold(item.alertThreshold.toString());
    setEditMode(false);
    setWarehouseInfoOpen(false);
    setError(null);
  }, [item]);

  const prestashopStatus = prestashopConnection
    ? `Connexion active ${prestashopConnection.shopUrl}. Entrepot actuel du produit: ${warehouseLabel}`
    : activePrestashopConnections.length > 0
      ? "Aucune connexion PrestaShop active disponible pour publier le stock."
      : "Aucune connexion PrestaShop active.";

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const nextQuantity = Number(quantityOnHand);
      await api.updateStockItem(item.id, {
        warehouseId: selectedWarehouseId,
        quantityOnHand: Number(nextQuantity.toFixed(3)),
        alertThreshold: Number(alertThreshold)
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modification impossible.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal-panel stock-modal" role="dialog" aria-modal="true" aria-labelledby="stock-detail-title" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <p className="eyebrow">Stock</p>
            <h2 id="stock-detail-title">{productLabel}</h2>
          </div>
          <div className="modal-actions">
            {!editMode && (
              <button className="secondary" type="button" onClick={() => setEditMode(true)}>
                <Pencil size={16} />
                Modifier
              </button>
            )}
            <button className="modal-close" type="button" aria-label="Fermer" title="Fermer" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </header>

        {editMode ? (
          <form className="product-edit-form" onSubmit={save}>
            <div className="form-grid">
              <label className="field">
                <span>Produit</span>
                <input readOnly value={productLabel} />
              </label>
              <label className="field">
                <span>Entrepot</span>
                <select required value={selectedWarehouseId} onChange={(event) => setSelectedWarehouseId(event.target.value)}>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Stock reel</span>
                <input required type="number" step="0.001" value={quantityOnHand} onChange={(event) => setQuantityOnHand(event.target.value)} />
              </label>
              <label className="field">
                <span>Seuil alerte</span>
                <input required type="number" step="0.001" value={alertThreshold} onChange={(event) => setAlertThreshold(event.target.value)} />
              </label>
            </div>
            {error && <div className="error-message">{error}</div>}
            <div className="modal-footer">
              <button className="secondary" type="button" disabled={saving} onClick={() => setEditMode(false)}>
                Annuler
              </button>
              <button className="primary" type="submit" disabled={saving}>
                <Save size={16} />
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="detail-grid stock-detail-grid">
              <DetailItem label="Produit" value={productLabel} />
              <button className="detail-item detail-button" type="button" onClick={() => setWarehouseInfoOpen(true)}>
                <span>Entrepot</span>
                <strong>{warehouseLabel}</strong>
              </button>
              <DetailItem label="Stock reel" value={item.quantityOnHand} />
              <DetailItem label="Reserve" value={item.quantityReserved} />
              <DetailItem label="Disponible" value={item.availableQuantity} />
              <DetailItem label="Seuil alerte" value={item.isLowStock ? `Bas (${item.alertThreshold})` : item.alertThreshold} />
              <DetailItem label="Statut automatique" value={stockStatus} />
              <DetailItem label="PrestaShop" value={prestashopStatus} />
            </div>
            <section className="related-list">
              <h3>Commandes fournisseurs en cours</h3>
              {incomingPurchaseOrders.length === 0 ? (
                <p>Aucune commande fournisseur en cours pour ce produit.</p>
              ) : (
                incomingPurchaseOrders.map((order) => (
                  <article key={order.id} className="related-row">
                    <strong>{order.number}</strong>
                    <span>{order.supplierName ?? order.supplierId}</span>
                    <span>{purchaseStatusLabel(order.status)}</span>
                    <span>Reception prevue: {order.expectedAt || 'non renseignee'}</span>
                  </article>
                ))
              )}
            </section>
            <p className={prestashopConnection ? 'sync-note sync-note-ok' : 'sync-note sync-note-warning'}>
              {prestashopConnection
                ? "Si ce produit est lie a PrestaShop, l'enregistrement publiera la quantite et le nom de l'entrepot actuel dans le champ Emplacement du stock PrestaShop."
                : "Le stock ERP sera modifie, mais PrestaShop ne sera pas mis a jour sans connexion active."}
            </p>
            {warehouseInfoOpen && currentWarehouse && <WarehouseInfoBubble warehouse={currentWarehouse} onClose={() => setWarehouseInfoOpen(false)} />}
          </>
        )}
      </section>
    </div>
  );
}

function StockMovementDetailsModal({
  movement,
  productLabel,
  warehouseLabel,
  onClose
}: {
  movement: StockMovement;
  productLabel: string;
  warehouseLabel: string;
  onClose: () => void;
}) {
  const author = movement.createdByDisplayName || movement.createdByEmail || movement.createdByUserId || 'Systeme / inconnu';
  const createdAt = Number.isNaN(new Date(movement.createdAt).getTime())
    ? movement.createdAt
    : new Date(movement.createdAt).toLocaleString('fr-FR');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal-panel stock-modal" role="dialog" aria-modal="true" aria-labelledby="stock-movement-title" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <p className="eyebrow">Mouvement stock</p>
            <h2 id="stock-movement-title">{productLabel}</h2>
          </div>
          <button className="modal-close" type="button" aria-label="Fermer" title="Fermer" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="detail-grid stock-detail-grid">
          <DetailItem label="Produit" value={productLabel} />
          <DetailItem label="Entrepot" value={warehouseLabel} />
          <DetailItem label="Type" value={movement.type} />
          <DetailItem label="Quantite" value={movement.quantity} />
          <DetailItem label="Motif" value={movement.reason || '-'} />
          <DetailItem label="Date" value={createdAt} />
          <DetailItem label="Modifie par" value={author} />
          <DetailItem label="Email utilisateur" value={movement.createdByEmail || '-'} />
          <DetailItem label="Utilisateur interne" value={movement.createdByUserId || '-'} />
          <DetailItem label="Module source" value={movement.referenceModule || '-'} />
          <DetailItem label="Reference source" value={movement.referenceId || '-'} />
          <DetailItem label="Identifiant mouvement" value={movement.id} />
        </div>
      </section>
    </div>
  );
}

function WarehouseInfoBubble({ warehouse, onClose }: { warehouse: Warehouse; onClose: () => void }) {
  const address = formatWarehouseAddress(warehouse);

  return (
    <div className="popover-backdrop" onClick={onClose}>
      <aside className="warehouse-popover" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header compact">
          <div>
            <p className="eyebrow">Entrepot</p>
            <h3>{warehouse.name}</h3>
          </div>
          <button className="modal-close" type="button" aria-label="Fermer" title="Fermer" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="detail-grid">
          <DetailItem label="Representant" value={warehouse.representativeName || '-'} />
          <DetailItem label="Telephone" value={warehouse.phone || '-'} />
          <DetailItem label="Email" value={warehouse.email ? <a href={`mailto:${warehouse.email}`}>{warehouse.email}</a> : '-'} />
          <DetailItem label="Adresse" value={address || '-'} />
          {warehouse.notes && <DetailItem label="Notes" value={warehouse.notes} />}
        </div>
      </aside>
    </div>
  );
}

function looksLikeEmailHtml(value: string) {
  return /<\s*(html|body|table|div|p|span|br|img|style|meta|font|blockquote)\b/i.test(value);
}

function sanitizeEmailHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '');
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

function shortenUrl(value: string) {
  try {
    const url = new URL(value);
    const path = `${url.pathname}${url.search ? '?' : ''}`;
    return `${url.hostname}${path.length > 28 ? `${path.slice(0, 28)}...` : path}`;
  } catch {
    return value.length > 72 ? `${value.slice(0, 72)}...` : value;
  }
}

function linkifyPlainEmailSegment(value: string) {
  const urlPattern = /https?:\/\/[^\s<>"'\]]+/gi;
  let html = '';
  let lastIndex = 0;
  for (const match of value.matchAll(urlPattern)) {
    const rawUrl = match[0];
    const start = match.index ?? 0;
    const url = rawUrl.replace(/[),.;:!?]+$/g, '');
    const trailing = rawUrl.slice(url.length);
    html += escapeHtml(value.slice(lastIndex, start));
    html += `<a href="${escapeAttribute(url)}" title="${escapeAttribute(url)}">${escapeHtml(shortenUrl(url))}</a>${escapeHtml(trailing)}`;
    lastIndex = start + rawUrl.length;
  }

  html += escapeHtml(value.slice(lastIndex));
  return html
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

function plainEmailTextToHtml(value: string) {
  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) {
    return '<p class="empty">Aucun contenu.</p>';
  }

  const ctaPattern = /\[(https?:\/\/[^\]\s]+)\]\s*([^\[\n\r]{1,90})/gi;
  let html = '<div class="plain-mail"><p>';
  let lastIndex = 0;

  for (const match of normalized.matchAll(ctaPattern)) {
    const start = match.index ?? 0;
    const url = match[1];
    const label = match[2].trim().replace(/^[-:–\s]+/, '').replace(/[.:;]+$/, '') || 'Ouvrir le lien';
    html += linkifyPlainEmailSegment(normalized.slice(lastIndex, start));
    html += `</p><p><a class="mail-cta" href="${escapeAttribute(url)}" title="${escapeAttribute(url)}">${escapeHtml(label)}</a></p><p>`;
    lastIndex = start + match[0].length;
  }

  html += linkifyPlainEmailSegment(normalized.slice(lastIndex));
  return `${html}</p></div>`.replace(/<p>\s*<\/p>/g, '');
}

function normalizeInlineQuotedHistory(value: string) {
  return normalizeQuotedEmailText(value)
    .replace(/\s*(-{2,}\s*Message\s+(precedent|transfere)\s*-{2,})\s*/gi, '\n$1\n')
    .replace(/\s*(Le\s+\d{1,2}\/\d{1,2}\/\d{4}[\s\S]{0,180}?\s+a\s+(ecrit|\u00e9crit)\s*:)\s*/gi, '\n$1\n')
    .replace(/\s+>\s*/g, '\n> ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function quotedHistoryTextToHtml(value: string) {
  const normalized = normalizeInlineQuotedHistory(value);
  if (!normalized) {
    return '';
  }

  const lines = normalized.split('\n');
  if (lines[0] && /^-{2,}\s*Message\s+(precedent|transfere)\s*-{2,}$/i.test(lines[0].trim())) {
    lines.shift();
  }

  const headerLines: string[] = [];
  while (lines.length > 0 && !lines[0].trimStart().startsWith('>')) {
    const line = lines.shift()?.trim();
    if (line) {
      headerLines.push(line);
    }
  }

  const quoteText = lines
    .map((line) => line.replace(/^(\s*>+\s*)+/, ''))
    .join('\n')
    .trim();
  const headerHtml = headerLines.length > 0 ? `<div class="mail-history-header">${plainEmailTextToHtml(headerLines.join('\n'))}</div>` : '';
  const quoteHtml = quoteText ? plainEmailTextToHtml(quoteText) : '<p class="empty">Aucun contenu.</p>';

  return `${headerHtml}<blockquote class="mail-history">${quoteHtml}</blockquote>`;
}

function formatQuotedHistoryForDisplay(html: string) {
  const marker = html.match(/-{2,}\s*Message\s+(precedent|transfere)\s*-{2,}/i);
  if (!marker || marker.index === undefined) {
    return html;
  }

  const before = html.slice(0, marker.index).trimEnd();
  const history = html.slice(marker.index);
  if (/<blockquote\b/i.test(history)) {
    return html;
  }

  return `${before}${before ? '<br><br>' : ''}${quotedHistoryTextToHtml(htmlEmailToPlainText(history))}`;
}

function buildEmailFrameDocument(body: string) {
  const emailFrameHead = `<base target="_blank">
  <style>
    html, body { margin: 0; min-height: 100%; color: #111827; }
    body { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; line-height: 1.5; overflow-wrap: anywhere; }
    img { max-width: 100%; height: auto; }
    table { max-width: 100%; }
    pre { margin: 0; white-space: pre-wrap; font: inherit; }
    blockquote { margin: 12px 0; padding-left: 12px; border-left: 3px solid #cbd5e1; color: #475569; }
    .mail-history { background:#f8fafc; border-radius:8px; padding:12px 14px 12px 16px; }
    .mail-history-header { margin: 10px 0 6px; color: #64748b; font-size: 13px; }
    .mail-history-header .plain-mail { font-size: 13px; color: inherit; }
    .mail-history-header .plain-mail p { margin: 0 0 4px; }
    a { color: #0f766e; font-weight: 700; word-break: break-word; }
    .plain-mail { max-width: 860px; color: #172033; font-size: 15px; }
    .plain-mail p { margin: 0 0 14px; }
    .mail-cta { display: inline-flex; align-items: center; min-height: 38px; border-radius: 6px; background: #0f766e; color: #fff; padding: 0 14px; text-decoration: none; }
    .empty { color: #64748b; font-style: italic; }
  </style>`;
  const trimmedBody = body.trim();
  if (trimmedBody && looksLikeEmailHtml(trimmedBody)) {
    const sanitized = sanitizeEmailHtml(trimmedBody);
    const formattedSanitized = formatQuotedHistoryForDisplay(sanitized);
    if (/<html[\s>]/i.test(sanitized)) {
      if (/<head[\s>]/i.test(sanitized)) {
        return formattedSanitized.replace(/<head([^>]*)>/i, `<head$1><meta charset="utf-8">${emailFrameHead}`);
      }

      return formattedSanitized.replace(/<html([^>]*)>/i, `<html$1><head><meta charset="utf-8">${emailFrameHead}</head>`);
    }
  }

  const content = trimmedBody
    ? looksLikeEmailHtml(trimmedBody)
      ? formatQuotedHistoryForDisplay(sanitizeEmailHtml(trimmedBody))
      : plainEmailTextToHtml(trimmedBody)
    : '<p class="empty">Aucun contenu.</p>';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  ${emailFrameHead}
</head>
<body style="margin:0;padding:18px;background:#fff;">${content}</body>
</html>`;
}

function extractEmailAddresses(value: string) {
  return value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
}

function uniqueEmailAddresses(values: string[], excluded: Set<string>) {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (excluded.has(key) || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function normalizeQuotedEmailText(value: string) {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function htmlEmailToPlainText(value: string) {
  const prepared = sanitizeEmailHtml(value)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|section|article|tr|table|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<\/li>/gi, '');

  try {
    const document = new DOMParser().parseFromString(prepared, 'text/html');
    return normalizeQuotedEmailText(document.body.textContent ?? '');
  } catch {
    return normalizeQuotedEmailText(prepared.replace(/<[^>]+>/g, ''));
  }
}

function emailBodyToPlainText(value: string) {
  return looksLikeEmailHtml(value)
    ? htmlEmailToPlainText(value)
    : normalizeQuotedEmailText(value);
}

function stripExistingQuotedHistory(value: string) {
  const normalized = normalizeQuotedEmailText(value);
  const candidates = [
    normalized.search(/\n?\s*-{2,}\s*Message\s+(precedent|transfere)\s*-{2,}/i),
    normalized.search(/\n?\s*Le\s+\d{1,2}\/\d{1,2}\/\d{4}[\s\S]{0,240}?\s+a\s+(ecrit|\u00e9crit)\s*:/i),
    normalized.search(/\n?\s*On\s+[\s\S]{0,240}?\s+wrote\s*:/i)
  ].filter((index) => index >= 0);

  if (candidates.length === 0) {
    return normalized;
  }

  return normalized.slice(0, Math.min(...candidates)).trim();
}

function emailBodyToReplyQuoteText(value: string) {
  return stripExistingQuotedHistory(emailBodyToPlainText(value));
}

function quotePlainText(value: string) {
  const cleaned = normalizeQuotedEmailText(value);
  if (!cleaned) {
    return '> Aucun contenu.';
  }

  return cleaned
    .split('\n')
    .map((line) => (line.trim() ? `> ${line}` : '>'))
    .join('\n');
}

function buildQuotedEmailBody(message: EmailMessage, formattedDate: string) {
  return `\n\n--- Message precedent ---\nLe ${formattedDate}, ${message.from} a ecrit :\n${quotePlainText(emailBodyToReplyQuoteText(message.body))}`;
}

function buildForwardedEmailBody(message: EmailMessage, formattedDate: string) {
  const lines = [
    '',
    '',
    '---------- Message transfere ----------',
    `De : ${message.from}`,
    `Date : ${formattedDate}`,
    `Sujet : ${message.subject}`,
    `A : ${message.to}`,
    message.cc ? `Cc : ${message.cc}` : '',
    '',
    emailBodyToPlainText(message.body) || 'Aucun contenu.'
  ];

  return lines.join('\n');
}

function emailMessageTimestamp(message: EmailMessage) {
  const value = emailMessageDateValue(message);
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function emailMessageDateValue(message: EmailMessage) {
  return message.receivedAt ?? message.sentAt ?? message.createdAt;
}

function stripEmailSubjectPrefixes(subject: string) {
  let cleaned = subject.trim();
  for (let index = 0; index < 8; index += 1) {
    const next = cleaned.replace(/^(re|ré|fw|fwd|tr|transfert)\s*[:：-]\s*/i, '').trim();
    if (next === cleaned) {
      break;
    }

    cleaned = next;
  }

  return cleaned || '(Sans sujet)';
}

function normalizeEmailThreadSubject(subject: string) {
  return stripEmailSubjectPrefixes(subject)
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('fr-FR');
}

type CustomerEmailSuggestion = {
  key: string;
  email: string;
  label: string;
  meta: string;
  searchText: string;
};

function buildCustomerEmailSuggestions(customers: Customer[]) {
  const seen = new Set<string>();
  const suggestions: CustomerEmailSuggestion[] = [];

  for (const customer of customers.filter((item) => item.isActive)) {
    const contacts = [...(customer.contacts ?? [])].sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary));
    for (const contact of contacts) {
      const email = contact.email?.trim();
      if (!email) {
        continue;
      }

      const normalizedEmail = email.toLowerCase();
      if (seen.has(normalizedEmail)) {
        continue;
      }

      seen.add(normalizedEmail);
      const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
      const label = contactName ? `${contactName} - ${customer.companyName}` : customer.companyName;
      const meta = [customer.code, contact.jobTitle, contact.isPrimary ? 'Contact principal' : 'Contact'].filter(Boolean).join(' / ');
      suggestions.push({
        key: `${customer.id}:${contact.id}`,
        email,
        label,
        meta,
        searchText: `${customer.code} ${customer.companyName} ${contactName} ${contact.jobTitle ?? ''} ${email}`.toLowerCase()
      });
    }

    const generalEmail = customer.email?.trim();
    if (generalEmail && !seen.has(generalEmail.toLowerCase())) {
      seen.add(generalEmail.toLowerCase());
      suggestions.push({
        key: `${customer.id}:general`,
        email: generalEmail,
        label: `${customer.companyName} - email general`,
        meta: [customer.code, customer.phone].filter(Boolean).join(' / '),
        searchText: `${customer.code} ${customer.companyName} ${customer.tradeName ?? ''} ${generalEmail}`.toLowerCase()
      });
    }
  }

  return suggestions;
}

function activeRecipientTerm(value: string) {
  return value.replace(/;/g, ',').split(',').pop()?.trim().toLowerCase() ?? '';
}

function recipientTokensBeforeActive(value: string) {
  const parts = value.replace(/;/g, ',').split(',');
  return parts.slice(0, -1).map((part) => part.trim().toLowerCase()).filter(Boolean);
}

function replaceActiveRecipient(value: string, email: string) {
  const parts = value.replace(/;/g, ',').split(',');
  parts[parts.length - 1] = email;
  return parts.map((part) => part.trim()).filter(Boolean).join(', ');
}

type EmailThread = {
  key: string;
  subject: string;
  latest: EmailMessage;
  messages: EmailMessage[];
  unreadCount: number;
  hasAttachments: boolean;
};

function emailSendFeedback(message: EmailMessage) {
  if (message.status === 'Sent') {
    return 'Email envoye par SMTP.';
  }

  if (message.status === 'Logged') {
    return message.errorMessage ?? "Email journalise dans l'ERP, mais non envoye: EMAIL_ENABLE_SMTP_SENDING=false sur le serveur.";
  }

  if (message.status === 'Failed') {
    return message.errorMessage ?? "Envoi SMTP echoue.";
  }

  return `Email traite avec le statut ${message.status}.`;
}

function Emails({ accounts, messages, templates, customers, onChanged }: { accounts: MailAccount[]; messages: EmailMessage[]; templates: EmailTemplate[]; customers: Customer[]; onChanged: () => Promise<void> }) {
  const [tab, setTab] = useState<'accounts' | 'compose' | 'messages' | 'templates'>('messages');
  const [editingAccountId, setEditingAccountId] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('993');
  const [useSsl, setUseSsl] = useState(true);
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordSecretName, setPasswordSecretName] = useState('');
  const [clearPassword, setClearPassword] = useState(false);
  const [accountActive, setAccountActive] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [recipientSuggestionsOpen, setRecipientSuggestionsOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedMessageDetail, setSelectedMessageDetail] = useState<EmailMessage | null>(null);
  const [selectedThreadKey, setSelectedThreadKey] = useState<string | null>(null);
  const [selectedThreadKeys, setSelectedThreadKeys] = useState<Set<string>>(() => new Set());
  const [messageSearch, setMessageSearch] = useState('');
  const [messageAccountFilter, setMessageAccountFilter] = useState('');
  const [syncingMessages, setSyncingMessages] = useState(false);
  const [autoRefreshingMessages, setAutoRefreshingMessages] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const [templateActive, setTemplateActive] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const onChangedRef = useRef(onChanged);
  const messageAccountFilterRef = useRef(messageAccountFilter);
  const emailSyncInProgressRef = useRef(false);

  const selectedMessage = selectedMessageDetail ?? (selectedMessageId ? messages.find((message) => message.id === selectedMessageId) : undefined);
  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const activeAccounts = accounts.filter((account) => account.isActive);
  const customerEmailSuggestions = useMemo(() => buildCustomerEmailSuggestions(customers), [customers]);
  const recipientSuggestions = useMemo(() => {
    const term = activeRecipientTerm(to);
    const alreadySelected = new Set(recipientTokensBeforeActive(to));

    return customerEmailSuggestions
      .filter((suggestion) => !alreadySelected.has(suggestion.email.toLowerCase()))
      .filter((suggestion) => !term || suggestion.searchText.includes(term))
      .slice(0, 8);
  }, [customerEmailSuggestions, to]);
  const feedbackIsError = Boolean(feedback && (feedback.includes('impossible') || feedback.includes('echoue') || feedback.includes('non envoye') || feedback.includes('desactive')));
  const visibleMessages = useMemo(() => {
    const term = messageSearch.trim().toLowerCase();
    return messages.filter((message) => {
      if (messageAccountFilter && message.mailAccountId !== messageAccountFilter) {
        return false;
      }

      if (!term) {
        return true;
      }

      return [message.subject, message.from, message.to, message.cc, message.bcc, message.body, message.status]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(term));
    }).sort((left, right) => emailMessageTimestamp(right) - emailMessageTimestamp(left));
  }, [messages, messageAccountFilter, messageSearch]);
  const visibleThreads = useMemo<EmailThread[]>(() => {
    const threads = new Map<string, EmailThread>();
    for (const message of visibleMessages) {
      const key = `${message.mailAccountId ?? 'none'}:${normalizeEmailThreadSubject(message.subject)}`;
      const thread = threads.get(key);
      if (thread) {
        thread.messages.push(message);
        thread.unreadCount += message.isRead ? 0 : 1;
        thread.hasAttachments = thread.hasAttachments || message.attachments.length > 0;
        if (emailMessageTimestamp(message) > emailMessageTimestamp(thread.latest)) {
          thread.latest = message;
        }
        continue;
      }

      threads.set(key, {
        key,
        subject: stripEmailSubjectPrefixes(message.subject),
        latest: message,
        messages: [message],
        unreadCount: message.isRead ? 0 : 1,
        hasAttachments: message.attachments.length > 0
      });
    }

    return Array.from(threads.values())
      .map((thread) => ({
        ...thread,
        messages: [...thread.messages].sort((left, right) => emailMessageTimestamp(right) - emailMessageTimestamp(left))
      }))
      .sort((left, right) => emailMessageTimestamp(right.latest) - emailMessageTimestamp(left.latest));
  }, [visibleMessages]);
  const selectedThread = selectedThreadKey ? visibleThreads.find((thread) => thread.key === selectedThreadKey) : undefined;
  const selectedBulkThreads = useMemo(() => visibleThreads.filter((thread) => selectedThreadKeys.has(thread.key)), [selectedThreadKeys, visibleThreads]);
  const selectedBulkMessages = useMemo(() => selectedBulkThreads.flatMap((thread) => thread.messages), [selectedBulkThreads]);
  const allVisibleThreadsSelected = visibleThreads.length > 0 && visibleThreads.every((thread) => selectedThreadKeys.has(thread.key));

  useEffect(() => {
    setSelectedThreadKeys((current) => {
      const visibleKeys = new Set(visibleThreads.map((thread) => thread.key));
      const next = new Set([...current].filter((key) => visibleKeys.has(key)));
      return next.size === current.size ? current : next;
    });
  }, [visibleThreads]);

  useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);

  useEffect(() => {
    messageAccountFilterRef.current = messageAccountFilter;
  }, [messageAccountFilter]);

  useEffect(() => {
    if (tab !== 'messages' || activeAccounts.length === 0) {
      return undefined;
    }

    let cancelled = false;
    let timeoutId: number | undefined;

    const scheduleNextRefresh = () => {
      timeoutId = window.setTimeout(() => {
        if (cancelled) {
          return;
        }

        if (document.visibilityState !== 'visible') {
          scheduleNextRefresh();
          return;
        }

        void syncMessagesFromImap(false).finally(() => {
          if (!cancelled) {
            scheduleNextRefresh();
          }
        });
      }, EMAIL_JOURNAL_AUTO_REFRESH_MS);
    };

    scheduleNextRefresh();
    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [activeAccounts.length, tab]);

  function resetAccountForm() {
    setEditingAccountId('');
    setEmail('');
    setDisplayName('');
    setSmtpHost('');
    setSmtpPort('587');
    setImapHost('');
    setImapPort('993');
    setUseSsl(true);
    setUserName('');
    setPassword('');
    setPasswordSecretName('');
    setClearPassword(false);
    setAccountActive(true);
  }

  function startEditAccount(account: MailAccount) {
    setEditingAccountId(account.id);
    setEmail(account.email);
    setDisplayName(account.displayName ?? '');
    setSmtpHost(account.smtpHost);
    setSmtpPort(String(account.smtpPort));
    setImapHost(account.imapHost);
    setImapPort(String(account.imapPort));
    setUseSsl(account.useSsl);
    setUserName(account.userName ?? account.email);
    setPassword('');
    setPasswordSecretName(account.passwordSecretName === 'DATABASE_PROTECTED' ? '' : account.passwordSecretName ?? '');
    setClearPassword(false);
    setAccountActive(account.isActive);
    setTab('accounts');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      email,
      displayName,
      smtpHost,
      smtpPort: Number(smtpPort),
      imapHost,
      imapPort: Number(imapPort),
      useSsl,
      userName,
      password,
      passwordSecretName,
      clearPassword,
      isActive: accountActive
    };

    if (editingAccountId) {
      await api.updateMailAccount(editingAccountId, payload);
      setFeedback('Compte mail mis a jour.');
    } else {
      await api.createMailAccount(payload);
      setFeedback('Compte mail cree.');
    }

    resetAccountForm();
    await onChanged();
  }

  async function testAccount(account: MailAccount) {
    try {
      await api.testMailAccount(account.id);
      setFeedback('Test SMTP OK: connexion et authentification reussies.');
      await onChanged();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Test SMTP impossible.');
    }
  }

  async function syncAccount(account: MailAccount) {
    const result = await api.syncMailAccount(account.id);
    setFeedback(`${result.imported} email(s) importe(s) depuis IMAP.`);
    await onChanged();
  }

  async function deleteAccount(account: MailAccount) {
    if (!window.confirm(`Supprimer le compte ${account.email} ?`)) {
      return;
    }

    await api.deleteMailAccount(account.id);
    setFeedback('Compte mail supprime.');
    await onChanged();
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const mailAccountId = selectedAccountId || activeAccounts[0]?.id;
    if (!mailAccountId) {
      throw new Error('Creer un compte mail avant envoyer un email.');
    }

    try {
      const sentMessage = await api.sendEmail({ mailAccountId, to, cc: cc || null, bcc: bcc || null, subject, body });
      setFeedback(emailSendFeedback(sentMessage));
      if (sentMessage.status === 'Sent') {
        setTo('');
        setCc('');
        setBcc('');
        setSubject('');
        setBody('');
      }

      await onChanged();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Envoi SMTP impossible.');
    }
  }

  function applyTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    setSubject(template.subject);
    setBody(template.body);
  }

  function selectCustomerRecipient(email: string) {
    setTo((current) => replaceActiveRecipient(current, email));
    setRecipientSuggestionsOpen(false);
  }

  function resetTemplateForm() {
    setEditingTemplateId('');
    setTemplateName('');
    setTemplateSubject('');
    setTemplateBody('');
    setTemplateActive(true);
  }

  function startEditTemplate(template: EmailTemplate) {
    setEditingTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateSubject(template.subject);
    setTemplateBody(template.body);
    setTemplateActive(template.isActive);
  }

  async function saveTemplate(event: FormEvent) {
    event.preventDefault();
    const payload = { name: templateName, subject: templateSubject, body: templateBody, isActive: templateActive };
    if (editingTemplateId) {
      await api.updateEmailTemplate(editingTemplateId, payload);
    } else {
      await api.createEmailTemplate(payload);
    }

    resetTemplateForm();
    setFeedback('Modele email enregistre.');
    await onChanged();
  }

  async function deleteTemplate(template: EmailTemplate) {
    if (!window.confirm(`Supprimer le modele ${template.name} ?`)) {
      return;
    }

    await api.deleteEmailTemplate(template.id);
    setFeedback('Modele email supprime.');
    await onChanged();
  }

  async function markSelectedMessage(isRead: boolean) {
    if (!selectedMessage) {
      return;
    }

    const updated = await api.markEmailRead(selectedMessage.id, isRead);
    setSelectedMessageDetail(updated);
    setFeedback(isRead ? 'Email marque comme lu.' : 'Email marque comme non lu.');
    await onChanged();
  }

  async function deleteSelectedMessage() {
    if (!selectedMessage) {
      return;
    }

    if (!window.confirm(`Supprimer le mail "${selectedMessage.subject}" ?`)) {
      return;
    }

    try {
      await api.deleteEmailMessage(selectedMessage.id);
      closeMessage();
      setFeedback("Email supprime. Il ne sera pas reimporte lors des prochaines synchronisations IMAP.");
      await onChanged();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Suppression du mail impossible.');
    }
  }

  async function openMessage(messageId?: string, threadKey?: string) {
    if (!messageId) {
      return;
    }

    setSelectedMessageId(messageId);
    setSelectedThreadKey(threadKey ?? null);
    setSelectedMessageDetail(messages.find((message) => message.id === messageId) ?? null);
    try {
      setSelectedMessageDetail(await api.emailMessage(messageId));
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Chargement du mail impossible.');
    }
  }

  function closeMessage() {
    setSelectedMessageId(null);
    setSelectedMessageDetail(null);
    setSelectedThreadKey(null);
  }

  function openThread(thread: EmailThread) {
    void openMessage(thread.latest.id, thread.key);
  }

  function toggleThreadSelection(threadKey: string, checked: boolean) {
    setSelectedThreadKeys((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(threadKey);
      } else {
        next.delete(threadKey);
      }

      return next;
    });
  }

  function toggleAllVisibleThreads() {
    setSelectedThreadKeys((current) => {
      if (allVisibleThreadsSelected) {
        return new Set<string>();
      }

      const next = new Set(current);
      for (const thread of visibleThreads) {
        next.add(thread.key);
      }

      return next;
    });
  }

  async function markBulkMessagesRead() {
    const unreadMessages = selectedBulkMessages.filter((message) => !message.isRead);
    if (unreadMessages.length === 0) {
      setFeedback('Aucun mail non lu dans la selection.');
      return;
    }

    try {
      await Promise.all(unreadMessages.map((message) => api.markEmailRead(message.id, true)));
      setSelectedThreadKeys(new Set<string>());
      setFeedback(`${unreadMessages.length} mail(s) marque(s) comme lu(s).`);
      await onChanged();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Marquage des mails impossible.');
    }
  }

  async function deleteBulkMessages() {
    if (selectedBulkMessages.length === 0) {
      return;
    }

    if (!window.confirm(`Supprimer ${selectedBulkMessages.length} mail(s) ? Ils ne seront pas reimportes par IMAP.`)) {
      return;
    }

    const deletedIds = new Set(selectedBulkMessages.map((message) => message.id));
    try {
      await Promise.all(selectedBulkMessages.map((message) => api.deleteEmailMessage(message.id)));
      if (selectedMessage && deletedIds.has(selectedMessage.id)) {
        closeMessage();
      }

      setSelectedThreadKeys(new Set<string>());
      setFeedback(`${selectedBulkMessages.length} mail(s) supprime(s). Ils ne seront pas reimportes lors des prochaines synchronisations IMAP.`);
      await onChanged();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Suppression des mails impossible.');
    }
  }

  function startReply(mode: 'single' | 'all') {
    if (!selectedMessage) {
      return;
    }

    const selectedAccount = selectedMessage.mailAccountId ? accountById.get(selectedMessage.mailAccountId) : undefined;
    const ownEmails = new Set(accounts.map((account) => account.email.toLowerCase()));
    const fromAddresses = extractEmailAddresses(selectedMessage.from);
    const toAddresses = extractEmailAddresses(selectedMessage.to);
    const ccAddresses = extractEmailAddresses(selectedMessage.cc ?? '');
    const toBaseRecipients = selectedMessage.direction === 'Outgoing' ? toAddresses : fromAddresses;
    const ccBaseRecipients = mode === 'all'
      ? selectedMessage.direction === 'Outgoing'
        ? ccAddresses
        : [...toAddresses, ...ccAddresses]
      : [];
    const recipients = uniqueEmailAddresses(toBaseRecipients, ownEmails);
    const ccRecipients = mode === 'all'
      ? uniqueEmailAddresses(ccBaseRecipients, new Set([...ownEmails, ...recipients.map((value) => value.toLowerCase())]))
      : [];

    setSelectedAccountId(selectedAccount?.id ?? activeAccounts[0]?.id ?? '');
    setTo((recipients.length > 0 ? recipients : uniqueEmailAddresses(toAddresses, new Set())).join(', '));
    setCc(ccRecipients.join(', '));
    setBcc('');
    setSubject(selectedMessage.subject.trim().toLowerCase().startsWith('re:') ? selectedMessage.subject : `Re: ${selectedMessage.subject}`);
    setBody(buildQuotedEmailBody(selectedMessage, formatEmailDate(emailMessageDateValue(selectedMessage))));
    closeMessage();
    setTab('compose');
  }

  function startForward() {
    if (!selectedMessage) {
      return;
    }

    const selectedAccount = selectedMessage.mailAccountId ? accountById.get(selectedMessage.mailAccountId) : undefined;
    const subjectPrefixPattern = /^(fw|fwd|tr|transfert)\s*[:-]\s*/i;

    setSelectedAccountId(selectedAccount?.id ?? activeAccounts[0]?.id ?? '');
    setTo('');
    setCc('');
    setBcc('');
    setSubject(subjectPrefixPattern.test(selectedMessage.subject.trim()) ? selectedMessage.subject : `Tr: ${selectedMessage.subject}`);
    setBody(buildForwardedEmailBody(selectedMessage, formatEmailDate(emailMessageDateValue(selectedMessage))));
    closeMessage();
    setTab('compose');
  }

  function formatEmailDate(value?: string) {
    return value ? new Date(value).toLocaleString('fr-FR') : '-';
  }

  function summarizeSyncResult(result: EmailSyncSummary) {
    if (result.accounts.some((account) => account.error)) {
      const failures = result.accounts.filter((account) => account.error).map((account) => `${account.email}: ${account.error}`).join(' | ');
      return `Synchronisation terminee avec erreurs. ${result.imported} email(s) importe(s). ${failures}`;
    }

    return `${result.imported} email(s) importe(s) depuis IMAP.`;
  }

  async function syncMessagesFromImap(showFeedback: boolean) {
    if (emailSyncInProgressRef.current) {
      return;
    }

    emailSyncInProgressRef.current = true;
    if (showFeedback) {
      setFeedback(null);
      setSyncingMessages(true);
    } else {
      setAutoRefreshingMessages(true);
    }

    try {
      const accountFilter = messageAccountFilterRef.current;
      let imported = 0;
      let nextFeedback = '';

      if (accountFilter) {
        const result = await api.syncMailAccount(accountFilter);
        imported = result.imported;
        nextFeedback = `${result.imported} email(s) importe(s) depuis IMAP.`;
      } else {
        const result = await api.syncMailAccounts();
        imported = result.imported;
        nextFeedback = summarizeSyncResult(result);
      }

      if (showFeedback || imported > 0) {
        setFeedback(nextFeedback);
      }

      await onChangedRef.current();
    } catch (err) {
      if (showFeedback) {
        setFeedback(err instanceof Error ? err.message : 'Synchronisation IMAP impossible.');
      } else {
        console.warn('Automatic IMAP refresh failed.', err);
      }
    } finally {
      if (showFeedback) {
        setSyncingMessages(false);
      } else {
        setAutoRefreshingMessages(false);
      }

      emailSyncInProgressRef.current = false;
    }
  }

  async function refreshMessagesFromImap() {
    await syncMessagesFromImap(true);
  }

  return (
    <>
      {feedback && <div className={feedbackIsError ? 'alert' : 'sync-note'}>{feedback}</div>}
      <div className="browser-tabs">
        <button className={tab === 'messages' ? 'active' : ''} type="button" onClick={() => setTab('messages')}>
          Journal
        </button>
        <button className={tab === 'compose' ? 'active' : ''} type="button" onClick={() => setTab('compose')}>
          Nouveau mail
        </button>
        <button className={tab === 'templates' ? 'active' : ''} type="button" onClick={() => setTab('templates')}>
          Modeles
        </button>
      </div>

      {false && tab === 'accounts' && (
        <div className="tab-page">
          <Panel title={editingAccountId ? 'Modifier compte mail' : 'Compte mail'}>
            <form className="email-account-form" onSubmit={submit}>
              <label className="field">
                <span>Email</span>
                <input required type="email" placeholder="contact@entreprise.fr" value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label className="field">
                <span>Nom affiche</span>
                <input placeholder="OceanERP" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              </label>
              <label className="field">
                <span>Utilisateur</span>
                <input placeholder="Souvent identique a l'email" value={userName} onChange={(event) => setUserName(event.target.value)} />
              </label>
              <label className="field">
                <span>SMTP</span>
                <input required placeholder="smtp.exemple.fr" value={smtpHost} onChange={(event) => setSmtpHost(event.target.value)} />
              </label>
              <label className="field">
                <span>Port SMTP</span>
                <input required type="number" min="1" max="65535" value={smtpPort} onChange={(event) => setSmtpPort(event.target.value)} />
              </label>
              <label className="field">
                <span>IMAP</span>
                <input required placeholder="imap.exemple.fr" value={imapHost} onChange={(event) => setImapHost(event.target.value)} />
              </label>
              <label className="field">
                <span>Port IMAP</span>
                <input required type="number" min="1" max="65535" value={imapPort} onChange={(event) => setImapPort(event.target.value)} />
              </label>
              <label className="field">
                <span>Mot de passe</span>
                <input type="password" placeholder={editingAccountId ? 'Laisser vide pour conserver' : 'Mot de passe SMTP/IMAP'} value={password} onChange={(event) => setPassword(event.target.value)} />
              </label>
              <label className="field">
                <span>Secret env optionnel</span>
                <input placeholder="EMAIL_SMTP_PASSWORD" value={passwordSecretName} onChange={(event) => setPasswordSecretName(event.target.value)} />
              </label>
              <label className="check-field">
                <input type="checkbox" checked={useSsl} onChange={(event) => setUseSsl(event.target.checked)} />
                TLS/SSL actif
              </label>
              <label className="check-field">
                <input type="checkbox" checked={accountActive} onChange={(event) => setAccountActive(event.target.checked)} />
                Compte actif
              </label>
              {editingAccountId && (
                <label className="check-field">
                  <input type="checkbox" checked={clearPassword} onChange={(event) => setClearPassword(event.target.checked)} />
                  Effacer le mot de passe stocke
                </label>
              )}
              <div className="form-actions">
                {editingAccountId && (
                  <button className="secondary" type="button" onClick={resetAccountForm}>
                    Annuler
                  </button>
                )}
                <button className="primary" type="submit">
                  <Save size={16} />
                  Enregistrer
                </button>
              </div>
            </form>
          </Panel>
          <DataTable
            columns={['Compte', 'SMTP', 'IMAP', 'Mot de passe', 'Statut', 'Actions']}
            rows={accounts.map((account) => [
              account.displayName ? `${account.displayName} <${account.email}>` : account.email,
              `${account.smtpHost}:${account.smtpPort}`,
              `${account.imapHost}:${account.imapPort}`,
              account.hasPassword ? 'Configure' : 'Manquant',
              account.isActive ? 'Actif' : 'Inactif',
              <div className="table-actions" key={account.id}>
                <button className="secondary icon-button" title="Modifier" type="button" onClick={() => startEditAccount(account)}>
                  <Pencil size={16} />
                </button>
                <button className="secondary" type="button" onClick={() => testAccount(account)}>
                  Test SMTP
                </button>
                <button className="secondary" type="button" onClick={() => syncAccount(account)}>
                  Sync IMAP
                </button>
                <button className="danger icon-button" title="Supprimer" type="button" onClick={() => deleteAccount(account)}>
                  <Trash2 size={16} />
                </button>
              </div>
            ])}
          />
        </div>
      )}

      {tab === 'compose' && (
        <Panel title="Envoyer un email">
          <form className="email-compose-form" onSubmit={send}>
            <div className="form-grid">
              <label className="field">
                <span>Compte expediteur</span>
                <select required value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)}>
                  <option value="">Compte</option>
                  {activeAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.email}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Modele</span>
                <select defaultValue="" onChange={(event) => applyTemplate(event.target.value)}>
                  <option value="">Aucun modele</option>
                  {templates.filter((template) => template.isActive).map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="field recipient-autocomplete">
                <span>Destinataire</span>
                <input
                  required
                  multiple
                  type="email"
                  placeholder="Nom client ou email"
                  value={to}
                  autoComplete="off"
                  onBlur={() => window.setTimeout(() => setRecipientSuggestionsOpen(false), 120)}
                  onChange={(event) => {
                    setTo(event.target.value);
                    setRecipientSuggestionsOpen(true);
                  }}
                  onFocus={() => setRecipientSuggestionsOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setRecipientSuggestionsOpen(false);
                    }
                  }}
                />
                {recipientSuggestionsOpen && recipientSuggestions.length > 0 && (
                  <div className="recipient-suggestions" role="listbox" aria-label="Suggestions clients">
                    {recipientSuggestions.map((suggestion) => (
                      <button key={suggestion.key} type="button" role="option" onMouseDown={(event) => { event.preventDefault(); selectCustomerRecipient(suggestion.email); }}>
                        <span className="recipient-suggestion-label">{suggestion.label}</span>
                        <span className="recipient-suggestion-email">{suggestion.email}</span>
                        <span className="recipient-suggestion-meta">{suggestion.meta}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <label className="field">
                <span>Cc</span>
                <input multiple type="email" placeholder="copie@example.com" value={cc} onChange={(event) => setCc(event.target.value)} />
              </label>
              <label className="field">
                <span>Cci</span>
                <input multiple type="email" placeholder="copie-cachee@example.com" value={bcc} onChange={(event) => setBcc(event.target.value)} />
              </label>
              <label className="field">
                <span>Sujet</span>
                <input required placeholder="Sujet" value={subject} onChange={(event) => setSubject(event.target.value)} />
              </label>
            </div>
            <label className="field full-field">
              <span>Message</span>
              <textarea required className="mail-body-input" placeholder="Message" value={body} onChange={(event) => setBody(event.target.value)} />
            </label>
            <div className="modal-footer">
              <button className="primary" type="submit" disabled={activeAccounts.length === 0}>
                <Mail size={16} />
                Envoyer
              </button>
            </div>
          </form>
        </Panel>
      )}

      {tab === 'messages' && (
        <>
          <Panel title="Filtres emails">
            <div className="form-grid filter-grid">
              <label className="field">
                <span>Recherche</span>
                <input placeholder="Sujet, expediteur, destinataire, contenu..." value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} />
              </label>
              <label className="field">
                <span>Compte</span>
                <select value={messageAccountFilter} onChange={(event) => setMessageAccountFilter(event.target.value)}>
                  <option value="">Tous les comptes</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.email}
                    </option>
                  ))}
                </select>
              </label>
              <button className="secondary" type="button" onClick={() => { setMessageSearch(''); setMessageAccountFilter(''); }}>
                Reinitialiser
              </button>
              <button className="primary" type="button" disabled={syncingMessages || autoRefreshingMessages} onClick={() => void refreshMessagesFromImap()}>
                <Mail size={16} />
                {syncingMessages ? 'Synchronisation...' : autoRefreshingMessages ? 'Actualisation auto...' : 'Actualiser'}
              </button>
            </div>
          </Panel>
          <div className="email-bulk-actions">
            <div>
              <strong>{selectedBulkMessages.length}</strong> mail(s) selectionne(s)
              {selectedThreadKeys.size > 0 && <span> dans {selectedThreadKeys.size} conversation(s)</span>}
            </div>
            <div className="table-actions">
              <button className="secondary" type="button" disabled={visibleThreads.length === 0} onClick={toggleAllVisibleThreads}>
                {allVisibleThreadsSelected ? 'Tout deselectionner' : 'Tout selectionner'}
              </button>
              <button className="secondary" type="button" disabled={selectedBulkMessages.length === 0} onClick={() => void markBulkMessagesRead()}>
                Marquer lu
              </button>
              <button className="danger" type="button" disabled={selectedBulkMessages.length === 0} onClick={() => void deleteBulkMessages()}>
                <Trash2 size={16} />
                Supprimer
              </button>
            </div>
          </div>
          <DataTable
            columns={['Selection', 'Sujet', 'De', 'A', 'Sens', 'Statut', 'Lu', 'Date']}
            rows={visibleThreads.map((thread) => [
              <input
                key={thread.key}
                aria-label={`Selectionner ${thread.subject}`}
                checked={selectedThreadKeys.has(thread.key)}
                type="checkbox"
                onChange={(event) => toggleThreadSelection(thread.key, event.target.checked)}
                onClick={(event) => event.stopPropagation()}
              />,
              <span className="email-subject-cell">
                {thread.hasAttachments && (
                  <span className="email-attachment-marker" title="Piece jointe">
                    <Paperclip aria-label="Piece jointe" size={15} />
                  </span>
                )}
                <span>{thread.unreadCount > 0 ? `[Non lu] ${thread.subject}` : thread.subject}</span>
                {thread.messages.length > 1 && <span className="email-thread-badge">{thread.messages.length}</span>}
              </span>,
              thread.latest.from,
              thread.latest.to,
              thread.messages.length > 1 ? 'Conversation' : thread.latest.direction === 'Incoming' ? 'Recu' : 'Envoye',
              thread.latest.status,
              thread.unreadCount > 0 ? `${thread.unreadCount} non lu(s)` : 'Oui',
              formatEmailDate(emailMessageDateValue(thread.latest))
            ])}
            onRowClick={(index) => {
              const thread = visibleThreads[index];
              if (thread) {
                openThread(thread);
              }
            }}
          />
        </>
      )}

      {tab === 'templates' && (
        <div className="tab-page">
          <Panel title={editingTemplateId ? 'Modifier modele' : 'Modele email'}>
            <form className="email-template-form" onSubmit={saveTemplate}>
              <div className="form-grid">
                <label className="field">
                  <span>Nom</span>
                  <input required value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
                </label>
                <label className="field">
                  <span>Sujet</span>
                  <input required value={templateSubject} onChange={(event) => setTemplateSubject(event.target.value)} />
                </label>
                <label className="check-field">
                  <input type="checkbox" checked={templateActive} onChange={(event) => setTemplateActive(event.target.checked)} />
                  Actif
                </label>
              </div>
              <label className="field full-field">
                <span>Corps</span>
                <textarea required className="mail-body-input" value={templateBody} onChange={(event) => setTemplateBody(event.target.value)} />
              </label>
              <div className="modal-footer">
                {editingTemplateId && (
                  <button className="secondary" type="button" onClick={resetTemplateForm}>
                    Annuler
                  </button>
                )}
                <button className="primary" type="submit">
                  <Save size={16} />
                  Enregistrer
                </button>
              </div>
            </form>
          </Panel>
          <DataTable
            columns={['Nom', 'Sujet', 'Statut', 'Actions']}
            rows={templates.map((template) => [
              template.name,
              template.subject,
              template.isActive ? 'Actif' : 'Inactif',
              <div className="table-actions" key={template.id}>
                <button className="secondary icon-button" type="button" title="Modifier" onClick={() => startEditTemplate(template)}>
                  <Pencil size={16} />
                </button>
                <button className="danger icon-button" type="button" title="Supprimer" onClick={() => deleteTemplate(template)}>
                  <Trash2 size={16} />
                </button>
              </div>
            ])}
          />
        </div>
      )}

      {selectedMessage && (
        <div className="modal-backdrop" onClick={closeMessage}>
          <aside className="modal-panel email-modal" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <div>
                <p className="eyebrow">Email</p>
                <h2>{selectedMessage.subject}</h2>
              </div>
              <button className="modal-close" type="button" aria-label="Fermer" title="Fermer" onClick={closeMessage}>
                <X size={18} />
              </button>
            </header>
            <div className="detail-grid">
              <DetailItem label="Compte" value={selectedMessage.mailAccountId ? accountById.get(selectedMessage.mailAccountId)?.email ?? selectedMessage.mailAccountId : '-'} />
              <DetailItem label="De" value={selectedMessage.from} />
              <DetailItem label="A" value={selectedMessage.to} />
              {selectedMessage.cc && <DetailItem label="Cc" value={selectedMessage.cc} />}
              {selectedMessage.bcc && <DetailItem label="Cci" value={selectedMessage.bcc} />}
              <DetailItem label="Statut" value={selectedMessage.status} />
              <DetailItem label="Lecture" value={selectedMessage.isRead ? 'Lu' : 'Non lu'} />
              <DetailItem label="Date" value={formatEmailDate(emailMessageDateValue(selectedMessage))} />
              {selectedMessage.errorMessage && <DetailItem label="Erreur" value={selectedMessage.errorMessage} />}
            </div>
            {selectedThread && selectedThread.messages.length > 1 && (
              <section className="email-thread-list">
                <h3>Conversation ({selectedThread.messages.length})</h3>
                <div className="email-thread-stack">
                  {selectedThread.messages.map((message) => (
                    <button
                      key={message.id}
                      className={`email-thread-item${message.id === selectedMessage.id ? ' active' : ''}`}
                      type="button"
                      onClick={() => void openMessage(message.id, selectedThread.key)}
                      onDoubleClick={() => void openMessage(message.id, selectedThread.key)}
                    >
                      <span>{formatEmailDate(emailMessageDateValue(message))}</span>
                      <strong>{message.direction === 'Incoming' ? message.from : message.to}</strong>
                      {message.attachments.length > 0 && (
                        <span className="email-thread-attachment" title="Piece jointe">
                          <Paperclip aria-label="Piece jointe" size={14} />
                        </span>
                      )}
                      <small>{message.direction === 'Incoming' ? 'Recu' : 'Envoye'} · {message.isRead ? 'Lu' : 'Non lu'}</small>
                    </button>
                  ))}
                </div>
              </section>
            )}
            <section className="email-body-preview">
              <iframe
                className="email-body-frame"
                title={`Email - ${selectedMessage.subject}`}
                sandbox="allow-popups"
                srcDoc={buildEmailFrameDocument(selectedMessage.body || '')}
              />
            </section>
            {selectedMessage.attachments.length > 0 && (
              <section className="email-attachments">
                <h3>Pieces jointes</h3>
                {selectedMessage.attachments.map((attachment) => (
                  <div key={attachment.id} className="attachment-row">
                    <span>{attachment.fileName}</span>
                    <span>{Math.round(attachment.size / 1024)} Ko</span>
                    <button className="secondary" type="button" onClick={() => api.downloadEmailAttachment(selectedMessage.id, attachment.id, attachment.fileName)}>
                      <Download size={15} />
                      Ouvrir
                    </button>
                  </div>
                ))}
              </section>
            )}
            <div className="modal-footer">
              <button className="secondary" type="button" onClick={() => startReply('single')}>
                <Reply size={16} />
                Repondre
              </button>
              <button className="secondary" type="button" onClick={() => startReply('all')}>
                <ReplyAll size={16} />
                Repondre a tous
              </button>
              <button className="secondary" type="button" onClick={startForward}>
                <Forward size={16} />
                Transferer
              </button>
              <button className="danger" type="button" onClick={() => void deleteSelectedMessage()}>
                <Trash2 size={16} />
                Supprimer
              </button>
              <button className="secondary" type="button" onClick={() => markSelectedMessage(!selectedMessage.isRead)}>
                {selectedMessage.isRead ? 'Marquer non lu' : 'Marquer lu'}
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function Prestashop({ connections, logs, onChanged }: { connections: PrestashopConnection[]; logs: PrestashopSyncLog[]; onChanged: () => Promise<void> }) {
  const [syncingConnectionId, setSyncingConnectionId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncFailed, setSyncFailed] = useState(false);

  function isPending(status: string) {
    return status === 'Queued' || status === 'Running';
  }

  async function waitForSyncResult(syncLogId: string) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
      const nextLogs = await api.prestashopLogs();
      const currentLog = nextLogs.find((item) => item.id === syncLogId);
      await onChanged();
      if (currentLog && !isPending(currentLog.status)) {
        return currentLog;
      }
    }

    return null;
  }

  async function sync(connection: PrestashopConnection) {
    setSyncingConnectionId(connection.id);
    setSyncFailed(false);
    setSyncMessage(`Demande envoyee pour ${connection.shopUrl}.`);

    try {
      let result = await api.runPrestashopSync(connection.id);
      setSyncFailed(result.status === 'Failed');
      setSyncMessage(result.message || `Synchronisation ${result.status}.`);
      await onChanged();

      if (isPending(result.status)) {
        setSyncMessage(`${result.message || 'Synchronisation en attente.'} Suivi du traitement en cours...`);
        const completedLog = await waitForSyncResult(result.id);
        if (completedLog) {
          result = completedLog;
          setSyncFailed(result.status === 'Failed');
          setSyncMessage(result.message || `Synchronisation ${result.status}.`);
        } else {
          setSyncFailed(false);
          setSyncMessage('La synchronisation est encore en cours. Les journaux se mettront a jour automatiquement au prochain rafraichissement.');
        }
      }
    } catch (err) {
      setSyncFailed(true);
      setSyncMessage(err instanceof Error ? err.message : 'Synchronisation PrestaShop impossible.');
      await onChanged().catch(() => undefined);
    } finally {
      setSyncingConnectionId(null);
    }
  }

  function renderSyncAction(connection: PrestashopConnection) {
    if (!connection.isActive) {
      return <span className="muted-text">Inactive dans Parametres</span>;
    }

    if (!connection.hasApiKey) {
      return <span className="muted-text">Cle API manquante</span>;
    }

    return (
      <button className="secondary" type="button" disabled={Boolean(syncingConnectionId)} onClick={() => sync(connection)}>
        {syncingConnectionId === connection.id ? 'Synchronisation...' : 'Synchroniser'}
      </button>
    );
  }

  return (
    <>
      <Panel title="Synchronisation PrestaShop">
        <p className="panel-note">La configuration des boutiques et des cles API se fait dans Parametres avec un compte administrateur.</p>
      </Panel>
      {syncMessage && <div className={syncFailed ? 'alert' : 'loading'}>{syncMessage}</div>}
      <DataTable
        columns={['Boutique', 'Cle API', 'Statut', 'Sync']}
        rows={connections.map((item) => [
          item.shopUrl,
          item.hasApiKey ? 'Configuree' : 'Manquante',
          item.isActive ? 'Actif' : 'Inactif',
          renderSyncAction(item)
        ])}
      />
      <DataTable columns={['Connexion', 'Statut', 'Message', 'Fin']} rows={logs.map((item) => [item.prestashopConnectionId, item.status, item.message || '-', item.completedAt ?? '-'])} />
    </>
  );
}

type DriveEntryRef = { kind: 'folder' | 'file'; id: string; name: string };
type DriveFolderOption = { id: string; name: string; depth: number };
type DrivePreview = { file: DriveItem; url: string; mimeType: string };

function isImageDriveFile(file: DriveItem) {
  return file.mimeType.toLowerCase().startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name);
}

function isPdfDriveFile(file: DriveItem) {
  return file.mimeType.toLowerCase().includes('pdf') || /\.pdf$/i.test(file.name);
}

function isTextDriveFile(file: DriveItem) {
  return file.mimeType.toLowerCase().startsWith('text/') || /\.(txt|csv|json|xml|md)$/i.test(file.name);
}

function Drive({ folders, files, onChanged }: { folders: DriveFolder[]; files: DriveItem[]; onChanged: () => Promise<void> }) {
  const [folderName, setFolderName] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [path, setPath] = useState<Array<{ id: string | null; name: string }>>([{ id: null, name: 'Racine' }]);
  const [visibleFolders, setVisibleFolders] = useState<DriveFolder[]>(folders);
  const [visibleFiles, setVisibleFiles] = useState<DriveItem[]>(files);
  const [search, setSearch] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<DriveEntryRef | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [moveTarget, setMoveTarget] = useState<DriveEntryRef | null>(null);
  const [moveDestinationId, setMoveDestinationId] = useState('');
  const [moveFolders, setMoveFolders] = useState<DriveFolderOption[]>([]);
  const [draggedEntry, setDraggedEntry] = useState<DriveEntryRef | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => (localStorage.getItem('oceanerp.driveViewMode') === 'grid' ? 'grid' : 'list'));
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<DrivePreview | null>(null);

  async function refreshDrive() {
    const [nextFolders, nextFiles] = await Promise.all([api.folders(currentFolderId, search, showTrash), api.files(currentFolderId, search, showTrash)]);
    setVisibleFolders(nextFolders);
    setVisibleFiles(nextFiles);
  }

  useEffect(() => {
    refreshDrive().catch((err) => setMessage(err instanceof Error ? err.message : 'Chargement Drive impossible'));
  }, [currentFolderId, search, showTrash]);

  useEffect(() => {
    localStorage.setItem('oceanerp.driveViewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    let cancelled = false;
    const createdUrls: string[] = [];
    const imageFiles = visibleFiles.filter((file) => !file.isTrashed && isImageDriveFile(file));

    Promise.all(imageFiles.map(async (file) => {
      try {
        const blob = await api.driveFileBlob(file.id);
        const url = URL.createObjectURL(blob);
        createdUrls.push(url);
        return [file.id, url] as const;
      } catch {
        return null;
      }
    })).then((entries) => {
      if (cancelled) {
        createdUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      setThumbnailUrls((current) => {
        Object.values(current).forEach((url) => URL.revokeObjectURL(url));
        return Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry)));
      });
    });

    return () => {
      cancelled = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [visibleFiles]);

  useEffect(() => () => {
    Object.values(thumbnailUrls).forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => () => {
    if (preview?.url) {
      URL.revokeObjectURL(preview.url);
    }
  }, [preview?.url]);

  async function createFolder(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await api.createFolder({ name: folderName, parentFolderId: currentFolderId });
      setFolderName('');
      await refreshDrive();
      await onChanged();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Creation du dossier impossible');
    } finally {
      setBusy(false);
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length === 0) {
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const results = await Promise.all(selectedFiles.map(async (file) => {
        try {
          await api.uploadDriveFile(file, currentFolderId);
          return { fileName: file.name, success: true, error: null };
        } catch (err) {
          return { fileName: file.name, success: false, error: err instanceof Error ? err.message : 'Upload impossible' };
        }
      }));
      const failedUploads = results.filter((result) => !result.success);
      event.target.value = '';
      await refreshDrive();
      await onChanged();
      if (failedUploads.length > 0) {
        const failedNames = failedUploads.map((result) => result.fileName).join(', ');
        setMessage(`${selectedFiles.length - failedUploads.length}/${selectedFiles.length} fichier(s) envoyes. Echec : ${failedNames}`);
      } else {
        setMessage(selectedFiles.length === 1 ? 'Fichier envoye.' : `${selectedFiles.length} fichiers envoyes.`);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Upload impossible');
    } finally {
      setBusy(false);
    }
  }

  function openFolder(folder: DriveFolder) {
    if (folder.isTrashed) {
      return;
    }

    setCurrentFolderId(folder.id);
    setPath((items) => [...items, { id: folder.id, name: folder.name }]);
  }

  function goTo(index: number) {
    const nextPath = path.slice(0, index + 1);
    setPath(nextPath);
    setCurrentFolderId(nextPath[nextPath.length - 1]?.id ?? null);
  }

  async function runDriveAction(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      await refreshDrive();
      await onChanged();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Action Drive impossible');
    } finally {
      setBusy(false);
    }
  }

  async function loadFolderOptions(parentFolderId: string | null = null, depth = 0): Promise<DriveFolderOption[]> {
    const childFolders = await api.folders(parentFolderId, '', false);
    const options: DriveFolderOption[] = [];
    for (const folder of childFolders) {
      options.push({ id: folder.id, name: folder.name, depth });
      options.push(...await loadFolderOptions(folder.id, depth + 1));
    }

    return options;
  }

  function startRename(target: DriveEntryRef) {
    setRenameTarget(target);
    setRenameValue(target.name);
  }

  async function submitRename(event: FormEvent) {
    event.preventDefault();
    if (!renameTarget || !renameValue.trim()) {
      return;
    }

    const target = renameTarget;
    const name = renameValue.trim();
    await runDriveAction(async () => {
      if (target.kind === 'folder') {
        await api.renameFolder(target.id, name);
      } else {
        await api.renameDriveFile(target.id, name);
      }
    });
    setRenameTarget(null);
    setRenameValue('');
  }

  async function startMove(target: DriveEntryRef) {
    setMoveTarget(target);
    setMoveDestinationId(currentFolderId ?? '');
    setMessage(null);
    try {
      setMoveFolders(await loadFolderOptions());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Chargement des dossiers impossible');
      setMoveFolders([]);
    }
  }

  async function submitMove(event: FormEvent) {
    event.preventDefault();
    if (!moveTarget) {
      return;
    }

    const target = moveTarget;
    const destination = moveDestinationId || null;
    await moveEntry(target, destination);
    setMoveTarget(null);
    setMoveDestinationId('');
  }

  async function moveEntry(target: DriveEntryRef, destinationFolderId: string | null) {
    if (target.kind === 'folder' && target.id === destinationFolderId) {
      setMessage('Un dossier ne peut pas etre deplace dans lui-meme.');
      return;
    }

    await runDriveAction(async () => {
      if (target.kind === 'folder') {
        await api.moveFolder(target.id, destinationFolderId);
      } else {
        await api.moveDriveFile(target.id, destinationFolderId);
      }
    });
  }

  function startDrag(entry: DriveEntryRef, event: DragEvent<HTMLElement>) {
    setDraggedEntry(entry);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/oceanerp-drive-entry', JSON.stringify(entry));
  }

  function getDraggedEntry(event: DragEvent<HTMLElement>) {
    const raw = event.dataTransfer.getData('application/oceanerp-drive-entry');
    if (raw) {
      try {
        return JSON.parse(raw) as DriveEntryRef;
      } catch {
        return draggedEntry;
      }
    }

    return draggedEntry;
  }

  function allowDrop(destinationFolderId: string | null, event: DragEvent<HTMLElement>) {
    if (!draggedEntry) {
      return;
    }

    if (draggedEntry.kind === 'folder' && draggedEntry.id === destinationFolderId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTargetId(destinationFolderId ?? 'root');
  }

  async function dropEntry(destinationFolderId: string | null, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    const entry = getDraggedEntry(event);
    setDropTargetId(null);
    setDraggedEntry(null);
    if (!entry) {
      return;
    }

    await moveEntry(entry, destinationFolderId);
  }

  async function openFilePreview(file: DriveItem) {
    if (file.isTrashed) {
      return;
    }

    setMessage(null);
    try {
      const blob = await api.driveFileBlob(file.id);
      const url = URL.createObjectURL(blob);
      setPreview((current) => {
        if (current?.url) {
          URL.revokeObjectURL(current.url);
        }

        return { file, url, mimeType: blob.type || file.mimeType };
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Apercu impossible');
    }
  }

  function closePreview() {
    setPreview((current) => {
      if (current?.url) {
        URL.revokeObjectURL(current.url);
      }

      return null;
    });
  }

  function renderFileVisual(file: DriveItem) {
    const thumbnailUrl = thumbnailUrls[file.id];
    if (isImageDriveFile(file)) {
      return (
        <span className="drive-thumb">
          {thumbnailUrl ? <img src={thumbnailUrl} alt={file.name} /> : <ImageIcon size={24} />}
        </span>
      );
    }

    return (
      <span className="drive-file-icon">
        <FileText size={20} />
      </span>
    );
  }

  function renderFilePreview() {
    if (!preview) {
      return null;
    }

    if (isImageDriveFile(preview.file)) {
      return <img className="drive-preview-image" src={preview.url} alt={preview.file.name} />;
    }

    if (isPdfDriveFile(preview.file) || isTextDriveFile(preview.file)) {
      return <iframe className="drive-preview-frame" src={preview.url} title={preview.file.name} />;
    }

    return (
      <div className="drive-preview-empty">
        <FileText size={42} />
        <strong>Apercu non disponible pour ce type de fichier.</strong>
        <button className="secondary" type="button" onClick={() => api.downloadDriveFile(preview.file.id, preview.file.name)}>
          <Download size={15} />
          Telecharger
        </button>
      </div>
    );
  }

  return (
    <>
      <Panel title="Documents">
        <div className="module-actions">
          <form className="inline-form" onSubmit={createFolder}>
            <input required placeholder="Nom du dossier" value={folderName} onChange={(event) => setFolderName(event.target.value)} />
            <button className="primary" type="submit">
              <Plus size={16} />
              Dossier
            </button>
          </form>
          <label className="upload-button">
            <Upload size={16} />
            Upload
            <input type="file" multiple onChange={upload} />
          </label>
        </div>
        <div className="drive-toolbar">
          <div className="drive-path">
            {path.map((item, index) => (
              <button
                key={`${item.id ?? 'root'}-${index}`}
                className={`link-button drop-chip ${dropTargetId === (item.id ?? 'root') ? 'drop-target' : ''}`}
                type="button"
                onClick={() => goTo(index)}
                onDragOver={(event) => allowDrop(item.id, event)}
                onDragLeave={() => setDropTargetId(null)}
                onDrop={(event) => dropEntry(item.id, event)}
              >
                {item.name}
              </button>
            ))}
          </div>
          <div className="drive-filters">
            <input aria-label="Recherche Drive" placeholder="Rechercher un document ou dossier" value={search} onChange={(event) => setSearch(event.target.value)} />
            <div className="view-switch" role="group" aria-label="Affichage Drive">
              <button className={viewMode === 'list' ? 'active' : ''} type="button" onClick={() => setViewMode('list')} title="Vue liste">
                <List size={16} />
                Liste
              </button>
              <button className={viewMode === 'grid' ? 'active' : ''} type="button" onClick={() => setViewMode('grid')} title="Vue mosaique">
                <Grid2X2 size={16} />
                Mosaique
              </button>
            </div>
            <label className="checkbox-line">
              <input type="checkbox" checked={showTrash} onChange={(event) => setShowTrash(event.target.checked)} />
              Corbeille incluse
            </label>
          </div>
        </div>
        {message && <div className="inline-message">{message}</div>}
      </Panel>
      <section className={viewMode === 'grid' ? 'drive-list drive-grid' : 'drive-list'}>
        {visibleFolders.map((folder) => (
          <article
            key={folder.id}
            className={`${folder.isTrashed ? 'drive-row trashed' : 'drive-row'}${dropTargetId === folder.id ? ' drop-target' : ''}`}
            draggable={!folder.isTrashed}
            onDragStart={(event) => startDrag({ kind: 'folder', id: folder.id, name: folder.name }, event)}
            onDragEnd={() => { setDraggedEntry(null); setDropTargetId(null); }}
            onDragOver={(event) => allowDrop(folder.id, event)}
            onDragLeave={() => setDropTargetId(null)}
            onDrop={(event) => dropEntry(folder.id, event)}
          >
            <button className="drive-main" type="button" onClick={() => openFolder(folder)} disabled={folder.isTrashed}>
              <Folder size={18} />
              <span>{folder.name}</span>
            </button>
            <small>{folder.isTrashed ? 'Corbeille' : 'Dossier'}</small>
            <div className="drive-actions">
              {folder.isTrashed ? (
                <button className="secondary" type="button" disabled={busy} onClick={() => runDriveAction(() => api.restoreFolder(folder.id).then(() => undefined))}>
                  Restaurer
                </button>
              ) : (
                <>
                  <button className="secondary" type="button" disabled={busy} onClick={() => startRename({ kind: 'folder', id: folder.id, name: folder.name })}>
                    <Pencil size={15} />
                    Renommer
                  </button>
                  <button className="secondary" type="button" disabled={busy} onClick={() => startMove({ kind: 'folder', id: folder.id, name: folder.name })}>
                    Deplacer
                  </button>
                  <button className="danger" type="button" disabled={busy} onClick={() => window.confirm(`Mettre "${folder.name}" a la corbeille ?`) && runDriveAction(() => api.trashFolder(folder.id))}>
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
        {visibleFiles.map((file) => (
          <article
            key={file.id}
            className={file.isTrashed ? 'drive-row trashed' : 'drive-row'}
            draggable={!file.isTrashed}
            onDragStart={(event) => startDrag({ kind: 'file', id: file.id, name: file.name }, event)}
            onDragEnd={() => { setDraggedEntry(null); setDropTargetId(null); }}
            onDoubleClick={() => openFilePreview(file)}
          >
            <div className="drive-main drive-file-main" role="button" tabIndex={0} title="Double-cliquer pour afficher un apercu" onDoubleClick={(event) => { event.stopPropagation(); openFilePreview(file); }} onKeyDown={(event) => { if (event.key === 'Enter') openFilePreview(file); }}>
              {renderFileVisual(file)}
              <span>{file.name}</span>
            </div>
            <small>{file.isTrashed ? 'Corbeille' : `${Math.round(file.size / 1024)} Ko`}</small>
            <div className="drive-actions">
              {file.isTrashed ? (
                <button className="secondary" type="button" disabled={busy} onClick={() => runDriveAction(() => api.restoreDriveFile(file.id).then(() => undefined))}>
                  Restaurer
                </button>
              ) : (
                <>
                  <button className="secondary" onClick={() => api.downloadDriveFile(file.id, file.name)} type="button">
                    <Download size={15} />
                    Ouvrir
                  </button>
                  <button className="secondary" type="button" disabled={busy} onClick={() => startRename({ kind: 'file', id: file.id, name: file.name })}>
                    <Pencil size={15} />
                    Renommer
                  </button>
                  <button className="secondary" type="button" disabled={busy} onClick={() => startMove({ kind: 'file', id: file.id, name: file.name })}>
                    Deplacer
                  </button>
                  <button className="danger" type="button" disabled={busy} onClick={() => window.confirm(`Mettre "${file.name}" a la corbeille ?`) && runDriveAction(() => api.trashDriveFile(file.id))}>
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
        {visibleFolders.length + visibleFiles.length === 0 && <EmptyState icon={Folder} title="Aucun document" />}
      </section>
      {renameTarget && (
        <div className="modal-backdrop" onClick={() => setRenameTarget(null)}>
          <form className="modal-panel drive-dialog" role="dialog" aria-modal="true" onSubmit={submitRename} onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <div>
                <p className="eyebrow">Drive</p>
                <h2>Renommer</h2>
              </div>
              <button className="modal-close" type="button" aria-label="Fermer" title="Fermer" onClick={() => setRenameTarget(null)}>
                <X size={18} />
              </button>
            </header>
            <label className="field">
              <span>Nouveau nom</span>
              <input autoFocus required value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
            </label>
            <div className="modal-footer">
              <button className="secondary" type="button" onClick={() => setRenameTarget(null)}>Annuler</button>
              <button className="primary" type="submit" disabled={busy}>
                <Save size={16} />
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}
      {moveTarget && (
        <div className="modal-backdrop" onClick={() => setMoveTarget(null)}>
          <form className="modal-panel drive-dialog" role="dialog" aria-modal="true" onSubmit={submitMove} onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <div>
                <p className="eyebrow">Drive</p>
                <h2>Deplacer {moveTarget.name}</h2>
              </div>
              <button className="modal-close" type="button" aria-label="Fermer" title="Fermer" onClick={() => setMoveTarget(null)}>
                <X size={18} />
              </button>
            </header>
            <label className="field">
              <span>Dossier destination</span>
              <select value={moveDestinationId} onChange={(event) => setMoveDestinationId(event.target.value)}>
                <option value="">Racine</option>
                {moveFolders
                  .filter((folder) => !(moveTarget.kind === 'folder' && folder.id === moveTarget.id))
                  .map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {'-'.repeat(folder.depth)} {folder.name}
                    </option>
                  ))}
              </select>
            </label>
            <p className="panel-note">Astuce : vous pouvez aussi glisser un fichier ou un dossier directement sur un dossier, ou sur "Racine".</p>
            <div className="modal-footer">
              <button className="secondary" type="button" onClick={() => setMoveTarget(null)}>Annuler</button>
              <button className="primary" type="submit" disabled={busy}>
                Deplacer
              </button>
            </div>
          </form>
        </div>
      )}
      {preview && (
        <div className="modal-backdrop" onClick={closePreview}>
          <section className="modal-panel drive-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="drive-preview-title" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <div>
                <p className="eyebrow">Apercu</p>
                <h2 id="drive-preview-title">{preview.file.name}</h2>
              </div>
              <div className="modal-actions">
                <button className="secondary" type="button" onClick={() => api.downloadDriveFile(preview.file.id, preview.file.name)}>
                  <Download size={15} />
                  Telecharger
                </button>
                <button className="modal-close" type="button" aria-label="Fermer" title="Fermer" onClick={closePreview}>
                  <X size={18} />
                </button>
              </div>
            </header>
            <div className="drive-preview-body">
              {renderFilePreview()}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function Notifications({ items, onOpen }: { items: NotificationItem[]; onOpen: (item: NotificationItem) => void }) {
  return (
    <section className="notification-list">
      {items.map((item) => (
        <button key={item.id} type="button" className={item.isRead ? 'notification read notification-button' : 'notification notification-button'} onClick={() => onOpen(item)}>
          <Bell size={18} />
          <div>
            <strong>{item.title}</strong>
            <p>{item.message}</p>
          </div>
        </button>
      ))}
      {items.length === 0 && <EmptyState icon={Bell} title="Aucune notification" />}
    </section>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DocumentLinksPanel({ module, entityId }: { module: 'customers' | 'products'; entityId: string }) {
  const [links, setLinks] = useState<DocumentLink[]>([]);
  const [fileSearch, setFileSearch] = useState('');
  const [candidateFiles, setCandidateFiles] = useState<DriveItem[]>([]);
  const [driveItemId, setDriveItemId] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function loadLinks() {
    setLinks(await api.documentLinks(module, entityId));
  }

  useEffect(() => {
    loadLinks().catch((err) => setMessage(err instanceof Error ? err.message : 'Documents lies indisponibles'));
  }, [module, entityId]);

  useEffect(() => {
    if (fileSearch.trim().length < 2) {
      setCandidateFiles([]);
      return;
    }

    let cancelled = false;
    api.files(null, fileSearch, false)
      .then((items) => {
        if (!cancelled) {
          setCandidateFiles(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCandidateFiles([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fileSearch]);

  async function addLink(event: FormEvent) {
    event.preventDefault();
    if (!driveItemId) {
      setMessage('Selectionnez un fichier Drive.');
      return;
    }

    setMessage(null);
    try {
      await api.linkDocument({ driveItemId, module, entityId });
      setDriveItemId('');
      setFileSearch('');
      setCandidateFiles([]);
      await loadLinks();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Rattachement impossible');
    }
  }

  async function removeLink(linkId: string) {
    setMessage(null);
    try {
      await api.unlinkDocument(linkId);
      await loadLinks();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Suppression du lien impossible');
    }
  }

  return (
    <section className="customer-detail-section">
      <h3>Documents lies</h3>
      <form className="document-link-form" onSubmit={addLink}>
        <input value={fileSearch} onChange={(event) => setFileSearch(event.target.value)} placeholder="Rechercher un fichier Drive" />
        <select value={driveItemId} onChange={(event) => setDriveItemId(event.target.value)}>
          <option value="">Fichier Drive</option>
          {candidateFiles.map((file) => (
            <option key={file.id} value={file.id}>{file.name}</option>
          ))}
        </select>
        <button className="secondary" type="submit">
          <Plus size={16} />
          Lier
        </button>
      </form>
      {message && <div className="inline-message">{message}</div>}
      <div className="document-link-list">
        {links.map((link) => (
          <article className="document-link-row" key={link.id}>
            <FileText size={17} />
            <span>{link.fileName}</span>
            <small>{Math.round(link.size / 1024)} Ko</small>
            <button className="secondary" type="button" onClick={() => api.downloadDriveFile(link.driveItemId, link.fileName)}>
              <Download size={15} />
              Ouvrir
            </button>
            <button className="danger" type="button" onClick={() => removeLink(link.id)}>
              <Trash2 size={15} />
            </button>
          </article>
        ))}
        {links.length === 0 && <p className="panel-note">Aucun document lie.</p>}
      </div>
    </section>
  );
}

function DataTable({
  columns,
  rows,
  onRowClick,
  selectedRowIndex
}: {
  columns: string[];
  rows: Array<Array<ReactNode>>;
  onRowClick?: (index: number) => void;
  selectedRowIndex?: number;
}) {
  const [sortState, setSortState] = useState<{ columnIndex: number; direction: 'asc' | 'desc' } | null>(null);
  const sortedRows = useMemo(() => {
    const indexedRows = rows.map((row, index) => ({ row, originalIndex: index }));
    if (!sortState) {
      return indexedRows;
    }

    return [...indexedRows].sort((left, right) => {
      const result = compareTableCells(left.row[sortState.columnIndex], right.row[sortState.columnIndex]);
      return sortState.direction === 'asc' ? result : -result;
    });
  }, [rows, sortState]);

  function toggleSort(columnIndex: number) {
    setSortState((current) => {
      if (!current || current.columnIndex !== columnIndex) {
        return { columnIndex, direction: 'asc' };
      }

      if (current.direction === 'asc') {
        return { columnIndex, direction: 'desc' };
      }

      return null;
    });
  }

  return (
    <section className="table-surface">
      <table>
        <thead>
          <tr>
            {columns.map((column, columnIndex) => (
              <th key={column} aria-sort={sortState?.columnIndex === columnIndex ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button className="sortable-header" type="button" onClick={() => toggleSort(columnIndex)} title={`Trier ${column}`}>
                  <span>{column}</span>
                  {sortState?.columnIndex === columnIndex && (sortState.direction === 'asc' ? <ArrowDownAZ size={15} /> : <ArrowUpAZ size={15} />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map(({ row, originalIndex }) => (
            <tr
              key={originalIndex}
              className={`${onRowClick ? 'clickable-row' : ''}${selectedRowIndex === originalIndex ? ' selected' : ''}`}
              onClick={onRowClick ? () => onRowClick(originalIndex) : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onRowClick(originalIndex);
                      }
                    }
                  : undefined
              }
              tabIndex={onRowClick ? 0 : undefined}
            >
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <EmptyState icon={BriefcaseBusiness} title="Aucune donnee" />}
    </section>
  );
}

function compareTableCells(left: ReactNode, right: ReactNode) {
  const leftText = tableCellText(left);
  const rightText = tableCellText(right);
  const leftNumber = parseTableNumber(leftText);
  const rightNumber = parseTableNumber(rightText);
  if (leftNumber !== null && rightNumber !== null) {
    return leftNumber - rightNumber;
  }

  const leftDate = parseTableDate(leftText);
  const rightDate = parseTableDate(rightText);
  if (leftDate !== null && rightDate !== null) {
    return leftDate - rightDate;
  }

  return leftText.localeCompare(rightText, 'fr', { numeric: true, sensitivity: 'base' });
}

function tableCellText(value: ReactNode): string {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }

  if (Array.isArray(value)) {
    return value.map(tableCellText).join(' ').trim();
  }

  if (isValidElement<{ children?: ReactNode }>(value)) {
    return tableCellText(value.props.children);
  }

  return '';
}

function parseTableNumber(value: string) {
  const normalized = value.trim();
  if (!normalized || /[/:T]/.test(normalized)) {
    return null;
  }

  const cleaned = normalized
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/(EUR|€|%|Ko)$/i, '')
    .replace(/[^\d.-]/g, '');

  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return null;
  }

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function parseTableDate(value: string) {
  const normalized = value.trim();
  if (/\d{4}-\d{2}-\d{2}/.test(normalized)) {
    const timestamp = Date.parse(normalized);
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  const frenchMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!frenchMatch) {
    return null;
  }

  const [, day, month, year, hour = '0', minute = '0', second = '0'] = frenchMatch;
  const timestamp = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function EmptyState({ icon: Icon, title }: { icon: typeof Box; title: string }) {
  return (
    <div className="empty-state">
      <Icon size={28} />
      <strong>{title}</strong>
    </div>
  );
}
