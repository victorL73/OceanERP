import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { Bell, Box, BriefcaseBusiness, Download, FileText, Folder, KeyRound, LayoutDashboard, LogOut, Mail, Package, Plus, Search, Settings as SettingsIcon, ShieldCheck, ShoppingCart, Store, Upload, UserRound, Users, Warehouse as WarehouseIcon } from 'lucide-react';
import { api } from './api/client';
import type { Customer, DashboardSummary, DriveFolder, DriveItem, EmailMessage, Invoice, MailAccount, NotificationItem, PagedResult, Permission, PrestashopConnection, PrestashopSyncLog, Product, Quote, Role, SalesOrder, StockItem, StockMovement, User, Warehouse } from './types';

type ViewKey = 'dashboard' | 'settings' | 'users' | 'customers' | 'products' | 'quotes' | 'drive' | 'notifications' | 'orders' | 'invoices' | 'stock' | 'emails' | 'prestashop';

const navViews: Array<{ key: Exclude<ViewKey, 'settings'>; label: string; icon: typeof LayoutDashboard; permission?: string }> = [
  { key: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, permission: 'dashboard.read' },
  { key: 'users', label: 'Utilisateurs/Roles', icon: ShieldCheck, permission: 'auth.users.read' },
  { key: 'customers', label: 'Clients', icon: Users, permission: 'customers.read' },
  { key: 'products', label: 'Produits', icon: Package, permission: 'products.read' },
  { key: 'quotes', label: 'Devis', icon: FileText, permission: 'quotes.read' },
  { key: 'orders', label: 'Commandes', icon: ShoppingCart, permission: 'orders.read' },
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
  users: 'Utilisateurs/Roles',
  customers: 'Clients',
  products: 'Produits',
  quotes: 'Devis',
  orders: 'Commandes',
  invoices: 'Factures',
  stock: 'Stock',
  emails: 'Emails',
  prestashop: 'PrestaShop',
  drive: 'Drive',
  notifications: 'Notifications'
};

function hasPermission(user: User | null, permission?: string) {
  return !permission || !user || user.roles.includes('Administrator') || user.permissions.includes(permission);
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
  const [invoices, setInvoices] = useState<PagedResult<Invoice> | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [mailAccounts, setMailAccounts] = useState<MailAccount[]>([]);
  const [emailMessages, setEmailMessages] = useState<PagedResult<EmailMessage> | null>(null);
  const [prestashopConnections, setPrestashopConnections] = useState<PrestashopConnection[]>([]);
  const [prestashopLogs, setPrestashopLogs] = useState<PrestashopSyncLog[]>([]);
  const visibleViews = useMemo(() => navViews.filter((item) => hasPermission(currentUser, item.permission)), [currentUser]);

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
        setCurrentUser(await api.me());
      }
      if (target === 'users') {
        const [nextUsers, nextRoles, nextPermissions] = await Promise.all([api.users(), api.roles(), api.permissions()]);
        setUsers(nextUsers);
        setRoles(nextRoles);
        setPermissions(nextPermissions);
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
      if (target === 'invoices') {
        const [nextInvoices, nextOrders] = await Promise.all([api.invoices(), api.orders()]);
        setInvoices(nextInvoices);
        setOrders(nextOrders);
      }
      if (target === 'stock') {
        const [nextWarehouses, nextStockItems, nextProducts, nextMovements] = await Promise.all([api.warehouses(), api.stockItems(), api.products(), api.stockMovements()]);
        setWarehouses(nextWarehouses);
        setStockItems(nextStockItems);
        setProducts(nextProducts);
        setStockMovements(nextMovements);
      }
      if (target === 'emails') {
        const [nextAccounts, nextMessages] = await Promise.all([api.mailAccounts(), api.emailMessages()]);
        setMailAccounts(nextAccounts);
        setEmailMessages(nextMessages);
      }
      if (target === 'prestashop') {
        const [nextConnections, nextLogs] = await Promise.all([api.prestashopConnections(), api.prestashopLogs()]);
        setPrestashopConnections(nextConnections);
        setPrestashopLogs(nextLogs);
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
        {!loading && view === 'settings' && <Settings currentUser={currentUser} onUserChanged={setCurrentUser} onSignedOut={() => { api.logout(); setCurrentUser(null); setAuthenticated(false); }} />}
        {!loading && view === 'users' && <UsersRoles users={users} roles={roles} permissions={permissions} onChanged={() => load('users')} />}
        {!loading && view === 'customers' && <Customers items={customers?.items ?? []} onChanged={() => load('customers')} />}
        {!loading && view === 'products' && <Products items={products?.items ?? []} onChanged={() => load('products')} />}
        {!loading && view === 'quotes' && <Quotes items={quotes?.items ?? []} customers={customers?.items ?? []} onChanged={() => load('quotes')} />}
        {!loading && view === 'orders' && <Orders items={orders?.items ?? []} customers={customers?.items ?? []} products={products?.items ?? []} warehouses={warehouses} onChanged={() => load('orders')} />}
        {!loading && view === 'invoices' && <Invoices items={invoices?.items ?? []} orders={orders?.items ?? []} onChanged={() => load('invoices')} />}
        {!loading && view === 'stock' && <Stock items={stockItems} movements={stockMovements} products={products?.items ?? []} warehouses={warehouses} onChanged={() => load('stock')} />}
        {!loading && view === 'emails' && <Emails accounts={mailAccounts} messages={emailMessages?.items ?? []} onChanged={() => load('emails')} />}
        {!loading && view === 'prestashop' && <Prestashop connections={prestashopConnections} logs={prestashopLogs} onChanged={() => load('prestashop')} />}
        {!loading && view === 'drive' && <Drive folders={folders} files={files} onChanged={() => load('drive')} />}
        {!loading && view === 'notifications' && <Notifications items={notifications} />}
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

function Settings({ currentUser, onUserChanged, onSignedOut }: { currentUser: User | null; onUserChanged: (user: User) => void; onSignedOut: () => void }) {
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

  return (
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
  );
}

function UsersRoles({ users, roles, permissions, onChanged }: { users: User[]; roles: Role[]; permissions: Permission[]; onChanged: () => Promise<void> }) {
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

      <DataTable columns={['Email', 'Nom', 'Roles', 'Statut']} rows={users.map((user) => [user.email, user.displayName, user.roles.join(', '), user.isActive ? 'Actif' : 'Inactif'])} />
      <DataTable columns={['Role', 'Description', 'Permissions']} rows={roles.map((role) => [role.name, role.description, role.permissions.length])} />
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
  const [salePrice, setSalePrice] = useState('0');
  const [purchasePrice, setPurchasePrice] = useState('0');
  const [vatRate, setVatRate] = useState('20');

  async function submit(event: FormEvent) {
    event.preventDefault();
    await api.createProduct({
      reference,
      name,
      purchasePrice: Number(purchasePrice),
      salePrice: Number(salePrice),
      vatRate: Number(vatRate)
    });
    setReference('');
    setName('');
    setSalePrice('0');
    setPurchasePrice('0');
    setVatRate('20');
    await onChanged();
  }

  return (
    <>
      <Panel title="Nouveau produit">
        <form className="form-grid" onSubmit={submit}>
          <input required placeholder="Reference" value={reference} onChange={(event) => setReference(event.target.value)} />
          <input required placeholder="Designation" value={name} onChange={(event) => setName(event.target.value)} />
          <input required type="number" step="0.01" placeholder="Prix achat" value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value)} />
          <input required type="number" step="0.01" placeholder="Prix vente" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} />
          <input required type="number" step="0.01" placeholder="TVA" value={vatRate} onChange={(event) => setVatRate(event.target.value)} />
          <button className="primary" type="submit">
            <Plus size={16} />
            Creer
          </button>
        </form>
      </Panel>
      <DataTable columns={['Reference', 'Designation', 'Prix vente', 'TVA']} rows={items.map((item) => [item.reference, item.name, `${item.salePrice.toFixed(2)} EUR`, `${item.vatRate}%`])} />
    </>
  );
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

