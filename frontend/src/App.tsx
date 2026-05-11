import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { Bell, Box, BriefcaseBusiness, Download, FileText, Folder, LayoutDashboard, LogOut, Mail, Package, Plus, Search, ShieldCheck, ShoppingCart, Store, Upload, Users, Warehouse as WarehouseIcon } from 'lucide-react';
import { api } from './api/client';
import type { Customer, DashboardSummary, DriveFolder, DriveItem, EmailMessage, Invoice, MailAccount, NotificationItem, PagedResult, PrestashopConnection, PrestashopSyncLog, Product, Quote, SalesOrder, StockItem, Warehouse } from './types';

type ViewKey = 'dashboard' | 'customers' | 'products' | 'quotes' | 'drive' | 'notifications' | 'orders' | 'invoices' | 'stock' | 'emails' | 'prestashop';

const views: Array<{ key: ViewKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { key: 'customers', label: 'Clients', icon: Users },
  { key: 'products', label: 'Produits', icon: Package },
  { key: 'quotes', label: 'Devis', icon: FileText },
  { key: 'orders', label: 'Commandes', icon: ShoppingCart },
  { key: 'invoices', label: 'Factures', icon: FileText },
  { key: 'stock', label: 'Stock', icon: WarehouseIcon },
  { key: 'emails', label: 'Emails', icon: Mail },
  { key: 'prestashop', label: 'PrestaShop', icon: Store },
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
  const [orders, setOrders] = useState<PagedResult<SalesOrder> | null>(null);
  const [invoices, setInvoices] = useState<PagedResult<Invoice> | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [mailAccounts, setMailAccounts] = useState<MailAccount[]>([]);
  const [emailMessages, setEmailMessages] = useState<PagedResult<EmailMessage> | null>(null);
  const [prestashopConnections, setPrestashopConnections] = useState<PrestashopConnection[]>([]);
  const [prestashopLogs, setPrestashopLogs] = useState<PrestashopSyncLog[]>([]);

  async function load(target: ViewKey) {
    setLoading(true);
    setError(null);
    try {
      if (target === 'dashboard') {
        setSummary(await api.summary());
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
        const [nextOrders, nextCustomers] = await Promise.all([api.orders(), api.customers()]);
        setOrders(nextOrders);
        setCustomers(nextCustomers);
      }
      if (target === 'invoices') {
        const [nextInvoices, nextOrders] = await Promise.all([api.invoices(), api.orders()]);
        setInvoices(nextInvoices);
        setOrders(nextOrders);
      }
      if (target === 'stock') {
        const [nextWarehouses, nextStockItems, nextProducts] = await Promise.all([api.warehouses(), api.stockItems(), api.products()]);
        setWarehouses(nextWarehouses);
        setStockItems(nextStockItems);
        setProducts(nextProducts);
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
          <span>Deconnexion</span>
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
        {!loading && view === 'customers' && <Customers items={customers?.items ?? []} onChanged={() => load('customers')} />}
        {!loading && view === 'products' && <Products items={products?.items ?? []} onChanged={() => load('products')} />}
        {!loading && view === 'quotes' && <Quotes items={quotes?.items ?? []} customers={customers?.items ?? []} onChanged={() => load('quotes')} />}
        {!loading && view === 'orders' && <Orders items={orders?.items ?? []} customers={customers?.items ?? []} onChanged={() => load('orders')} />}
        {!loading && view === 'invoices' && <Invoices items={invoices?.items ?? []} orders={orders?.items ?? []} onChanged={() => load('invoices')} />}
        {!loading && view === 'stock' && <Stock items={stockItems} products={products?.items ?? []} warehouses={warehouses} onChanged={() => load('stock')} />}
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

function Orders({ items, customers, onChanged }: { items: SalesOrder[]; customers: Customer[]; onChanged: () => Promise<void> }) {
  const [customerId, setCustomerId] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('0');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const selectedCustomerId = customerId || customers[0]?.id;
    if (!selectedCustomerId) {
      throw new Error('Creer un client avant de creer une commande.');
    }

    await api.createOrder({
      customerId: selectedCustomerId,
      lines: [{ description, quantity: Number(quantity), unitPrice: Number(unitPrice) }]
    });
    setDescription('');
    setQuantity('1');
    setUnitPrice('0');
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
          <input required placeholder="Ligne" value={description} onChange={(event) => setDescription(event.target.value)} />
          <input required type="number" step="0.001" placeholder="Quantite" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          <input required type="number" step="0.01" placeholder="Prix HT" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} />
          <button className="primary" type="submit">
            <Plus size={16} />
            Creer
          </button>
        </form>
      </Panel>
      <DataTable columns={['Numero', 'Client', 'Statut', 'Lignes']} rows={items.map((item) => [item.number, item.customerId, item.status, item.lines.length])} />
    </>
  );
}

function Invoices({ items, orders, onChanged }: { items: Invoice[]; orders: SalesOrder[]; onChanged: () => Promise<void> }) {
  const [orderId, setOrderId] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const selectedOrderId = orderId || orders[0]?.id;
    if (!selectedOrderId) {
      throw new Error('Creer une commande avant de creer une facture.');
    }

    await api.createInvoiceFromOrder(selectedOrderId);
    setOrderId('');
    await onChanged();
  }

  return (
    <>
      <Panel title="Nouvelle facture depuis commande">
        <form className="form-grid" onSubmit={submit}>
          <select value={orderId} onChange={(event) => setOrderId(event.target.value)}>
            <option value="">Commande</option>
            {orders.map((order) => (
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
      <DataTable columns={['Numero', 'Client', 'Statut', 'Total']} rows={items.map((item) => [item.number, item.customerId, item.status, `${item.total.toFixed(2)} EUR`])} />
    </>
  );
}

function Stock({ items, products, warehouses, onChanged }: { items: StockItem[]; products: Product[]; warehouses: Warehouse[]; onChanged: () => Promise<void> }) {
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
      <DataTable columns={['Produit', 'Entrepot', 'Stock', 'Seuil']} rows={items.map((item) => [item.productId, item.warehouseId, item.quantityOnHand, item.alertThreshold])} />
    </>
  );
}

function Emails({ accounts, messages, onChanged }: { accounts: MailAccount[]; messages: EmailMessage[]; onChanged: () => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [imapHost, setImapHost] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    await api.createMailAccount({ email, smtpHost, imapHost });
    setEmail('');
    setSmtpHost('');
    setImapHost('');
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
      <DataTable columns={['Compte', 'SMTP', 'IMAP']} rows={accounts.map((item) => [item.email, item.smtpHost, item.imapHost])} />
      <DataTable columns={['Sujet', 'De', 'A']} rows={messages.map((item) => [item.subject, item.from, item.to])} />
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
