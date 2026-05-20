import { type ChangeEvent, type DragEvent, type FormEvent, type PointerEvent, type ReactNode, isValidElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { ArrowDownAZ, ArrowUpAZ, Bell, BookOpen, Box, BriefcaseBusiness, CalendarDays, Camera, CameraOff, CheckSquare, ChevronLeft, ChevronRight, Clock, Code2, Copy, Download, FilePlus2, FileSignature, FileText, Folder, FolderTree, Forward, Grid2X2, Image as ImageIcon, KanbanSquare, KeyRound, Languages, LayoutDashboard, LifeBuoy, Link2, List, ListTodo, LogOut, Mail, Mic, MicOff, Minus, Moon, Package, Paperclip, Pencil, PhoneOff, Plus, Printer, Quote as QuoteIcon, Reply, ReplyAll, Save, ScreenShare, Search, Settings as SettingsIcon, ShieldCheck, ShoppingBag, ShoppingCart, Star, Store, Sun, Table2, Trash2, Upload, UserRound, Users, Video, Warehouse as WarehouseIcon, X } from 'lucide-react';
import { api } from './api/client';
import type { AuditLog, BackupArchive, BackupOperationResult, BackupRemoteStorage, BackupSchedule, CalendarEvent, Customer, DashboardSummary, DocumentLink, DriveFolder, DriveItem, EmailDistributionList, EmailMessage, EmailSyncSummary, EmailTemplate, FlowceanWorkspace, FlowceanWorkspaceSummary, Invoice, MailAccount, MailServerSettings, MeetingDashboard, MeetingParticipant, MeetingRoomState, MeetingSignal, NotificationItem, OnlyOfficeConfig, PagedResult, Permission, PrestashopConnection, PrestashopSyncLog, Product, ProductSupplier, PublicSignature, PurchaseOrder, Quote, QuoteSettings, Role, SalesOrder, ServiceTicket, ServiceTicketAssignmentSettings, SignatureRequest, StockItem, StockMovement, User, Warehouse } from './types';

type ViewKey = 'dashboard' | 'settings' | 'customers' | 'products' | 'quotes' | 'drive' | 'notifications' | 'orders' | 'purchases' | 'invoices' | 'stock' | 'emails' | 'prestashop' | 'service' | 'calendar' | 'meetings' | 'signatures' | 'flowcean' | 'backups';

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
  { key: 'service', label: 'SAV', icon: LifeBuoy, permission: 'service.read' },
  { key: 'calendar', label: 'Agenda', icon: CalendarDays, permission: 'calendar.read' },
  { key: 'meetings', label: 'Meet', icon: Video, permission: 'meet.read' },
  { key: 'signatures', label: 'Signatures', icon: FileSignature, permission: 'signatures.read' },
  { key: 'flowcean', label: 'Espace', icon: BriefcaseBusiness, permission: 'flowcean.read' },
  { key: 'drive', label: 'Drive', icon: Folder, permission: 'drive.read' },
  { key: 'backups', label: 'Sauvegardes', icon: Download, permission: 'backup.read' },
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
  service: 'SAV',
  calendar: 'Agenda',
  meetings: 'Meet',
  signatures: 'Signatures',
  flowcean: 'Espace de travail',
  backups: 'Sauvegardes',
  drive: 'Drive',
  notifications: 'Notifications'
};

const appViewKeys: readonly ViewKey[] = ['dashboard', 'settings', 'customers', 'products', 'quotes', 'drive', 'notifications', 'orders', 'purchases', 'invoices', 'stock', 'emails', 'service', 'calendar', 'meetings', 'signatures', 'flowcean', 'backups'];
const EMAIL_JOURNAL_AUTO_REFRESH_MS = 15000;

function readStoredChoice<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const value = localStorage.getItem(key);
    return value && (allowed as readonly string[]).includes(value) ? value as T : fallback;
  } catch {
    return fallback;
  }
}

function storeChoice(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Le stockage local peut etre bloque par la politique du navigateur.
  }
}

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

function readPublicSignatureToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  const match = window.location.pathname.match(/^\/signature\/([^/]+)$/i);
  return match ? decodeURIComponent(match[1]) : null;
}

function readPublicMeetToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  const token = new URLSearchParams(window.location.search).get('meet');
  return token?.trim() || null;
}

type PrestashopSyncCompletedEvent = {
  connectionId: string;
  shopUrl: string;
  status: string;
  message: string;
  resources: Array<{ resource: string; created: number; updated: number }>;
};

export default function App() {
  const publicSignatureToken = useMemo(readPublicSignatureToken, []);
  const publicMeetToken = useMemo(readPublicMeetToken, []);
  const [isAuthenticated, setAuthenticated] = useState(Boolean(api.token));
  const [view, setView] = useState<ViewKey>(() => readStoredChoice('oceanerp.activeView', 'dashboard', appViewKeys));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(api.user);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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
  const [emailDistributionLists, setEmailDistributionLists] = useState<EmailDistributionList[]>([]);
  const [prestashopConnections, setPrestashopConnections] = useState<PrestashopConnection[]>([]);
  const [prestashopLogs, setPrestashopLogs] = useState<PrestashopSyncLog[]>([]);
  const [serviceTickets, setServiceTickets] = useState<PagedResult<ServiceTicket> | null>(null);
  const [serviceAssignmentSettings, setServiceAssignmentSettings] = useState<ServiceTicketAssignmentSettings | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<PagedResult<CalendarEvent> | null>(null);
  const [meetingDashboard, setMeetingDashboard] = useState<MeetingDashboard | null>(null);
  const [meetingInitialRoomId, setMeetingInitialRoomId] = useState<string | null>(null);
  const [signatureRequests, setSignatureRequests] = useState<PagedResult<SignatureRequest> | null>(null);
  const [backups, setBackups] = useState<BackupArchive[]>([]);
  const [stockFocusProductIds, setStockFocusProductIds] = useState<string[]>([]);
  const [serviceTicketCreateOpen, setServiceTicketCreateOpen] = useState(false);
  const visibleViews = useMemo(() => navViews.filter((item) => hasPermission(currentUser, item.permission)), [currentUser]);

  async function refreshPrestashopData() {
    const [nextConnections, nextLogs] = await Promise.all([api.prestashopConnections(), api.prestashopLogs()]);
    setPrestashopConnections(nextConnections);
    setPrestashopLogs(nextLogs);
  }

  async function refreshAfterPrestashopRealtimeSync(syncEvent: PrestashopSyncCompletedEvent) {
    const resources = new Set(syncEvent.resources.map((item) => item.resource));
    const tasks: Promise<unknown>[] = [
      refreshPrestashopData().catch(() => undefined),
      api.summary().then(setSummary).catch(() => undefined)
    ];

    if (resources.has('products')) {
      tasks.push(api.products().then(setProducts).catch(() => undefined));
    }

    if (resources.has('customers')) {
      tasks.push(api.customers().then(setCustomers).catch(() => undefined));
    }

    if (resources.has('stock_availables')) {
      tasks.push(api.stockItems().then(setStockItems).catch(() => undefined));
      tasks.push(api.stockMovements().then(setStockMovements).catch(() => undefined));
      tasks.push(api.products().then(setProducts).catch(() => undefined));
    }

    if (resources.has('orders')) {
      tasks.push(api.orders().then(setOrders).catch(() => undefined));
      tasks.push(api.stockItems().then(setStockItems).catch(() => undefined));
    }

    if (resources.has('customer_threads')) {
      tasks.push(api.serviceTickets().then(setServiceTickets).catch(() => undefined));
    }

    await Promise.all(tasks);
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
          const [nextConnections, nextLogs] = await Promise.all([api.prestashopConnections(), api.prestashopLogs()]);
          setPrestashopConnections(nextConnections);
          setPrestashopLogs(nextLogs);
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
        if (hasPermission(user, 'auth.users.write') && hasPermission(user, 'service.write')) {
          setServiceAssignmentSettings(await api.serviceTicketAssignmentSettings());
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
        const nextFiles = await api.files();
        const nextFolders = await api.folders();
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
        const [nextAccounts, nextMessages, nextTemplates, nextLists, nextCustomers] = await Promise.all([
          api.mailAccounts(),
          api.emailMessages(),
          api.emailTemplates(),
          api.emailDistributionLists(),
          hasPermission(currentUser, 'customers.read') ? api.customers('', 1, 100) : Promise.resolve<PagedResult<Customer> | null>(null)
        ]);
        setMailAccounts(nextAccounts);
        setEmailMessages(nextMessages);
        setEmailTemplates(nextTemplates);
        setEmailDistributionLists(nextLists);
        setCustomers(nextCustomers);
      }
      if (target === 'prestashop') {
        await refreshPrestashopData();
      }
      if (target === 'service') {
        const [nextTickets, nextCustomers, nextProducts, nextOrders, nextUsers] = await Promise.all([
          api.serviceTickets(),
          api.customers(),
          api.products(),
          api.orders(),
          hasPermission(currentUser, 'auth.users.read') ? api.users() : Promise.resolve(users)
        ]);
        setServiceTickets(nextTickets);
        setCustomers(nextCustomers);
        setProducts(nextProducts);
        setOrders(nextOrders);
        setUsers(nextUsers);
      }
      if (target === 'calendar') {
        setCalendarEvents(await api.calendarEvents());
      }
      if (target === 'meetings') {
        setMeetingDashboard(await api.meetingDashboard());
      }
      if (target === 'signatures') {
        const [nextSignatures, nextFiles, nextQuotes] = await Promise.all([
          api.signatureRequests(),
          api.files(null, 'pdf'),
          hasPermission(currentUser, 'quotes.read') ? api.quotes() : Promise.resolve(quotes)
        ]);
        setSignatureRequests(nextSignatures);
        setFiles(nextFiles);
        setQuotes(nextQuotes);
      }
      if (target === 'flowcean') {
        await api.flowceanWorkspaces();
      }
      if (target === 'backups') {
        setBackups(await api.backups());
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
      } else if (link.pathname === '/orders') {
        setView('orders');
      } else if (link.pathname === '/service') {
        setView('service');
      } else if (link.pathname === '/calendar') {
        setView('calendar');
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
    function handleFlowceanMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.data?.type !== 'oceanerp:logout') {
        return;
      }

      api.logout();
      setCurrentUser(null);
      setAuthenticated(false);
    }

    window.addEventListener('message', handleFlowceanMessage);
    return () => window.removeEventListener('message', handleFlowceanMessage);
  }, []);

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
      setNotifications((items) => [notification, ...items.filter((item) => item.id !== notification.id)]);
      if (notification.type === 'emails.new') {
        api.emailMessages()
          .then(setEmailMessages)
          .catch(() => undefined);
        api.summary()
          .then(setSummary)
          .catch(() => undefined);
      } else if (notification.type === 'prestashop.orders.new') {
        api.orders()
          .then(setOrders)
          .catch(() => undefined);
        api.summary()
          .then(setSummary)
          .catch(() => undefined);
      } else if (notification.type.startsWith('service.')) {
        api.serviceTickets()
          .then(setServiceTickets)
          .catch(() => undefined);
        api.summary()
          .then(setSummary)
          .catch(() => undefined);
      } else if (notification.type === 'calendar.reminder') {
        api.calendarEvents()
          .then(setCalendarEvents)
          .catch(() => undefined);
      }
    });

    connection.on('prestashopSyncCompleted', (syncEvent: PrestashopSyncCompletedEvent) => {
      void refreshAfterPrestashopRealtimeSync(syncEvent);
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
      .map((item) => ({ item, seenKey: `${item.id}:${item.createdAt}` }))
      .filter(({ item, seenKey }) => !item.isRead && !seen.has(seenKey))
      .slice(0, 5)
      .forEach(({ item, seenKey }) => {
        new Notification(item.title, { body: item.message, tag: seenKey });
        nextSeen.add(seenKey);
      });
    localStorage.setItem(storageKey, Array.from(nextSeen).slice(-200).join(','));
  }, [isAuthenticated, notifications]);

  useEffect(() => {
    if (isAuthenticated) {
      load(view);
    }
  }, [isAuthenticated, view]);

  useEffect(() => {
    storeChoice('oceanerp.activeView', view);
  }, [view]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [view]);

  if (publicSignatureToken) {
    return <PublicSignaturePage token={publicSignatureToken} />;
  }

  if (!isAuthenticated && publicMeetToken) {
    return <PublicMeetPage token={publicMeetToken} />;
  }

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
    <div className={mobileNavOpen ? 'app-shell nav-open' : 'app-shell'}>
      <button
        className="mobile-nav-backdrop"
        type="button"
        aria-label="Fermer le menu"
        onClick={() => setMobileNavOpen(false)}
      />
      <aside className="sidebar">
        <div className="sidebar-head">
          <div className="brand">
            <div className="brand-mark">OE</div>
            <div>
              <strong>OceanERP</strong>
              <span>Gestion commerciale</span>
            </div>
          </div>
          <button className="sidebar-close" type="button" aria-label="Fermer le menu" onClick={() => setMobileNavOpen(false)}>
            <X size={18} />
          </button>
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

      <main className={view === 'flowcean' ? 'workspace workspace-flowcean' : 'workspace'}>
        {view === 'flowcean' && (
          <button className="mobile-menu-button flowcean-mobile-menu" type="button" aria-label="Ouvrir le menu" onClick={() => setMobileNavOpen(true)}>
            <List size={19} />
          </button>
        )}
        {view !== 'flowcean' && (
          <header className="topbar">
            <div className="topbar-title">
              <button className="mobile-menu-button" type="button" aria-label="Ouvrir le menu" onClick={() => setMobileNavOpen(true)}>
                <List size={19} />
              </button>
              <div>
                <p className="eyebrow">ERP modulaire</p>
                <h1>{viewLabels[view]}</h1>
              </div>
            </div>
            <div className="top-actions">
              {view === 'service' && (
                <button className="primary topbar-action-button" type="button" onClick={() => setServiceTicketCreateOpen(true)}>
                  <Plus size={16} />
                  Nouveau ticket
                </button>
              )}
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
        )}

        {error && <div className="alert">{error}</div>}
        {loading && <div className="loading">Chargement...</div>}

        {view === 'dashboard' && <Dashboard summary={summary} />}
        {view === 'settings' && (
          <Settings
            currentUser={currentUser}
            users={users}
            roles={roles}
            permissions={permissions}
            auditLogs={auditLogs}
            prestashopConnections={prestashopConnections}
            prestashopLogs={prestashopLogs}
            warehouses={warehouses}
            mailAccounts={mailAccounts}
            mailServerSettings={mailServerSettings}
            quoteSettings={quoteSettings}
            serviceAssignmentSettings={serviceAssignmentSettings}
            onUsersRolesChanged={() => load('settings')}
            onPrestashopChanged={() => load('settings')}
            onPrestashopSyncChanged={refreshPrestashopData}
            onWarehousesChanged={() => load('settings')}
            onMailAccountsChanged={() => load('settings')}
            onMailServerSettingsChanged={() => load('settings')}
            onQuoteSettingsChanged={() => load('settings')}
            onServiceSettingsChanged={() => load('settings')}
            onUserChanged={setCurrentUser}
            onSignedOut={() => {
              api.logout();
              setCurrentUser(null);
              setAuthenticated(false);
            }}
          />
        )}
        {view === 'customers' && <Customers items={customers?.items ?? []} onChanged={() => load('customers')} />}
        {view === 'products' && <Products items={products?.items ?? []} onChanged={() => load('products')} />}
        {view === 'quotes' && <Quotes items={quotes?.items ?? []} customers={customers?.items ?? []} products={products?.items ?? []} mailAccounts={mailAccounts} warehouses={warehouses} isAdministrator={Boolean(currentUser?.roles.includes('Administrator'))} onChanged={() => load('quotes')} />}
        {view === 'orders' && <Orders items={orders?.items ?? []} customers={customers?.items ?? []} warehouses={warehouses} isAdministrator={Boolean(currentUser?.roles.includes('Administrator'))} onChanged={() => load('orders')} />}
        {view === 'purchases' && <Purchases items={purchaseOrders?.items ?? []} suppliers={productSuppliers} products={products?.items ?? []} warehouses={warehouses} stockItems={stockItems} onChanged={() => load('purchases')} />}
        {view === 'invoices' && <Invoices items={invoices?.items ?? []} orders={orders?.items ?? []} onChanged={() => load('invoices')} />}
        {view === 'stock' && <Stock items={stockItems} movements={stockMovements} products={products?.items ?? []} warehouses={warehouses} purchaseOrders={purchaseOrders?.items ?? []} focusedProductIds={stockFocusProductIds} onClearFocusedProducts={() => setStockFocusProductIds([])} prestashopConnections={prestashopConnections} onChanged={() => load('stock')} />}
        {view === 'emails' && <Emails accounts={mailAccounts} messages={emailMessages?.items ?? []} templates={emailTemplates} distributionLists={emailDistributionLists} customers={customers?.items ?? []} onChanged={() => load('emails')} />}
        {view === 'service' && <ServiceTickets items={serviceTickets?.items ?? []} customers={customers?.items ?? []} products={products?.items ?? []} orders={orders?.items ?? []} users={users} createOpen={serviceTicketCreateOpen} onCloseCreate={() => setServiceTicketCreateOpen(false)} onChanged={() => load('service')} />}
        {view === 'calendar' && (
          <Calendar
            events={calendarEvents?.items ?? []}
            canCreateMeetingRoom={hasPermission(currentUser, 'meet.write')}
            onChanged={() => load('calendar')}
            onOpenMeeting={(roomId) => {
              setMeetingInitialRoomId(roomId);
              setView('meetings');
            }}
          />
        )}
        {view === 'meetings' && (
          <Meet
            dashboard={meetingDashboard}
            currentUser={currentUser}
            initialRoomId={meetingInitialRoomId}
            onInitialRoomOpened={() => setMeetingInitialRoomId(null)}
            onChanged={() => load('meetings')}
          />
        )}
        {view === 'signatures' && <Signatures requests={signatureRequests?.items ?? []} files={files} quotes={quotes?.items ?? []} onChanged={() => load('signatures')} />}
        {view === 'flowcean' && <FlowceanDirectModule />}
        {view === 'drive' && <Drive folders={folders} files={files} onChanged={() => load('drive')} />}
        {view === 'backups' && <Backups archives={backups} onChanged={() => load('backups')} />}
        {view === 'notifications' && <Notifications items={notifications} onOpen={openNotification} />}
      </main>
    </div>
  );
}

function FlowceanDirectModule() {
  return (
    <section className="flowcean-direct-shell">
      <iframe className="flowcean-direct-frame" title="Espace Flowcean" src="/flowcean/index.html" />
    </section>
  );
}

function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const submittedEmail = String(formData.get('username') ?? email).trim();
    const submittedPassword = String(formData.get('password') ?? password);
    try {
      await api.login(submittedEmail, submittedPassword);
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
        <form onSubmit={submit} autoComplete="on">
          <label>
            Email
            <input
              id="login-email"
              name="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="username"
              placeholder="Email"
              required
            />
          </label>
          <label>
            Mot de passe
            <input
              id="login-password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              placeholder="Mot de passe"
              required
            />
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

function PublicSignaturePage({ token }: { token: string }) {
  const [signature, setSignature] = useState<PublicSignature | null>(null);
  const [conditionsAccepted, setConditionsAccepted] = useState(false);
  const [signatureMode, setSignatureMode] = useState<'Click' | 'Drawn'>('Drawn');
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signatureDirty, setSignatureDirty] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    api.publicSignature(token)
      .then((next) => {
        setSignature(next);
        setSignerName(next.signerName ?? '');
        setSignerEmail(next.signerEmail ?? '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Lien de signature invalide'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!loading) {
      setTimeout(() => resetSignatureCanvas(false), 0);
    }
  }, [loading, signatureMode]);

  function pointerPosition(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function startDrawing(event: PointerEvent<HTMLCanvasElement>) {
    if (signatureMode !== 'Drawn') {
      return;
    }

    const canvas = event.currentTarget;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    setSignatureDirty(true);
    const point = pointerPosition(event);
    isDrawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current || signatureMode !== 'Drawn') {
      return;
    }

    const context = event.currentTarget.getContext('2d');
    if (!context) {
      return;
    }

    const point = pointerPosition(event);
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.strokeStyle = '#0f172a';
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function stopDrawing(event: PointerEvent<HTMLCanvasElement>) {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function clearDrawing() {
    resetSignatureCanvas(true);
  }

  function resetSignatureCanvas(markClean: boolean) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (markClean) {
      setSignatureDirty(false);
    }
  }

  async function accept(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (signatureMode === 'Drawn' && !signatureDirty) {
        setError('La signature dessinee est obligatoire ou choisissez la signature par clic.');
        return;
      }

      const drawnSignatureDataUrl = signatureMode === 'Drawn' ? canvasRef.current?.toDataURL('image/png') ?? null : null;
      await api.acceptPublicSignature(token, {
        conditionsAccepted,
        signatureMode,
        drawnSignatureDataUrl,
        otpCode: signature?.requiresOtp ? otpCode.trim() : null,
        signerName: signerName.trim() || null,
        signerEmail: signerEmail.trim() || null
      });
      const next = await api.publicSignature(token);
      setSuccess('Document signe. La preuve de signature a ete enregistree.');
      setSignature(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signature impossible');
    }
  }

  const publicDocumentUrl = signature
    ? api.publicSignatureDocumentUrl(token, signature.status === 'Signed' || signature.status === 'Completed')
    : '';
  const canSign = Boolean(signature && signature.status !== 'Signed' && signature.status !== 'Completed' && signature.status !== 'Revoked' && signature.status !== 'Expired');

  return (
    <main className="public-signature-screen">
      <header className="public-signature-topbar">
        <div className="brand large">
          <div className="brand-mark">OE</div>
          <div>
            <strong>OceanERP</strong>
            <span>Signature securisee</span>
          </div>
        </div>
        {signature && <span className={canSign ? 'status-badge' : 'status-badge signed'}>{signature.status}</span>}
      </header>

      <section className="public-signature-layout">
        <div className="public-document-panel">
          {loading && <EmptyState icon={FileSignature} title="Chargement du document" />}
          {!loading && publicDocumentUrl && <iframe title="Document a signer" src={publicDocumentUrl} />}
          {!loading && !publicDocumentUrl && <EmptyState icon={FileSignature} title="Document introuvable" />}
        </div>

        <aside className="public-signature-panel">
        {loading && <EmptyState icon={FileSignature} title="Chargement de la demande de signature" />}
        {!loading && signature && (
          <form onSubmit={accept}>
            <div className="signature-public-summary">
              <p className="eyebrow">Document a signer</p>
              <h1>{signature.title}</h1>
              <div className="detail-grid">
                <DetailItem label="Fichier" value={signature.fileName} />
                <DetailItem label="Expiration" value={new Date(signature.expiresAt).toLocaleString('fr-FR')} />
                <DetailItem label="Statut" value={signature.status} />
              </div>
            </div>

            <label>
              Nom du signataire
              <input value={signerName} onChange={(event) => setSignerName(event.target.value)} disabled={!canSign} autoComplete="name" />
            </label>

            <label>
              Email
              <input value={signerEmail} onChange={(event) => setSignerEmail(event.target.value)} disabled={!canSign} type="email" autoComplete="email" />
            </label>

            <label className="checkbox-label">
              <input type="checkbox" checked={conditionsAccepted} disabled={!canSign} onChange={(event) => setConditionsAccepted(event.target.checked)} />
              <span>J'accepte les conditions de signature et confirme mon accord sur ce document.</span>
            </label>

            <div className="signature-mode">
              <button className={signatureMode === 'Drawn' ? 'primary' : 'secondary'} type="button" disabled={!canSign} onClick={() => setSignatureMode('Drawn')}>Dessiner</button>
              <button className={signatureMode === 'Click' ? 'primary' : 'secondary'} type="button" disabled={!canSign} onClick={() => setSignatureMode('Click')}>Signer par clic</button>
            </div>

            {signature.requiresOtp && (
              <label>
                Code OTP recu par email
                <input inputMode="numeric" maxLength={6} placeholder="123456" value={otpCode} disabled={!canSign} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
              </label>
            )}

            {signatureMode === 'Drawn' && (
              <div className="signature-drawing">
                <span>Signature</span>
                <canvas
                  ref={canvasRef}
                  width={720}
                  height={220}
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerLeave={stopDrawing}
                />
                <button className="secondary" type="button" disabled={!canSign} onClick={clearDrawing}>Effacer</button>
              </div>
            )}

            {error && <div className="alert">{error}</div>}
            {success && <div className="success">{success}</div>}
            {signature.signedDocumentUrl && <a className="secondary" href={api.publicSignatureDocumentUrl(token, true)} target="_blank" rel="noreferrer">Ouvrir le document signe</a>}
            <button className="primary" type="submit" disabled={!canSign}>
              <FileSignature size={18} />
              Signer et valider
            </button>
          </form>
        )}
        {!loading && !signature && !error && <EmptyState icon={FileSignature} title="Demande de signature introuvable" />}
        {error && !signature && <div className="alert">{error}</div>}
        </aside>
      </section>
    </main>
  );
}

function PublicMeetPage({ token }: { token: string }) {
  const clientId = useMemo(() => `guest-${getMeetClientId()}`, []);
  const [guestName, setGuestName] = useState(() => localStorage.getItem('oceanerp.meet.guestName') ?? '');
  const [joinedName, setJoinedName] = useState('');
  const [roomState, setRoomState] = useState<MeetingRoomState | null>(null);
  const [sourceLanguage, setSourceLanguage] = useState('fr-FR');
  const [targetLanguage, setTargetLanguage] = useState('fr-FR');
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenEnabled, setScreenEnabled] = useState(false);
  const [mediaRevision, setMediaRevision] = useState(0);
  const [mediaDevices, setMediaDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInputId, setSelectedAudioInputId] = useState('');
  const [selectedVideoInputId, setSelectedVideoInputId] = useState('');
  const [transcriptionEnabled, setTranscriptionEnabled] = useState(false);
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const lastMeetingSyncAtRef = useRef<string | null>(null);
  const meetingSyncInFlightRef = useRef(false);
  const canUseMediaDevices = Boolean(navigator.mediaDevices?.getUserMedia);
  const canUseDisplayMedia = Boolean(navigator.mediaDevices?.getDisplayMedia);
  const audioInputDevices = mediaDevices.filter((device) => device.kind === 'audioinput');
  const videoInputDevices = mediaDevices.filter((device) => device.kind === 'videoinput');

  const loadMediaDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setMediaDevices([]);
      return [] as MediaDeviceInfo[];
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setMediaDevices(devices);
      setSelectedAudioInputId((current) => current && devices.some((device) => device.kind === 'audioinput' && device.deviceId === current) ? current : '');
      setSelectedVideoInputId((current) => current && devices.some((device) => device.kind === 'videoinput' && device.deviceId === current) ? current : '');
      return devices;
    } catch {
      setMediaDevices([]);
      return [] as MediaDeviceInfo[];
    }
  }, []);

  useEffect(() => {
    void loadMediaDevices();

    if (!navigator.mediaDevices?.addEventListener) {
      return undefined;
    }

    const onDeviceChange = () => void loadMediaDevices();
    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
  }, [loadMediaDevices]);

  useEffect(() => {
    lastMeetingSyncAtRef.current = roomState?.room.id ? roomState.serverTime : null;
    meetingSyncInFlightRef.current = false;
  }, [roomState?.room.id]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let alive = true;

    if (!roomState || (!cameraEnabled && !microphoneEnabled)) {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
        setMediaRevision((value) => value + 1);
      }
      return undefined;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("Micro et camera indisponibles. Ouvrez l'ERP en HTTPS ou avec l'application Windows autorisee.");
      setCameraEnabled(false);
      setMicrophoneEnabled(false);
      return undefined;
    }

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    navigator.mediaDevices.getUserMedia({
      video: cameraEnabled
        ? selectedVideoInputId
          ? { deviceId: { exact: selectedVideoInputId } }
          : { facingMode: 'user' }
        : false,
      audio: microphoneEnabled
        ? {
          ...(selectedAudioInputId ? { deviceId: { exact: selectedAudioInputId } } : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
        : false
    })
      .then((nextStream) => {
        if (!alive) {
          nextStream.getTracks().forEach((track) => track.stop());
          return;
        }

        stream = nextStream;
        localStreamRef.current = nextStream;
        setMediaRevision((value) => value + 1);
        const activeAudioDeviceId = nextStream.getAudioTracks()[0]?.getSettings().deviceId;
        const activeVideoDeviceId = nextStream.getVideoTracks()[0]?.getSettings().deviceId;
        if (activeAudioDeviceId) {
          setSelectedAudioInputId((current) => current || activeAudioDeviceId);
        }
        if (activeVideoDeviceId) {
          setSelectedVideoInputId((current) => current || activeVideoDeviceId);
        }
        void loadMediaDevices();
        if (videoRef.current) {
          videoRef.current.srcObject = nextStream;
          void videoRef.current.play().catch(() => undefined);
        }
      })
      .catch((error) => {
        setMessage(formatMeetMediaError(error, "Impossible d'acceder au micro ou a la camera."));
        setCameraEnabled(false);
        setMicrophoneEnabled(false);
      });

    return () => {
      alive = false;
      stream?.getTracks().forEach((track) => track.stop());
      if (localStreamRef.current === stream) {
        localStreamRef.current = null;
        setMediaRevision((value) => value + 1);
      }
    };
  }, [cameraEnabled, loadMediaDevices, microphoneEnabled, roomState?.room.id, selectedAudioInputId, selectedVideoInputId]);

  useEffect(() => () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (!screenEnabled || !screenVideoRef.current || !screenStreamRef.current) {
      return;
    }

    screenVideoRef.current.srcObject = screenStreamRef.current;
    void screenVideoRef.current.play().catch(() => undefined);
  }, [screenEnabled]);

  useEffect(() => {
    if (!roomState) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void syncRoom(false);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cameraEnabled, clientId, joinedName, microphoneEnabled, roomState?.room.id, screenEnabled, sourceLanguage, targetLanguage]);

  useEffect(() => {
    if (!roomState) {
      return;
    }

    void syncRoom(false);
  }, [cameraEnabled, microphoneEnabled, screenEnabled, sourceLanguage, targetLanguage]);

  useEffect(() => {
    if (!roomState || !transcriptionEnabled) {
      return undefined;
    }

    const speechWindow = window as Window & { SpeechRecognition?: BrowserSpeechRecognitionConstructor; webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setMessage("La transcription vocale n'est pas disponible dans ce navigateur.");
      setTranscriptionEnabled(false);
      return undefined;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = sourceLanguage;
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result?.[0]?.transcript?.trim();
        if (text && result.isFinal) {
          void api.addPublicMeetingTranscript(token, {
            clientId,
            speakerName: joinedName,
            text,
            sourceLanguage,
            translatedText: translationEnabled && targetLanguage !== sourceLanguage ? `[${targetLanguage}] ${text}` : null,
            isFinal: true
          }).then(() => syncRoom(false));
        }
      }
    };
    recognition.onerror = () => setMessage('Transcription interrompue.');
    recognition.start();

    return () => recognition.stop();
  }, [clientId, joinedName, roomState?.room.id, sourceLanguage, targetLanguage, token, transcriptionEnabled, translationEnabled]);

  async function joinAsGuest(event: FormEvent) {
    event.preventDefault();
    const name = guestName.trim();
    if (!name) {
      setMessage('Votre nom est obligatoire pour rejoindre la reunion.');
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      localStorage.setItem('oceanerp.meet.guestName', name);
      const next = await api.joinPublicMeetingRoom({
        codeOrToken: token,
        clientId,
        displayName: name,
        sourceLanguage,
        targetLanguage,
        media: defaultMeetingMedia()
      });
      setJoinedName(name);
      replaceRoomState(next);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Lien Meet invalide.');
    } finally {
      setLoading(false);
    }
  }

  async function syncRoom(showErrors = true) {
    if (!roomState || meetingSyncInFlightRef.current) {
      return;
    }

    try {
      meetingSyncInFlightRef.current = true;
      const since = lastMeetingSyncAtRef.current;
      const next = await api.syncPublicMeetingRoom(token, {
        clientId,
        displayName: joinedName || guestName || 'Invite',
        sourceLanguage,
        targetLanguage,
        media: { microphoneEnabled, cameraEnabled, screenEnabled, connectionState: 'online' },
        since
      });
      lastMeetingSyncAtRef.current = next.serverTime;
      setRoomState((current) => mergeMeetingRoomState(since ? current : null, next));
    } catch (err) {
      if (showErrors) {
        setMessage(err instanceof Error ? err.message : 'Synchronisation Meet impossible.');
      }
    } finally {
      meetingSyncInFlightRef.current = false;
    }
  }

  function replaceRoomState(next: MeetingRoomState | null) {
    lastMeetingSyncAtRef.current = next?.serverTime ?? null;
    setRoomState(next);
  }

  async function leaveRoom() {
    if (!roomState) {
      return;
    }

    await api.leavePublicMeetingRoom(token, clientId);
    replaceRoomState(null);
    setCameraEnabled(false);
    setMicrophoneEnabled(false);
    stopScreenShare();
    setMessage('Vous avez quitte la reunion.');
  }

  async function toggleScreenShare() {
    if (screenEnabled) {
      stopScreenShare();
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setMessage("Le partage d'ecran n'est pas disponible. Utilisez l'application Windows a jour ou ouvrez l'ERP en HTTPS.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = stream;
      setScreenEnabled(true);
      setMediaRevision((value) => value + 1);
      stream.getVideoTracks()[0]?.addEventListener('ended', stopScreenShare, { once: true });
    } catch (error) {
      setMessage(formatMeetMediaError(error, "Partage d'ecran annule ou refuse."));
    }
  }

  async function refreshMediaDeviceList() {
    const devices = await loadMediaDevices();
    const cameraCount = devices.filter((device) => device.kind === 'videoinput').length;
    const microphoneCount = devices.filter((device) => device.kind === 'audioinput').length;
    setMessage(`${cameraCount} camera(s) et ${microphoneCount} micro(s) detecte(s).`);
  }

  function switchToNextCamera() {
    if (videoInputDevices.length < 2) {
      setMessage("Une seule camera est detectee pour l'instant. Branchez une autre camera puis actualisez les peripheriques.");
      return;
    }

    const activeDeviceId = localStreamRef.current?.getVideoTracks()[0]?.getSettings().deviceId || selectedVideoInputId;
    const currentIndex = videoInputDevices.findIndex((device) => device.deviceId === activeDeviceId);
    const nextDevice = videoInputDevices[(currentIndex + 1 + videoInputDevices.length) % videoInputDevices.length];
    setSelectedVideoInputId(nextDevice.deviceId);
    setCameraEnabled(true);
    setMessage(`Camera selectionnee : ${nextDevice.label || 'camera suivante'}.`);
  }

  function switchToNextMicrophone() {
    if (audioInputDevices.length < 2) {
      setMessage("Un seul micro est detecte pour l'instant. Branchez un autre micro puis actualisez les peripheriques.");
      return;
    }

    const activeDeviceId = localStreamRef.current?.getAudioTracks()[0]?.getSettings().deviceId || selectedAudioInputId;
    const currentIndex = audioInputDevices.findIndex((device) => device.deviceId === activeDeviceId);
    const nextDevice = audioInputDevices[(currentIndex + 1 + audioInputDevices.length) % audioInputDevices.length];
    setSelectedAudioInputId(nextDevice.deviceId);
    setMicrophoneEnabled(true);
    setMessage(`Micro selectionne : ${nextDevice.label || 'micro suivant'}.`);
  }

  function stopScreenShare() {
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }
    setScreenEnabled(false);
    setMediaRevision((value) => value + 1);
  }

  async function sendChat(event: FormEvent) {
    event.preventDefault();
    if (!roomState || (!chatMessage.trim() && !chatFile)) {
      return;
    }

    const fileBase64 = chatFile ? await readFileAsDataUrl(chatFile) : null;
    await api.addPublicMeetingChatMessage(token, {
      clientId,
      senderName: joinedName,
      message: chatMessage,
      fileName: chatFile?.name ?? null,
      fileMimeType: chatFile?.type || null,
      fileBase64
    });
    setChatMessage('');
    setChatFile(null);
    await syncRoom(false);
  }

  const sendPeerSignal = useCallback<MeetingPeerSignalSender>(async (recipientClientId, signalType, payload) => {
    await api.sendPublicMeetingSignal(token, {
      senderClientId: clientId,
      recipientClientId,
      signalType,
      payloadJson: JSON.stringify(payload)
    });
  }, [clientId, token]);

  const getPublicLocalStreams = useCallback(
    () => [localStreamRef.current, screenStreamRef.current].filter((stream): stream is MediaStream => Boolean(stream)),
    []
  );

  const remoteStreams = useMeetingPeerStreams({
    roomState,
    clientId,
    mediaRevision,
    getLocalStreams: getPublicLocalStreams,
    sendSignal: sendPeerSignal,
    onError: setMessage
  });

  const activeParticipant = roomState?.participants.find((participant) => participant.clientId === clientId);

  if (!roomState) {
    return (
      <main className="public-meet-screen">
        <section className="public-meet-card">
          <div className="brand large">
            <div className="brand-mark">OE</div>
            <div>
              <strong>OceanERP Meet</strong>
              <span>Acces invite securise</span>
            </div>
          </div>
          <form onSubmit={joinAsGuest}>
            <p className="eyebrow">Invitation Meet</p>
            <h1>Rejoindre la reunion</h1>
            <p className="panel-note">Entrez seulement votre nom. Vous n'aurez acces qu'a cette salle Meet.</p>
            <label>
              Votre nom
              <input value={guestName} onChange={(event) => setGuestName(event.target.value)} autoFocus autoComplete="name" placeholder="Nom et prenom" />
            </label>
            {message && <div className="alert">{message}</div>}
            <button className="primary" type="submit" disabled={loading}>
              <Video size={18} />
              {loading ? 'Connexion...' : 'Rejoindre'}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="public-meet-room">
      <header className="public-meet-topbar">
        <div>
          <p className="eyebrow">OceanERP Meet</p>
          <h1>{roomState.room.title}</h1>
          <span>{roomState.room.code}</span>
        </div>
        <button className="danger" type="button" onClick={() => void leaveRoom()}>
          <PhoneOff size={16} />
          Quitter
        </button>
      </header>

      {message && <div className="alert">{message}</div>}
      {(!canUseMediaDevices || !canUseDisplayMedia) && (
        <div className="alert meet-media-warning">
          {meetMediaAvailabilityMessage(canUseMediaDevices, canUseDisplayMedia)}
        </div>
      )}

      <div className="meet-toolbar public-meet-toolbar">
        <button className={microphoneEnabled ? 'active' : ''} type="button" disabled={!canUseMediaDevices} onClick={() => setMicrophoneEnabled((value) => !value)}>
          {microphoneEnabled ? <Mic size={16} /> : <MicOff size={16} />}
          Micro
        </button>
        <select className="meet-device-select" value={selectedAudioInputId} disabled={!canUseMediaDevices} onFocus={() => void loadMediaDevices()} onChange={(event) => { setSelectedAudioInputId(event.target.value); setMicrophoneEnabled(true); }} aria-label="Choisir le micro">
          <option value="">{audioInputDevices.length ? 'Micro par defaut' : 'Aucun micro detecte'}</option>
          {audioInputDevices.map((device, index) => (
            <option value={device.deviceId} key={device.deviceId || `guest-audio-${index}`}>
              {device.label || `Micro ${index + 1}`}
            </option>
          ))}
        </select>
        <button className="secondary" type="button" disabled={!canUseMediaDevices || audioInputDevices.length < 2} title={!canUseMediaDevices ? "Micro indisponible sans HTTPS ou permission Windows." : audioInputDevices.length < 2 ? "Un seul micro detecte. Cliquez sur Detecter apres avoir branche un autre micro." : 'Passer au micro suivant'} onClick={switchToNextMicrophone}>
          Changer micro
        </button>
        <button className={cameraEnabled ? 'active' : ''} type="button" disabled={!canUseMediaDevices} onClick={() => setCameraEnabled((value) => !value)}>
          {cameraEnabled ? <Camera size={16} /> : <CameraOff size={16} />}
          Camera
        </button>
        <select className="meet-device-select" value={selectedVideoInputId} disabled={!canUseMediaDevices} onFocus={() => void loadMediaDevices()} onChange={(event) => { setSelectedVideoInputId(event.target.value); setCameraEnabled(true); }} aria-label="Choisir la camera">
          <option value="">{videoInputDevices.length ? 'Camera par defaut' : 'Aucune camera detectee'}</option>
          {videoInputDevices.map((device, index) => (
            <option value={device.deviceId} key={device.deviceId || `guest-video-${index}`}>
              {device.label || `Camera ${index + 1}`}
            </option>
          ))}
        </select>
        <button className="secondary" type="button" disabled={!canUseMediaDevices || videoInputDevices.length < 2} title={!canUseMediaDevices ? "Camera indisponible sans HTTPS ou permission Windows." : videoInputDevices.length < 2 ? "Une seule camera detectee. Cliquez sur Detecter apres avoir branche une autre camera." : 'Passer a la camera suivante'} onClick={switchToNextCamera}>
          Changer camera
        </button>
        <button className="secondary" type="button" disabled={!navigator.mediaDevices?.enumerateDevices} onClick={() => void refreshMediaDeviceList()}>
          Detecter
        </button>
        <button className={screenEnabled ? 'active' : ''} type="button" disabled={!canUseDisplayMedia} onClick={() => void toggleScreenShare()}>
          <ScreenShare size={16} />
          Ecran
        </button>
        <button className={transcriptionEnabled ? 'active' : ''} type="button" onClick={() => setTranscriptionEnabled((value) => !value)}>
          <FileText size={16} />
          Transcription
        </button>
        <button className={translationEnabled ? 'active' : ''} type="button" onClick={() => setTranslationEnabled((value) => !value)}>
          <Languages size={16} />
          Traduction
        </button>
        <select value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value)} aria-label="Langue parlee">
          {meetingLanguageOptions.map((language) => <option value={language.code} key={language.code}>{language.label}</option>)}
        </select>
        <select value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)} aria-label="Langue cible">
          {meetingLanguageOptions.map((language) => <option value={language.code} key={language.code}>{language.label}</option>)}
        </select>
      </div>

      <section className="public-meet-layout">
        <div className="meet-video-grid">
          <article className="meet-video-tile">
            {cameraEnabled ? <video ref={videoRef} autoPlay muted playsInline /> : <div className="meet-avatar">{joinedName.slice(0, 2).toUpperCase()}</div>}
            <footer>
              <strong>{joinedName}</strong>
              <span>{activeParticipant?.connectionState ?? 'online'}</span>
            </footer>
          </article>
          {screenEnabled && (
            <article className="meet-video-tile meet-screen-share">
              <video ref={screenVideoRef} autoPlay muted playsInline />
              <footer>
                <strong>Partage d'ecran</strong>
                <span>actif</span>
              </footer>
            </article>
          )}
          {roomState.participants.filter((participant) => participant.clientId !== clientId).flatMap((participant) => {
            const streams = remoteStreams[participant.clientId] ?? [];
            if (streams.length === 0) {
              return [(
                <article className="meet-video-tile remote" key={participant.id}>
                  <div className="meet-avatar">{participant.displayName.slice(0, 2).toUpperCase()}</div>
                  <footer>
                    <strong>{participant.displayName}</strong>
                    <span>{participant.microphoneEnabled ? 'Micro actif' : 'Micro coupe'} - {participant.cameraEnabled ? 'Camera active' : 'Camera coupee'}</span>
                  </footer>
                </article>
              )];
            }

            return streams.map((item) => (
              <MeetRemoteVideoTile participant={participant} item={item} key={`${participant.id}-${item.id}`} />
            ));
          })}
        </div>

        <aside className="meet-side-panel public-meet-side">
          <section>
            <h3>Participants</h3>
            {roomState.participants.map((participant) => (
              <div className="meet-participant" key={participant.id}>
                <strong>{participant.displayName}</strong>
                <span>{participant.sourceLanguage} - {participant.connectionState}</span>
              </div>
            ))}
          </section>
          <section>
            <h3>Chat</h3>
            <div className="meet-chat-list">
              {roomState.chatMessages.map((item) => (
                <article key={item.id}>
                  <strong>{item.senderName}</strong>
                  <p>{item.message}</p>
                  {item.hasFile && item.fileName && (
                    <button className="link-button" type="button" onClick={() => void api.downloadPublicMeetingAttachment(token, item.id, item.fileName!)}>
                      <Paperclip size={14} />
                      {item.fileName}
                    </button>
                  )}
                </article>
              ))}
            </div>
            <form className="meet-chat-form" onSubmit={sendChat}>
              <textarea value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} placeholder="Message" />
              <input type="file" onChange={(event) => setChatFile(event.target.files?.[0] ?? null)} />
              <button className="primary" type="submit">Envoyer</button>
            </form>
          </section>
        </aside>
      </section>

      <Panel title="Transcription">
        <div className="meet-transcript-list">
          {roomState.transcripts.map((item) => (
            <article key={item.id}>
              <span>{formatOrderDate(item.createdAt)}</span>
              <strong>{item.speakerName}</strong>
              <p>{item.text}</p>
              {item.translatedText && <small>{item.translatedText}</small>}
            </article>
          ))}
          {roomState.transcripts.length === 0 && <p className="panel-note">Aucune transcription.</p>}
        </div>
      </Panel>
    </main>
  );
}