function Stock({ items, movements, products, warehouses, onChanged }: { items: StockItem[]; movements: StockMovement[]; products: Product[]; warehouses: Warehouse[]; onChanged: () => Promise<void> }) {
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [alertThreshold, setAlertThreshold] = useState('0');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const selectedProductId = productId || products[0]?.id;
    const selectedWarehouseId = warehouseId || warehouses[0]?.id;
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
      <DataTable columns={['Produit', 'Entrepot', 'Stock', 'Reserve', 'Disponible', 'Seuil']} rows={items.map((item) => [item.productId, item.warehouseId, item.quantityOnHand, item.quantityReserved, item.availableQuantity, item.isLowStock ? `Bas (${item.alertThreshold})` : item.alertThreshold])} />
      <DataTable columns={['Produit', 'Type', 'Quantite', 'Motif', 'Date']} rows={movements.map((item) => [item.productId, item.type, item.quantity, item.reason, item.createdAt])} />
    </>
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
  const [shopUrl, setShopUrl] = useState('');
  const [apiKeySecretName, setApiKeySecretName] = useState('PRESTASHOP_API_KEY');

  async function submit(event: FormEvent) {
    event.preventDefault();
    await api.createPrestashopConnection({ shopUrl, apiKeySecretName });
    setShopUrl('');
    await onChanged();
  }

  async function sync(connection: PrestashopConnection) {
    await api.runPrestashopSync(connection.id);
    await onChanged();
  }

  return (
    <>
      <Panel title="Connexion PrestaShop">
        <form className="form-grid" onSubmit={submit}>
          <input required placeholder="URL boutique" value={shopUrl} onChange={(event) => setShopUrl(event.target.value)} />
          <input required placeholder="Nom secret cle API" value={apiKeySecretName} onChange={(event) => setApiKeySecretName(event.target.value)} />
          <button className="primary" type="submit">
            <Plus size={16} />
            Ajouter
          </button>
        </form>
      </Panel>
      <DataTable
        columns={['Boutique', 'Secret', 'Statut', 'Sync']}
        rows={connections.map((item) => [
          item.shopUrl,
          item.apiKeySecretName,
          item.isActive ? 'Actif' : 'Inactif',
          <button className="secondary" type="button" onClick={() => sync(item)}>
            Synchroniser
          </button>
        ])}
      />
      <DataTable columns={['Connexion', 'Statut', 'Date']} rows={logs.map((item) => [item.prestashopConnectionId, item.status, item.createdAt])} />
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

function Notifications({ items }: { items: NotificationItem[] }) {
  return (
    <section className="notification-list">
      {items.map((item) => (
        <article key={item.id} className={item.isRead ? 'notification read' : 'notification'}>
          <Bell size={18} />
          <div>
            <strong>{item.title}</strong>
            <p>{item.message}</p>
          </div>
        </article>
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

function DataTable({ columns, rows }: { columns: string[]; rows: Array<Array<ReactNode>> }) {
  return (
    <section className="table-surface">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
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

function EmptyState({ icon: Icon, title }: { icon: typeof Box; title: string }) {
  return (
    <div className="empty-state">
      <Icon size={28} />
      <strong>{title}</strong>
    </div>
  );
}
