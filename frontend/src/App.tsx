import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { Bell, Box, BriefcaseBusiness, FileText, Folder, LayoutDashboard, LogOut, Package, Search, ShieldCheck, Users } from 'lucide-react';
import { api } from './api/client';
import type { Customer, DashboardSummary, DriveFolder, DriveItem, NotificationItem, PagedResult, Product, Quote } from './types';

type ViewKey = 'dashboard' | 'customers' | 'products' | 'quotes' | 'drive' | 'notifications';

const views: Array<{ key: ViewKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { key: 'customers', label: 'Clients', icon: Users },
  { key: 'products', label: 'Produits', icon: Package },
  { key: 'quotes', label: 'Devis', icon: FileText },
  { key: 'drive', label: 'Drive', icon: Folder },
  { key: 'notifications', label: 'Notifications', icon: Bell }
];

export default function App() {
  const [isAuthenticated, setAuthenticated] = useState(Boolean(api.token));
  const [view, setView] = useState<ViewKey>('dashboard');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [customers, setCustomers] = useState<PagedResult<Customer> | null>(null);
  const [products, setProducts] = useState<PagedResult<Product> | null>(null);
  const [quotes, setQuotes] = useState<PagedResult<Quote> | null>(null);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [files, setFiles] = useState<DriveItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

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
    if (!isAuthenticated) {
      return;
    }

    setLoading(true);
    setError(null);

    const loaders: Record<ViewKey, () => Promise<unknown>> = {
      dashboard: async () => setSummary(await api.summary()),
      customers: async () => setCustomers(await api.customers()),
      products: async () => setProducts(await api.products()),
      quotes: async () => setQuotes(await api.quotes()),
      drive: async () => {
        const [nextFolders, nextFiles] = await Promise.all([api.folders(), api.files()]);
        setFolders(nextFolders);
        setFiles(nextFiles);
      },
      notifications: async () => setNotifications(await api.notifications())
    };

    loaders[view]()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isAuthenticated, view]);

  if (!isAuthenticated) {
    return <Login onLoggedIn={() => setAuthenticated(true)} />;
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
          {views.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.key} className={view === item.key ? 'active' : ''} onClick={() => setView(item.key)}>
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <button
          className="logout"
          onClick={() => {
            api.logout();
            setAuthenticated(false);
          }}
        >
          <LogOut size={18} />
          <span>Déconnexion</span>
        </button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">ERP modulaire</p>
            <h1>{views.find((item) => item.key === view)?.label}</h1>
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
        {!loading && view === 'customers' && <Customers items={customers?.items ?? []} />}
        {!loading && view === 'products' && <Products items={products?.items ?? []} />}
        {!loading && view === 'quotes' && <Quotes items={quotes?.items ?? []} />}
        {!loading && view === 'drive' && <Drive folders={folders} files={files} />}
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
            <span>Accès sécurisé</span>
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
      ['CA du mois', summary?.monthlyRevenue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) ?? '0 €'],
      ['Devis en attente', summary?.pendingQuotes ?? 0],
      ['Factures impayées', summary?.unpaidInvoices ?? 0],
      ['Commandes en cours', summary?.openOrders ?? 0],
      ['Stock bas', summary?.lowStockItems ?? 0],
      ['SAV ouverts', summary?.openServiceTickets ?? 0],
      ['Nouveaux emails', summary?.newEmails ?? 0],
      ['Documents récents', summary?.recentDocuments ?? 0]
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

function Customers({ items }: { items: Customer[] }) {
  return <DataTable columns={['Code', 'Société', 'TVA', 'Statut']} rows={items.map((item) => [item.code, item.companyName, item.vatNumber ?? '-', item.isActive ? 'Actif' : 'Inactif'])} />;
}

function Products({ items }: { items: Product[] }) {
  return <DataTable columns={['Référence', 'Désignation', 'Prix vente', 'TVA']} rows={items.map((item) => [item.reference, item.name, `${item.salePrice.toFixed(2)} €`, `${item.vatRate}%`])} />;
}

function Quotes({ items }: { items: Quote[] }) {
  return <DataTable columns={['Numéro', 'Client', 'Statut', 'Total TTC']} rows={items.map((item) => [item.number, item.customerName ?? item.customerId, item.status, `${item.total.toFixed(2)} ${item.currency}`])} />;
}

function Drive({ folders, files }: { folders: DriveFolder[]; files: DriveItem[] }) {
  return (
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
          <small>{Math.round(file.size / 1024)} Ko</small>
        </article>
      ))}
      {folders.length + files.length === 0 && <EmptyState icon={Folder} title="Aucun document" />}
    </section>
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

function DataTable({ columns, rows }: { columns: string[]; rows: Array<Array<string | number>> }) {
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
      {rows.length === 0 && <EmptyState icon={BriefcaseBusiness} title="Aucune donnée" />}
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
