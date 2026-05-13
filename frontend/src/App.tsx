import { type ChangeEvent, type FormEvent, type ReactNode, isValidElement, useEffect, useMemo, useState } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { ArrowDownAZ, ArrowUpAZ, Bell, Box, BriefcaseBusiness, Download, FileText, Folder, KeyRound, LayoutDashboard, LogOut, Mail, Package, Pencil, Plus, Save, Search, Settings as SettingsIcon, ShieldCheck, ShoppingBag, ShoppingCart, Store, Trash2, Upload, UserRound, Users, Warehouse as WarehouseIcon, X } from 'lucide-react';
import { api } from './api/client';
import type { Customer, DashboardSummary, DriveFolder, DriveItem, EmailMessage, Invoice, MailAccount, NotificationItem, PagedResult, Permission, PrestashopConnection, PrestashopSyncLog, Product, ProductSupplier, PurchaseOrder, Quote, Role, SalesOrder, StockItem, StockMovement, User, Warehouse } from './types';

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
  const [customers, setCustomers] = useState<PagedResult<Customer> | null>(null);
  const [products, setProducts] = useState<PagedResult<Product> | null>(null);
  const [quotes, setQuotes] = useState<PagedResult<Quote> | null>(null);
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
  const [emailMessages, setEmailMessages] = useState<PagedResult<EmailMessage> | null>(null);
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
          const [nextUsers, nextRoles, nextPermissions] = await Promise.all([api.users(), api.roles(), api.permissions()]);
          setUsers(nextUsers);
          setRoles(nextRoles);
          setPermissions(nextPermissions);
        }
        if (hasPermission(user, 'prestashop.read') && hasPermission(user, 'prestashop.write')) {
          setPrestashopConnections(await api.prestashopConnections());
        }
        if (hasPermission(user, 'stock.read')) {
          setWarehouses(await api.warehouses());
        }
      }
      if (target === 'customers') {
        setCustomers(await api.customers());
      }
      if (target === 'products') {
        setProducts(await api.products());
      }
      if (target === 'quotes') {
        const [nextQuotes, nextCustomers] = await Promise.all([api.quotes(), api.customers()]);
        setQuotes(nextQuotes);
        setCustomers(nextCustomers);
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
        const [nextPurchaseOrders, nextProducts, nextSuppliers, nextWarehouses] = await Promise.all([api.purchaseOrders(), api.products(), api.productSuppliers(), api.warehouses()]);
        setPurchaseOrders(nextPurchaseOrders);
        setProducts(nextProducts);
        setProductSuppliers(nextSuppliers);
        setWarehouses(nextWarehouses);
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
        const [nextAccounts, nextMessages] = await Promise.all([api.mailAccounts(), api.emailMessages()]);
        setMailAccounts(nextAccounts);
        setEmailMessages(nextMessages);
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
    });

    connection.start().catch(() => undefined);
    return () => {
      connection.stop().catch(() => undefined);
    };
  }, [isAuthenticated]);

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
            prestashopConnections={prestashopConnections}
            warehouses={warehouses}
            onUsersRolesChanged={() => load('settings')}
            onPrestashopChanged={() => load('settings')}
            onWarehousesChanged={() => load('settings')}
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
        {!loading && view === 'quotes' && <Quotes items={quotes?.items ?? []} customers={customers?.items ?? []} onChanged={() => load('quotes')} />}
        {!loading && view === 'orders' && <Orders items={orders?.items ?? []} customers={customers?.items ?? []} products={products?.items ?? []} warehouses={warehouses} onChanged={() => load('orders')} />}
        {!loading && view === 'purchases' && <Purchases items={purchaseOrders?.items ?? []} suppliers={productSuppliers} products={products?.items ?? []} warehouses={warehouses} onChanged={() => load('purchases')} />}
        {!loading && view === 'invoices' && <Invoices items={invoices?.items ?? []} orders={orders?.items ?? []} onChanged={() => load('invoices')} />}
        {!loading && view === 'stock' && <Stock items={stockItems} movements={stockMovements} products={products?.items ?? []} warehouses={warehouses} purchaseOrders={purchaseOrders?.items ?? []} focusedProductIds={stockFocusProductIds} onClearFocusedProducts={() => setStockFocusProductIds([])} prestashopConnections={prestashopConnections} onChanged={() => load('stock')} />}
        {!loading && view === 'emails' && <Emails accounts={mailAccounts} messages={emailMessages?.items ?? []} onChanged={() => load('emails')} />}
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
  prestashopConnections,
  warehouses,
  onUsersRolesChanged,
  onPrestashopChanged,
  onWarehousesChanged,
  onUserChanged,
  onSignedOut
}: {
  currentUser: User | null;
  users: User[];
  roles: Role[];
  permissions: Permission[];
  prestashopConnections: PrestashopConnection[];
  warehouses: Warehouse[];
  onUsersRolesChanged: () => Promise<void>;
  onPrestashopChanged: () => Promise<void>;
  onWarehousesChanged: () => Promise<void>;
  onUserChanged: (user: User) => void;
  onSignedOut: () => void;
}) {
  const canManageUsers = hasPermission(currentUser, 'auth.users.read') && hasPermission(currentUser, 'auth.users.write');
  const canManagePrestashop = hasPermission(currentUser, 'prestashop.read') && hasPermission(currentUser, 'prestashop.write');
  const canManageWarehouses = hasPermission(currentUser, 'stock.read') && hasPermission(currentUser, 'stock.write');
  const [activeTab, setActiveTab] = useState<'account' | 'access' | 'warehouses' | 'prestashop'>('account');
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
    if ((activeTab === 'access' && !canManageUsers) || (activeTab === 'warehouses' && !canManageWarehouses) || (activeTab === 'prestashop' && !canManagePrestashop)) {
      setActiveTab('account');
    }
  }, [activeTab, canManagePrestashop, canManageUsers, canManageWarehouses]);

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
    ...(canManageUsers ? [{ key: 'access' as const, label: 'Utilisateurs/Roles' }] : []),
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

        {activeTab === 'access' && canManageUsers && <UsersRoles users={users} roles={roles} permissions={permissions} onChanged={onUsersRolesChanged} />}
        {activeTab === 'warehouses' && canManageWarehouses && <WarehousesSettings warehouses={warehouses} onChanged={onWarehousesChanged} />}
        {activeTab === 'prestashop' && canManagePrestashop && <PrestashopSettings connections={prestashopConnections} warehouses={warehouses} onChanged={onPrestashopChanged} />}
      </section>
    </>
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
        <p className="panel-note">PrestaShop ne gere pas plusieurs entrepots dans ce connecteur. Une connexion utilise un seul entrepot ERP pour le stock boutique.</p>
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