function Dashboard({ summary }: { summary: DashboardSummary | null }) {
  const [isEditing, setEditing] = useState(false);
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>(() => readDashboardBlocks());
  const selectedBlockSet = useMemo(() => new Set(selectedBlocks), [selectedBlocks]);
  const indicators = useMemo(
    () => dashboardBlocks.filter((block) => selectedBlockSet.has(block.key)).map((block) => ({
      ...block,
      value: formatDashboardValue(summary?.[block.key] ?? 0, block.format)
    })),
    [selectedBlockSet, summary]
  );

  function toggleBlock(key: keyof DashboardSummary) {
    setSelectedBlocks((current) => {
      const next = current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key];
      const safeNext = next.length === 0 ? [...defaultDashboardBlocks] : next;
      storeChoice(dashboardStorageKey, JSON.stringify(safeNext));
      return safeNext;
    });
  }

  function resetBlocks() {
    setSelectedBlocks([...defaultDashboardBlocks]);
    storeChoice(dashboardStorageKey, JSON.stringify(defaultDashboardBlocks));
  }

  return (
    <>
      <div className="dashboard-toolbar">
        <button className="secondary" type="button" onClick={() => setEditing((value) => !value)}>
          <Pencil size={15} />
          Modifier
        </button>
      </div>

      {isEditing && (
        <section className="panel dashboard-editor">
          <div className="dashboard-editor-head">
            <h2>Blocs du tableau de bord</h2>
            <button className="secondary" type="button" onClick={resetBlocks}>Reinitialiser</button>
          </div>
          <div className="dashboard-block-picker">
            {dashboardBlocks.map((block) => (
              <label key={block.key} className="checkbox-line dashboard-block-option">
                <input type="checkbox" checked={selectedBlockSet.has(block.key)} onChange={() => toggleBlock(block.key)} />
                <span>
                  <strong>{block.label}</strong>
                  <small>{block.group}</small>
                </span>
              </label>
            ))}
          </div>
        </section>
      )}

      <section className="grid metrics">
        {indicators.map((indicator) => (
          <article className="metric-card" key={indicator.key}>
            <span>{indicator.label}</span>
            <strong>{indicator.value}</strong>
          </article>
        ))}
      </section>
    </>
  );
}

function Backups({ archives, onChanged }: { archives: BackupArchive[]; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [operation, setOperation] = useState<BackupOperationResult | null>(null);
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState({ enabled: false, intervalHours: 24 });
  const [remoteStorage, setRemoteStorage] = useState<BackupRemoteStorage | null>(null);
  const [remoteDraft, setRemoteDraft] = useState({
    enabled: false,
    uploadAfterBackup: false,
    host: '',
    port: 22,
    username: '',
    password: '',
    clearPassword: false,
    remotePath: '/backups/oceanerp'
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadSchedule();
    void loadRemoteStorage();
  }, []);

  async function loadSchedule() {
    try {
      const next = await api.backupSchedule();
      setSchedule(next);
      setScheduleDraft({ enabled: next.enabled, intervalHours: next.intervalHours });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Planification indisponible');
    }
  }

  async function loadRemoteStorage() {
    try {
      const next = await api.backupRemoteStorage();
      setRemoteStorage(next);
      setRemoteDraft({
        enabled: next.enabled,
        uploadAfterBackup: next.uploadAfterBackup,
        host: next.host,
        port: next.port || 22,
        username: next.username,
        password: '',
        clearPassword: false,
        remotePath: next.remotePath || '/backups/oceanerp'
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Configuration de stockage externe indisponible');
    }
  }

  async function runBackup() {
    setBusy('backup');
    setError(null);
    setOperation(null);
    try {
      const result = await api.createBackup();
      setOperation(result);
      await onChanged();
      await loadRemoteStorage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sauvegarde impossible');
    } finally {
      setBusy(null);
    }
  }

  async function downloadBackup(archive: BackupArchive) {
    const complete = archive.hasPostgresDump && archive.hasDocumentsArchive;
    if (!complete) {
      setError('Cette sauvegarde est incomplete et ne peut pas etre telechargee.');
      return;
    }

    setBusy(`download:${archive.name}`);
    setError(null);
    try {
      await api.downloadBackup(archive.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Telechargement impossible');
    } finally {
      setBusy(null);
    }
  }

  async function restoreBackup(archive: BackupArchive) {
    const complete = archive.hasPostgresDump && archive.hasDocumentsArchive;
    if (!complete) {
      setError('Cette sauvegarde est incomplete et ne peut pas etre restauree.');
      return;
    }

    const confirmed = window.confirm(`Restaurer la sauvegarde ${archive.name} ? Cette operation remplace PostgreSQL et les documents.`);
    if (!confirmed) {
      return;
    }

    setBusy(archive.name);
    setError(null);
    setOperation(null);
    try {
      const result = await api.restoreBackup(archive.name);
      setOperation(result);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restauration impossible');
    } finally {
      setBusy(null);
    }
  }

  async function saveRemoteStorage() {
    setBusy('remote-save');
    setError(null);
    try {
      const next = await api.updateBackupRemoteStorage({
        enabled: remoteDraft.enabled,
        uploadAfterBackup: remoteDraft.uploadAfterBackup,
        host: remoteDraft.host,
        port: Math.max(1, Math.min(65535, Math.round(remoteDraft.port || 22))),
        username: remoteDraft.username,
        password: remoteDraft.password.trim() ? remoteDraft.password : null,
        clearPassword: remoteDraft.clearPassword,
        remotePath: remoteDraft.remotePath
      });
      setRemoteStorage(next);
      setRemoteDraft((current) => ({ ...current, password: '', clearPassword: false, port: next.port, remotePath: next.remotePath }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Configuration du stockage externe impossible');
    } finally {
      setBusy(null);
    }
  }

  async function testRemoteStorage() {
    setBusy('remote-test');
    setError(null);
    setOperation(null);
    try {
      const result = await api.testBackupRemoteStorage();
      setOperation(result);
      await loadRemoteStorage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test SFTP impossible');
      await loadRemoteStorage();
    } finally {
      setBusy(null);
    }
  }

  async function uploadRemoteBackup(archive: BackupArchive) {
    const complete = archive.hasPostgresDump && archive.hasDocumentsArchive;
    if (!complete) {
      setError('Cette sauvegarde est incomplete et ne peut pas etre envoyee.');
      return;
    }

    setBusy(`remote-upload:${archive.name}`);
    setError(null);
    setOperation(null);
    try {
      const result = await api.uploadBackup(archive.name);
      setOperation(result);
      await loadRemoteStorage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi externe impossible');
      await loadRemoteStorage();
    } finally {
      setBusy(null);
    }
  }

  async function saveSchedule() {
    setBusy('schedule');
    setError(null);
    try {
      const intervalHours = Number.isFinite(scheduleDraft.intervalHours) ? scheduleDraft.intervalHours : 24;
      const next = await api.updateBackupSchedule({
        enabled: scheduleDraft.enabled,
        intervalHours: Math.max(1, Math.min(24 * 30, Math.round(intervalHours)))
      });
      setSchedule(next);
      setScheduleDraft({ enabled: next.enabled, intervalHours: next.intervalHours });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Planification impossible');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="backup-module">
      <Panel title="Sauvegardes serveur">
        <div className="backup-toolbar">
          <div>
            <strong>{archives.length} sauvegarde(s)</strong>
            <p>Les sauvegardes contiennent PostgreSQL et les documents stockes hors base.</p>
          </div>
          <div className="backup-actions">
            <button className="secondary" type="button" disabled={Boolean(busy)} onClick={onChanged}>
              <Search size={16} />
              Actualiser
            </button>
            <button className="primary" type="button" disabled={Boolean(busy)} onClick={runBackup}>
              <Download size={16} />
              {busy === 'backup' ? 'Sauvegarde...' : 'Lancer une sauvegarde'}
            </button>
          </div>
        </div>

        <div className="backup-schedule">
          <div>
            <strong>Automatisation periodique</strong>
            <p>La sauvegarde automatique est executee par le serveur, meme si l'interface est fermee.</p>
          </div>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={scheduleDraft.enabled}
              onChange={(event) => setScheduleDraft((current) => ({ ...current, enabled: event.target.checked }))}
            />
            Activee
          </label>
          <label>
            Frequence
            <input
              type="number"
              min="1"
              max={24 * 30}
              value={scheduleDraft.intervalHours}
              onChange={(event) => {
                const value = Number(event.target.value);
                setScheduleDraft((current) => ({ ...current, intervalHours: Number.isFinite(value) ? value : 1 }));
              }}
            />
          </label>
          <span className="backup-schedule-unit">heure(s)</span>
          <button className="secondary" type="button" disabled={Boolean(busy)} onClick={saveSchedule}>
            <Save size={16} />
            {busy === 'schedule' ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          <div className="backup-schedule-meta">
            <span>Derniere : {schedule?.lastRunAt ? formatBackupDate(schedule.lastRunAt) : '-'}</span>
            <span>Prochaine : {schedule?.nextRunAt ? formatBackupDate(schedule.nextRunAt) : '-'}</span>
          </div>
        </div>

        <div className="backup-remote">
          <div className="backup-remote-header">
            <div>
              <strong>Stockage externe SFTP</strong>
              <p>Copie les ZIP de sauvegarde sur un autre serveur pour garder une archive hors du serveur ERP.</p>
            </div>
            <div className="backup-actions">
              <button className="secondary" type="button" disabled={Boolean(busy)} onClick={testRemoteStorage}>
                <Search size={16} />
                {busy === 'remote-test' ? 'Test...' : 'Tester'}
              </button>
              <button className="secondary" type="button" disabled={Boolean(busy)} onClick={saveRemoteStorage}>
                <Save size={16} />
                {busy === 'remote-save' ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
          <div className="backup-remote-grid">
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={remoteDraft.enabled}
                onChange={(event) => setRemoteDraft((current) => ({ ...current, enabled: event.target.checked }))}
              />
              Serveur externe actif
            </label>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={remoteDraft.uploadAfterBackup}
                onChange={(event) => setRemoteDraft((current) => ({ ...current, uploadAfterBackup: event.target.checked }))}
              />
              Envoyer apres chaque sauvegarde
            </label>
            <label>
              Hote
              <input
                value={remoteDraft.host}
                placeholder="backup.mondomaine.fr"
                onChange={(event) => setRemoteDraft((current) => ({ ...current, host: event.target.value }))}
              />
            </label>
            <label>
              Port
              <input
                type="number"
                min="1"
                max="65535"
                value={remoteDraft.port}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setRemoteDraft((current) => ({ ...current, port: Number.isFinite(value) ? value : 22 }));
                }}
              />
            </label>
            <label>
              Utilisateur
              <input
                value={remoteDraft.username}
                placeholder="oceanerp-backup"
                onChange={(event) => setRemoteDraft((current) => ({ ...current, username: event.target.value }))}
              />
            </label>
            <label>
              Mot de passe
              <input
                type="password"
                value={remoteDraft.password}
                placeholder={remoteStorage?.hasPassword ? 'Laisser vide pour conserver' : 'Mot de passe SFTP'}
                onChange={(event) => setRemoteDraft((current) => ({ ...current, password: event.target.value, clearPassword: false }))}
              />
            </label>
            <label>
              Chemin distant
              <input
                value={remoteDraft.remotePath}
                placeholder="/backups/oceanerp"
                onChange={(event) => setRemoteDraft((current) => ({ ...current, remotePath: event.target.value }))}
              />
            </label>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={remoteDraft.clearPassword}
                onChange={(event) => setRemoteDraft((current) => ({ ...current, clearPassword: event.target.checked, password: '' }))}
              />
              Effacer le mot de passe enregistre
            </label>
          </div>
          <div className="backup-remote-status">
            <span>Dernier test : {remoteStorage?.lastTestAt ? `${formatBackupDate(remoteStorage.lastTestAt)} - ${remoteStorage.lastTestStatus ?? '-'}` : '-'}</span>
            <span>Dernier envoi : {remoteStorage?.lastUploadAt ? `${formatBackupDate(remoteStorage.lastUploadAt)} - ${remoteStorage.lastUploadStatus ?? '-'}` : '-'}</span>
          </div>
        </div>

        {error && <div className="alert">{error}</div>}
        {operation && (
          <div className={operation.succeeded ? 'success backup-result' : 'alert backup-result'}>
            <strong>{operation.message}</strong>
            {operation.backupName && <span>Sauvegarde : {operation.backupName}</span>}
            {operation.output && <pre>{operation.output}</pre>}
          </div>
        )}

        <DataTable
          columns={['Sauvegarde', 'Date', 'PostgreSQL', 'Documents', 'Taille totale', 'Actions']}
          rows={archives.map((archive) => {
            const complete = archive.hasPostgresDump && archive.hasDocumentsArchive;
            return [
              <strong key="name">{archive.name}</strong>,
              formatBackupDate(archive.createdAt),
              archive.hasPostgresDump ? formatBytes(archive.postgresSizeBytes) : <span className="text-danger">Manquant</span>,
              archive.hasDocumentsArchive ? formatBytes(archive.documentsSizeBytes) : <span className="text-danger">Manquant</span>,
              formatBytes(archive.totalSizeBytes),
              <div key="actions" className="backup-row-actions">
                <button
                  className="secondary"
                  type="button"
                  disabled={Boolean(busy) || !complete}
                  onClick={(event) => {
                    event.stopPropagation();
                    downloadBackup(archive);
                  }}
                >
                  <Download size={16} />
                  {busy === `download:${archive.name}` ? 'Telechargement...' : 'Telecharger'}
                </button>
                <button
                  className="secondary"
                  type="button"
                  disabled={Boolean(busy) || !complete}
                  onClick={(event) => {
                    event.stopPropagation();
                    restoreBackup(archive);
                  }}
                >
                  <Upload size={16} />
                  {busy === archive.name ? 'Restauration...' : 'Restaurer'}
                </button>
                <button
                  className="secondary"
                  type="button"
                  disabled={Boolean(busy) || !complete}
                  onClick={(event) => {
                    event.stopPropagation();
                    uploadRemoteBackup(archive);
                  }}
                >
                  <Upload size={16} />
                  {busy === `remote-upload:${archive.name}` ? 'Envoi...' : 'Envoyer externe'}
                </button>
              </div>
            ];
          })}
        />
      </Panel>
    </section>
  );
}

function formatBackupDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'medium' }).format(date);
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 octet';
  }

  const units = ['octets', 'Ko', 'Mo', 'Go', 'To'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: unitIndex === 0 ? 0 : 1 }).format(size)} ${units[unitIndex]}`;
}

const dashboardStorageKey = 'oceanerp.dashboard.blocks';

type DashboardBlock = {
  key: keyof DashboardSummary;
  label: string;
  group: string;
  format?: 'currency' | 'number';
};

const defaultDashboardBlocks: Array<keyof DashboardSummary> = [
  'monthlyRevenue',
  'pendingQuotes',
  'unpaidInvoices',
  'openOrders',
  'lowStockItems',
  'openServiceTickets',
  'newEmails',
  'recentDocuments'
];

const dashboardBlocks: DashboardBlock[] = [
  { key: 'monthlyRevenue', label: 'CA du mois', group: 'Ventes', format: 'currency' },
  { key: 'pendingQuotes', label: 'Devis en attente', group: 'Devis' },
  { key: 'draftQuotes', label: 'Devis brouillons', group: 'Devis' },
  { key: 'sentQuotes', label: 'Devis envoyes', group: 'Devis' },
  { key: 'signedQuotes', label: 'Devis signes', group: 'Devis' },
  { key: 'expiredQuotes', label: 'Devis expires', group: 'Devis' },
  { key: 'quotesToExpireSoon', label: 'Devis a relancer', group: 'Devis' },
  { key: 'pendingQuoteAmount', label: 'Montant devis ouverts', group: 'Devis', format: 'currency' },
  { key: 'openOrders', label: 'Commandes en cours', group: 'Commandes' },
  { key: 'draftOrders', label: 'Commandes brouillons', group: 'Commandes' },
  { key: 'confirmedOrders', label: 'Commandes confirmees', group: 'Commandes' },
  { key: 'preparingOrders', label: 'Commandes en preparation', group: 'Commandes' },
  { key: 'shippedOrders', label: 'Commandes expediees', group: 'Commandes' },
  { key: 'unpaidInvoices', label: 'Factures impayees', group: 'Factures' },
  { key: 'overdueInvoices', label: 'Factures en retard', group: 'Factures' },
  { key: 'openPurchaseOrders', label: 'Achats en cours', group: 'Achats' },
  { key: 'purchaseOrdersExpectedSoon', label: 'Receptions a venir', group: 'Achats' },
  { key: 'lowStockItems', label: 'Stock bas', group: 'Stock' },
  { key: 'outOfStockItems', label: 'Ruptures stock', group: 'Stock' },
  { key: 'stockQuantityOnHand', label: 'Quantite en stock', group: 'Stock', format: 'number' },
  { key: 'stockQuantityReserved', label: 'Stock reserve', group: 'Stock', format: 'number' },
  { key: 'newEmails', label: 'Nouveaux emails', group: 'Communication' },
  { key: 'unreadNotifications', label: 'Notifications non lues', group: 'Communication' },
  { key: 'openServiceTickets', label: 'SAV ouverts', group: 'SAV' },
  { key: 'recentDocuments', label: 'Documents recents', group: 'Documents' },
  { key: 'totalDocuments', label: 'Documents Drive', group: 'Documents' },
  { key: 'trashedDocuments', label: 'Documents corbeille', group: 'Documents' },
  { key: 'totalCustomers', label: 'Clients total', group: 'Clients' },
  { key: 'activeCustomers', label: 'Clients actifs', group: 'Clients' },
  { key: 'totalProducts', label: 'Articles total', group: 'Produits' },
  { key: 'activeProducts', label: 'Articles actifs', group: 'Produits' },
  { key: 'inactiveProducts', label: 'Articles inactifs', group: 'Produits' },
  { key: 'suppliers', label: 'Fournisseurs', group: 'Achats' },
  { key: 'warehouses', label: 'Entrepots', group: 'Stock' },
  { key: 'mailAccounts', label: 'Boites mail', group: 'Communication' },
  { key: 'activePrestashopConnections', label: 'Connexions PrestaShop', group: 'PrestaShop' }
];

function readDashboardBlocks() {
  try {
    const raw = localStorage.getItem(dashboardStorageKey);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      const allowed = new Set(dashboardBlocks.map((block) => block.key));
      const cleaned = parsed.filter((item): item is keyof DashboardSummary => typeof item === 'string' && allowed.has(item as keyof DashboardSummary));
      if (cleaned.length > 0) {
        return cleaned;
      }
    }
  } catch {
    // La personnalisation reste optionnelle si le stockage local est bloque.
  }

  return [...defaultDashboardBlocks];
}

function formatDashboardValue(value: number, format?: 'currency' | 'number') {
  if (format === 'currency') {
    return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  }

  return value.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

function Settings({
  currentUser,
  users,
  roles,
  permissions,
  auditLogs,
  prestashopConnections,
  prestashopLogs,
  warehouses,
  mailAccounts,
  mailServerSettings,
  quoteSettings,
  serviceAssignmentSettings,
  onUsersRolesChanged,
  onPrestashopChanged,
  onPrestashopSyncChanged,
  onWarehousesChanged,
  onMailAccountsChanged,
  onMailServerSettingsChanged,
  onQuoteSettingsChanged,
  onServiceSettingsChanged,
  onUserChanged,
  onSignedOut
}: {
  currentUser: User | null;
  users: User[];
  roles: Role[];
  permissions: Permission[];
  auditLogs: AuditLog[];
  prestashopConnections: PrestashopConnection[];
  prestashopLogs: PrestashopSyncLog[];
  warehouses: Warehouse[];
  mailAccounts: MailAccount[];
  mailServerSettings: MailServerSettings | null;
  quoteSettings: QuoteSettings | null;
  serviceAssignmentSettings: ServiceTicketAssignmentSettings | null;
  onUsersRolesChanged: () => Promise<void>;
  onPrestashopChanged: () => Promise<void>;
  onPrestashopSyncChanged: () => Promise<void>;
  onWarehousesChanged: () => Promise<void>;
  onMailAccountsChanged: () => Promise<void>;
  onMailServerSettingsChanged: () => Promise<void>;
  onQuoteSettingsChanged: () => Promise<void>;
  onServiceSettingsChanged: () => Promise<void>;
  onUserChanged: (user: User) => void;
  onSignedOut: () => void;
}) {
  const canManageUsers = hasPermission(currentUser, 'auth.users.read') && hasPermission(currentUser, 'auth.users.write');
  const canManagePrestashop = hasPermission(currentUser, 'prestashop.read') && hasPermission(currentUser, 'prestashop.write');
  const canManageWarehouses = hasPermission(currentUser, 'stock.read') && hasPermission(currentUser, 'stock.write');
  const canManageEmails = hasPermission(currentUser, 'emails.read') && hasPermission(currentUser, 'emails.write');
  const isAdministrator = Boolean(currentUser?.roles.includes('Administrator'));
  const canManageQuoteSettings = isAdministrator && hasPermission(currentUser, 'quotes.read') && hasPermission(currentUser, 'quotes.write');
  const canManageServiceAssignments = isAdministrator && hasPermission(currentUser, 'service.write') && hasPermission(currentUser, 'auth.users.write');
  const [activeTab, setActiveTab] = useState<'account' | 'emails' | 'quotes' | 'access' | 'audit' | 'warehouses' | 'prestashop' | 'service'>(() => readStoredChoice('oceanerp.settings.activeTab', 'account', ['account', 'emails', 'quotes', 'access', 'audit', 'warehouses', 'prestashop', 'service'] as const));
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
    if ((activeTab === 'emails' && !canManageEmails) || (activeTab === 'quotes' && !canManageQuoteSettings) || ((activeTab === 'access' || activeTab === 'audit') && !canManageUsers) || (activeTab === 'warehouses' && !canManageWarehouses) || (activeTab === 'prestashop' && !canManagePrestashop) || (activeTab === 'service' && !canManageServiceAssignments)) {
      setActiveTab('account');
    }
  }, [activeTab, canManageEmails, canManagePrestashop, canManageQuoteSettings, canManageServiceAssignments, canManageUsers, canManageWarehouses]);

  useEffect(() => {
    storeChoice('oceanerp.settings.activeTab', activeTab);
  }, [activeTab]);

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
    ...(canManagePrestashop ? [{ key: 'prestashop' as const, label: 'PrestaShop' }] : []),
    ...(canManageServiceAssignments ? [{ key: 'service' as const, label: 'SAV' }] : [])
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
        {activeTab === 'prestashop' && canManagePrestashop && <PrestashopSettingsTab connections={prestashopConnections} logs={prestashopLogs} warehouses={warehouses} onSettingsChanged={onPrestashopChanged} onSyncChanged={onPrestashopSyncChanged} />}
        {activeTab === 'service' && canManageServiceAssignments && <ServiceAssignmentSettingsPanel users={users} settings={serviceAssignmentSettings} onChanged={onServiceSettingsChanged} />}
      </section>
    </>
  );
}

function ServiceAssignmentSettingsPanel({ users, settings, onChanged }: { users: User[]; settings: ServiceTicketAssignmentSettings | null; onChanged: () => Promise<void> }) {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(settings?.initialResponderUserIds ?? []);
  const [feedback, setFeedback] = useState<string | null>(null);
  const activeUsers = users.filter((user) => user.isActive);

  useEffect(() => {
    setSelectedUserIds(settings?.initialResponderUserIds ?? []);
  }, [settings]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setFeedback(null);
    try {
      await api.updateServiceTicketAssignmentSettings({ initialResponderUserIds: selectedUserIds });
      setFeedback('Destinataires initiaux SAV enregistres.');
      await onChanged();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
  }

  return (
    <Panel title="Attribution SAV">
      <form className="form-grid" onSubmit={save}>
        <label className="field wide-field">
          Utilisateurs qui recoivent les nouvelles demandes non attribuees
          <select multiple size={Math.min(Math.max(activeUsers.length, 3), 8)} value={selectedUserIds} onChange={(event) => setSelectedUserIds(Array.from(event.target.selectedOptions).map((option) => option.value))}>
            {activeUsers.map((user) => (
              <option key={user.id} value={user.id}>{user.displayName} &lt;{user.email}&gt;</option>
            ))}
          </select>
        </label>
        <button className="primary form-actions" type="submit">
          <Save size={16} />
          Enregistrer
        </button>
      </form>
      <p className="panel-note">Les tickets SAV attribues notifient directement leur responsable. Les tickets non attribues notifient uniquement ces utilisateurs.</p>
      {feedback && <div className="inline-message">{feedback}</div>}
    </Panel>
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
  const [colissimoLabelEndpointTemplate, setColissimoLabelEndpointTemplate] = useState('');
  const [colissimoBridgeToken, setColissimoBridgeToken] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [clearApiKey, setClearApiKey] = useState(false);
  const [clearColissimoBridgeToken, setClearColissimoBridgeToken] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedConnection = connections.find((connection) => connection.id === selectedId);
  const warehouseById = useMemo(() => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse.name])), [warehouses]);

  useEffect(() => {
    if (selectedConnection) {
      setShopUrl(selectedConnection.shopUrl);
      setWarehouseId(selectedConnection.warehouseId ?? '');
      setColissimoLabelEndpointTemplate(selectedConnection.colissimoLabelEndpointTemplate ?? '');
      setIsActive(selectedConnection.isActive);
      setApiKey('');
      setColissimoBridgeToken('');
      setClearApiKey(false);
      setClearColissimoBridgeToken(false);
    }
  }, [selectedConnection]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      if (selectedConnection) {
        await api.updatePrestashopConnection(selectedConnection.id, {
          shopUrl,
          apiKey: apiKey || undefined,
          isActive,
          clearApiKey,
          warehouseId: warehouseId || undefined,
          colissimoLabelEndpointTemplate: colissimoLabelEndpointTemplate || undefined,
          colissimoBridgeToken: colissimoBridgeToken || undefined,
          clearColissimoBridgeToken
        });
        setMessage('Connexion PrestaShop mise a jour.');
      } else {
        await api.createPrestashopConnection({
          shopUrl,
          apiKey: apiKey || undefined,
          warehouseId: warehouseId || undefined,
          colissimoLabelEndpointTemplate: colissimoLabelEndpointTemplate || undefined,
          colissimoBridgeToken: colissimoBridgeToken || undefined
        });
        setMessage('Connexion PrestaShop creee.');
      }

      setSelectedId('');
      setShopUrl('');
      setApiKey('');
      setWarehouseId('');
      setColissimoLabelEndpointTemplate('');
      setColissimoBridgeToken('');
      setIsActive(true);
      setClearApiKey(false);
      setClearColissimoBridgeToken(false);
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
          <input className="wide-field" placeholder="URL etiquette Colissimo optionnelle, ex: https://.../label.php?id_order={orderId}" value={colissimoLabelEndpointTemplate} onChange={(event) => setColissimoLabelEndpointTemplate(event.target.value)} />
          <input type="password" placeholder={selectedConnection?.hasColissimoBridgeToken ? 'Nouveau token pont Colissimo, vide = conserver' : 'Token pont Colissimo optionnel'} value={colissimoBridgeToken} onChange={(event) => setColissimoBridgeToken(event.target.value)} />
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
          {selectedConnection?.hasColissimoBridgeToken && (
            <label className="check-field">
              <input type="checkbox" checked={clearColissimoBridgeToken} onChange={(event) => setClearColissimoBridgeToken(event.target.checked)} />
              Effacer token Colissimo
            </label>
          )}
          <button className="primary" type="submit">
            <Store size={16} />
            {selectedConnection ? 'Mettre a jour' : 'Ajouter'}
          </button>
        </form>
        {message && <div className="inline-message">{message}</div>}
        <p className="panel-note">La cle API et le token optionnel du pont Colissimo sont proteges en base. Aucune cle PrestaShop n'est a renseigner dans le fichier .env.</p>
      </Panel>
      <DataTable columns={['Boutique', 'Entrepot stock', 'Cle API', 'Colissimo', 'Statut']} rows={connections.map((connection) => [connection.shopUrl, connection.warehouseId ? warehouseById.get(connection.warehouseId) ?? connection.warehouseId : 'Entrepot principal automatique', connection.hasApiKey ? 'Configuree' : 'Manquante', connection.colissimoLabelEndpointTemplate || connection.hasColissimoBridgeToken ? 'Configure' : 'Non configure', connection.isActive ? 'Actif' : 'Inactif'])} />
    </>
  );
}

function PrestashopSettingsTab({
  connections,
  logs,
  warehouses,
  onSettingsChanged,
  onSyncChanged
}: {
  connections: PrestashopConnection[];
  logs: PrestashopSyncLog[];
  warehouses: Warehouse[];
  onSettingsChanged: () => Promise<void>;
  onSyncChanged: () => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<'settings' | 'sync'>(() => readStoredChoice('oceanerp.settings.prestashopTab', 'settings', ['settings', 'sync'] as const));

  useEffect(() => {
    storeChoice('oceanerp.settings.prestashopTab', activeTab);
  }, [activeTab]);

  return (
    <>
      <div className="browser-tabs sub-tabs" role="tablist" aria-label="PrestaShop">
        <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')} type="button">
          Configuration
        </button>
        <button className={activeTab === 'sync' ? 'active' : ''} onClick={() => setActiveTab('sync')} type="button">
          Synchronisation
        </button>
      </div>
      {activeTab === 'settings' && <PrestashopSettings connections={connections} warehouses={warehouses} onChanged={onSettingsChanged} />}
      {activeTab === 'sync' && <Prestashop connections={connections} logs={logs} onChanged={onSyncChanged} showConfigNote={false} />}
    </>
  );
}

function UsersRoles({ users, roles, permissions, onChanged }: { users: User[]; roles: Role[]; permissions: Permission[]; onChanged: () => Promise<void> }) {
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>(() => readStoredChoice('oceanerp.usersRoles.activeTab', 'users', ['users', 'roles'] as const));
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

  useEffect(() => {
    storeChoice('oceanerp.usersRoles.activeTab', activeTab);
  }, [activeTab]);

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

function Quotes({ items, customers, products, mailAccounts, warehouses, isAdministrator, onChanged }: { items: Quote[]; customers: Customer[]; products: Product[]; mailAccounts: MailAccount[]; warehouses: Warehouse[]; isAdministrator: boolean; onChanged: () => Promise<void> }) {
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

  function firstValidEmail(...values: Array<string | undefined | null>) {
    return values.map((value) => value?.trim()).find((value) => value && value.includes('@')) ?? '';
  }

  function quoteRecipientEmail(quote: Quote) {
    const fullCustomer = customers.find((customer) => customer.id === quote.customerId);
    const primaryContact = fullCustomer?.contacts.find((contact) => contact.isPrimary && contact.email)
      ?? fullCustomer?.contacts.find((contact) => contact.email);

    return firstValidEmail(
      quote.customer?.contactEmail,
      quote.customer?.email,
      primaryContact?.email,
      fullCustomer?.email
    );
  }

  function quoteGreetingName(quote: Quote) {
    return quote.customer?.contactName || quote.customer?.companyName || customers.find((customer) => customer.id === quote.customerId)?.companyName || '';
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

  async function deleteQuote(quote: Quote) {
    if (!window.confirm(`Supprimer le devis ${quote.number} ?`)) {
      return;
    }

    try {
      await api.deleteQuote(quote.id);
      if (selectedQuoteId === quote.id) {
        setSelectedQuoteId(null);
      }

      if (editingQuoteId === quote.id) {
        resetForm();
      }

      setQuoteFeedback(`Devis ${quote.number} supprime.`);
      await onChanged();
    } catch (err) {
      setQuoteFeedback(err instanceof Error ? err.message : 'Suppression du devis impossible.');
    }
  }

  function openEmailModal(quote: Quote) {
    const recipientEmail = quoteRecipientEmail(quote);
    const greetingName = quoteGreetingName(quote);
    setEmailQuoteId(quote.id);
    setMailAccountId(activeMailAccounts[0]?.id ?? '');
    setEmailTo(recipientEmail);
    setEmailCc('');
    setEmailBcc('');
    setEmailSubject(`Devis ${quote.number}`);
    setEmailBody(`Bonjour${greetingName ? ` ${greetingName}` : ''},\n\nVeuillez trouver ci-joint le devis ${quote.number}.\n\nCordialement`);
    setQuoteFeedback(recipientEmail ? null : `Aucun email client trouve pour le devis ${quote.number}. Completez le destinataire avant l'envoi.`);
  }

  function openOrderModal(quote: Quote) {
    setOrderQuoteId(quote.id);
    setOrderWarehouseId('');
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

    try {
      await api.createOrderFromQuote(orderQuoteId, orderWarehouseId || null);
      setOrderQuoteId(null);
      setOrderWarehouseId('');
      setQuoteFeedback('Devis transforme en commande.');
      await onChanged();
    } catch (err) {
      setQuoteFeedback(err instanceof Error ? err.message : 'Transformation en commande impossible.');
    }
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
            <button className="secondary" disabled={item.status !== 'Signed'} onClick={(event) => { event.stopPropagation(); openOrderModal(item); }} type="button">
              <ShoppingCart size={15} />
              Transformer
            </button>
            {isAdministrator && (
              <button className="danger" onClick={(event) => { event.stopPropagation(); void deleteQuote(item); }} type="button">
                <Trash2 size={15} />
                Supprimer
              </button>
            )}
          </div>
        ])}
      />
      {selectedQuote && (
        <QuoteDetailsModal
          quote={selectedQuote}
          onClose={() => setSelectedQuoteId(null)}
          onDownloadPdf={downloadPdf}
          onConvertToOrder={(quote) => {
            setSelectedQuoteId(null);
            openOrderModal(quote);
          }}
          onDeleteQuote={isAdministrator ? deleteQuote : undefined}
        />
      )}
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
            {quoteFeedback && <div className={quoteFeedback.includes('impossible') || quoteFeedback.includes('Only') ? 'alert' : 'sync-note'}>{quoteFeedback}</div>}
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