function MultiSelect({ label, values, options, onChange }: { label: string; values: string[]; options: string[]; onChange: (values: string[]) => void }) {
  return (
    <label className="multi-select">
      {label}
      <select multiple value={values} onChange={(event) => onChange(Array.from(event.currentTarget.selectedOptions).map((option) => option.value))}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
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

function Customers({ items, onChanged }: { items: Customer[]; onChanged: () => Promise<void> }) {
  const [code, setCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [vatNumber, setVatNumber] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    await api.createCustomer({ code, companyName, vatNumber });
    setCode('');
    setCompanyName('');
    setVatNumber('');
    await onChanged();
  }

  return (
    <>
      <Panel title="Nouveau client">
        <form className="form-grid" onSubmit={submit}>
          <input required placeholder="Code client" value={code} onChange={(event) => setCode(event.target.value)} />
          <input required placeholder="Societe" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
          <input placeholder="TVA" value={vatNumber} onChange={(event) => setVatNumber(event.target.value)} />
          <button className="primary" type="submit">
            <Plus size={16} />
            Creer
          </button>
        </form>
      </Panel>
      <DataTable columns={['Code', 'Societe', 'TVA', 'Statut']} rows={items.map((item) => [item.code, item.companyName, item.vatNumber ?? '-', item.isActive ? 'Actif' : 'Inactif'])} />
    </>
  );
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

function Quotes({ items, customers, onChanged }: { items: Quote[]; customers: Customer[]; onChanged: () => Promise<void> }) {
  const [customerId, setCustomerId] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('0');
  const [vatRate, setVatRate] = useState('20');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const selectedCustomerId = customerId || customers[0]?.id;
    if (!selectedCustomerId) {
      throw new Error('Creer un client avant de creer un devis.');
    }

    const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await api.createQuote({
      customerId: selectedCustomerId,
      validUntil,
      lines: [{ description, quantity: Number(quantity), unitPrice: Number(unitPrice), discountRate: 0, vatRate: Number(vatRate) }]
    });
    setDescription('');
    setQuantity('1');
    setUnitPrice('0');
    setVatRate('20');
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

  return (
    <>
      <Panel title="Nouveau devis">
        <form className="form-grid" onSubmit={submit}>
          <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">Client</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.companyName}
              </option>
            ))}
          </select>
          <input required placeholder="Ligne de devis" value={description} onChange={(event) => setDescription(event.target.value)} />
          <input required type="number" step="0.001" placeholder="Quantite" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          <input required type="number" step="0.01" placeholder="Prix HT" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} />
          <input required type="number" step="0.01" placeholder="TVA" value={vatRate} onChange={(event) => setVatRate(event.target.value)} />
          <button className="primary" type="submit">
            <Plus size={16} />
            Creer
          </button>
        </form>
      </Panel>
      <DataTable
        columns={['Numero', 'Client', 'Statut', 'Total TTC', 'PDF']}
        rows={items.map((item) => [
          item.number,
          item.customerName ?? item.customerId,
          item.status,
          `${item.total.toFixed(2)} ${item.currency}`,
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

function Purchases({ items, suppliers, products, warehouses, onChanged }: { items: PurchaseOrder[]; suppliers: ProductSupplier[]; products: Product[]; warehouses: Warehouse[]; onChanged: () => Promise<void> }) {
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

  useEffect(() => {
    setDateValue(selectedDateOrder?.expectedAt ?? '');
  }, [selectedDateOrder]);

  useEffect(() => {
    setWarehouseValue(selectedWarehouseOrder?.warehouseId ?? '');
  }, [selectedWarehouseOrder]);

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

  function updateLine(lineId: string, patch: Partial<PurchaseDraftLine>) {
    setLines((current) => current.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  }

  function selectProduct(lineId: string, nextProductId: string) {
    const product = products.find((item) => item.id === nextProductId);
    updateLine(lineId, {
      productId: nextProductId,
      description: product ? `${product.reference} - ${product.name}` : '',
      unitPrice: product ? String(product.purchasePrice) : '0',
      vatRate: product ? String(product.vatRate) : '20'
    });
    if (product?.mainSupplierId && !supplierId) {
      setSupplierId(product.mainSupplierId);
    }
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
    const selectedSupplierId = supplierId || suppliers[0]?.id;
    if (!selectedSupplierId) {
      throw new Error('Creer un fournisseur produit avant de creer une commande fournisseur.');
    }

    const payload = {
      supplierId: selectedSupplierId,
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
              <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
                <option value="">Fournisseur</option>
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
              <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
                <option value="">A definir</option>
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
              <button className="secondary" type="button" onClick={() => setLines((current) => [...current, createPurchaseDraftLine()])}>
                <Plus size={16} />
                Ajouter une ligne
              </button>
            </div>
            <div className="purchase-lines">
              {lines.map((line, index) => {
                const totals = lineTotals(line);
                return (
                  <div className="purchase-line-row" key={line.id}>
                    <label className="field">
                      <span>Produit</span>
                      <select value={line.productId} onChange={(event) => selectProduct(line.id, event.target.value)}>
                        <option value="">Ligne libre</option>
                        {products.map((product) => (
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
            <button className="primary" type="submit">
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
  const globalPrestashopConnection = useMemo(() => activePrestashopConnections.find((connection) => !connection.warehouseId), [activePrestashopConnections]);
  const activePurchaseOrders = useMemo(() => purchaseOrders.filter((order) => order.status === 'Ordered' || order.status === 'PartiallyReceived'), [purchaseOrders]);
  const prestashopConnectionByWarehouseId = useMemo(
    () => new Map(activePrestashopConnections.filter((connection) => connection.warehouseId).map((connection) => [connection.warehouseId as string, connection])),
    [activePrestashopConnections]
  );
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
          prestashopConnection={prestashopConnectionByWarehouseId.get(selectedStock.warehouseId) ?? globalPrestashopConnection}
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
    ? `Entrepot PrestaShop lie a ${prestashopConnection.shopUrl}. Emplacement stock publie: ${warehouseLabel}`
    : activePrestashopConnections.length > 0
      ? "Non rattache a PrestaShop. La connexion active est limitee a un autre entrepot."
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
                ? "L'enregistrement publiera la quantite et le nom de l'entrepot dans le champ Emplacement du stock PrestaShop."
                : "Le stock ERP sera modifie, mais PrestaShop ne sera pas mis a jour tant que la connexion active ne couvre pas cet entrepot."}
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

function Emails({ accounts, messages, onChanged }: { accounts: MailAccount[]; messages: EmailMessage[]; onChanged: () => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    await api.createMailAccount({ email, smtpHost, imapHost });
    setEmail('');
    setSmtpHost('');
    setImapHost('');
    await onChanged();
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const mailAccountId = selectedAccountId || accounts[0]?.id;
    if (!mailAccountId) {
      throw new Error('Creer un compte mail avant envoyer un email.');
    }

    await api.sendEmail({ mailAccountId, to, subject, body });
    setTo('');
    setSubject('');
    setBody('');
    await onChanged();
  }

  return (
    <>
      <Panel title="Compte mail">
        <form className="form-grid" onSubmit={submit}>
          <input required type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <input required placeholder="SMTP" value={smtpHost} onChange={(event) => setSmtpHost(event.target.value)} />
          <input required placeholder="IMAP" value={imapHost} onChange={(event) => setImapHost(event.target.value)} />
          <button className="primary" type="submit">
            <Plus size={16} />
            Ajouter
          </button>
        </form>
      </Panel>
      <Panel title="Envoyer un email">
        <form className="form-grid" onSubmit={send}>
          <select value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)}>
            <option value="">Compte</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.email}
              </option>
            ))}
          </select>
          <input required type="email" placeholder="Destinataire" value={to} onChange={(event) => setTo(event.target.value)} />
          <input required placeholder="Sujet" value={subject} onChange={(event) => setSubject(event.target.value)} />
          <input required placeholder="Message" value={body} onChange={(event) => setBody(event.target.value)} />
          <button className="primary" type="submit">
            <Mail size={16} />
            Envoyer
          </button>
        </form>
      </Panel>
      <DataTable columns={['Compte', 'SMTP', 'IMAP', 'SSL']} rows={accounts.map((item) => [item.email, `${item.smtpHost}:${item.smtpPort}`, `${item.imapHost}:${item.imapPort}`, item.useSsl ? 'Oui' : 'Non'])} />
      <DataTable columns={['Sujet', 'De', 'A', 'Statut']} rows={messages.map((item) => [item.subject, item.from, item.to, item.status])} />
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

function Drive({ folders, files, onChanged }: { folders: DriveFolder[]; files: DriveItem[]; onChanged: () => Promise<void> }) {
  const [folderName, setFolderName] = useState('');

  async function createFolder(event: FormEvent) {
    event.preventDefault();
    await api.createFolder({ name: folderName, parentFolderId: null });
    setFolderName('');
    await onChanged();
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      await api.uploadDriveFile(file);
      event.target.value = '';
      await onChanged();
    }
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
            <input type="file" onChange={upload} />
          </label>
        </div>
      </Panel>
      <section className="drive-list">
        {folders.map((folder) => (
          <article key={folder.id} className="drive-row">
            <Folder size={18} />
            <span>{folder.name}</span>
            <small>Dossier</small>
          </article>
        ))}
        {files.map((file) => (
          <article key={file.id} className="drive-row">
            <FileText size={18} />
            <span>{file.name}</span>
            <button className="secondary" onClick={() => api.downloadDriveFile(file.id, file.name)} type="button">
              <Download size={15} />
              Ouvrir
            </button>
            <small>{Math.round(file.size / 1024)} Ko</small>
          </article>
        ))}
        {folders.length + files.length === 0 && <EmptyState icon={Folder} title="Aucun document" />}
      </section>
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
  if (!/\d{4}-\d{2}-\d{2}/.test(normalized)) {
    return null;
  }

  const timestamp = Date.parse(normalized);
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