function QuoteDetailsModal({ quote, onClose, onDownloadPdf, onConvertToOrder, onDeleteQuote }: { quote: Quote; onClose: () => void; onDownloadPdf: (quote: Quote) => Promise<void>; onConvertToOrder: (quote: Quote) => void; onDeleteQuote?: (quote: Quote) => Promise<void> }) {
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
        <div className="modal-actions">
          {quote.status === 'Signed' && (
            <button className="primary" type="button" onClick={() => onConvertToOrder(quote)}>
              <ShoppingCart size={16} />
              Transformer en commande
            </button>
          )}
          <button className="secondary" disabled={quote.documents.length === 0} type="button" onClick={() => void onDownloadPdf(quote)}>
            <Download size={15} />
            PDF
          </button>
          {onDeleteQuote && (
            <button className="danger" type="button" onClick={() => void onDeleteQuote(quote)}>
              <Trash2 size={15} />
              Supprimer
            </button>
          )}
        </div>
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

function Orders({ items, customers, warehouses, isAdministrator, onChanged }: { items: SalesOrder[]; customers: Customer[]; warehouses: Warehouse[]; isAdministrator: boolean; onChanged: () => Promise<void> }) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedOrder = items.find((item) => item.id === selectedOrderId) ?? null;
  const customerById = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const warehouseById = useMemo(() => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])), [warehouses]);

  useEffect(() => {
    if (selectedOrderId && !items.some((item) => item.id === selectedOrderId)) {
      setSelectedOrderId(null);
    }
  }, [items, selectedOrderId]);

  async function changeStatus(order: SalesOrder, status: string): Promise<string | null> {
    setMessage(null);
    try {
      await api.changeOrderStatus(order.id, status);
      await onChanged();
      return null;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Mise a jour du statut impossible.';
      setMessage(error);
      return error;
    }
  }

  async function openShipmentSlip(order: SalesOrder): Promise<string | null> {
    setMessage(null);
    try {
      await api.openOrderShipmentSlip(order.id, order.number);
      return null;
    } catch (err) {
      const error = err instanceof Error ? err.message : "Generation du bon d'expedition impossible.";
      setMessage(error);
      return error;
    }
  }

  async function openColissimoLabel(order: SalesOrder): Promise<string | null> {
    setMessage(null);
    try {
      await api.openOrderColissimoLabel(order.id, order.number);
      return null;
    } catch (err) {
      const error = err instanceof Error ? err.message : "Impression de l'etiquette Colissimo impossible.";
      setMessage(error);
      return error;
    }
  }

  async function deleteOrder(order: SalesOrder): Promise<string | null> {
    setMessage(null);
    if (!window.confirm(`Supprimer la commande ${order.number} ?`)) {
      return null;
    }

    try {
      await api.deleteOrder(order.id);
      if (selectedOrderId === order.id) {
        setSelectedOrderId(null);
      }

      await onChanged();
      return null;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Suppression de la commande impossible.';
      setMessage(error);
      return error;
    }
  }

  return (
    <>
      <div className="sync-note">Les commandes sont creees depuis un devis signe ou importees depuis PrestaShop.</div>
      {message && <div className="inline-message">{message}</div>}
      <DataTable
        columns={['Numero', 'Date', 'Client', 'Transporteur', 'Statut', 'Total', 'Actions']}
        rows={items.map((item) => [
          item.number,
          formatOrderDate(item.orderedAt ?? item.createdAt),
          item.customerName ?? customerById.get(item.customerId)?.companyName ?? item.customerId,
          orderShippingLabel(item),
          item.externalStatusName ?? salesOrderStatusLabel(item.status),
          `${item.total.toFixed(2)} EUR`,
          <div className="table-actions">
            {item.canPrintShippingSlip && (
              <button className="secondary" type="button" onClick={(event) => { event.stopPropagation(); void openShipmentSlip(item); }}>
                <Printer size={15} />
                Bon
              </button>
            )}
            {canPrintOrderColissimoLabel(item) && (
              <button className="secondary" type="button" onClick={(event) => { event.stopPropagation(); void openColissimoLabel(item); }}>
                <Printer size={15} />
                Etiquette
              </button>
            )}
            {item.status === 'Draft' && (
              <button className="secondary" type="button" onClick={(event) => { event.stopPropagation(); void changeStatus(item, 'Confirmed'); }}>
                Confirmer
              </button>
            )}
            {item.status === 'Confirmed' && (
              <button className="secondary" type="button" onClick={(event) => { event.stopPropagation(); void changeStatus(item, 'Preparing'); }}>
                Preparer
              </button>
            )}
            {(item.status === 'Confirmed' || item.status === 'Preparing') && (
              <button className="secondary" type="button" onClick={(event) => { event.stopPropagation(); void changeStatus(item, 'Shipped'); }}>
                Expedier
              </button>
            )}
            {item.status === 'Shipped' && (
              <button className="secondary" type="button" onClick={(event) => { event.stopPropagation(); void changeStatus(item, 'Completed'); }}>
                Terminer
              </button>
            )}
            {isAdministrator && (
              <button className="danger" type="button" disabled={item.status === 'Shipped' || item.status === 'Completed'} onClick={(event) => { event.stopPropagation(); void deleteOrder(item); }}>
                <Trash2 size={15} />
                Supprimer
              </button>
            )}
          </div>
        ])}
        onRowClick={(index) => setSelectedOrderId(items[index]?.id ?? null)}
        selectedRowIndex={selectedOrder ? items.findIndex((item) => item.id === selectedOrder.id) : undefined}
      />
      {selectedOrder && (
        <SalesOrderDetailModal
          order={selectedOrder}
          customer={customerById.get(selectedOrder.customerId)}
          warehouse={selectedOrder.warehouseId ? warehouseById.get(selectedOrder.warehouseId) : undefined}
          onClose={() => setSelectedOrderId(null)}
          onPrintShipmentSlip={() => openShipmentSlip(selectedOrder)}
          onPrintColissimoLabel={() => openColissimoLabel(selectedOrder)}
          onChangeStatus={(status) => changeStatus(selectedOrder, status)}
          onDeleteOrder={isAdministrator ? () => deleteOrder(selectedOrder) : undefined}
        />
      )}
    </>
  );
}

function salesOrderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    Draft: 'Brouillon',
    Confirmed: 'Confirmee',
    Preparing: 'Preparation',
    Shipped: 'Expediee',
    Completed: 'Terminee',
    Cancelled: 'Annulee'
  };
  return labels[status] ?? status;
}

function formatOrderDate(value?: string | null) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('fr-FR');
}

function orderShippingLabel(order: SalesOrder) {
  return order.shippingServiceName ?? order.shippingCarrierName ?? '-';
}

function canPrintOrderColissimoLabel(order: SalesOrder) {
  return Boolean(
    order.canPrintColissimoLabel
    || order.canPrintShippingSlip
    || order.shippingServiceName?.toLowerCase().includes('colissimo')
    || order.shippingCarrierName?.toLowerCase().includes('colissimo')
  );
}

function SalesOrderDetailModal({
  order,
  customer,
  warehouse,
  onClose,
  onPrintShipmentSlip,
  onPrintColissimoLabel,
  onChangeStatus,
  onDeleteOrder
}: {
  order: SalesOrder;
  customer?: Customer;
  warehouse?: Warehouse;
  onClose: () => void;
  onPrintShipmentSlip: () => Promise<string | null>;
  onPrintColissimoLabel: () => Promise<string | null>;
  onChangeStatus: (status: string) => Promise<string | null>;
  onDeleteOrder?: () => Promise<string | null>;
}) {
  const address = order.shippingAddress;
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [printingSlip, setPrintingSlip] = useState(false);
  const [printingLabel, setPrintingLabel] = useState(false);
  const [changingStatus, setChangingStatus] = useState<string | null>(null);
  const [deletingOrder, setDeletingOrder] = useState(false);
  const nextActions = [
    order.status === 'Draft' ? { label: 'Confirmer', status: 'Confirmed' } : null,
    order.status === 'Confirmed' ? { label: 'Preparer', status: 'Preparing' } : null,
    order.status === 'Confirmed' || order.status === 'Preparing' ? { label: 'Expedier', status: 'Shipped' } : null,
    order.status === 'Shipped' ? { label: 'Terminer', status: 'Completed' } : null
  ].filter((item): item is { label: string; status: string } => Boolean(item));
  const statusSuccessMessages: Record<string, string> = {
    Confirmed: 'Commande confirmee.',
    Preparing: 'Commande en preparation.',
    Shipped: 'Commande expediee.',
    Completed: 'Commande terminee.'
  };

  async function handlePrintShipmentSlip() {
    setActionMessage("Preparation du bon d'expedition...");
    setPrintingSlip(true);
    const error = await onPrintShipmentSlip();
    setPrintingSlip(false);
    setActionMessage(error ?? "Ouverture du bon d'expedition lancee.");
  }

  async function handlePrintColissimoLabel() {
    setActionMessage("Recherche de l'etiquette Colissimo...");
    setPrintingLabel(true);
    const error = await onPrintColissimoLabel();
    setPrintingLabel(false);
    setActionMessage(error ?? "Ouverture de l'etiquette Colissimo lancee.");
  }

  async function handleChangeStatus(status: string) {
    setActionMessage('Mise a jour du statut...');
    setChangingStatus(status);
    const error = await onChangeStatus(status);
    setChangingStatus(null);
    setActionMessage(error ?? statusSuccessMessages[status] ?? 'Statut mis a jour.');
  }

  async function handleDeleteOrder() {
    if (!onDeleteOrder) {
      return;
    }

    setActionMessage('Suppression de la commande...');
    setDeletingOrder(true);
    const error = await onDeleteOrder();
    setDeletingOrder(false);
    setActionMessage(error ?? 'Commande supprimee.');
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal-panel order-modal" role="dialog" aria-modal="true" aria-label={`Commande ${order.number}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">Commande</span>
            <h2>{order.number}</h2>
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="modal-actions">
          {order.canPrintShippingSlip && (
            <button className="secondary" type="button" disabled={printingSlip} onClick={() => void handlePrintShipmentSlip()}>
              <Printer size={16} />
              {printingSlip ? 'Preparation...' : "Imprimer le bon d'expedition"}
            </button>
          )}
          {canPrintOrderColissimoLabel(order) && (
            <button className="secondary" type="button" disabled={printingLabel} onClick={() => void handlePrintColissimoLabel()}>
              <Printer size={16} />
              {printingLabel ? 'Recherche...' : "Imprimer l'etiquette Colissimo"}
            </button>
          )}
          {nextActions.map((action) => (
            <button className="secondary" type="button" key={action.status} disabled={Boolean(changingStatus)} onClick={() => void handleChangeStatus(action.status)}>
              {changingStatus === action.status ? 'Traitement...' : action.label}
            </button>
          ))}
          {onDeleteOrder && (
            <button className="danger" type="button" disabled={deletingOrder || order.status === 'Shipped' || order.status === 'Completed'} onClick={() => void handleDeleteOrder()}>
              <Trash2 size={16} />
              {deletingOrder ? 'Suppression...' : 'Supprimer'}
            </button>
          )}
        </div>
        {actionMessage && <div className="inline-message">{actionMessage}</div>}

        <div className="detail-grid">
          <DetailItem label="Client" value={order.customerName ?? customer?.companyName ?? order.customerId} />
          <DetailItem label="Statut ERP" value={salesOrderStatusLabel(order.status)} />
          <DetailItem label="Statut PrestaShop" value={order.externalStatusName ?? '-'} />
          <DetailItem label="Entrepot" value={order.warehouseName ?? warehouse?.name ?? '-'} />
          <DetailItem label="Total" value={purchaseAmount(order.total)} />
          <DetailItem label="Commande boutique le" value={formatOrderDate(order.orderedAt ?? order.createdAt)} />
          <DetailItem label="Creee ERP le" value={formatOrderDate(order.createdAt)} />
          <DetailItem label="Confirmee le" value={formatOrderDate(order.confirmedAt)} />
          <DetailItem label="Expediee le" value={formatOrderDate(order.shippedAt)} />
          <DetailItem label="Terminee le" value={formatOrderDate(order.completedAt)} />
          <DetailItem label="Paiement" value={order.paymentMethod ?? '-'} />
          <DetailItem label="Module paiement" value={order.paymentModule ?? '-'} />
          <DetailItem label="Total paye" value={order.paidTotal === undefined || order.paidTotal === null ? '-' : purchaseAmount(order.paidTotal)} />
          <DetailItem label="Total produits" value={order.productsTotal === undefined || order.productsTotal === null ? '-' : purchaseAmount(order.productsTotal)} />
          <DetailItem label="Frais de port" value={order.shippingTotal === undefined || order.shippingTotal === null ? '-' : purchaseAmount(order.shippingTotal)} />
          <DetailItem label="Poids" value={order.shippingWeightKg === undefined || order.shippingWeightKg === null ? '-' : `${order.shippingWeightKg.toLocaleString('fr-FR')} kg`} />
          <DetailItem label="Facture" value={order.invoiceReference ?? '-'} />
        </div>

        <section className="customer-detail-section">
          <h3>Livraison</h3>
          <div className="detail-grid">
            <DetailItem label="Service" value={order.shippingServiceName ?? '-'} />
            <DetailItem label="Transporteur" value={order.shippingCarrierName ?? '-'} />
            <DetailItem label="Suivi" value={order.shippingTrackingNumber ?? '-'} />
            <DetailItem label="Nom" value={address?.name ?? '-'} />
            <DetailItem label="Telephone" value={address?.phone ?? '-'} />
            <DetailItem label="Email" value={address?.email ?? '-'} />
            <DetailItem label="Adresse" value={[address?.line1, address?.line2, [address?.postalCode, address?.city].filter(Boolean).join(' '), address?.country].filter(Boolean).join(' - ') || '-'} />
          </div>
        </section>

        <section className="customer-detail-section">
          <h3>Lignes</h3>
          <DataTable
            columns={['Designation', 'Quantite', 'PU HT', 'Total HT']}
            rows={order.lines.map((line) => [
              line.description,
              line.quantity.toLocaleString('fr-FR'),
              purchaseAmount(line.unitPrice),
              purchaseAmount(line.lineTotal)
            ])}
          />
        </section>

        <section className="customer-detail-section">
          <h3>Historique</h3>
          <DataTable
            columns={['Statut', 'Date']}
            rows={(order.statusHistory ?? []).map((history) => [
              salesOrderStatusLabel(history.status),
              formatOrderDate(history.changedAt)
            ])}
          />
        </section>
      </section>
    </div>
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

function invoiceStatusLabel(status: string) {
  const labels: Record<string, string> = {
    Draft: 'Brouillon',
    Issued: 'Emise',
    PartiallyPaid: 'Partiellement payee',
    Paid: 'Payee',
    Overdue: 'En retard',
    Cancelled: 'Annulee'
  };
  return labels[status] ?? status;
}

function invoiceKindLabel(kind: string) {
  return kind === 'CreditNote' ? 'Avoir' : 'Facture';
}

function Invoices({ items, orders, onChanged }: { items: Invoice[]; orders: SalesOrder[]; onChanged: () => Promise<void> }) {
  const [orderId, setOrderId] = useState('');
  const [paymentInvoiceId, setPaymentInvoiceId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('0');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

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

  async function cancelInvoice(invoice: Invoice) {
    if (!window.confirm(`Annuler la facture ${invoice.number} ?`)) {
      return;
    }

    await api.cancelInvoice(invoice.id);
    await onChanged();
  }

  async function createCreditNote(invoice: Invoice) {
    await api.createInvoiceCreditNote(invoice.id);
    await onChanged();
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
        columns={['Type', 'Numero', 'Client', 'Origine', 'Statut', 'Echeance', 'Total', 'Solde', 'Factur-X', 'Actions']}
        rows={items.map((item) => [
          invoiceKindLabel(item.kind),
          item.number,
          item.customerName,
          item.kind === 'CreditNote' ? `Avoir de ${item.creditOfInvoiceNumber ?? '-'}` : item.salesOrderNumber ?? '-',
          invoiceStatusLabel(item.status),
          formatOrderDate(item.dueDate),
          `${item.total.toFixed(2)} EUR`,
          `${item.balanceDue.toFixed(2)} EUR`,
          item.facturXReady ? item.facturXProfile : 'A preparer',
          <div className="table-actions">
            <button className="secondary" onClick={(event) => { event.stopPropagation(); void generatePdf(item); }} type="button">
              <FileText size={15} />
              Generer
            </button>
            <button className="secondary" disabled={item.documents.length === 0} onClick={(event) => { event.stopPropagation(); void downloadPdf(item); }} type="button">
              <Download size={15} />
              PDF
            </button>
            <button className="secondary" onClick={(event) => { event.stopPropagation(); void api.downloadInvoiceFacturX(item.id, item.number); }} type="button">
              XML
            </button>
            <button className="secondary" disabled={item.kind === 'CreditNote' || item.status === 'Cancelled'} onClick={(event) => { event.stopPropagation(); void createCreditNote(item); }} type="button">
              Avoir
            </button>
            <button className="danger" disabled={item.status === 'Paid' || item.status === 'Cancelled' || item.paidTotal > 0} onClick={(event) => { event.stopPropagation(); void cancelInvoice(item); }} type="button">
              <X size={15} />
              Annuler
            </button>
          </div>
        ])}
        onRowClick={(index) => setSelectedInvoice(items[index])}
      />
      {selectedInvoice && (
        <div className="modal-backdrop" onClick={() => setSelectedInvoice(null)}>
          <section className="modal-panel order-detail-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <div>
                <p className="eyebrow">{invoiceKindLabel(selectedInvoice.kind)}</p>
                <h2>{selectedInvoice.number}</h2>
              </div>
              <button className="modal-close" type="button" aria-label="Fermer" title="Fermer" onClick={() => setSelectedInvoice(null)}>
                <X size={18} />
              </button>
            </header>
            <section className="detail-grid">
              <DetailItem label="Client" value={selectedInvoice.customerName} />
              <DetailItem label="Commande" value={selectedInvoice.salesOrderNumber ?? '-'} />
              <DetailItem label="Avoir de" value={selectedInvoice.creditOfInvoiceNumber ?? '-'} />
              <DetailItem label="Statut" value={invoiceStatusLabel(selectedInvoice.status)} />
              <DetailItem label="Emission" value={formatOrderDate(selectedInvoice.issueDate)} />
              <DetailItem label="Echeance" value={formatOrderDate(selectedInvoice.dueDate)} />
              <DetailItem label="Total" value={`${selectedInvoice.total.toFixed(2)} EUR`} />
              <DetailItem label="Regle" value={`${selectedInvoice.paidTotal.toFixed(2)} EUR`} />
              <DetailItem label="Solde" value={`${selectedInvoice.balanceDue.toFixed(2)} EUR`} />
              <DetailItem label="Factur-X" value={selectedInvoice.facturXReady ? `Pret profil ${selectedInvoice.facturXProfile}` : 'A preparer'} />
            </section>
            <h3>Lignes</h3>
            <DataTable
              columns={['Designation', 'Quantite', 'PU HT', 'Total HT']}
              rows={selectedInvoice.lines.map((line) => [line.description, line.quantity, `${line.unitPrice.toFixed(2)} EUR`, `${line.lineTotal.toFixed(2)} EUR`])}
            />
            <h3>Historique</h3>
            <DataTable
              columns={['Statut', 'Date']}
              rows={selectedInvoice.statusHistory.map((history) => [invoiceStatusLabel(history.status), formatOrderDate(history.changedAt)])}
            />
            <div className="modal-footer">
              <button className="secondary" type="button" onClick={() => void generatePdf(selectedInvoice)}>
                <FileText size={15} />
                Generer PDF
              </button>
              <button className="secondary" disabled={selectedInvoice.documents.length === 0} type="button" onClick={() => void downloadPdf(selectedInvoice)}>
                <Download size={15} />
                Telecharger PDF
              </button>
              <button className="secondary" type="button" onClick={() => void api.downloadInvoiceFacturX(selectedInvoice.id, selectedInvoice.number)}>
                XML Factur-X
              </button>
              <button className="secondary" disabled={selectedInvoice.kind === 'CreditNote' || selectedInvoice.status === 'Cancelled'} type="button" onClick={() => void createCreditNote(selectedInvoice)}>
                Creer un avoir
              </button>
            </div>
          </section>
        </div>
      )}
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
  const [activeStockTab, setActiveStockTab] = useState<'items' | 'movements'>(() => readStoredChoice('oceanerp.stock.activeTab', 'items', ['items', 'movements'] as const));
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

  useEffect(() => {
    storeChoice('oceanerp.stock.activeTab', activeStockTab);
  }, [activeStockTab]);

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

type EmailRecipientSuggestion = CustomerEmailSuggestion & {
  isList?: boolean;
  emails?: string[];
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

function formatDistributionListMembers(list: EmailDistributionList) {
  return list.members
    .map((member) => (member.name ? `${member.name} <${member.email}>` : member.email))
    .join('\n');
}

function parseDistributionListMembers(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const angleMatch = line.match(/^(.*?)<([^>]+)>$/);
      if (angleMatch) {
        return { name: angleMatch[1].trim() || null, email: angleMatch[2].trim() };
      }

      const separator = line.includes(';') ? ';' : line.includes(',') ? ',' : '';
      if (separator) {
        const [name, email] = line.split(separator, 2);
        return { name: name.trim() || null, email: email.trim() };
      }

      return { name: null, email: line };
    });
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

function Emails({ accounts, messages, templates, distributionLists, customers, onChanged }: { accounts: MailAccount[]; messages: EmailMessage[]; templates: EmailTemplate[]; distributionLists: EmailDistributionList[]; customers: Customer[]; onChanged: () => Promise<void> }) {
  const [tab, setTab] = useState<'accounts' | 'compose' | 'messages' | 'templates' | 'lists'>(() => readStoredChoice('oceanerp.emails.activeTab', 'messages', ['accounts', 'compose', 'messages', 'templates', 'lists'] as const));
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
  const [editingListId, setEditingListId] = useState('');
  const [distributionListName, setDistributionListName] = useState('');
  const [distributionListDescription, setDistributionListDescription] = useState('');
  const [distributionListActive, setDistributionListActive] = useState(true);
  const [distributionListMembersText, setDistributionListMembersText] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const onChangedRef = useRef(onChanged);
  const messageAccountFilterRef = useRef(messageAccountFilter);
  const emailSyncInProgressRef = useRef(false);

  const selectedMessage = selectedMessageDetail ?? (selectedMessageId ? messages.find((message) => message.id === selectedMessageId) : undefined);
  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const activeAccounts = accounts.filter((account) => account.isActive);
  const customerEmailSuggestions = useMemo(() => buildCustomerEmailSuggestions(customers), [customers]);
  const distributionListSuggestions = useMemo<EmailRecipientSuggestion[]>(() => distributionLists
    .filter((list) => list.isActive && list.members.length > 0)
    .map((list) => ({
      key: `list:${list.id}`,
      email: list.members.map((member) => member.email).join(', '),
      emails: list.members.map((member) => member.email),
      isList: true,
      label: list.name,
      meta: `${list.members.length} destinataire(s)`,
      searchText: `${list.name} ${list.description ?? ''} ${list.members.map((member) => `${member.name ?? ''} ${member.email}`).join(' ')}`.toLowerCase()
    })), [distributionLists]);
  const recipientSuggestions = useMemo<EmailRecipientSuggestion[]>(() => {
    const term = activeRecipientTerm(to);
    const alreadySelected = new Set(recipientTokensBeforeActive(to));
    const customerRecipientSuggestions: EmailRecipientSuggestion[] = customerEmailSuggestions;

    return [...distributionListSuggestions, ...customerRecipientSuggestions]
      .filter((suggestion) => suggestion.isList || !alreadySelected.has(suggestion.email.toLowerCase()))
      .filter((suggestion) => !term || suggestion.searchText.includes(term))
      .slice(0, 8);
  }, [customerEmailSuggestions, distributionListSuggestions, to]);
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
    storeChoice('oceanerp.emails.activeTab', tab);
  }, [tab]);

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

  function selectRecipientSuggestion(suggestion: EmailRecipientSuggestion) {
    setTo((current) => replaceActiveRecipient(current, suggestion.isList ? suggestion.email : suggestion.email));
    setRecipientSuggestionsOpen(false);
  }

  function resetDistributionListForm() {
    setEditingListId('');
    setDistributionListName('');
    setDistributionListDescription('');
    setDistributionListActive(true);
    setDistributionListMembersText('');
  }

  function startEditDistributionList(list: EmailDistributionList) {
    setEditingListId(list.id);
    setDistributionListName(list.name);
    setDistributionListDescription(list.description ?? '');
    setDistributionListActive(list.isActive);
    setDistributionListMembersText(formatDistributionListMembers(list));
    setTab('lists');
  }

  async function saveDistributionList(event: FormEvent) {
    event.preventDefault();
    const payload = {
      name: distributionListName,
      description: distributionListDescription || null,
      isActive: distributionListActive,
      members: parseDistributionListMembers(distributionListMembersText)
    };

    try {
      if (editingListId) {
        await api.updateEmailDistributionList(editingListId, payload);
        setFeedback('Liste de diffusion mise a jour.');
      } else {
        await api.createEmailDistributionList(payload);
        setFeedback('Liste de diffusion creee.');
      }

      resetDistributionListForm();
      await onChanged();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Enregistrement de la liste impossible.');
    }
  }

  async function deleteDistributionList(list: EmailDistributionList) {
    if (!window.confirm(`Supprimer la liste "${list.name}" ?`)) {
      return;
    }

    try {
      await api.deleteEmailDistributionList(list.id);
      if (editingListId === list.id) {
        resetDistributionListForm();
      }
      setFeedback('Liste de diffusion supprimee.');
      await onChanged();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Suppression de la liste impossible.');
    }
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
        <button className={tab === 'lists' ? 'active' : ''} type="button" onClick={() => setTab('lists')}>
          Listes de diffusion
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
                  <div className="recipient-suggestions" role="listbox" aria-label="Suggestions destinataires">
                    {recipientSuggestions.map((suggestion) => (
                      <button key={suggestion.key} type="button" role="option" onMouseDown={(event) => { event.preventDefault(); selectRecipientSuggestion(suggestion); }}>
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

      {tab === 'lists' && (
        <div className="tab-page">
          <Panel title={editingListId ? 'Modifier liste de diffusion' : 'Nouvelle liste de diffusion'}>
            <form className="email-template-form" onSubmit={saveDistributionList}>
              <div className="form-grid">
                <label className="field">
                  <span>Nom de la liste</span>
                  <input required placeholder="Clients VIP, Fournisseurs, Newsletter..." value={distributionListName} onChange={(event) => setDistributionListName(event.target.value)} />
                </label>
                <label className="field">
                  <span>Description</span>
                  <input placeholder="Usage interne de la liste" value={distributionListDescription} onChange={(event) => setDistributionListDescription(event.target.value)} />
                </label>
                <label className="check-field">
                  <input type="checkbox" checked={distributionListActive} onChange={(event) => setDistributionListActive(event.target.checked)} />
                  Liste active
                </label>
              </div>
              <label className="field full-field">
                <span>Destinataires</span>
                <textarea
                  required
                  className="mail-body-input distribution-list-members-input"
                  placeholder={'Une adresse par ligne\nVictor Lerivray <victor@example.com>\nService achats;achats@example.com\ncontact@example.com'}
                  value={distributionListMembersText}
                  onChange={(event) => setDistributionListMembersText(event.target.value)}
                />
              </label>
              <p className="helper-text">Ces listes apparaissent ensuite dans le champ Destinataire du nouveau mail.</p>
              <div className="modal-footer">
                {editingListId && (
                  <button className="secondary" type="button" onClick={resetDistributionListForm}>
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
            columns={['Liste', 'Description', 'Destinataires', 'Statut', 'Actions']}
            rows={distributionLists.map((list) => [
              list.name,
              list.description || '-',
              <div className="distribution-list-members" key={`${list.id}-members`}>
                <strong>{list.members.length} contact(s)</strong>
                <span>{list.members.slice(0, 4).map((member) => member.name ? `${member.name} <${member.email}>` : member.email).join(', ')}</span>
                {list.members.length > 4 && <small>+ {list.members.length - 4} autre(s)</small>}
              </div>,
              list.isActive ? 'Actif' : 'Inactif',
              <div className="table-actions" key={list.id}>
                <button className="secondary icon-button" type="button" title="Modifier" onClick={() => startEditDistributionList(list)}>
                  <Pencil size={16} />
                </button>
                <button className="danger icon-button" type="button" title="Supprimer" onClick={() => deleteDistributionList(list)}>
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

function Prestashop({ connections, logs, onChanged, showConfigNote = true }: { connections: PrestashopConnection[]; logs: PrestashopSyncLog[]; onChanged: () => Promise<void>; showConfigNote?: boolean }) {
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
        <p className="panel-note">{showConfigNote ? 'La configuration des boutiques et des cles API se fait dans Parametres avec un compte administrateur.' : 'Synchronisez manuellement les produits, clients, commandes et stocks de la boutique depuis cet onglet administrateur.'}</p>
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
type DriveOfficeSession = { file: DriveItem; config: OnlyOfficeConfig };
type OnlyOfficeBridgeMessage = {
  source?: string;
  editorId?: string;
  type?: 'loaded' | 'ready' | 'error' | 'request-close';
  message?: string;
};

function resolveOnlyOfficeServerUrl(documentServerUrl: string) {
  const value = (documentServerUrl || '/onlyoffice').trim() || '/onlyoffice';
  try {
    return new URL(value.replace(/\/+$/, ''), window.location.origin).toString().replace(/\/+$/, '');
  } catch {
    return value.replace(/\/+$/, '');
  }
}

function isImageDriveFile(file: DriveItem) {
  return file.mimeType.toLowerCase().startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name);
}

function isPdfDriveFile(file: DriveItem) {
  return file.mimeType.toLowerCase().includes('pdf') || /\.pdf$/i.test(file.name);
}

function isTextDriveFile(file: DriveItem) {
  return file.mimeType.toLowerCase().startsWith('text/') || /\.(txt|csv|json|xml|md)$/i.test(file.name);
}

function isOfficeDriveFile(file: DriveItem) {
  return /\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf)$/i.test(file.name);
}

function isSpreadsheetDriveFile(file: DriveItem) {
  return /\.(xlsx?|ods)$/i.test(file.name);
}

function getOnlyOfficeEditorConfig(config: OnlyOfficeConfig) {
  return {
    documentType: config.documentType,
    type: config.type,
    document: config.document,
    editorConfig: config.editorConfig,
    token: config.token
  };
}

function stringifyForOnlyOfficeFrame(value: unknown) {
  return (JSON.stringify(value) ?? 'null')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function getOnlyOfficeFrameHtml(editorId: string, config: OnlyOfficeConfig) {
  const scriptUrl = `${resolveOnlyOfficeServerUrl(config.documentServerUrl)}/web-apps/apps/api/documents/api.js`;
  const editorConfig = getOnlyOfficeEditorConfig(config);

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    html, body, #placeholder {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: #f8fafc;
    }

    #status {
      position: fixed;
      inset: 0;
      z-index: 10;
      display: grid;
      place-items: center;
      padding: 24px;
      background: #f8fafc;
      color: #334155;
      font: 700 15px/1.4 Arial, sans-serif;
      text-align: center;
    }

    #status.hidden {
      display: none;
    }

    #status.error {
      color: #991b1b;
      background: #fff5f5;
    }
  </style>
</head>
<body>
  <div id="placeholder"></div>
  <div id="status">Connexion a ONLYOFFICE...</div>
  <script>
    (function () {
      var editorId = ${stringifyForOnlyOfficeFrame(editorId)};
      var scriptUrl = ${stringifyForOnlyOfficeFrame(scriptUrl)};
      var config = ${stringifyForOnlyOfficeFrame(editorConfig)};
      var parentWindow = window.opener && !window.opener.closed ? window.opener : (window.parent !== window ? window.parent : null);
      var editorInstance = null;

      function setStatus(message, isError) {
        var status = document.getElementById('status');
        if (!status) {
          return;
        }

        if (!message) {
          status.className = 'hidden';
          status.textContent = '';
          return;
        }

        status.className = isError ? 'error' : '';
        status.textContent = message;
      }

      function post(type, message) {
        if (!parentWindow) {
          return;
        }

        parentWindow.postMessage({
          source: 'oceanerp.onlyoffice',
          editorId: editorId,
          type: type,
          message: message || ''
        }, '*');
      }

      function callOriginal(callback, args) {
        if (typeof callback === 'function') {
          try {
            callback.apply(null, args);
          } catch (error) {
            post('error', error && error.message ? error.message : String(error));
          }
        }
      }

      window.onerror = function (message, source, line, column, error) {
        setStatus(error && error.message ? error.message : String(message || 'Erreur JavaScript ONLYOFFICE.'), true);
        post('error', error && error.message ? error.message : String(message || 'Erreur JavaScript ONLYOFFICE.'));
        return false;
      };

      window.addEventListener('beforeunload', function () {
        try {
          if (editorInstance && typeof editorInstance.destroyEditor === 'function') {
            editorInstance.destroyEditor();
          }
        } catch (error) {
          // Fermeture de fenetre: on evite de bloquer l'utilisateur pour une erreur de nettoyage ONLYOFFICE.
        }
      });

      var script = document.createElement('script');
      script.src = scriptUrl;
      script.async = true;
      script.onload = function () {
        try {
          if (!window.DocsAPI || !window.DocsAPI.DocEditor) {
            throw new Error('ONLYOFFICE DocsAPI indisponible.');
          }

          var originalEvents = config.events || {};
          config.events = Object.assign({}, originalEvents, {
            onAppReady: function () {
              setStatus('Chargement du document dans ONLYOFFICE...', false);
              post('loaded');
              callOriginal(originalEvents.onAppReady, arguments);
            },
            onDocumentReady: function () {
              setStatus('', false);
              post('ready');
              callOriginal(originalEvents.onDocumentReady, arguments);
            },
            onError: function (event) {
              var raw = event && event.data ? JSON.stringify(event.data) : '';
              setStatus(raw || 'Erreur ONLYOFFICE pendant l edition.', true);
              post('error', raw || 'Erreur ONLYOFFICE pendant l edition.');
              callOriginal(originalEvents.onError, arguments);
            },
            onRequestClose: function () {
              post('request-close');
              callOriginal(originalEvents.onRequestClose, arguments);
            }
          });

          editorInstance = new window.DocsAPI.DocEditor('placeholder', config);
          window.oceanErpOnlyOfficeEditor = editorInstance;
        } catch (error) {
          setStatus(error && error.message ? error.message : String(error), true);
          post('error', error && error.message ? error.message : String(error));
        }
      };
      script.onerror = function () {
        setStatus('Chargement ONLYOFFICE impossible depuis ' + scriptUrl + '.', true);
        post('error', 'Chargement ONLYOFFICE impossible depuis ' + scriptUrl + '.');
      };
      document.head.appendChild(script);
    })();
  </script>
</body>
</html>`;
}

function buildOnlyOfficeEditorId(file: DriveItem, suffix = '') {
  return `onlyoffice-editor-${file.id.replace(/[^a-z0-9]/gi, '')}${suffix}`;
}

function cleanupOnlyOfficePopupSessions() {
  const prefix = 'oceanerp.onlyoffice.session.';
  const now = Date.now();
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix)) {
      continue;
    }

    try {
      const value = JSON.parse(localStorage.getItem(key) ?? '{}') as { expiresAt?: number };
      if (!value.expiresAt || value.expiresAt < now) {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  }
}

function buildOnlyOfficePopupUrl(sessionKey: string) {
  const url = new URL('/onlyoffice-editor.html', window.location.origin);
  url.searchParams.set('session', sessionKey);
  return url.toString();
}

function openOnlyOfficeDetachedWindow(file: DriveItem, config: OnlyOfficeConfig) {
  const editorId = buildOnlyOfficeEditorId(file, `-${Date.now()}`);
  const sessionKey = `oceanerp.onlyoffice.session.${editorId}`;
  cleanupOnlyOfficePopupSessions();
  localStorage.setItem(sessionKey, JSON.stringify({
    editorId,
    title: file.name,
    scriptUrl: `${resolveOnlyOfficeServerUrl(config.documentServerUrl)}/web-apps/apps/api/documents/api.js`,
    config: getOnlyOfficeEditorConfig(config),
    expiresAt: Date.now() + 6 * 60 * 60 * 1000
  }));

  const opened = window.open(buildOnlyOfficePopupUrl(sessionKey), `oceanerp-onlyoffice-${file.id}`, 'popup,width=1600,height=980,resizable,scrollbars');
  if (!opened) {
    localStorage.removeItem(sessionKey);
    return false;
  }

  try {
    opened.document.title = `ONLYOFFICE - ${file.name}`;
  } catch {
    // La fenetre peut deja avoir navigue vers la page hebergee par l'ERP.
  }
  opened.focus();
  return true;
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
  const [officeSession, setOfficeSession] = useState<DriveOfficeSession | null>(null);

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

  async function openOnlyOffice(file: DriveItem) {
    setMessage(null);
    try {
      const config = await api.onlyOfficeConfig(file.id);
      if (isSpreadsheetDriveFile(file) && openOnlyOfficeDetachedWindow(file, config)) {
        setMessage("Tableur ouvert dans une fenetre separee. Cette isolation evite qu'un fichier Excel lourd bloque l'ERP.");
        return;
      }

      if (isSpreadsheetDriveFile(file)) {
        setMessage("Le navigateur a bloque la fenetre separee. Ouverture integree en secours, mais un fichier Excel lourd peut rester lent.");
      }

      setOfficeSession({ file, config });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ouverture ONLYOFFICE impossible');
    }
  }

  async function closeOnlyOffice() {
    setOfficeSession(null);
    await refreshDrive();
    await onChanged();
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
                  {isOfficeDriveFile(file) && (
                    <button className="secondary" type="button" onClick={() => void openOnlyOffice(file)}>
                      <FileText size={15} />
                      Office
                    </button>
                  )}
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
      {officeSession && (
        <OnlyOfficeEditorModal session={officeSession} onClose={() => void closeOnlyOffice()} />
      )}
    </>
  );
}

function OnlyOfficeEditorModal({ session, onClose }: { session: DriveOfficeSession; onClose: () => void }) {
  const editorId = useMemo(() => buildOnlyOfficeEditorId(session.file), [session.file.id]);
  const [frameHtml] = useState(() => getOnlyOfficeFrameHtml(editorId, session.config));
  const [status, setStatus] = useState('Chargement de l editeur ONLYOFFICE...');
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setStatus('Connexion a ONLYOFFICE...');
    const readyFallbackTimer = window.setTimeout(() => {
      if (!cancelled) {
        setStatus((current) => current.startsWith('Erreur ONLYOFFICE') ? current : '');
      }
    }, 12000);

    const handleOnlyOfficeMessage = (event: MessageEvent<OnlyOfficeBridgeMessage>) => {
      const data = event.data;
      if (!data || data.source !== 'oceanerp.onlyoffice' || data.editorId !== editorId) {
        return;
      }

      if (data.type === 'loaded') {
        setStatus('Chargement du document dans ONLYOFFICE...');
        return;
      }

      window.clearTimeout(readyFallbackTimer);
      if (data.type === 'ready') {
        setStatus('');
      } else if (data.type === 'error') {
        setStatus(data.message ? `Erreur ONLYOFFICE : ${data.message}` : 'Erreur ONLYOFFICE pendant l edition.');
      } else if (data.type === 'request-close') {
        onCloseRef.current();
      }
    };

    window.addEventListener('message', handleOnlyOfficeMessage);

    return () => {
      cancelled = true;
      window.clearTimeout(readyFallbackTimer);
      window.removeEventListener('message', handleOnlyOfficeMessage);
    };
  }, [editorId]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal-panel onlyoffice-dialog" role="dialog" aria-modal="true" aria-labelledby="onlyoffice-title" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header onlyoffice-header">
          <div>
            <p className="eyebrow">ONLYOFFICE</p>
            <h2 id="onlyoffice-title">{session.file.name}</h2>
          </div>
          <div className="modal-actions">
            <button
              className="secondary"
              type="button"
              onClick={() => {
                if (!openOnlyOfficeDetachedWindow(session.file, session.config)) {
                  setStatus("Le navigateur a bloque l'ouverture dans une fenetre separee.");
                }
              }}
            >
              <FileText size={15} />
              Fenetre separee
            </button>
            <button className="modal-close" type="button" aria-label="Fermer" title="Fermer" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </header>
        <div className="onlyoffice-frame">
          {status && <div className="onlyoffice-status">{status}</div>}
          <iframe
            key={editorId}
            className="onlyoffice-host"
            title={`ONLYOFFICE - ${session.file.name}`}
            srcDoc={frameHtml}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
            allow="clipboard-read; clipboard-write; fullscreen"
          />
        </div>
      </section>
    </div>
  );
}

function ServiceTickets({
  items,
  customers,
  products,
  orders,
  users,
  createOpen,
  onCloseCreate,
  onChanged
}: {
  items: ServiceTicket[];
  customers: Customer[];
  products: Product[];
  orders: SalesOrder[];
  users: User[];
  createOpen: boolean;
  onCloseCreate: () => void;
  onChanged: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<ServiceTicket | null>(null);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState({
    customerId: '',
    productId: '',
    salesOrderId: '',
    assignedUserId: '',
    subject: '',
    description: '',
    priority: 'Normal'
  });
  const activeUsers = users.filter((user) => user.isActive);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!draft.customerId || !draft.subject.trim()) {
      return;
    }

    await api.createServiceTicket({
      customerId: draft.customerId,
      subject: draft.subject,
      description: draft.description || null,
      productId: draft.productId || null,
      salesOrderId: draft.salesOrderId || null,
      priority: draft.priority,
      assignedUserId: draft.assignedUserId || null
    });
    setDraft({ customerId: '', productId: '', salesOrderId: '', assignedUserId: '', subject: '', description: '', priority: 'Normal' });
    await onChanged();
    onCloseCreate();
  }

  async function changeStatus(ticket: ServiceTicket, status: string) {
    const updated = await api.changeServiceTicketStatus(ticket.id, status);
    setSelected(updated);
    await onChanged();
  }

  async function assignTicket(ticket: ServiceTicket, assignedUserId: string) {
    const updated = await api.assignServiceTicket(ticket.id, assignedUserId || null);
    setSelected(updated);
    await onChanged();
  }

  async function addMessage(event: FormEvent) {
    event.preventDefault();
    if (!selected || !message.trim()) {
      return;
    }

    await api.addServiceTicketMessage(selected.id, { body: message, isInternal: false });
    const refreshed = (await api.serviceTickets()).items.find((ticket) => ticket.id === selected.id);
    setSelected(refreshed ?? selected);
    setMessage('');
    await onChanged();
  }

  return (
    <>
      <DataTable
        columns={['Numero', 'Client', 'Responsable', 'Sujet', 'Priorite', 'Statut', 'Cree le']}
        rows={items.map((ticket) => [ticket.number, ticket.customerName, ticket.assignedUserName ?? 'A attribuer', ticket.subject, ticket.priority, ticket.status, formatOrderDate(ticket.createdAt)])}
        onRowClick={(index) => setSelected(items[index])}
      />

      {createOpen && (
        <div className="modal-backdrop" onClick={onCloseCreate}>
          <section className="modal-panel service-ticket-create-modal" role="dialog" aria-modal="true" aria-labelledby="service-ticket-create-title" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <div>
                <p className="eyebrow">SAV</p>
                <h2 id="service-ticket-create-title">Nouveau ticket SAV</h2>
              </div>
              <button className="modal-close" type="button" aria-label="Fermer" title="Fermer" onClick={onCloseCreate}>
                <X size={18} />
              </button>
            </header>
            <form className="form-grid" onSubmit={create}>
              <label className="field">
                Client
                <select value={draft.customerId} onChange={(event) => setDraft({ ...draft, customerId: event.target.value })}>
                  <option value="">Client</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.companyName}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Produit
                <select value={draft.productId} onChange={(event) => setDraft({ ...draft, productId: event.target.value })}>
                  <option value="">Sans produit</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>{product.reference} - {product.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Commande
                <select value={draft.salesOrderId} onChange={(event) => setDraft({ ...draft, salesOrderId: event.target.value })}>
                  <option value="">Sans commande</option>
                  {orders.map((order) => (
                    <option key={order.id} value={order.id}>{order.number}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Priorite
                <select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}>
                  <option value="Low">Basse</option>
                  <option value="Normal">Normale</option>
                  <option value="High">Haute</option>
                  <option value="Urgent">Urgente</option>
                </select>
              </label>
              <label className="field">
                Responsable
                <select value={draft.assignedUserId} onChange={(event) => setDraft({ ...draft, assignedUserId: event.target.value })}>
                  <option value="">A attribuer</option>
                  {activeUsers.map((user) => (
                    <option key={user.id} value={user.id}>{user.displayName}</option>
                  ))}
                </select>
              </label>
              <label className="field wide-field">
                Sujet
                <input value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} placeholder="Sujet du ticket" />
              </label>
              <label className="field wide-field">
                Description
                <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
              </label>
              <div className="modal-footer form-actions">
                <button className="secondary" type="button" onClick={onCloseCreate}>Annuler</button>
                <button className="primary" type="submit">
                  <Plus size={16} />
                  Creer le ticket
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section className="modal-panel" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <div>
                <p className="eyebrow">SAV</p>
                <h2>{selected.number}</h2>
              </div>
              <button className="modal-close" type="button" aria-label="Fermer" title="Fermer" onClick={() => setSelected(null)}>
                <X size={18} />
              </button>
            </header>
            <div className="detail-grid">
              <DetailItem label="Client" value={selected.customerName} />
              <DetailItem label="Produit" value={selected.productReference ? `${selected.productReference} - ${selected.productName}` : '-'} />
              <DetailItem label="Commande" value={selected.salesOrderNumber ?? '-'} />
              <DetailItem label="Responsable" value={selected.assignedUserName ?? 'A attribuer'} />
              <DetailItem label="Priorite" value={selected.priority} />
              <DetailItem label="Statut" value={selected.status} />
              <DetailItem label="Description" value={selected.description ?? '-'} />
            </div>
            <Panel title="Attribution">
              <form className="form-grid compact-form">
                <label className="field">
                  Responsable interne
                  <select value={selected.assignedUserId ?? ''} onChange={(event) => assignTicket(selected, event.target.value)}>
                    <option value="">A attribuer</option>
                    {activeUsers.map((user) => (
                      <option key={user.id} value={user.id}>{user.displayName}</option>
                    ))}
                  </select>
                </label>
              </form>
            </Panel>
            <div className="module-actions">
              {['Open', 'InProgress', 'WaitingCustomer', 'Resolved', 'Closed'].map((status) => (
                <button key={status} className="secondary" type="button" onClick={() => changeStatus(selected, status)}>{status}</button>
              ))}
            </div>
            <Panel title="Messages">
              <form className="form-grid" onSubmit={addMessage}>
                <label className="field wide-field">
                  Message
                  <textarea value={message} onChange={(event) => setMessage(event.target.value)} />
                </label>
                <button className="primary form-actions" type="submit">
                  <Mail size={15} />
                  Ajouter
                </button>
              </form>
              {selected.messages.map((item) => (
                <article className="document-link-row" key={item.id}>
                  <span>{formatOrderDate(item.createdAt)}</span>
                  <strong>{item.authorName ?? 'OceanERP'}</strong>
                  <span>{item.body}</span>
                </article>
              ))}
              {selected.messages.length === 0 && <p className="panel-note">Aucun message.</p>}
            </Panel>
          </section>
        </div>
      )}
    </>
  );
}

type CalendarViewMode = 'day' | 'week' | 'month';

type CalendarDraftState = {
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  description: string;
  isPrivate: boolean;
  reminderMinutes: string;
  createMeetingRoom: boolean;
  meetingLanguage: string;
};

const calendarWeekDayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const calendarHours = Array.from({ length: 15 }, (_, index) => index + 7);
const meetingLanguageOptions = [
  { code: 'fr-FR', label: 'Francais' },
  { code: 'en-US', label: 'Anglais' },
  { code: 'es-ES', label: 'Espagnol' },
  { code: 'de-DE', label: 'Allemand' },
  { code: 'it-IT', label: 'Italien' },
  { code: 'pt-PT', label: 'Portugais' }
];

const meetClientIdStorageKey = 'oceanerp.meet.clientId';

function getMeetClientId() {
  try {
    const existing = localStorage.getItem(meetClientIdStorageKey);
    if (existing) {
      return existing;
    }

    const next = crypto.randomUUID();
    localStorage.setItem(meetClientIdStorageKey, next);
    return next;
  } catch {
    return `client-${Math.random().toString(16).slice(2)}`;
  }
}

function defaultMeetingMedia() {
  return { microphoneEnabled: false, cameraEnabled: false, screenEnabled: false, connectionState: 'online' };
}

function mergeMeetingItemsById<T extends { id: string; createdAt: string }>(current: T[], incoming: T[]) {
  const merged = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => merged.set(item.id, item));
  return Array.from(merged.values()).sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}

function mergeMeetingRoomState(current: MeetingRoomState | null, next: MeetingRoomState) {
  if (!current || current.room.id !== next.room.id) {
    return next;
  }

  return {
    ...next,
    signals: next.signals,
    transcripts: mergeMeetingItemsById(current.transcripts, next.transcripts),
    chatMessages: mergeMeetingItemsById(current.chatMessages, next.chatMessages)
  };
}

type MeetingRemoteStream = {
  id: string;
  stream: MediaStream;
  kind: 'camera' | 'screen' | 'media';
};

type MeetingPeerConnectionState = {
  connection: RTCPeerConnection;
  makingOffer: boolean;
  ignoreOffer: boolean;
  settingRemoteAnswer: boolean;
};

type MeetingPeerSignalPayload = {
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  candidates?: RTCIceCandidateInit[];
};

type MeetingPeerSignalSender = (recipientClientId: string, signalType: 'offer' | 'answer' | 'candidate', payload: MeetingPeerSignalPayload) => Promise<void>;

const meetingRtcConfiguration: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

function useMeetingPeerStreams({
  roomState,
  clientId,
  mediaRevision,
  getLocalStreams,
  sendSignal,
  onError
}: {
  roomState: MeetingRoomState | null;
  clientId: string;
  mediaRevision: number;
  getLocalStreams: () => MediaStream[];
  sendSignal: MeetingPeerSignalSender;
  onError: (message: string) => void;
}) {
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MeetingRemoteStream[]>>({});
  const peersRef = useRef<Map<string, MeetingPeerConnectionState>>(new Map());
  const processedSignalsRef = useRef<Set<string>>(new Set());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const outgoingCandidateQueuesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const outgoingCandidateTimersRef = useRef<Map<string, number>>(new Map());
  const sendSignalRef = useRef(sendSignal);
  const getLocalStreamsRef = useRef(getLocalStreams);
  const onErrorRef = useRef(onError);
  const roomId = roomState?.room.id ?? null;
  const signals = roomState?.signals ?? [];
  const remoteParticipants = useMemo(
    () => (roomState?.participants ?? [])
      .filter((participant) => participant.clientId !== clientId)
      .sort((left, right) => left.clientId.localeCompare(right.clientId)),
    [clientId, roomState?.participants]
  );
  const remoteParticipantKey = remoteParticipants.map((participant) => participant.clientId).join('|');
  const signalKey = signals.map((signal) => signal.id).join('|');

  useEffect(() => {
    sendSignalRef.current = sendSignal;
  }, [sendSignal]);

  useEffect(() => {
    getLocalStreamsRef.current = getLocalStreams;
  }, [getLocalStreams]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const closePeer = useCallback((remoteClientId: string) => {
    peersRef.current.get(remoteClientId)?.connection.close();
    peersRef.current.delete(remoteClientId);
    pendingCandidatesRef.current.delete(remoteClientId);
    outgoingCandidateQueuesRef.current.delete(remoteClientId);
    const timer = outgoingCandidateTimersRef.current.get(remoteClientId);
    if (timer) {
      window.clearTimeout(timer);
      outgoingCandidateTimersRef.current.delete(remoteClientId);
    }
    setRemoteStreams((current) => {
      const next = { ...current };
      delete next[remoteClientId];
      return next;
    });
  }, []);

  const syncLocalTracks = useCallback((connection: RTCPeerConnection) => {
    const localTracks = getLocalStreamsRef.current()
      .flatMap((stream) => stream.getTracks().map((track) => ({ stream, track })))
      .filter(({ track }) => track.readyState === 'live');
    const liveTrackIds = new Set(localTracks.map(({ track }) => track.id));

    connection.getSenders()
      .filter((sender) => sender.track && !liveTrackIds.has(sender.track.id))
      .forEach((sender) => {
        try {
          connection.removeTrack(sender);
        } catch {
          // La piste a deja pu etre retiree pendant une reconnexion.
        }
      });

    const sentTrackIds = new Set(
      connection.getSenders()
        .map((sender) => sender.track?.id)
        .filter((trackId): trackId is string => Boolean(trackId))
    );

    localTracks
      .filter(({ track }) => !sentTrackIds.has(track.id))
      .forEach(({ stream, track }) => {
        try {
          connection.addTrack(track, stream);
        } catch {
          // Une double insertion ne doit pas interrompre toute la salle.
        }
      });
  }, []);

  const flushPendingCandidates = useCallback(async (remoteClientId: string, connection: RTCPeerConnection) => {
    const candidates = pendingCandidatesRef.current.get(remoteClientId) ?? [];
    pendingCandidatesRef.current.delete(remoteClientId);
    for (const candidate of candidates) {
      try {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Un candidat ICE obsolete ne doit pas couper la reunion.
      }
    }
  }, []);

  const queueOutgoingCandidate = useCallback((remoteClientId: string, candidate: RTCIceCandidateInit) => {
    const queue = outgoingCandidateQueuesRef.current.get(remoteClientId) ?? [];
    queue.push(candidate);
    outgoingCandidateQueuesRef.current.set(remoteClientId, queue);

    if (outgoingCandidateTimersRef.current.has(remoteClientId)) {
      return;
    }

    const timer = window.setTimeout(() => {
      outgoingCandidateTimersRef.current.delete(remoteClientId);
      const candidates = outgoingCandidateQueuesRef.current.get(remoteClientId) ?? [];
      outgoingCandidateQueuesRef.current.delete(remoteClientId);
      if (candidates.length === 0) {
        return;
      }

      void sendSignalRef.current(remoteClientId, 'candidate', { candidates })
        .catch(() => onErrorRef.current('Signal ICE Meet non transmis.'));
    }, 150);
    outgoingCandidateTimersRef.current.set(remoteClientId, timer);
  }, []);

  const createPeerOffer = useCallback(async (remoteClientId: string, peer: MeetingPeerConnectionState) => {
    const { connection } = peer;
    if (peer.makingOffer || connection.signalingState === 'closed') {
      return;
    }

    try {
      peer.makingOffer = true;
      const offer = await connection.createOffer();
      if (connection.signalingState !== 'stable') {
        return;
      }

      await connection.setLocalDescription(offer);
      await sendSignalRef.current(remoteClientId, 'offer', { description: connection.localDescription ?? offer });
    } catch {
      onErrorRef.current('Offre media Meet non transmise.');
    } finally {
      peer.makingOffer = false;
    }
  }, []);

  const ensurePeer = useCallback((remoteClientId: string) => {
    const existing = peersRef.current.get(remoteClientId);
    if (existing) {
      return existing;
    }

    if (typeof RTCPeerConnection === 'undefined') {
      onErrorRef.current("WebRTC n'est pas disponible dans ce contexte. Utilisez HTTPS ou l'application Windows a jour.");
      return null;
    }

    const connection = new RTCPeerConnection(meetingRtcConfiguration);
    const peer: MeetingPeerConnectionState = {
      connection,
      makingOffer: false,
      ignoreOffer: false,
      settingRemoteAnswer: false
    };
    peersRef.current.set(remoteClientId, peer);

    connection.onnegotiationneeded = () => {
      void createPeerOffer(remoteClientId, peer);
    };

    try {
      connection.createDataChannel('oceanerp-meet-control');
    } catch {
      // Le canal de controle rend les offres WebRTC valides meme sans piste media locale.
    }
    syncLocalTracks(connection);

    connection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      queueOutgoingCandidate(remoteClientId, event.candidate.toJSON());
    };

    connection.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      const streamId = stream.id || `${remoteClientId}-${event.track.id}`;
      const kind = inferMeetingRemoteStreamKind(stream, event.track);
      setRemoteStreams((current) => {
        const list = current[remoteClientId] ?? [];
        const nextStream = { id: streamId, stream, kind };
        const index = list.findIndex((item) => item.id === streamId);
        const nextList = index >= 0
          ? list.map((item, itemIndex) => itemIndex === index ? nextStream : item)
          : [...list, nextStream];
        return { ...current, [remoteClientId]: nextList };
      });
      event.track.addEventListener('ended', () => {
        setRemoteStreams((current) => {
          const list = (current[remoteClientId] ?? []).filter((item) => item.id !== streamId);
          return { ...current, [remoteClientId]: list };
        });
      }, { once: true });
    };

    connection.onconnectionstatechange = () => {
      if (connection.connectionState === 'failed') {
        try {
          connection.restartIce();
        } catch {
          // Certains WebView/Electron anciens exposent mal restartIce.
        }
        void createPeerOffer(remoteClientId, peer);
      }
      if (connection.connectionState === 'closed') {
        closePeer(remoteClientId);
      }
    };

    return peer;
  }, [closePeer, createPeerOffer, queueOutgoingCandidate, syncLocalTracks]);

  useEffect(() => {
    processedSignalsRef.current.clear();
  }, [roomId]);

  useEffect(() => {
    peersRef.current.forEach((peer) => peer.connection.close());
    peersRef.current.clear();
    pendingCandidatesRef.current.clear();
    outgoingCandidateQueuesRef.current.clear();
    outgoingCandidateTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    outgoingCandidateTimersRef.current.clear();
    setRemoteStreams({});
  }, [roomId]);

  useEffect(() => {
    if (!roomId) {
      return;
    }

    const activeRemoteClientIds = new Set(remoteParticipants.map((participant) => participant.clientId));
    Array.from(peersRef.current.keys())
      .filter((remoteClientId) => !activeRemoteClientIds.has(remoteClientId))
      .forEach(closePeer);

    remoteParticipants.forEach((participant) => {
      const peer = ensurePeer(participant.clientId);
      if (peer) {
        syncLocalTracks(peer.connection);
      }
    });
  }, [closePeer, ensurePeer, mediaRevision, remoteParticipantKey, roomId, syncLocalTracks]);

  useEffect(() => {
    if (!roomId || signals.length === 0) {
      return;
    }

    void (async () => {
      for (const signal of signals) {
        if (processedSignalsRef.current.has(signal.id) || signal.senderClientId === clientId) {
          continue;
        }

        processedSignalsRef.current.add(signal.id);
        const peer = ensurePeer(signal.senderClientId);
        if (!peer) {
          continue;
        }
        const { connection } = peer;

        const payload = parseMeetingSignalPayload(signal);
        if (!payload) {
          continue;
        }

        try {
          if (payload.description) {
            if (payload.description.type === 'answer') {
              if (connection.signalingState !== 'have-local-offer') {
                continue;
              }

              peer.settingRemoteAnswer = true;
              await connection.setRemoteDescription(new RTCSessionDescription(payload.description));
              peer.settingRemoteAnswer = false;
              await flushPendingCandidates(signal.senderClientId, connection);
              continue;
            }

            if (payload.description.type !== 'offer') {
              continue;
            }

            const isPolitePeer = clientId.localeCompare(signal.senderClientId) > 0;
            const readyForOffer = !peer.makingOffer && (connection.signalingState === 'stable' || peer.settingRemoteAnswer);
            const offerCollision = !readyForOffer;
            peer.ignoreOffer = !isPolitePeer && offerCollision;
            if (peer.ignoreOffer) {
              continue;
            }

            peer.ignoreOffer = false;
            await connection.setRemoteDescription(new RTCSessionDescription(payload.description));
            await flushPendingCandidates(signal.senderClientId, connection);
            const answer = await connection.createAnswer();
            await connection.setLocalDescription(answer);
            await sendSignalRef.current(signal.senderClientId, 'answer', { description: connection.localDescription ?? answer });
          } else if (signal.signalType === 'candidate' && (payload.candidate || payload.candidates?.length)) {
            if (peer.ignoreOffer) {
              continue;
            }

            const candidates = payload.candidates?.length ? payload.candidates : payload.candidate ? [payload.candidate] : [];
            if (connection.remoteDescription) {
              for (const candidate of candidates) {
                await connection.addIceCandidate(new RTCIceCandidate(candidate));
              }
            } else {
              pendingCandidatesRef.current.set(signal.senderClientId, [
                ...(pendingCandidatesRef.current.get(signal.senderClientId) ?? []),
                ...candidates
              ]);
            }
          }
        } catch {
          peer.settingRemoteAnswer = false;
          onErrorRef.current('Connexion media Meet interrompue. Relancez la camera ou le partage si besoin.');
        }
      }
    })();
  }, [clientId, ensurePeer, flushPendingCandidates, roomId, signalKey, signals]);

  useEffect(() => () => {
    peersRef.current.forEach((peer) => peer.connection.close());
    peersRef.current.clear();
    outgoingCandidateTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    outgoingCandidateTimersRef.current.clear();
  }, []);

  return remoteStreams;
}

function parseMeetingSignalPayload(signal: MeetingSignal): MeetingPeerSignalPayload | null {
  try {
    const value = JSON.parse(signal.payloadJson) as MeetingPeerSignalPayload;
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function inferMeetingRemoteStreamKind(stream: MediaStream, track: MediaStreamTrack): MeetingRemoteStream['kind'] {
  const text = [stream.id, track.label].join(' ').toLocaleLowerCase('fr');
  if (text.includes('screen') || text.includes('window') || text.includes('display') || text.includes('ecran')) {
    return 'screen';
  }

  if (track.kind === 'video') {
    return 'camera';
  }

  return 'media';
}

function MeetRemoteVideoTile({ participant, item }: { participant: MeetingParticipant; item: MeetingRemoteStream }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasVideo = item.stream.getVideoTracks().some((track) => track.readyState === 'live');

  useEffect(() => {
    const mediaElement = hasVideo ? videoRef.current : audioRef.current;
    if (!mediaElement) {
      return;
    }

    mediaElement.srcObject = item.stream;
    void mediaElement.play().catch(() => undefined);
  }, [hasVideo, item.stream]);

  return (
    <article className={`meet-video-tile remote ${item.kind === 'screen' ? 'meet-screen-share' : ''}`}>
      {hasVideo ? (
        <video ref={videoRef} autoPlay playsInline />
      ) : (
        <>
          <audio ref={audioRef} autoPlay />
          <div className="meet-avatar">{participant.displayName.slice(0, 2).toUpperCase()}</div>
        </>
      )}
      <footer>
        <strong>{item.kind === 'screen' ? `${participant.displayName} - ecran` : participant.displayName}</strong>
        <span>{participant.microphoneEnabled ? 'Micro actif' : 'Micro coupe'} - {participant.cameraEnabled || hasVideo ? 'Camera active' : 'Camera coupee'}</span>
      </footer>
    </article>
  );
}

function Calendar({ events, canCreateMeetingRoom, onChanged, onOpenMeeting }: { events: CalendarEvent[]; canCreateMeetingRoom: boolean; onChanged: () => Promise<void>; onOpenMeeting: (roomId: string) => void }) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [cursorDate, setCursorDate] = useState(() => startOfCalendarDay(new Date()));
  const [calendarItems, setCalendarItems] = useState<CalendarEvent[]>(events);
  const [draft, setDraft] = useState<CalendarDraftState>(() => createCalendarDraft(new Date()));
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [editing, setEditing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const visibleRange = useMemo(() => calendarVisibleRange(cursorDate, viewMode), [cursorDate, viewMode]);
  const visibleEvents = useMemo(
    () => calendarItems
      .filter((item) => eventIntersectsRange(item, visibleRange.start, visibleRange.end))
      .sort(compareCalendarEvents),
    [calendarItems, visibleRange.end, visibleRange.start]
  );
  const rangeTitle = calendarRangeTitle(cursorDate, viewMode);

  useEffect(() => {
    setCalendarItems(events);
  }, [events]);

  useEffect(() => {
    let alive = true;
    api.calendarEvents(visibleRange.start.toISOString(), visibleRange.end.toISOString())
      .then((result) => {
        if (alive) {
          setCalendarItems(result.items);
        }
      })
      .catch((err) => {
        if (alive) {
          setMessage(err instanceof Error ? err.message : "Chargement de l'agenda impossible.");
        }
      });
    return () => {
      alive = false;
    };
  }, [visibleRange.end, visibleRange.start]);

  function openCreate(date = cursorDate) {
    setDraft(createCalendarDraft(date));
    setShowCreate(true);
    setMessage(null);
  }

  function moveCursor(direction: -1 | 1) {
    setCursorDate((current) => {
      if (viewMode === 'month') {
        return addCalendarMonths(current, direction);
      }

      return addCalendarDays(current, viewMode === 'week' ? direction * 7 : direction);
    });
  }

  async function reloadVisibleEvents() {
    const next = await api.calendarEvents(visibleRange.start.toISOString(), visibleRange.end.toISOString());
    setCalendarItems(next.items);
    await onChanged();
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!draft.title.trim()) {
      setMessage('Le titre est obligatoire.');
      return;
    }

    const created = await api.createCalendarEvent(calendarPayloadFromDraft(draft));
    if (draft.createMeetingRoom) {
      const roomState = await api.createMeetingRoom({
        title: created.title,
        scheduledStartAt: created.startsAt,
        calendarEventId: created.id,
        clientId: getMeetClientId(),
        displayName: api.user?.displayName ?? 'Utilisateur',
        sourceLanguage: draft.meetingLanguage,
        targetLanguage: draft.meetingLanguage,
        media: defaultMeetingMedia()
      });
      setMessage(`Salle Meet creee : ${roomState.room.code}`);
    }
    setShowCreate(false);
    await reloadVisibleEvents();
  }

  async function update(event: FormEvent) {
    event.preventDefault();
    if (!selected) {
      return;
    }

    setMessage(null);
    if (!draft.title.trim()) {
      setMessage('Le titre est obligatoire.');
      return;
    }

    const alreadyHasMeetingRoom = selected.links.some((link) => link.module === 'meeting');
    const updated = await api.updateCalendarEvent(selected.id, calendarPayloadFromDraft(draft));
    if (draft.createMeetingRoom && !alreadyHasMeetingRoom && canCreateMeetingRoom) {
      const roomState = await api.createMeetingRoom({
        title: updated.title,
        scheduledStartAt: updated.startsAt,
        calendarEventId: updated.id,
        clientId: getMeetClientId(),
        displayName: api.user?.displayName ?? 'Utilisateur',
        sourceLanguage: draft.meetingLanguage,
        targetLanguage: draft.meetingLanguage,
        media: defaultMeetingMedia()
      });
      setMessage(`Salle Meet ajoutee : ${roomState.room.code}`);
      setSelected(null);
    } else {
      setSelected(updated);
    }
    setEditing(false);
    await reloadVisibleEvents();
  }

  async function remove(eventId: string) {
    if (!window.confirm('Supprimer cet evenement ?')) {
      return;
    }

    await api.deleteCalendarEvent(eventId);
    setSelected(null);
    setEditing(false);
    await reloadVisibleEvents();
  }

  function openEvent(event: CalendarEvent) {
    setSelected(event);
    setEditing(false);
    setDraft(createCalendarDraftFromEvent(event));
  }

  function renderMonth() {
    const days = eachCalendarDay(visibleRange.start, visibleRange.end);
    return (
      <section className="calendar-month-grid">
        {calendarWeekDayLabels.map((label) => <div className="calendar-weekday-header" key={label}>{label}</div>)}
        {days.map((day) => {
          const dayEvents = visibleEvents.filter((event) => eventIntersectsDay(event, day)).slice(0, 5);
          const hiddenCount = visibleEvents.filter((event) => eventIntersectsDay(event, day)).length - dayEvents.length;
          return (
            <article className={isSameCalendarMonth(day, cursorDate) ? 'calendar-month-cell' : 'calendar-month-cell muted'} key={day.toISOString()}>
              <div className="calendar-cell-header">
                <button type="button" onClick={() => { setCursorDate(day); setViewMode('day'); }}>
                  {day.getDate()}
                </button>
                <button className="calendar-mini-add" type="button" title="Ajouter un evenement" onClick={() => openCreate(day)}>
                  <Plus size={13} />
                </button>
              </div>
              <div className="calendar-cell-events">
                {dayEvents.map((event) => (
                  <button className={event.isPrivate ? 'calendar-chip private' : 'calendar-chip'} key={`${day.toISOString()}-${event.id}`} type="button" onClick={() => openEvent(event)}>
                    <span>{formatCalendarTime(event.startsAt)}</span>
                    {event.title}
                  </button>
                ))}
                {hiddenCount > 0 && <span className="calendar-more">+ {hiddenCount} autre(s)</span>}
              </div>
            </article>
          );
        })}
      </section>
    );
  }

  function renderTimeline(days: Date[]) {
    return (
      <section className={days.length === 1 ? 'calendar-timeline day' : 'calendar-timeline week'}>
        <div className="calendar-time-labels">
          <div className="calendar-time-spacer" />
          {calendarHours.map((hour) => <span key={hour}>{`${hour}:00`}</span>)}
        </div>
        {days.map((day) => {
          const dayEvents = visibleEvents.filter((event) => eventIntersectsDay(event, day));
          return (
            <article className="calendar-day-lane" key={day.toISOString()}>
              <button className={isSameCalendarDay(day, new Date()) ? 'calendar-day-heading today' : 'calendar-day-heading'} type="button" onClick={() => { setCursorDate(day); setViewMode('day'); }}>
                <span>{calendarWeekDayLabels[calendarWeekdayIndex(day)]}</span>
                <strong>{day.getDate()}</strong>
              </button>
              <div className="calendar-day-slots" onDoubleClick={() => openCreate(day)}>
                {calendarHours.map((hour) => <div className="calendar-hour-line" key={hour} />)}
                {dayEvents.map((event) => (
                  <button
                    className={event.isPrivate ? 'calendar-event-card private' : 'calendar-event-card'}
                    key={event.id}
                    style={calendarEventPlacement(event, day)}
                    type="button"
                    onClick={() => openEvent(event)}
                  >
                    <strong>{event.title}</strong>
                    <span><Clock size={13} /> {formatCalendarEventRange(event)}</span>
                    {event.location && <small>{event.location}</small>}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </section>
    );
  }

  return (
    <>
      {message && <div className="alert">{message}</div>}
      <section className="calendar-shell">
        <div className="calendar-toolbar">
          <div className="calendar-nav">
            <button className="secondary icon-only" type="button" aria-label="Periode precedente" title="Periode precedente" onClick={() => moveCursor(-1)}>
              <ChevronLeft size={18} />
            </button>
            <button className="secondary" type="button" onClick={() => setCursorDate(startOfCalendarDay(new Date()))}>Aujourd'hui</button>
            <button className="secondary icon-only" type="button" aria-label="Periode suivante" title="Periode suivante" onClick={() => moveCursor(1)}>
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="calendar-title">
            <span>Agenda</span>
            <h2>{rangeTitle}</h2>
          </div>
          <div className="calendar-actions">
            <div className="view-switch" role="group" aria-label="Vue agenda">
              {(['day', 'week', 'month'] as const).map((mode) => (
                <button key={mode} className={viewMode === mode ? 'active' : ''} type="button" onClick={() => setViewMode(mode)}>
                  {mode === 'day' ? 'Jour' : mode === 'week' ? 'Semaine' : 'Mois'}
                </button>
              ))}
            </div>
            <button className="primary" type="button" onClick={() => openCreate()}>
              <Plus size={16} />
              Evenement
            </button>
          </div>
        </div>
        {viewMode === 'month' ? renderMonth() : renderTimeline(viewMode === 'week' ? eachCalendarDay(visibleRange.start, addCalendarDays(visibleRange.start, 7)) : [cursorDate])}
      </section>

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <section className="modal-panel calendar-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <div>
                <p className="eyebrow">Agenda</p>
                <h2>Nouvel evenement</h2>
              </div>
              <button className="modal-close" type="button" aria-label="Fermer" title="Fermer" onClick={() => setShowCreate(false)}>
                <X size={18} />
              </button>
            </header>
            <CalendarEventForm draft={draft} setDraft={setDraft} canCreateMeetingRoom={canCreateMeetingRoom} onSubmit={create} onCancel={() => setShowCreate(false)} submitLabel="Ajouter" />
          </section>
        </div>
      )}

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section className="modal-panel calendar-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <div>
                <p className="eyebrow">Agenda</p>
                <h2>{selected.title}</h2>
              </div>
              <button className="modal-close" type="button" aria-label="Fermer" title="Fermer" onClick={() => setSelected(null)}>
                <X size={18} />
              </button>
            </header>
            {editing ? (
              <CalendarEventForm draft={draft} setDraft={setDraft} canCreateMeetingRoom={canCreateMeetingRoom || selected.links.some((link) => link.module === 'meeting')} onSubmit={update} onCancel={() => setEditing(false)} submitLabel="Enregistrer" />
            ) : (
              <>
                <div className="detail-grid">
                  <DetailItem label="Debut" value={formatOrderDate(selected.startsAt)} />
                  <DetailItem label="Fin" value={formatOrderDate(selected.endsAt)} />
                  <DetailItem label="Lieu" value={selected.location ?? '-'} />
                  <DetailItem label="Visibilite" value={selected.isPrivate ? 'Prive' : 'Public'} />
                  <DetailItem label="Rappels" value={selected.reminders.length ? `${selected.reminders.length} rappel(s)` : '-'} />
                  <DetailItem label="Description" value={selected.description ?? '-'} />
                </div>
                {selected.links.length > 0 && (
                  <Panel title="Liens ERP">
                    {selected.links.map((link) => (
                      <article className="document-link-row" key={link.id}>
                        <strong>{link.module === 'meeting' ? 'Meet' : link.module}</strong>
                        {link.module === 'meeting' ? (
                          <button className="secondary" type="button" onClick={() => onOpenMeeting(link.entityId)}>
                            <Video size={15} />
                            Ouvrir la salle
                          </button>
                        ) : (
                          <span>{link.entityId}</span>
                        )}
                      </article>
                    ))}
                  </Panel>
                )}
                <div className="modal-footer">
                  <button className="secondary" type="button" onClick={() => { setDraft(createCalendarDraftFromEvent(selected)); setEditing(true); }}>
                    <Pencil size={16} />
                    Modifier
                  </button>
                  <button className="danger" type="button" onClick={() => void remove(selected.id)}>
                    <Trash2 size={16} />
                    Supprimer
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; [index: number]: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

function Meet({ dashboard, currentUser, initialRoomId, onInitialRoomOpened, onChanged }: { dashboard: MeetingDashboard | null; currentUser: User | null; initialRoomId: string | null; onInitialRoomOpened: () => void; onChanged: () => Promise<void> }) {
  const clientId = useMemo(getMeetClientId, []);
  const displayName = currentUser?.displayName ?? currentUser?.email ?? 'Utilisateur';
  const languages = dashboard?.languages.length ? dashboard.languages : meetingLanguageOptions;
  const canUseMediaDevices = Boolean(navigator.mediaDevices?.getUserMedia);
  const canUseDisplayMedia = Boolean(navigator.mediaDevices?.getDisplayMedia);
  const [rooms, setRooms] = useState(dashboard?.rooms ?? []);
  const [roomState, setRoomState] = useState<MeetingRoomState | null>(null);
  const [createTitle, setCreateTitle] = useState('Reunion');
  const [scheduledStartAt, setScheduledStartAt] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('fr-FR');
  const [targetLanguage, setTargetLanguage] = useState('fr-FR');
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenEnabled, setScreenEnabled] = useState(false);
  const [mediaRevision, setMediaRevision] = useState(0);
  const [mediaDevices, setMediaDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInputId, setSelectedAudioInputId] = useState('');
  const [selectedVideoInputId, setSelectedVideoInputId] = useState('');
  const [transcriptionEnabled, setTranscriptionEnabled] = useState(false);
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState<'none' | 'blur' | 'ocean' | 'studio' | 'workshop'>('none');
  const [chatMessage, setChatMessage] = useState('');
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const lastMeetingSyncAtRef = useRef<string | null>(null);
  const meetingSyncInFlightRef = useRef(false);
  const audioInputDevices = mediaDevices.filter((device) => device.kind === 'audioinput');
  const videoInputDevices = mediaDevices.filter((device) => device.kind === 'videoinput');

  const loadMediaDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setMediaDevices([]);
      return [] as MediaDeviceInfo[];
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setMediaDevices(devices);
      setSelectedAudioInputId((current) => current && devices.some((device) => device.kind === 'audioinput' && device.deviceId === current) ? current : '');
      setSelectedVideoInputId((current) => current && devices.some((device) => device.kind === 'videoinput' && device.deviceId === current) ? current : '');
      return devices;
    } catch {
      setMediaDevices([]);
      return [] as MediaDeviceInfo[];
    }
  }, []);

  useEffect(() => {
    setRooms(dashboard?.rooms ?? []);
  }, [dashboard]);

  useEffect(() => {
    void loadMediaDevices();

    if (!navigator.mediaDevices?.addEventListener) {
      return undefined;
    }

    const onDeviceChange = () => void loadMediaDevices();
    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
  }, [loadMediaDevices]);

  useEffect(() => {
    lastMeetingSyncAtRef.current = roomState?.room.id ? roomState.serverTime : null;
    meetingSyncInFlightRef.current = false;
  }, [roomState?.room.id]);

  useEffect(() => {
    if (!initialRoomId) {
      return;
    }

    api.meetingRoom(initialRoomId, clientId)
      .then(replaceRoomState)
      .then(onInitialRoomOpened)
      .catch((err) => setMessage(err instanceof Error ? err.message : 'Salle Meet introuvable.'));
  }, [clientId, initialRoomId, onInitialRoomOpened]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('meet');
    if (!token) {
      return;
    }

    api.joinMeetingRoom({
      codeOrToken: token,
      clientId,
      displayName,
      sourceLanguage,
      targetLanguage,
      media: { microphoneEnabled, cameraEnabled, screenEnabled, connectionState: 'online' }
    })
      .then(replaceRoomState)
      .then(() => {
        params.delete('meet');
        const query = params.toString();
        window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
      })
      .catch((err) => setMessage(err instanceof Error ? err.message : 'Lien Meet invalide.'));
  }, [cameraEnabled, clientId, displayName, microphoneEnabled, screenEnabled, sourceLanguage, targetLanguage]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let alive = true;

    if (!roomState || (!cameraEnabled && !microphoneEnabled)) {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
        setMediaRevision((value) => value + 1);
      }
      return undefined;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("Micro et camera indisponibles. Ouvrez l'ERP en HTTPS ou avec l'application Windows autorisee.");
      setCameraEnabled(false);
      setMicrophoneEnabled(false);
      return undefined;
    }

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    navigator.mediaDevices.getUserMedia({
      video: cameraEnabled
        ? selectedVideoInputId
          ? { deviceId: { exact: selectedVideoInputId } }
          : { facingMode: 'user' }
        : false,
      audio: microphoneEnabled
        ? {
          ...(selectedAudioInputId ? { deviceId: { exact: selectedAudioInputId } } : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
        : false
    })
      .then((nextStream) => {
        if (!alive) {
          nextStream.getTracks().forEach((track) => track.stop());
          return;
        }

        stream = nextStream;
        localStreamRef.current = nextStream;
        setMediaRevision((value) => value + 1);
        const activeAudioDeviceId = nextStream.getAudioTracks()[0]?.getSettings().deviceId;
        const activeVideoDeviceId = nextStream.getVideoTracks()[0]?.getSettings().deviceId;
        if (activeAudioDeviceId) {
          setSelectedAudioInputId((current) => current || activeAudioDeviceId);
        }
        if (activeVideoDeviceId) {
          setSelectedVideoInputId((current) => current || activeVideoDeviceId);
        }
        void loadMediaDevices();
        if (videoRef.current) {
          videoRef.current.srcObject = nextStream;
          void videoRef.current.play().catch(() => undefined);
        }
      })
      .catch((error) => {
        setMessage(formatMeetMediaError(error, "Impossible d'acceder au micro ou a la camera."));
        setCameraEnabled(false);
        setMicrophoneEnabled(false);
      });

    return () => {
      alive = false;
      stream?.getTracks().forEach((track) => track.stop());
      if (localStreamRef.current === stream) {
        localStreamRef.current = null;
        setMediaRevision((value) => value + 1);
      }
    };
  }, [cameraEnabled, loadMediaDevices, microphoneEnabled, roomState?.room.id, selectedAudioInputId, selectedVideoInputId]);

  useEffect(() => () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (!screenEnabled || !screenVideoRef.current || !screenStreamRef.current) {
      return;
    }

    screenVideoRef.current.srcObject = screenStreamRef.current;
    void screenVideoRef.current.play().catch(() => undefined);
  }, [screenEnabled]);

  useEffect(() => {
    if (!roomState) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void syncRoom(false);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cameraEnabled, clientId, displayName, microphoneEnabled, roomState?.room.id, screenEnabled, sourceLanguage, targetLanguage]);

  useEffect(() => {
    if (!roomState) {
      return;
    }

    void syncRoom(false);
  }, [cameraEnabled, microphoneEnabled, screenEnabled, sourceLanguage, targetLanguage]);

  useEffect(() => {
    if (!roomState || !transcriptionEnabled) {
      return undefined;
    }

    const speechWindow = window as Window & { SpeechRecognition?: BrowserSpeechRecognitionConstructor; webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setMessage("La transcription vocale n'est pas disponible dans ce navigateur.");
      setTranscriptionEnabled(false);
      return undefined;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = sourceLanguage;
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result?.[0]?.transcript?.trim();
        if (text && result.isFinal) {
          void api.addMeetingTranscript(roomState.room.id, {
            clientId,
            speakerName: displayName,
            text,
            sourceLanguage,
            translatedText: translationEnabled && targetLanguage !== sourceLanguage ? `[${targetLanguage}] ${text}` : null,
            isFinal: true
          }).then(() => syncRoom(false));
        }
      }
    };
    recognition.onerror = () => setMessage('Transcription interrompue.');
    recognition.start();

    return () => recognition.stop();
  }, [clientId, displayName, roomState?.room.id, sourceLanguage, targetLanguage, transcriptionEnabled, translationEnabled]);

  async function refreshDashboard() {
    const next = await api.meetingDashboard();
    setRooms(next.rooms);
    await onChanged();
  }

  async function syncRoom(showErrors = true) {
    if (!roomState || meetingSyncInFlightRef.current) {
      return;
    }

    try {
      meetingSyncInFlightRef.current = true;
      const since = lastMeetingSyncAtRef.current;
      const next = await api.syncMeetingRoom(roomState.room.id, {
        clientId,
        displayName,
        sourceLanguage,
        targetLanguage,
        media: { microphoneEnabled, cameraEnabled, screenEnabled, connectionState: 'online' },
        since
      });
      lastMeetingSyncAtRef.current = next.serverTime;
      setRoomState((current) => mergeMeetingRoomState(since ? current : null, next));
    } catch (err) {
      if (showErrors) {
        setMessage(err instanceof Error ? err.message : 'Synchronisation Meet impossible.');
      }
    } finally {
      meetingSyncInFlightRef.current = false;
    }
  }

  function replaceRoomState(next: MeetingRoomState | null) {
    lastMeetingSyncAtRef.current = next?.serverTime ?? null;
    setRoomState(next);
  }

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const next = await api.createMeetingRoom({
      title: createTitle,
      scheduledStartAt: scheduledStartAt ? new Date(scheduledStartAt).toISOString() : null,
      clientId,
      displayName,
      sourceLanguage,
      targetLanguage,
      media: { microphoneEnabled, cameraEnabled, screenEnabled, connectionState: 'online' }
    });
    replaceRoomState(next);
    await refreshDashboard();
  }

  async function joinRoom(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const next = await api.joinMeetingRoom({
      codeOrToken: joinCode,
      clientId,
      displayName,
      sourceLanguage,
      targetLanguage,
      media: { microphoneEnabled, cameraEnabled, screenEnabled, connectionState: 'online' }
    });
    replaceRoomState(next);
  }

  async function openRoom(roomId: string) {
    setMessage(null);
    const next = await api.meetingRoom(roomId, clientId);
    replaceRoomState(next);
  }

  async function copyInvite() {
    if (!roomState) {
      return;
    }

    const response = await api.ensureMeetingInvite(roomState.room.id);
    const link = `${window.location.origin}${window.location.pathname}?meet=${response.token}`;
    const copied = await copyTextToClipboard(link);
    setMessage(copied ? 'Lien Meet copie.' : `Lien Meet : ${link}`);
    setRoomState((current) => current ? { ...current, room: { ...current.room, inviteToken: response.token } } : current);
  }

  async function leaveRoom() {
    if (!roomState) {
      return;
    }

    await api.leaveMeetingRoom(roomState.room.id, clientId);
    replaceRoomState(null);
    setCameraEnabled(false);
    setMicrophoneEnabled(false);
    stopScreenShare();
    await refreshDashboard();
  }

  async function deleteRoom() {
    if (!roomState || !window.confirm('Supprimer cette salle Meet ?')) {
      return;
    }

    await api.deleteMeetingRoom(roomState.room.id);
    replaceRoomState(null);
    await refreshDashboard();
  }

  async function toggleScreenShare() {
    if (screenEnabled) {
      stopScreenShare();
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setMessage("Le partage d'ecran n'est pas disponible. Utilisez l'application Windows a jour ou ouvrez l'ERP en HTTPS.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = stream;
      setScreenEnabled(true);
      setMediaRevision((value) => value + 1);
      stream.getVideoTracks()[0]?.addEventListener('ended', stopScreenShare, { once: true });
    } catch (error) {
      setMessage(formatMeetMediaError(error, "Partage d'ecran annule ou refuse."));
    }
  }

  async function refreshMediaDeviceList() {
    const devices = await loadMediaDevices();
    const cameraCount = devices.filter((device) => device.kind === 'videoinput').length;
    const microphoneCount = devices.filter((device) => device.kind === 'audioinput').length;
    setMessage(`${cameraCount} camera(s) et ${microphoneCount} micro(s) detecte(s).`);
  }

  function switchToNextCamera() {
    if (videoInputDevices.length < 2) {
      setMessage("Une seule camera est detectee pour l'instant. Branchez une autre camera puis actualisez les peripheriques.");
      return;
    }

    const activeDeviceId = localStreamRef.current?.getVideoTracks()[0]?.getSettings().deviceId || selectedVideoInputId;
    const currentIndex = videoInputDevices.findIndex((device) => device.deviceId === activeDeviceId);
    const nextDevice = videoInputDevices[(currentIndex + 1 + videoInputDevices.length) % videoInputDevices.length];
    setSelectedVideoInputId(nextDevice.deviceId);
    setCameraEnabled(true);
    setMessage(`Camera selectionnee : ${nextDevice.label || 'camera suivante'}.`);
  }

  function switchToNextMicrophone() {
    if (audioInputDevices.length < 2) {
      setMessage("Un seul micro est detecte pour l'instant. Branchez un autre micro puis actualisez les peripheriques.");
      return;
    }

    const activeDeviceId = localStreamRef.current?.getAudioTracks()[0]?.getSettings().deviceId || selectedAudioInputId;
    const currentIndex = audioInputDevices.findIndex((device) => device.deviceId === activeDeviceId);
    const nextDevice = audioInputDevices[(currentIndex + 1 + audioInputDevices.length) % audioInputDevices.length];
    setSelectedAudioInputId(nextDevice.deviceId);
    setMicrophoneEnabled(true);
    setMessage(`Micro selectionne : ${nextDevice.label || 'micro suivant'}.`);
  }

  function stopScreenShare() {
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }
    setScreenEnabled(false);
    setMediaRevision((value) => value + 1);
  }

  async function sendChat(event: FormEvent) {
    event.preventDefault();
    if (!roomState || (!chatMessage.trim() && !chatFile)) {
      return;
    }

    const fileBase64 = chatFile ? await readFileAsDataUrl(chatFile) : null;
    await api.addMeetingChatMessage(roomState.room.id, {
      clientId,
      senderName: displayName,
      message: chatMessage,
      fileName: chatFile?.name ?? null,
      fileMimeType: chatFile?.type || null,
      fileBase64
    });
    setChatMessage('');
    setChatFile(null);
    await syncRoom(false);
  }

  const sendPeerSignal = useCallback<MeetingPeerSignalSender>(async (recipientClientId, signalType, payload) => {
    if (!roomState) {
      return;
    }

    await api.sendMeetingSignal(roomState.room.id, {
      senderClientId: clientId,
      recipientClientId,
      signalType,
      payloadJson: JSON.stringify(payload)
    });
  }, [clientId, roomState?.room.id]);

  const getLocalStreams = useCallback(
    () => [localStreamRef.current, screenStreamRef.current].filter((stream): stream is MediaStream => Boolean(stream)),
    []
  );

  const remoteStreams = useMeetingPeerStreams({
    roomState,
    clientId,
    mediaRevision,
    getLocalStreams,
    sendSignal: sendPeerSignal,
    onError: setMessage
  });

  const activeParticipant = roomState?.participants.find((participant) => participant.clientId === clientId);

  return (
    <section className="meet-page">
      {message && <div className="alert">{message}</div>}
      <div className="meet-command-grid">
        <Panel title="Nouvelle salle Meet">
          <form className="meet-create-form" onSubmit={createRoom}>
            <label>
              Titre
              <input value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} />
            </label>
            <label>
              Date
              <input type="datetime-local" value={scheduledStartAt} onChange={(event) => setScheduledStartAt(event.target.value)} />
            </label>
            <button className="primary" type="submit">
              <Video size={16} />
              Creer
            </button>
          </form>
        </Panel>
        <Panel title="Rejoindre">
          <form className="meet-create-form" onSubmit={joinRoom}>
            <label>
              Code ou lien
              <input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="MEET-123456" />
            </label>
            <button className="secondary" type="submit">
              <Link2 size={16} />
              Entrer
            </button>
          </form>
        </Panel>
      </div>

      <section className="meet-layout">
        <aside className="meet-rooms">
          <h3>Salles</h3>
          {rooms.map((room) => (
            <button className={roomState?.room.id === room.id ? 'active' : ''} type="button" key={room.id} onClick={() => void openRoom(room.id)}>
              <strong>{room.title}</strong>
              <span>{room.code}</span>
              <small>{room.scheduledStartAt ? formatOrderDate(room.scheduledStartAt) : 'Sans date'}</small>
            </button>
          ))}
          {rooms.length === 0 && <p className="panel-note">Aucune salle Meet.</p>}
        </aside>

        {roomState ? (
          <section className="meet-stage">
            <header className="meet-stage-header">
              <div>
                <p className="eyebrow">Meet</p>
                <h2>{roomState.room.title}</h2>
                <span>{roomState.room.code}</span>
              </div>
              <div className="meet-actions">
                <button className="secondary" type="button" onClick={() => void copyTextToClipboard(roomState.room.code).then((copied) => setMessage(copied ? 'Code Meet copie.' : `Code Meet : ${roomState.room.code}`))}>
                  <Copy size={15} />
                  Code
                </button>
                <button className="secondary" type="button" onClick={() => void copyInvite()}>
                  <Link2 size={15} />
                  Inviter
                </button>
                <button className="danger" type="button" onClick={() => void leaveRoom()}>
                  <PhoneOff size={15} />
                  Quitter
                </button>
                <button className="danger" type="button" onClick={() => void deleteRoom()}>
                  <Trash2 size={15} />
                  Supprimer
                </button>
              </div>
            </header>

            <div className="meet-toolbar">
              <button className={microphoneEnabled ? 'active' : ''} type="button" disabled={!canUseMediaDevices} title={!canUseMediaDevices ? "Micro indisponible sans HTTPS ou permission Windows." : undefined} onClick={() => setMicrophoneEnabled((value) => !value)}>
                {microphoneEnabled ? <Mic size={16} /> : <MicOff size={16} />}
                Micro
              </button>
              <select className="meet-device-select" value={selectedAudioInputId} disabled={!canUseMediaDevices} onFocus={() => void loadMediaDevices()} onChange={(event) => { setSelectedAudioInputId(event.target.value); setMicrophoneEnabled(true); }} aria-label="Choisir le micro">
                <option value="">{audioInputDevices.length ? 'Micro par defaut' : 'Aucun micro detecte'}</option>
                {audioInputDevices.map((device, index) => (
                  <option value={device.deviceId} key={device.deviceId || `audio-${index}`}>
                    {device.label || `Micro ${index + 1}`}
                  </option>
                ))}
              </select>
              <button className="secondary" type="button" disabled={!canUseMediaDevices || audioInputDevices.length < 2} title={!canUseMediaDevices ? "Micro indisponible sans HTTPS ou permission Windows." : audioInputDevices.length < 2 ? "Un seul micro detecte. Cliquez sur Detecter apres avoir branche un autre micro." : 'Passer au micro suivant'} onClick={switchToNextMicrophone}>
                Changer micro
              </button>
              <button className={cameraEnabled ? 'active' : ''} type="button" disabled={!canUseMediaDevices} title={!canUseMediaDevices ? "Camera indisponible sans HTTPS ou permission Windows." : undefined} onClick={() => setCameraEnabled((value) => !value)}>
                {cameraEnabled ? <Camera size={16} /> : <CameraOff size={16} />}
                Camera
              </button>
              <select className="meet-device-select" value={selectedVideoInputId} disabled={!canUseMediaDevices} onFocus={() => void loadMediaDevices()} onChange={(event) => { setSelectedVideoInputId(event.target.value); setCameraEnabled(true); }} aria-label="Choisir la camera">
                <option value="">{videoInputDevices.length ? 'Camera par defaut' : 'Aucune camera detectee'}</option>
                {videoInputDevices.map((device, index) => (
                  <option value={device.deviceId} key={device.deviceId || `video-${index}`}>
                    {device.label || `Camera ${index + 1}`}
                  </option>
                ))}
              </select>
              <button className="secondary" type="button" disabled={!canUseMediaDevices || videoInputDevices.length < 2} title={!canUseMediaDevices ? "Camera indisponible sans HTTPS ou permission Windows." : videoInputDevices.length < 2 ? "Une seule camera detectee. Cliquez sur Detecter apres avoir branche une autre camera." : 'Passer a la camera suivante'} onClick={switchToNextCamera}>
                Changer camera
              </button>
              <button className="secondary" type="button" disabled={!navigator.mediaDevices?.enumerateDevices} onClick={() => void refreshMediaDeviceList()}>
                Detecter
              </button>
              <button className={screenEnabled ? 'active' : ''} type="button" disabled={!canUseDisplayMedia} title={!canUseDisplayMedia ? "Partage d'ecran indisponible sans HTTPS ou permission Windows." : undefined} onClick={() => void toggleScreenShare()}>
                <ScreenShare size={16} />
                Ecran
              </button>
              <button className={transcriptionEnabled ? 'active' : ''} type="button" onClick={() => setTranscriptionEnabled((value) => !value)}>
                <FileText size={16} />
                Transcription
              </button>
              <button className={translationEnabled ? 'active' : ''} type="button" onClick={() => setTranslationEnabled((value) => !value)}>
                <Languages size={16} />
                Traduction
              </button>
              <select value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value)} aria-label="Langue parlee">
                {languages.map((language) => <option value={language.code} key={language.code}>{language.label}</option>)}
              </select>
              <select value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)} aria-label="Langue cible">
                {languages.map((language) => <option value={language.code} key={language.code}>{language.label}</option>)}
              </select>
              <select value={backgroundMode} onChange={(event) => setBackgroundMode(event.target.value as typeof backgroundMode)} aria-label="Fond virtuel">
                <option value="none">Fond normal</option>
                <option value="blur">Flou</option>
                <option value="ocean">Ocean</option>
                <option value="studio">Studio</option>
                <option value="workshop">Atelier</option>
              </select>
            </div>
            {(!canUseMediaDevices || !canUseDisplayMedia) && (
              <div className="alert meet-media-warning">
                {meetMediaAvailabilityMessage(canUseMediaDevices, canUseDisplayMedia)}
              </div>
            )}

            <div className="meet-content-grid">
              <div className="meet-video-grid">
                <article className={`meet-video-tile background-${backgroundMode}`}>
                  {cameraEnabled ? <video ref={videoRef} autoPlay muted playsInline /> : <div className="meet-avatar">{displayName.slice(0, 2).toUpperCase()}</div>}
                  <footer>
                    <strong>{displayName}</strong>
                    <span>{activeParticipant?.connectionState ?? 'online'}</span>
                  </footer>
                </article>
                {screenEnabled && (
                  <article className="meet-video-tile meet-screen-share">
                    <video ref={screenVideoRef} autoPlay muted playsInline />
                    <footer>
                      <strong>Partage d'ecran</strong>
                      <span>actif</span>
                    </footer>
                  </article>
                )}
                {roomState.participants.filter((participant) => participant.clientId !== clientId).flatMap((participant) => {
                  const streams = remoteStreams[participant.clientId] ?? [];
                  if (streams.length === 0) {
                    return [(
                      <article className="meet-video-tile remote" key={participant.id}>
                        <div className="meet-avatar">{participant.displayName.slice(0, 2).toUpperCase()}</div>
                        <footer>
                          <strong>{participant.displayName}</strong>
                          <span>{participant.microphoneEnabled ? 'Micro actif' : 'Micro coupe'} - {participant.cameraEnabled ? 'Camera active' : 'Camera coupee'}</span>
                        </footer>
                      </article>
                    )];
                  }

                  return streams.map((item) => (
                    <MeetRemoteVideoTile participant={participant} item={item} key={`${participant.id}-${item.id}`} />
                  ));
                })}
              </div>

              <aside className="meet-side-panel">
                <section>
                  <h3>Participants</h3>
                  {roomState.participants.map((participant) => (
                    <div className="meet-participant" key={participant.id}>
                      <strong>{participant.displayName}</strong>
                      <span>{participant.sourceLanguage} - {participant.connectionState}</span>
                    </div>
                  ))}
                </section>
                <section>
                  <h3>Chat</h3>
                  <div className="meet-chat-list">
                    {roomState.chatMessages.map((item) => (
                      <article key={item.id}>
                        <strong>{item.senderName}</strong>
                        <p>{item.message}</p>
                        {item.hasFile && item.fileName && (
                          <button className="link-button" type="button" onClick={() => void api.downloadMeetingAttachment(item.id, item.fileName!)}>
                            <Paperclip size={14} />
                            {item.fileName}
                          </button>
                        )}
                      </article>
                    ))}
                  </div>
                  <form className="meet-chat-form" onSubmit={sendChat}>
                    <textarea value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} placeholder="Message" />
                    <input type="file" onChange={(event) => setChatFile(event.target.files?.[0] ?? null)} />
                    <button className="primary" type="submit">Envoyer</button>
                  </form>
                </section>
              </aside>
            </div>

            <Panel title="Transcription">
              <div className="meet-transcript-list">
                {roomState.transcripts.map((item) => (
                  <article key={item.id}>
                    <span>{formatOrderDate(item.createdAt)}</span>
                    <strong>{item.speakerName}</strong>
                    <p>{item.text}</p>
                    {item.translatedText && <small>{item.translatedText}</small>}
                  </article>
                ))}
                {roomState.transcripts.length === 0 && <p className="panel-note">Aucune transcription.</p>}
              </div>
            </Panel>
          </section>
        ) : (
          <section className="empty-state meet-empty">
            <Video size={42} />
            <strong>Selectionnez ou creez une salle Meet</strong>
          </section>
        )}
      </section>
    </section>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function copyTextToClipboard(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fallback below for HTTP/Electron contexts where navigator.clipboard can be blocked.
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand('copy');
  } finally {
    textarea.remove();
  }
}

function meetMediaAvailabilityMessage(canUseMediaDevices: boolean, canUseDisplayMedia: boolean) {
  const missing = [
    !canUseMediaDevices ? 'camera/micro' : null,
    !canUseDisplayMedia ? "partage d'ecran" : null
  ].filter(Boolean).join(' et ');

  const origin = window.location.origin;
  if (!window.isSecureContext) {
    return `${missing} indisponible sur ${origin}. En navigateur, servez l'ERP en HTTPS. Dans l'application Windows, enregistrez l'adresse serveur puis relancez l'application pour autoriser cette origine HTTP.`;
  }

  return `${missing} indisponible. Verifiez les permissions Windows, les autorisations du navigateur et qu'un peripherique compatible est branche.`;
}

function formatMeetMediaError(error: unknown, fallback: string) {
  if (!window.isSecureContext) {
    return `${fallback} L'acces navigateur au micro, a la camera et au partage d'ecran demande HTTPS ou l'application Windows autorisee.`;
  }

  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return `${fallback} Permission refusee par Windows ou par le navigateur.`;
    }
    if (error.name === 'NotFoundError') {
      return `${fallback} Aucun peripherique compatible n'a ete trouve.`;
    }
    if (error.name === 'NotReadableError') {
      return `${fallback} Le peripherique est deja utilise par une autre application.`;
    }
  }

  return fallback;
}

function CalendarEventForm({ draft, setDraft, canCreateMeetingRoom, onSubmit, onCancel, submitLabel }: { draft: CalendarDraftState; setDraft: (next: CalendarDraftState) => void; canCreateMeetingRoom: boolean; onSubmit: (event: FormEvent) => void; onCancel: () => void; submitLabel: string }) {
  return (
    <form className="form-grid calendar-event-form" onSubmit={onSubmit}>
      <label className="field full-field">
        Titre
        <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
      </label>
      <label className="field">
        Debut
        <input type="datetime-local" value={draft.startsAt} onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })} />
      </label>
      <label className="field">
        Fin
        <input type="datetime-local" value={draft.endsAt} onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })} />
      </label>
      <label className="field">
        Rappel minutes
        <input type="number" min="0" value={draft.reminderMinutes} onChange={(event) => setDraft({ ...draft, reminderMinutes: event.target.value })} />
      </label>
      <label className="field">
        Lieu
        <input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} />
      </label>
      <label className="checkbox-line">
        <input type="checkbox" checked={draft.isPrivate} onChange={(event) => setDraft({ ...draft, isPrivate: event.target.checked })} />
        Prive
      </label>
      <section className="calendar-meeting-card full-field">
        <div className="calendar-meeting-intro">
          <span className="calendar-meeting-icon"><Video size={18} /></span>
          <div>
            <strong>Reunion Meet</strong>
            <p>Creer une salle de reunion liee a cet evenement et accessible depuis l'agenda.</p>
          </div>
        </div>
        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={draft.createMeetingRoom}
            disabled={!canCreateMeetingRoom && !draft.createMeetingRoom}
            onChange={(event) => setDraft({ ...draft, createMeetingRoom: event.target.checked })}
          />
          Ajouter une salle Meet
        </label>
        {!canCreateMeetingRoom && !draft.createMeetingRoom && (
          <p className="panel-note">Votre role n'a pas encore la permission meet.write. Un administrateur peut l'ajouter dans Parametres &gt; Utilisateurs/Roles.</p>
        )}
        {draft.createMeetingRoom && (
          <label className="field">
            Langue de la reunion
            <select value={draft.meetingLanguage} onChange={(event) => setDraft({ ...draft, meetingLanguage: event.target.value })}>
              {meetingLanguageOptions.map((language) => (
                <option value={language.code} key={language.code}>{language.label}</option>
              ))}
            </select>
          </label>
        )}
      </section>
      <label className="field full-field">
        Description
        <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
      </label>
      <div className="modal-footer full-field">
        <button className="secondary" type="button" onClick={onCancel}>Annuler</button>
        <button className="primary" type="submit">
          <Save size={16} />
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function createCalendarDraft(date: Date): CalendarDraftState {
  const start = new Date(date);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(start.getHours() + 1);
  return {
    title: '',
    startsAt: toDateTimeLocalValue(start),
    endsAt: toDateTimeLocalValue(end),
    location: '',
    description: '',
    isPrivate: false,
    reminderMinutes: '30',
    createMeetingRoom: false,
    meetingLanguage: 'fr-FR'
  };
}

function createCalendarDraftFromEvent(event: CalendarEvent): CalendarDraftState {
  const reminder = event.reminders
    .map((item) => Math.round((new Date(event.startsAt).getTime() - new Date(item.remindAt).getTime()) / 60000))
    .find((minutes) => Number.isFinite(minutes) && minutes >= 0);
  return {
    title: event.title,
    startsAt: toDateTimeLocalValue(new Date(event.startsAt)),
    endsAt: toDateTimeLocalValue(new Date(event.endsAt)),
    location: event.location ?? '',
    description: event.description ?? '',
    isPrivate: event.isPrivate,
    reminderMinutes: reminder?.toString() ?? '30',
    createMeetingRoom: event.links.some((link) => link.module === 'meeting'),
    meetingLanguage: 'fr-FR'
  };
}

function calendarPayloadFromDraft(draft: CalendarDraftState) {
  const startsAt = fromDateTimeLocalValue(draft.startsAt);
  const endsAt = fromDateTimeLocalValue(draft.endsAt);
  const reminderMinutes = Number(draft.reminderMinutes);
  return {
    title: draft.title.trim(),
    startsAt,
    endsAt,
    location: draft.location || null,
    description: draft.description || null,
    isPrivate: draft.isPrivate,
    reminders: Number.isFinite(reminderMinutes) && reminderMinutes > 0
      ? [{ remindAt: new Date(new Date(startsAt).getTime() - reminderMinutes * 60000).toISOString() }]
      : []
  };
}

function startOfCalendarDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfCalendarWeek(date: Date) {
  const day = startOfCalendarDay(date);
  const dayIndex = calendarWeekdayIndex(day);
  return addCalendarDays(day, -dayIndex);
}

function addCalendarDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addCalendarMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function calendarVisibleRange(date: Date, viewMode: CalendarViewMode) {
  if (viewMode === 'day') {
    const start = startOfCalendarDay(date);
    return { start, end: addCalendarDays(start, 1) };
  }

  if (viewMode === 'week') {
    const start = startOfCalendarWeek(date);
    return { start, end: addCalendarDays(start, 7) };
  }

  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const start = startOfCalendarWeek(monthStart);
  const end = addCalendarDays(startOfCalendarWeek(monthEnd), 7);
  return { start, end };
}

function eachCalendarDay(start: Date, end: Date) {
  const days: Date[] = [];
  for (let current = startOfCalendarDay(start); current < end; current = addCalendarDays(current, 1)) {
    days.push(current);
  }

  return days;
}

function calendarWeekdayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

function isSameCalendarDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function isSameCalendarMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function eventIntersectsRange(event: CalendarEvent, start: Date, end: Date) {
  const eventStart = new Date(event.startsAt);
  const eventEnd = new Date(event.endsAt);
  return eventStart < end && eventEnd > start;
}

function eventIntersectsDay(event: CalendarEvent, day: Date) {
  const start = startOfCalendarDay(day);
  return eventIntersectsRange(event, start, addCalendarDays(start, 1));
}

function compareCalendarEvents(left: CalendarEvent, right: CalendarEvent) {
  return new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
}

function formatCalendarTime(value: string) {
  return new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatCalendarEventRange(event: CalendarEvent) {
  return `${formatCalendarTime(event.startsAt)} - ${formatCalendarTime(event.endsAt)}`;
}

function calendarRangeTitle(date: Date, viewMode: CalendarViewMode) {
  if (viewMode === 'day') {
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  if (viewMode === 'week') {
    const start = startOfCalendarWeek(date);
    const end = addCalendarDays(start, 6);
    return `${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }

  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function calendarEventPlacement(event: CalendarEvent, day: Date) {
  const dayStart = startOfCalendarDay(day);
  const visibleStart = new Date(dayStart);
  visibleStart.setHours(7, 0, 0, 0);
  const visibleEnd = new Date(dayStart);
  visibleEnd.setHours(22, 0, 0, 0);
  const eventStart = new Date(event.startsAt);
  const eventEnd = new Date(event.endsAt);
  const start = Math.max(eventStart.getTime(), visibleStart.getTime());
  const end = Math.min(eventEnd.getTime(), visibleEnd.getTime());
  const total = visibleEnd.getTime() - visibleStart.getTime();
  const top = Math.max(0, ((start - visibleStart.getTime()) / total) * 100);
  const height = Math.max(5, ((Math.max(end, start + 30 * 60000) - start) / total) * 100);
  return { top: `${top}%`, height: `${height}%` };
}

type SignatureRecipientDraft = {
  id: string;
  email: string;
  name: string;
};

function Signatures({ requests, files, quotes, onChanged }: { requests: SignatureRequest[]; files: DriveItem[]; quotes: Quote[]; onChanged: () => Promise<void> }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    driveItemId: '',
    title: '',
    expiresAt: toDateTimeLocalValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    recipients: [createSignatureRecipientDraft()]
  });

  const signableFiles = useMemo(
    () => files
      .filter((file) => file.mimeType === 'application/pdf' || /\.pdf$/i.test(file.name))
      .sort((left, right) => left.name.localeCompare(right.name, 'fr', { numeric: true, sensitivity: 'base' })),
    [files]
  );
  const selected = useMemo(() => requests.find((request) => request.id === selectedId) ?? null, [requests, selectedId]);
  const filteredRequests = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('fr');
    const ordered = [...requests].sort((left, right) => new Date(right.expiresAt).getTime() - new Date(left.expiresAt).getTime());
    if (!term) {
      return ordered;
    }

    return ordered.filter((request) => [
      request.title,
      request.driveItemName ?? '',
      request.status,
      ...request.recipients.map((recipient) => `${recipient.name ?? ''} ${recipient.email}`)
    ].join(' ').toLocaleLowerCase('fr').includes(term));
  }, [requests, search]);

  useEffect(() => {
    if (selectedId && !requests.some((request) => request.id === selectedId)) {
      setSelectedId(null);
    }
  }, [requests, selectedId]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setPreviewUrl(null);

    if (!selected) {
      return undefined;
    }

    api.signatureDocumentObjectUrl(selected.id)
      .then((url) => {
        objectUrl = url;
        if (!cancelled) {
          setPreviewUrl(url);
        } else {
          URL.revokeObjectURL(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewUrl(null);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [selected?.id]);

  function findQuoteForDocument(driveItemId: string, file?: DriveItem) {
    const fileName = file?.name.toLocaleLowerCase('fr') ?? '';
    return quotes.find((quote) => quote.documents.some((document) => document.driveItemId === driveItemId))
      ?? quotes.find((quote) => quote.documents.some((document) => document.fileName.toLocaleLowerCase('fr') === fileName))
      ?? quotes.find((quote) => fileName.includes(quote.number.toLocaleLowerCase('fr')));
  }

  function quoteSigner(quote: Quote) {
    return {
      name: quote.customer?.contactName || quote.customer?.companyName || quote.customerName || '',
      email: [quote.customer?.contactEmail, quote.customer?.email]
        .map((value) => value?.trim())
        .find((value) => value && value.includes('@')) ?? ''
    };
  }

  function chooseDocument(driveItemId: string) {
    const file = signableFiles.find((item) => item.id === driveItemId);
    const quote = findQuoteForDocument(driveItemId, file);
    const signer = quote ? quoteSigner(quote) : null;
    const nextTitle = quote ? quote.number : file?.name.replace(/\.pdf$/i, '') || '';

    if (quote && signer?.email) {
      setMessage(`Signataire pre-rempli depuis le devis ${quote.number}.`);
      setError(null);
    } else if (quote) {
      setMessage(null);
      setError(`Le devis ${quote.number} est reconnu, mais aucune adresse email client n'est renseignee.`);
    } else {
      setMessage(null);
    }

    setDraft((current) => ({
      ...current,
      driveItemId,
      title: nextTitle || current.title,
      recipients: signer ? [{ id: current.recipients[0]?.id ?? createSignatureRecipientDraft().id, name: signer.name, email: signer.email }] : current.recipients
    }));
  }

  function updateRecipient(id: string, patch: Partial<SignatureRecipientDraft>) {
    setDraft((current) => ({
      ...current,
      recipients: current.recipients.map((recipient) => recipient.id === id ? { ...recipient, ...patch } : recipient)
    }));
  }

  function addRecipient() {
    setDraft((current) => ({ ...current, recipients: [...current.recipients, createSignatureRecipientDraft()] }));
  }

  function removeRecipient(id: string) {
    setDraft((current) => {
      const recipients = current.recipients.filter((recipient) => recipient.id !== id);
      return { ...current, recipients: recipients.length > 0 ? recipients : [createSignatureRecipientDraft()] };
    });
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const recipients = draft.recipients
      .map((recipient) => ({ email: recipient.email.trim(), name: recipient.name.trim() || null }))
      .filter((recipient) => recipient.email.length > 0);

    if (!draft.driveItemId || recipients.length === 0) {
      setError('Selectionnez un PDF et ajoutez au moins un signataire.');
      return;
    }

    try {
      const created = await api.createSignatureRequest({
        driveItemId: draft.driveItemId,
        title: draft.title.trim(),
        expiresAt: fromDateTimeLocalValue(draft.expiresAt),
        recipients
      });
      setDraft({
        driveItemId: '',
        title: '',
        expiresAt: toDateTimeLocalValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        recipients: [createSignatureRecipientDraft()]
      });
      setSelectedId(created.id);
      setMessage('Demande creee. Les emails OTP ont ete envoyes aux signataires.');
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creation de la demande impossible');
    }
  }

  async function changeStatus(status: 'Pending' | 'Revoked') {
    if (!selected) {
      return;
    }

    setError(null);
    setMessage(null);
    try {
      const updated = await api.changeSignatureStatus(selected.id, status);
      setSelectedId(updated.id);
      setMessage(status === 'Revoked' ? 'Demande suspendue.' : 'Demande reactivee.');
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Changement de statut impossible');
    }
  }

  async function deleteRequest(id: string) {
    setError(null);
    setMessage(null);
    try {
      await api.deleteSignatureRequest(id);
      if (selectedId === id) {
        setSelectedId(null);
      }
      setMessage('Demande supprimee.');
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible');
    }
  }

  async function copySigningUrl(url?: string) {
    if (!url) {
      setError('Lien de signature indisponible pour ce signataire.');
      return;
    }

    const absoluteUrl = absoluteSignatureUrl(url);
    setError(null);
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setMessage('Lien de signature copie.');
    } catch {
      setMessage(absoluteUrl);
    }
  }

  function openSigningUrl(url?: string) {
    if (!url) {
      setError('Lien de signature indisponible pour ce signataire.');
      return;
    }

    window.open(absoluteSignatureUrl(url), '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="signature-workbench">
      <form className="signature-create-card" onSubmit={create}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Signature interne</p>
            <h2>Nouvelle demande</h2>
          </div>
          <button className="primary" type="submit">
            <FileSignature size={16} />
            Envoyer
          </button>
        </div>

        <div className="signature-create-grid">
          <label className="field">
            PDF a signer
            <select value={draft.driveItemId} onChange={(event) => chooseDocument(event.target.value)}>
              <option value="">Document Drive PDF</option>
              {signableFiles.map((file) => (
                <option key={file.id} value={file.id}>{file.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Titre de la demande
            <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Contrat, devis, accord..." />
          </label>
          <label className="field">
            Expiration
            <input type="datetime-local" value={draft.expiresAt} onChange={(event) => setDraft({ ...draft, expiresAt: event.target.value })} />
          </label>
        </div>

        <div className="signature-recipient-editor">
          <div className="signature-card-head">
            <strong>Signataires</strong>
            <button className="secondary" type="button" onClick={addRecipient}>
              <Plus size={15} />
              Ajouter
            </button>
          </div>
          {draft.recipients.map((recipient, index) => (
            <div className="recipient-editor-row" key={recipient.id}>
              <label className="field">
                Nom
                <input value={recipient.name} onChange={(event) => updateRecipient(recipient.id, { name: event.target.value })} placeholder={`Signataire ${index + 1}`} />
              </label>
              <label className="field">
                Email
                <input type="email" value={recipient.email} onChange={(event) => updateRecipient(recipient.id, { email: event.target.value })} placeholder="email@exemple.fr" />
              </label>
              <button className="danger icon-only" type="button" title="Retirer" onClick={() => removeRecipient(recipient.id)}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        {error && <div className="alert">{error}</div>}
        {message && <div className="success">{message}</div>}
      </form>

      <div className="signature-main-card">
        <div className="signature-list-pane">
          <div className="signature-card-head">
            <div>
              <p className="eyebrow">Demandes</p>
              <h2>Suivi des signatures</h2>
            </div>
            <span>{filteredRequests.length}</span>
          </div>
          <label className="field">
            Recherche
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Titre, document, signataire..." />
          </label>
          <div className="signature-request-list">
            {filteredRequests.map((request) => (
              <button
                key={request.id}
                className={selected?.id === request.id ? 'signature-request-item selected' : 'signature-request-item'}
                type="button"
                onClick={() => setSelectedId(request.id)}
              >
                <span className={signatureStatusClass(request.status)}>{signatureStatusLabel(request.status)}</span>
                <strong>{request.title}</strong>
                <small>{request.driveItemName ?? 'Document Drive'}</small>
                <span>{request.recipients.length} signataire(s) · expire {formatOrderDate(request.expiresAt)}</span>
              </button>
            ))}
            {filteredRequests.length === 0 && <EmptyState icon={FileSignature} title="Aucune demande" />}
          </div>
        </div>

        <div className="signature-detail-pane">
          {!selected && <EmptyState icon={FileSignature} title="Selectionnez une demande" />}
          {selected && (
            <>
              <header className="signature-detail-header">
                <div>
                  <p className="eyebrow">Dossier signature</p>
                  <h2>{selected.title}</h2>
                  <p>{selected.driveItemName ?? 'Document Drive'} · expiration {formatOrderDate(selected.expiresAt)}</p>
                </div>
                <div className="signature-actions">
                  {selected.status === 'Revoked' ? (
                    <button className="secondary" type="button" onClick={() => changeStatus('Pending')}>
                      <ShieldCheck size={15} />
                      Reactiver
                    </button>
                  ) : selected.status !== 'Completed' ? (
                    <button className="secondary" type="button" onClick={() => changeStatus('Revoked')}>
                      <X size={15} />
                      Suspendre
                    </button>
                  ) : null}
                  <button className="danger" type="button" onClick={() => deleteRequest(selected.id)}>
                    <Trash2 size={15} />
                    Supprimer
                  </button>
                </div>
              </header>

              <div className="detail-grid">
                <DetailItem label="Statut" value={signatureStatusLabel(selected.status)} />
                <DetailItem label="Terminee le" value={selected.completedAt ? formatOrderDate(selected.completedAt) : '-'} />
                <DetailItem label="Signataires" value={selected.recipients.length} />
                <DetailItem label="Preuves" value={selected.evidence.length} />
              </div>

              <section className="signature-preview">
                {previewUrl ? <iframe title={`Apercu ${selected.title}`} src={previewUrl} /> : <EmptyState icon={FileText} title="Apercu PDF indisponible" />}
              </section>

              <section className="signature-section">
                <h3>Signataires</h3>
                <div className="signature-recipient-list">
                  {selected.recipients.map((recipient) => (
                    <article className="signature-recipient-row" key={recipient.id}>
                      <div>
                        <strong>{recipient.name || recipient.email}</strong>
                        <span>{recipient.email}</span>
                      </div>
                      <span className={signatureStatusClass(recipient.status)}>{signatureStatusLabel(recipient.status)}</span>
                      <small>{recipient.signedAt ? formatOrderDate(recipient.signedAt) : 'En attente'}</small>
                      <div className="signature-row-actions">
                        <button className="secondary" type="button" onClick={() => copySigningUrl(recipient.signingUrl)}>
                          Copier lien
                        </button>
                        <button className="secondary" type="button" onClick={() => openSigningUrl(recipient.signingUrl)}>
                          Ouvrir
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="signature-section">
                <h3>Documents signes</h3>
                <div className="signature-signed-list">
                  {selected.signedDocuments.map((document) => (
                    <article className="signature-signed-row" key={document.id}>
                      <FileText size={18} />
                      <div>
                        <strong>{document.fileName}</strong>
                        <span>{Math.round(document.size / 1024)} Ko · {formatOrderDate(document.createdAt)}</span>
                      </div>
                      <button className="secondary" type="button" onClick={() => api.downloadSignedSignatureDocument(selected.id, document.id, document.fileName)}>
                        <Download size={15} />
                        Telecharger
                      </button>
                    </article>
                  ))}
                  {selected.signedDocuments.length === 0 && <p className="panel-note">Aucun document signe pour le moment.</p>}
                </div>
              </section>

              <section className="signature-section">
                <h3>Journal de preuve</h3>
                <div className="signature-proof-list">
                  {selected.evidence.map((evidence) => (
                    <article className="signature-proof-row" key={evidence.id}>
                      <div>
                        <strong>{evidence.action}</strong>
                        <span>{formatOrderDate(evidence.createdAt)} · {evidence.signatureMode ?? 'Click'}</span>
                      </div>
                      <code>{evidence.documentSha256}</code>
                      <small>{evidence.ipAddress ?? '-'} · {evidence.userAgent ?? '-'}</small>
                    </article>
                  ))}
                  {selected.evidence.length === 0 && <p className="panel-note">Aucune preuve enregistree.</p>}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function createSignatureRecipientDraft(): SignatureRecipientDraft {
  return { id: `${Date.now()}-${Math.random()}`, email: '', name: '' };
}

function signatureStatusLabel(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'pending') {
    return 'En attente';
  }
  if (normalized === 'signed') {
    return 'Signe';
  }
  if (normalized === 'completed') {
    return 'Termine';
  }
  if (normalized === 'revoked') {
    return 'Suspendu';
  }
  if (normalized === 'expired') {
    return 'Expire';
  }
  return status;
}

function signatureStatusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'completed' || normalized === 'signed') {
    return 'signature-status signed';
  }
  if (normalized === 'revoked' || normalized === 'expired') {
    return 'signature-status blocked';
  }
  return 'signature-status pending';
}

function absoluteSignatureUrl(url: string) {
  return new URL(url, window.location.origin).toString();
}

function toDateTimeLocalValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromDateTimeLocalValue(value: string) {
  return new Date(value).toISOString();
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

type FlowceanBlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'todo' | 'bullet' | 'numbered' | 'quote' | 'callout' | 'code' | 'divider';
type FlowceanPageKind = 'document' | 'database';
type FlowceanDatabaseView = 'table' | 'board' | 'calendar' | 'gantt';
type FlowceanPropertyType = 'text' | 'select' | 'date' | 'checkbox' | 'number' | 'email' | 'url';
type FlowceanCellValue = string | number | boolean | null;

type FlowceanBlock = {
  id: string;
  type: FlowceanBlockType;
  text: string;
  checked?: boolean | null;
};

type FlowceanProperty = {
  id: string;
  name: string;
  type: FlowceanPropertyType;
  options: string[];
};

type FlowceanRow = {
  id: string;
  cells: Record<string, FlowceanCellValue>;
};

type FlowceanDatabase = {
  activeView: FlowceanDatabaseView;
  properties: FlowceanProperty[];
  rows: FlowceanRow[];
};

type FlowceanPage = {
  id: string;
  parentId?: string | null;
  title: string;
  icon: string;
  favorite: boolean;
  expanded: boolean;
  kind: FlowceanPageKind;
  updatedAt: number;
  deletedAt?: number | null;
  blocks: FlowceanBlock[];
  database?: FlowceanDatabase | null;
};

type FlowceanState = {
  workspace: { name: string; theme: string };
  pages: FlowceanPage[];
  ui: { activePageId: string | null };
  meta: Record<string, unknown>;
};

type FlowceanTemplateDefinition = {
  key: string;
  title: string;
  badge: string;
  description: string;
  create: () => FlowceanPage;
};

type FlowceanSearchHit = {
  page: FlowceanPage;
  excerpt: string;
};

type FlowceanShare = {
  id: string;
  email: string;
  role: 'lecture' | 'edition';
};

const FLOWCEAN_CACHE_PREFIX = 'oceanerp.flowcean.cache';
const FLOWCEAN_ICON_OPTIONS = ['OE', 'FL', 'DOC', 'DB', 'CRM', 'SAV', 'EUR', 'OK', '!', '#'];

function FlowceanWorkspaceModule() {
  const [workspaces, setWorkspaces] = useState<FlowceanWorkspaceSummary[]>([]);
  const [workspace, setWorkspace] = useState<FlowceanWorkspace | null>(null);
  const [state, setState] = useState<FlowceanState | null>(null);
  const [query, setQuery] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [status, setStatus] = useState('Chargement...');
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'details' | 'activity'>('details');
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<'lecture' | 'edition'>('lecture');
  const importInputRef = useRef<HTMLInputElement>(null);
  const lastSerialized = useRef('');
  const templates = useMemo(() => flowceanTemplateDefinitions(), []);

  useEffect(() => {
    loadWorkspaces().catch((err) => setError(err instanceof Error ? err.message : 'Chargement impossible'));
  }, []);

  useEffect(() => {
    if (!state || !workspace || !dirty) {
      return;
    }

    const serialized = JSON.stringify(state);
    if (serialized === lastSerialized.current) {
      return;
    }

    setStatus('Enregistrement...');
    const timer = window.setTimeout(async () => {
      try {
        const saved = await api.saveFlowceanWorkspace(workspace.slug, { dataJson: serialized, version: workspace.version, eventType: 'WorkspaceSaved' });
        setWorkspace(saved);
        setWorkspaces((items) => items.map((item) => item.slug === saved.slug ? saved : item));
        lastSerialized.current = saved.dataJson;
        writeFlowceanCache(saved.slug, serialized);
        setDirty(false);
        setStatus('Enregistre');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Enregistrement impossible');
        setStatus('Erreur');
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [state, workspace, dirty]);

  async function loadWorkspaces(openSlug?: string) {
    setError(null);
    setStatus('Chargement...');
    const result = await api.flowceanWorkspaces();
    setWorkspaces(result.items);
    await openWorkspace(openSlug ?? result.items[0]?.slug ?? 'main');
  }

  async function openWorkspace(slug: string) {
    setError(null);
    setStatus('Chargement...');
    try {
      const nextWorkspace = await api.flowceanWorkspace(slug);
      const parsed = parseFlowceanState(nextWorkspace);
      setWorkspace(nextWorkspace);
      setState(parsed);
      lastSerialized.current = JSON.stringify(parsed);
      writeFlowceanCache(nextWorkspace.slug, lastSerialized.current);
      setDirty(false);
      setStatus('Pret');
    } catch (err) {
      const cached = readFlowceanCache(slug);
      if (!cached) {
        throw err;
      }

      const summary = workspaces.find((item) => item.slug === slug);
      const fallbackWorkspace: FlowceanWorkspace = {
        id: summary?.id ?? slug,
        slug,
        name: summary?.name ?? slug,
        version: summary?.version ?? 1,
        isPersonal: summary?.isPersonal ?? false,
        createdAt: summary?.createdAt ?? new Date().toISOString(),
        updatedAt: summary?.updatedAt,
        dataJson: cached
      };
      const parsed = parseFlowceanState(fallbackWorkspace);
      setWorkspace(fallbackWorkspace);
      setState(parsed);
      lastSerialized.current = JSON.stringify(parsed);
      setDirty(true);
      setStatus('Cache local');
      setError('Connexion serveur indisponible, reprise depuis le cache local.');
    }
  }

  async function createWorkspace(event: FormEvent) {
    event.preventDefault();
    const name = newWorkspaceName.trim();
    if (!name) {
      return;
    }

    const created = await api.createFlowceanWorkspace({ name });
    setNewWorkspaceName('');
    setWorkspaces((items) => [created, ...items]);
    await openWorkspace(created.slug);
  }

  function updateFlowcean(mutator: (draft: FlowceanState) => void) {
    setState((current) => {
      if (!current) {
        return current;
      }

      const draft = cloneFlowceanState(current);
      mutator(draft);
      const active = draft.pages.find((page) => page.id === draft.ui.activePageId);
      if (active) {
        active.updatedAt = Date.now();
      }

      return draft;
    });
    setDirty(true);
  }

  function activePage() {
    if (!state) {
      return null;
    }

    return state.pages.find((page) => page.id === state.ui.activePageId) ?? state.pages.find((page) => !page.deletedAt) ?? null;
  }

  function createPage(kind: FlowceanPageKind, parentId: string | null = null, template?: FlowceanPage) {
    updateFlowcean((draft) => {
      const pageToInsert = template ? cloneFlowceanPage(template) : createEmptyFlowceanPage(kind, parentId);
      pageToInsert.parentId = parentId;
      pageToInsert.updatedAt = Date.now();
      if (parentId) {
        const parent = draft.pages.find((item) => item.id === parentId);
        if (parent) {
          parent.expanded = true;
        }
      }

      draft.pages.unshift(pageToInsert);
      draft.ui.activePageId = pageToInsert.id;
    });
    setShowNewMenu(false);
  }

  function createTemplate() {
    const template = templates[0];
    if (template) {
      const page = template.create();
      createPage(page.kind, null, page);
    }
  }

  function createFromTemplate(template: FlowceanTemplateDefinition) {
    const page = template.create();
    createPage(page.kind, null, page);
    setShowTemplates(false);
  }

  function duplicatePage(pageId: string) {
    updateFlowcean((draft) => {
      const page = draft.pages.find((item) => item.id === pageId);
      if (!page) {
        return;
      }

      const clone = cloneFlowceanPage(page);
      clone.title = `${page.title} copie`;
      clone.favorite = false;
      clone.deletedAt = null;
      clone.updatedAt = Date.now();
      draft.pages.unshift(clone);
      draft.ui.activePageId = clone.id;
    });
  }

  function toggleFavorite(pageId: string) {
    updateFlowcean((draft) => {
      const page = draft.pages.find((item) => item.id === pageId);
      if (page) {
        page.favorite = !page.favorite;
      }
    });
  }

  function trashPage(pageId: string) {
    updateFlowcean((draft) => {
      const page = draft.pages.find((item) => item.id === pageId);
      if (!page) {
        return;
      }

      page.deletedAt = Date.now();
      draft.pages
        .filter((item) => item.parentId === pageId)
        .forEach((child) => {
          child.deletedAt = Date.now();
        });
      if (draft.ui.activePageId === pageId) {
        draft.ui.activePageId = draft.pages.find((item) => !item.deletedAt)?.id ?? null;
      }
    });
  }

  function restorePage(pageId: string) {
    updateFlowcean((draft) => {
      const page = draft.pages.find((item) => item.id === pageId);
      if (page) {
        page.deletedAt = null;
        draft.ui.activePageId = page.id;
      }
    });
  }

  function toggleExpanded(pageId: string) {
    updateFlowcean((draft) => {
      const page = draft.pages.find((item) => item.id === pageId);
      if (page) {
        page.expanded = !page.expanded;
      }
    });
  }

  function openPage(pageId: string) {
    updateFlowcean((draft) => {
      draft.ui.activePageId = pageId;
    });
    setShowGlobalSearch(false);
  }

  function updatePageIcon(pageId: string) {
    updateFlowcean((draft) => {
      const page = draft.pages.find((item) => item.id === pageId);
      if (!page) {
        return;
      }

      const currentIndex = FLOWCEAN_ICON_OPTIONS.indexOf(page.icon);
      page.icon = FLOWCEAN_ICON_OPTIONS[(currentIndex + 1) % FLOWCEAN_ICON_OPTIONS.length] ?? 'OE';
    });
  }

  function toggleTheme() {
    updateFlowcean((draft) => {
      draft.workspace.theme = draft.workspace.theme === 'dark' ? 'light' : 'dark';
    });
  }

  function exportWorkspace() {
    if (!state || !workspace) {
      return;
    }

    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${workspace.slug}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function importWorkspace(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !workspace) {
      return;
    }

    setError(null);
    try {
      const text = await file.text();
      const imported = normalizeImportedFlowceanState(text, workspace.name, workspace.slug);
      setState(imported);
      setDirty(true);
      setStatus('Import pret a enregistrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import impossible');
    }
  }

  function inviteCollaborator(event: FormEvent) {
    event.preventDefault();
    const email = shareEmail.trim().toLowerCase();
    if (!email) {
      return;
    }

    updateFlowcean((draft) => {
      const shares = flowceanShares(draft);
      if (shares.some((share) => share.email.toLowerCase() === email)) {
        draft.meta.flowceanShares = shares.map((share) => share.email.toLowerCase() === email ? { ...share, role: shareRole } : share);
      } else {
        draft.meta.flowceanShares = [...shares, { id: createFlowceanId('share'), email, role: shareRole }];
      }
    });
    setShareEmail('');
    setShareRole('lecture');
  }

  function removeCollaborator(shareId: string) {
    updateFlowcean((draft) => {
      draft.meta.flowceanShares = flowceanShares(draft).filter((share) => share.id !== shareId);
    });
  }

  const page = activePage();
  const pages = state?.pages ?? [];
  const shares = state ? flowceanShares(state) : [];
  const visiblePages = pages
    .filter((item) => showTrash ? Boolean(item.deletedAt) : !item.deletedAt)
    .filter((item) => !query.trim() || item.title.toLowerCase().includes(query.trim().toLowerCase()) || item.blocks.some((block) => block.text.toLowerCase().includes(query.trim().toLowerCase())));
  const favoritePages = pages.filter((item) => item.favorite && !item.deletedAt);
  const recentPages = [...pages].filter((item) => !item.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
  const searchHits = flowceanSearchHits(pages, globalQuery);
  const breadcrumbs = page ? flowceanBreadcrumbs(pages, page) : [];

  return (
    <section className={`flowcean-shell ${state?.workspace.theme === 'dark' ? 'flowcean-dark' : 'flowcean-light'}`}>
      <div className="flowcean-app">
        <aside className="flowcean-sidebar">
          <div className="flowcean-brand">
            <button className="flowcean-brand-badge" type="button" onClick={() => page && updatePageIcon(page.id)}>{page?.icon ?? 'FL'}</button>
            <div>
              <span>Partage · Super-utilisateur</span>
              <strong>{workspace?.name ?? 'Flowcean'}</strong>
            </div>
          </div>

          <button className="primary flowcean-new-button" type="button" onClick={() => setShowNewMenu((value) => !value)}>
            <Plus size={17} />
            Nouveau
          </button>
          {showNewMenu && (
            <div className="flowcean-new-menu">
              <button type="button" onClick={() => createPage('document')}><FilePlus2 size={16} /> Page</button>
              <button type="button" onClick={() => createPage('database')}><Table2 size={16} /> Tableau</button>
              <button type="button" onClick={() => setShowTemplates(true)}><BookOpen size={16} /> Modele</button>
            </div>
          )}

          <div className="flowcean-quick-actions">
            <button type="button" onClick={() => setShowGlobalSearch(true)}><Search size={15} /> Rechercher</button>
            <button type="button" onClick={() => setShowTemplates(true)}><BookOpen size={15} /> Modeles</button>
            <button type="button" onClick={() => importInputRef.current?.click()}><Upload size={15} /> Importer</button>
            <button type="button" onClick={exportWorkspace}><Download size={15} /> Exporter</button>
          </div>

          <div className="search flowcean-search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher dans l'espace" />
          </div>

          <div className="flowcean-sidebar-scroll">
            <FlowceanMiniSection title="Favoris" pages={favoritePages} activeId={page?.id ?? null} onOpen={openPage} />
            <FlowceanTreeSection
              title={showTrash ? 'Corbeille' : 'Espace'}
              pages={visiblePages}
              allPages={pages}
              activeId={page?.id ?? null}
              onOpen={openPage}
              onCreateChild={(id) => createPage('document', id)}
              onToggleExpanded={toggleExpanded}
            />
            <FlowceanMiniSection title="Recents" pages={recentPages} activeId={page?.id ?? null} onOpen={openPage} />
          </div>

          <div className="flowcean-sidebar-footer">
            <span className={dirty ? 'flowcean-save-state dirty' : 'flowcean-save-state'}>{dirty ? 'Modifications en attente' : status}</span>
            <button type="button" onClick={() => setShowTrash((value) => !value)}>{showTrash ? 'Voir les pages' : 'Corbeille'}</button>
          </div>
        </aside>

        <main className="flowcean-main">
          <header className="flowcean-topbar">
            <div className="flowcean-breadcrumbs">
              {breadcrumbs.map((crumb, index) => (
                <button key={crumb.id} type="button" onClick={() => openPage(crumb.id)}>
                  {index > 0 && <ChevronRight size={13} />}
                  {crumb.title}
                </button>
              ))}
            </div>
            <div className="flowcean-topbar-actions">
              <select value={workspace?.slug ?? ''} onChange={(event) => openWorkspace(event.target.value)}>
                {workspaces.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
              </select>
              <form className="flowcean-new-workspace" onSubmit={createWorkspace}>
                <input value={newWorkspaceName} onChange={(event) => setNewWorkspaceName(event.target.value)} placeholder="Nouvel espace" />
                <button type="submit" className="secondary"><Plus size={15} /> Creer</button>
              </form>
              <button type="button" className="secondary" onClick={toggleTheme}>
                {state?.workspace.theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                Theme
              </button>
            </div>
          </header>

          {error && <div className="alert">{error}</div>}

          <section className="flowcean-status-bar">
            <span className="pill">{page?.kind === 'database' ? 'Tableau' : 'Page'}</span>
            <span>{page ? `Mis a jour ${formatFlowceanDate(page.updatedAt)}` : 'Aucune page active'}</span>
            <span className="flowcean-presence"><UserRound size={14} /> Vous seul en direct</span>
          </section>

          <section className="flowcean-page-surface">
            {!page && <EmptyState icon={BriefcaseBusiness} title="Aucune page" />}
            {page && (
              <>
                <div className="flowcean-page-hero">
                  <button className="flowcean-hero-icon" type="button" onClick={() => updatePageIcon(page.id)}>{page.icon}</button>
                  <div>
                    <p>Workspace OceanERP</p>
                    <input
                      value={page.title}
                      onChange={(event) => updateFlowcean((draft) => {
                        const target = draft.pages.find((item) => item.id === page.id);
                        if (target) {
                          target.title = event.target.value;
                        }
                      })}
                      placeholder="Titre de la page"
                    />
                  </div>
                  <div className="flowcean-page-actions">
                    <button type="button" className="secondary" onClick={() => toggleFavorite(page.id)}><Star size={15} /> {page.favorite ? 'Favori' : 'Favori'}</button>
                    <button type="button" className="secondary" onClick={() => duplicatePage(page.id)}><Copy size={15} /> Dupliquer</button>
                    {page.deletedAt ? (
                      <button type="button" className="secondary" onClick={() => restorePage(page.id)}>Restaurer</button>
                    ) : (
                      <button type="button" className="danger" onClick={() => trashPage(page.id)}><Trash2 size={15} /> Corbeille</button>
                    )}
                  </div>
                </div>

                {page.kind === 'database' && page.database ? (
                  <FlowceanDatabaseEditor page={page} updateFlowcean={updateFlowcean} />
                ) : (
                  <FlowceanDocumentEditor page={page} updateFlowcean={updateFlowcean} />
                )}
              </>
            )}
          </section>
        </main>

        <aside className="flowcean-inspector">
          <div className="flowcean-inspector-tabs">
            <button type="button" className={inspectorTab === 'details' ? 'active' : ''} onClick={() => setInspectorTab('details')}>Details</button>
            <button type="button" className={inspectorTab === 'activity' ? 'active' : ''} onClick={() => setInspectorTab('activity')}>Activite</button>
          </div>
          {inspectorTab === 'details' ? (
            <>
              <strong>Resume</strong>
              <div className="flowcean-fact-grid">
                <div className="flowcean-fact"><span>Pages</span><strong>{pages.filter((item) => !item.deletedAt).length}</strong></div>
                <div className="flowcean-fact"><span>Corbeille</span><strong>{pages.filter((item) => item.deletedAt).length}</strong></div>
                <div className="flowcean-fact"><span>Version</span><strong>{workspace?.version ?? '-'}</strong></div>
                <div className="flowcean-fact"><span>Blocs</span><strong>{page?.blocks.length ?? 0}</strong></div>
              </div>
              <div className="flowcean-quick-panel">
                <strong>Actions rapides</strong>
                <p>Dupliquez, exportez ou faites evoluer votre espace local en quelques clics.</p>
                <button type="button" onClick={() => page && duplicatePage(page.id)}>Dupliquer la page</button>
                <button type="button" onClick={() => createTemplate()}>Ajouter page, Word, Excel ou tableau</button>
                <button type="button" onClick={exportWorkspace}>Exporter le workspace</button>
                {page && <button type="button" onClick={() => trashPage(page.id)}>Envoyer a la corbeille</button>}
              </div>
              <form className="flowcean-share-form" onSubmit={inviteCollaborator}>
                <strong>Partage</strong>
                <input type="email" value={shareEmail} onChange={(event) => setShareEmail(event.target.value)} placeholder="email@entreprise.fr" />
                <select value={shareRole} onChange={(event) => setShareRole(event.target.value as 'lecture' | 'edition')}>
                  <option value="lecture">Lecture</option>
                  <option value="edition">Edition</option>
                </select>
                <button type="submit" className="secondary"><Plus size={15} /> Inviter</button>
              </form>
              <div className="flowcean-share-list">
                {shares.map((share) => (
                  <article key={share.id}>
                    <span>{share.email}</span>
                    <small>{share.role}</small>
                    <button type="button" className="icon-only danger" onClick={() => removeCollaborator(share.id)}><Trash2 size={14} /></button>
                  </article>
                ))}
                {shares.length === 0 && <small className="muted">Aucun collaborateur invite.</small>}
              </div>
            </>
          ) : (
            <div className="flowcean-activity">
              <strong>Activite locale</strong>
              <span>{status}</span>
              <span>{workspace?.updatedAt ? `Derniere sauvegarde ${formatOrderDate(workspace.updatedAt)}` : 'Pas encore sauvegarde'}</span>
            </div>
          )}
        </aside>
      </div>
      <input ref={importInputRef} type="file" accept="application/json" hidden onChange={importWorkspace} />
      {showTemplates && (
        <div className="modal-backdrop-ui" onClick={() => setShowTemplates(false)}>
          <section className="modal-card flowcean-template-modal" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <p className="eyebrow">Modeles</p>
                <h2>Demarrer depuis un modele</h2>
              </div>
              <button className="icon-only secondary" type="button" onClick={() => setShowTemplates(false)}><X size={18} /></button>
            </header>
            <div className="flowcean-template-grid">
              {templates.map((template) => (
                <button key={template.key} type="button" onClick={() => createFromTemplate(template)}>
                  <span>{template.badge}</span>
                  <strong>{template.title}</strong>
                  <small>{template.description}</small>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {showGlobalSearch && (
        <div className="modal-backdrop-ui" onClick={() => setShowGlobalSearch(false)}>
          <section className="modal-card flowcean-search-modal" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <p className="eyebrow">Recherche globale</p>
                <h2>Trouver une page ou un contenu</h2>
              </div>
              <button className="icon-only secondary" type="button" onClick={() => setShowGlobalSearch(false)}><X size={18} /></button>
            </header>
            <div className="search">
              <Search size={16} />
              <input autoFocus value={globalQuery} onChange={(event) => setGlobalQuery(event.target.value)} placeholder="Page, bloc, tableau..." />
            </div>
            <div className="flowcean-search-results">
              {searchHits.map((hit) => (
                <button key={hit.page.id} type="button" onClick={() => openPage(hit.page.id)}>
                  <span className="flowcean-page-icon">{hit.page.icon}</span>
                  <div>
                    <strong>{hit.page.title}</strong>
                    <small>{hit.excerpt || (hit.page.kind === 'database' ? 'Tableau' : 'Page')}</small>
                  </div>
                </button>
              ))}
              {searchHits.length === 0 && <EmptyState icon={Search} title="Aucun resultat" />}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function FlowceanPageSection({ title, pages, activeId, onOpen }: { title: string; pages: FlowceanPage[]; activeId: string | null; onOpen: (id: string) => void }) {
  if (pages.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flowcean-section-title"><span>{title}</span></div>
      <div className="flowcean-page-list compact">
        {pages.map((page) => (
          <button key={page.id} type="button" className={activeId === page.id ? 'active' : ''} onClick={() => onOpen(page.id)}>
            <span className="flowcean-page-icon">{page.icon}</span>
            <span>{page.title}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function FlowceanMiniSection({ title, pages, activeId, onOpen }: { title: string; pages: FlowceanPage[]; activeId: string | null; onOpen: (id: string) => void }) {
  if (pages.length === 0) {
    return null;
  }

  return (
    <section className="flowcean-nav-section">
      <div className="flowcean-section-title"><span>{title}</span></div>
      <div className="flowcean-page-list compact">
        {pages.map((page) => (
          <button key={page.id} type="button" className={activeId === page.id ? 'active' : ''} onClick={() => onOpen(page.id)}>
            <span className="flowcean-page-icon">{page.icon}</span>
            <span>{page.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function FlowceanTreeSection({
  title,
  pages,
  allPages,
  activeId,
  onOpen,
  onCreateChild,
  onToggleExpanded
}: {
  title: string;
  pages: FlowceanPage[];
  allPages: FlowceanPage[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onCreateChild: (id: string) => void;
  onToggleExpanded: (id: string) => void;
}) {
  const roots = pages.filter((page) => !page.parentId || !allPages.some((candidate) => candidate.id === page.parentId));

  return (
    <section className="flowcean-nav-section">
      <div className="flowcean-section-title"><span>{title}</span></div>
      <div className="flowcean-page-list flowcean-tree">
        {roots.map((page) => (
          <FlowceanTreeNode
            key={page.id}
            page={page}
            pages={pages}
            depth={0}
            activeId={activeId}
            onOpen={onOpen}
            onCreateChild={onCreateChild}
            onToggleExpanded={onToggleExpanded}
          />
        ))}
        {roots.length === 0 && <span className="muted">Aucune page</span>}
      </div>
    </section>
  );
}

function FlowceanTreeNode({
  page,
  pages,
  depth,
  activeId,
  onOpen,
  onCreateChild,
  onToggleExpanded
}: {
  page: FlowceanPage;
  pages: FlowceanPage[];
  depth: number;
  activeId: string | null;
  onOpen: (id: string) => void;
  onCreateChild: (id: string) => void;
  onToggleExpanded: (id: string) => void;
}) {
  const children = pages.filter((item) => item.parentId === page.id);
  return (
    <>
      <div className="flowcean-tree-row" style={{ paddingLeft: depth * 14 }}>
        <button className="flowcean-tree-toggle" type="button" onClick={() => onToggleExpanded(page.id)} disabled={children.length === 0}>
          {children.length > 0 ? (page.expanded ? <ChevronRight className="expanded" size={13} /> : <ChevronRight size={13} />) : <span />}
        </button>
        <button type="button" className={activeId === page.id ? 'active' : ''} onClick={() => onOpen(page.id)}>
          <span className="flowcean-page-icon">{page.icon}</span>
          <span>{page.title}</span>
        </button>
        <button className="flowcean-tree-add" type="button" title="Ajouter une sous-page" onClick={() => onCreateChild(page.id)}>
          <Plus size={13} />
        </button>
      </div>
      {page.expanded && children.map((child) => (
        <FlowceanTreeNode
          key={child.id}
          page={child}
          pages={pages}
          depth={depth + 1}
          activeId={activeId}
          onOpen={onOpen}
          onCreateChild={onCreateChild}
          onToggleExpanded={onToggleExpanded}
        />
      ))}
    </>
  );
}

function FlowceanDocumentEditor({ page, updateFlowcean }: { page: FlowceanPage; updateFlowcean: (mutator: (draft: FlowceanState) => void) => void }) {
  const blockDefinitions = flowceanBlockDefinitions();

  function updateBlock(blockId: string, patch: Partial<FlowceanBlock>) {
    updateFlowcean((draft) => {
      const targetPage = draft.pages.find((item) => item.id === page.id);
      const block = targetPage?.blocks.find((item) => item.id === blockId);
      if (block) {
        Object.assign(block, patch);
      }
    });
  }

  function addBlock(type: FlowceanBlockType) {
    updateFlowcean((draft) => {
      const targetPage = draft.pages.find((item) => item.id === page.id);
      targetPage?.blocks.push(createFlowceanBlock(type));
    });
  }

  function insertBlockAfter(blockId: string, type: FlowceanBlockType = 'paragraph') {
    updateFlowcean((draft) => {
      const targetPage = draft.pages.find((item) => item.id === page.id);
      if (!targetPage) {
        return;
      }

      const index = targetPage.blocks.findIndex((block) => block.id === blockId);
      targetPage.blocks.splice(index >= 0 ? index + 1 : targetPage.blocks.length, 0, createFlowceanBlock(type));
    });
  }

  function removeBlock(blockId: string) {
    updateFlowcean((draft) => {
      const targetPage = draft.pages.find((item) => item.id === page.id);
      if (targetPage) {
        targetPage.blocks = targetPage.blocks.filter((block) => block.id !== blockId);
      }
    });
  }

  function moveBlock(blockId: string, direction: -1 | 1) {
    updateFlowcean((draft) => {
      const targetPage = draft.pages.find((item) => item.id === page.id);
      if (!targetPage) {
        return;
      }

      const index = targetPage.blocks.findIndex((block) => block.id === blockId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= targetPage.blocks.length) {
        return;
      }

      const [block] = targetPage.blocks.splice(index, 1);
      targetPage.blocks.splice(nextIndex, 0, block);
    });
  }

  function duplicateBlock(blockId: string) {
    updateFlowcean((draft) => {
      const targetPage = draft.pages.find((item) => item.id === page.id);
      if (!targetPage) {
        return;
      }

      const index = targetPage.blocks.findIndex((block) => block.id === blockId);
      const block = targetPage.blocks[index];
      if (!block) {
        return;
      }

      targetPage.blocks.splice(index + 1, 0, { ...block, id: createFlowceanId('block') });
    });
  }

  function applySlashCommand(blockId: string, type: FlowceanBlockType) {
    updateBlock(blockId, { type, text: '', checked: type === 'todo' ? false : null });
  }

  return (
    <div className="flowcean-document">
      <div className="flowcean-block-toolbar">
        {blockDefinitions.map(({ type, label, icon: Icon }) => (
          <button key={type} type="button" onClick={() => addBlock(type)}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
      {page.blocks.map((block, index) => {
        const definition = blockDefinitions.find((item) => item.type === block.type) ?? blockDefinitions[0];
        const Icon = definition.icon;
        const slashOpen = block.text.trim().startsWith('/');
        return (
          <div key={block.id} className={`flowcean-block ${block.type}`}>
            <div className="flowcean-block-handle">
              <Icon size={15} />
              <button type="button" onClick={() => moveBlock(block.id, -1)} disabled={index === 0}><ChevronLeft size={14} /></button>
              <button type="button" onClick={() => moveBlock(block.id, 1)} disabled={index === page.blocks.length - 1}><ChevronRight size={14} /></button>
            </div>
            <select value={block.type} onChange={(event) => updateBlock(block.id, { type: event.target.value as FlowceanBlockType, checked: event.target.value === 'todo' ? Boolean(block.checked) : null })}>
              {blockDefinitions.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}
            </select>
            {block.type === 'todo' && <input className="flowcean-check" type="checkbox" checked={Boolean(block.checked)} onChange={(event) => updateBlock(block.id, { checked: event.target.checked })} />}
            {block.type === 'divider' ? (
              <button type="button" className="flowcean-divider-block" onClick={() => insertBlockAfter(block.id)}>Ajouter un bloc dessous</button>
            ) : (
              <div className="flowcean-block-content">
                <textarea
                  value={block.text}
                  onChange={(event) => updateBlock(block.id, { text: event.target.value })}
                  placeholder={block.type === 'code' ? 'Coller du code...' : 'Ecrire, ou taper / pour une commande...'}
                />
                {slashOpen && (
                  <div className="flowcean-slash-menu">
                    {blockDefinitions.map(({ type, label, description, icon: SlashIcon }) => (
                      <button key={type} type="button" onClick={() => applySlashCommand(block.id, type)}>
                        <SlashIcon size={15} />
                        <span>{label}</span>
                        <small>{description}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flowcean-block-actions">
              <button type="button" className="icon-only secondary" onClick={() => insertBlockAfter(block.id)} title="Ajouter dessous"><Plus size={15} /></button>
              <button type="button" className="icon-only secondary" onClick={() => duplicateBlock(block.id)} title="Dupliquer"><Copy size={15} /></button>
              <button type="button" className="icon-only danger" onClick={() => removeBlock(block.id)} title="Supprimer"><Trash2 size={15} /></button>
            </div>
          </div>
        );
      })}
      {page.blocks.length === 0 && <EmptyState icon={FileText} title="Page vide" />}
    </div>
  );
}

function FlowceanDatabaseEditor({ page, updateFlowcean }: { page: FlowceanPage; updateFlowcean: (mutator: (draft: FlowceanState) => void) => void }) {
  const database = page.database ?? createDefaultFlowceanDatabase();
  const titleProperty = database.properties[0];
  const statusProperty = database.properties.find((property) => property.type === 'select') ?? database.properties[1];
  const dateProperty = database.properties.find((property) => property.type === 'date');
  const effortProperty = database.properties.find((property) => property.type === 'number');
  const [newPropertyName, setNewPropertyName] = useState('');
  const [newPropertyType, setNewPropertyType] = useState<FlowceanPropertyType>('text');
  const viewIcons: Record<FlowceanDatabaseView, typeof Box> = { table: Table2, board: KanbanSquare, calendar: CalendarDays, gantt: Clock };

  function mutateDatabase(mutator: (database: FlowceanDatabase) => void) {
    updateFlowcean((draft) => {
      const targetPage = draft.pages.find((item) => item.id === page.id);
      if (!targetPage) {
        return;
      }

      targetPage.database ??= createDefaultFlowceanDatabase();
      mutator(targetPage.database);
    });
  }

  function updateCell(rowId: string, property: FlowceanProperty, value: string) {
    mutateDatabase((draft) => {
      const row = draft.rows.find((item) => item.id === rowId);
      if (!row) {
        return;
      }

      row.cells[property.id] = property.type === 'checkbox' ? value === 'true' : property.type === 'number' ? Number(value || 0) : value;
    });
  }

  function addRow() {
    mutateDatabase((draft) => {
      const cells = Object.fromEntries(draft.properties.map((property) => [property.id, flowceanDefaultCellValue(property.type)]));
      draft.rows.unshift({ id: createFlowceanId('row'), cells });
    });
  }

  function removeRow(rowId: string) {
    mutateDatabase((draft) => {
      draft.rows = draft.rows.filter((row) => row.id !== rowId);
    });
  }

  function addProperty(event: FormEvent) {
    event.preventDefault();
    const name = newPropertyName.trim();
    if (!name) {
      return;
    }

    mutateDatabase((draft) => {
      const property: FlowceanProperty = {
        id: createFlowceanId('prop'),
        name,
        type: newPropertyType,
        options: newPropertyType === 'select' ? ['A faire', 'En cours', 'Termine'] : []
      };
      draft.properties.push(property);
      draft.rows.forEach((row) => {
        row.cells[property.id] = flowceanDefaultCellValue(property.type);
      });
    });
    setNewPropertyName('');
    setNewPropertyType('text');
  }

  function updateProperty(propertyId: string, patch: Partial<FlowceanProperty>) {
    mutateDatabase((draft) => {
      const property = draft.properties.find((item) => item.id === propertyId);
      if (property) {
        Object.assign(property, patch);
      }
    });
  }

  function removeProperty(propertyId: string) {
    mutateDatabase((draft) => {
      if (draft.properties.length <= 1) {
        return;
      }

      draft.properties = draft.properties.filter((property) => property.id !== propertyId);
      draft.rows.forEach((row) => {
        delete row.cells[propertyId];
      });
    });
  }

  return (
    <div className="flowcean-database">
      <div className="flowcean-view-tabs">
        {(['table', 'board', 'calendar', 'gantt'] as FlowceanDatabaseView[]).map((view) => (
          <button key={view} type="button" className={database.activeView === view ? 'active' : ''} onClick={() => mutateDatabase((draft) => { draft.activeView = view; })}>
            {(() => {
              const Icon = viewIcons[view];
              return <Icon size={15} />;
            })()}
            {flowceanViewLabel(view)}
          </button>
        ))}
        <button type="button" className="secondary" onClick={addRow}><Plus size={16} /> Ligne</button>
      </div>
      <div className="flowcean-properties">
        <div className="flowcean-property-list">
          {database.properties.map((property) => (
            <article key={property.id}>
              <input value={property.name} onChange={(event) => updateProperty(property.id, { name: event.target.value })} />
              <select value={property.type} onChange={(event) => updateProperty(property.id, { type: event.target.value as FlowceanPropertyType, options: event.target.value === 'select' && property.options.length === 0 ? ['A faire', 'En cours', 'Termine'] : property.options })}>
                {(['text', 'select', 'date', 'checkbox', 'number', 'email', 'url'] as FlowceanPropertyType[]).map((type) => (
                  <option key={type} value={type}>{flowceanPropertyLabel(type)}</option>
                ))}
              </select>
              {property.type === 'select' && (
                <input value={property.options.join(', ')} onChange={(event) => updateProperty(property.id, { options: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} placeholder="Options separees par virgules" />
              )}
              <button type="button" className="icon-only danger" onClick={() => removeProperty(property.id)} disabled={database.properties.length <= 1}><Trash2 size={15} /></button>
            </article>
          ))}
        </div>
        <form className="flowcean-add-property" onSubmit={addProperty}>
          <input value={newPropertyName} onChange={(event) => setNewPropertyName(event.target.value)} placeholder="Nouvelle propriete" />
          <select value={newPropertyType} onChange={(event) => setNewPropertyType(event.target.value as FlowceanPropertyType)}>
            {(['text', 'select', 'date', 'checkbox', 'number', 'email', 'url'] as FlowceanPropertyType[]).map((type) => (
              <option key={type} value={type}>{flowceanPropertyLabel(type)}</option>
            ))}
          </select>
          <button type="submit" className="secondary"><Plus size={15} /> Ajouter</button>
        </form>
      </div>
      {database.activeView === 'table' && (
        <div className="flowcean-db-table">
          <table>
            <thead>
              <tr>
                {database.properties.map((property) => <th key={property.id}>{property.name}</th>)}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {database.rows.map((row) => (
                <tr key={row.id}>
                  {database.properties.map((property) => (
                    <td key={property.id}>{renderFlowceanCell(row, property, (value) => updateCell(row.id, property, value))}</td>
                  ))}
                  <td><button type="button" className="icon-only danger" onClick={() => removeRow(row.id)}><Trash2 size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {database.activeView === 'board' && (
        <div className="flowcean-board">
          {(statusProperty?.options?.length ? statusProperty.options : ['A faire', 'En cours', 'Termine']).map((status) => (
            <section key={status}>
              <h3>{status}</h3>
              {database.rows.filter((row) => statusProperty ? String(row.cells[statusProperty.id] ?? '') === status : true).map((row) => (
                <article key={row.id}>
                  <strong>{String(row.cells[titleProperty.id] ?? 'Sans titre')}</strong>
                  {dateProperty && <span>{String(row.cells[dateProperty.id] ?? '')}</span>}
                </article>
              ))}
            </section>
          ))}
        </div>
      )}
      {database.activeView === 'calendar' && (
        <div className="flowcean-calendar-view">
          {database.rows.map((row) => (
            <article key={row.id}>
              <strong>{dateProperty ? String(row.cells[dateProperty.id] ?? 'Sans date') : 'Sans date'}</strong>
              <span>{String(row.cells[titleProperty.id] ?? 'Sans titre')}</span>
            </article>
          ))}
        </div>
      )}
      {database.activeView === 'gantt' && (
        <div className="flowcean-gantt">
          {database.rows.map((row) => {
            const effort = Number(effortProperty ? row.cells[effortProperty.id] : 2) || 2;
            return (
              <div key={row.id} className="flowcean-gantt-row">
                <span>{String(row.cells[titleProperty.id] ?? 'Sans titre')}</span>
                <div><i style={{ width: `${Math.min(100, Math.max(12, effort * 14))}%` }} /></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function renderFlowceanCell(row: FlowceanRow, property: FlowceanProperty, onChange: (value: string) => void) {
  const value = row.cells[property.id];
  if (property.type === 'select') {
    return (
      <select value={String(value ?? '')} onChange={(event) => onChange(event.target.value)}>
        <option value="">-</option>
        {property.options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  }

  if (property.type === 'checkbox') {
    return <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(String(event.target.checked))} />;
  }

  return (
    <input
      type={property.type === 'date' ? 'date' : property.type === 'number' ? 'number' : property.type === 'email' ? 'email' : property.type === 'url' ? 'url' : 'text'}
      value={String(value ?? '')}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function parseFlowceanState(workspace: FlowceanWorkspace): FlowceanState {
  try {
    return normalizeFlowceanState(JSON.parse(workspace.dataJson) as unknown, workspace.name, workspace.slug);
  } catch {
    // L'espace sera reconstruit ci-dessous si le JSON historique est illisible.
    return createLocalFlowceanDefaultState(workspace.name, workspace.slug);
  }
}

function normalizeFlowceanState(raw: unknown, workspaceName: string, workspaceSlug: string): FlowceanState {
  const value = flowceanIsRecord(raw) ? raw : {};
  const workspaceValue = flowceanIsRecord(value.workspace) ? value.workspace : {};
  const uiValue = flowceanIsRecord(value.ui) ? value.ui : {};
  const normalizedPages = Array.isArray(value.pages)
    ? value.pages.map(normalizeFlowceanPage).filter((page): page is FlowceanPage => Boolean(page))
    : [];
  const fallback = createLocalFlowceanDefaultState(workspaceName, workspaceSlug);
  const pages = normalizedPages.length > 0 ? normalizedPages : fallback.pages;
  const requestedActivePageId = typeof uiValue.activePageId === 'string' ? uiValue.activePageId : null;
  const activePageId = requestedActivePageId && pages.some((page) => page.id === requestedActivePageId && !page.deletedAt)
    ? requestedActivePageId
    : pages.find((page) => !page.deletedAt)?.id ?? pages[0]?.id ?? null;
  const meta = flowceanIsRecord(value.meta) ? { ...value.meta } : {};

  if (Array.isArray(value.shares)) {
    meta.flowceanShares = value.shares
      .map(normalizeFlowceanShare)
      .filter((share): share is FlowceanShare => Boolean(share));
  }

  if (Array.isArray(value.activity)) {
    meta.flowceanActivity = value.activity.filter(flowceanIsRecord).slice(0, 80);
  }

  return {
    workspace: {
      name: flowceanString(workspaceValue.name, workspaceName),
      theme: normalizeFlowceanTheme(workspaceValue.theme)
    },
    pages,
    ui: { activePageId },
    meta: { ...meta, workspaceSlug }
  };
}

function normalizeFlowceanPage(raw: unknown): FlowceanPage | null {
  if (!flowceanIsRecord(raw)) {
    return null;
  }

  const kind: FlowceanPageKind = raw.kind === 'database' || raw.database ? 'database' : 'document';
  const blocks = Array.isArray(raw.blocks)
    ? raw.blocks.map(normalizeFlowceanBlock).filter((block): block is FlowceanBlock => Boolean(block))
    : [];

  return {
    id: flowceanString(raw.id, createFlowceanId('page')),
    parentId: typeof raw.parentId === 'string' ? raw.parentId : null,
    title: flowceanString(raw.title, 'Sans titre'),
    icon: flowceanString(raw.icon, kind === 'database' ? 'DB' : 'DOC'),
    favorite: Boolean(raw.favorite),
    expanded: raw.expanded !== false,
    kind,
    updatedAt: flowceanNumber(raw.updatedAt, flowceanNumber(raw.createdAt, Date.now())),
    deletedAt: typeof raw.deletedAt === 'number' ? raw.deletedAt : raw.archived ? Date.now() : null,
    blocks: kind === 'database' ? [] : blocks.length > 0 ? blocks : [createFlowceanBlock('paragraph')],
    database: kind === 'database' ? normalizeFlowceanDatabase(raw.database) : null
  };
}

function normalizeFlowceanBlock(raw: unknown): FlowceanBlock | null {
  if (!flowceanIsRecord(raw)) {
    return null;
  }

  const originalType = typeof raw.type === 'string' ? raw.type : '';
  const type = flowceanValidBlockType(originalType);
  const fallbackText = originalType === 'image' || originalType === 'file'
    ? [flowceanString(raw.caption, ''), flowceanString(raw.url, '')].filter(Boolean).join(' ')
    : '';

  return {
    id: flowceanString(raw.id, createFlowceanId('block')),
    type,
    text: flowceanString(raw.text, fallbackText),
    checked: typeof raw.checked === 'boolean' ? raw.checked : type === 'todo' ? false : null
  };
}

function normalizeFlowceanDatabase(raw: unknown): FlowceanDatabase {
  const fallback = createDefaultFlowceanDatabase();
  if (!flowceanIsRecord(raw)) {
    return fallback;
  }

  const properties = Array.isArray(raw.properties)
    ? raw.properties.map(normalizeFlowceanProperty).filter((property): property is FlowceanProperty => Boolean(property))
    : [];
  const safeProperties = properties.length > 0 ? properties : fallback.properties;
  const rows = Array.isArray(raw.rows)
    ? raw.rows.map((row) => normalizeFlowceanRow(row, safeProperties)).filter((row): row is FlowceanRow => Boolean(row))
    : [];

  return {
    activeView: normalizeFlowceanDatabaseView(raw.activeView),
    properties: safeProperties,
    rows
  };
}

function normalizeFlowceanProperty(raw: unknown): FlowceanProperty | null {
  if (!flowceanIsRecord(raw)) {
    return null;
  }

  return {
    id: flowceanString(raw.id, createFlowceanId('prop')),
    name: flowceanString(raw.name, 'Propriete'),
    type: normalizeFlowceanPropertyType(raw.type),
    options: Array.isArray(raw.options) ? raw.options.filter((item): item is string => typeof item === 'string') : []
  };
}

function normalizeFlowceanRow(raw: unknown, properties: FlowceanProperty[]): FlowceanRow | null {
  if (!flowceanIsRecord(raw)) {
    return null;
  }

  const rawCells = flowceanIsRecord(raw.cells) ? raw.cells : {};
  const cells: Record<string, FlowceanCellValue> = {};
  properties.forEach((property) => {
    cells[property.id] = normalizeFlowceanCellValue(rawCells[property.id]);
  });

  return {
    id: flowceanString(raw.id, createFlowceanId('row')),
    cells
  };
}

function normalizeFlowceanShare(raw: unknown): FlowceanShare | null {
  if (!flowceanIsRecord(raw)) {
    return null;
  }

  const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : '';
  if (!email) {
    return null;
  }

  return {
    id: flowceanString(raw.id, createFlowceanId('share')),
    email,
    role: raw.role === 'lecture' ? 'lecture' : 'edition'
  };
}

function normalizeFlowceanTheme(value: unknown) {
  return value === 'dark' || value === 'focus' ? 'dark' : 'light';
}

function normalizeFlowceanDatabaseView(value: unknown): FlowceanDatabaseView {
  return value === 'board' || value === 'calendar' || value === 'gantt' ? value : 'table';
}

function normalizeFlowceanPropertyType(value: unknown): FlowceanPropertyType {
  if (value === 'status') {
    return 'select';
  }

  const types: FlowceanPropertyType[] = ['text', 'select', 'date', 'checkbox', 'number', 'email', 'url'];
  return types.includes(value as FlowceanPropertyType) ? value as FlowceanPropertyType : 'text';
}

function normalizeFlowceanCellValue(value: unknown): FlowceanCellValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  return String(value);
}

function flowceanIsRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function flowceanString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function flowceanNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function cloneFlowceanState(state: FlowceanState): FlowceanState {
  return JSON.parse(JSON.stringify(state)) as FlowceanState;
}

function createLocalFlowceanDefaultState(name: string, slug: string): FlowceanState {
  const now = Date.now();
  const pageId = createFlowceanId('page');
  return {
    workspace: { name, theme: 'dark' },
    ui: { activePageId: pageId },
    meta: { workspaceSlug: slug, source: 'oceanerp-local' },
    pages: [
      {
        id: pageId,
        parentId: null,
        title: 'Accueil',
        icon: 'OE',
        favorite: true,
        expanded: true,
        kind: 'document',
        updatedAt: now,
        deletedAt: null,
        blocks: [
          { id: createFlowceanId('block'), type: 'h1', text: 'Espace de travail', checked: null },
          { id: createFlowceanId('block'), type: 'paragraph', text: 'Ajoutez vos notes, tableaux et suivis internes.', checked: null }
        ],
        database: null
      }
    ]
  };
}

function createDefaultFlowceanDatabase(): FlowceanDatabase {
  return {
    activeView: 'table',
    properties: [
      { id: 'prop-name', name: 'Nom', type: 'text', options: [] },
      { id: 'prop-status', name: 'Statut', type: 'select', options: ['A faire', 'En cours', 'Termine'] },
      { id: 'prop-owner', name: 'Responsable', type: 'text', options: [] },
      { id: 'prop-date', name: 'Date', type: 'date', options: [] },
      { id: 'prop-effort', name: 'Charge', type: 'number', options: [] }
    ],
    rows: []
  };
}

function flowceanTemplateDefinitions(): FlowceanTemplateDefinition[] {
  return [
    {
      key: 'project',
      title: 'Pilotage projet',
      badge: 'PRJ',
      description: 'Objectifs, decisions, todo et planning de suivi.',
      create: () => ({
        ...createEmptyFlowceanPage('document', null),
        title: 'Pilotage projet',
        icon: 'PRJ',
        favorite: true,
        blocks: [
          createFlowceanBlock('h1', 'Pilotage projet'),
          createFlowceanBlock('callout', 'Objectif : decrire le resultat attendu, le responsable et la date cible.'),
          createFlowceanBlock('h2', 'Decisions'),
          createFlowceanBlock('bullet', 'Decision importante a suivre'),
          createFlowceanBlock('h2', 'Actions'),
          createFlowceanBlock('todo', 'Action a attribuer'),
          createFlowceanBlock('todo', 'Point de controle')
        ]
      })
    },
    {
      key: 'meeting',
      title: 'Compte rendu',
      badge: 'CR',
      description: 'Reunion, participants, decisions et prochaines etapes.',
      create: () => ({
        ...createEmptyFlowceanPage('document', null),
        title: 'Compte rendu',
        icon: 'CR',
        blocks: [
          createFlowceanBlock('h1', 'Compte rendu'),
          createFlowceanBlock('paragraph', 'Date, participants et contexte.'),
          createFlowceanBlock('h2', 'Points abordes'),
          createFlowceanBlock('bullet', ''),
          createFlowceanBlock('h2', 'A faire'),
          createFlowceanBlock('todo', '')
        ]
      })
    },
    {
      key: 'crm',
      title: 'Suivi commercial',
      badge: 'CRM',
      description: 'Tableau des opportunites avec vues table, cartes, calendrier et Gantt.',
      create: () => ({
        ...createEmptyFlowceanPage('database', null),
        title: 'Suivi commercial',
        icon: 'CRM',
        database: {
          activeView: 'board',
          properties: [
            { id: 'prop-name', name: 'Opportunite', type: 'text', options: [] },
            { id: 'prop-status', name: 'Statut', type: 'select', options: ['A qualifier', 'Devis', 'Gagne', 'Perdu'] },
            { id: 'prop-owner', name: 'Responsable', type: 'text', options: [] },
            { id: 'prop-date', name: 'Relance', type: 'date', options: [] },
            { id: 'prop-amount', name: 'Montant', type: 'number', options: [] }
          ],
          rows: [
            { id: createFlowceanId('row'), cells: { 'prop-name': 'Nouveau prospect', 'prop-status': 'A qualifier', 'prop-owner': '', 'prop-date': '', 'prop-amount': 0 } },
            { id: createFlowceanId('row'), cells: { 'prop-name': 'Devis a relancer', 'prop-status': 'Devis', 'prop-owner': '', 'prop-date': '', 'prop-amount': 0 } }
          ]
        }
      })
    },
    {
      key: 'operations',
      title: 'Plan operationnel',
      badge: 'OPS',
      description: 'Base de donnees pour taches, priorites, dates et charge.',
      create: () => ({
        ...createEmptyFlowceanPage('database', null),
        title: 'Plan operationnel',
        icon: 'OPS',
        database: createDefaultFlowceanDatabase()
      })
    }
  ];
}

function createEmptyFlowceanPage(kind: FlowceanPageKind, parentId: string | null): FlowceanPage {
  const now = Date.now();
  return {
    id: createFlowceanId('page'),
    parentId,
    title: kind === 'database' ? 'Nouveau tableau' : 'Nouvelle page',
    icon: kind === 'database' ? 'DB' : 'DOC',
    favorite: false,
    expanded: true,
    kind,
    updatedAt: now,
    deletedAt: null,
    blocks: kind === 'database' ? [] : [createFlowceanBlock('paragraph', '')],
    database: kind === 'database' ? createDefaultFlowceanDatabase() : null
  };
}

function createFlowceanBlock(type: FlowceanBlockType, text = ''): FlowceanBlock {
  return { id: createFlowceanId('block'), type, text, checked: type === 'todo' ? false : null };
}

function cloneFlowceanPage(page: FlowceanPage): FlowceanPage {
  const cloned = cloneFlowceanState({ workspace: { name: '', theme: 'light' }, pages: [page], ui: { activePageId: page.id }, meta: {} }).pages[0];
  return rekeyFlowceanPage(cloned);
}

function rekeyFlowceanPage(page: FlowceanPage): FlowceanPage {
  const oldId = page.id;
  const nextId = createFlowceanId('page');
  page.id = nextId;
  page.parentId = page.parentId === oldId ? null : page.parentId;
  page.blocks = page.blocks.map((block) => ({ ...block, id: createFlowceanId('block') }));
  if (page.database) {
    const propertyMap = new Map<string, string>();
    page.database.properties = page.database.properties.map((property) => {
      const nextPropertyId = createFlowceanId('prop');
      propertyMap.set(property.id, nextPropertyId);
      return { ...property, id: nextPropertyId };
    });
    page.database.rows = page.database.rows.map((row) => {
      const cells = Object.fromEntries(Object.entries(row.cells).map(([propertyId, value]) => [propertyMap.get(propertyId) ?? propertyId, value]));
      return { ...row, id: createFlowceanId('row'), cells };
    });
  }
  return page;
}

function normalizeImportedFlowceanState(text: string, workspaceName: string, workspaceSlug: string): FlowceanState {
  const parsed = JSON.parse(text) as unknown;
  if (!flowceanIsRecord(parsed) || !Array.isArray(parsed.pages)) {
    throw new Error('Le fichier importe ne contient pas de pages Flowcean.');
  }

  const state = normalizeFlowceanState(parsed, workspaceName, workspaceSlug);
  return {
    ...state,
    meta: { ...state.meta, workspaceSlug, importedAt: new Date().toISOString() }
  };
}

function flowceanValidBlockType(value: unknown): FlowceanBlockType {
  if (value === 'heading1') {
    return 'h1';
  }

  if (value === 'heading2') {
    return 'h2';
  }

  if (value === 'heading3') {
    return 'h3';
  }

  if (value === 'image' || value === 'file' || value === 'database') {
    return 'callout';
  }

  const types: FlowceanBlockType[] = ['paragraph', 'h1', 'h2', 'h3', 'todo', 'bullet', 'numbered', 'quote', 'callout', 'code', 'divider'];
  return types.includes(value as FlowceanBlockType) ? value as FlowceanBlockType : 'paragraph';
}

function flowceanCacheKey(slug: string) {
  return `${FLOWCEAN_CACHE_PREFIX}.${slug}`;
}

function readFlowceanCache(slug: string) {
  try {
    return localStorage.getItem(flowceanCacheKey(slug));
  } catch {
    return null;
  }
}

function writeFlowceanCache(slug: string, dataJson: string) {
  try {
    localStorage.setItem(flowceanCacheKey(slug), dataJson);
  } catch {
    // Le cache local est un confort, jamais un pre-requis.
  }
}

function flowceanShares(state: FlowceanState): FlowceanShare[] {
  const value = state.meta.flowceanShares;
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => item as Partial<FlowceanShare>)
    .filter((item): item is FlowceanShare => Boolean(item.id && item.email && (item.role === 'lecture' || item.role === 'edition')));
}

function flowceanBreadcrumbs(pages: FlowceanPage[], page: FlowceanPage) {
  const byId = new Map(pages.map((item) => [item.id, item]));
  const chain: FlowceanPage[] = [];
  let cursor: FlowceanPage | undefined = page;
  while (cursor) {
    chain.unshift(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return chain;
}

function flowceanSearchHits(pages: FlowceanPage[], query: string): FlowceanSearchHit[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return pages.filter((page) => !page.deletedAt).slice(0, 12).map((page) => ({ page, excerpt: page.kind === 'database' ? 'Tableau' : page.blocks[0]?.text ?? 'Page' }));
  }

  return pages
    .filter((page) => !page.deletedAt)
    .map((page) => {
      const blockExcerpt = page.blocks.find((block) => block.text.toLowerCase().includes(normalizedQuery))?.text;
      const rowExcerpt = page.database?.rows
        .flatMap((row) => Object.values(row.cells).map((value) => String(value ?? '')))
        .find((value) => value.toLowerCase().includes(normalizedQuery));
      const haystack = [page.title, blockExcerpt, rowExcerpt].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(normalizedQuery) ? { page, excerpt: blockExcerpt ?? rowExcerpt ?? page.title } : null;
    })
    .filter((hit): hit is FlowceanSearchHit => Boolean(hit))
    .slice(0, 20);
}

function formatFlowceanDate(timestamp: number) {
  if (!timestamp) {
    return '-';
  }

  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
}

function flowceanDefaultCellValue(type: FlowceanPropertyType): FlowceanCellValue {
  if (type === 'number') {
    return 0;
  }
  if (type === 'checkbox') {
    return false;
  }
  return '';
}

function flowceanPropertyLabel(type: FlowceanPropertyType) {
  return ({ text: 'Texte', select: 'Select', date: 'Date', checkbox: 'Case', number: 'Nombre', email: 'Email', url: 'URL' } satisfies Record<FlowceanPropertyType, string>)[type];
}

function flowceanBlockDefinitions(): Array<{ type: FlowceanBlockType; label: string; description: string; icon: typeof Box }> {
  return [
    { type: 'paragraph', label: 'Texte', description: 'Un bloc de texte simple', icon: FileText },
    { type: 'h1', label: 'Titre 1', description: 'Grand titre de section', icon: BookOpen },
    { type: 'h2', label: 'Titre 2', description: 'Sous-section', icon: BookOpen },
    { type: 'h3', label: 'Titre 3', description: 'Petit titre', icon: BookOpen },
    { type: 'todo', label: 'Todo', description: 'Case a cocher', icon: CheckSquare },
    { type: 'bullet', label: 'Liste', description: 'Liste a puces', icon: ListTodo },
    { type: 'numbered', label: 'Numerotee', description: 'Liste numerotee', icon: ListTodo },
    { type: 'quote', label: 'Citation', description: 'Citation mise en avant', icon: QuoteIcon },
    { type: 'callout', label: 'Encart', description: 'Bloc important', icon: FolderTree },
    { type: 'code', label: 'Code', description: 'Bloc technique', icon: Code2 },
    { type: 'divider', label: 'Separateur', description: 'Ligne de separation', icon: Minus }
  ];
}

function createFlowceanId(prefix: string) {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${prefix}-${random}`;
}

function flowceanBlockLabel(type: FlowceanBlockType) {
  return ({ paragraph: 'Texte', h1: 'Titre 1', h2: 'Titre 2', h3: 'Titre 3', todo: 'Todo', bullet: 'Liste', numbered: 'Numerotee', quote: 'Citation', callout: 'Encart', code: 'Code', divider: 'Separateur' } satisfies Record<FlowceanBlockType, string>)[type];
}

function flowceanViewLabel(view: FlowceanDatabaseView) {
  return ({ table: 'Tableau', board: 'Cartes', calendar: 'Calendrier', gantt: 'Gantt' } satisfies Record<FlowceanDatabaseView, string>)[view];
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
