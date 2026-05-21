const STORAGE_KEY_PREFIX = "flowceanStateCache.v2";
const WORKSPACE_SELECTION_KEY = "flowceanSelectedWorkspace.v1";
const LEGACY_STORAGE_KEYS = ["appflowyCodexState.v1"];
const SIDEBAR_WIDTH_STORAGE_KEY = "flowceanSidebarWidth.v1";
const DEFAULT_WORKSPACE_SLUG = "main";
const WORKSPACE_API_URL = "/api/flowcean/compat/workspace";
const WORKSPACES_API_URL = "/api/flowcean/compat/workspaces";
const PREFERENCES_API_URL = "/api/flowcean/compat/preferences";
const PRESENCE_API_URL = "/api/flowcean/compat/presence";
const REALTIME_API_URL = "/api/flowcean/compat/realtime";
const AUTH_API_URL = "/api/flowcean/compat/auth";
const USERS_API_URL = "/api/flowcean/compat/users";
const PEOPLE_API_URL = "/api/flowcean/compat/people";
const NOTIFICATIONS_API_URL = "/api/flowcean/compat/notifications";
const AI_API_URL = "/api/flowcean/compat/ai";
const OCEANOS_URL = "/";
const ERP_AI_SETTINGS_URL = "/?view=settings";

function openErpAiSettings() {
  try {
    window.parent?.localStorage?.setItem("oceanerp.settings.activeTab", "ai");
    if (window.parent && window.parent !== window) {
      window.parent.location.href = ERP_AI_SETTINGS_URL;
      return;
    }
  } catch (error) {
    // Ignore parent access limitations in isolated windows.
  }

  try {
    localStorage.setItem("oceanerp.settings.activeTab", "ai");
  } catch (error) {
    // Ignore localStorage failures.
  }
  window.location.href = ERP_AI_SETTINGS_URL;
}

function redirectToOceanOS() {
  window.parent?.postMessage({ type: "oceanerp:flowcean-auth-required" }, window.location.origin);
  window.location.replace(OCEANOS_URL);
}

function oceanErpAuthHeaders(headers = {}) {
  const token = window.localStorage.getItem("oceanerp.accessToken");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };
}
const ICONS = [
  "\u{1F331}", "\u{1F33F}", "\u{1F343}", "\u{1F680}", "\u{1F4A1}", "\u{1F9E0}", "\u{1F9E9}", "\u{2728}",
  "\u{1F4CC}", "\u{1F3AF}", "\u{1F4DA}", "\u{1F4D8}", "\u{1F4C1}", "\u{1F5C2}", "\u{1F4C5}", "\u{1F6E0}",
  "\u{1F527}", "\u{2699}", "\u{1F4A7}", "\u{1F30A}", "\u{26F5}", "\u{1F6A2}", "\u{2693}", "\u{1F3DD}",
  "\u{1F3D7}", "\u{1F3E0}", "\u{1F3E2}", "\u{1F4B0}", "\u{1F4C8}", "\u{1F4CA}", "\u{2705}", "\u{1F514}",
  "\u{1F50D}", "\u{1F512}", "\u{1F511}", "\u{1F48E}", "\u{1F3C6}", "\u{2B50}", "\u{2764}", "\u{1F525}",
  "\u{1F4AC}", "\u{1F4E3}", "\u{1F4E6}", "\u{1F4E8}", "\u{1F4F7}", "\u{1F3A8}", "\u{1F3B5}", "\u{1F3AE}",
  "\u{1F9ED}", "\u{1F5FA}", "\u{1F4CD}", "\u{1F6A9}", "\u{1F6E1}", "\u{1F9EA}", "\u{1F52C}", "\u{1F48A}",
  "\u{1F34E}", "\u{2615}", "\u{1F36D}", "\u{1F355}", "\u{1F43E}", "\u{1F98A}", "\u{1F433}", "\u{1F419}"
];
const VIEW_LABELS = {
  table: "Table",
  board: "Cartes",
  calendar: "Calendrier",
  gantt: "Gantt",
};
const DEFAULT_DATABASE_VIEW_TYPES = ["table", "board", "calendar", "gantt"];
const PAGE_KIND_LABELS = {
  document: "Page",
  database: "Tableau",
};
const PAGE_SUBTYPE_LABELS = {
  word: "Word",
  excel: "Excel",
};
const WORD_ZOOM_MIN = 0.5;
const WORD_ZOOM_MAX = 2;
const WORD_ZOOM_STEP = 0.1;
const TABLE_PROPERTY_DRAG_MIME = "application/x-flowcean-property";
const TABLE_ROW_DRAG_MIME = "application/x-flowcean-row";
const BLOCK_DRAG_MIME = "application/x-flowcean-block";
const TREE_PAGE_DRAG_MIME = "application/x-flowcean-page";
const UNDO_STACK_LIMIT = 60;
const UNDO_TEXT_COALESCE_MS = 1400;
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 560;
const SPREADSHEET_DEFAULT_COLUMN_WIDTH = 156;
const SPREADSHEET_MIN_COLUMN_WIDTH = 72;
const SPREADSHEET_MAX_COLUMN_WIDTH = 520;
const SPREADSHEET_DEFAULT_ROW_HEIGHT = 46;
const SPREADSHEET_MIN_ROW_HEIGHT = 32;
const SPREADSHEET_MAX_ROW_HEIGHT = 360;
const SPREADSHEET_MIN_IMAGE_SCALE = 24;
const SPREADSHEET_MAX_IMAGE_SCALE = 100;
const SPREADSHEET_WORKER_URL = "assets/spreadsheet-worker.js";
const PROPERTY_DEFINITIONS = [
  { type: "ai_summary", label: "Resume IA", hint: "Genere un resume Groq a partir des valeurs de la ligne." },
  { type: "ai_translate", label: "Traduction IA", hint: "Genere une traduction Groq a partir des valeurs de la ligne." },
  { type: "text", label: "Texte", hint: "Champ texte libre." },
  { type: "number", label: "Numero", hint: "Valeur numerique." },
  { type: "select", label: "Selectionner", hint: "Un seul choix parmi une liste." },
  { type: "multi_select", label: "Selection multiple", hint: "Plusieurs choix separes par des virgules." },
  { type: "status", label: "Etat", hint: "Statut de travail type Notion." },
  { type: "date", label: "Date", hint: "Date pour calendrier et Gantt." },
  { type: "person", label: "Personne", hint: "Nom d'un collaborateur ou responsable." },
  { type: "files", label: "Fichiers et medias", hint: "Lien ou reference vers un fichier." },
  { type: "checkbox", label: "Case a cocher", hint: "Valeur oui/non." },
  { type: "url", label: "URL", hint: "Lien web." },
  { type: "phone", label: "Telephone", hint: "Numero de telephone." },
  { type: "email", label: "E-mail", hint: "Adresse e-mail." },
  { type: "relation", label: "Relation", hint: "Lien texte vers une autre page ou entree." },
  { type: "rollup", label: "Agregation", hint: "Resume local des champs remplis." },
  { type: "formula", label: "Formule", hint: "Calcul numerique avec {Nom du champ}." },
  { type: "button", label: "Bouton", hint: "Bouton d'action dans chaque ligne." },
  { type: "identifier", label: "Identifiant", hint: "Identifiant automatique de ligne." },
  { type: "location", label: "Lieu", hint: "Adresse ou emplacement." },
];
const PROPERTY_TYPE_IDS = PROPERTY_DEFINITIONS.map((definition) => definition.type);
const OPTION_PROPERTY_TYPES = ["select", "multi_select", "status"];
const CONFIGURABLE_PROPERTY_TYPES = [...OPTION_PROPERTY_TYPES, "formula", "button"];
const DEFAULT_PROPERTY_OPTIONS = {
  select: ["A faire", "En cours", "Termine"],
  multi_select: ["Important", "Client", "Interne"],
  status: ["A faire", "En cours", "Termine"],
  button: ["Action"],
  formula: [""],
};
const PROJECT_STATUS_OPTIONS = ["A faire", "En cours", "Bloque", "Termine"];
const PROJECT_PRIORITY_OPTIONS = ["Basse", "Moyenne", "Haute", "Urgente"];
const BLOCK_DEFINITIONS = [
  { type: "paragraph", label: "Texte", hint: "Bloc de texte simple." },
  { type: "h1", label: "Titre 1", hint: "Grand titre de section." },
  { type: "h2", label: "Titre 2", hint: "Titre de section." },
  { type: "h3", label: "Titre 3", hint: "Sous-section." },
  { type: "bullet", label: "Liste a puces", hint: "Liste simple." },
  { type: "numbered", label: "Liste numerotee", hint: "Liste ordonnee." },
  { type: "todo", label: "Checklist", hint: "Tache a cocher." },
  { type: "quote", label: "Citation", hint: "Mettre en avant une idee." },
  { type: "callout", label: "Callout", hint: "Bloc d'information." },
  { type: "table", label: "Tableau", hint: "Tableau simple avec lignes et colonnes dans la page." },
  { type: "image", label: "Image", hint: "Importer ou glisser-deposer une image." },
  { type: "code", label: "Code", hint: "Bloc monospace." },
  { type: "divider", label: "Separateur", hint: "Ligne de separation." },
];
const AI_EDITABLE_BLOCK_TYPES = ["paragraph", "h1", "h2", "h3", "bullet", "numbered", "todo", "quote", "callout", "code"];
const SLASH_AI_ACTIONS = [
  { action: "assistant", label: "Assistant IA", hint: "Ouvrir l'assistant Groq avec le contexte de la page.", keywords: ["ia", "ai", "assistant", "groq"] },
  { action: "propose", label: "Proposer des corrections IA", hint: "Revoir les blocs puis appliquer uniquement ce que vous acceptez.", keywords: ["ia", "proposer", "correction", "modifier"] },
  { action: "summary", label: "Resume IA de la page", hint: "Ajouter un resume structure en bas de page.", keywords: ["ia", "resume", "resumer", "summary"] },
  { action: "tasks", label: "Taches IA", hint: "Extraire une checklist depuis la page.", keywords: ["ia", "tache", "taches", "action"] },
  { action: "plan", label: "Plan projet IA", hint: "Generer objectifs, jalons, risques et prochaines actions.", keywords: ["ia", "plan", "projet"] },
];
const TEMPLATES = [
  {
    id: "meeting-notes",
    badge: "Document",
    name: "Meeting Notes",
    description: "Agenda, decisions, blockers and action items in one structured page.",
    build: () => ({
      kind: "document",
      icon: "🧠",
      title: "Compte rendu de reunion",
      favorite: false,
      blocks: [
        createBlock("h1", "Objectif de la reunion"),
        createBlock("paragraph", "Precisez ici le sujet, le contexte et les enjeux."),
        createBlock("h2", "Agenda"),
        createBlock("bullet", "Tour de table"),
        createBlock("bullet", "Points a arbitrer"),
        createBlock("bullet", "Prochaines etapes"),
        createBlock("h2", "Decisions"),
        createBlock("callout", "Notez les decisions importantes et leur impact."),
        createBlock("h2", "Actions"),
        createBlock("todo", "Partager le compte rendu"),
        createBlock("todo", "Planifier le suivi"),
      ],
    }),
  },
  {
    id: "wiki",
    badge: "Document",
    name: "Team Wiki",
    description: "A lightweight knowledge base with sections for tools, processes and contacts.",
    build: () => ({
      kind: "document",
      icon: "📚",
      title: "Base de connaissances",
      favorite: false,
      blocks: [
        createBlock("h1", "Bienvenue dans le wiki"),
        createBlock("paragraph", "Centralisez ici les procedures, les reperes et les contacts utiles."),
        createBlock("h2", "Acces rapides"),
        createBlock("bullet", "Liens vers les outils"),
        createBlock("bullet", "Guides de demarrage"),
        createBlock("bullet", "FAQ interne"),
        createBlock("h2", "Responsables"),
        createBlock("quote", "Pensez a indiquer qui maintient chaque section."),
      ],
    }),
  },
  {
    id: "roadmap",
    badge: "Tableau",
    name: "Product Roadmap",
    description: "Un tableau multi-vues avec suivi par statut, date, responsable et livraison.",
    build: () => ({
      kind: "database",
      icon: "🚀",
      title: "Roadmap produit",
      favorite: true,
      database: createDatabase(
        [
          createProperty("Nom", "text"),
          createProperty("Statut", "select", ["A faire", "En cours", "Bloque", "Lance"]),
          createProperty("Date", "date"),
          createProperty("Responsable", "text"),
          createProperty("Fait", "checkbox"),
        ],
        [
          { Nom: "Onboarding v2", Statut: "En cours", Date: offsetDate(2), Responsable: "Sarah", Fait: false },
          { Nom: "Centre de commandes", Statut: "A faire", Date: offsetDate(8), Responsable: "Yanis", Fait: false },
          { Nom: "Mode hors ligne", Statut: "Bloque", Date: offsetDate(11), Responsable: "Mila", Fait: false },
          { Nom: "Beta publique", Statut: "Lance", Date: offsetDate(-2), Responsable: "Nora", Fait: true },
        ],
        "table"
      ),
    }),
  },
  {
    id: "planner",
    badge: "Tableau",
    name: "Sprint Planner",
    description: "Un tableau avec vues Table, Cartes, Calendrier et Gantt pour piloter un sprint.",
    build: () => ({
      kind: "database",
      icon: "📅",
      title: "Plan de sprint",
      favorite: false,
      database: createDatabase(
        [
          createProperty("Tache", "text"),
          createProperty("Statut", "select", ["Backlog", "En cours", "Review", "Done"]),
          createProperty("Date", "date"),
          createProperty("Equipe", "text"),
          createProperty("Bloquant", "checkbox"),
        ],
        [
          { Tache: "Design du dashboard", Statut: "Review", Date: offsetDate(1), Equipe: "Produit", Bloquant: false },
          { Tache: "API metrics", Statut: "En cours", Date: offsetDate(4), Equipe: "Backend", Bloquant: false },
          { Tache: "Tests regression", Statut: "Backlog", Date: offsetDate(6), Equipe: "QA", Bloquant: false },
        ],
        "board"
      ),
    }),
  },
  {
    id: "crm-renovboat",
    badge: "Tableau",
    name: "CRM clients",
    description: "Pipeline commercial avec contact, priorite, montant, responsable et relance.",
    build: () => ({
      kind: "database",
      icon: "\u{1F4B0}",
      title: "CRM clients",
      favorite: false,
      database: createDatabase(
        [
          createProperty("Client", "text"),
          createProperty("Etape", "status", ["Prospect", "Devis", "Negociation", "Gagne", "Perdu"]),
          createProperty("Contact", "email"),
          createProperty("Telephone", "phone"),
          createProperty("Montant", "number"),
          createProperty("Relance", "date"),
          createProperty("Responsable", "person"),
        ],
        [
          { Client: "Renovation coque", Etape: "Devis", Contact: "client@example.com", Telephone: "+33", Montant: "4500", Relance: offsetDate(2) },
          { Client: "Maintenance moteur", Etape: "Prospect", Contact: "port@example.com", Telephone: "+33", Montant: "1200", Relance: offsetDate(5) },
        ],
        "board"
      ),
    }),
  },
  {
    id: "maintenance-bateau",
    badge: "Tableau",
    name: "Maintenance bateau",
    description: "Suivi des interventions, pieces, dates, durees et fichiers joints.",
    build: () => ({
      kind: "database",
      icon: "\u{1F6E0}",
      title: "Maintenance bateau",
      favorite: false,
      database: createDatabase(
        [
          createProperty("Intervention", "text"),
          createProperty("Statut", "status", ["A planifier", "En cours", "Controle", "Termine"]),
          createProperty("Debut", "date"),
          createProperty("Fin", "date"),
          createProperty("Duree", "number"),
          createProperty("Pieces jointes", "files"),
          createProperty("Fait", "checkbox"),
        ],
        [
          { Intervention: "Controle antifouling", Statut: "A planifier", Debut: offsetDate(4), Fin: offsetDate(5), Duree: "2", Fait: false },
          { Intervention: "Revision moteur", Statut: "En cours", Debut: offsetDate(-1), Fin: offsetDate(2), Duree: "4", Fait: false },
        ],
        "gantt"
      ),
    }),
  },
  {
    id: "suivi-projet",
    badge: "Tableau",
    name: "Suivi projet",
    description: "Plan projet complet avec priorites, equipe, dates, cartes et Gantt.",
    build: () => ({
      kind: "database",
      icon: "\u{1F3AF}",
      title: "Suivi projet",
      favorite: false,
      database: createDatabase(
        [
          createProperty("Tache", "text"),
          createProperty("Etat", "status", ["Pas commence", "En cours", "Bloque", "Termine"]),
          createProperty("Priorite", "select", ["Basse", "Moyenne", "Haute"]),
          createProperty("Responsable", "person"),
          createProperty("Debut", "date"),
          createProperty("Fin", "date"),
          createProperty("Notes", "text"),
        ],
        [
          { Tache: "Cadrage", Etat: "Termine", Priorite: "Haute", Debut: offsetDate(-5), Fin: offsetDate(-2), Notes: "Objectifs valides" },
          { Tache: "Production", Etat: "En cours", Priorite: "Haute", Debut: offsetDate(0), Fin: offsetDate(8), Notes: "Suivi quotidien" },
        ],
        "table"
      ),
    }),
  },
];

const elements = {
  body: document.body,
  appShell: document.getElementById("app-shell"),
  authScreen: document.getElementById("auth-screen"),
  authKicker: document.getElementById("auth-kicker"),
  authTitle: document.getElementById("auth-title"),
  authSubtitle: document.getElementById("auth-subtitle"),
  authForm: document.getElementById("auth-form"),
  authNameField: document.getElementById("auth-name-field"),
  authName: document.getElementById("auth-name"),
  authEmail: document.getElementById("auth-email"),
  authPassword: document.getElementById("auth-password"),
  authSubmit: document.getElementById("auth-submit"),
  authMessage: document.getElementById("auth-message"),
  authNote: document.getElementById("auth-note"),
  sidebar: document.getElementById("sidebar"),
  sidebarResizeHandle: document.getElementById("sidebar-resize-handle"),
  openSidebar: document.getElementById("open-sidebar"),
  closeSidebar: document.getElementById("close-sidebar"),
  favoritesList: document.getElementById("favorites-list"),
  recentList: document.getElementById("recent-list"),
  pageTree: document.getElementById("page-tree"),
  trashList: document.getElementById("trash-list"),
  breadcrumbs: document.getElementById("breadcrumbs"),
  pageKindBadge: document.getElementById("page-kind-badge"),
  pageUpdated: document.getElementById("page-updated"),
  livePresenceBar: document.getElementById("live-presence-bar"),
  viewSwitcher: document.getElementById("view-switcher"),
  heroTitle: document.getElementById("hero-title"),
  pageIconDisplay: document.getElementById("page-icon-display"),
  pageTitle: document.getElementById("page-title"),
  pageToolbar: document.getElementById("page-toolbar"),
  pageBody: document.getElementById("page-body"),
  inspector: document.getElementById("inspector"),
  storageChip: document.getElementById("storage-chip"),
  contextMenu: document.getElementById("context-menu"),
  slashMenu: document.getElementById("slash-menu"),
  modal: document.getElementById("modal"),
  modalBackdrop: document.getElementById("modal-backdrop"),
  modalKicker: document.getElementById("modal-kicker"),
  modalTitle: document.getElementById("modal-title"),
  modalBody: document.getElementById("modal-body"),
  closeModal: document.getElementById("close-modal"),
  importInput: document.getElementById("import-input"),
  toastStack: document.getElementById("toast-stack"),
  toggleTheme: document.getElementById("toggle-theme"),
  openSearch: document.getElementById("open-search"),
  searchButton: document.getElementById("search-button"),
  openTemplates: document.getElementById("open-templates"),
  templateButton: document.getElementById("template-button"),
  newPageLauncher: document.getElementById("new-page-launcher"),
  newRootPage: document.getElementById("new-root-page"),
  triggerImport: document.getElementById("trigger-import"),
  triggerExport: document.getElementById("trigger-export"),
  duplicatePage: document.getElementById("duplicate-page"),
  deletePage: document.getElementById("delete-page"),
  cycleIcon: document.getElementById("cycle-icon"),
  toggleFavorite: document.getElementById("toggle-favorite"),
  openHelp: document.getElementById("open-help"),
  brandHome: document.getElementById("brand-home"),
  workspaceKickerLabel: document.getElementById("workspace-kicker-label"),
  workspaceBrandName: document.getElementById("workspace-brand-name"),
  currentUserChip: document.getElementById("current-user-chip"),
  workspaceButton: document.getElementById("workspace-button"),
  shareWorkspaceButton: document.getElementById("share-workspace-button"),
  adminButton: document.getElementById("admin-button"),
  logoutButton: document.getElementById("logout-button"),
};

const ui = {
  currentBlockId: null,
  slashBlockId: null,
  slashAnchorRect: null,
  menuOpen: false,
  modalOpen: false,
  cellDetailPopover: null,
  spreadsheetFormulaEdit: null,
  draggedTreePageId: null,
  activeWordPageIndex: 0,
};

let state = createInitialState();
let saveTimer = null;
let spreadsheetCalculationCache = new Map();
let spreadsheetRangeCache = new Map();
let spreadsheetWorker = null;
let spreadsheetWorkerRequestId = 0;
let spreadsheetWorkerTimer = null;
let spreadsheetWorkerResults = new Map();
let spreadsheetWorkerUnavailable = false;
let preferencesSaveTimer = null;
let bootstrapCacheState = null;
let isSyncingState = false;
let lastServerSaveId = 0;
let appListenersInstalled = false;
let authListenersInstalled = false;
let authState = {
  authenticated: false,
  needsSetup: false,
  user: null,
};
let workspaceDirectory = {
  workspaces: [],
  deletedWorkspaces: [],
  pendingInvitations: [],
  activeWorkspaceSlug: null,
};
let peopleDirectory = {
  users: [],
  loaded: false,
};
let accountNotifications = {
  notifications: [],
  unreadCount: 0,
  loaded: false,
};
let accountNotificationsTimer = null;
let peopleDirectoryPromise = null;
let peopleDirectoryRenderQueued = false;
let realtimeSource = null;
let realtimeHeartbeatTimer = null;
let realtimeReconnectTimer = null;
let realtimePresence = [];
let realtimePresenceKey = "[]";
let lastRealtimeEventId = 0;
let isRealtimeRefreshing = false;
let pendingRealtimeRefresh = false;
let undoStack = [];
let redoStack = [];
let undoCoalesce = {
  key: null,
  timer: null,
};
let isRestoringUndo = false;
let filteredDatabaseViewRefreshTimer = null;

function getClientInstanceId() {
  try {
    const storageKey = "flowceanClientInstance.v1";
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const created = `client-${uid("live")}`.replace(/[^a-zA-Z0-9_-]/g, "");
    sessionStorage.setItem(storageKey, created);
    return created;
  } catch (error) {
    return `client-${uid("live")}`.replace(/[^a-zA-Z0-9_-]/g, "");
  }
}

const CLIENT_INSTANCE_ID = getClientInstanceId();

function selectedWorkspaceStorageKey() {
  return `${WORKSPACE_SELECTION_KEY}.${authState.user?.id || "guest"}`;
}

function stateCacheKey(slug = currentWorkspaceSlug()) {
  return `${STORAGE_KEY_PREFIX}.${authState.user?.id || "guest"}.${slug || DEFAULT_WORKSPACE_SLUG}`;
}

function legacyStateCacheKeys(slug = currentWorkspaceSlug()) {
  if ((slug || DEFAULT_WORKSPACE_SLUG) !== DEFAULT_WORKSPACE_SLUG) {
    return [];
  }

  return LEGACY_STORAGE_KEYS.slice();
}

function readRememberedWorkspaceSlug() {
  return localStorage.getItem(selectedWorkspaceStorageKey());
}

function rememberActiveWorkspaceSlug(slug) {
  workspaceDirectory.activeWorkspaceSlug = slug || null;
  if (slug) {
    localStorage.setItem(selectedWorkspaceStorageKey(), slug);
  } else {
    localStorage.removeItem(selectedWorkspaceStorageKey());
  }
}

function currentWorkspaceRecord() {
  return workspaceDirectory.workspaces.find((workspace) => workspace.slug === workspaceDirectory.activeWorkspaceSlug) || null;
}

function formatWorkspaceRoleLabel(role) {
  if (role === "super") return "Super-utilisateur";
  if (role === "owner") return "Proprietaire";
  if (role === "admin") return "Admin workspace";
  if (role === "viewer") return "Lecture";
  return "Editeur";
}

function currentPresenceEntries() {
  return Array.isArray(realtimePresence) ? realtimePresence : [];
}

function collaboratorsOnPage(pageId, options = {}) {
  const includeSelf = options.includeSelf === true;
  return currentPresenceEntries().filter((entry) => {
    if (!entry || entry.activePageId !== pageId) return false;
    if (includeSelf) return true;
    return !(entry.userId === authState.user?.id && entry.clientId === CLIENT_INSTANCE_ID);
  });
}

function currentPagePresenceTitle() {
  const page = getActivePage();
  return page ? (page.title || "Sans titre") : "Aucune page";
}

function normalizePresenceEntry(entry) {
  return {
    clientId: entry.clientId,
    userId: entry.userId,
    displayName: entry.displayName || entry.email || "Utilisateur",
    email: entry.email || "",
    activePageId: entry.activePageId || null,
    activePageTitle: entry.activePageTitle || null,
    lastSeenAt: entry.lastSeenAt || null,
  };
}

function applyPresenceSnapshot(entries) {
  const nextPresence = Array.isArray(entries) ? entries.map(normalizePresenceEntry) : [];
  const nextKey = JSON.stringify(nextPresence);
  if (nextKey === realtimePresenceKey) return;
  realtimePresence = nextPresence;
  realtimePresenceKey = nextKey;
  renderLivePresence();
  renderSidebar();
}

function renderLivePresence() {
  if (!elements.livePresenceBar) return;

  elements.livePresenceBar.innerHTML = "";
  const entries = currentPresenceEntries();
  const others = entries.filter((entry) => !(entry.userId === authState.user?.id && entry.clientId === CLIENT_INSTANCE_ID));

  if (!authState.authenticated) {
    elements.livePresenceBar.classList.add("hidden");
    return;
  }

  elements.livePresenceBar.classList.remove("hidden");

  if (!entries.length || !others.length) {
    const empty = document.createElement("div");
    empty.className = "presence-empty";
    empty.textContent = "Vous etes seul en direct sur ce workspace.";
    elements.livePresenceBar.appendChild(empty);
    return;
  }

  others.forEach((entry) => {
    const pill = document.createElement("div");
    pill.className = `presence-pill ${entry.activePageId === state.ui.activePageId ? "same-page" : ""}`;
    pill.title = `${entry.displayName} - ${entry.activePageTitle || "Page inconnue"}`;

    const avatar = document.createElement("span");
    avatar.className = "presence-avatar";
    avatar.textContent = (entry.displayName || "?").slice(0, 1).toUpperCase();

    const copy = document.createElement("div");
    copy.className = "presence-copy";

    const name = document.createElement("span");
    name.className = "presence-name";
    name.textContent = entry.displayName;

    const where = document.createElement("span");
    where.className = "presence-where";
    where.textContent = entry.activePageId === state.ui.activePageId
      ? "Sur cette page"
      : (entry.activePageTitle || "Sur une autre page");

    copy.append(name, where);
    pill.append(avatar, copy);
    elements.livePresenceBar.appendChild(pill);
  });
}

function buildPresencePayload(action = "heartbeat") {
  return {
    action,
    workspaceSlug: currentWorkspaceSlug(),
    clientId: CLIENT_INSTANCE_ID,
    activePageId: getActivePage()?.id || null,
    activePageTitle: currentPagePresenceTitle(),
  };
}

function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

function cloneStateForUndo() {
  return JSON.parse(JSON.stringify(state));
}

function resetUndoCoalesce() {
  if (undoCoalesce.timer) {
    clearTimeout(undoCoalesce.timer);
  }
  undoCoalesce = {
    key: null,
    timer: null,
  };
}

function clearUndoHistory() {
  undoStack = [];
  redoStack = [];
  resetUndoCoalesce();
}

function recordUndoSnapshot(label = "Modification", options = {}) {
  if (isRestoringUndo || !state?.pages) return;

  const coalesceKey = options.coalesceKey || null;
  if (coalesceKey && undoCoalesce.key === coalesceKey) {
    if (undoCoalesce.timer) clearTimeout(undoCoalesce.timer);
    undoCoalesce.timer = window.setTimeout(resetUndoCoalesce, options.coalesceMs || UNDO_TEXT_COALESCE_MS);
    return;
  }

  const snapshot = cloneStateForUndo();
  const serialized = JSON.stringify(snapshot);
  if (undoStack[undoStack.length - 1]?.serialized === serialized) return;

  undoStack.push({
    label,
    state: snapshot,
    serialized,
    createdAt: Date.now(),
  });

  if (undoStack.length > UNDO_STACK_LIMIT) {
    undoStack.shift();
  }

  redoStack = [];

  if (coalesceKey) {
    if (undoCoalesce.timer) clearTimeout(undoCoalesce.timer);
    undoCoalesce.key = coalesceKey;
    undoCoalesce.timer = window.setTimeout(resetUndoCoalesce, options.coalesceMs || UNDO_TEXT_COALESCE_MS);
  } else {
    resetUndoCoalesce();
  }
}

function undoLastAction() {
  const entry = undoStack.pop();
  if (!entry) {
    toast("Rien a annuler.");
    return;
  }

  restoreHistoryEntry(entry, "undo");
}

function redoLastAction() {
  const entry = redoStack.pop();
  if (!entry) {
    toast("Rien a retablir.");
    return;
  }

  restoreHistoryEntry(entry, "redo");
}

function restoreHistoryEntry(entry, direction = "undo") {
  isRestoringUndo = true;
  resetUndoCoalesce();

  const currentSnapshot = cloneStateForUndo();
  const currentSerialized = JSON.stringify(currentSnapshot);
  const currentEntry = {
    label: entry.label,
    state: currentSnapshot,
    serialized: currentSerialized,
    createdAt: Date.now(),
  };

  if (direction === "undo") {
    redoStack.push(currentEntry);
    if (redoStack.length > UNDO_STACK_LIMIT) redoStack.shift();
  } else {
    undoStack.push(currentEntry);
    if (undoStack.length > UNDO_STACK_LIMIT) undoStack.shift();
  }

  hideCellDetailPopover(false);
  closeModal();
  hideContextMenu();
  hideSlashMenu();

  const currentMeta = { ...(state.meta || {}) };
  const currentUserPreferences = normalizeUserPreferences(state.userPreferences);
  state = normalizeState(entry.state);
  state.meta = {
    ...(state.meta || {}),
    ...currentMeta,
    workspaceSlug: currentMeta.workspaceSlug || state.meta?.workspaceSlug || currentWorkspaceSlug(),
  };
  state.userPreferences = currentUserPreferences;

  const messagePrefix = direction === "undo" ? "Annule" : "Retabli";
  scheduleSave(`${messagePrefix}: ${entry.label}`);
  render();
  void sendPresenceHeartbeat("heartbeat");
  toast(`${messagePrefix}: ${entry.label}`);
  isRestoringUndo = false;
}

function shouldLetBrowserHandleUndo(target) {
  if (!target) return false;
  if (target.closest?.(".block-editor, .table-cell, .board-card-editor, .cell-detail-popover, #page-title")) return false;
  const tagName = target.tagName ? target.tagName.toLowerCase() : "";
  if (tagName === "textarea") return true;
  if (tagName !== "input") return false;
  const inputType = (target.type || "text").toLowerCase();
  return ["text", "search", "email", "url", "tel", "password", "number", "date"].includes(inputType);
}

function getPropertyDefinition(type) {
  return PROPERTY_DEFINITIONS.find((definition) => definition.type === type) || PROPERTY_DEFINITIONS.find((definition) => definition.type === "text");
}

function propertyTypeLabel(type) {
  return getPropertyDefinition(type)?.label || "Texte";
}

function propertyTypeIcon(type) {
  const icons = {
    ai_summary: "AI",
    ai_translate: "A>",
    text: "Aa",
    number: "#",
    select: "S",
    multi_select: "MS",
    status: "St",
    date: "Cal",
    person: "P",
    files: "File",
    checkbox: "Ok",
    url: "URL",
    phone: "Tel",
    email: "@",
    relation: "Rel",
    rollup: "Sum",
    formula: "Fx",
    button: "Btn",
    identifier: "ID",
    location: "Pin",
  };
  return icons[type] || "Aa";
}

function normalizePropertyType(type) {
  return PROPERTY_TYPE_IDS.includes(type) ? type : "text";
}

function defaultPropertyName(type) {
  return propertyTypeLabel(normalizePropertyType(type));
}

function isOptionPropertyType(type) {
  return OPTION_PROPERTY_TYPES.includes(type);
}

function normalizePropertyOptions(type, options = []) {
  const normalizedType = normalizePropertyType(type);
  const values = Array.isArray(options) ? options.map((value) => String(value).trim()).filter(Boolean) : [];
  if (!CONFIGURABLE_PROPERTY_TYPES.includes(normalizedType)) return [];
  if (values.length) return values;
  return (DEFAULT_PROPERTY_OPTIONS[normalizedType] || []).slice();
}

function parseMultiSelectValue(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getDefaultCellValue(property) {
  if (property.type === "checkbox") return false;
  if (property.type === "multi_select") return [];
  if (property.type === "files") return [];
  return "";
}

function normalizeCellValue(property, value) {
  if (property.type === "checkbox") return Boolean(value);
  if (property.type === "multi_select") return parseMultiSelectValue(value);
  if (property.type === "files") return normalizeAttachments(value);
  return value == null ? "" : String(value);
}

function normalizeAttachments(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : [{ name: String(value), url: String(value) }];
  return items
    .map((item) => {
      if (typeof item === "string") {
        const name = item.trim();
        return name ? { id: uid("file"), name, url: name, size: 0, type: "", uploadedAt: Date.now() } : null;
      }
      const name = String(item.name || item.url || "").trim();
      if (!name) return null;
      return {
        id: item.id || uid("file"),
        name,
        url: item.url || "",
        data: item.data || "",
        type: item.type || "",
        size: Number(item.size || 0),
        uploadedAt: Number(item.uploadedAt || Date.now()),
      };
    })
    .filter(Boolean);
}

function normalizeRowComments(comments = []) {
  return (Array.isArray(comments) ? comments : [])
    .map((comment) => ({
      id: comment.id || uid("comment"),
      authorId: comment.authorId || authState.user?.id || null,
      authorName: comment.authorName || comment.author || "Utilisateur",
      text: String(comment.text || "").trim(),
      createdAt: Number(comment.createdAt || Date.now()),
    }))
    .filter((comment) => comment.text);
}

function normalizePeople(users = []) {
  const seen = new Set();
  return users
    .map((user) => ({
      id: String(user.id || "").trim(),
      email: String(user.email || "").trim(),
      displayName: String(user.displayName || user.display_name || user.email || "").trim(),
      role: String(user.role || user.accountRole || "").trim(),
      isActive: user.isActive !== false,
    }))
    .filter((user) => {
      if (!user.id || seen.has(user.id) || !user.isActive) return false;
      seen.add(user.id);
      return true;
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName, "fr", { sensitivity: "base" }));
}

function currentUserAsPerson() {
  if (!authState.user) return null;
  return {
    id: String(authState.user.id || "").trim(),
    email: String(authState.user.email || "").trim(),
    displayName: String(authState.user.displayName || authState.user.email || "").trim(),
    role: String(authState.user.role || "").trim(),
    isActive: true,
  };
}

function getPeopleOptions() {
  const users = peopleDirectory.users.length
    ? peopleDirectory.users
    : [currentUserAsPerson()].filter(Boolean);
  return normalizePeople(users);
}

function findPersonByValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  return getPeopleOptions().find((user) => (
    user.id === raw ||
    user.email.toLowerCase() === lower ||
    user.displayName.toLowerCase() === lower
  )) || null;
}

function formatPersonValue(value) {
  const person = findPersonByValue(value);
  return person ? person.displayName : String(value || "").trim();
}

async function ensurePeopleDirectoryLoaded() {
  if (!authState.authenticated) return [];
  if (peopleDirectory.loaded) return peopleDirectory.users;
  if (peopleDirectoryPromise) return peopleDirectoryPromise;

  peopleDirectoryPromise = apiRequest(PEOPLE_API_URL, { method: "GET" })
    .then((payload) => {
      peopleDirectory.users = normalizePeople(payload.users || []);
      peopleDirectory.loaded = true;
      return peopleDirectory.users;
    })
    .finally(() => {
      peopleDirectoryPromise = null;
    });

  return peopleDirectoryPromise;
}

async function refreshAccountNotifications() {
  if (!authState.authenticated) {
    accountNotifications = { notifications: [], unreadCount: 0, loaded: false };
    return accountNotifications;
  }

  const payload = await apiRequest(NOTIFICATIONS_API_URL, { method: "GET" });
  accountNotifications = {
    notifications: normalizeNotifications(payload.notifications || []),
    unreadCount: Number(payload.unreadCount || 0),
    loaded: true,
  };
  return accountNotifications;
}

async function markAccountNotificationRead(notification) {
  if (!notification?.serverId) return;
  const payload = await apiRequest(NOTIFICATIONS_API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "mark_read",
      notificationId: notification.serverId,
    }),
  });
  accountNotifications = {
    notifications: normalizeNotifications(payload.notifications || []),
    unreadCount: Number(payload.unreadCount || 0),
    loaded: true,
  };
}

async function markAllAccountNotificationsRead() {
  if (!authState.authenticated) return;
  const payload = await apiRequest(NOTIFICATIONS_API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "mark_all_read" }),
  });
  accountNotifications = {
    notifications: normalizeNotifications(payload.notifications || []),
    unreadCount: Number(payload.unreadCount || 0),
    loaded: true,
  };
}

function startAccountNotificationPolling() {
  if (accountNotificationsTimer || !authState.authenticated) return;
  accountNotificationsTimer = window.setInterval(() => {
    void refreshAccountNotifications()
      .then(() => {
        const page = getActivePage();
        if (page) renderInspector(page);
      })
      .catch((error) => console.error("Failed to refresh account notifications", error));
  }, 30000);
}

function stopAccountNotificationPolling() {
  if (accountNotificationsTimer) {
    window.clearInterval(accountNotificationsTimer);
    accountNotificationsTimer = null;
  }
}

function queuePeopleDirectoryLoad() {
  if (peopleDirectory.loaded || peopleDirectoryPromise || peopleDirectoryRenderQueued) return;
  peopleDirectoryRenderQueued = true;
  void ensurePeopleDirectoryLoaded()
    .then(() => renderMain())
    .catch((error) => {
      console.error("Failed to load people", error);
    })
    .finally(() => {
      peopleDirectoryRenderQueued = false;
    });
}

function getGroupableProperties(databaseOrProperties) {
  const properties = Array.isArray(databaseOrProperties)
    ? databaseOrProperties
    : (databaseOrProperties?.properties || []);
  return properties.filter((property) => isOptionPropertyType(property.type));
}

function createProperty(name, type = "text", options = []) {
  const normalizedType = normalizePropertyType(type);
  return {
    id: uid("prop"),
    name: name || defaultPropertyName(normalizedType),
    type: normalizedType,
    options: normalizePropertyOptions(normalizedType, options),
  };
}

function createRow(properties, values = {}) {
  const cells = {};
  properties.forEach((property) => {
    const value = Object.prototype.hasOwnProperty.call(values, property.name)
      ? values[property.name]
      : getDefaultCellValue(property);
    cells[property.id] = normalizeCellValue(property, value);
  });
  return {
    id: uid("row"),
    cells,
    comments: [],
  };
}

function getPropertiesByType(databaseOrProperties, type) {
  const properties = Array.isArray(databaseOrProperties)
    ? databaseOrProperties
    : (databaseOrProperties?.properties || []);
  return properties.filter((property) => property.type === type);
}

function normalizeDatabaseViewFilters(filters = [], properties = []) {
  const propertyIds = new Set(properties.map((property) => property.id));
  return (Array.isArray(filters) ? filters : [])
    .map((filter) => ({
      id: filter.id || uid("filter"),
      propertyId: String(filter.propertyId || ""),
      operator: normalizeFilterOperator(filter.operator),
      value: filter.value == null ? "" : String(filter.value),
    }))
    .filter((filter) => propertyIds.has(filter.propertyId));
}

function normalizeFilterOperator(operator) {
  const allowed = new Set([
    "contains",
    "not_contains",
    "equals",
    "not_equals",
    "is",
    "is_not",
    "checked",
    "unchecked",
    "before",
    "after",
    "greater_than",
    "less_than",
    "empty",
    "not_empty",
  ]);
  return allowed.has(operator) ? operator : "contains";
}

function filterOperatorOptions(property) {
  if (property.type === "checkbox") {
    return [
      ["checked", "est cochee"],
      ["unchecked", "n'est pas cochee"],
    ];
  }
  if (property.type === "date") {
    return [
      ["is", "est le"],
      ["before", "est avant"],
      ["after", "est apres"],
      ["empty", "est vide"],
      ["not_empty", "n'est pas vide"],
    ];
  }
  if (property.type === "number") {
    return [
      ["equals", "est egal a"],
      ["not_equals", "est different de"],
      ["greater_than", "est superieur a"],
      ["less_than", "est inferieur a"],
      ["empty", "est vide"],
      ["not_empty", "n'est pas vide"],
    ];
  }
  if (["select", "status", "person"].includes(property.type)) {
    return [
      ["is", "est"],
      ["is_not", "n'est pas"],
      ["empty", "est vide"],
      ["not_empty", "n'est pas vide"],
    ];
  }
  if (property.type === "multi_select") {
    return [
      ["contains", "contient"],
      ["not_contains", "ne contient pas"],
      ["empty", "est vide"],
      ["not_empty", "n'est pas vide"],
    ];
  }
  return [
    ["contains", "contient"],
    ["not_contains", "ne contient pas"],
    ["equals", "est egal a"],
    ["not_equals", "est different de"],
    ["empty", "est vide"],
    ["not_empty", "n'est pas vide"],
  ];
}

function filterNeedsValue(operator) {
  return !["empty", "not_empty", "checked", "unchecked"].includes(operator);
}

function defaultDatabaseViewName(type = "table") {
  return VIEW_LABELS[type] || VIEW_LABELS.table;
}

function sanitizeDatabaseViewSettings(type, settings = {}, properties = []) {
  const next = { ...settings };
  const groupProperties = getGroupableProperties(properties);
  const dateProperties = getPropertiesByType(properties, "date");
  const durationProperties = getPropertiesByType(properties, "number");
  next.filters = normalizeDatabaseViewFilters(next.filters, properties);
  next.searchQuery = String(next.searchQuery || "");
  next.sorts = normalizeDatabaseViewSorts(next.sorts, properties);
  next.hiddenPropertyIds = normalizePropertyIdList(next.hiddenPropertyIds, properties);
  next.frozenPropertyIds = normalizePropertyIdList(next.frozenPropertyIds, properties);

  if (type === "board") {
    next.groupByPropertyId = groupProperties.some((property) => property.id === next.groupByPropertyId)
      ? next.groupByPropertyId
      : (groupProperties[0]?.id || null);
  }

  if (type === "calendar") {
    next.datePropertyId = dateProperties.some((property) => property.id === next.datePropertyId)
      ? next.datePropertyId
      : (dateProperties[0]?.id || null);
    next.month = next.month || startOfMonthISO(new Date());
  }

  if (type === "gantt") {
    const fallbackStart = dateProperties[0]?.id || null;
    const fallbackEnd = dateProperties[1]?.id || null;
    const hasEndDateSetting = Object.prototype.hasOwnProperty.call(next, "endDatePropertyId");
    next.startDatePropertyId = dateProperties.some((property) => property.id === next.startDatePropertyId)
      ? next.startDatePropertyId
      : fallbackStart;
    next.endDatePropertyId = dateProperties.some((property) => property.id === next.endDatePropertyId && property.id !== next.startDatePropertyId)
      ? next.endDatePropertyId
      : (hasEndDateSetting ? null : fallbackEnd);
    next.durationPropertyId = durationProperties.some((property) => property.id === next.durationPropertyId)
      ? next.durationPropertyId
      : null;
    const visibleStart = parseISODate(next.visibleStartDate);
    const visibleEnd = parseISODate(next.visibleEndDate);
    next.visibleStartDate = visibleStart ? toISODate(visibleStart) : "";
    next.visibleEndDate = visibleEnd ? toISODate(visibleEnd) : "";
    if (visibleStart && visibleEnd && visibleEnd < visibleStart) {
      next.visibleEndDate = next.visibleStartDate;
    }
  }

  return next;
}

function normalizePropertyIdList(ids = [], properties = []) {
  const propertyIds = new Set(properties.map((property) => property.id));
  return (Array.isArray(ids) ? ids : [])
    .map((id) => String(id || ""))
    .filter((id, index, list) => propertyIds.has(id) && list.indexOf(id) === index);
}

function normalizeDatabaseViewSorts(sorts = [], properties = []) {
  const propertyIds = new Set(properties.map((property) => property.id));
  return (Array.isArray(sorts) ? sorts : [])
    .map((sort) => ({
      id: sort.id || uid("sort"),
      propertyId: String(sort.propertyId || ""),
      direction: sort.direction === "desc" ? "desc" : "asc",
    }))
    .filter((sort, index, list) => propertyIds.has(sort.propertyId) && list.findIndex((item) => item.propertyId === sort.propertyId) === index);
}

function createDatabaseView(type = "table", properties = [], overrides = {}) {
  const viewType = Object.keys(VIEW_LABELS).includes(type) ? type : "table";
  const baseSettings = viewType === "calendar" ? { month: startOfMonthISO(new Date()) } : {};
  return {
    id: overrides.id || uid("view"),
    type: viewType,
    name: (overrides.name || defaultDatabaseViewName(viewType)).trim(),
    settings: sanitizeDatabaseViewSettings(
      viewType,
      {
        ...baseSettings,
        ...(overrides.settings || {}),
      },
      properties
    ),
  };
}

function createDefaultDatabaseViews(properties, activeViewType = "table", legacyViewMonth = null) {
  const views = DEFAULT_DATABASE_VIEW_TYPES.map((type) => createDatabaseView(type, properties));
  const calendarView = views.find((view) => view.type === "calendar");
  if (calendarView && legacyViewMonth) {
    calendarView.settings.month = legacyViewMonth;
  }
  const activeView = views.find((view) => view.type === activeViewType) || views[0];
  return {
    views,
    activeViewId: activeView?.id || null,
  };
}

function reconcileDatabaseViews(database) {
  if (!database) return;
  database.views = Array.isArray(database.views) && database.views.length
    ? database.views.map((view) => createDatabaseView(view.type, database.properties, view))
    : createDefaultDatabaseViews(database.properties).views;
  if (!database.views.some((view) => view.id === database.activeViewId)) {
    database.activeViewId = database.views[0]?.id || null;
  }
}

function createDatabase(properties, rows = [], activeView = "table") {
  const normalizedProperties = properties && properties.length
    ? properties
    : [
        createProperty("Nom", "text"),
        createProperty("Statut", "select", ["A faire", "En cours", "Termine"]),
        createProperty("Date", "date"),
        createProperty("Fait", "checkbox"),
      ];

  const { views, activeViewId } = createDefaultDatabaseViews(normalizedProperties, activeView);

  return {
    activeViewId,
    views,
    properties: normalizedProperties,
    rows: rows.map((row) => createRow(normalizedProperties, row)),
  };
}

function createSpreadsheetDatabase() {
  const properties = ["A", "B", "C", "D", "E", "F", "G", "H"].map((name) => createProperty(name, "text"));
  const rows = Array.from({ length: 12 }, () => ({}));
  return createDatabase(properties, rows, "table");
}

function createSpreadsheetSheet(name = "Feuille 1", database = null) {
  return {
    id: uid("sheet"),
    name,
    database: normalizeDatabase(database || createSpreadsheetDatabase()),
  };
}

function normalizeSpreadsheetSheets(input = [], fallbackDatabase = null) {
  const sheets = Array.isArray(input)
    ? input
        .map((sheet, index) => createSpreadsheetSheet(String(sheet.name || `Feuille ${index + 1}`), sheet.database))
        .map((sheet, index) => ({ ...sheet, id: input[index]?.id || sheet.id }))
    : [];
  if (sheets.length) return sheets;
  return [createSpreadsheetSheet("Feuille 1", fallbackDatabase || createSpreadsheetDatabase())];
}

function isWordPage(page) {
  return page?.kind === "document" && page.subtype === "word";
}

function isSpreadsheetPage(page) {
  return page?.kind === "database" && page.subtype === "excel";
}

function ensureSpreadsheetWorkbook(page) {
  if (!isSpreadsheetPage(page)) return null;
  page.excelSheets = normalizeSpreadsheetSheets(page.excelSheets, page.database);
  if (!page.excelSheets.some((sheet) => sheet.id === page.activeExcelSheetId)) {
    page.activeExcelSheetId = page.excelSheets[0]?.id || null;
  }
  const activeSheet = page.excelSheets.find((sheet) => sheet.id === page.activeExcelSheetId) || page.excelSheets[0];
  page.activeExcelSheetId = activeSheet.id;
  page.database = activeSheet.database;
  return activeSheet;
}

function getActiveSpreadsheetSheet(page) {
  return ensureSpreadsheetWorkbook(page);
}

function findSpreadsheetSheetByName(page, name) {
  if (!isSpreadsheetPage(page)) return null;
  ensureSpreadsheetWorkbook(page);
  const normalized = String(name || "").trim().toLowerCase();
  return page.excelSheets.find((sheet) => String(sheet.name || "").trim().toLowerCase() === normalized) || null;
}

function withSpreadsheetSheet(page, sheet = null) {
  return sheet ? { ...page, database: sheet.database } : page;
}

function spreadsheetColumnName(index) {
  let name = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function spreadsheetCellReference(rowIndex, columnIndex, sheetName = "") {
  const base = `${spreadsheetColumnName(columnIndex)}${rowIndex + 1}`;
  if (!sheetName) return base;
  const escaped = String(sheetName).replace(/'/g, "''");
  return `'${escaped}'!${base}`;
}

function isActiveSpreadsheetFormula(pageId = null) {
  const active = ui.spreadsheetFormulaEdit;
  if (!active?.input || !document.contains(active.input)) return false;
  if (pageId && active.pageId !== pageId) return false;
  return String(active.input.dataset.rawValue || active.input.value || "").trim().startsWith("=");
}

function setActiveSpreadsheetFormula(pageId, rowId, propertyId, input) {
  ui.spreadsheetFormulaEdit = {
    pageId,
    rowId,
    propertyId,
    sheetId: getActivePage()?.activeExcelSheetId || null,
    input,
  };
}

function clearActiveSpreadsheetFormula(input = null) {
  if (!input || ui.spreadsheetFormulaEdit?.input === input) {
    ui.spreadsheetFormulaEdit = null;
  }
}

function insertSpreadsheetReferenceIntoFormula(reference) {
  const active = ui.spreadsheetFormulaEdit;
  if (!isActiveSpreadsheetFormula(active?.pageId)) return false;
  const input = active.input;
  const current = String(input.dataset.rawValue || input.value || "");
  const start = Number.isInteger(input.selectionStart) ? input.selectionStart : current.length;
  const end = Number.isInteger(input.selectionEnd) ? input.selectionEnd : start;
  const nextValue = `${current.slice(0, start)}${reference}${current.slice(end)}`;
  input.value = nextValue;
  input.dataset.rawValue = nextValue;
  const cursor = start + reference.length;
  updateCellValue(active.pageId, active.rowId, active.propertyId, nextValue, false);
  window.setTimeout(() => {
    input.focus();
    input.setSelectionRange(cursor, cursor);
  }, 0);
  return true;
}

function focusSpreadsheetCell(pageId, rowIndex, columnIndex) {
  window.setTimeout(() => {
    const selector = `.spreadsheet-data-cell[data-page-id="${CSS.escape(pageId)}"][data-row-index="${rowIndex}"][data-column-index="${columnIndex}"] input`;
    const input = document.querySelector(selector);
    if (input) {
      input.focus();
      input.select();
    }
  }, 0);
}

function nextSpreadsheetCellPosition(page, rowIndex, columnIndex, direction = "right") {
  const rowCount = page.database?.rows.length || 0;
  const columnCount = page.database?.properties.length || 0;
  if (!rowCount || !columnCount) return { rowIndex, columnIndex };

  if (direction === "left") {
    if (columnIndex > 0) return { rowIndex, columnIndex: columnIndex - 1 };
    if (rowIndex > 0) return { rowIndex: rowIndex - 1, columnIndex: columnCount - 1 };
    return { rowIndex: 0, columnIndex: 0 };
  }

  if (columnIndex < columnCount - 1) return { rowIndex, columnIndex: columnIndex + 1 };
  if (rowIndex < rowCount - 1) return { rowIndex: rowIndex + 1, columnIndex: 0 };
  return { rowIndex, columnIndex };
}

function createBlock(type = "paragraph", text = "", extra = {}) {
  return {
    id: uid("block"),
    type,
    text,
    html: "",
    checked: false,
    imageData: "",
    imageName: "",
    imageType: "",
    imageSize: 0,
    imageWidth: 100,
    table: type === "table" ? createInlineTable() : null,
    ...extra,
  };
}

function createInlineTable() {
  const columns = [
    { id: uid("col"), name: "Colonne 1" },
    { id: uid("col"), name: "Colonne 2" },
    { id: uid("col"), name: "Colonne 3" },
  ];
  return {
    columns,
    rows: [
      {
        id: uid("line"),
        cells: Object.fromEntries(columns.map((column) => [column.id, ""])),
      },
      {
        id: uid("line"),
        cells: Object.fromEntries(columns.map((column) => [column.id, ""])),
      },
    ],
  };
}

function createPage(kind = "document", parentId = null, seed = {}) {
  const subtype = seed.subtype && PAGE_SUBTYPE_LABELS[seed.subtype] ? seed.subtype : null;
  const excelSheets = subtype === "excel"
    ? normalizeSpreadsheetSheets(seed.excelSheets, seed.database)
    : [];
  const page = {
    id: uid("page"),
    parentId,
    title: seed.title || "",
    icon: seed.icon || "🌿",
    favorite: Boolean(seed.favorite),
    expanded: seed.expanded !== false,
    sortOrder: Number.isFinite(seed.sortOrder) ? seed.sortOrder : Date.now(),
    kind,
    subtype,
    updatedAt: Date.now(),
    deletedAt: null,
    blocks: kind === "document" ? normalizeBlocks(seed.blocks) : [],
    wordHtml: kind === "document" && subtype === "word" ? normalizeWordHtml(seed.wordHtml, seed.blocks) : "",
    wordPages: kind === "document" && subtype === "word" ? normalizeWordPages(seed.wordPages, seed.wordHtml, seed.blocks) : [],
    wordZoom: normalizeWordZoom(seed.wordZoom),
    database: kind === "database" ? normalizeDatabase(seed.database) : null,
    excelSheets,
    activeExcelSheetId: seed.activeExcelSheetId || excelSheets[0]?.id || null,
  };
  if (subtype === "excel") {
    const activeSheet = page.excelSheets.find((sheet) => sheet.id === page.activeExcelSheetId) || page.excelSheets[0];
    page.activeExcelSheetId = activeSheet?.id || null;
    page.database = activeSheet?.database || page.database;
  }
  return page;
}

function createDefaultUserPreferences() {
  return {
    favoritePageIds: [],
    initialized: false,
  };
}

function parseNotificationCreatedAt(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
    const time = new Date(normalized).getTime();
    if (Number.isFinite(time)) return time;
  }
  return Date.now();
}

function normalizeNotifications(input = []) {
  return (Array.isArray(input) ? input : [])
    .map((notification) => ({
      id: notification.id || uid("notification"),
      serverId: notification.serverId || null,
      source: notification.source || "workspace",
      type: notification.type || "info",
      title: String(notification.title || "Notification"),
      body: String(notification.body || ""),
      pageId: notification.pageId || null,
      rowId: notification.rowId || null,
      payload: notification.payload && typeof notification.payload === "object" ? notification.payload : {},
      read: Boolean(notification.read),
      createdAt: parseNotificationCreatedAt(notification.createdAt),
    }))
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 80);
}

function normalizeUserPreferences(input = {}) {
  const favoritePageIds = Array.isArray(input.favoritePageIds)
    ? input.favoritePageIds
    : Array.isArray(input.favorites)
      ? input.favorites
      : [];

  return {
    favoritePageIds: Array.from(
      new Set(
        favoritePageIds
          .map((id) => String(id || "").trim())
          .filter(Boolean)
      )
    ),
    initialized: Boolean(input.initialized),
  };
}

function createInitialState() {
  const workspace = {
    name: "Flowcean",
    theme: "light",
  };

  const welcomePage = createPage("document", null, {
    title: "Bienvenue dans Flowcean",
    icon: "🌿",
    favorite: true,
    blocks: [
      createBlock("h1", "Votre espace Flowcean local est pret"),
      createBlock("paragraph", "Cette version tourne gratuitement sous WAMP, avec stockage durable sur le serveur MySQL et un cache local de secours."),
      createBlock("callout", "Utilisez la barre laterale pour creer des pages, des tableaux multi-vues et des sous-pages."),
      createBlock("h2", "Ce qui est deja disponible"),
      createBlock("todo", "Pages imbriquees et favoris"),
      createBlock("todo", "Editeur par blocs avec commandes slash"),
      createBlock("todo", "Tableaux avec vues Table, Cartes, Calendrier et Gantt"),
      createBlock("todo", "Recherche globale, templates, import/export JSON"),
      createBlock("quote", "Raccourci utile: Ctrl/Cmd + K pour ouvrir la recherche."),
    ],
  });

  const roadmapPage = createPage("database", null, {
    title: "Roadmap produit",
    icon: "🚀",
    favorite: true,
    database: createDatabase(
      [
        createProperty("Nom", "text"),
        createProperty("Statut", "select", ["A faire", "En cours", "Bloque", "Lance"]),
        createProperty("Date", "date"),
        createProperty("Responsable", "text"),
        createProperty("Fait", "checkbox"),
      ],
      [
        { Nom: "Dashboard analytique", Statut: "En cours", Date: offsetDate(3), Responsable: "Lina", Fait: false },
        { Nom: "Templates partageables", Statut: "A faire", Date: offsetDate(8), Responsable: "Nils", Fait: false },
        { Nom: "Refonte mobile", Statut: "Bloque", Date: offsetDate(12), Responsable: "Aya", Fait: false },
        { Nom: "Release 1.0", Statut: "Lance", Date: offsetDate(-4), Responsable: "Theo", Fait: true },
      ],
      "board"
    ),
  });

  const sprintNotes = createPage("document", roadmapPage.id, {
    title: "Notes de sprint",
    icon: "🧩",
    blocks: [
      createBlock("h1", "Sprint planning"),
      createBlock("paragraph", "Capturez ici les decisions et les axes de focus du sprint."),
      createBlock("h2", "Points forts"),
      createBlock("bullet", "Clarifier les priorites"),
      createBlock("bullet", "Suivre les blocages dans la vue Cartes"),
    ],
  });

  const wikiPage = createPage("document", null, {
    title: "Wiki equipe",
    icon: "📚",
    blocks: [
      createBlock("h1", "Base de connaissances"),
      createBlock("paragraph", "Un espace simple pour centraliser les reperes de l'equipe."),
      createBlock("h2", "Sections recommandees"),
      createBlock("bullet", "Processus"),
      createBlock("bullet", "Onboarding"),
      createBlock("bullet", "Contacts"),
    ],
  });

  return {
    workspace,
    pages: [welcomePage, roadmapPage, sprintNotes, wikiPage],
    ui: {
      activePageId: welcomePage.id,
      activeDatabaseViewIds: {},
    },
    meta: {
      workspaceSlug: DEFAULT_WORKSPACE_SLUG,
      serverVersion: 0,
      lastSyncedAt: null,
      source: "local",
    },
    notifications: [],
    userPreferences: createDefaultUserPreferences(),
  };
}

function loadCachedState(slug = currentWorkspaceSlug()) {
  try {
    const keys = [stateCacheKey(slug), ...legacyStateCacheKeys(slug)];
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      return normalizeState(parsed);
    }
    return null;
  } catch (error) {
    console.error("Failed to load cached state", error);
    return null;
  }
}

function normalizeState(input) {
  const fallback = createInitialState();
  const workspace = {
    ...fallback.workspace,
    ...(input && input.workspace ? input.workspace : {}),
  };

  const pages = Array.isArray(input && input.pages) ? input.pages.map(normalizePage) : fallback.pages;
  const activePageId = input && input.ui && input.ui.activePageId ? input.ui.activePageId : pages[0]?.id;
  const activeDatabaseViewIds = pages.reduce((accumulator, page) => {
    if (page.kind !== "database") return accumulator;
    const candidate = input?.ui?.activeDatabaseViewIds?.[page.id] || page.database.activeViewId;
    if (candidate && page.database.views.some((view) => view.id === candidate)) {
      accumulator[page.id] = candidate;
    }
    return accumulator;
  }, {});
  const meta = {
    ...fallback.meta,
    ...(input && input.meta ? input.meta : {}),
  };
  const userPreferences = normalizeUserPreferences(input?.userPreferences || fallback.userPreferences);
  const notifications = normalizeNotifications(input?.notifications || fallback.notifications);

  return {
    workspace,
    pages,
    ui: {
      activePageId: pages.some((page) => page.id === activePageId) ? activePageId : pages[0]?.id || null,
      activeDatabaseViewIds,
    },
    meta,
    notifications,
    userPreferences,
  };
}

function normalizePage(input) {
  const page = {
    id: input.id || uid("page"),
    parentId: input.parentId || null,
    title: typeof input.title === "string" ? input.title : "",
    icon: input.icon || "🌿",
    favorite: Boolean(input.favorite),
    expanded: input.expanded !== false,
    sortOrder: Number.isFinite(input.sortOrder) ? input.sortOrder : null,
    kind: input.kind === "database" ? "database" : "document",
    subtype: input.subtype && PAGE_SUBTYPE_LABELS[input.subtype] ? input.subtype : null,
    updatedAt: typeof input.updatedAt === "number" ? input.updatedAt : Date.now(),
    deletedAt: input.deletedAt || null,
    blocks: [],
    wordHtml: "",
    wordPages: [],
    wordZoom: normalizeWordZoom(input.wordZoom),
    database: null,
    excelSheets: [],
    activeExcelSheetId: input.activeExcelSheetId || null,
  };

  if (page.kind === "database") {
    page.database = normalizeDatabase(input.database);
    if (page.subtype === "excel") {
      page.excelSheets = normalizeSpreadsheetSheets(input.excelSheets, page.database);
      if (!page.excelSheets.some((sheet) => sheet.id === page.activeExcelSheetId)) {
        page.activeExcelSheetId = page.excelSheets[0]?.id || null;
      }
      const activeSheet = page.excelSheets.find((sheet) => sheet.id === page.activeExcelSheetId) || page.excelSheets[0];
      page.database = activeSheet?.database || page.database;
    }
  } else {
    page.blocks = normalizeBlocks(input.blocks);
    if (page.subtype === "word") {
      page.wordPages = normalizeWordPages(input.wordPages, input.wordHtml, page.blocks);
      page.wordHtml = page.wordPages.map((wordPage) => wordPage.html).join('<div class="word-page-break"></div>');
    }
  }

  return page;
}

function normalizeBlocks(blocks) {
  if (!Array.isArray(blocks) || !blocks.length) return [createBlock("paragraph", "")];
  return blocks.map((block) => ({
    id: block.id || uid("block"),
    type: BLOCK_DEFINITIONS.some((definition) => definition.type === block.type) ? block.type : "paragraph",
    text: typeof block.text === "string" ? block.text : "",
    html: typeof block.html === "string" ? block.html : "",
    checked: Boolean(block.checked),
    imageData: typeof block.imageData === "string" ? block.imageData : "",
    imageName: typeof block.imageName === "string" ? block.imageName : "",
    imageType: typeof block.imageType === "string" ? block.imageType : "",
    imageSize: Number.isFinite(Number(block.imageSize)) ? Number(block.imageSize) : 0,
    imageWidth: Math.max(20, Math.min(100, Number(block.imageWidth || 100))),
    table: block.type === "table" ? normalizeInlineTable(block.table) : null,
  }));
}

function normalizeWordHtml(wordHtml, fallbackBlocks = []) {
  const html = typeof wordHtml === "string" ? wordHtml.trim() : "";
  if (html) return html;
  return blocksToWordHtml(normalizeBlocks(fallbackBlocks));
}

function normalizeWordPages(wordPages, wordHtml = "", fallbackBlocks = []) {
  if (Array.isArray(wordPages) && wordPages.length) {
    return wordPages.map((wordPage, index) => ({
      id: wordPage?.id || uid("wordpage"),
      html: normalizeWordHtml(wordPage?.html, index === 0 ? fallbackBlocks : []),
    }));
  }
  return [{
    id: uid("wordpage"),
    html: normalizeWordHtml(wordHtml, fallbackBlocks) || "<p><br></p>",
  }];
}

function stripHtml(html) {
  const element = document.createElement("div");
  element.innerHTML = String(html || "");
  return element.textContent || "";
}

function normalizeWordZoom(value) {
  const zoom = Number(value);
  if (!Number.isFinite(zoom)) return 1;
  return Math.max(WORD_ZOOM_MIN, Math.min(WORD_ZOOM_MAX, zoom));
}

function blocksToWordHtml(blocks = []) {
  return normalizeBlocks(blocks)
    .map((block) => {
      const richText = block.html || textToPdfHtml(block.text || "");
      const empty = "<br>";
      switch (block.type) {
        case "h1":
          return `<h1>${richText || empty}</h1>`;
        case "h2":
          return `<h2>${richText || empty}</h2>`;
        case "h3":
          return `<h3>${richText || empty}</h3>`;
        case "bullet":
          return `<ul><li>${richText || empty}</li></ul>`;
        case "numbered":
          return `<ol><li>${richText || empty}</li></ol>`;
        case "quote":
          return `<blockquote>${richText || empty}</blockquote>`;
        case "callout":
          return `<p><mark>${richText || empty}</mark></p>`;
        case "code":
          return `<pre>${escapeHtml(block.text || "")}</pre>`;
        case "divider":
          return "<hr>";
        case "image":
          return block.imageData
            ? `<p><img src="${escapeHtml(block.imageData)}" alt="${escapeHtml(block.imageName || "Image")}" style="max-width:${Math.max(20, Math.min(100, Number(block.imageWidth || 100)))}%;"></p>`
            : "";
        case "table":
          return inlineTableToPdfHtml(block.table);
        default:
          return `<p>${richText || empty}</p>`;
      }
    })
    .filter(Boolean)
    .join("");
}

function normalizeInlineTable(table) {
  const fallback = createInlineTable();
  if (!table || !Array.isArray(table.columns) || !table.columns.length) return fallback;
  const columns = table.columns
    .map((column, index) => ({
      id: column.id || uid("col"),
      name: String(column.name || `Colonne ${index + 1}`),
    }))
    .slice(0, 40);
  const rows = Array.isArray(table.rows) && table.rows.length
    ? table.rows.map((row) => ({
        id: row.id || uid("line"),
        cells: columns.reduce((cells, column) => {
          cells[column.id] = String(row.cells?.[column.id] ?? "");
          return cells;
        }, {}),
      }))
    : [{ id: uid("line"), cells: Object.fromEntries(columns.map((column) => [column.id, ""])) }];
  return { columns, rows };
}

function normalizeDatabase(database) {
  const fallback = createDatabase();
  if (!database) return fallback;

  const properties = Array.isArray(database.properties) && database.properties.length
    ? database.properties.map((property) => {
        const type = normalizePropertyType(property.type);
        return {
          id: property.id || uid("prop"),
          name: property.name || defaultPropertyName(type),
          type,
          options: normalizePropertyOptions(type, property.options),
        };
      })
    : fallback.properties;

  const rows = Array.isArray(database.rows)
    ? database.rows.map((row) => ({
        id: row.id || uid("row"),
        cells: normalizeRowCells(properties, row.cells || {}),
        comments: normalizeRowComments(row.comments),
      }))
    : fallback.rows;

  const views = Array.isArray(database.views) && database.views.length
    ? database.views.map((view) => createDatabaseView(view.type, properties, view))
    : createDefaultDatabaseViews(
        properties,
        Object.keys(VIEW_LABELS).includes(database.activeView) ? database.activeView : "table",
        database.viewMonth || null
      ).views;
  const activeViewId = views.some((view) => view.id === database.activeViewId)
    ? database.activeViewId
    : (views.find((view) => view.type === database.activeView) || views[0])?.id || null;

  return {
    activeViewId,
    views,
    properties,
    rows,
    spreadsheetLayout: normalizeSpreadsheetLayout(database.spreadsheetLayout, properties, rows),
  };
}

function normalizeSpreadsheetLayout(layout, properties = [], rows = []) {
  const source = layout && typeof layout === "object" ? layout : {};
  const propertyIds = new Set(properties.map((property) => property.id));
  const rowIds = new Set(rows.map((row) => row.id));
  const normalized = {
    columnWidths: {},
    rowHeights: {},
    imageScales: {},
  };

  Object.entries(source.columnWidths || {}).forEach(([propertyId, width]) => {
    if (!propertyIds.has(propertyId)) return;
    normalized.columnWidths[propertyId] = clampNumber(
      width,
      SPREADSHEET_MIN_COLUMN_WIDTH,
      SPREADSHEET_MAX_COLUMN_WIDTH,
      SPREADSHEET_DEFAULT_COLUMN_WIDTH
    );
  });

  Object.entries(source.rowHeights || {}).forEach(([rowId, height]) => {
    if (!rowIds.has(rowId)) return;
    normalized.rowHeights[rowId] = clampNumber(
      height,
      SPREADSHEET_MIN_ROW_HEIGHT,
      SPREADSHEET_MAX_ROW_HEIGHT,
      SPREADSHEET_DEFAULT_ROW_HEIGHT
    );
  });

  Object.entries(source.imageScales || {}).forEach(([key, scale]) => {
    const [rowId, propertyId] = String(key).split(":");
    if (!rowIds.has(rowId) || !propertyIds.has(propertyId)) return;
    normalized.imageScales[key] = clampNumber(
      scale,
      SPREADSHEET_MIN_IMAGE_SCALE,
      SPREADSHEET_MAX_IMAGE_SCALE,
      SPREADSHEET_MAX_IMAGE_SCALE
    );
  });

  return normalized;
}

function normalizeRowCells(properties, cells) {
  const normalized = {};
  properties.forEach((property) => {
    const rawValue = cells[property.id];
    normalized[property.id] = normalizeCellValue(property, rawValue);
  });
  return normalized;
}

function getActiveDatabaseViewId(page) {
  if (!page?.database) return null;
  const candidate = state.ui.activeDatabaseViewIds?.[page.id] || page.database.activeViewId;
  return page.database.views.some((view) => view.id === candidate) ? candidate : (page.database.views[0]?.id || null);
}

function getActiveDatabaseView(page) {
  if (!page?.database) return null;
  const activeViewId = getActiveDatabaseViewId(page);
  return page.database.views.find((view) => view.id === activeViewId) || page.database.views[0] || null;
}

function getVisibleTableProperties(page) {
  const view = getActiveDatabaseView(page);
  const hiddenIds = new Set(view?.settings?.hiddenPropertyIds || []);
  return page.database.properties.filter((property) => !hiddenIds.has(property.id));
}

function isPropertyFrozen(page, propertyId) {
  const view = getActiveDatabaseView(page);
  return Boolean(view?.settings?.frozenPropertyIds?.includes(propertyId));
}

function getBaseDatabaseViewIds(database) {
  const baseIds = new Set();
  DEFAULT_DATABASE_VIEW_TYPES.forEach((type) => {
    const view = database?.views?.find((candidate) => candidate.type === type);
    if (view) baseIds.add(view.id);
  });
  return baseIds;
}

function isBaseDatabaseView(database, view) {
  if (!database || !view) return false;
  return getBaseDatabaseViewIds(database).has(view.id);
}

function setLocalActiveDatabaseView(pageId, viewId) {
  state.ui.activeDatabaseViewIds = {
    ...(state.ui.activeDatabaseViewIds || {}),
    [pageId]: viewId,
  };
  localStorage.setItem(stateCacheKey(), JSON.stringify(state));
}

function preserveLocalDatabaseViews(nextPages) {
  return nextPages.reduce((accumulator, page) => {
    if (page.kind !== "database") return accumulator;
    const candidate = state?.ui?.activeDatabaseViewIds?.[page.id] || page.database.activeViewId;
    if (candidate && page.database.views.some((view) => view.id === candidate)) {
      accumulator[page.id] = candidate;
    }
    return accumulator;
  }, {});
}

function scheduleSave(message = "Données enregistrées localement", delay = 140) {
  clearTimeout(saveTimer);
  elements.storageChip.textContent = "Enregistrement local...";
  saveTimer = window.setTimeout(() => {
    persistNow(message);
  }, delay);
}

function persistNow(message = "Données enregistrées localement") {
  state.ui.activePageId = getActivePage()?.id || state.ui.activePageId;
  localStorage.setItem(stateCacheKey(), JSON.stringify(state));
  elements.storageChip.textContent = message;
}

function getPage(pageId) {
  return state.pages.find((page) => page.id === pageId) || null;
}

function getActivePage() {
  const page = getPage(state.ui.activePageId);
  if (page) return page;
  const fallback = getVisiblePages()[0] || state.pages[0] || null;
  if (fallback) state.ui.activePageId = fallback.id;
  return fallback;
}

function getVisiblePages() {
  return state.pages.filter((page) => !page.deletedAt);
}

function getTrashPages() {
  return state.pages.filter((page) => page.deletedAt);
}

function getUserFavoriteIds() {
  state.userPreferences = normalizeUserPreferences(state.userPreferences);
  const validPageIds = new Set(state.pages.map((page) => page.id));
  state.userPreferences.favoritePageIds = state.userPreferences.favoritePageIds.filter((id) => validPageIds.has(id));
  return state.userPreferences.favoritePageIds;
}

function isPageFavorite(pageOrId) {
  const pageId = typeof pageOrId === "string" ? pageOrId : pageOrId?.id;
  if (!pageId) return false;
  return getUserFavoriteIds().includes(pageId);
}

function setPageFavorite(pageId, favorite) {
  const page = getPage(pageId);
  if (!page || page.deletedAt) return;
  const favorites = new Set(getUserFavoriteIds());
  if (favorite) {
    favorites.add(pageId);
  } else {
    favorites.delete(pageId);
  }
  state.userPreferences.favoritePageIds = Array.from(favorites);
  state.userPreferences.initialized = true;
  scheduleUserPreferencesSave("Favori personnel mis a jour");
}

function migrateLegacyFavoritesToUserPreferences() {
  if (state.userPreferences?.initialized) return false;
  if (getUserFavoriteIds().length) return false;
  const legacyFavoriteIds = state.pages
    .filter((page) => page.favorite && !page.deletedAt)
    .map((page) => page.id);
  if (!legacyFavoriteIds.length) return false;
  state.userPreferences.favoritePageIds = legacyFavoriteIds;
  state.userPreferences.initialized = true;
  return true;
}

function getChildren(parentId, includeDeleted = false) {
  return state.pages.filter((page) => page.parentId === parentId && (includeDeleted || !page.deletedAt));
}

function getPagePath(pageId) {
  const segments = [];
  let current = getPage(pageId);
  while (current) {
    segments.unshift(current.title || "Sans titre");
    current = current.parentId ? getPage(current.parentId) : null;
  }
  return segments;
}

function updatePage(pageId, updater, saveMessage) {
  const page = getPage(pageId);
  if (!page) return;
  recordUndoSnapshot(saveMessage || "Modification");
  updater(page);
  page.updatedAt = Date.now();
  scheduleSave(saveMessage);
}

function render() {
  applyTheme();
  renderWorkspaceChrome();
  renderSidebar();
  renderMain();
}

function applyTheme() {
  elements.body.classList.toggle("dark-theme", state.workspace.theme === "dark");
}

function renderWorkspaceChrome() {
  const workspace = currentWorkspaceRecord();
  const workspaceName = workspace?.name || state.workspace?.name || "Flowcean";
  const workspaceRole = workspace ? formatWorkspaceRoleLabel(workspace.memberRole) : "Workspace";
  const workspaceType = workspace?.isPersonal ? "Personnel" : "Partage";

  if (elements.workspaceBrandName) {
    elements.workspaceBrandName.textContent = workspaceName;
  }

  if (elements.workspaceKickerLabel) {
    elements.workspaceKickerLabel.textContent = workspace ? `${workspaceType} • ${workspaceRole}` : "Workspace";
  }

  if (elements.workspaceButton) {
    const pendingCount = workspaceDirectory.pendingInvitations.length;
    elements.workspaceButton.textContent = pendingCount > 0 ? `Espaces (${pendingCount})` : "Espaces";
  }

  if (elements.shareWorkspaceButton) {
    elements.shareWorkspaceButton.disabled = !workspace;
  }
}

function renderSidebar() {
  renderQuickCollection(
    elements.favoritesList,
    getVisiblePages().filter((page) => isPageFavorite(page)).sort((a, b) => b.updatedAt - a.updatedAt),
    "Aucun favori pour l'instant."
  );

  renderQuickCollection(
    elements.recentList,
    getVisiblePages().slice().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6),
    "Aucune page recente."
  );

  renderTree();

  renderQuickCollection(
    elements.trashList,
    getTrashPages().slice().sort((a, b) => b.updatedAt - a.updatedAt),
    "La corbeille est vide.",
    true
  );
}

function renderQuickCollection(container, pages, emptyText, isTrash = false) {
  container.innerHTML = "";
  if (!pages.length) {
    const empty = document.createElement("div");
    empty.className = "nav-empty";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  pages.forEach((page) => {
    const row = document.createElement("div");
    row.className = `nav-row ${isTrash ? "trash-row" : ""} ${state.ui.activePageId === page.id ? "active" : ""}`;
    row.addEventListener("click", () => setActivePage(page.id));

    const copy = document.createElement("div");
    copy.className = "nav-copy";

    const icon = document.createElement("span");
    icon.textContent = page.icon;
    icon.className = "nav-icon";

    const textWrap = document.createElement("div");
    const title = document.createElement("span");
    title.className = "nav-title";
    title.textContent = page.title || "Sans titre";

    const subtitle = document.createElement("span");
    subtitle.className = "nav-subtitle";
    subtitle.textContent = isTrash ? `Supprimee ${formatRelative(page.deletedAt)}` : `${pageKindLabel(page)} • ${formatRelative(page.updatedAt)}`;

    textWrap.append(title, subtitle);
    copy.append(icon, textWrap);
    row.append(copy);

    const actions = document.createElement("div");
    actions.className = "tree-item-actions";

    const actionButton = document.createElement("button");
    actionButton.className = "tiny-button";
    actionButton.type = "button";
    actionButton.textContent = isTrash ? "↺" : "⋯";
    actionButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (isTrash) {
        restorePage(page.id);
      } else {
        openPageMenu(page.id, actionButton);
      }
    });
    if (isTrash) {
      actionButton.title = "Restaurer cette page";
      const deleteButton = document.createElement("button");
      deleteButton.className = "tiny-button danger";
      deleteButton.type = "button";
      deleteButton.textContent = "x";
      deleteButton.title = "Supprimer definitivement";
      deleteButton.addEventListener("click", (event) => {
        event.stopPropagation();
        permanentlyDeletePage(page.id);
      });
      actions.append(actionButton, deleteButton);
    } else {
      actions.appendChild(actionButton);
    }
    row.append(actions);
    container.appendChild(row);
  });
}

function renderTree() {
  elements.pageTree.innerHTML = "";
  const roots = getChildren(null).sort(sortPagesForTree);
  if (!roots.length) {
    const empty = document.createElement("div");
    empty.className = "tree-empty";
    empty.textContent = "Commencez par creer une page ou un tableau.";
    elements.pageTree.appendChild(empty);
    return;
  }
  roots.forEach((page) => {
    elements.pageTree.appendChild(buildTreeNode(page));
  });
}

function buildTreeNode(page) {
  const wrapper = document.createElement("div");

  const row = document.createElement("div");
  row.className = `tree-item-row ${state.ui.activePageId === page.id ? "active" : ""}`;
  row.dataset.pageId = page.id;
  row.draggable = !Boolean(page.deletedAt);
  row.addEventListener("click", () => setActivePage(page.id));
  row.addEventListener("dragstart", (event) => {
    if (page.deletedAt || event.target.closest("button")) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(TREE_PAGE_DRAG_MIME, page.id);
    event.dataTransfer.setData("text/plain", page.id);
    ui.draggedTreePageId = page.id;
    row.classList.add("tree-drag-source");
  });
  row.addEventListener("dragover", (event) => {
    const sourceId = ui.draggedTreePageId || event.dataTransfer.getData(TREE_PAGE_DRAG_MIME) || event.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === page.id || collectSubtree(sourceId).includes(page.id)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    clearTreeDropIndicators();
    row.classList.add(`tree-drop-${getTreeDropMode(row, event)}`);
  });
  row.addEventListener("dragleave", (event) => {
    if (!row.contains(event.relatedTarget)) {
      row.classList.remove("tree-drop-before", "tree-drop-after", "tree-drop-inside");
    }
  });
  row.addEventListener("drop", (event) => {
    const sourceId = ui.draggedTreePageId || event.dataTransfer.getData(TREE_PAGE_DRAG_MIME) || event.dataTransfer.getData("text/plain");
    if (!sourceId) return;
    event.preventDefault();
    const mode = getTreeDropMode(row, event);
    clearTreeDropIndicators();
    movePageInTree(sourceId, page.id, mode);
  });
  row.addEventListener("dragend", () => {
    ui.draggedTreePageId = null;
    clearTreeDropIndicators();
  });

  const copy = document.createElement("div");
  copy.className = "tree-item-copy";

  const expander = document.createElement("button");
  expander.className = "tiny-button";
  expander.type = "button";
  const children = getChildren(page.id).sort(sortPagesForTree);
  expander.textContent = children.length ? (page.expanded ? "▾" : "▸") : "•";
  expander.disabled = !children.length;
  expander.style.opacity = children.length ? "1" : "0.25";
  expander.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!children.length) return;
    updatePage(page.id, (target) => {
      target.expanded = !target.expanded;
    });
    renderSidebar();
  });

  const icon = document.createElement("span");
  icon.textContent = page.icon;

  const titleWrap = document.createElement("div");
  titleWrap.style.minWidth = "0";

  const title = document.createElement("span");
  title.className = "tree-item-title";
  title.textContent = page.title || "Sans titre";

  const meta = document.createElement("span");
  meta.className = "tree-item-meta";
  meta.textContent = pageKindLabel(page);

  const collaborators = collaboratorsOnPage(page.id);
  if (collaborators.length) {
    const liveBadge = document.createElement("span");
    liveBadge.className = "tree-presence-badge";
    liveBadge.textContent = collaborators.length === 1 ? "1 en direct" : `${collaborators.length} en direct`;
    titleWrap.append(title, meta, liveBadge);
  } else {
    titleWrap.append(title, meta);
  }

  copy.append(expander, icon, titleWrap);

  const actions = document.createElement("div");
  actions.className = "tree-item-actions";

  const addButton = document.createElement("button");
  addButton.className = "tiny-button";
  addButton.type = "button";
  addButton.textContent = "+";
  addButton.addEventListener("click", (event) => {
    event.stopPropagation();
    openCreatePageMenu(addButton, page.id);
  });

  const moreButton = document.createElement("button");
  moreButton.className = "tiny-button";
  moreButton.type = "button";
  moreButton.textContent = "⋯";
  moreButton.addEventListener("click", (event) => {
    event.stopPropagation();
    openPageMenu(page.id, moreButton);
  });

  actions.append(addButton, moreButton);
  row.append(copy, actions);
  wrapper.appendChild(row);

  if (children.length && page.expanded) {
    const childList = document.createElement("div");
    childList.className = "tree-children";
    children.forEach((child) => childList.appendChild(buildTreeNode(child)));
    wrapper.appendChild(childList);
  }

  return wrapper;
}

function renderMain() {
  hideCellDetailPopover(false);
  const page = getActivePage();
  if (!page) return;

  renderBreadcrumbs(page);
  elements.pageKindBadge.textContent = page.deletedAt ? "Corbeille" : pageKindLabel(page);
  elements.pageUpdated.textContent = page.deletedAt
    ? `Supprimee ${formatRelative(page.deletedAt)}`
    : `Mise a jour ${formatRelative(page.updatedAt)}`;
  elements.heroTitle.textContent = page.title || "Sans titre";
  elements.pageIconDisplay.textContent = page.icon;
  elements.pageTitle.value = page.title || "";
  elements.pageTitle.disabled = Boolean(page.deletedAt);
  elements.toggleFavorite.textContent = isPageFavorite(page) ? "\u2605 Favori" : "\u2606 Favori";
  elements.toggleFavorite.disabled = Boolean(page.deletedAt);
  elements.cycleIcon.disabled = Boolean(page.deletedAt);
  elements.duplicatePage.disabled = false;
  elements.deletePage.textContent = page.deletedAt ? "Restaurer" : "Corbeille";

  renderToolbar(page);
  renderViewSwitcher(page);
  renderPageBody(page);
  renderInspector(page);
}

function renderBreadcrumbs(page) {
  elements.breadcrumbs.innerHTML = "";
  getPagePath(page.id).forEach((segment) => {
    const pill = document.createElement("span");
    pill.className = "breadcrumb-pill";
    pill.textContent = segment;
    elements.breadcrumbs.appendChild(pill);
  });
}

function renderToolbar(page) {
  elements.pageToolbar.innerHTML = "";
  const actions = [];

  if (page.deletedAt) {
    actions.push({
      label: "Restaurer cette page",
      className: "toolbar-button primary",
      onClick: () => restorePage(page.id),
    });
    actions.push({
      label: "Supprimer definitivement",
      className: "toolbar-button danger-soft",
      onClick: () => permanentlyDeletePage(page.id),
    });
  } else if (isWordPage(page)) {
    actions.push({
      label: "Exporter PDF",
      className: "toolbar-button subtle",
      onClick: () => exportDocumentPagePdf(page.id),
    });
  } else if (page.kind === "document") {
    actions.push({
      label: "Ajouter un bloc",
      className: "toolbar-button primary",
      onClick: () => addBlock(page.id, "paragraph"),
    });
    actions.push({
      label: "Ajouter une page, Word, Excel ou tableau",
      className: "toolbar-button",
      onClick: (event) => openCreatePageMenu(event?.currentTarget, page.id),
    });
    actions.push({
      label: "Inserer un modele",
      className: "toolbar-button subtle",
      onClick: () => openTemplatesModal(page.id),
    });
    actions.push({
      label: "Exporter PDF",
      className: "toolbar-button subtle",
      onClick: () => exportDocumentPagePdf(page.id),
    });
  } else if (isSpreadsheetPage(page)) {
    actions.push({
      label: "Nouvelle ligne",
      className: "toolbar-button primary",
      onClick: () => addSpreadsheetRow(page.id),
    });
    actions.push({
      label: "Nouvelle colonne",
      className: "toolbar-button",
      onClick: () => addSpreadsheetColumn(page.id),
    });
  } else if ((getActiveDatabaseView(page)?.type || "table") === "table") {
    actions.push({
      label: "Nouvelle ligne",
      className: "toolbar-button primary",
      onClick: () => addDatabaseRow(page.id),
    });
    actions.push({
      label: "Nouvelle propriete",
      className: "toolbar-button",
      onClick: (event) => openPropertyMenu(page.id, event?.currentTarget),
    });
    actions.push({
      label: "Ajouter des exemples",
      className: "toolbar-button subtle",
      onClick: () => seedDatabase(page.id),
    });
  }

  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = action.className;
    button.textContent = action.label;
    button.addEventListener("click", (event) => action.onClick(event));
    elements.pageToolbar.appendChild(button);
  });
}

function renderViewSwitcher(page) {
  elements.viewSwitcher.innerHTML = "";
  if (page.kind !== "database" || page.deletedAt || isSpreadsheetPage(page)) {
    elements.viewSwitcher.classList.add("hidden");
    return;
  }
  elements.viewSwitcher.classList.remove("hidden");
  const activeViewId = getActiveDatabaseViewId(page);
  page.database.views.forEach((view) => {
    const isBaseView = isBaseDatabaseView(page.database, view);
    const tab = document.createElement("div");
    tab.className = `view-tab ${activeViewId === view.id ? "active" : ""}`;

    const label = document.createElement("button");
    label.type = "button";
    label.className = "view-tab-label";
    label.textContent = view.name;
    label.title = isBaseView ? view.name : "Double-cliquez pour renommer";
    let selectTimer = null;
    label.addEventListener("click", (event) => {
      if (event.detail > 1) return;
      selectTimer = window.setTimeout(() => {
        setLocalActiveDatabaseView(page.id, view.id);
        renderMain();
      }, 180);
    });
    if (!isBaseView) {
      label.addEventListener("dblclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.clearTimeout(selectTimer);
        openDatabaseViewRenameInput(page.id, view.id, label);
      });
    }

    tab.appendChild(label);

    if (!isBaseView) {
      const close = document.createElement("button");
      close.type = "button";
      close.className = "view-tab-close";
      close.textContent = "\u00d7";
      close.title = `Supprimer la vue ${view.name}`;
      close.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteDatabaseView(page.id, view.id);
      });
      tab.appendChild(close);
    }

    elements.viewSwitcher.appendChild(tab);
  });

  const addViewButton = document.createElement("button");
  addViewButton.type = "button";
  addViewButton.className = "view-tab add-view-tab";
  addViewButton.textContent = "+ Vue";
  addViewButton.disabled = Boolean(page.deletedAt);
  addViewButton.addEventListener("click", (event) => openDatabaseViewMenu(page.id, event.currentTarget));
  elements.viewSwitcher.appendChild(addViewButton);
}

function openDatabaseViewRenameInput(pageId, viewId, label) {
  const page = getPage(pageId);
  if (!page?.database) return;
  const view = page.database.views.find((candidate) => candidate.id === viewId);
  if (!view || isBaseDatabaseView(page.database, view)) return;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "view-tab-input";
  input.value = view.name;
  input.setAttribute("aria-label", "Renommer la vue");
  label.replaceWith(input);
  input.focus();
  input.select();

  let finished = false;
  const finish = (shouldSave) => {
    if (finished) return;
    finished = true;
    const nextName = input.value.trim();
    if (shouldSave && nextName && nextName !== view.name) {
      renameDatabaseView(pageId, viewId, nextName);
      return;
    }
    renderMain();
  };

  input.addEventListener("blur", () => finish(true));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  });
}

function renderPageBody(page) {
  elements.pageBody.innerHTML = "";
  elements.pageBody.classList.toggle("spreadsheet-page-body", isSpreadsheetPage(page));
  elements.pageBody.classList.toggle("word-page-body", isWordPage(page));
  elements.pageBody.classList.toggle("database-page-body", page.kind === "database" && !isSpreadsheetPage(page));
  elements.pageBody.classList.toggle("document-page-body", page.kind !== "database");
  const inner = document.createElement("div");
  inner.className = `page-body-inner ${page.kind === "database" ? "database-body-inner" : ""} ${isSpreadsheetPage(page) ? "spreadsheet-body-inner" : ""} ${isWordPage(page) ? "word-body-inner" : ""}`;

  if (isSpreadsheetPage(page)) {
    inner.appendChild(renderSpreadsheetPage(page));
  } else if (isWordPage(page)) {
    inner.appendChild(renderWordPage(page));
  } else if (page.kind === "database") {
    inner.appendChild(renderDatabasePage(page));
  } else {
    inner.appendChild(renderDocumentPage(page));
  }

  elements.pageBody.appendChild(inner);
}

function renderDocumentPage(page) {
  const fragment = document.createElement("div");
  fragment.className = "document-page";
  bindDocumentImageDropZone(fragment, page);
  if (!page.blocks.length) {
    page.blocks = [createBlock("paragraph", "")];
  }
  const blocks = page.blocks;

  if (isBlankDocument(page) && !page.deletedAt) {
    const emptyState = document.createElement("section");
    emptyState.className = "empty-state";

    const title = document.createElement("h3");
    title.textContent = "Page vide, mais deja utile";
    const text = document.createElement("p");
    text.textContent = "Ajoutez du texte, une checklist, ou creez un tableau multi-vues en dessous.";
    emptyState.append(title, text);

    const quickActions = document.createElement("div");
    quickActions.className = "quick-action-grid";
    [
      ["Ecrire un titre", () => insertStarterBlock(page.id, "h1")],
      ["Ajouter une checklist", () => insertStarterBlock(page.id, "todo")],
      ["Ajouter une image", () => addBlock(page.id, "image")],
      ["Demander a l'IA", () => openAiAssistantModal()],
      ["Creer un tableau enfant", () => createNewPage("database", page.id)],
      ["Choisir un modele", () => openTemplatesModal(page.id)],
    ].forEach(([label, handler]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "card-button";
      button.textContent = label;
      button.addEventListener("click", handler);
      quickActions.appendChild(button);
    });

    emptyState.appendChild(quickActions);
    fragment.appendChild(emptyState);
  }

  const list = document.createElement("div");
  list.className = "block-list";
  blocks.forEach((block, index) => list.appendChild(renderBlock(page, block, index)));
  fragment.appendChild(list);

  if (!page.deletedAt) {
    const footer = document.createElement("div");
    footer.className = "document-footer";

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "inline-button";
    addButton.textContent = "+ Ajouter un bloc";
    addButton.addEventListener("click", () => addBlock(page.id, "paragraph"));

    const templateButton = document.createElement("button");
    templateButton.type = "button";
    templateButton.className = "inline-button";
    templateButton.textContent = "Choisir un modele";
    templateButton.addEventListener("click", () => openTemplatesModal(page.id));

    const aiButton = document.createElement("button");
    aiButton.type = "button";
    aiButton.className = "inline-button ai-inline-button";
    aiButton.textContent = "IA";
    aiButton.addEventListener("click", (event) => openPageAiMenu(page.id, event.currentTarget));

    footer.append(addButton, templateButton, aiButton);
    fragment.appendChild(footer);
  }

  return fragment;
}

function renderWordPage(page) {
  const fragment = document.createElement("div");
  fragment.className = "document-page word-document-page";
  page.wordPages = normalizeWordPages(page.wordPages, page.wordHtml, page.blocks);
  page.wordHtml = page.wordPages.map((wordPage) => wordPage.html).join('<div class="word-page-break"></div>');
  page.wordZoom = normalizeWordZoom(page.wordZoom);

  const toolbar = document.createElement("div");
  toolbar.className = "word-toolbar";
  toolbar.appendChild(renderWordRibbon(page));

  const canvas = document.createElement("div");
  canvas.className = "word-canvas";
  canvas.dataset.pageId = page.id;
  canvas.style.setProperty("--word-zoom", String(page.wordZoom));
  bindWordZoomEvents(canvas, page);

  page.wordPages.forEach((wordPage, index) => {
    const pageWrap = document.createElement("section");
    pageWrap.className = "word-page-wrap";
    pageWrap.dataset.pageIndex = String(index);

    const ruler = document.createElement("div");
    ruler.className = "word-ruler";
    Array.from({ length: 9 }).forEach((_, tickIndex) => {
      const tick = document.createElement("span");
      tick.textContent = String(tickIndex + 1);
      ruler.appendChild(tick);
    });

    const paper = document.createElement("article");
    paper.className = "word-paper";
    paper.setAttribute("aria-label", `Document Word page ${index + 1}`);

    const editor = document.createElement("div");
    editor.className = "word-editor";
    editor.contentEditable = String(!page.deletedAt);
    editor.spellcheck = true;
    editor.dataset.pageId = page.id;
    editor.dataset.wordPageId = wordPage.id;
    editor.dataset.pageIndex = String(index);
    editor.dataset.placeholder = "Redigez votre document Word ici...";
    editor.innerHTML = wordPage.html || "<p><br></p>";
    bindWordEditorEvents(page, editor, index);
    paper.appendChild(editor);

    pageWrap.append(ruler, paper);
    canvas.appendChild(pageWrap);
  });

  fragment.append(toolbar, canvas);
  return fragment;
}

function renderWordRibbon(page) {
  const ribbon = document.createElement("div");
  ribbon.className = "word-ribbon";

  const groupInsert = document.createElement("div");
  groupInsert.className = "word-ribbon-group";
  const paragraphButton = createWordRibbonButton("Paragraphe", () => insertWordHtml(page.id, "<p><br></p>"), page.deletedAt);
  const titleButton = createWordRibbonButton("Titre", () => insertWordHtml(page.id, "<h2>Nouveau titre</h2><p><br></p>"), page.deletedAt);
  const imageButton = createWordRibbonButton("Image", () => openWordImagePicker(page.id), page.deletedAt);
  const cropButton = createWordRibbonButton("Recadrer", () => openSelectedWordImageCrop(page.id), page.deletedAt);
  const tableButton = createWordRibbonButton("Tableau", () => insertWordHtml(page.id, buildWordTableHtml()), page.deletedAt);
  const pageButton = createWordRibbonButton("+ Page", () => addWordPage(page.id), page.deletedAt);
  groupInsert.append(paragraphButton, titleButton, imageButton, cropButton, tableButton, pageButton);

  const groupFont = document.createElement("div");
  groupFont.className = "word-ribbon-group";
  const fontSelect = document.createElement("select");
  fontSelect.className = "word-ribbon-select word-font-select";
  ["Calibri", "Arial", "Georgia", "Times New Roman", "Verdana"].forEach((font) => {
    const option = document.createElement("option");
    option.value = font;
    option.textContent = font;
    fontSelect.appendChild(option);
  });
  fontSelect.disabled = Boolean(page.deletedAt);
  fontSelect.addEventListener("change", () => applyWordCommand("fontName", fontSelect.value));

  const sizeSelect = document.createElement("select");
  sizeSelect.className = "word-ribbon-select word-size-select";
  [
    ["2", "10"],
    ["3", "12"],
    ["4", "14"],
    ["5", "18"],
    ["6", "24"],
    ["7", "32"],
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    if (value === "3") option.selected = true;
    sizeSelect.appendChild(option);
  });
  sizeSelect.disabled = Boolean(page.deletedAt);
  sizeSelect.addEventListener("change", () => applyWordCommand("fontSize", sizeSelect.value));
  groupFont.append(fontSelect, sizeSelect);

  const groupFormat = document.createElement("div");
  groupFormat.className = "word-ribbon-group";
  [
    ["B", "bold", "Gras"],
    ["I", "italic", "Italique"],
    ["U", "underline", "Souligne"],
    ["S", "strikeThrough", "Barre"],
  ].forEach(([label, command, title]) => {
    groupFormat.appendChild(createWordRibbonButton(label, () => applyWordCommand(command), page.deletedAt, title));
  });

  const textColor = createWordColorInput("#111827", "Couleur du texte", (value) => applyWordCommand("foreColor", value), page.deletedAt);
  const highlight = createWordColorInput("#fff3a3", "Surlignage", (value) => applyWordCommand("hiliteColor", value), page.deletedAt);
  groupFormat.append(textColor, highlight);

  const groupLayout = document.createElement("div");
  groupLayout.className = "word-ribbon-group";
  [
    ["Gauche", "justifyLeft"],
    ["Centre", "justifyCenter"],
    ["Droite", "justifyRight"],
    ["Puces", "insertUnorderedList"],
    ["Numeros", "insertOrderedList"],
  ].forEach(([label, command]) => {
    groupLayout.appendChild(createWordRibbonButton(label, () => applyWordCommand(command), page.deletedAt));
  });

  const groupTable = document.createElement("div");
  groupTable.className = "word-ribbon-group";
  [
    ["+ Ligne", () => addWordTableRow(page.id)],
    ["- Ligne", () => removeWordTableRow(page.id)],
    ["+ Colonne", () => addWordTableColumn(page.id)],
    ["- Colonne", () => removeWordTableColumn(page.id)],
    ["Suppr. tableau", () => removeWordTable(page.id)],
  ].forEach(([label, action]) => {
    groupTable.appendChild(createWordRibbonButton(label, action, page.deletedAt));
  });

  const groupMeta = document.createElement("div");
  groupMeta.className = "word-ribbon-group word-ribbon-meta";
  const count = document.createElement("span");
  count.textContent = `${normalizeWordPages(page.wordPages, page.wordHtml, page.blocks).length} page(s)`;
  const zoom = document.createElement("span");
  zoom.className = "word-zoom-status";
  zoom.textContent = `${Math.round(normalizeWordZoom(page.wordZoom) * 100)}%`;
  const exportButton = createWordRibbonButton("Exporter PDF", () => exportDocumentPagePdf(page.id), false);
  groupMeta.append(count, zoom, exportButton);

  ribbon.append(groupInsert, groupFont, groupFormat, groupLayout, groupTable, groupMeta);
  return ribbon;
}

function createWordRibbonButton(label, onClick, disabled = false, title = label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "word-ribbon-button";
  button.textContent = label;
  button.title = title;
  button.disabled = Boolean(disabled);
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", onClick);
  return button;
}

function createWordColorInput(value, title, onChange, disabled = false) {
  const label = document.createElement("label");
  label.className = "word-color-control";
  label.title = title;
  const input = document.createElement("input");
  input.type = "color";
  input.value = value;
  input.disabled = Boolean(disabled);
  input.addEventListener("mousedown", (event) => event.preventDefault());
  input.addEventListener("input", () => onChange(input.value));
  label.appendChild(input);
  return label;
}

function setWordZoom(pageId, nextZoom, shouldPersist = true) {
  const page = getPage(pageId);
  if (!page || !isWordPage(page)) return;
  page.wordZoom = normalizeWordZoom(nextZoom);
  page.updatedAt = Date.now();
  const canvas = document.querySelector(`.word-canvas[data-page-id="${pageId}"]`);
  if (canvas) canvas.style.setProperty("--word-zoom", String(page.wordZoom));
  const status = document.querySelector(".word-zoom-status");
  if (status) status.textContent = `${Math.round(page.wordZoom * 100)}%`;
  if (shouldPersist) scheduleSave("Zoom Word modifie");
}

function bindWordZoomEvents(canvas, page) {
  canvas.addEventListener("wheel", (event) => {
    if (!event.ctrlKey || page.deletedAt) return;
    event.preventDefault();
    event.stopPropagation();
    const direction = event.deltaY > 0 ? -1 : 1;
    const current = normalizeWordZoom(page.wordZoom);
    const rounded = Math.round((current + direction * WORD_ZOOM_STEP) * 10) / 10;
    setWordZoom(page.id, rounded);
  }, { passive: false });
}

function applyWordCommand(command, value = null) {
  document.execCommand(command, false, value);
  const activeEditor = document.activeElement?.classList?.contains("word-editor")
    ? document.activeElement
    : document.querySelector(".word-editor");
  if (activeEditor?.classList?.contains("word-editor")) {
    activeEditor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "formatSetWordText" }));
    activeEditor.focus();
  }
}

function bindWordEditorEvents(page, editor, pageIndex = 0) {
  editor.addEventListener("focus", () => {
    ui.currentBlockId = null;
    ui.activeWordPageIndex = pageIndex;
  });
  editor.addEventListener("input", () => saveWordDocumentContent(page.id, editor, pageIndex));
  editor.addEventListener("paste", () => {
    window.setTimeout(() => saveWordDocumentContent(page.id, editor, pageIndex), 0);
  });
  editor.addEventListener("click", (event) => {
    ui.activeWordPageIndex = pageIndex;
    const rawImage = event.target?.tagName === "IMG" && !event.target.closest?.(".word-image-frame")
      ? wrapWordImageElement(event.target)
      : null;
    const imageFrame = rawImage || event.target.closest?.(".word-image-frame");
    if (imageFrame) {
      selectWordImageFrame(imageFrame);
    }
    const cell = event.target.closest?.("td, th");
    if (cell?.closest(".word-inline-table")) {
      document.querySelectorAll(".word-table-cell-active").forEach((item) => item.classList.remove("word-table-cell-active"));
      cell.classList.add("word-table-cell-active");
    }
  });
  editor.addEventListener("dblclick", (event) => {
    const rawImage = event.target?.tagName === "IMG" && !event.target.closest?.(".word-image-frame")
      ? wrapWordImageElement(event.target)
      : null;
    const imageFrame = rawImage || event.target.closest?.(".word-image-frame");
    if (imageFrame) {
      event.preventDefault();
      selectWordImageFrame(imageFrame);
      openWordImageCropModal(page.id, imageFrame);
    }
  });
  editor.addEventListener("dragover", (event) => {
    if (page.deletedAt || !hasDraggedImage(event)) return;
    event.preventDefault();
    editor.classList.add("drag-over");
  });
  editor.addEventListener("dragleave", (event) => {
    if (!editor.contains(event.relatedTarget)) editor.classList.remove("drag-over");
  });
  editor.addEventListener("drop", (event) => {
    editor.classList.remove("drag-over");
    if (page.deletedAt || !hasDraggedImage(event)) return;
    event.preventDefault();
    const file = getFirstImageFile(event.dataTransfer?.files);
    if (file) void insertWordImageFromFile(page.id, file);
  });
}

function saveWordDocumentContent(pageId, editor, pageIndex = null) {
  const page = getPage(pageId);
  if (!page || !isWordPage(page)) return;
  page.wordPages = normalizeWordPages(page.wordPages, page.wordHtml, page.blocks);
  const index = Number.isInteger(pageIndex) ? pageIndex : Number(editor.dataset.pageIndex || ui.activeWordPageIndex || 0);
  const wordPage = page.wordPages[index] || page.wordPages[0];
  if (!wordPage) return;
  if (wordPage.html !== editor.innerHTML) {
    recordUndoSnapshot("Document Word modifie", {
      coalesceKey: `word:${pageId}`,
      coalesceMs: UNDO_TEXT_COALESCE_MS,
    });
  }
  wordPage.html = editor.innerHTML || "<p><br></p>";
  page.wordHtml = page.wordPages.map((item) => item.html).join('<div class="word-page-break"></div>');
  page.blocks = [createBlock("paragraph", page.wordPages.map((item) => stripHtml(item.html)).join("\n\n"))];
  page.updatedAt = Date.now();
  scheduleSave();
}

function focusWordEditor(pageId) {
  const active = document.activeElement?.classList?.contains("word-editor") && document.activeElement.dataset.pageId === pageId
    ? document.activeElement
    : null;
  const editor = active || document.querySelector(`.word-editor[data-page-id="${pageId}"][data-page-index="${ui.activeWordPageIndex || 0}"]`) || document.querySelector(`.word-editor[data-page-id="${pageId}"]`);
  if (!editor) return null;
  editor.focus();
  return editor;
}

function insertWordHtml(pageId, html) {
  const page = getPage(pageId);
  if (!page || page.deletedAt) return;
  const editor = focusWordEditor(pageId);
  if (!editor) return;
  document.execCommand("insertHTML", false, html);
  saveWordDocumentContent(pageId, editor);
}

function buildWordTableHtml() {
  return `
    <table class="word-inline-table" data-word-table="true">
      <tbody>
        <tr><td>Cellule 1</td><td>Cellule 2</td><td>Cellule 3</td></tr>
        <tr><td><br></td><td><br></td><td><br></td></tr>
        <tr><td><br></td><td><br></td><td><br></td></tr>
      </tbody>
    </table>
    <p><br></p>
  `;
}

function addWordPage(pageId) {
  const page = getPage(pageId);
  if (!page || page.deletedAt || !isWordPage(page)) return;
  recordUndoSnapshot("Page Word ajoutee");
  page.wordPages = normalizeWordPages(page.wordPages, page.wordHtml, page.blocks);
  page.wordPages.push({ id: uid("wordpage"), html: "<p><br></p>" });
  page.wordHtml = page.wordPages.map((item) => item.html).join('<div class="word-page-break"></div>');
  page.updatedAt = Date.now();
  scheduleSave("Page Word ajoutee");
  ui.activeWordPageIndex = page.wordPages.length - 1;
  renderMain();
  window.setTimeout(() => focusWordEditor(pageId), 0);
}

function getCurrentWordEditor(pageId) {
  return document.activeElement?.classList?.contains("word-editor") && document.activeElement.dataset.pageId === pageId
    ? document.activeElement
    : focusWordEditor(pageId);
}

function getCurrentWordTableCell(pageId) {
  const selection = window.getSelection();
  const node = selection?.anchorNode;
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  const selectedCell = element?.closest?.("td, th");
  if (selectedCell?.closest(".word-inline-table")) return selectedCell;
  const activeCell = document.querySelector(`.word-editor[data-page-id="${pageId}"] .word-table-cell-active`);
  return activeCell?.closest(".word-inline-table") ? activeCell : null;
}

function updateWordTableSelection(cell) {
  document.querySelectorAll(".word-table-cell-active").forEach((item) => item.classList.remove("word-table-cell-active"));
  cell?.classList?.add("word-table-cell-active");
}

function saveCurrentWordEditor(pageId) {
  const editor = getCurrentWordEditor(pageId);
  if (editor) saveWordDocumentContent(pageId, editor, Number(editor.dataset.pageIndex || 0));
}

function addWordTableRow(pageId) {
  const cell = getCurrentWordTableCell(pageId);
  const row = cell?.parentElement;
  if (!cell || !row) return toast("Cliquez d'abord dans une cellule du tableau.");
  const clone = document.createElement("tr");
  Array.from(row.children).forEach(() => {
    const td = document.createElement("td");
    td.innerHTML = "<br>";
    clone.appendChild(td);
  });
  row.after(clone);
  updateWordTableSelection(clone.children[Math.min(cell.cellIndex, clone.children.length - 1)]);
  saveCurrentWordEditor(pageId);
}

function removeWordTableRow(pageId) {
  const cell = getCurrentWordTableCell(pageId);
  const table = cell?.closest(".word-inline-table");
  const row = cell?.parentElement;
  if (!cell || !table || !row) return toast("Cliquez d'abord dans une cellule du tableau.");
  if (table.rows.length <= 1) return toast("Le tableau doit garder au moins une ligne.");
  const nextRow = row.nextElementSibling || row.previousElementSibling;
  row.remove();
  updateWordTableSelection(nextRow?.children?.[Math.min(cell.cellIndex, nextRow.children.length - 1)]);
  saveCurrentWordEditor(pageId);
}

function addWordTableColumn(pageId) {
  const cell = getCurrentWordTableCell(pageId);
  const table = cell?.closest(".word-inline-table");
  if (!cell || !table) return toast("Cliquez d'abord dans une cellule du tableau.");
  const index = cell.cellIndex + 1;
  Array.from(table.rows).forEach((row) => {
    const td = document.createElement("td");
    td.innerHTML = "<br>";
    row.insertBefore(td, row.children[index] || null);
  });
  updateWordTableSelection(cell.parentElement?.children?.[index]);
  saveCurrentWordEditor(pageId);
}

function removeWordTableColumn(pageId) {
  const cell = getCurrentWordTableCell(pageId);
  const table = cell?.closest(".word-inline-table");
  if (!cell || !table) return toast("Cliquez d'abord dans une cellule du tableau.");
  if ((table.rows[0]?.cells.length || 0) <= 1) return toast("Le tableau doit garder au moins une colonne.");
  const index = cell.cellIndex;
  Array.from(table.rows).forEach((row) => row.children[index]?.remove());
  const nextCell = table.rows[0]?.children[Math.max(0, index - 1)];
  updateWordTableSelection(nextCell);
  saveCurrentWordEditor(pageId);
}

function removeWordTable(pageId) {
  const cell = getCurrentWordTableCell(pageId);
  const table = cell?.closest(".word-inline-table");
  const editor = table?.closest(".word-editor");
  if (!cell || !table || !editor) return toast("Cliquez d'abord dans une cellule du tableau.");

  const spacer = document.createElement("p");
  spacer.innerHTML = "<br>";
  table.replaceWith(spacer);
  updateWordTableSelection(null);
  editor.focus();
  saveWordDocumentContent(pageId, editor, Number(editor.dataset.pageIndex || 0));
  toast("Tableau supprime.");
}

function openWordImagePicker(pageId) {
  const page = getPage(pageId);
  if (!page || page.deletedAt) return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.addEventListener("change", () => {
    const file = getFirstImageFile(input.files);
    if (file) void insertWordImageFromFile(pageId, file);
    input.remove();
  });
  document.body.appendChild(input);
  input.click();
}

async function insertWordImageFromFile(pageId, file) {
  try {
    const imageData = await readFileAsImageBlockData(file);
    insertWordHtml(pageId, `${buildWordImageHtml(imageData)}<p><br></p>`);
    toast("Image ajoutee au document Word.");
  } catch (error) {
    toast(error.message || "Image impossible a importer.");
  }
}

function buildWordImageHtml(imageData) {
  return `
    <figure class="word-image-frame" contenteditable="false" data-crop-x="50" data-crop-y="50" data-crop-zoom="1" style="width:100%;height:260px;">
      <img src="${imageData.imageData}" alt="${escapeHtml(imageData.imageName || "Image")}" style="width:100%;height:100%;object-fit:cover;object-position:50% 50%;transform:scale(1);">
      <figcaption>${escapeHtml(imageData.imageName || "")}</figcaption>
    </figure>
  `;
}

function wrapWordImageElement(img) {
  if (!img || img.closest?.(".word-image-frame")) return img?.closest?.(".word-image-frame") || null;
  const frame = document.createElement("figure");
  frame.className = "word-image-frame";
  frame.contentEditable = "false";
  frame.dataset.cropX = "50";
  frame.dataset.cropY = "50";
  frame.dataset.cropZoom = "1";
  frame.style.width = "100%";
  frame.style.height = `${Math.max(180, img.naturalHeight ? Math.min(420, img.naturalHeight) : 260)}px`;
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "cover";
  img.style.objectPosition = "50% 50%";
  img.style.transform = "scale(1)";
  img.replaceWith(frame);
  frame.appendChild(img);
  return frame;
}

function selectWordImageFrame(frame) {
  document.querySelectorAll(".word-image-frame.selected").forEach((item) => item.classList.remove("selected"));
  frame.classList.add("selected");
}

function getSelectedWordImageFrame(pageId) {
  const selected = document.querySelector(`.word-editor[data-page-id="${pageId}"] .word-image-frame.selected`);
  if (selected) return selected;
  const selection = window.getSelection();
  const node = selection?.anchorNode;
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  return element?.closest?.(".word-image-frame") || null;
}

function openSelectedWordImageCrop(pageId) {
  const frame = getSelectedWordImageFrame(pageId);
  if (!frame) {
    toast("Selectionnez ou double-cliquez d'abord une image.");
    return;
  }
  openWordImageCropModal(pageId, frame);
}

function openWordImageCropModal(pageId, frame) {
  const img = frame?.querySelector("img");
  if (!frame || !img) return;
  openModal({
    kicker: "Image Word",
    title: "Recadrer l'image",
    contentBuilder: () => {
      const panel = document.createElement("div");
      panel.className = "word-crop-panel";

      const preview = document.createElement("div");
      preview.className = "word-crop-preview";
      const previewImg = img.cloneNode(true);
      preview.appendChild(previewImg);

      const controls = document.createElement("div");
      controls.className = "word-crop-controls";
      const values = {
        width: Number.parseFloat(frame.style.width) || 100,
        height: Number.parseFloat(frame.style.height) || 260,
        x: Number(frame.dataset.cropX || 50),
        y: Number(frame.dataset.cropY || 50),
        zoom: Number(frame.dataset.cropZoom || 1),
      };

      const update = () => {
        frame.style.width = `${values.width}%`;
        frame.style.height = `${values.height}px`;
        frame.dataset.cropX = String(values.x);
        frame.dataset.cropY = String(values.y);
        frame.dataset.cropZoom = String(values.zoom);
        [img, previewImg].forEach((target) => {
          target.style.width = "100%";
          target.style.height = "100%";
          target.style.objectFit = "cover";
          target.style.objectPosition = `${values.x}% ${values.y}%`;
          target.style.transform = `scale(${values.zoom})`;
          target.style.transformOrigin = `${values.x}% ${values.y}%`;
        });
      };

      const createRange = (label, key, min, max, step) => {
        const wrap = document.createElement("label");
        wrap.className = "word-crop-control";
        const text = document.createElement("span");
        text.textContent = label;
        const input = document.createElement("input");
        input.type = "range";
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = String(values[key]);
        input.addEventListener("input", () => {
          values[key] = Number(input.value);
          update();
        });
        wrap.append(text, input);
        return wrap;
      };

      controls.append(
        createRange("Largeur", "width", 20, 100, 1),
        createRange("Hauteur", "height", 120, 760, 10),
        createRange("Zoom", "zoom", 1, 3, 0.05),
        createRange("Horizontal", "x", 0, 100, 1),
        createRange("Vertical", "y", 0, 100, 1),
      );

      const actions = document.createElement("div");
      actions.className = "modal-actions";
      const save = document.createElement("button");
      save.type = "button";
      save.className = "primary-button";
      save.textContent = "Appliquer";
      save.addEventListener("click", () => {
        const editor = frame.closest(".word-editor");
        if (editor) saveWordDocumentContent(pageId, editor, Number(editor.dataset.pageIndex || 0));
        closeModal();
      });
      actions.appendChild(save);

      update();
      panel.append(preview, controls, actions);
      return panel;
    },
  });
}

function renderSpreadsheetPage(page) {
  const activeSheet = ensureSpreadsheetWorkbook(page);
  ensureSpreadsheetShape(page);
  spreadsheetCalculationCache = new Map();
  spreadsheetRangeCache = new Map();

  const shell = document.createElement("div");
  shell.className = "spreadsheet-shell";

  const toolbar = document.createElement("div");
  toolbar.className = "spreadsheet-toolbar";

  const status = document.createElement("div");
  status.className = "spreadsheet-status";
  status.textContent = `${page.database.rows.length} lignes x ${page.database.properties.length} colonnes`;

  const formula = document.createElement("div");
  formula.className = "spreadsheet-formula-hint";
  formula.innerHTML = "<strong>fx</strong><span>Formules: =A1+B1, =SUM(A1:B3), =XLOOKUP(A1;B:B;C:C)</span>";

  const actions = document.createElement("div");
  actions.className = "spreadsheet-actions";
  const rowButton = document.createElement("button");
  rowButton.type = "button";
  rowButton.className = "inline-button";
  rowButton.textContent = "+ Ligne";
  rowButton.disabled = Boolean(page.deletedAt);
  rowButton.addEventListener("click", () => addSpreadsheetRow(page.id));
  const columnButton = document.createElement("button");
  columnButton.type = "button";
  columnButton.className = "inline-button";
  columnButton.textContent = "+ Colonne";
  columnButton.disabled = Boolean(page.deletedAt);
  columnButton.addEventListener("click", () => addSpreadsheetColumn(page.id));
  const importButton = document.createElement("button");
  importButton.type = "button";
  importButton.className = "inline-button";
  importButton.textContent = "Importer XLSX";
  importButton.disabled = Boolean(page.deletedAt);
  importButton.addEventListener("click", () => openSpreadsheetXlsxImport(page.id));

  const exportButton = document.createElement("button");
  exportButton.type = "button";
  exportButton.className = "inline-button";
  exportButton.textContent = "Exporter XLSX";
  exportButton.addEventListener("click", () => {
    void exportSpreadsheetXlsx(page.id);
  });

  actions.append(rowButton, columnButton, importButton, exportButton);

  toolbar.append(status, formula, actions);

  const sheetTabs = renderSpreadsheetSheetTabs(page, activeSheet);

  const scroll = document.createElement("div");
  scroll.className = "spreadsheet-scroll";

  const grid = document.createElement("div");
  grid.className = "spreadsheet-grid";
  grid.style.gridTemplateColumns = `52px ${page.database.properties
    .map((property) => `${getSpreadsheetColumnWidth(page.database, property.id)}px`)
    .join(" ")}`;

  const corner = document.createElement("div");
  corner.className = "spreadsheet-cell spreadsheet-corner";
  grid.appendChild(corner);

  page.database.properties.forEach((property, columnIndex) => {
    const head = document.createElement("div");
    head.className = "spreadsheet-cell spreadsheet-column-head";
    const input = document.createElement("input");
    input.value = property.name || spreadsheetColumnName(columnIndex);
    input.disabled = Boolean(page.deletedAt);
    input.addEventListener("change", () => renameSpreadsheetColumn(page.id, property.id, input.value.trim() || spreadsheetColumnName(columnIndex)));
    const resizeHandle = document.createElement("button");
    resizeHandle.type = "button";
    resizeHandle.className = "spreadsheet-column-resize";
    resizeHandle.title = "Glisser pour modifier la largeur";
    resizeHandle.disabled = Boolean(page.deletedAt);
    bindSpreadsheetColumnResize(resizeHandle, page.id, property.id, grid);
    head.append(input, resizeHandle);
    grid.appendChild(head);
  });

  page.database.rows.forEach((row, rowIndex) => {
    const rowHeight = getSpreadsheetRowHeight(page.database, row.id);
    const rowHead = document.createElement("div");
    rowHead.className = "spreadsheet-cell spreadsheet-row-head";
    rowHead.dataset.rowId = row.id;
    rowHead.style.height = `${rowHeight}px`;
    rowHead.textContent = String(rowIndex + 1);
    const resizeHandle = document.createElement("button");
    resizeHandle.type = "button";
    resizeHandle.className = "spreadsheet-row-resize";
    resizeHandle.title = "Glisser pour modifier la hauteur";
    resizeHandle.disabled = Boolean(page.deletedAt);
    bindSpreadsheetRowResize(resizeHandle, page.id, row.id);
    rowHead.appendChild(resizeHandle);
    grid.appendChild(rowHead);

    page.database.properties.forEach((property, columnIndex) => {
      grid.appendChild(renderSpreadsheetCell(page, row, property, rowIndex, columnIndex));
    });
  });

  scroll.appendChild(grid);
  shell.append(toolbar, sheetTabs, scroll);
  scheduleSpreadsheetFormulaWorker(page);
  return shell;
}

function renderSpreadsheetSheetTabs(page, activeSheet) {
  const tabs = document.createElement("div");
  tabs.className = "spreadsheet-sheet-tabs";

  page.excelSheets.forEach((sheet, index) => {
    const tab = document.createElement("div");
    tab.setAttribute("role", "button");
    tab.tabIndex = 0;
    tab.className = `spreadsheet-sheet-tab ${sheet.id === activeSheet?.id ? "active" : ""}`;
    const label = document.createElement("span");
    label.className = "spreadsheet-sheet-tab-label";
    label.textContent = sheet.name || `Feuille ${index + 1}`;
    tab.appendChild(label);
    tab.title = "Double-cliquez pour renommer";
    let tabClickTimer = null;
    tab.addEventListener("click", (event) => {
      if (event.target.closest(".spreadsheet-sheet-close") || event.target.closest(".spreadsheet-sheet-name-input")) return;
      if (event.detail > 1) return;
      clearTimeout(tabClickTimer);
      tabClickTimer = window.setTimeout(() => switchSpreadsheetSheet(page.id, sheet.id), 180);
    });
    tab.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearTimeout(tabClickTimer);
      openSpreadsheetSheetInlineRename(tab, page.id, sheet.id, index);
    });
    tab.addEventListener("keydown", (event) => {
      if (event.target.closest(".spreadsheet-sheet-name-input")) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        switchSpreadsheetSheet(page.id, sheet.id);
      }
      if (event.key === "F2") {
        event.preventDefault();
        openSpreadsheetSheetInlineRename(tab, page.id, sheet.id, index);
      }
    });
    if (page.excelSheets.length > 1) {
      const close = document.createElement("span");
      close.className = "spreadsheet-sheet-close";
      close.textContent = "×";
      close.title = "Supprimer la feuille";
      close.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        deleteSpreadsheetSheet(page.id, sheet.id);
      });
      tab.appendChild(close);
    }
    tabs.appendChild(tab);
  });

  const add = document.createElement("button");
  add.type = "button";
  add.className = "spreadsheet-sheet-tab add";
  add.textContent = "+";
  add.title = "Ajouter une feuille";
  add.disabled = Boolean(page.deletedAt);
  add.addEventListener("click", () => addSpreadsheetSheet(page.id));
  tabs.appendChild(add);

  return tabs;
}

function renderSpreadsheetCell(page, row, property, rowIndex, columnIndex) {
  const cell = document.createElement("div");
  cell.className = "spreadsheet-cell spreadsheet-data-cell";
  cell.style.height = `${getSpreadsheetRowHeight(page.database, row.id)}px`;
  const activeSheet = getActiveSpreadsheetSheet(page);
  const activeFormula = ui.spreadsheetFormulaEdit;
  const shouldQualifyReference = activeFormula?.pageId === page.id && activeFormula.sheetId && activeFormula.sheetId !== activeSheet?.id;
  const cellReference = spreadsheetCellReference(rowIndex, columnIndex, shouldQualifyReference ? activeSheet?.name : "");
  cell.dataset.cellReference = cellReference;
  cell.dataset.pageId = page.id;
  cell.dataset.rowId = row.id;
  cell.dataset.propertyId = property.id;
  cell.dataset.rowIndex = String(rowIndex);
  cell.dataset.columnIndex = String(columnIndex);
  const rawValue = String(row.cells[property.id] || "");
  const isFormula = rawValue.trim().startsWith("=");
  const isImage = isSpreadsheetImageValue(rawValue);
  const displayedComputed = isFormula ? getSpreadsheetFormulaDisplayValue(page, rowIndex, columnIndex, rawValue) : "";

  const input = document.createElement("input");
  input.value = isImage ? "Image" : (isFormula ? displayedComputed : rawValue);
  input.dataset.rawValue = rawValue;
  input.dataset.originalValue = rawValue;
  input.dataset.cancelled = "false";
  input.placeholder = cellReference;
  input.disabled = Boolean(page.deletedAt);
  input.readOnly = isImage;
  input.title = isImage ? "Image dans la cellule - double-cliquez pour remplacer" : (isFormula ? `${rawValue} = ${displayedComputed || "Calcul en cours..."}` : rawValue);
  if (isFormula && !displayedComputed) cell.classList.add("spreadsheet-formula-pending");

  bindSpreadsheetImageDrop(cell, page.id, row.id, property.id);
  bindSpreadsheetImagePaste(input, page.id, row.id, property.id);

  if (isImage) {
    cell.classList.add("spreadsheet-image-cell");
    input.classList.add("spreadsheet-image-input");

    const preview = document.createElement("button");
    preview.type = "button";
    preview.className = "spreadsheet-image-preview";
    preview.style.setProperty("--cell-image-scale", `${getSpreadsheetCellImageScale(page.database, row.id, property.id)}%`);
    preview.disabled = Boolean(page.deletedAt);
    preview.title = "Double-cliquez pour remplacer l'image";
    preview.addEventListener("click", () => input.focus());
    preview.addEventListener("dblclick", () => openSpreadsheetCellImagePicker(page.id, row.id, property.id));
    const img = document.createElement("img");
    img.src = rawValue;
    img.alt = "Image de cellule";
    img.draggable = false;
    preview.appendChild(img);
    const imageResize = document.createElement("button");
    imageResize.type = "button";
    imageResize.className = "spreadsheet-image-resize";
    imageResize.title = "Glisser pour modifier la taille de l'image";
    imageResize.disabled = Boolean(page.deletedAt);
    bindSpreadsheetImageResize(imageResize, page.id, row.id, property.id, preview);
    preview.appendChild(imageResize);

    const actions = document.createElement("div");
    actions.className = "spreadsheet-image-actions";
    const replaceButton = document.createElement("button");
    replaceButton.type = "button";
    replaceButton.textContent = "Remplacer";
    replaceButton.disabled = Boolean(page.deletedAt);
    replaceButton.addEventListener("click", () => openSpreadsheetCellImagePicker(page.id, row.id, property.id));
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "×";
    removeButton.title = "Supprimer l'image";
    removeButton.disabled = Boolean(page.deletedAt);
    removeButton.addEventListener("click", () => removeSpreadsheetCellImage(page.id, row.id, property.id));
    actions.append(replaceButton, removeButton);

    input.addEventListener("keydown", (event) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeSpreadsheetCellImage(page.id, row.id, property.id);
      }
      if (event.key === "Enter") {
        event.preventDefault();
        openSpreadsheetCellImagePicker(page.id, row.id, property.id);
      }
      if (event.key !== "Tab") return;
      event.preventDefault();
      const next = nextSpreadsheetCellPosition(page, rowIndex, columnIndex, event.shiftKey ? "left" : "right");
      focusSpreadsheetCell(page.id, next.rowIndex, next.columnIndex);
    });

    cell.append(preview, input, actions);
    return cell;
  }

  const imageButton = document.createElement("button");
  imageButton.type = "button";
  imageButton.className = "spreadsheet-image-add";
  imageButton.textContent = "+ Photo";
  imageButton.title = "Ajouter une photo dans cette cellule";
  imageButton.disabled = Boolean(page.deletedAt);
  imageButton.addEventListener("click", () => openSpreadsheetCellImagePicker(page.id, row.id, property.id));

  cell.addEventListener("mousedown", (event) => {
    const active = ui.spreadsheetFormulaEdit;
    const sameCell = active?.pageId === page.id && active?.rowId === row.id && active?.propertyId === property.id;
    if (!page.deletedAt && !sameCell && isActiveSpreadsheetFormula(page.id)) {
      event.preventDefault();
      event.stopPropagation();
      cell.classList.add("spreadsheet-reference-picked");
      window.setTimeout(() => cell.classList.remove("spreadsheet-reference-picked"), 240);
      insertSpreadsheetReferenceIntoFormula(cellReference);
    }
  });
  input.addEventListener("focus", () => {
    if (String(input.dataset.rawValue || "").trim().startsWith("=")) {
      input.value = input.dataset.rawValue;
      setActiveSpreadsheetFormula(page.id, row.id, property.id, input);
      window.setTimeout(() => {
        const end = input.value.length;
        input.setSelectionRange(end, end);
      }, 0);
    }
  });
  input.addEventListener("input", () => {
    input.dataset.rawValue = input.value;
    if (input.value.trim().startsWith("=")) {
      setActiveSpreadsheetFormula(page.id, row.id, property.id, input);
    } else {
      clearActiveSpreadsheetFormula(input);
    }
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      const original = input.dataset.originalValue || "";
      input.dataset.cancelled = "true";
      input.dataset.rawValue = original;
      updateCellValue(page.id, row.id, property.id, original, false);
      clearActiveSpreadsheetFormula(input);
      input.value = original.trim().startsWith("=")
        ? formatSpreadsheetComputedValue(computeSpreadsheetCellValue(page, rowIndex, columnIndex))
        : original;
      input.blur();
      return;
    }
    if (!["Enter", "Tab"].includes(event.key)) return;
    event.preventDefault();
    const nextRaw = input.dataset.rawValue || input.value;
    updateCellValue(page.id, row.id, property.id, nextRaw, false);
    input.dataset.originalValue = nextRaw;
    clearActiveSpreadsheetFormula(input);
    scheduleSpreadsheetFormulaWorker(page);
    const next = event.key === "Enter"
      ? { rowIndex: Math.min(rowIndex + 1, page.database.rows.length - 1), columnIndex }
      : nextSpreadsheetCellPosition(page, rowIndex, columnIndex, event.shiftKey ? "left" : "right");
    focusSpreadsheetCell(page.id, next.rowIndex, next.columnIndex);
  });
  input.addEventListener("blur", () => {
    if (input.dataset.cancelled === "true") {
      input.dataset.cancelled = "false";
      scheduleSpreadsheetFormulaWorker(page);
      return;
    }
    const nextRaw = input.dataset.rawValue || input.value;
    const original = input.dataset.originalValue || "";
    if (nextRaw !== original) {
      updateCellValue(page.id, row.id, property.id, nextRaw, false);
      input.dataset.originalValue = nextRaw;
    }
    if (nextRaw.trim().startsWith("=")) {
      const nextComputed = getSpreadsheetFormulaDisplayValue(page, rowIndex, columnIndex, nextRaw)
        || formatSpreadsheetComputedValue(computeSpreadsheetCellValue(page, rowIndex, columnIndex));
      input.value = nextComputed;
      input.title = `${nextRaw} = ${nextComputed || "Erreur"}`;
    }
    clearActiveSpreadsheetFormula(input);
    if (nextRaw === original) return;
    scheduleSpreadsheetFormulaWorker(page);
  });
  if (isFormula) {
    cell.appendChild(input);
  } else {
    cell.append(input, imageButton);
  }

  if (isFormula) {
    const result = document.createElement("span");
    result.className = "spreadsheet-formula-result";
    result.textContent = "fx";
    cell.appendChild(result);
  }

  return cell;
}

function renderBlock(page, block, index) {
  const row = document.createElement("div");
  row.className = "block-row";
  row.dataset.blockId = block.id;

  const grip = document.createElement("button");
  grip.type = "button";
  grip.className = "block-grip";
  grip.textContent = "⋮⋮";
  grip.disabled = Boolean(page.deletedAt);
  grip.addEventListener("click", (event) => {
    event.stopPropagation();
    openBlockMenu(page.id, block.id, grip, index);
  });
  row.appendChild(grip);
  bindBlockDragAndDrop(row, grip, page, block);

  let shell;
  if (block.type === "todo") {
    shell = buildTodoBlock(page, block);
  } else if (block.type === "image") {
    shell = buildImageBlock(page, block);
  } else if (block.type === "table") {
    shell = buildInlineTableBlock(page, block);
  } else if (block.type === "divider") {
    shell = document.createElement("div");
    shell.className = "divider-shell";
    const divider = document.createElement("hr");
    shell.appendChild(divider);
  } else {
    shell = document.createElement("div");
    shell.className = `block-shell ${block.type}${isWordPage(page) ? " word-text-shell" : ""}`;
    const editor = document.createElement("div");
    editor.className = "block-editor";
    editor.contentEditable = String(!page.deletedAt);
    editor.spellcheck = true;
    editor.dataset.placeholder = getBlockPlaceholder(block.type);
    if (isWordPage(page) && block.html) {
      editor.innerHTML = block.html;
    } else {
      editor.textContent = block.text;
    }
    bindBlockEditorEvents(page, block, editor);
    shell.appendChild(editor);
  }

  row.appendChild(shell);
  return row;
}

function buildTodoBlock(page, block) {
  const shell = document.createElement("div");
  shell.className = `block-shell todo-shell ${block.checked ? "todo-done" : ""}`;

  const check = document.createElement("button");
  check.type = "button";
  check.className = `todo-check ${block.checked ? "checked" : ""}`;
  check.textContent = block.checked ? "✓" : "";
  check.disabled = Boolean(page.deletedAt);
  check.addEventListener("click", () => {
    updatePage(page.id, (target) => {
      const current = target.blocks.find((candidate) => candidate.id === block.id);
      if (current) current.checked = !current.checked;
    });
    renderMain();
  });

  const editor = document.createElement("div");
  editor.className = "block-editor";
  editor.contentEditable = String(!page.deletedAt);
  editor.spellcheck = true;
  editor.dataset.placeholder = "Tache a faire...";
  editor.textContent = block.text;
  bindBlockEditorEvents(page, block, editor);

  shell.append(check, editor);
  return shell;
}

function buildImageBlock(page, block) {
  const shell = document.createElement("div");
  shell.className = "block-shell image-shell";

  const width = Math.max(20, Math.min(100, Number(block.imageWidth || 100)));
  const figure = document.createElement("figure");
  figure.className = "image-block-figure";
  figure.style.width = `${width}%`;

  if (block.imageData) {
    const img = document.createElement("img");
    img.src = block.imageData;
    img.alt = block.imageName || "Image";
    img.draggable = false;
    img.title = page.deletedAt ? (block.imageName || "Image") : "Double-cliquez pour remplacer l'image";
    img.addEventListener("dblclick", () => {
      if (!page.deletedAt) openImagePickerForBlock(page.id, block.id);
    });
    figure.appendChild(img);

    const resizeHandle = document.createElement("button");
    resizeHandle.type = "button";
    resizeHandle.className = "image-resize-handle";
    resizeHandle.title = "Glisser pour redimensionner";
    resizeHandle.disabled = Boolean(page.deletedAt);
    bindImageResizeHandle(resizeHandle, page.id, block.id, figure);
    figure.appendChild(resizeHandle);
  } else {
    const empty = document.createElement("button");
    empty.type = "button";
    empty.className = "image-empty";
    empty.disabled = Boolean(page.deletedAt);
    empty.textContent = "Choisir une image ou la glisser ici";
    empty.addEventListener("click", () => openImagePickerForBlock(page.id, block.id));
    figure.appendChild(empty);
  }

  shell.appendChild(figure);

  shell.addEventListener("dragover", (event) => {
    if (page.deletedAt || !hasDraggedImage(event)) return;
    event.preventDefault();
    shell.classList.add("drag-over");
  });
  shell.addEventListener("dragleave", () => shell.classList.remove("drag-over"));
  shell.addEventListener("drop", (event) => {
    shell.classList.remove("drag-over");
    if (page.deletedAt || !hasDraggedImage(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const file = getFirstImageFile(event.dataTransfer?.files);
    if (file) {
      void setImageBlockFromFile(page.id, block.id, file, "Image deposee");
    }
  });

  return shell;
}

function buildInlineTableBlock(page, block) {
  const table = normalizeInlineTable(block.table);
  block.table = table;

  const shell = document.createElement("div");
  shell.className = "block-shell inline-table-shell";

  const toolbar = document.createElement("div");
  toolbar.className = "inline-table-toolbar";

  const caption = document.createElement("span");
  caption.className = "card-caption";
  caption.textContent = `${table.rows.length} lignes - ${table.columns.length} colonnes`;

  const actions = document.createElement("div");
  actions.className = "inline-table-actions";

  const addRow = document.createElement("button");
  addRow.type = "button";
  addRow.className = "inline-button";
  addRow.textContent = "+ Ligne";
  addRow.disabled = Boolean(page.deletedAt);
  addRow.addEventListener("click", () => addInlineTableRow(page.id, block.id));

  const addColumn = document.createElement("button");
  addColumn.type = "button";
  addColumn.className = "inline-button";
  addColumn.textContent = "+ Colonne";
  addColumn.disabled = Boolean(page.deletedAt);
  addColumn.addEventListener("click", () => addInlineTableColumn(page.id, block.id));

  actions.append(addRow, addColumn);
  toolbar.append(caption, actions);

  const scroll = document.createElement("div");
  scroll.className = "inline-table-scroll";

  const grid = document.createElement("div");
  grid.className = "inline-page-table";
  grid.style.gridTemplateColumns = `repeat(${table.columns.length}, minmax(180px, 1fr)) 56px`;

  table.columns.forEach((column) => {
    const cell = document.createElement("div");
    cell.className = "inline-page-table-cell inline-page-table-head";

    const input = document.createElement("input");
    input.type = "text";
    input.value = column.name;
    input.placeholder = "Nom de colonne";
    input.disabled = Boolean(page.deletedAt);
    input.addEventListener("focus", () => recordUndoSnapshot("Nom de colonne modifie", {
      coalesceKey: `inline-table-col:${page.id}:${block.id}:${column.id}`,
      coalesceMs: UNDO_TEXT_COALESCE_MS,
    }));
    input.addEventListener("input", () => updateInlineTableColumnName(page.id, block.id, column.id, input.value));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "inline-table-remove";
    remove.textContent = "x";
    remove.title = "Supprimer la colonne";
    remove.disabled = Boolean(page.deletedAt) || table.columns.length <= 1;
    remove.addEventListener("click", () => removeInlineTableColumn(page.id, block.id, column.id));

    cell.append(input, remove);
    grid.appendChild(cell);
  });

  const actionHead = document.createElement("div");
  actionHead.className = "inline-page-table-cell inline-page-table-head inline-page-table-action-head";
  actionHead.textContent = "";
  grid.appendChild(actionHead);

  table.rows.forEach((row) => {
    table.columns.forEach((column) => {
      const cell = document.createElement("div");
      cell.className = "inline-page-table-cell";

      const input = document.createElement("textarea");
      input.value = row.cells[column.id] || "";
      input.placeholder = "Vide";
      input.rows = 1;
      input.disabled = Boolean(page.deletedAt);
      input.addEventListener("focus", () => recordUndoSnapshot("Cellule modifiee", {
        coalesceKey: `inline-table-cell:${page.id}:${block.id}:${row.id}:${column.id}`,
        coalesceMs: UNDO_TEXT_COALESCE_MS,
      }));
      input.addEventListener("input", () => {
        updateInlineTableCell(page.id, block.id, row.id, column.id, input.value);
        autoGrowTextarea(input);
      });
      autoGrowTextarea(input);
      cell.appendChild(input);
      grid.appendChild(cell);
    });

    const actionCell = document.createElement("div");
    actionCell.className = "inline-page-table-cell inline-page-table-row-actions";
    const removeRow = document.createElement("button");
    removeRow.type = "button";
    removeRow.className = "inline-table-remove";
    removeRow.textContent = "x";
    removeRow.title = "Supprimer la ligne";
    removeRow.disabled = Boolean(page.deletedAt) || table.rows.length <= 1;
    removeRow.addEventListener("click", () => removeInlineTableRow(page.id, block.id, row.id));
    actionCell.appendChild(removeRow);
    grid.appendChild(actionCell);
  });

  scroll.appendChild(grid);
  shell.append(toolbar, scroll);
  return shell;
}

function isBlockDragEvent(event) {
  return Array.from(event.dataTransfer?.types || []).includes(BLOCK_DRAG_MIME);
}

function getDraggedBlockPayload(event) {
  const raw = event.dataTransfer?.getData(BLOCK_DRAG_MIME);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw);
    if (!payload?.pageId || !payload?.blockId) return null;
    return payload;
  } catch (error) {
    return null;
  }
}

function clearBlockDropHighlights() {
  document.querySelectorAll(".block-drop-before, .block-drop-after").forEach((element) => {
    element.classList.remove("block-drop-before", "block-drop-after");
  });
}

function setBlockDropState(row, placeAfter) {
  clearBlockDropHighlights();
  row.classList.toggle("block-drop-before", !placeAfter);
  row.classList.toggle("block-drop-after", placeAfter);
}

function bindBlockDragAndDrop(row, grip, page, block) {
  if (page.deletedAt) return;
  grip.draggable = true;
  grip.title = "Glisser pour deplacer le bloc";

  grip.addEventListener("dragstart", (event) => {
    hideContextMenu();
    hideSlashMenu();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(BLOCK_DRAG_MIME, JSON.stringify({ pageId: page.id, blockId: block.id }));
    event.dataTransfer.setData("text/plain", block.id);
    row.classList.add("drag-source", "block-drag-source");
  });

  grip.addEventListener("dragend", () => {
    row.classList.remove("drag-source", "block-drag-source");
    clearBlockDropHighlights();
  });

  row.addEventListener("dragover", (event) => {
    if (!isBlockDragEvent(event) || page.deletedAt) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rect = row.getBoundingClientRect();
    const placeAfter = event.clientY > rect.top + rect.height / 2;
    setBlockDropState(row, placeAfter);
  });

  row.addEventListener("dragleave", (event) => {
    if (row.contains(event.relatedTarget)) return;
    row.classList.remove("block-drop-before", "block-drop-after");
  });

  row.addEventListener("drop", (event) => {
    if (!isBlockDragEvent(event) || page.deletedAt) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = row.getBoundingClientRect();
    const payload = getDraggedBlockPayload(event);
    clearBlockDropHighlights();
    if (!payload || payload.pageId !== page.id) return;
    const placeAfter = event.clientY > rect.top + rect.height / 2;
    moveBlockToDropTarget(page.id, payload.blockId, block.id, placeAfter);
  });
}

function autoGrowTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.max(38, textarea.scrollHeight)}px`;
}

function mutateInlineTableBlock(pageId, blockId, updater, saveMessage = "Tableau modifie", shouldRender = true) {
  const page = getPage(pageId);
  if (!page || page.deletedAt) return;
  const block = page.blocks.find((candidate) => candidate.id === blockId);
  if (!block || block.type !== "table") return;
  block.table = normalizeInlineTable(block.table);
  updater(block.table, block, page);
  page.updatedAt = Date.now();
  scheduleSave(saveMessage);
  if (shouldRender) renderMain();
}

function updateInlineTableColumnName(pageId, blockId, columnId, value) {
  mutateInlineTableBlock(pageId, blockId, (table) => {
    const column = table.columns.find((candidate) => candidate.id === columnId);
    if (column) column.name = String(value || "");
  }, "Colonne modifiee", false);
}

function updateInlineTableCell(pageId, blockId, rowId, columnId, value) {
  mutateInlineTableBlock(pageId, blockId, (table) => {
    const row = table.rows.find((candidate) => candidate.id === rowId);
    if (row) row.cells[columnId] = String(value || "");
  }, "Cellule modifiee", false);
}

function addInlineTableRow(pageId, blockId) {
  updatePage(pageId, (page) => {
    const block = page.blocks.find((candidate) => candidate.id === blockId);
    if (!block || block.type !== "table") return;
    block.table = normalizeInlineTable(block.table);
    block.table.rows.push({
      id: uid("line"),
      cells: Object.fromEntries(block.table.columns.map((column) => [column.id, ""])),
    });
  }, "Ligne de tableau ajoutee");
  renderMain();
}

function addInlineTableColumn(pageId, blockId) {
  updatePage(pageId, (page) => {
    const block = page.blocks.find((candidate) => candidate.id === blockId);
    if (!block || block.type !== "table") return;
    block.table = normalizeInlineTable(block.table);
    const column = { id: uid("col"), name: `Colonne ${block.table.columns.length + 1}` };
    block.table.columns.push(column);
    block.table.rows.forEach((row) => {
      row.cells[column.id] = "";
    });
  }, "Colonne de tableau ajoutee");
  renderMain();
}

function removeInlineTableRow(pageId, blockId, rowId) {
  updatePage(pageId, (page) => {
    const block = page.blocks.find((candidate) => candidate.id === blockId);
    if (!block || block.type !== "table") return;
    block.table = normalizeInlineTable(block.table);
    if (block.table.rows.length <= 1) return;
    block.table.rows = block.table.rows.filter((row) => row.id !== rowId);
  }, "Ligne de tableau supprimee");
  renderMain();
}

function removeInlineTableColumn(pageId, blockId, columnId) {
  updatePage(pageId, (page) => {
    const block = page.blocks.find((candidate) => candidate.id === blockId);
    if (!block || block.type !== "table") return;
    block.table = normalizeInlineTable(block.table);
    if (block.table.columns.length <= 1) return;
    block.table.columns = block.table.columns.filter((column) => column.id !== columnId);
    block.table.rows.forEach((row) => {
      delete row.cells[columnId];
    });
  }, "Colonne de tableau supprimee");
  renderMain();
}

function bindDocumentImageDropZone(container, page) {
  container.addEventListener("dragover", (event) => {
    if (page.deletedAt || !hasDraggedImage(event)) return;
    event.preventDefault();
    container.classList.add("image-drop-ready");
  });

  container.addEventListener("dragleave", (event) => {
    if (!container.contains(event.relatedTarget)) {
      container.classList.remove("image-drop-ready");
    }
  });

  container.addEventListener("drop", (event) => {
    container.classList.remove("image-drop-ready");
    if (page.deletedAt || !hasDraggedImage(event)) return;
    event.preventDefault();
    const file = getFirstImageFile(event.dataTransfer?.files);
    if (!file) return;
    const hoveredRow = event.target.closest?.(".block-row");
    const afterBlockId = hoveredRow?.dataset?.blockId || ui.currentBlockId || page.blocks[page.blocks.length - 1]?.id || null;
    void insertImageBlockFromFile(page.id, file, afterBlockId);
  });
}

function bindBlockEditorEvents(page, block, editor) {
  editor.addEventListener("focus", () => {
    ui.currentBlockId = block.id;
  });

  editor.addEventListener("input", () => {
    handleBlockInput(page.id, block.id, editor);
  });

  editor.addEventListener("keydown", (event) => {
    handleBlockKeydown(event, page.id, block.id, editor);
  });
}

function hasDraggedImage(event) {
  return Array.from(event.dataTransfer?.items || []).some((item) => item.kind === "file" && item.type.startsWith("image/"));
}

function getFirstImageFile(fileList) {
  return Array.from(fileList || []).find((file) => file.type.startsWith("image/")) || null;
}

function isSpreadsheetImageValue(value) {
  return String(value || "").startsWith("data:image/");
}

async function setSpreadsheetCellImageFromFile(pageId, rowId, propertyId, file) {
  try {
    const imageData = await readFileAsImageBlockData(file);
    updateCellValue(pageId, rowId, propertyId, imageData.imageData, false);
    const page = getPage(pageId);
    if (isSpreadsheetPage(page) && page.database && getSpreadsheetRowHeight(page.database, rowId) < 96) {
      updateSpreadsheetRowHeight(pageId, rowId, 96, false);
    }
    persistNow("Image ajoutee dans la cellule");
    renderMain();
    toast("Photo ajoutee dans la cellule.");
  } catch (error) {
    toast(error.message || "Photo impossible a importer.");
  }
}

function openSpreadsheetCellImagePicker(pageId, rowId, propertyId) {
  const page = getPage(pageId);
  if (!page || page.deletedAt) return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.addEventListener("change", () => {
    const file = getFirstImageFile(input.files);
    if (file) {
      void setSpreadsheetCellImageFromFile(pageId, rowId, propertyId, file);
    }
    input.remove();
  });
  document.body.appendChild(input);
  input.click();
}

function removeSpreadsheetCellImage(pageId, rowId, propertyId) {
  updateCellValue(pageId, rowId, propertyId, "", false);
  persistNow("Image retiree de la cellule");
  renderMain();
  toast("Photo retiree.");
}

function bindSpreadsheetImageDrop(target, pageId, rowId, propertyId) {
  target.addEventListener("dragover", (event) => {
    if (getPage(pageId)?.deletedAt || !hasDraggedImage(event)) return;
    event.preventDefault();
    target.classList.add("spreadsheet-image-drop-ready");
  });
  target.addEventListener("dragleave", () => target.classList.remove("spreadsheet-image-drop-ready"));
  target.addEventListener("drop", (event) => {
    target.classList.remove("spreadsheet-image-drop-ready");
    if (getPage(pageId)?.deletedAt || !hasDraggedImage(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const file = getFirstImageFile(event.dataTransfer?.files);
    if (file) {
      void setSpreadsheetCellImageFromFile(pageId, rowId, propertyId, file);
    }
  });
}

function bindSpreadsheetImagePaste(target, pageId, rowId, propertyId) {
  target.addEventListener("paste", (event) => {
    if (getPage(pageId)?.deletedAt) return;
    const file = getFirstImageFile(Array.from(event.clipboardData?.items || [])
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter(Boolean));
    if (!file) return;
    event.preventDefault();
    void setSpreadsheetCellImageFromFile(pageId, rowId, propertyId, file);
  });
}

function readFileAsImageBlockData(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Le fichier choisi n'est pas une image."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture de l'image impossible."));
    reader.onload = () => resolve({
      imageData: String(reader.result || ""),
      imageName: file.name || "Image",
      imageType: file.type || "",
      imageSize: file.size || 0,
      imageWidth: 100,
    });
    reader.readAsDataURL(file);
  });
}

function openImagePickerForBlock(pageId, blockId) {
  const page = getPage(pageId);
  if (!page || page.deletedAt) return;

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.addEventListener("change", () => {
    const file = getFirstImageFile(input.files);
    if (file) {
      void setImageBlockFromFile(pageId, blockId, file, "Image importee");
    }
    input.remove();
  });
  document.body.appendChild(input);
  input.click();
}

async function setImageBlockFromFile(pageId, blockId, file, undoLabel = "Image importee") {
  try {
    const imageData = await readFileAsImageBlockData(file);
    updatePage(pageId, (page) => {
      const block = page.blocks.find((candidate) => candidate.id === blockId);
      if (!block) return;
      block.type = "image";
      block.text = "";
      block.checked = false;
      Object.assign(block, imageData);
    }, undoLabel);
    renderMain();
    toast("Image ajoutee.");
  } catch (error) {
    toast(error.message || "Image impossible a importer.");
  }
}

async function insertImageBlockFromFile(pageId, file, afterBlockId = null) {
  try {
    const imageData = await readFileAsImageBlockData(file);
    const blockId = afterBlockId
      ? insertBlockAfter(pageId, afterBlockId, "image", imageData)
      : appendBlock(pageId, "image", imageData);
    renderMain();
    toast("Image ajoutee.");
    return blockId;
  } catch (error) {
    toast(error.message || "Image impossible a importer.");
    return null;
  }
}

function updateImageBlockWidth(pageId, blockId, width, shouldPersist = true) {
  const page = getPage(pageId);
  if (!page) return;
  const block = page.blocks.find((candidate) => candidate.id === blockId);
  if (!block) return;
  const nextWidth = Math.max(20, Math.min(100, Math.round(Number(width) || 100)));
  block.imageWidth = nextWidth;
  page.updatedAt = Date.now();
  if (shouldPersist) scheduleSave("Image redimensionnee");
}

function bindImageResizeHandle(handle, pageId, blockId, figure) {
  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const page = getPage(pageId);
    if (!page || page.deletedAt) return;
    const container = figure.parentElement;
    if (!container) return;
    recordUndoSnapshot("Image redimensionnee", {
      coalesceKey: `image-width:${pageId}:${blockId}`,
      coalesceMs: UNDO_TEXT_COALESCE_MS,
    });
    handle.setPointerCapture(event.pointerId);

    const onMove = (moveEvent) => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(20, Math.min(100, ((moveEvent.clientX - rect.left) / rect.width) * 100));
      figure.style.width = `${width}%`;
      updateImageBlockWidth(pageId, blockId, width, false);
    };
    const onUp = (upEvent) => {
      handle.releasePointerCapture(upEvent.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      scheduleSave("Image redimensionnee");
      renderMain();
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  });
}

function handleBlockInput(pageId, blockId, editor) {
  const text = readEditorText(editor);
  const page = getPage(pageId);
  if (!page) return;

  const block = page.blocks.find((item) => item.id === blockId);
  if (!block) return;
  if (block.text !== text) {
    recordUndoSnapshot("Texte modifie", {
      coalesceKey: `block:${pageId}:${blockId}`,
      coalesceMs: UNDO_TEXT_COALESCE_MS,
    });
  }
  block.text = text;
  if (isWordPage(page)) {
    block.html = editor.innerHTML;
  }
  page.updatedAt = Date.now();
  scheduleSave();

  if (block.type === "paragraph" && maybeApplyMarkdownShortcut(pageId, blockId, text)) {
    return;
  }

  if (text.startsWith("/")) {
    showSlashMenu(blockId, editor.getBoundingClientRect(), text.slice(1).trim().toLowerCase());
  } else if (ui.slashBlockId === blockId) {
    hideSlashMenu();
  }
}

function handleBlockKeydown(event, pageId, blockId, editor) {
  const page = getPage(pageId);
  if (!page) return;
  const block = page.blocks.find((item) => item.id === blockId);
  if (!block) return;

  const isEmpty = !readEditorText(editor).trim();

  if (event.key === "Enter" && !event.shiftKey) {
    if (block.type === "code" && !event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    hideSlashMenu();

    if (isEmpty && ["bullet", "numbered", "todo", "quote", "callout", "code"].includes(block.type)) {
      updatePage(pageId, (target) => {
        const current = target.blocks.find((candidate) => candidate.id === blockId);
        if (!current) return;
        current.type = "paragraph";
        current.checked = false;
      });
      renderMain();
      focusBlockEditor(blockId);
      return;
    }

    const nextType = ["bullet", "numbered", "todo"].includes(block.type) ? block.type : "paragraph";
    const newBlockId = insertBlockAfter(pageId, blockId, nextType, nextType === "todo" ? { checked: false } : {});
    renderMain();
    focusBlockEditor(newBlockId);
    return;
  }

  if (event.key === "Backspace" && isEmpty) {
    if (page.blocks.length === 1 && block.type === "paragraph") return;
    event.preventDefault();
    hideSlashMenu();

    if (block.type !== "paragraph") {
      updatePage(pageId, (target) => {
        const current = target.blocks.find((candidate) => candidate.id === blockId);
        if (!current) return;
        current.type = "paragraph";
        current.checked = false;
        current.text = "";
      });
      renderMain();
      focusBlockEditor(blockId);
      return;
    }

    const focusTarget = removeBlock(pageId, blockId);
    renderMain();
    if (focusTarget) focusBlockEditor(focusTarget);
  }

  if (event.key === "Escape") {
    hideSlashMenu();
    hideContextMenu();
  }
}

function maybeApplyMarkdownShortcut(pageId, blockId, text) {
  const shortcuts = {
    "# ": "h1",
    "## ": "h2",
    "### ": "h3",
    "- ": "bullet",
    "* ": "bullet",
    "1. ": "numbered",
    "[] ": "todo",
    "> ": "quote",
    "! ": "callout",
    "```": "code",
    "---": "divider",
  };

  const targetType = shortcuts[text];
  if (!targetType) return false;

  updatePage(pageId, (page) => {
    const block = page.blocks.find((candidate) => candidate.id === blockId);
    if (!block) return;
    block.type = targetType;
    block.text = "";
    if (targetType === "todo") block.checked = false;
  });

  if (targetType === "divider") {
    const newBlockId = insertBlockAfter(pageId, blockId, "paragraph");
    renderMain();
    focusBlockEditor(newBlockId);
  } else {
    renderMain();
    focusBlockEditor(blockId);
  }
  return true;
}

function getBlockPlaceholder(type) {
  switch (type) {
    case "h1":
      return "Grand titre";
    case "h2":
      return "Titre de section";
    case "h3":
      return "Sous-section";
    case "quote":
      return "Citation ou message important";
    case "callout":
      return "Information utile";
    case "code":
      return "Bloc de code";
    case "table":
      return "Tableau";
    case "bullet":
      return "Element de liste";
    case "numbered":
      return "Etape numerotee";
    default:
      return "Tapez / pour les commandes...";
  }
}

function readEditorText(editor) {
  return editor.innerText.replace(/\u00a0/g, " ").replace(/\r/g, "").replace(/\n$/, "");
}

function addBlock(pageId, type = "paragraph") {
  const page = getPage(pageId);
  if (!page || page.kind !== "document") return;
  const lastBlock = page.blocks[page.blocks.length - 1];
  const blockId = lastBlock ? insertBlockAfter(pageId, lastBlock.id, type, type === "todo" ? { checked: false } : {}) : appendBlock(pageId, type);
  renderMain();
  if (type === "image") {
    openImagePickerForBlock(pageId, blockId);
    return;
  }
  focusBlockEditor(blockId);
}

function appendBlock(pageId, type = "paragraph", extra = {}) {
  const page = getPage(pageId);
  if (!page) return null;
  recordUndoSnapshot("Bloc ajoute");
  const block = createBlock(type, "", type === "todo" ? { checked: false, ...extra } : extra);
  page.blocks.push(block);
  page.updatedAt = Date.now();
  scheduleSave();
  return block.id;
}

function insertBlockAfter(pageId, blockId, type = "paragraph", extra = {}) {
  const page = getPage(pageId);
  if (!page) return null;
  const index = page.blocks.findIndex((block) => block.id === blockId);
  recordUndoSnapshot("Bloc ajoute");
  const block = createBlock(type, "", extra);
  const insertIndex = index >= 0 ? index + 1 : page.blocks.length;
  page.blocks.splice(insertIndex, 0, block);
  page.updatedAt = Date.now();
  scheduleSave();
  return block.id;
}

function removeBlock(pageId, blockId) {
  const page = getPage(pageId);
  if (!page) return null;
  const index = page.blocks.findIndex((block) => block.id === blockId);
  if (index < 0) return null;
  recordUndoSnapshot("Bloc supprime");
  const previous = page.blocks[index - 1];
  page.blocks.splice(index, 1);
  if (!page.blocks.length) page.blocks.push(createBlock("paragraph", ""));
  page.updatedAt = Date.now();
  scheduleSave();
  return previous ? previous.id : page.blocks[0].id;
}

function moveBlock(pageId, blockId, direction) {
  const page = getPage(pageId);
  if (!page) return;
  const index = page.blocks.findIndex((block) => block.id === blockId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= page.blocks.length) return;
  recordUndoSnapshot("Bloc deplace");
  const [block] = page.blocks.splice(index, 1);
  page.blocks.splice(targetIndex, 0, block);
  page.updatedAt = Date.now();
  scheduleSave();
  renderMain();
  focusBlockEditor(blockId);
}

function moveBlockToDropTarget(pageId, blockId, targetBlockId, placeAfter = false) {
  const page = getPage(pageId);
  if (!page || page.deletedAt || blockId === targetBlockId) return;
  const fromIndex = page.blocks.findIndex((candidate) => candidate.id === blockId);
  const targetIndex = page.blocks.findIndex((candidate) => candidate.id === targetBlockId);
  if (fromIndex < 0 || targetIndex < 0) return;

  let insertIndex = targetIndex + (placeAfter ? 1 : 0);
  if (fromIndex < insertIndex) insertIndex -= 1;
  insertIndex = Math.max(0, Math.min(page.blocks.length - 1, insertIndex));
  if (fromIndex === insertIndex) return;

  recordUndoSnapshot("Bloc deplace");
  const [movedBlock] = page.blocks.splice(fromIndex, 1);
  page.blocks.splice(insertIndex, 0, movedBlock);
  page.updatedAt = Date.now();
  scheduleSave();
  renderMain();
  focusBlockEditor(blockId);
}

function duplicateBlock(pageId, blockId) {
  const page = getPage(pageId);
  if (!page) return;
  const index = page.blocks.findIndex((block) => block.id === blockId);
  if (index < 0) return;
  recordUndoSnapshot("Bloc duplique");
  const clone = JSON.parse(JSON.stringify(page.blocks[index]));
  clone.id = uid("block");
  page.blocks.splice(index + 1, 0, clone);
  page.updatedAt = Date.now();
  scheduleSave();
  renderMain();
  focusBlockEditor(clone.id);
}

function setBlockType(pageId, blockId, type) {
  if (type === "table") {
    const page = getPage(pageId);
    if (!page || page.deletedAt) return;
    updatePage(pageId, (target) => {
      const block = target.blocks.find((candidate) => candidate.id === blockId);
      if (!block) return;
      block.type = "table";
      block.text = "";
      block.checked = false;
      block.table = normalizeInlineTable(block.table);
    }, "Bloc tableau");
    renderMain();
    return;
  }

  if (type === "image") {
    const page = getPage(pageId);
    if (!page || page.deletedAt) return;
    updatePage(pageId, (target) => {
      const block = target.blocks.find((candidate) => candidate.id === blockId);
      if (!block) return;
      block.type = "image";
      block.text = "";
      block.checked = false;
    }, "Bloc image");
    renderMain();
    openImagePickerForBlock(pageId, blockId);
    return;
  }

  updatePage(pageId, (page) => {
    const block = page.blocks.find((candidate) => candidate.id === blockId);
    if (!block) return;
    block.type = type;
    if (type !== "todo") block.checked = false;
  });

  if (type === "divider") {
    const newBlockId = insertBlockAfter(pageId, blockId, "paragraph");
    renderMain();
    focusBlockEditor(newBlockId);
  } else {
    renderMain();
    focusBlockEditor(blockId);
  }
}

function insertStarterBlock(pageId, type) {
  const page = getPage(pageId);
  if (!page) return;
  updatePage(pageId, (target) => {
    target.blocks[0] = createBlock(type, "");
    if (type === "todo") target.blocks[0].checked = false;
  });
  renderMain();
  focusBlockEditor(page.blocks[0].id);
}

function focusBlockEditor(blockId) {
  window.setTimeout(() => {
    const row = document.querySelector(`[data-block-id="${blockId}"] .block-editor`);
    if (!row) return;
    row.focus();
    placeCaretAtEnd(row);
  }, 30);
}

function placeCaretAtEnd(element) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function renderDatabasePage(page) {
  const shell = document.createElement("section");
  shell.className = "database-shell";
  const activeView = getActiveDatabaseView(page);
  const filteredRows = getVisibleDatabaseRows(page.database, activeView);
  const hasFilters = getDatabaseViewFilters(activeView).length > 0 || Boolean(getDatabaseViewSearchQuery(activeView));

  const toolbar = document.createElement("div");
  toolbar.className = "database-toolbar";

  const left = document.createElement("div");
  left.className = "database-toolbar-left";

  const caption = document.createElement("span");
  caption.className = "card-caption";
  caption.textContent = `${page.database.rows.length} lignes • ${page.database.properties.length} proprietes • ${page.database.views.length} vues`;

  if (hasFilters) {
    caption.textContent = `${filteredRows.length}/${page.database.rows.length} lignes â€¢ ${page.database.properties.length} proprietes â€¢ ${page.database.views.length} vues`;
  }

  const viewPill = document.createElement("span");
  viewPill.className = "database-view-pill";
  viewPill.textContent = `Vue liee: ${activeView?.name || "Table"}`;
  left.append(caption, viewPill);
  renderDatabaseViewControls(page, activeView).forEach((control) => left.appendChild(control));
  renderDatabaseFilterChips(page, activeView).forEach((chip) => left.appendChild(chip));
  renderHiddenPropertyChips(page, activeView).forEach((chip) => left.appendChild(chip));

  const right = document.createElement("div");
  right.className = "database-toolbar-right";

  const filterButton = document.createElement("button");
  filterButton.type = "button";
  filterButton.className = "inline-button";
  filterButton.textContent = "Filtrer";
  filterButton.disabled = isPageReadOnly(page) || !page.database.properties.length;
  filterButton.addEventListener("click", () => openDatabaseFilterPickerModal(page.id));

  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.className = "database-search-input";
  searchInput.placeholder = "Rechercher dans la vue...";
  searchInput.value = getDatabaseViewSearchQuery(activeView);
  let searchTimer = null;
  searchInput.addEventListener("input", () => {
    activeView.settings.searchQuery = searchInput.value;
    page.updatedAt = Date.now();
    scheduleSave("Recherche de vue mise a jour");
    clearTimeout(searchTimer);
    searchTimer = window.setTimeout(renderMain, 220);
  });

  const sortButton = document.createElement("button");
  sortButton.type = "button";
  sortButton.className = "inline-button";
  sortButton.textContent = getDatabaseViewSorts(activeView).length ? `Trier (${getDatabaseViewSorts(activeView).length})` : "Trier";
  sortButton.disabled = isPageReadOnly(page) || !page.database.properties.length;
  sortButton.addEventListener("click", () => openDatabaseSortModal(page.id));

  const addRowButton = document.createElement("button");
  addRowButton.type = "button";
  addRowButton.className = "inline-button";
  addRowButton.textContent = "+ Ligne";
  addRowButton.disabled = isPageReadOnly(page);
  addRowButton.addEventListener("click", () => addDatabaseRow(page.id));

  const addPropButton = document.createElement("button");
  addPropButton.type = "button";
  addPropButton.className = "inline-button";
  addPropButton.textContent = "+ Propriete";
  addPropButton.disabled = isPageReadOnly(page);
  addPropButton.addEventListener("click", (event) => openPropertyMenu(page.id, event.currentTarget));

  const seedButton = document.createElement("button");
  seedButton.type = "button";
  seedButton.className = "inline-button";
  seedButton.textContent = "Exemples";
  seedButton.disabled = isPageReadOnly(page);
  seedButton.addEventListener("click", () => seedDatabase(page.id));

  const aiButton = document.createElement("button");
  aiButton.type = "button";
  aiButton.className = "inline-button ai-inline-button";
  aiButton.textContent = "IA";
  aiButton.disabled = isPageReadOnly(page);
  aiButton.addEventListener("click", (event) => openDatabaseAiMenu(page.id, filteredRows, event.currentTarget));

  const projectButton = document.createElement("button");
  projectButton.type = "button";
  projectButton.className = "inline-button project-button";
  projectButton.textContent = "Projet";
  projectButton.disabled = isPageReadOnly(page);
  projectButton.addEventListener("click", () => ensureProjectManagementFields(page.id));

  const exportButton = document.createElement("button");
  exportButton.type = "button";
  exportButton.className = "inline-button";
  exportButton.textContent = "Exporter";
  exportButton.addEventListener("click", (event) => openDatabaseExportMenu(page.id, activeView?.id, event.currentTarget));

  right.append(searchInput, filterButton, sortButton, addRowButton, addPropButton, seedButton, aiButton, projectButton, exportButton);
  toolbar.append(left, right);
  shell.appendChild(toolbar);

  if (!activeView || activeView.type === "table") {
    shell.appendChild(renderTableView(page, filteredRows));
  } else if (activeView.type === "board") {
    shell.appendChild(renderBoardView(page, activeView, filteredRows));
  } else if (activeView.type === "calendar") {
    shell.appendChild(renderCalendarView(page, activeView, filteredRows));
  } else {
    shell.appendChild(renderGanttView(page, activeView, filteredRows));
  }

  return shell;
}

function createToolbarField(labelText, options, value, onChange) {
  const label = document.createElement("label");
  label.className = "toolbar-field";

  const copy = document.createElement("span");
  copy.textContent = labelText;

  const select = document.createElement("select");
  select.className = "toolbar-select";
  options.forEach(([optionValue, optionLabel]) => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionLabel;
    option.selected = optionValue === value;
    select.appendChild(option);
  });
  select.addEventListener("change", () => onChange(select.value));

  label.append(copy, select);
  return label;
}

function createToolbarDateField(labelText, value, onChange) {
  const label = document.createElement("label");
  label.className = "toolbar-field";

  const copy = document.createElement("span");
  copy.textContent = labelText;

  const input = document.createElement("input");
  input.type = "date";
  input.className = "toolbar-date-input";
  input.value = value || "";
  input.addEventListener("change", () => onChange(input.value));

  label.append(copy, input);
  return label;
}

function createToolbarButton(labelText, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "inline-button";
  button.textContent = labelText;
  button.addEventListener("click", onClick);
  return button;
}

function getDatabaseViewFilters(view) {
  return Array.isArray(view?.settings?.filters) ? view.settings.filters : [];
}

function getDatabaseViewSearchQuery(view) {
  return String(view?.settings?.searchQuery || "").trim();
}

function getDatabaseViewSorts(view) {
  return Array.isArray(view?.settings?.sorts) ? view.settings.sorts : [];
}

function databaseViewUsesProperty(view, propertyId) {
  if (!view || !propertyId) return false;
  if (getDatabaseViewSearchQuery(view)) return true;
  return getDatabaseViewFilters(view).some((filter) => filter.propertyId === propertyId)
    || getDatabaseViewSorts(view).some((sort) => sort.propertyId === propertyId);
}

function scheduleFilteredDatabaseViewRefresh(page, property, delay = 0) {
  const activeView = getActiveDatabaseView(page);
  if (!page || !property || activeView?.type !== "table") return;
  if (isSpreadsheetPage(page) || !databaseViewUsesProperty(activeView, property.id)) return;
  if (getActivePage()?.id !== page.id) return;
  if (filteredDatabaseViewRefreshTimer) window.clearTimeout(filteredDatabaseViewRefreshTimer);
  filteredDatabaseViewRefreshTimer = window.setTimeout(() => {
    filteredDatabaseViewRefreshTimer = null;
    if (getActivePage()?.id === page.id) renderMain();
  }, delay);
}

function getVisibleDatabaseRows(database, view) {
  return getSortedDatabaseRows(database, view, getFilteredDatabaseRows(database, view));
}

function getFilteredDatabaseRows(database, view) {
  const filters = getDatabaseViewFilters(view);
  const searchQuery = getDatabaseViewSearchQuery(view).toLowerCase();
  return database.rows.filter((row) => {
    if (filters.length && !rowMatchesDatabaseFilters(database, row, filters)) return false;
    if (!searchQuery) return true;
    return database.properties.some((property) => formatCellValue(row.cells[property.id], property).toLowerCase().includes(searchQuery));
  });
}

function getSortedDatabaseRows(database, view, rows) {
  const sorts = getDatabaseViewSorts(view);
  if (!sorts.length) return rows;
  return rows.slice().sort((left, right) => {
    for (const sort of sorts) {
      const property = findPropertyById(database, sort.propertyId);
      if (!property) continue;
      const result = comparePropertyValues(left.cells[property.id], right.cells[property.id], property.type);
      if (result !== 0) return sort.direction === "desc" ? -result : result;
    }
    return 0;
  });
}

function rowMatchesDatabaseFilters(database, row, filters) {
  return filters.every((filter) => {
    const property = findPropertyById(database, filter.propertyId);
    if (!property) return true;
    return rowMatchesDatabaseFilter(row, property, filter);
  });
}

function rowMatchesDatabaseFilter(row, property, filter) {
  const rawValue = row.cells[property.id];
  const filterValue = String(filter.value || "").trim();
  const operator = normalizeFilterOperator(filter.operator);
  const formattedValue = formatCellValue(rawValue, property);
  const isEmpty = !isCellFilled(rawValue);

  if (operator === "empty") return isEmpty;
  if (operator === "not_empty") return !isEmpty;
  if (operator === "checked") return Boolean(rawValue);
  if (operator === "unchecked") return !Boolean(rawValue);

  if (property.type === "multi_select") {
    const selected = parseMultiSelectValue(rawValue);
    if (operator === "contains") return selected.includes(filterValue);
    if (operator === "not_contains") return !selected.includes(filterValue);
  }

  if (property.type === "number") {
    const numberValue = Number.parseFloat(String(rawValue || "").replace(",", "."));
    const numberFilter = Number.parseFloat(filterValue.replace(",", "."));
    if (!Number.isFinite(numberValue) || !Number.isFinite(numberFilter)) return false;
    if (operator === "greater_than") return numberValue > numberFilter;
    if (operator === "less_than") return numberValue < numberFilter;
    if (operator === "not_equals") return numberValue !== numberFilter;
    return numberValue === numberFilter;
  }

  if (property.type === "date") {
    const valueDate = parseISODate(rawValue);
    const filterDate = parseISODate(filterValue);
    if (!valueDate || !filterDate) return false;
    if (operator === "before") return valueDate < filterDate;
    if (operator === "after") return valueDate > filterDate;
    if (operator === "not_equals" || operator === "is_not") return toISODate(valueDate) !== toISODate(filterDate);
    return toISODate(valueDate) === toISODate(filterDate);
  }

  if (["select", "status", "person"].includes(property.type)) {
    const value = String(rawValue || "").trim();
    if (operator === "is_not" || operator === "not_equals") return value !== filterValue;
    return value === filterValue;
  }

  const left = formattedValue.toLowerCase();
  const right = filterValue.toLowerCase();
  if (operator === "not_contains") return !left.includes(right);
  if (operator === "equals" || operator === "is") return left === right;
  if (operator === "not_equals" || operator === "is_not") return left !== right;
  return left.includes(right);
}

function filterOperatorLabel(operator) {
  const labels = {
    contains: "contient",
    not_contains: "ne contient pas",
    equals: "est egal a",
    not_equals: "est different de",
    is: "est",
    is_not: "n'est pas",
    checked: "est cochee",
    unchecked: "n'est pas cochee",
    before: "avant",
    after: "apres",
    greater_than: ">",
    less_than: "<",
    empty: "est vide",
    not_empty: "n'est pas vide",
  };
  return labels[operator] || labels.contains;
}

function renderDatabaseFilterChips(page, view) {
  const filters = getDatabaseViewFilters(view);
  if (!filters.length) return [];

  const chips = filters
    .map((filter) => {
      const property = findPropertyById(page.database, filter.propertyId);
      if (!property) return null;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "database-filter-chip";
      const valueLabel = filterNeedsValue(filter.operator)
        ? ` ${formatFilterValueLabel(property, filter.value)}`
        : "";
      chip.textContent = `${property.name} ${filterOperatorLabel(filter.operator)}${valueLabel} x`;
      chip.title = "Retirer ce filtre";
      chip.addEventListener("click", () => removeDatabaseViewFilter(page.id, view.id, filter.id));
      return chip;
    })
    .filter(Boolean);

  if (chips.length > 1) {
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "database-filter-chip clear";
    clear.textContent = "Effacer filtres";
    clear.addEventListener("click", () => clearDatabaseViewFilters(page.id, view.id));
    chips.push(clear);
  }

  return chips;
}

function renderHiddenPropertyChips(page, view) {
  const hiddenIds = view?.settings?.hiddenPropertyIds || [];
  if (!hiddenIds.length) return [];
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "database-filter-chip clear";
  chip.textContent = `${hiddenIds.length} colonne(s) masquee(s)`;
  chip.addEventListener("click", () => {
    updateDatabaseView(page.id, view.id, (settings) => {
      settings.hiddenPropertyIds = [];
    }, "Colonnes affichees");
  });
  return [chip];
}

function formatFilterValueLabel(property, value) {
  if (property.type === "person") return formatPersonValue(value) || "Sans personne";
  if (property.type === "checkbox") return value ? "Oui" : "Non";
  return String(value || "").trim() || "vide";
}

function findPropertyById(database, propertyId) {
  return database.properties.find((property) => property.id === propertyId) || null;
}

function getResolvedBoardProperty(database, view) {
  const groupProperties = getGroupableProperties(database);
  return findPropertyById(database, view?.settings?.groupByPropertyId) || groupProperties[0] || null;
}

function getResolvedCalendarProperty(database, view) {
  const dateProperties = getPropertiesByType(database, "date");
  return findPropertyById(database, view?.settings?.datePropertyId) || dateProperties[0] || null;
}

function getResolvedGanttProperties(database, view) {
  const dateProperties = getPropertiesByType(database, "date");
  return {
    startProperty: findPropertyById(database, view?.settings?.startDatePropertyId) || dateProperties[0] || null,
    endProperty: view?.settings?.endDatePropertyId
      ? findPropertyById(database, view.settings.endDatePropertyId)
      : null,
    durationProperty: findPropertyById(database, view?.settings?.durationPropertyId) || null,
  };
}

function renderDatabaseViewControls(page, view) {
  if (!view) return [];

  if (view.type === "board") {
    const selectProperties = getGroupableProperties(page.database);
    const groupProperty = getResolvedBoardProperty(page.database, view);
    if (!selectProperties.length || !groupProperty) return [];
    return [
      createToolbarField(
        "Regrouper",
        selectProperties.map((property) => [property.id, property.name]),
        groupProperty.id,
        (value) => updateDatabaseView(page.id, view.id, (settings) => { settings.groupByPropertyId = value; }, "Vue Cartes mise a jour")
      ),
    ];
  }

  if (view.type === "calendar") {
    const dateProperties = getPropertiesByType(page.database, "date");
    const dateProperty = getResolvedCalendarProperty(page.database, view);
    if (!dateProperties.length || !dateProperty) return [];
    return [
      createToolbarField(
        "Date",
        dateProperties.map((property) => [property.id, property.name]),
        dateProperty.id,
        (value) => updateDatabaseView(page.id, view.id, (settings) => { settings.datePropertyId = value; }, "Vue Calendrier mise a jour")
      ),
    ];
  }

  if (view.type === "gantt") {
    const dateProperties = getPropertiesByType(page.database, "date");
    const durationProperties = getPropertiesByType(page.database, "number");
    const { startProperty, endProperty, durationProperty } = getResolvedGanttProperties(page.database, view);
    if (!dateProperties.length || !startProperty) return [];
    const controls = [
      createToolbarField(
        "Debut",
        dateProperties.map((property) => [property.id, property.name]),
        startProperty.id,
        (value) => updateDatabaseView(page.id, view.id, (settings) => { settings.startDatePropertyId = value; }, "Vue Gantt mise a jour")
      ),
      createToolbarField(
        "Fin",
        [["", "Aucune"], ...dateProperties.filter((property) => property.id !== startProperty.id).map((property) => [property.id, property.name])],
        endProperty?.id || "",
        (value) => updateDatabaseView(page.id, view.id, (settings) => { settings.endDatePropertyId = value || null; }, "Vue Gantt mise a jour")
      ),
      createToolbarDateField(
        "Voir du",
        view.settings?.visibleStartDate || "",
        (value) => updateDatabaseView(page.id, view.id, (settings) => { settings.visibleStartDate = value || ""; }, "Periode Gantt mise a jour")
      ),
      createToolbarDateField(
        "au",
        view.settings?.visibleEndDate || "",
        (value) => updateDatabaseView(page.id, view.id, (settings) => { settings.visibleEndDate = value || ""; }, "Periode Gantt mise a jour")
      ),
      createToolbarButton("Auto", () => updateDatabaseView(page.id, view.id, (settings) => {
        settings.visibleStartDate = "";
        settings.visibleEndDate = "";
      }, "Periode Gantt automatique")),
    ];

    if (durationProperties.length) {
      controls.push(
        createToolbarField(
          "Duree",
          [["", "Aucune"], ...durationProperties.map((property) => [property.id, property.name])],
          durationProperty?.id || "",
          (value) => updateDatabaseView(page.id, view.id, (settings) => { settings.durationPropertyId = value || null; }, "Vue Gantt mise a jour")
        )
      );
    } else {
      controls.push(createToolbarButton("+ Duree", () => addGanttDurationProperty(page.id, view.id)));
    }

    if (dateProperties.length < 2) {
      controls.push(createToolbarButton("+ Date de fin", () => addGanttEndDateProperty(page.id, view.id)));
    }

    return controls;
  }

  return [];
}

function bindTableWheelToPageScroll(wrapElement) {
  wrapElement.addEventListener(
    "wheel",
    (event) => {
      if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        return;
      }

      const pageBody = elements.pageBody;
      if (!pageBody) return;

      const canScrollDown = pageBody.scrollTop + pageBody.clientHeight < pageBody.scrollHeight;
      const canScrollUp = pageBody.scrollTop > 0;
      const scrollingDown = event.deltaY > 0;
      const scrollingUp = event.deltaY < 0;

      if ((scrollingDown && canScrollDown) || (scrollingUp && canScrollUp)) {
        pageBody.scrollTop += event.deltaY;
        event.preventDefault();
      }
    },
    { passive: false }
  );
}

function renderTableView(page, rows = page.database.rows) {
  const wrap = document.createElement("div");
  wrap.className = "database-table-wrap";
  bindTableWheelToPageScroll(wrap);
  const properties = getVisibleTableProperties(page);

  const table = document.createElement("div");
  table.className = "table-shell";

  const header = document.createElement("div");
  header.className = "table-row header";
  const frozenOffsets = {};
  let frozenOffset = 0;
  properties.forEach((property) => {
    const cell = renderPropertyHeader(page, property);
    if (isPropertyFrozen(page, property.id)) {
      frozenOffsets[property.id] = frozenOffset;
      cell.style.left = `${frozenOffset}px`;
      frozenOffset += 190;
    }
    header.appendChild(cell);
  });
  const actionHead = document.createElement("div");
  actionHead.className = "table-cell";
  actionHead.textContent = "Actions";
  header.appendChild(actionHead);
  table.appendChild(header);

  rows.forEach((row) => {
    const projectInfo = getProjectRowInfo(page, row);
    const line = document.createElement("div");
    line.className = `table-row ${projectInfo.overdue ? "project-overdue-row" : ""} ${projectInfo.blocked ? "project-blocked-row" : ""}`;
    if (projectInfo.overdue) line.title = "Tache en retard";
    line.dataset.rowId = row.id;
    bindRowDragSource(line, row.id, page.deletedAt);
    bindRowDropTarget(line, page.id, row.id, page.deletedAt);
    properties.forEach((property) => {
      const cell = renderTableCell(page, row, property);
      if (isPropertyFrozen(page, property.id)) {
        cell.style.left = `${frozenOffsets[property.id] || 0}px`;
      }
      line.appendChild(cell);
    });

    const actionCell = document.createElement("div");
    actionCell.className = "table-cell";
    const actionWrap = document.createElement("div");
    actionWrap.className = "database-header-actions";

    const duplicate = document.createElement("button");
    duplicate.type = "button";
    duplicate.className = "tiny-button";
    duplicate.textContent = "⧉";
    duplicate.disabled = Boolean(page.deletedAt);
    duplicate.addEventListener("click", () => duplicateDatabaseRow(page.id, row.id));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "tiny-button";
    remove.textContent = "✕";
    remove.disabled = Boolean(page.deletedAt);
    remove.addEventListener("click", () => deleteDatabaseRow(page.id, row.id));

    actionWrap.append(duplicate, remove);
    actionCell.appendChild(actionWrap);
    line.appendChild(actionCell);
    table.appendChild(line);
  });

  wrap.appendChild(table);
  return wrap;
}

function renderPropertyHeaderLegacy(page, property) {
  const cell = document.createElement("div");
  cell.className = "table-cell";

  const stack = document.createElement("div");
  stack.className = "table-header-stack";

  const headerTop = document.createElement("div");
  headerTop.className = "property-header-top";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "property-name-input";
  nameInput.value = property.name;
  nameInput.disabled = Boolean(page.deletedAt);
  nameInput.addEventListener("input", () => {
    if (property.name !== nameInput.value) {
      recordUndoSnapshot("Nom de propriete modifie", {
        coalesceKey: `property-name:${page.id}:${property.id}`,
        coalesceMs: UNDO_TEXT_COALESCE_MS,
      });
    }
    property.name = nameInput.value;
    page.updatedAt = Date.now();
    scheduleSave();
  });

  const controlRow = document.createElement("div");
  controlRow.className = "database-header-actions";

  const typeSelect = document.createElement("select");
  PROPERTY_DEFINITIONS.forEach((definition) => {
    const option = document.createElement("option");
    option.value = definition.type;
    option.textContent = definition.label;
    option.selected = property.type === definition.type;
    typeSelect.appendChild(option);
  });
  typeSelect.disabled = Boolean(page.deletedAt);
  typeSelect.addEventListener("change", () => {
    setDatabasePropertyType(page.id, property.id, typeSelect.value);
  });

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "tiny-button";
  removeButton.textContent = "−";
  removeButton.disabled = Boolean(page.deletedAt) || page.database.properties.length <= 1;
  removeButton.addEventListener("click", () => deleteDatabaseProperty(page.id, property.id));

  controlRow.append(typeSelect, removeButton);

  if (CONFIGURABLE_PROPERTY_TYPES.includes(property.type)) {
    const configInput = document.createElement("input");
    configInput.type = "text";
    configInput.value = propertyConfigValue(property);
    configInput.placeholder = propertyConfigPlaceholder(property.type);
    configInput.disabled = Boolean(page.deletedAt);
    configInput.addEventListener("change", () => {
      recordUndoSnapshot("Options de propriete modifiees");
      property.options = parsePropertyConfig(property.type, configInput.value);
      page.updatedAt = Date.now();
      scheduleSave();
      renderMain();
    });
    stack.append(nameInput, controlRow, configInput);
  } else {
    stack.append(nameInput, controlRow);
  }

  cell.appendChild(stack);
  return cell;
}

function renderPropertyHeader(page, property) {
  const cell = document.createElement("div");
  cell.className = `table-cell property-drop-cell ${isPropertyFrozen(page, property.id) ? "frozen-property" : ""}`;
  cell.dataset.propertyId = property.id;
  bindPropertyDragSource(cell, property.id, page.deletedAt);
  bindPropertyDropTarget(cell, page.id, property.id, page.deletedAt);

  const stack = document.createElement("div");
  stack.className = "table-header-stack property-header-stack";

  const headerTop = document.createElement("div");
  headerTop.className = "property-header-top";

  const metaRow = document.createElement("div");
  metaRow.className = "property-header-meta-row";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "property-name-input";
  nameInput.value = property.name;
  nameInput.disabled = Boolean(page.deletedAt);
  nameInput.addEventListener("input", () => {
    if (property.name !== nameInput.value) {
      recordUndoSnapshot("Nom de propriete modifie", {
        coalesceKey: `property-name:${page.id}:${property.id}`,
        coalesceMs: UNDO_TEXT_COALESCE_MS,
      });
    }
    property.name = nameInput.value;
    page.updatedAt = Date.now();
    scheduleSave();
  });

  const menuButton = document.createElement("button");
  menuButton.type = "button";
  menuButton.className = "tiny-button property-menu-trigger";
  menuButton.textContent = "...";
  menuButton.disabled = Boolean(page.deletedAt);
  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    openPropertySettingsMenu(page.id, property.id, event.currentTarget);
  });

  const meta = document.createElement("span");
  meta.className = "property-type-label";
  meta.textContent = propertyTypeLabel(property.type);

  headerTop.append(nameInput);
  metaRow.append(meta, menuButton);
  stack.append(headerTop, metaRow);
  cell.appendChild(stack);
  return cell;
}

function propertyConfigValue(property) {
  return isOptionPropertyType(property.type) ? property.options.join(", ") : (property.options[0] || "");
}

function bindPropertyDragSource(cell, propertyId, disabled = false) {
  if (disabled) return;

  cell.draggable = true;
  cell.title = "Glisser la cellule pour deplacer la colonne";
  cell.addEventListener("dragstart", (event) => {
    if (isInteractiveDragTarget(event.target, { allowTextFields: true })) {
      event.preventDefault();
      return;
    }

    hideCellDetailPopover(false);
    hideContextMenu();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(TABLE_PROPERTY_DRAG_MIME, propertyId);
    event.dataTransfer.setData("text/plain", propertyId);
    cell.classList.add("drag-source");
  });
  cell.addEventListener("dragend", () => {
    cell.classList.remove("drag-source");
    clearTableDragHighlights();
  });
}

function bindRowDragSource(rowElement, rowId, disabled = false) {
  if (disabled) return;

  rowElement.draggable = true;
  rowElement.title = "Glisser la ligne pour la deplacer";
  rowElement.addEventListener("dragstart", (event) => {
    if (isInteractiveDragTarget(event.target)) {
      event.preventDefault();
      return;
    }

    hideCellDetailPopover(false);
    hideContextMenu();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(TABLE_ROW_DRAG_MIME, rowId);
    event.dataTransfer.setData("text/plain", rowId);
    rowElement.classList.add("drag-source");
  });
  rowElement.addEventListener("dragend", () => {
    rowElement.classList.remove("drag-source");
    clearTableDragHighlights();
  });
}

function bindPropertyDropTarget(cell, pageId, targetPropertyId, disabled = false) {
  if (disabled) return;

  cell.addEventListener("dragover", (event) => {
    if (!hasDragType(event, TABLE_PROPERTY_DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rect = cell.getBoundingClientRect();
    const placeAfter = event.clientX > rect.left + rect.width / 2;
    setTableDropState(cell, "property", placeAfter);
  });

  cell.addEventListener("dragleave", () => {
    clearElementDropState(cell, "property");
  });

  cell.addEventListener("drop", (event) => {
    if (!hasDragType(event, TABLE_PROPERTY_DRAG_MIME)) return;
    event.preventDefault();
    const draggedPropertyId = event.dataTransfer.getData(TABLE_PROPERTY_DRAG_MIME);
    const placeAfter = cell.classList.contains("property-drop-after");
    clearElementDropState(cell, "property");
    reorderDatabaseProperty(pageId, draggedPropertyId, targetPropertyId, placeAfter);
  });
}

function bindRowDropTarget(rowElement, pageId, targetRowId, disabled = false) {
  if (disabled) return;

  rowElement.addEventListener("dragover", (event) => {
    if (!hasDragType(event, TABLE_ROW_DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rect = rowElement.getBoundingClientRect();
    const placeAfter = event.clientY > rect.top + rect.height / 2;
    setTableDropState(rowElement, "row", placeAfter);
  });

  rowElement.addEventListener("dragleave", () => {
    clearElementDropState(rowElement, "row");
  });

  rowElement.addEventListener("drop", (event) => {
    if (!hasDragType(event, TABLE_ROW_DRAG_MIME)) return;
    event.preventDefault();
    const draggedRowId = event.dataTransfer.getData(TABLE_ROW_DRAG_MIME);
    const placeAfter = rowElement.classList.contains("row-drop-after");
    clearElementDropState(rowElement, "row");
    reorderDatabaseRow(pageId, draggedRowId, targetRowId, placeAfter);
  });
}

function hasDragType(event, type) {
  return Array.from(event.dataTransfer?.types || []).includes(type);
}

function isInteractiveDragTarget(target, options = {}) {
  const selector = options.allowTextFields
    ? "select, button, a, [contenteditable='true'], .property-menu-trigger"
    : "input, textarea, select, button, a, [contenteditable='true'], .property-menu-trigger";
  return Boolean(target?.closest?.(selector));
}

function setTableDropState(element, kind, placeAfter) {
  clearTableDropHighlights(kind);
  element.classList.add(`${kind}-drop-active`, `${kind}-drop-${placeAfter ? "after" : "before"}`);
}

function clearElementDropState(element, kind) {
  element.classList.remove(`${kind}-drop-active`, `${kind}-drop-before`, `${kind}-drop-after`);
}

function clearTableDropHighlights(kind) {
  const selector =
    kind === "property"
      ? ".property-drop-active, .property-drop-before, .property-drop-after"
      : kind === "row"
        ? ".row-drop-active, .row-drop-before, .row-drop-after"
        : ".property-drop-active, .property-drop-before, .property-drop-after, .row-drop-active, .row-drop-before, .row-drop-after";
  document.querySelectorAll(selector).forEach((element) => {
    element.classList.remove(
      "property-drop-active",
      "property-drop-before",
      "property-drop-after",
      "row-drop-active",
      "row-drop-before",
      "row-drop-after"
    );
  });
}

function clearTableDragHighlights() {
  clearTableDropHighlights();
  document.querySelectorAll(".drag-source").forEach((element) => {
    element.classList.remove("drag-source");
  });
}

function propertyConfigPlaceholder(type) {
  if (isOptionPropertyType(type)) return "Options separees par des virgules";
  if (type === "formula") return "Ex: {Prix} * {Quantite}";
  if (type === "button") return "Libelle du bouton";
  return "";
}

function parsePropertyConfig(type, value) {
  if (isOptionPropertyType(type)) {
    const options = String(value || "")
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    return options.length ? options : normalizePropertyOptions(type);
  }
  return normalizePropertyOptions(type, [value]);
}

function renderTableCell(page, row, property) {
  const cell = document.createElement("div");
  const readOnlyTypes = ["identifier", "rollup", "formula", "ai_summary", "ai_translate"];
  const locked = isPageReadOnly(page);
  cell.className = `table-cell ${isPropertyFrozen(page, property.id) ? "frozen-property" : ""} ${property.type === "checkbox" ? "table-check" : ""} ${readOnlyTypes.includes(property.type) ? "table-readonly" : ""}`;

  let input;
  if (property.type === "files") {
    cell.appendChild(renderAttachmentControl(page, row, property));
    return cell;
  } else if (["ai_summary", "ai_translate"].includes(property.type)) {
    cell.appendChild(renderAiCellControl(page, row, property));
    return cell;
  } else if (property.type === "checkbox") {
    input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(row.cells[property.id]);
    input.disabled = locked;
    input.addEventListener("change", () => updateCellValue(page.id, row.id, property.id, input.checked));
  } else if (property.type === "date") {
    input = document.createElement("input");
    input.type = "date";
    input.value = row.cells[property.id] || "";
    input.disabled = locked;
    input.addEventListener("change", () => updateCellValue(page.id, row.id, property.id, input.value));
  } else if (["select", "status"].includes(property.type)) {
    input = document.createElement("select");
    const options = property.options.length ? property.options : normalizePropertyOptions(property.type);
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "—";
    input.appendChild(empty);
    options.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      option.selected = row.cells[property.id] === value;
      input.appendChild(option);
    });
    input.disabled = locked;
    input.addEventListener("change", () => updateCellValue(page.id, row.id, property.id, input.value));
  } else if (property.type === "person") {
    queuePeopleDirectoryLoad();
    input = document.createElement("select");
    input.className = "person-select";

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "—";
    input.appendChild(empty);

    const currentValue = String(row.cells[property.id] || "").trim();
    const matchedPerson = findPersonByValue(currentValue);
    const selectedValue = matchedPerson ? matchedPerson.id : currentValue;
    const people = getPeopleOptions();

    people.forEach((person) => {
      const option = document.createElement("option");
      option.value = person.id;
      option.textContent = person.email ? `${person.displayName} (${person.email})` : person.displayName;
      option.selected = selectedValue === person.id;
      input.appendChild(option);
    });

    if (currentValue && !matchedPerson) {
      const legacy = document.createElement("option");
      legacy.value = currentValue;
      legacy.textContent = `${currentValue} (ancien)`;
      legacy.selected = true;
      input.appendChild(legacy);
    }

    input.disabled = locked;
    input.addEventListener("change", () => updateCellValue(page.id, row.id, property.id, input.value));
  } else if (property.type === "multi_select") {
    input = document.createElement("input");
    input.type = "text";
    input.value = parseMultiSelectValue(row.cells[property.id]).join(", ");
    input.placeholder = "Option 1, Option 2";
    input.disabled = locked;
    input.addEventListener("input", () => updateCellValue(page.id, row.id, property.id, parseMultiSelectValue(input.value), false));
    input.addEventListener("blur", () => persistCellInputBlur(page));
    attachCellDetailPopover(input, page, row, property);
  } else if (property.type === "button") {
    input = document.createElement("button");
    input.type = "button";
    input.className = "table-action-button";
    input.textContent = property.options[0] || "Action";
    input.disabled = locked;
    input.addEventListener("click", () => toast(`${property.name}: ${getPrimaryCellValue(page.database, row) || "ligne"}`));
  } else if (readOnlyTypes.includes(property.type)) {
    input = document.createElement("input");
    input.type = "text";
    input.value = computeReadOnlyPropertyValue(page.database, row, property);
    input.readOnly = true;
  } else {
    input = document.createElement("input");
    input.type = inputTypeForProperty(property.type);
    input.value = row.cells[property.id] || "";
    input.placeholder = inputPlaceholderForProperty(property.type);
    input.disabled = locked;
    input.addEventListener("input", () => updateCellValue(page.id, row.id, property.id, input.value, false));
    input.addEventListener("blur", () => persistCellInputBlur(page));
    if (shouldUseCellDetailPopover(property.type)) {
      attachCellDetailPopover(input, page, row, property);
    }
  }

  cell.appendChild(input);
  return cell;
}

function renderAiCellControl(page, row, property) {
  const wrap = document.createElement("div");
  wrap.className = "ai-cell-control";

  const input = document.createElement("input");
  input.type = "text";
  input.value = row.cells[property.id] || "";
  input.placeholder = property.type === "ai_translate" ? "Traduction IA..." : "Resume IA...";
  input.readOnly = true;
  attachCellDetailPopover(input, page, row, property);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "ai-cell-button";
  button.textContent = input.value ? "Regenerer" : "Generer";
  button.disabled = isPageReadOnly(page);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    void generateAiCellValue(page.id, row.id, property.id);
  });

  wrap.append(input, button);
  return wrap;
}

function renderAttachmentControl(page, row, property) {
  const wrap = document.createElement("div");
  wrap.className = "attachment-control";
  const attachments = normalizeAttachments(row.cells[property.id]);

  const list = document.createElement("div");
  list.className = "attachment-list";
  if (!attachments.length) {
    const empty = document.createElement("span");
    empty.className = "attachment-empty";
    empty.textContent = "Aucun fichier";
    list.appendChild(empty);
  }

  attachments.forEach((file) => {
    const item = document.createElement("div");
    item.className = "attachment-item";

    const link = document.createElement("a");
    link.textContent = file.name;
    link.href = file.data || file.url || "#";
    link.target = "_blank";
    link.rel = "noreferrer";
    if (file.data) link.download = file.name;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "attachment-remove";
    remove.textContent = "x";
    remove.disabled = isPageReadOnly(page);
    remove.addEventListener("click", (event) => {
      event.preventDefault();
      const next = attachments.filter((candidate) => candidate.id !== file.id);
      updateCellValue(page.id, row.id, property.id, next);
    });

    item.append(link, remove);
    list.appendChild(item);
  });

  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.disabled = isPageReadOnly(page);
  input.addEventListener("change", () => {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    Promise.all(files.map(readFileAsAttachment)).then((newFiles) => {
      updateCellValue(page.id, row.id, property.id, [...attachments, ...newFiles]);
    });
  });

  wrap.append(list, input);
  return wrap;
}

function readFileAsAttachment(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: uid("file"),
      name: file.name,
      type: file.type || "",
      size: file.size || 0,
      data: String(reader.result || ""),
      uploadedAt: Date.now(),
    });
    reader.readAsDataURL(file);
  });
}

function shouldUseCellDetailPopover(type) {
  return ["text", "files", "relation", "location", "url", "phone", "email"].includes(type);
}

function attachCellDetailPopover(input, page, row, property) {
  if (page.deletedAt) return;
  input.addEventListener("click", (event) => {
    event.stopPropagation();
    openCellDetailPopover(input, page, row, property);
  });
}

function persistCellInputBlur(page) {
  if (ui.cellDetailPopover?.element) return;
  persistAndRefreshComputedProperties(page);
}

function openCellDetailPopover(anchor, page, row, property) {
  hideCellDetailPopover(false);

  const popover = document.createElement("div");
  popover.className = "cell-detail-popover";

  const header = document.createElement("div");
  header.className = "cell-detail-header";

  const title = document.createElement("span");
  title.textContent = property.name || defaultPropertyName(property.type);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "tiny-button";
  closeButton.textContent = "x";
  closeButton.addEventListener("click", () => hideCellDetailPopover(true));

  header.append(title, closeButton);

  const textarea = document.createElement("textarea");
  textarea.className = "cell-detail-textarea";
  textarea.value = formatEditableCellValue(row.cells[property.id], property.type);
  textarea.placeholder = inputPlaceholderForProperty(property.type) || "Saisir le contenu...";
  textarea.addEventListener("input", () => {
    const nextValue = property.type === "multi_select" ? parseMultiSelectValue(textarea.value) : textarea.value;
    updateCellValue(page.id, row.id, property.id, nextValue, false);
    anchor.value = formatEditableCellValue(row.cells[property.id], property.type);
  });
  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      hideCellDetailPopover(true);
      anchor.focus();
    }
  });

  popover.append(header, textarea);
  document.body.appendChild(popover);
  ui.cellDetailPopover = { element: popover, pageId: page.id };

  const rect = anchor.getBoundingClientRect();
  positionCellDetailPopover(popover, rect);
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}

function formatEditableCellValue(value, type) {
  if (type === "multi_select") return parseMultiSelectValue(value).join(", ");
  return String(value || "");
}

function positionCellDetailPopover(popover, rect) {
  const padding = 14;
  const width = Math.min(Math.max(rect.width + 110, 320), Math.min(560, window.innerWidth - padding * 2));
  popover.style.width = `${width}px`;

  const measuredHeight = popover.offsetHeight || 220;
  const x = Math.min(Math.max(padding, rect.left), window.innerWidth - width - padding);
  const belowY = rect.bottom + 8;
  const aboveY = rect.top - measuredHeight - 8;
  const y = belowY + measuredHeight <= window.innerHeight - padding ? belowY : Math.max(padding, aboveY);

  popover.style.left = `${x}px`;
  popover.style.top = `${y}px`;
}

function hideCellDetailPopover(persist = true) {
  if (!ui.cellDetailPopover?.element) return;
  const page = ui.cellDetailPopover.pageId ? getPage(ui.cellDetailPopover.pageId) : null;
  ui.cellDetailPopover.element.remove();
  ui.cellDetailPopover = null;
  if (persist && page?.database) persistAndRefreshComputedProperties(page);
}

function inputTypeForProperty(type) {
  if (type === "number") return "number";
  if (type === "url") return "url";
  if (type === "email") return "email";
  if (type === "phone") return "tel";
  return "text";
}

function inputPlaceholderForProperty(type) {
  const placeholders = {
    person: "Nom ou email",
    files: "Lien ou nom de fichier",
    relation: "Page liee",
    location: "Adresse ou lieu",
    url: "https://...",
    phone: "+33...",
    email: "nom@domaine.com",
  };
  return placeholders[type] || "";
}

function computeReadOnlyPropertyValue(database, row, property) {
  if (property.type === "identifier") return getRowIdentifier(row);
  if (property.type === "rollup") return `${countFilledCells(database, row, property.id)} champs`;
  if (property.type === "formula") return computeFormulaValue(database, row, property);
  if (property.type === "ai_summary") return row.cells[property.id] || summarizeRowValues(database, row, property.id);
  if (property.type === "ai_translate") return row.cells[property.id] || "";
  return "";
}

function getRowIdentifier(row) {
  return row.id.replace(/^row-/, "").split("-").slice(0, 2).join("-").toUpperCase();
}

function countFilledCells(database, row, excludedPropertyId = null) {
  return database.properties.filter((property) => property.id !== excludedPropertyId && isCellFilled(row.cells[property.id])).length;
}

function isCellFilled(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return value;
  return String(value || "").trim().length > 0;
}

function summarizeRowValues(database, row, excludedPropertyId = null) {
  const values = database.properties
    .filter((property) => property.id !== excludedPropertyId && !["button", "formula", "rollup", "identifier", "ai_summary", "ai_translate"].includes(property.type))
    .map((property) => formatCellValue(row.cells[property.id], property))
    .filter(Boolean);
  return truncate(values.join(" | "), 90);
}

function formatCellValue(value, property = null) {
  if (property?.type === "person") return formatPersonValue(value);
  if (property?.type === "files") {
    return normalizeAttachments(value).map((file) => file.name).join(", ");
  }
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Oui" : "";
  return String(value || "").trim();
}

function computeFormulaValue(database, row, property) {
  const formula = property.options[0] || "";
  if (!formula.trim()) return "";
  let expression = formula;
  database.properties.forEach((candidate) => {
    if (candidate.id === property.id) return;
    const numericValue = Number.parseFloat(row.cells[candidate.id]);
    expression = expression.replace(new RegExp(`\\{${escapeRegExp(candidate.name)}\\}`, "g"), Number.isFinite(numericValue) ? String(numericValue) : "0");
  });
  if (!/^[\d+\-*/().\s]+$/.test(expression)) return "";
  try {
    const result = Function(`"use strict"; return (${expression});`)();
    return Number.isFinite(result) ? String(Math.round(result * 100) / 100) : "";
  } catch (error) {
    return "";
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderBoardView(page, view, rows = page.database.rows) {
  const selectProperty = getResolvedBoardProperty(page.database, view);
  if (!selectProperty) {
    return renderViewNotice(
      "La vue Cartes a besoin d'une propriete Selection, Selection multiple ou Etat.",
      "Creer une propriete Etat",
      () => addDatabaseProperty(page.id, "status")
    );
  }

  const dateProperty = getFirstPropertyByType(page.database, "date");
  const columns = [...(selectProperty.options.length ? selectProperty.options : normalizePropertyOptions(selectProperty.type)), "Sans statut"];
  const board = document.createElement("div");
  board.className = "board-grid";

  columns.forEach((column) => {
    const columnElement = document.createElement("section");
    columnElement.className = "board-column";
    columnElement.dataset.status = column;

    columnElement.addEventListener("dragover", (event) => {
      event.preventDefault();
      columnElement.classList.add("drop-active");
    });
    columnElement.addEventListener("dragleave", () => columnElement.classList.remove("drop-active"));
    columnElement.addEventListener("drop", (event) => {
      event.preventDefault();
      columnElement.classList.remove("drop-active");
      const rowId = event.dataTransfer.getData("text/row-id");
      updateCellValue(
        page.id,
        rowId,
        selectProperty.id,
        selectProperty.type === "multi_select" ? (column === "Sans statut" ? [] : [column]) : (column === "Sans statut" ? "" : column)
      );
      renderMain();
    });

    const header = document.createElement("div");
    header.className = "board-column-header";

    const title = document.createElement("div");
    title.className = "board-column-title";
    title.textContent = column;

    const count = document.createElement("span");
    const items = rows.filter((row) => rowMatchesBoardColumn(row, selectProperty, column));
    count.className = "board-column-count";
    count.textContent = `${items.length}`;

    header.append(title, count);

    const list = document.createElement("div");
    list.className = "board-card-list";

    items.forEach((row) => {
      const projectInfo = getProjectRowInfo(page, row);
      const card = document.createElement("article");
      card.className = "board-card";
      if (projectInfo.overdue) card.classList.add("project-overdue-card");
      if (projectInfo.blocked) card.classList.add("project-blocked-card");
      card.dataset.rowId = row.id;
      card.draggable = !isPageReadOnly(page);
      card.addEventListener("dragstart", (event) => {
        card.dataset.dragging = "true";
        event.dataTransfer.setData("text/row-id", row.id);
      });
      card.addEventListener("dragend", () => {
        window.setTimeout(() => {
          delete card.dataset.dragging;
        }, 120);
      });
      card.addEventListener("click", () => {
        if (card.dataset.dragging === "true") return;
        openBoardCardModal(page.id, row.id);
      });

      const heading = document.createElement("strong");
      heading.textContent = getPrimaryCellValue(page.database, row) || "Sans titre";

      const meta = document.createElement("div");
      meta.className = "board-card-meta";
      if (dateProperty && row.cells[dateProperty.id]) {
        const due = document.createElement("span");
        due.textContent = `Date ${row.cells[dateProperty.id]}`;
        meta.appendChild(due);
      }
      const primaryProperty = page.database.properties.find((property) => property.type === "text") || page.database.properties[0];
      const supportTextProperty = page.database.properties.find((property) => property.type === "text" && property.id !== primaryProperty?.id && row.cells[property.id]);
      if (supportTextProperty) {
        const note = document.createElement("span");
        note.textContent = truncate(String(row.cells[supportTextProperty.id]), 42);
        meta.appendChild(note);
      }
      const badges = renderProjectBadges(projectInfo);
      if (badges) meta.appendChild(badges);

      card.append(heading, meta);
      list.appendChild(card);
    });

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "inline-button";
    addButton.textContent = "+ Ajouter une carte";
    addButton.disabled = isPageReadOnly(page);
    addButton.addEventListener("click", () => addDatabaseRow(page.id, {
      [selectProperty.name]: selectProperty.type === "multi_select" ? (column === "Sans statut" ? [] : [column]) : (column === "Sans statut" ? "" : column),
    }));

    columnElement.append(header, list, addButton);
    board.appendChild(columnElement);
  });

  return board;
}

function rowMatchesBoardColumn(row, property, column) {
  if (property.type === "multi_select") {
    const selected = parseMultiSelectValue(row.cells[property.id]);
    return column === "Sans statut" ? !selected.length : selected.includes(column);
  }
  const value = row.cells[property.id] || "";
  return column === "Sans statut" ? !value : value === column;
}

function openBoardCardModal(pageId, rowId) {
  const page = getPage(pageId);
  const row = page?.database?.rows.find((candidate) => candidate.id === rowId);
  if (!page || !row) return;

  openModal({
    kicker: "Carte",
    title: getPrimaryCellValue(page.database, row) || "Sans titre",
    contentBuilder: () => {
      const panel = document.createElement("div");
      panel.className = "board-card-editor";

      const summary = document.createElement("div");
      summary.className = "board-card-editor-summary";

      const icon = document.createElement("span");
      icon.textContent = page.icon || "\u{1F5C2}";

      const copy = document.createElement("div");
      const heading = document.createElement("strong");
      heading.textContent = getPrimaryCellValue(page.database, row) || "Sans titre";
      const hint = document.createElement("span");
      hint.textContent = "Modifiez les proprietes de cette carte. Les changements sont sauvegardes automatiquement.";
      copy.append(heading, hint);
      summary.append(icon, copy);

      const fields = document.createElement("div");
      fields.className = "board-card-editor-grid";

      page.database.properties.forEach((property) => {
        fields.appendChild(renderBoardCardEditorField(page, row, property));
      });

      const comments = renderRowCommentsPanel(page, row);

      const actions = document.createElement("div");
      actions.className = "modal-actions";

      const duplicate = document.createElement("button");
      duplicate.type = "button";
      duplicate.className = "inline-button";
      duplicate.textContent = "Dupliquer";
      duplicate.disabled = Boolean(page.deletedAt);
      duplicate.addEventListener("click", () => {
        duplicateDatabaseRow(page.id, row.id);
        closeModal();
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "inline-button danger";
      remove.textContent = "Supprimer";
      remove.disabled = Boolean(page.deletedAt);
      remove.addEventListener("click", () => {
        deleteDatabaseRow(page.id, row.id);
        closeModal();
      });

      const close = document.createElement("button");
      close.type = "button";
      close.className = "inline-button";
      close.textContent = "Fermer";
      close.addEventListener("click", closeModal);

      actions.append(duplicate, remove, close);
      panel.append(summary, fields, comments, actions);
      return panel;
    },
  });
}

function renderRowCommentsPanel(page, row) {
  const section = document.createElement("section");
  section.className = "comments-panel";

  const title = document.createElement("h3");
  title.textContent = `Commentaires (${row.comments?.length || 0})`;

  const list = document.createElement("div");
  list.className = "comments-list";
  const comments = normalizeRowComments(row.comments);
  if (!comments.length) {
    const empty = document.createElement("div");
    empty.className = "comment-empty";
    empty.textContent = "Aucun commentaire pour cette carte.";
    list.appendChild(empty);
  }

  comments.forEach((comment) => {
    const item = document.createElement("article");
    item.className = "comment-item";
    const meta = document.createElement("div");
    meta.className = "comment-meta";
    meta.textContent = `${comment.authorName} - ${formatRelative(comment.createdAt)}`;
    const text = document.createElement("p");
    text.textContent = comment.text;
    item.append(meta, text);
    list.appendChild(item);
  });

  const form = document.createElement("form");
  form.className = "comment-form";
  const input = document.createElement("textarea");
  input.placeholder = "Ajouter un commentaire...";
  input.disabled = isPageReadOnly(page);
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "inline-button";
  submit.textContent = "Commenter";
  submit.disabled = isPageReadOnly(page);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    addRowComment(page.id, row.id, text);
    closeModal();
    openBoardCardModal(page.id, row.id);
  });
  form.append(input, submit);
  section.append(title, list, form);
  return section;
}

function addRowComment(pageId, rowId, text) {
  updatePage(pageId, (page) => {
    const row = page.database?.rows.find((candidate) => candidate.id === rowId);
    if (!row) return;
    row.comments = normalizeRowComments(row.comments);
    row.comments.push({
      id: uid("comment"),
      authorId: authState.user?.id || null,
      authorName: authState.user?.displayName || "Utilisateur",
      text,
      createdAt: Date.now(),
    });
  }, "Commentaire ajoute");
  addNotification({
    type: "comment",
    title: "Nouveau commentaire",
    body: text,
    pageId,
    rowId,
  });
  renderMain();
}

function renderBoardCardEditorField(page, row, property) {
  const field = document.createElement("label");
  field.className = "board-card-editor-field";

  const header = document.createElement("span");
  header.className = "board-card-editor-label";

  const name = document.createElement("strong");
  name.textContent = property.name || defaultPropertyName(property.type);

  const type = document.createElement("small");
  type.textContent = propertyTypeLabel(property.type);

  header.append(name, type);

  const control = renderTableCell(page, row, property);
  control.classList.add("board-card-editor-control");

  field.append(header, control);
  return field;
}

function renderCalendarView(page, view, rows = page.database.rows) {
  const dateProperty = getResolvedCalendarProperty(page.database, view);
  if (!dateProperty) {
    return renderViewNotice(
      "La vue Calendrier a besoin d'une propriete date.",
      "Creer une propriete Date",
      () => addDatabaseProperty(page.id, "date")
    );
  }

  const calendar = document.createElement("div");
  const toolbar = document.createElement("div");
  toolbar.className = "calendar-toolbar";

  const left = document.createElement("div");
  left.className = "database-toolbar-left";

  const monthLabel = document.createElement("div");
  monthLabel.className = "calendar-month";
  const baseDate = parseISODate(view?.settings?.month) || new Date();
  monthLabel.textContent = formatMonth(baseDate);

  left.appendChild(monthLabel);

  const right = document.createElement("div");
  right.className = "database-toolbar-right";

  [
    ["←", () => shiftCalendarMonth(page.id, -1)],
    ["Aujourd'hui", () => setCalendarMonthToToday(page.id)],
    ["→", () => shiftCalendarMonth(page.id, 1)],
  ].forEach(([label, action]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "inline-button";
    button.textContent = label;
    button.disabled = Boolean(page.deletedAt) && label !== "Aujourd'hui";
    button.addEventListener("click", action);
    right.appendChild(button);
  });

  toolbar.append(left, right);

  const header = document.createElement("div");
  header.className = "calendar-grid-header";
  ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].forEach((day) => {
    const cell = document.createElement("span");
    cell.textContent = day;
    header.appendChild(cell);
  });

  const grid = document.createElement("div");
  grid.className = "calendar-grid";
  const monthStart = firstDayOfMonth(baseDate);
  const gridStart = startOfCalendarGrid(monthStart);
  const todayIso = toISODate(new Date());

  for (let offset = 0; offset < 42; offset += 1) {
    const currentDate = new Date(gridStart);
    currentDate.setDate(gridStart.getDate() + offset);
    const iso = toISODate(currentDate);
    const cell = document.createElement("div");
    cell.className = "calendar-cell";
    cell.dataset.calendarDate = iso;
    if (currentDate.getMonth() !== monthStart.getMonth()) cell.classList.add("outside");
    if (iso === todayIso) cell.classList.add("today");
    if (!page.deletedAt) {
      cell.addEventListener("dragover", (event) => {
        if (!event.dataTransfer.types.includes("application/x-flowcean-calendar-row")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        cell.classList.add("calendar-cell-drop-target");
      });
      cell.addEventListener("dragleave", (event) => {
        if (!cell.contains(event.relatedTarget)) {
          cell.classList.remove("calendar-cell-drop-target");
        }
      });
      cell.addEventListener("drop", (event) => {
        const rowId = event.dataTransfer.getData("application/x-flowcean-calendar-row");
        if (!rowId) return;
        event.preventDefault();
        cell.classList.remove("calendar-cell-drop-target");
        moveCalendarRowToDate(page.id, rowId, dateProperty.id, iso);
      });
    }

    const head = document.createElement("div");
    head.className = "calendar-cell-head";

    const dayLabel = document.createElement("strong");
    dayLabel.textContent = `${currentDate.getDate()}`;

    const counter = document.createElement("span");
    counter.className = "calendar-chip";
    const dayRows = rows.filter((row) => row.cells[dateProperty.id] === iso);
    counter.textContent = `${dayRows.length}`;

    head.append(dayLabel, counter);

    const list = document.createElement("div");
    list.className = "calendar-card-list";
    dayRows.slice(0, 4).forEach((row) => {
      const projectInfo = getProjectRowInfo(page, row);
      const item = document.createElement("div");
      item.className = "calendar-card";
      item.draggable = !page.deletedAt;
      item.dataset.rowId = row.id;
      if (projectInfo.overdue) item.classList.add("project-overdue-card");
      if (projectInfo.blocked) item.classList.add("project-blocked-card");
      item.addEventListener("dragstart", (event) => {
        if (page.deletedAt) return;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("application/x-flowcean-calendar-row", row.id);
        event.dataTransfer.setData("text/plain", row.id);
        item.classList.add("calendar-card-dragging");
      });
      item.addEventListener("dragend", () => {
        item.classList.remove("calendar-card-dragging");
        document.querySelectorAll(".calendar-cell-drop-target").forEach((target) => {
          target.classList.remove("calendar-cell-drop-target");
        });
      });
      item.addEventListener("click", () => openBoardCardModal(page.id, row.id));
      const title = document.createElement("strong");
      title.textContent = getPrimaryCellValue(page.database, row) || "Sans titre";
      const meta = document.createElement("small");
      meta.textContent = getSecondaryCalendarMeta(page.database, row, dateProperty.id);
      item.append(title, meta);
      const badges = renderProjectBadges(projectInfo);
      if (badges) item.appendChild(badges);
      list.appendChild(item);
    });

    if (dayRows.length > 4) {
      const more = document.createElement("small");
      more.textContent = `+${dayRows.length - 4} autres`;
      list.appendChild(more);
    }

    cell.append(head, list);
    grid.appendChild(cell);
  }

  calendar.append(toolbar, header, grid);
  return calendar;
}

function renderGanttView(page, view, rows = page.database.rows) {
  const { startProperty, endProperty, durationProperty } = getResolvedGanttProperties(page.database, view);
  if (!startProperty) {
    return renderViewNotice(
      "La vue Gantt a besoin d'au moins une propriete Date.",
      "Creer une propriete Date",
      () => addDatabaseProperty(page.id, "date")
    );
  }

  const selectProperty = getResolvedBoardProperty(page.database, { settings: { groupByPropertyId: view?.settings?.groupByPropertyId } });
  const tasks = rows
    .map((row) => {
      const startDate = parseISODate(row.cells[startProperty.id]);
      if (!startDate) return null;
      const explicitEndDate = endProperty ? parseISODate(row.cells[endProperty.id]) : null;
      const durationDays = durationProperty ? parseDurationDays(row.cells[durationProperty.id]) : null;
      const endDate = explicitEndDate || (durationDays ? addDays(startDate, durationDays - 1) : startDate);
      const safeEnd = endDate < startDate ? startDate : endDate;
      const safeDuration = Math.max(1, diffInDays(safeEnd, startDate) + 1);
      const projectInfo = getProjectRowInfo(page, row);
      return {
        rowId: row.id,
        title: getPrimaryCellValue(page.database, row) || "Sans titre",
        startDate,
        endDate: safeEnd,
        durationDays: safeDuration,
        durationSource: explicitEndDate ? "end" : (durationDays ? "duration" : "single"),
        status: selectProperty ? row.cells[selectProperty.id] || "" : "",
        projectInfo,
      };
    })
    .filter(Boolean)
    .sort((leftTask, rightTask) => leftTask.startDate - rightTask.startDate);

  if (!tasks.length) {
    if (getDatabaseViewFilters(view).length) {
      return renderViewNotice(
        "Aucune ligne ne correspond aux filtres de cette vue.",
        "Effacer les filtres",
        () => clearDatabaseViewFilters(page.id, view.id)
      );
    }
    return renderViewNotice(
      "Ajoutez des dates aux lignes pour afficher le Gantt.",
      "Ajouter une ligne",
      () => addDatabaseRow(page.id)
    );
  }

  let rangeStart = tasks[0].startDate;
  let rangeEnd = tasks[0].endDate;
  tasks.forEach((task) => {
    if (task.startDate < rangeStart) rangeStart = task.startDate;
    if (task.endDate > rangeEnd) rangeEnd = task.endDate;
  });
  const customRangeStart = parseISODate(view?.settings?.visibleStartDate);
  const customRangeEnd = parseISODate(view?.settings?.visibleEndDate);
  const hasCustomRange = Boolean(customRangeStart || customRangeEnd);
  if (hasCustomRange) {
    rangeStart = customRangeStart || rangeStart;
    rangeEnd = customRangeEnd || rangeEnd;
    if (rangeEnd < rangeStart) {
      rangeEnd = rangeStart;
    }
  } else {
    rangeStart = addDays(rangeStart, -1);
    rangeEnd = addDays(rangeEnd, 1);
  }
  const visibleTasks = tasks.filter((task) => task.endDate >= rangeStart && task.startDate <= rangeEnd);
  if (!visibleTasks.length && hasCustomRange) {
    return renderViewNotice(
      "Aucune ligne ne tombe dans cette portion de dates.",
      "Revenir en auto",
      () => updateDatabaseView(page.id, view.id, (settings) => {
        settings.visibleStartDate = "";
        settings.visibleEndDate = "";
      }, "Periode Gantt automatique")
    );
  }
  const dayCount = hasCustomRange
    ? Math.max(1, diffInDays(rangeEnd, rangeStart) + 1)
    : Math.max(7, diffInDays(rangeEnd, rangeStart) + 1);
  const todayOffset = diffInDays(stripTime(new Date()), rangeStart);
  const ganttSideWidth = 280;
  const ganttDayWidth = 52;
  const ganttTimelineWidth = dayCount * ganttDayWidth;
  const ganttRowWidth = ganttSideWidth + ganttTimelineWidth;
  const ganttGridTemplate = `${ganttSideWidth}px minmax(${ganttTimelineWidth}px, 1fr)`;

  const shell = document.createElement("div");
  shell.className = "gantt-shell";

  const scroll = document.createElement("div");
  scroll.className = "gantt-scroll";

  const headerRow = document.createElement("div");
  headerRow.className = "gantt-row gantt-row-header";
  headerRow.style.gridTemplateColumns = ganttGridTemplate;
  headerRow.style.width = `max(100%, ${ganttRowWidth}px)`;

  const headerSide = document.createElement("div");
  headerSide.className = "gantt-side gantt-side-header";
  headerSide.textContent = "Elements";

  const timelineHeader = document.createElement("div");
  timelineHeader.className = "gantt-timeline-header";
  timelineHeader.style.gridTemplateColumns = `repeat(${dayCount}, minmax(${ganttDayWidth}px, 1fr))`;

  for (let index = 0; index < dayCount; index += 1) {
    const currentDate = addDays(rangeStart, index);
    const day = document.createElement("span");
    day.className = `gantt-day ${toISODate(currentDate) === toISODate(new Date()) ? "today" : ""}`;
    day.textContent = currentDate.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    timelineHeader.appendChild(day);
  }

  headerRow.append(headerSide, timelineHeader);
  scroll.appendChild(headerRow);

  visibleTasks.forEach((task) => {
    const row = document.createElement("div");
    row.className = "gantt-row";
    row.style.gridTemplateColumns = ganttGridTemplate;
    row.style.width = `max(100%, ${ganttRowWidth}px)`;

    const side = document.createElement("div");
    side.className = "gantt-side";

    const title = document.createElement("strong");
    title.textContent = task.title;

    const meta = document.createElement("span");
    const dateLabel = task.startDate.getTime() === task.endDate.getTime()
      ? toISODate(task.startDate)
      : `${toISODate(task.startDate)} → ${toISODate(task.endDate)}`;
    meta.textContent = task.status ? `${task.status} • ${dateLabel}` : dateLabel;
    const durationLabel = task.durationDays > 1 ? `${task.durationDays} j` : "1 j";
    const details = task.durationSource === "duration"
      ? `${dateLabel} * ${durationLabel}`
      : dateLabel;
    meta.textContent = task.status ? `${task.status} * ${details}` : details;
    if (task.projectInfo.dependencyText) {
      meta.textContent += ` * depend de ${truncate(task.projectInfo.dependencyText, 34)}`;
    }
    side.append(title, meta);

    const track = document.createElement("div");
    track.className = "gantt-track";
    track.style.backgroundSize = `calc(100% / ${dayCount}) 100%`;

    if (todayOffset >= 0 && todayOffset < dayCount) {
      const todayMarker = document.createElement("div");
      todayMarker.className = "gantt-today-marker";
      todayMarker.style.left = `calc(${todayOffset} * (100% / ${dayCount}))`;
      track.appendChild(todayMarker);
    }

    const visibleStart = task.startDate < rangeStart ? rangeStart : task.startDate;
    const visibleEnd = task.endDate > rangeEnd ? rangeEnd : task.endDate;
    const startOffset = diffInDays(visibleStart, rangeStart);
    const duration = Math.max(1, diffInDays(visibleEnd, visibleStart) + 1);
    const bar = document.createElement("div");
    bar.className = `gantt-bar ${duration === 1 ? "milestone" : ""}`;
    if (task.projectInfo.overdue) bar.classList.add("project-overdue-bar");
    if (task.projectInfo.blocked) bar.classList.add("project-blocked-bar");
    bar.style.left = `calc(${startOffset} * (100% / ${dayCount}) + 6px)`;
    bar.style.width = `max(18px, calc(${duration} * (100% / ${dayCount}) - 12px))`;
    bar.textContent = task.title;
    bar.addEventListener("click", () => openBoardCardModal(page.id, task.rowId));
    track.appendChild(bar);

    row.append(side, track);
    scroll.appendChild(row);
  });

  shell.appendChild(scroll);
  return shell;
}

function renderViewNotice(text, buttonLabel, action) {
  const card = document.createElement("section");
  card.className = "empty-state";
  const title = document.createElement("h3");
  title.textContent = "Vue incomplete";
  const body = document.createElement("p");
  body.textContent = text;
  const actions = document.createElement("div");
  actions.className = "quick-action-grid";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "card-button primary";
  button.textContent = buttonLabel;
  button.addEventListener("click", action);
  actions.appendChild(button);
  card.append(title, body, actions);
  return card;
}

function renderInspector(page) {
  elements.inspector.innerHTML = "";

  const statsCard = document.createElement("section");
  statsCard.className = "inspector-card";

  const statsHeader = document.createElement("div");
  statsHeader.className = "inspector-card-header";
  const statsTitle = document.createElement("h3");
  statsTitle.textContent = "Resume";
  statsHeader.appendChild(statsTitle);

  const statsGrid = document.createElement("div");
  statsGrid.className = "stats-grid";
  getStats(page).forEach((stat) => {
    const statCard = document.createElement("div");
    statCard.className = "stat-card";
    const value = document.createElement("strong");
    value.textContent = stat.value;
    const label = document.createElement("span");
    label.textContent = stat.label;
    statCard.append(value, label);
    statsGrid.appendChild(statCard);
  });
  statsCard.append(statsHeader, statsGrid);

  const actionsCard = document.createElement("section");
  actionsCard.className = "inspector-card";
  const actionsTitle = document.createElement("h3");
  actionsTitle.textContent = "Actions rapides";
  const actionsText = document.createElement("p");
  actionsText.textContent = "Dupliquez, exportez ou faites evoluer votre espace local en quelques clics.";
  const actionsList = document.createElement("div");
  actionsList.className = "inspector-list";

  [
    ["Dupliquer la page", () => duplicatePage(page.id)],
    ["Ajouter page, Word, Excel ou tableau", () => openCreatePageModal(page.id)],
    ["Voir l'historique", openHistoryModal],
    ...(page.kind === "document" ? [["Exporter la page en PDF", () => exportDocumentPagePdf(page.id)]] : []),
    ...(isSpreadsheetPage(page) ? [
      ["Importer XLSX", () => openSpreadsheetXlsxImport(page.id)],
      ["Exporter XLSX", () => { void exportSpreadsheetXlsx(page.id); }],
    ] : []),
    ...(page.kind === "database" && !isSpreadsheetPage(page) ? [["Activer le pilotage projet", () => ensureProjectManagementFields(page.id)], ["Voir mes taches", openMyTasksModal]] : []),
    ["Exporter le workspace", exportWorkspace],
    [page.deletedAt ? "Restaurer la page" : "Envoyer a la corbeille", () => (page.deletedAt ? restorePage(page.id) : movePageToTrash(page.id))],
    ...(page.deletedAt ? [["Supprimer definitivement", () => permanentlyDeletePage(page.id)]] : []),
  ].forEach(([label, action]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = label === "Supprimer definitivement" ? "inline-button danger" : "inline-button";
    button.textContent = label;
    button.addEventListener("click", action);
    actionsList.appendChild(button);
  });
  actionsCard.append(actionsTitle, actionsText, actionsList);

  const helpCard = document.createElement("section");
  helpCard.className = "inspector-card";
  const helpTitle = document.createElement("h3");
  helpTitle.textContent = "Raccourcis";
  const helpText = document.createElement("p");
  helpText.textContent = "Ctrl/Cmd + Z pour annuler, Ctrl/Cmd + Y pour retablir, Ctrl/Cmd + K pour rechercher, / dans un bloc pour changer son type, glisser-deposer pour les cartes.";
  helpCard.append(helpTitle, helpText);

  const notificationCard = document.createElement("section");
  notificationCard.className = "inspector-card";
  const notificationTitle = document.createElement("h3");
  notificationTitle.textContent = "Notifications";
  const notificationText = document.createElement("p");
  const unread = unreadNotificationCount();
  notificationText.textContent = unread ? `${unread} notification(s) non lue(s).` : "Aucune notification non lue.";
  const notificationButton = document.createElement("button");
  notificationButton.type = "button";
  notificationButton.className = "inline-button";
  notificationButton.textContent = "Ouvrir les notifications";
  notificationButton.addEventListener("click", () => { void openNotificationsModal(); });
  notificationCard.append(notificationTitle, notificationText, notificationButton);

  elements.inspector.append(statsCard, actionsCard, notificationCard, helpCard);
}

function getStats(page) {
  if (page.kind === "database") {
    if (isSpreadsheetPage(page)) {
      ensureSpreadsheetWorkbook(page);
      const filledCells = page.database.rows.reduce((total, row) => (
        total + page.database.properties.filter((property) => String(row.cells[property.id] || "").trim()).length
      ), 0);
      return [
        { value: `${page.excelSheets.length}`, label: "Feuilles" },
        { value: `${page.database.rows.length}`, label: "Lignes" },
        { value: `${page.database.properties.length}`, label: "Colonnes" },
        { value: `${filledCells}`, label: "Cellules remplies" },
      ];
    }
    const doneProperty = getFirstPropertyByType(page.database, "checkbox");
    const doneCount = doneProperty
      ? page.database.rows.filter((row) => row.cells[doneProperty.id]).length
      : 0;
    const overdueCount = page.database.rows.filter((row) => getProjectRowInfo(page, row).overdue).length;
    return [
      { value: `${page.database.rows.length}`, label: "Lignes" },
      { value: `${page.database.properties.length}`, label: "Proprietes" },
      { value: `${doneCount}`, label: "Cochees" },
      { value: `${overdueCount}`, label: "En retard" },
    ];
  }

  if (isWordPage(page)) {
    const wordPages = normalizeWordPages(page.wordPages, page.wordHtml, page.blocks);
    const text = stripHtml(wordPages.map((item) => item.html).join(" ")).trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    return [
      { value: `${words}`, label: "Mots" },
      { value: `${wordPages.length}`, label: "Pages" },
      { value: "A4", label: "Format" },
    ];
  }

  const todoCount = page.blocks.filter((block) => block.type === "todo").length;
  const doneCount = page.blocks.filter((block) => block.type === "todo" && block.checked).length;
  return [
    { value: `${page.blocks.length}`, label: "Blocs" },
    { value: `${countDescendants(page.id)}`, label: "Sous-pages" },
    { value: `${doneCount}/${todoCount || 0}`, label: "Taches" },
  ];
}

function countDescendants(pageId) {
  return getChildren(pageId).reduce((total, child) => total + 1 + countDescendants(child.id), 0);
}

function pageKindLabel(page) {
  if (page?.subtype && PAGE_SUBTYPE_LABELS[page.subtype]) return PAGE_SUBTYPE_LABELS[page.subtype];
  return PAGE_KIND_LABELS[page.kind] || PAGE_KIND_LABELS.document;
}

function sortPagesForTree(a, b) {
  const leftOrder = Number.isFinite(a.sortOrder) ? a.sortOrder : Number.MAX_SAFE_INTEGER;
  const rightOrder = Number.isFinite(b.sortOrder) ? b.sortOrder : Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  return (a.title || "").localeCompare(b.title || "", "fr");
}

function clearTreeDropIndicators() {
  document.querySelectorAll(".tree-drop-before, .tree-drop-after, .tree-drop-inside, .tree-drag-source").forEach((element) => {
    element.classList.remove("tree-drop-before", "tree-drop-after", "tree-drop-inside", "tree-drag-source");
  });
}

function getTreeDropMode(row, event) {
  const rect = row.getBoundingClientRect();
  const offset = rect.height ? (event.clientY - rect.top) / rect.height : 0.5;
  if (offset < 0.28) return "before";
  if (offset > 0.72) return "after";
  return "inside";
}

function canMovePageInTree(sourceId, parentId) {
  if (!sourceId) return false;
  if (!parentId) return true;
  if (sourceId === parentId) return false;
  return !collectSubtree(sourceId).includes(parentId);
}

function assignTreeSortOrder(pages) {
  pages.forEach((page, index) => {
    page.sortOrder = (index + 1) * 1000;
  });
}

function movePageInTree(sourceId, targetId, mode = "inside") {
  const source = getPage(sourceId);
  const target = getPage(targetId);
  if (!source || !target || source.id === target.id || source.deletedAt || target.deletedAt) return false;
  if (collectSubtree(source.id).includes(target.id)) {
    toast("Impossible de deplacer une page dans elle-meme.");
    return false;
  }

  const nextParentId = mode === "inside" ? target.id : (target.parentId || null);
  if (!canMovePageInTree(source.id, nextParentId)) return false;

  recordUndoSnapshot("Espace deplace");
  source.parentId = nextParentId;
  source.updatedAt = Date.now();

  if (mode === "inside") {
    target.expanded = true;
    const siblings = getChildren(target.id).filter((page) => page.id !== source.id).sort(sortPagesForTree);
    siblings.push(source);
    assignTreeSortOrder(siblings);
  } else {
    const siblings = getChildren(nextParentId).filter((page) => page.id !== source.id).sort(sortPagesForTree);
    const targetIndex = Math.max(0, siblings.findIndex((page) => page.id === target.id));
    siblings.splice(mode === "after" ? targetIndex + 1 : targetIndex, 0, source);
    assignTreeSortOrder(siblings);
  }

  scheduleSave("Espace deplace");
  renderSidebar();
  const activePage = getActivePage();
  if (activePage) renderBreadcrumbs(activePage);
  return true;
}

function isBlankDocument(page) {
  return page.kind === "document" && page.blocks.length === 1 && page.blocks[0].type === "paragraph" && !page.blocks[0].text.trim();
}

function createLegacyNewPage(kind = "document", parentId = null) {
  recordUndoSnapshot(kind === "database" ? "Tableau cree" : "Page creee");
  const page = createPage(kind, parentId, kind === "database"
    ? { title: "Nouveau tableau", icon: "🗂", database: createDatabase() }
    : { title: "Nouvelle page", icon: "✨", blocks: [createBlock("paragraph", "")] });
  state.pages.push(page);

  if (parentId) {
    const parent = getPage(parentId);
    if (parent) parent.expanded = true;
  }

  state.ui.activePageId = page.id;
  if (kind === "database") {
    setLocalActiveDatabaseView(page.id, page.database.activeViewId || page.database.views[0]?.id || null);
  }
  scheduleSave("Nouvelle page creee");
  render();
  void sendPresenceHeartbeat("heartbeat");
  if (kind === "document") {
    focusBlockEditor(page.blocks[0].id);
  }
  if (window.innerWidth <= 980) {
    closeSidebar();
  }
}

function createNewPage(kind = "document", parentId = null) {
  const creationKind = kind === "word" ? "document" : (kind === "excel" ? "database" : kind);
  const isDatabase = creationKind === "database";
  const undoLabel = kind === "excel"
    ? "Feuille Excel creee"
    : (kind === "word" ? "Document Word cree" : (isDatabase ? "Tableau cree" : "Page creee"));
  const seed = kind === "excel"
    ? { title: "Nouvelle feuille Excel", icon: "\u{1F4CA}", subtype: "excel", database: createSpreadsheetDatabase() }
    : (kind === "word"
      ? {
          title: "Nouveau document Word",
          icon: "\u{1F4C4}",
          subtype: "word",
          wordHtml: "<h1>Titre du document</h1><p>Commencez a rediger votre document ici.</p>",
          blocks: [
            createBlock("h1", "Titre du document"),
            createBlock("paragraph", "Commencez a rediger votre document ici."),
          ],
        }
      : (isDatabase
        ? { title: "Nouveau tableau", icon: "\u{1F5C2}", database: createDatabase() }
        : { title: "Nouvelle page", icon: "\u{2728}", blocks: [createBlock("paragraph", "")] }));

  recordUndoSnapshot(undoLabel);
  const page = createPage(creationKind, parentId, seed);
  state.pages.push(page);

  if (parentId) {
    const parent = getPage(parentId);
    if (parent) parent.expanded = true;
  }

  state.ui.activePageId = page.id;
  if (page.kind === "database") {
    setLocalActiveDatabaseView(page.id, page.database.activeViewId || page.database.views[0]?.id || null);
  }
  scheduleSave("Nouvelle page creee");
  render();
  void sendPresenceHeartbeat("heartbeat");
  if (page.kind === "document") {
    focusBlockEditor(page.blocks[0].id);
  }
  if (window.innerWidth <= 980) {
    closeSidebar();
  }
}

function createPageFromTemplate(templateId, parentId = null) {
  const template = TEMPLATES.find((item) => item.id === templateId);
  if (!template) return;
  recordUndoSnapshot("Modele applique");
  const seed = template.build();
  const page = createPage(seed.kind, parentId, seed);
  state.pages.push(page);
  state.ui.activePageId = page.id;
  if (page.kind === "database") {
    setLocalActiveDatabaseView(page.id, page.database.activeViewId || page.database.views[0]?.id || null);
  }
  scheduleSave("Modele applique");
  closeModal();
  render();
  void sendPresenceHeartbeat("heartbeat");
  toast(`Modele "${template.name}" ajoute.`);
}

function setActivePage(pageId) {
  if (!getPage(pageId)) return;
  state.ui.activePageId = pageId;
  hideContextMenu();
  hideSlashMenu();
  renderMain();
  renderSidebar();
  void sendPresenceHeartbeat("heartbeat");
  if (window.innerWidth <= 980) closeSidebar();
}

function duplicatePage(pageId) {
  const page = getPage(pageId);
  if (!page) return;
  recordUndoSnapshot("Page dupliquee");
  const clonedRootId = clonePageSubtree(pageId, page.parentId, true);
  state.ui.activePageId = clonedRootId;
  scheduleSave("Page dupliquee");
  render();
  void sendPresenceHeartbeat("heartbeat");
  toast("Copie de la page creee.");
}

function clonePageSubtree(pageId, parentId, renameRoot = false) {
  const page = getPage(pageId);
  if (!page) return null;

  const clone = JSON.parse(JSON.stringify(page));
  const newId = uid("page");
  clone.id = newId;
  clone.parentId = parentId;
  clone.favorite = false;
  clone.deletedAt = null;
  clone.updatedAt = Date.now();
  clone.expanded = true;
  if (renameRoot) clone.title = `${clone.title || "Sans titre"} (copie)`;
  if (clone.kind === "document") {
    clone.blocks = normalizeBlocks(clone.blocks).map((block) => ({ ...block, id: uid("block") }));
  } else {
    clone.database = normalizeDatabase(clone.database);
    clone.database.properties = clone.database.properties.map((property) => ({ ...property, id: uid("prop") }));
    clone.database.rows = clone.database.rows.map((row) => createRow(clone.database.properties, propertyValueMap(row, page.database.properties, clone.database.properties)));
  }

  state.pages.push(clone);
  getChildren(pageId, true).forEach((child) => clonePageSubtree(child.id, newId, false));
  return newId;
}

function propertyValueMap(row, oldProperties, newProperties) {
  const map = {};
  oldProperties.forEach((property, index) => {
    const fallbackName = newProperties[index]?.name || property.name;
    map[fallbackName] = row.cells[property.id];
  });
  return map;
}

function movePageToTrash(pageId) {
  recordUndoSnapshot("Page envoyee a la corbeille");
  collectSubtree(pageId).forEach((id) => {
    const page = getPage(id);
    if (page) page.deletedAt = Date.now();
  });
  const visible = getVisiblePages();
  state.ui.activePageId = visible[0]?.id || state.pages[0]?.id || null;
  scheduleSave("Page envoyee a la corbeille");
  render();
  void sendPresenceHeartbeat("heartbeat");
  toast("La page a ete deplacee dans la corbeille.");
}

function restorePage(pageId) {
  recordUndoSnapshot("Page restauree");
  collectSubtree(pageId).forEach((id) => {
    const page = getPage(id);
    if (page) page.deletedAt = null;
  });
  state.ui.activePageId = pageId;
  scheduleSave("Page restauree");
  render();
  void sendPresenceHeartbeat("heartbeat");
  toast("La page a ete restauree.");
}

function permanentlyDeletePage(pageId) {
  const page = getPage(pageId);
  if (!page || !page.deletedAt) return;
  const subtreeIds = collectSubtree(pageId);
  const childCount = Math.max(0, subtreeIds.length - 1);
  const detail = childCount
    ? `\n\n${childCount} sous-page(s) seront aussi supprimee(s).`
    : "";
  const confirmed = window.confirm(
    `Supprimer definitivement "${page.title || "Sans titre"}" ?${detail}\n\nCette action est irreversible.`
  );
  if (!confirmed) return;

  const deletedIds = new Set(subtreeIds);
  state.pages = state.pages.filter((candidate) => !deletedIds.has(candidate.id));
  state.userPreferences = normalizeUserPreferences(state.userPreferences);
  state.userPreferences.favoritePageIds = state.userPreferences.favoritePageIds.filter((id) => !deletedIds.has(id));
  state.userPreferences.initialized = true;
  scheduleUserPreferencesSave("Favoris personnels mis a jour");
  clearUndoHistory();

  if (!state.pages.length) {
    const replacement = createPage("document", null, {
      title: "Nouvelle page",
      icon: "✨",
      blocks: [createBlock("paragraph", "")],
    });
    state.pages.push(replacement);
    state.ui.activePageId = replacement.id;
  } else if (deletedIds.has(state.ui.activePageId)) {
    state.ui.activePageId = getVisiblePages()[0]?.id || state.pages[0]?.id || null;
  }

  scheduleSave("Page supprimee definitivement");
  render();
  void sendPresenceHeartbeat("heartbeat");
  toast("Page supprimee definitivement.");
}

function collectSubtree(pageId) {
  return [pageId, ...getChildren(pageId, true).flatMap((child) => collectSubtree(child.id))];
}

function convertDocumentToDatabase(pageId) {
  const page = getPage(pageId);
  if (!page || page.kind !== "document") return;
  updatePage(pageId, (target) => {
    target.kind = "database";
    target.subtype = null;
    target.database = createDatabase();
  }, "Page convertie en tableau");
  render();
  toast("La page est maintenant un tableau multi-vues.");
}

function openIconPickerModal() {
  const page = getActivePage();
  if (!page || page.deletedAt) return;

  openModal({
    kicker: "Apparence",
    title: "Choisir une icone",
    contentBuilder: () => {
      const wrap = document.createElement("div");
      wrap.className = "icon-picker";

      const current = document.createElement("div");
      current.className = "icon-picker-current";

      const preview = document.createElement("span");
      preview.className = "icon-picker-preview";
      preview.textContent = page.icon;

      const copy = document.createElement("div");
      const label = document.createElement("strong");
      label.textContent = page.title || "Sans titre";
      const hint = document.createElement("span");
      hint.textContent = "Selectionnez une icone pour cette page.";
      copy.append(label, hint);
      current.append(preview, copy);

      const grid = document.createElement("div");
      grid.className = "icon-picker-grid";

      ICONS.forEach((icon) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `icon-picker-option ${page.icon === icon ? "active" : ""}`;
        button.textContent = icon;
        button.setAttribute("aria-label", `Choisir l'icone ${icon}`);
        button.addEventListener("click", () => {
          updatePage(page.id, (target) => {
            target.icon = icon;
          }, "Icone modifiee");
          closeModal();
          renderMain();
          renderSidebar();
        });
        grid.appendChild(button);
      });

      wrap.append(current, grid);
      return wrap;
    },
  });
}

function toggleActiveFavorite() {
  const page = getActivePage();
  if (!page || page.deletedAt) return;
  setPageFavorite(page.id, !isPageFavorite(page));
  render();
}

function addDatabaseProperty(pageId, type = "text", insertIndex = null) {
  const normalizedType = normalizePropertyType(type);
  updatePage(pageId, (page) => {
    if (!page.database) return;
    const property = createProperty(defaultPropertyName(normalizedType), normalizedType, normalizePropertyOptions(normalizedType));
    const safeIndex = Number.isInteger(insertIndex)
      ? Math.max(0, Math.min(insertIndex, page.database.properties.length))
      : page.database.properties.length;
    page.database.properties.splice(safeIndex, 0, property);
    page.database.rows.forEach((row) => {
      row.cells[property.id] = getDefaultCellValue(property);
    });
    reconcileDatabaseViews(page.database);
  }, "Propriete ajoutee");
  renderMain();
}

function ensureSpreadsheetShape(page) {
  ensureSpreadsheetWorkbook(page);
  if (!page?.database) return;
  if (!page.database.properties.length) {
    page.database.properties = ["A", "B", "C", "D"].map((name) => createProperty(name, "text"));
  }
  if (!page.database.rows.length) {
    page.database.rows = Array.from({ length: 12 }, () => createRow(page.database.properties, {}));
  }
  ensureSpreadsheetLayout(page.database);
}

function ensureSpreadsheetLayout(database) {
  if (!database) return { columnWidths: {}, rowHeights: {}, imageScales: {} };
  const layout = database.spreadsheetLayout && typeof database.spreadsheetLayout === "object"
    ? database.spreadsheetLayout
    : {};
  layout.columnWidths = layout.columnWidths && typeof layout.columnWidths === "object" ? layout.columnWidths : {};
  layout.rowHeights = layout.rowHeights && typeof layout.rowHeights === "object" ? layout.rowHeights : {};
  layout.imageScales = layout.imageScales && typeof layout.imageScales === "object" ? layout.imageScales : {};
  database.spreadsheetLayout = layout;
  return layout;
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function getSpreadsheetColumnWidth(database, propertyId) {
  const layout = ensureSpreadsheetLayout(database);
  return clampNumber(layout.columnWidths[propertyId], SPREADSHEET_MIN_COLUMN_WIDTH, SPREADSHEET_MAX_COLUMN_WIDTH, SPREADSHEET_DEFAULT_COLUMN_WIDTH);
}

function getSpreadsheetRowHeight(database, rowId) {
  const layout = ensureSpreadsheetLayout(database);
  return clampNumber(layout.rowHeights[rowId], SPREADSHEET_MIN_ROW_HEIGHT, SPREADSHEET_MAX_ROW_HEIGHT, SPREADSHEET_DEFAULT_ROW_HEIGHT);
}

function spreadsheetCellLayoutKey(rowId, propertyId) {
  return `${rowId}:${propertyId}`;
}

function getSpreadsheetCellImageScale(database, rowId, propertyId) {
  const layout = ensureSpreadsheetLayout(database);
  return clampNumber(layout.imageScales[spreadsheetCellLayoutKey(rowId, propertyId)], SPREADSHEET_MIN_IMAGE_SCALE, SPREADSHEET_MAX_IMAGE_SCALE, SPREADSHEET_MAX_IMAGE_SCALE);
}

function updateSpreadsheetColumnWidth(pageId, propertyId, width, shouldPersist = true) {
  const page = getPage(pageId);
  if (!isSpreadsheetPage(page) || !page.database) return;
  const layout = ensureSpreadsheetLayout(page.database);
  layout.columnWidths[propertyId] = clampNumber(width, SPREADSHEET_MIN_COLUMN_WIDTH, SPREADSHEET_MAX_COLUMN_WIDTH, SPREADSHEET_DEFAULT_COLUMN_WIDTH);
  page.updatedAt = Date.now();
  if (shouldPersist) scheduleSave("Largeur de colonne modifiee");
}

function updateSpreadsheetRowHeight(pageId, rowId, height, shouldPersist = true) {
  const page = getPage(pageId);
  if (!isSpreadsheetPage(page) || !page.database) return;
  const layout = ensureSpreadsheetLayout(page.database);
  layout.rowHeights[rowId] = clampNumber(height, SPREADSHEET_MIN_ROW_HEIGHT, SPREADSHEET_MAX_ROW_HEIGHT, SPREADSHEET_DEFAULT_ROW_HEIGHT);
  page.updatedAt = Date.now();
  if (shouldPersist) scheduleSave("Hauteur de ligne modifiee");
}

function updateSpreadsheetCellImageScale(pageId, rowId, propertyId, scale, shouldPersist = true) {
  const page = getPage(pageId);
  if (!isSpreadsheetPage(page) || !page.database) return;
  const layout = ensureSpreadsheetLayout(page.database);
  layout.imageScales[spreadsheetCellLayoutKey(rowId, propertyId)] = clampNumber(scale, SPREADSHEET_MIN_IMAGE_SCALE, SPREADSHEET_MAX_IMAGE_SCALE, SPREADSHEET_MAX_IMAGE_SCALE);
  page.updatedAt = Date.now();
  if (shouldPersist) scheduleSave("Taille d'image modifiee");
}

function bindSpreadsheetColumnResize(handle, pageId, propertyId, grid) {
  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const page = getPage(pageId);
    if (!isSpreadsheetPage(page) || page.deletedAt) return;
    recordUndoSnapshot("Largeur de colonne modifiee", {
      coalesceKey: `excel-column-width:${pageId}:${propertyId}`,
      coalesceMs: UNDO_TEXT_COALESCE_MS,
    });
    const startX = event.clientX;
    const startWidth = getSpreadsheetColumnWidth(page.database, propertyId);
    handle.setPointerCapture(event.pointerId);
    const onMove = (moveEvent) => {
      const nextWidth = clampNumber(startWidth + (moveEvent.clientX - startX), SPREADSHEET_MIN_COLUMN_WIDTH, SPREADSHEET_MAX_COLUMN_WIDTH, startWidth);
      updateSpreadsheetColumnWidth(pageId, propertyId, nextWidth, false);
      if (grid) {
        grid.style.gridTemplateColumns = `52px ${page.database.properties.map((property) => `${getSpreadsheetColumnWidth(page.database, property.id)}px`).join(" ")}`;
      }
    };
    const onUp = (upEvent) => {
      handle.releasePointerCapture(upEvent.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      void persistNow("Largeur de colonne modifiee");
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  });
}

function bindSpreadsheetRowResize(handle, pageId, rowId) {
  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const page = getPage(pageId);
    if (!isSpreadsheetPage(page) || page.deletedAt) return;
    recordUndoSnapshot("Hauteur de ligne modifiee", {
      coalesceKey: `excel-row-height:${pageId}:${rowId}`,
      coalesceMs: UNDO_TEXT_COALESCE_MS,
    });
    const startY = event.clientY;
    const startHeight = getSpreadsheetRowHeight(page.database, rowId);
    const rowElements = Array.from(document.querySelectorAll(`.spreadsheet-cell[data-row-id="${CSS.escape(rowId)}"], .spreadsheet-row-head[data-row-id="${CSS.escape(rowId)}"]`));
    handle.setPointerCapture(event.pointerId);
    const onMove = (moveEvent) => {
      const nextHeight = clampNumber(startHeight + (moveEvent.clientY - startY), SPREADSHEET_MIN_ROW_HEIGHT, SPREADSHEET_MAX_ROW_HEIGHT, startHeight);
      updateSpreadsheetRowHeight(pageId, rowId, nextHeight, false);
      rowElements.forEach((element) => {
        element.style.height = `${nextHeight}px`;
      });
    };
    const onUp = (upEvent) => {
      handle.releasePointerCapture(upEvent.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      void persistNow("Hauteur de ligne modifiee");
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  });
}

function bindSpreadsheetImageResize(handle, pageId, rowId, propertyId, preview) {
  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const page = getPage(pageId);
    if (!isSpreadsheetPage(page) || page.deletedAt) return;
    recordUndoSnapshot("Taille d'image modifiee", {
      coalesceKey: `excel-image-size:${pageId}:${rowId}:${propertyId}`,
      coalesceMs: UNDO_TEXT_COALESCE_MS,
    });
    const startX = event.clientX;
    const startY = event.clientY;
    const startScale = getSpreadsheetCellImageScale(page.database, rowId, propertyId);
    handle.setPointerCapture(event.pointerId);
    const onMove = (moveEvent) => {
      const delta = Math.max(moveEvent.clientX - startX, moveEvent.clientY - startY);
      const nextScale = clampNumber(startScale + delta / 2, SPREADSHEET_MIN_IMAGE_SCALE, SPREADSHEET_MAX_IMAGE_SCALE, startScale);
      updateSpreadsheetCellImageScale(pageId, rowId, propertyId, nextScale, false);
      preview.style.setProperty("--cell-image-scale", `${nextScale}%`);
    };
    const onUp = (upEvent) => {
      handle.releasePointerCapture(upEvent.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      void persistNow("Taille d'image modifiee");
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  });
}

function switchSpreadsheetSheet(pageId, sheetId) {
  updatePage(pageId, (page) => {
    if (!isSpreadsheetPage(page)) return;
    ensureSpreadsheetWorkbook(page);
    const sheet = page.excelSheets.find((candidate) => candidate.id === sheetId);
    if (!sheet) return;
    page.activeExcelSheetId = sheet.id;
    page.database = sheet.database;
  }, "Feuille Excel active");
  renderMain();
  renderInspector(getPage(pageId));
}

function addSpreadsheetSheet(pageId) {
  updatePage(pageId, (page) => {
    if (!isSpreadsheetPage(page)) return;
    ensureSpreadsheetWorkbook(page);
    const sheet = createSpreadsheetSheet(`Feuille ${page.excelSheets.length + 1}`);
    page.excelSheets.push(sheet);
    page.activeExcelSheetId = sheet.id;
    page.database = sheet.database;
  }, "Feuille Excel ajoutee");
  render();
}

function renameSpreadsheetSheet(pageId, sheetId) {
  const page = getPage(pageId);
  if (!isSpreadsheetPage(page)) return;
  ensureSpreadsheetWorkbook(page);
  const sheet = page.excelSheets.find((candidate) => candidate.id === sheetId);
  if (!sheet) return;
  const nextName = window.prompt("Nom de la feuille", sheet.name || "Feuille");
  if (!nextName?.trim()) return;
  updatePage(pageId, (target) => {
    ensureSpreadsheetWorkbook(target);
    const targetSheet = target.excelSheets.find((candidate) => candidate.id === sheetId);
    if (targetSheet) targetSheet.name = nextName.trim().slice(0, 31);
  }, "Feuille Excel renommee");
  renderMain();
}

function openSpreadsheetSheetInlineRename(tab, pageId, sheetId, index = 0) {
  const page = getPage(pageId);
  const sheet = page?.excelSheets?.find((candidate) => candidate.id === sheetId);
  if (!sheet || page?.deletedAt) return;

  const input = document.createElement("input");
  input.className = "spreadsheet-sheet-name-input";
  input.value = sheet.name || `Feuille ${index + 1}`;
  input.setAttribute("aria-label", "Nom de la feuille");
  tab.classList.add("renaming");
  tab.replaceChildren(input);
  input.focus();
  input.select();

  let finished = false;
  const finish = (shouldCommit) => {
    if (finished) return;
    finished = true;
    const nextName = input.value.trim();
    if (shouldCommit && nextName) {
      setSpreadsheetSheetName(pageId, sheetId, nextName);
    } else {
      renderMain();
    }
  };

  input.addEventListener("click", (event) => event.stopPropagation());
  input.addEventListener("dblclick", (event) => event.stopPropagation());
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  });
  input.addEventListener("blur", () => finish(true));
}

function setSpreadsheetSheetName(pageId, sheetId, name) {
  const nextName = String(name || "").trim();
  if (!nextName) return;
  updatePage(pageId, (target) => {
    ensureSpreadsheetWorkbook(target);
    const targetSheet = target.excelSheets.find((candidate) => candidate.id === sheetId);
    if (targetSheet) targetSheet.name = nextName.slice(0, 31);
  }, "Feuille Excel renommee");
  renderMain();
}

function deleteSpreadsheetSheet(pageId, sheetId) {
  const page = getPage(pageId);
  if (!isSpreadsheetPage(page) || page.deletedAt) return;
  ensureSpreadsheetWorkbook(page);
  if (page.excelSheets.length <= 1) {
    toast("Impossible de supprimer la derniere feuille.");
    return;
  }

  const sheet = page.excelSheets.find((candidate) => candidate.id === sheetId);
  if (!sheet) return;
  if (!window.confirm(`Supprimer la feuille "${sheet.name || "Feuille"}" ?`)) return;

  updatePage(pageId, (target) => {
    ensureSpreadsheetWorkbook(target);
    const index = target.excelSheets.findIndex((candidate) => candidate.id === sheetId);
    if (index < 0 || target.excelSheets.length <= 1) return;
    target.excelSheets.splice(index, 1);
    if (target.activeExcelSheetId === sheetId) {
      const nextSheet = target.excelSheets[Math.max(0, index - 1)] || target.excelSheets[0];
      target.activeExcelSheetId = nextSheet?.id || null;
      target.database = nextSheet?.database || target.database;
    }
  }, "Feuille Excel supprimee");
  render();
}

function addSpreadsheetRow(pageId) {
  updatePage(pageId, (page) => {
    if (!page.database) return;
    ensureSpreadsheetShape(page);
    page.database.rows.push(createRow(page.database.properties, {}));
  }, "Ligne Excel ajoutee");
  renderMain();
}

function addSpreadsheetColumn(pageId) {
  updatePage(pageId, (page) => {
    if (!page.database) return;
    ensureSpreadsheetShape(page);
    const property = createProperty(spreadsheetColumnName(page.database.properties.length), "text");
    page.database.properties.push(property);
    page.database.rows.forEach((row) => {
      row.cells[property.id] = "";
    });
    reconcileDatabaseViews(page.database);
  }, "Colonne Excel ajoutee");
  renderMain();
}

function renameSpreadsheetColumn(pageId, propertyId, name) {
  updatePage(pageId, (page) => {
    if (!page.database) return;
    const property = page.database.properties.find((candidate) => candidate.id === propertyId);
    if (property) property.name = name;
  }, "Colonne Excel renommee");
  renderMain();
}

function spreadsheetColumnIndex(page, label) {
  const normalized = String(label || "").trim().toUpperCase();
  return page.database.properties.findIndex((property, index) => (
    String(property.name || "").trim().toUpperCase() === normalized ||
    spreadsheetColumnName(index) === normalized
  ));
}

function numericSpreadsheetValue(page, rowIndex, columnIndex, seen = new Set()) {
  const value = computeSpreadsheetCellValue(page, rowIndex, columnIndex, seen);
  const numeric = Number(String(value).replace(",", "."));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatSpreadsheetComputedValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const numeric = Number(text.replace(",", "."));
  if (!Number.isFinite(numeric)) return text;
  const rounded = Math.round((numeric + Number.EPSILON) * 1000) / 1000;
  return String(rounded);
}

function getSpreadsheetSheetForDatabase(page, database = page?.database) {
  if (!isSpreadsheetPage(page)) return null;
  ensureSpreadsheetWorkbook(page);
  return page.excelSheets.find((candidate) => candidate.database === database)
    || page.excelSheets.find((candidate) => candidate.id === page.activeExcelSheetId)
    || page.excelSheets[0]
    || null;
}

function spreadsheetFormulaResultKey(page, rowIndex, columnIndex, rawValue, database = page?.database) {
  const sheet = getSpreadsheetSheetForDatabase(page, database);
  return `${page?.id || "page"}:${sheet?.id || page?.activeExcelSheetId || "sheet"}:${rowIndex}:${columnIndex}:${String(rawValue || "")}`;
}

function getSpreadsheetFormulaDisplayValue(page, rowIndex, columnIndex, rawValue) {
  const key = spreadsheetFormulaResultKey(page, rowIndex, columnIndex, rawValue);
  if (spreadsheetWorkerResults.has(key)) return formatSpreadsheetComputedValue(spreadsheetWorkerResults.get(key));
  return "";
}

function ensureSpreadsheetWorker() {
  if (spreadsheetWorkerUnavailable) return null;
  if (spreadsheetWorker) return spreadsheetWorker;
  if (!("Worker" in window)) {
    spreadsheetWorkerUnavailable = true;
    return null;
  }
  try {
    spreadsheetWorker = new Worker(SPREADSHEET_WORKER_URL);
    spreadsheetWorker.addEventListener("message", handleSpreadsheetWorkerMessage);
    spreadsheetWorker.addEventListener("error", (error) => {
      console.warn("Spreadsheet worker failed", error);
      spreadsheetWorkerUnavailable = true;
      spreadsheetWorker?.terminate();
      spreadsheetWorker = null;
    });
    return spreadsheetWorker;
  } catch (error) {
    console.warn("Spreadsheet worker unavailable", error);
    spreadsheetWorkerUnavailable = true;
    return null;
  }
}

function sanitizeSpreadsheetWorkerCellValue(value) {
  const text = String(value ?? "");
  return isSpreadsheetImageValue(text) ? "" : text;
}

function buildSpreadsheetWorkerSnapshot(page) {
  ensureSpreadsheetWorkbook(page);
  const sheets = page.excelSheets.map((sheet) => {
    const properties = sheet.database.properties.map((property) => ({
      id: property.id,
      name: property.name,
    }));
    return {
      id: sheet.id,
      name: sheet.name,
      database: {
        properties,
        rows: sheet.database.rows.map((row) => ({
          id: row.id,
          cells: properties.reduce((cells, property) => {
            cells[property.id] = sanitizeSpreadsheetWorkerCellValue(row.cells[property.id]);
            return cells;
          }, {}),
        })),
      },
    };
  });
  const activeSheet = sheets.find((sheet) => sheet.id === page.activeExcelSheetId) || sheets[0] || null;
  return {
    id: page.id,
    activeExcelSheetId: activeSheet?.id || page.activeExcelSheetId || null,
    database: activeSheet?.database || { properties: [], rows: [] },
    excelSheets: sheets,
  };
}

function scheduleSpreadsheetFormulaWorker(page) {
  if (!isSpreadsheetPage(page) || page.deletedAt) return;
  const activeSheet = getActiveSpreadsheetSheet(page) || page.excelSheets?.[0];
  const hasFormula = activeSheet?.database?.rows?.some((row) => (
    activeSheet.database.properties.some((property) => String(row.cells[property.id] || "").trim().startsWith("="))
  ));
  if (!hasFormula) return;
  const worker = ensureSpreadsheetWorker();
  if (!worker) return;
  const requestId = ++spreadsheetWorkerRequestId;
  clearTimeout(spreadsheetWorkerTimer);
  spreadsheetWorkerTimer = window.setTimeout(() => {
    worker.postMessage({
      type: "computeSpreadsheet",
      requestId,
      page: buildSpreadsheetWorkerSnapshot(page),
    });
  }, 40);
}

function handleSpreadsheetWorkerMessage(event) {
  const message = event.data || {};
  if (message.type !== "spreadsheetComputed" || message.requestId !== spreadsheetWorkerRequestId) return;
  (message.results || []).forEach((result) => {
    spreadsheetWorkerResults.set(result.key, result.value);
    updateVisibleSpreadsheetFormulaCell(result);
  });
}

function updateVisibleSpreadsheetFormulaCell(result) {
  const page = getActivePage();
  if (!isSpreadsheetPage(page) || page.id !== result.pageId || page.activeExcelSheetId !== result.sheetId) return;
  const selector = `.spreadsheet-data-cell[data-page-id="${CSS.escape(result.pageId)}"][data-row-index="${result.rowIndex}"][data-column-index="${result.columnIndex}"]`;
  const cell = document.querySelector(selector);
  const input = cell?.querySelector("input");
  if (!input || input === document.activeElement || input.dataset.rawValue !== result.raw) return;
  const displayed = formatSpreadsheetComputedValue(result.value);
  input.value = displayed;
  input.title = `${result.raw} = ${displayed || "Erreur"}`;
  cell.classList.remove("spreadsheet-formula-pending");
}

function applySpreadsheetPercentSyntax(expression) {
  let next = expression;
  let previous = "";
  const additivePercentPattern = /((?:\([^()]+\))|-?\d+(?:\.\d+)?)\s*([+-])\s*(\d+(?:\.\d+)?)\s*%/g;
  while (next !== previous) {
    previous = next;
    next = next.replace(additivePercentPattern, (_, left, operator, percent) => (
      `${left}${operator}(${left}*(${percent}/100))`
    ));
  }
  return next.replace(/(\d+(?:\.\d+)?)\s*%/g, "($1/100)");
}

function splitSpreadsheetArguments(value) {
  const args = [];
  let current = "";
  let depth = 0;
  let quote = "";
  String(value || "").split("").forEach((char) => {
    if (quote) {
      current += char;
      if (char === quote) quote = "";
      return;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      return;
    }
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if ((char === "," || char === ";") && depth === 0) {
      args.push(current.trim());
      current = "";
      return;
    }
    current += char;
  });
  args.push(current.trim());
  return args;
}

function unquoteSpreadsheetText(value) {
  const trimmed = String(value || "").trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function spreadsheetNumberValue(value) {
  const numeric = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(numeric) ? numeric : 0;
}

function isSpreadsheetQuotedLiteral(value) {
  const trimmed = String(value || "").trim();
  return (trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"));
}

function parseSpreadsheetSheetScopedReference(page, value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(?:'([^']+)'|([^'!]+))!(.+)$/);
  if (!match) return { page, reference: raw };
  const sheetName = match[1] || match[2];
  const sheet = findSpreadsheetSheetByName(page, sheetName);
  return {
    page: withSpreadsheetSheet(page, sheet),
    reference: match[3],
    sheet,
  };
}

function parseSpreadsheetRange(page, value, includeValues = true) {
  const scoped = parseSpreadsheetSheetScopedReference(page, value);
  const raw = scoped.reference;
  const rangePage = scoped.page;
  const sheet = rangePage.excelSheets?.find((candidate) => candidate.database === rangePage.database);
  const cacheKey = `${rangePage.id}:${sheet?.id || rangePage.activeExcelSheetId || "sheet"}:${raw}:${includeValues ? "values" : "coords"}`;
  if (spreadsheetRangeCache.has(cacheKey)) return spreadsheetRangeCache.get(cacheKey);
  const columnMatch = raw.match(/^([A-Z]+):([A-Z]+)$/i);
  const cellMatch = raw.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!columnMatch && !cellMatch) return null;
  const startColumn = spreadsheetColumnIndex(rangePage, columnMatch ? columnMatch[1] : cellMatch[1]);
  const endColumn = spreadsheetColumnIndex(rangePage, columnMatch ? columnMatch[2] : cellMatch[3]);
  const startRow = columnMatch ? 0 : Number(cellMatch[2]) - 1;
  const endRow = columnMatch ? Math.max(0, (rangePage.database?.rows.length || 1) - 1) : Number(cellMatch[4]) - 1;
  if (startColumn < 0 || endColumn < 0 || startRow < 0 || endRow < 0) return null;

  const values = [];
  for (let rowCursor = Math.min(startRow, endRow); rowCursor <= Math.max(startRow, endRow); rowCursor += 1) {
    for (let columnCursor = Math.min(startColumn, endColumn); columnCursor <= Math.max(startColumn, endColumn); columnCursor += 1) {
      values.push({
        page: rangePage,
        rowIndex: rowCursor,
        columnIndex: columnCursor,
        value: includeValues ? computeSpreadsheetCellValue(rangePage, rowCursor, columnCursor, new Set()) : "",
      });
    }
  }
  spreadsheetRangeCache.set(cacheKey, values);
  return values;
}

function readSpreadsheetFormulaValue(page, value, seen = new Set()) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return unquoteSpreadsheetText(trimmed);
  }
  const cell = trimmed.match(/^([A-Z]+)(\d+)$/i);
  const scoped = parseSpreadsheetSheetScopedReference(page, trimmed);
  const scopedCell = scoped.reference.match(/^([A-Z]+)(\d+)$/i);
  if (cell || scopedCell) {
    const targetPage = scopedCell ? scoped.page : page;
    const targetCell = scopedCell || cell;
    const targetColumn = spreadsheetColumnIndex(targetPage, targetCell[1]);
    const targetRow = Number(targetCell[2]) - 1;
    if (targetColumn < 0 || targetRow < 0) return "";
    return computeSpreadsheetCellValue(targetPage, targetRow, targetColumn, new Set(seen));
  }
  const numeric = Number(trimmed.replace(",", "."));
  return Number.isFinite(numeric) ? String(numeric) : trimmed;
}

function equalSpreadsheetLookupValue(left, right) {
  const leftNumber = Number(String(left).replace(",", "."));
  const rightNumber = Number(String(right).replace(",", "."));
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber === rightNumber;
  return String(left ?? "").trim().toLowerCase() === String(right ?? "").trim().toLowerCase();
}

function spreadsheetLookupNumber(value) {
  const numeric = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

function findApproximateSpreadsheetLookupIndex(lookupRange, lookupValue, matchMode) {
  const mode = Number(matchMode);
  if (!Number.isFinite(mode) || mode === 0) return -1;

  const lookupNumber = spreadsheetLookupNumber(lookupValue);
  if (lookupNumber === null) return -1;

  let bestIndex = -1;
  let bestDistance = Infinity;
  lookupRange.forEach((item, index) => {
    const candidate = spreadsheetLookupNumber(item.value);
    if (candidate === null) return;

    const isNextTier = mode === 1 && candidate >= lookupNumber;
    const isPreviousTier = mode === -1 && candidate <= lookupNumber;
    if (!isPreviousTier && !isNextTier) return;

    const distance = Math.abs(lookupNumber - candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function replaceSpreadsheetFunctionCalls(expression, functionName, resolver) {
  const source = String(expression || "");
  const lower = source.toLowerCase();
  const needle = `${functionName.toLowerCase()}(`;
  let output = "";
  let cursor = 0;

  while (cursor < source.length) {
    const start = lower.indexOf(needle, cursor);
    if (start < 0) {
      output += source.slice(cursor);
      break;
    }

    output += source.slice(cursor, start);
    let index = start + needle.length;
    let depth = 1;
    let quote = "";
    while (index < source.length && depth > 0) {
      const char = source[index];
      if (quote) {
        if (char === quote) quote = "";
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        depth -= 1;
      }
      index += 1;
    }

    if (depth !== 0) {
      output += source.slice(start);
      break;
    }

    const argsText = source.slice(start + needle.length, index - 1);
    const resolved = resolver(argsText);
    const numeric = Number(String(resolved).replace(",", "."));
    output += Number.isFinite(numeric) && String(resolved).trim() !== ""
      ? String(numeric)
      : JSON.stringify(String(resolved ?? ""));
    cursor = index;
  }

  return output;
}

function resolveSpreadsheetXlookup(page, argsText, seen) {
  const args = splitSpreadsheetArguments(argsText);
  if (args.length < 3) return "";
  const lookupValue = readSpreadsheetFormulaValue(page, args[0], seen);
  const lookupRange = parseSpreadsheetRange(page, args[1]);
  const returnRange = parseSpreadsheetRange(page, args[2], false);
  const fallback = args.length >= 4 ? readSpreadsheetFormulaValue(page, args[3], seen) : "";
  const matchMode = args.length >= 5 ? readSpreadsheetFormulaValue(page, args[4], seen) : "0";
  if (!lookupRange?.length || !returnRange?.length) return fallback;

  let foundIndex = lookupRange.findIndex((item) => equalSpreadsheetLookupValue(item.value, lookupValue));
  if (foundIndex < 0) {
    foundIndex = findApproximateSpreadsheetLookupIndex(lookupRange, lookupValue, matchMode);
  }
  if (foundIndex < 0) return fallback;
  const result = returnRange[Math.min(foundIndex, returnRange.length - 1)];
  return result ? computeSpreadsheetCellValue(result.page || page, result.rowIndex, result.columnIndex, new Set(seen)) : fallback;
}

function resolveSpreadsheetSum(page, argsText, seen) {
  return splitSpreadsheetArguments(argsText).reduce((total, arg) => {
    if (!arg) return total;
    const range = parseSpreadsheetRange(page, arg);
    if (range?.length) {
      return total + range.reduce((rangeTotal, item) => rangeTotal + spreadsheetNumberValue(item.value), 0);
    }
    return total + spreadsheetNumberValue(evaluateSpreadsheetFormulaFragment(page, arg, seen));
  }, 0);
}

function evaluateSpreadsheetComparison(page, expression, seen) {
  const text = String(expression || "").trim();
  let quote = "";
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth > 0) continue;

    const twoChars = text.slice(index, index + 2);
    const operator = [">=", "<=", "<>", "!="].includes(twoChars) ? twoChars : (["=", ">", "<"].includes(char) ? char : "");
    if (!operator) continue;

    const left = evaluateSpreadsheetFormulaFragment(page, text.slice(0, index), seen);
    const right = evaluateSpreadsheetFormulaFragment(page, text.slice(index + operator.length), seen);
    const leftNumber = Number(String(left).replace(",", "."));
    const rightNumber = Number(String(right).replace(",", "."));
    const bothNumeric = Number.isFinite(leftNumber) && Number.isFinite(rightNumber);
    const leftComparable = bothNumeric ? leftNumber : String(left ?? "").trim().toLowerCase();
    const rightComparable = bothNumeric ? rightNumber : String(right ?? "").trim().toLowerCase();

    if (operator === "=") return leftComparable === rightComparable;
    if (operator === "<>" || operator === "!=") return leftComparable !== rightComparable;
    if (operator === ">") return leftComparable > rightComparable;
    if (operator === "<") return leftComparable < rightComparable;
    if (operator === ">=") return leftComparable >= rightComparable;
    if (operator === "<=") return leftComparable <= rightComparable;
  }

  return Boolean(spreadsheetNumberValue(evaluateSpreadsheetFormulaFragment(page, text, seen)));
}

function resolveSpreadsheetIf(page, argsText, seen) {
  const args = splitSpreadsheetArguments(argsText);
  if (args.length < 2) return "";
  const condition = evaluateSpreadsheetComparison(page, args[0], seen);
  return evaluateSpreadsheetFormulaFragment(page, condition ? args[1] : (args[2] || ""), seen);
}

function evaluateSpreadsheetFormulaFragment(page, expression, seen = new Set()) {
  let fragment = String(expression || "").trim().replace(/_xlfn\./gi, "");
  if (!fragment) return "";
  if (isSpreadsheetQuotedLiteral(fragment)) return unquoteSpreadsheetText(fragment);

  fragment = replaceSpreadsheetFunctionCalls(fragment, "XLOOKUP", (argsText) => resolveSpreadsheetXlookup(page, argsText, seen));
  fragment = replaceSpreadsheetFunctionCalls(fragment, "SUM", (argsText) => resolveSpreadsheetSum(page, argsText, seen));
  fragment = replaceSpreadsheetFunctionCalls(fragment, "SOMME", (argsText) => resolveSpreadsheetSum(page, argsText, seen));
  fragment = replaceSpreadsheetFunctionCalls(fragment, "SI", (argsText) => resolveSpreadsheetIf(page, argsText, seen));
  fragment = replaceSpreadsheetFunctionCalls(fragment, "IF", (argsText) => resolveSpreadsheetIf(page, argsText, seen));
  if (isSpreadsheetQuotedLiteral(fragment)) return unquoteSpreadsheetText(fragment);

  fragment = fragment.replace(/\b([A-Z]+)(\d+)\b/g, (_, columnLabel, rowLabel) => {
    const targetColumn = spreadsheetColumnIndex(page, columnLabel);
    const targetRow = Number(rowLabel) - 1;
    if (targetColumn < 0 || targetRow < 0) return "0";
    return String(numericSpreadsheetValue(page, targetRow, targetColumn, new Set(seen)));
  });
  fragment = applySpreadsheetPercentSyntax(fragment);

  if (/^[\d+\-*/().\s]+$/.test(fragment)) {
    try {
      const result = Function(`"use strict"; return (${fragment});`)();
      return Number.isFinite(Number(result)) ? String(Number(result)) : "";
    } catch (error) {
      return "";
    }
  }

  return readSpreadsheetFormulaValue(page, fragment, seen);
}

function computeSpreadsheetCellValue(page, rowIndex, columnIndex, seen = new Set()) {
  const property = page.database?.properties[columnIndex];
  const row = page.database?.rows[rowIndex];
  if (!property || !row) return "";
  const raw = String(row.cells[property.id] || "").trim();
  const sheet = page.excelSheets?.find((candidate) => candidate.database === page.database);
  const key = `${sheet?.id || page.activeExcelSheetId || "sheet"}:${rowIndex}:${columnIndex}`;
  const cacheKey = `${page.id}:${key}:${raw}`;
  if (spreadsheetCalculationCache.has(cacheKey)) return spreadsheetCalculationCache.get(cacheKey);
  if (seen.has(key)) return "";
  if (!raw.startsWith("=")) {
    spreadsheetCalculationCache.set(cacheKey, raw);
    return raw;
  }

  seen.add(key);
  const finalResult = evaluateSpreadsheetFormulaFragment(page, raw.slice(1), seen);
  spreadsheetCalculationCache.set(cacheKey, finalResult);
  return finalResult;
}

function addGanttDurationProperty(pageId, viewId) {
  updatePage(pageId, (page) => {
    if (!page.database) return;
    const property = createProperty("Duree", "number");
    page.database.properties.push(property);
    page.database.rows.forEach((row) => {
      row.cells[property.id] = "";
    });
    const view = page.database.views.find((candidate) => candidate.id === viewId);
    if (view) {
      view.settings.durationPropertyId = property.id;
    }
    reconcileDatabaseViews(page.database);
  }, "Duree ajoutee");
  renderMain();
}

function addGanttEndDateProperty(pageId, viewId) {
  updatePage(pageId, (page) => {
    if (!page.database) return;
    const property = createProperty("Date de fin", "date");
    page.database.properties.push(property);
    page.database.rows.forEach((row) => {
      row.cells[property.id] = "";
    });
    const view = page.database.views.find((candidate) => candidate.id === viewId);
    if (view) {
      view.settings.endDatePropertyId = property.id;
    }
    reconcileDatabaseViews(page.database);
  }, "Date de fin ajoutee");
  renderMain();
}

function updateDatabaseProperty(pageId, propertyId, updater, saveMessage = "Propriete modifiee") {
  updatePage(pageId, (page) => {
    if (!page.database) return;
    const property = page.database.properties.find((candidate) => candidate.id === propertyId);
    if (!property) return;
    updater(property, page.database, page);
    reconcileDatabaseViews(page.database);
  }, saveMessage);
  renderMain();
}

function deleteDatabaseProperty(pageId, propertyId) {
  updatePage(pageId, (page) => {
    if (!page.database || page.database.properties.length <= 1) return;
    page.database.properties = page.database.properties.filter((property) => property.id !== propertyId);
    page.database.rows.forEach((row) => {
      delete row.cells[propertyId];
    });
    reconcileDatabaseViews(page.database);
  }, "Propriete retiree");
  renderMain();
}

function insertDatabasePropertyRelative(pageId, propertyId, side = "right") {
  const page = getPage(pageId);
  if (!page?.database) return;
  const index = page.database.properties.findIndex((property) => property.id === propertyId);
  addDatabaseProperty(pageId, "text", side === "left" ? Math.max(index, 0) : index + 1);
}

function duplicateDatabaseProperty(pageId, propertyId) {
  updatePage(pageId, (page) => {
    if (!page.database) return;
    const sourceIndex = page.database.properties.findIndex((property) => property.id === propertyId);
    const source = page.database.properties[sourceIndex];
    if (!source) return;
    const duplicate = createProperty(`${source.name} copie`, source.type, source.options);
    page.database.properties.splice(sourceIndex + 1, 0, duplicate);
    page.database.rows.forEach((row) => {
      row.cells[duplicate.id] = normalizeCellValue(duplicate, row.cells[source.id]);
    });
    reconcileDatabaseViews(page.database);
  }, "Propriete dupliquee");
  renderMain();
}

function reorderDatabaseProperty(pageId, draggedPropertyId, targetPropertyId, placeAfter = false) {
  if (!draggedPropertyId || draggedPropertyId === targetPropertyId) return;
  updatePage(pageId, (page) => {
    if (!page.database) return;
    const fromIndex = page.database.properties.findIndex((property) => property.id === draggedPropertyId);
    const targetIndex = page.database.properties.findIndex((property) => property.id === targetPropertyId);
    if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) return;
    const [movedProperty] = page.database.properties.splice(fromIndex, 1);
    let insertIndex = targetIndex + (placeAfter ? 1 : 0);
    if (fromIndex < insertIndex) insertIndex -= 1;
    page.database.properties.splice(insertIndex, 0, movedProperty);
    reconcileDatabaseViews(page.database);
  }, "Colonne deplacee");
  renderMain();
}

function setDatabasePropertyType(pageId, propertyId, nextType) {
  const normalizedType = normalizePropertyType(nextType);
  updatePage(pageId, (page) => {
    if (!page.database) return;
    const property = page.database.properties.find((candidate) => candidate.id === propertyId);
    if (!property) return;
    property.type = normalizedType;
    property.options = normalizePropertyOptions(normalizedType, property.options);
    page.database.rows.forEach((row) => {
      row.cells[property.id] = normalizeCellValue(property, row.cells[property.id]);
    });
    reconcileDatabaseViews(page.database);
  }, "Type de propriete modifie");
  renderMain();
}

function nextDatabaseViewName(database, type) {
  const baseName = defaultDatabaseViewName(type);
  if (!database.views.some((view) => view.name === baseName)) return baseName;
  let index = 2;
  while (database.views.some((view) => view.name === `${baseName} ${index}`)) {
    index += 1;
  }
  return `${baseName} ${index}`;
}

function uniqueDatabaseViewName(database, requestedName, ignoredViewId = null) {
  const baseName = requestedName.trim() || "Vue";
  if (!database.views.some((view) => view.id !== ignoredViewId && view.name === baseName)) {
    return baseName;
  }
  let index = 2;
  while (database.views.some((view) => view.id !== ignoredViewId && view.name === `${baseName} ${index}`)) {
    index += 1;
  }
  return `${baseName} ${index}`;
}

function updateDatabaseView(pageId, viewId, updater, saveMessage = "Vue mise a jour") {
  updatePage(pageId, (page) => {
    if (!page.database) return;
    const view = page.database.views.find((candidate) => candidate.id === viewId);
    if (!view) return;
    updater(view.settings, view, page.database);
    reconcileDatabaseViews(page.database);
  }, saveMessage);
  renderMain();
}

function upsertDatabaseViewFilter(pageId, viewId, filter) {
  updateDatabaseView(pageId, viewId, (settings, view, database) => {
    const filters = normalizeDatabaseViewFilters(settings.filters, database.properties);
    const nextFilter = normalizeDatabaseViewFilters([filter], database.properties)[0];
    if (!nextFilter) return;
    settings.filters = [
      ...filters.filter((candidate) => candidate.id !== nextFilter.id && candidate.propertyId !== nextFilter.propertyId),
      nextFilter,
    ];
  }, "Filtre ajoute");
}

function removeDatabaseViewFilter(pageId, viewId, filterId) {
  updateDatabaseView(pageId, viewId, (settings, view, database) => {
    settings.filters = normalizeDatabaseViewFilters(settings.filters, database.properties)
      .filter((filter) => filter.id !== filterId);
  }, "Filtre retire");
}

function clearDatabaseViewFilters(pageId, viewId) {
  updateDatabaseView(pageId, viewId, (settings) => {
    settings.filters = [];
  }, "Filtres effaces");
}

function renameDatabaseView(pageId, viewId, requestedName) {
  updatePage(pageId, (page) => {
    if (!page.database) return;
    const view = page.database.views.find((candidate) => candidate.id === viewId);
    if (!view || isBaseDatabaseView(page.database, view)) return;
    view.name = uniqueDatabaseViewName(page.database, requestedName, viewId);
    reconcileDatabaseViews(page.database);
  }, "Vue renommee");
  renderMain();
}

function addDatabaseView(pageId, type) {
  let nextViewId = null;
  updatePage(pageId, (page) => {
    if (!page.database) return;
    const view = createDatabaseView(type, page.database.properties, {
      name: nextDatabaseViewName(page.database, type),
    });
    page.database.views.push(view);
    reconcileDatabaseViews(page.database);
    nextViewId = view.id;
  }, "Vue ajoutee");
  if (nextViewId) {
    setLocalActiveDatabaseView(pageId, nextViewId);
  }
  renderMain();
}

function deleteDatabaseView(pageId, viewId) {
  const page = getPage(pageId);
  if (!page?.database) return;
  const viewIndex = page.database.views.findIndex((view) => view.id === viewId);
  const view = page.database.views[viewIndex];
  if (!view) return;

  if (isBaseDatabaseView(page.database, view)) {
    toast("Les vues de base ne peuvent pas etre supprimees.");
    return;
  }

  recordUndoSnapshot("Vue supprimee");
  const activeViewId = getActiveDatabaseViewId(page);
  page.database.views.splice(viewIndex, 1);
  let nextViewId = null;
  if (activeViewId === viewId) {
    nextViewId = page.database.views[Math.max(0, viewIndex - 1)]?.id || page.database.views[0]?.id || null;
    page.database.activeViewId = nextViewId;
  }
  reconcileDatabaseViews(page.database);
  if (nextViewId) {
    setLocalActiveDatabaseView(pageId, nextViewId);
  }
  page.updatedAt = Date.now();
  scheduleSave("Vue supprimee");
  renderMain();
}

function addDatabaseRow(pageId, values = {}) {
  updatePage(pageId, (page) => {
    if (!page.database) return;
    const row = createRow(page.database.properties, values);
    page.database.rows.push(row);
  }, "Ligne ajoutee");
  renderMain();
}

function duplicateDatabaseRow(pageId, rowId) {
  updatePage(pageId, (page) => {
    if (!page.database) return;
    const row = page.database.rows.find((candidate) => candidate.id === rowId);
    if (!row) return;
    const duplicate = JSON.parse(JSON.stringify(row));
    duplicate.id = uid("row");
    page.database.rows.push(duplicate);
  }, "Ligne dupliquee");
  renderMain();
}

function deleteDatabaseRow(pageId, rowId) {
  updatePage(pageId, (page) => {
    if (!page.database) return;
    page.database.rows = page.database.rows.filter((row) => row.id !== rowId);
  }, "Ligne supprimee");
  renderMain();
}

function reorderDatabaseRow(pageId, draggedRowId, targetRowId, placeAfter = false) {
  if (!draggedRowId || draggedRowId === targetRowId) return;
  updatePage(pageId, (page) => {
    if (!page.database) return;
    const fromIndex = page.database.rows.findIndex((row) => row.id === draggedRowId);
    const targetIndex = page.database.rows.findIndex((row) => row.id === targetRowId);
    if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) return;
    const [movedRow] = page.database.rows.splice(fromIndex, 1);
    let insertIndex = targetIndex + (placeAfter ? 1 : 0);
    if (fromIndex < insertIndex) insertIndex -= 1;
    page.database.rows.splice(insertIndex, 0, movedRow);
  }, "Ligne deplacee");
  renderMain();
}

function updateCellValue(pageId, rowId, propertyId, value, rerender = true) {
  const page = getPage(pageId);
  if (!page || !page.database) return;
  const property = page.database.properties.find((candidate) => candidate.id === propertyId);
  const row = page.database.rows.find((candidate) => candidate.id === rowId);
  if (!row || !property) return;
  const nextValue = normalizeCellValue(property, value);
  if (JSON.stringify(row.cells[propertyId]) !== JSON.stringify(nextValue)) {
    recordUndoSnapshot("Cellule modifiee", {
      coalesceKey: `cell:${pageId}:${rowId}:${propertyId}`,
      coalesceMs: UNDO_TEXT_COALESCE_MS,
    });
    if (property.type === "person" && String(nextValue || "") === String(authState.user?.id || "")) {
      addNotification({
        type: "assignment",
        title: "Vous avez ete assigne",
        body: getPrimaryCellValue(page.database, row) || property.name,
        pageId,
        rowId,
      });
    }
  }
  row.cells[propertyId] = nextValue;
  page.updatedAt = Date.now();
  if (isSpreadsheetPage(page)) {
    spreadsheetCalculationCache.clear();
    spreadsheetRangeCache.clear();
    spreadsheetWorkerResults.clear();
    spreadsheetWorkerRequestId += 1;
  }
  scheduleSave(undefined, isSpreadsheetPage(page) ? 900 : 240);
  const activeView = getActiveDatabaseView(page);
  const isComputedTable = hasComputedDatabaseProperties(page.database);
  if (rerender && (activeView?.type !== "table" || isComputedTable)) {
    renderMain();
  } else {
    const textLikeTypes = ["text", "url", "email", "phone", "multi_select"];
    scheduleFilteredDatabaseViewRefresh(page, property, textLikeTypes.includes(property.type) ? 320 : 0);
  }
}

function hasComputedDatabaseProperties(database) {
  return database.properties.some((property) => ["rollup", "formula", "ai_summary", "ai_translate"].includes(property.type));
}

function persistAndRefreshComputedProperties(page) {
  persistNow();
  if (page?.database && hasComputedDatabaseProperties(page.database)) renderMain();
}

function sortDatabaseByProperty(pageId, propertyId) {
  updatePage(pageId, (page) => {
    if (!page.database) return;
    const property = page.database.properties.find((candidate) => candidate.id === propertyId);
    if (!property) return;
    page.database.rows.sort((left, right) => comparePropertyValues(left.cells[property.id], right.cells[property.id], property.type));
  }, "Tableau trie");
  renderMain();
}

function comparePropertyValues(left, right, type) {
  const leftValue = comparablePropertyValue(left, type);
  const rightValue = comparablePropertyValue(right, type);
  if (typeof leftValue === "number" && typeof rightValue === "number") return leftValue - rightValue;
  return String(leftValue).localeCompare(String(rightValue), "fr", { numeric: true, sensitivity: "base" });
}

function comparablePropertyValue(value, type) {
  if (type === "checkbox") return value ? 1 : 0;
  if (type === "number") return Number.parseFloat(value) || 0;
  if (Array.isArray(value)) return value.join(", ");
  return value || "";
}

function groupDatabaseByProperty(pageId, propertyId) {
  const page = getPage(pageId);
  if (!page?.database) return;
  const property = page.database.properties.find((candidate) => candidate.id === propertyId);
  if (!property || !isOptionPropertyType(property.type)) {
    toast("Le groupement utilise Selectionner, Selection multiple ou Etat.");
    return;
  }
  let boardView = page.database.views.find((view) => view.type === "board");
  if (!boardView) {
    recordUndoSnapshot("Vue regroupee");
    boardView = createDatabaseView("board", page.database.properties);
    page.database.views.push(boardView);
  } else {
    recordUndoSnapshot("Vue regroupee");
  }
  boardView.settings.groupByPropertyId = property.id;
  page.database.activeViewId = boardView.id;
  setLocalActiveDatabaseView(pageId, boardView.id);
  page.updatedAt = Date.now();
  reconcileDatabaseViews(page.database);
  scheduleSave("Vue regroupee");
  renderMain();
}

function togglePropertyHidden(pageId, propertyId) {
  updateDatabaseView(pageId, getActiveDatabaseView(getPage(pageId))?.id, (settings) => {
    const hidden = new Set(settings.hiddenPropertyIds || []);
    if (hidden.has(propertyId)) hidden.delete(propertyId);
    else hidden.add(propertyId);
    settings.hiddenPropertyIds = Array.from(hidden);
  }, "Affichage de colonne modifie");
}

function togglePropertyFrozen(pageId, propertyId) {
  updateDatabaseView(pageId, getActiveDatabaseView(getPage(pageId))?.id, (settings) => {
    const frozen = new Set(settings.frozenPropertyIds || []);
    if (frozen.has(propertyId)) frozen.delete(propertyId);
    else frozen.add(propertyId);
    settings.frozenPropertyIds = Array.from(frozen);
  }, "Colonne figee modifiee");
}

function getFirstPropertyByType(database, type) {
  return database.properties.find((property) => property.type === type) || null;
}

function getPrimaryCellValue(database, row) {
  const primaryProperty = database.properties.find((property) => property.type === "text") || database.properties[0];
  return primaryProperty ? formatCellValue(row.cells[primaryProperty.id], primaryProperty) : "";
}

function normalizeProjectText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function propertyNameIncludes(property, ...needles) {
  const name = normalizeProjectText(property?.name);
  return needles.some((needle) => name.includes(normalizeProjectText(needle)));
}

function getProjectPropertyMap(database) {
  const properties = database?.properties || [];
  const dateProperties = properties.filter((property) => property.type === "date");
  const startProperty = dateProperties.find((property) => propertyNameIncludes(property, "debut", "start"))
    || dateProperties[0]
    || null;
  const endProperty = dateProperties.find((property) => propertyNameIncludes(property, "fin", "echeance", "deadline", "due"))
    || dateProperties.find((property) => property.id !== startProperty?.id)
    || dateProperties[0]
    || null;

  return {
    statusProperty: properties.find((property) => ["status", "select"].includes(property.type) && propertyNameIncludes(property, "etat", "statut", "status"))
      || properties.find((property) => property.type === "status")
      || properties.find((property) => property.type === "select")
      || null,
    doneProperty: properties.find((property) => property.type === "checkbox" && propertyNameIncludes(property, "fait", "termine", "done", "livre"))
      || properties.find((property) => property.type === "checkbox")
      || null,
    personProperty: properties.find((property) => property.type === "person") || null,
    startProperty,
    endProperty,
    priorityProperty: properties.find((property) => ["select", "status"].includes(property.type) && propertyNameIncludes(property, "priorite", "priority")) || null,
    dependencyProperty: properties.find((property) => ["relation", "text"].includes(property.type) && propertyNameIncludes(property, "depend", "bloque", "precedent")) || null,
    durationProperty: properties.find((property) => property.type === "number" && propertyNameIncludes(property, "duree", "duration")) || null,
  };
}

function isDoneStatus(value) {
  const text = normalizeProjectText(value);
  return ["termine", "fini", "fait", "done", "livre", "complete"].some((word) => text.includes(word));
}

function isBlockedStatus(value) {
  const text = normalizeProjectText(value);
  return ["bloque", "blocked", "attente"].some((word) => text.includes(word));
}

function getProjectRowInfo(page, row) {
  const map = getProjectPropertyMap(page?.database);
  const cells = row?.cells || {};
  const status = map.statusProperty ? formatCellValue(cells[map.statusProperty.id], map.statusProperty) : "";
  const done = Boolean(map.doneProperty && cells[map.doneProperty.id]) || isDoneStatus(status);
  const dueIso = map.endProperty ? String(cells[map.endProperty.id] || "") : "";
  const dueDate = parseISODate(dueIso);
  const today = stripTime(new Date());
  const priority = map.priorityProperty ? formatCellValue(cells[map.priorityProperty.id], map.priorityProperty) : "";
  const assigneeValue = map.personProperty ? String(cells[map.personProperty.id] || "") : "";
  const dependencyText = map.dependencyProperty ? formatCellValue(cells[map.dependencyProperty.id], map.dependencyProperty) : "";

  return {
    title: getPrimaryCellValue(page.database, row) || "Sans titre",
    pageId: page.id,
    pageTitle: page.title || "Sans titre",
    rowId: row.id,
    status,
    done,
    blocked: isBlockedStatus(status),
    dueIso,
    dueDate,
    overdue: Boolean(dueDate && dueDate < today && !done),
    assignee: assigneeValue ? formatPersonValue(assigneeValue) : "",
    assigneeValue,
    priority,
    dependencyText,
    map,
  };
}

function personValueMatchesCurrentUser(value) {
  const raw = String(value || "").trim();
  const user = authState.user;
  if (!raw || !user) return false;
  const person = findPersonByValue(raw);
  const candidates = [user.id, user.email, user.displayName, person?.id, person?.email, person?.displayName]
    .filter(Boolean)
    .map(normalizeProjectText);
  const target = normalizeProjectText(raw);
  return candidates.includes(target);
}

function isRowAssignedToCurrentUser(page, row) {
  const { personProperty } = getProjectPropertyMap(page?.database);
  return Boolean(personProperty && personValueMatchesCurrentUser(row?.cells?.[personProperty.id]));
}

function getAllProjectTasks() {
  return getVisiblePages()
    .filter((page) => page.kind === "database" && page.database)
    .flatMap((page) => page.database.rows.map((row) => ({ page, row, info: getProjectRowInfo(page, row) })));
}

function getMyProjectTasks() {
  return getAllProjectTasks()
    .filter(({ page, row }) => isRowAssignedToCurrentUser(page, row))
    .sort((left, right) => {
      if (left.info.overdue !== right.info.overdue) return left.info.overdue ? -1 : 1;
      const leftTime = left.info.dueDate ? left.info.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
      const rightTime = right.info.dueDate ? right.info.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });
}

function renderProjectBadges(info) {
  const wrap = document.createElement("div");
  wrap.className = "project-badges";

  [
    info.overdue ? ["En retard", "overdue"] : null,
    info.blocked ? ["Bloque", "blocked"] : null,
    info.priority ? [`Priorite ${info.priority}`, "priority"] : null,
    info.dependencyText ? [`Depend de ${truncate(info.dependencyText, 28)}`, "dependency"] : null,
  ].filter(Boolean).forEach(([label, tone]) => {
    const badge = document.createElement("span");
    badge.className = `project-badge ${tone}`;
    badge.textContent = label;
    wrap.appendChild(badge);
  });

  return wrap.childElementCount ? wrap : null;
}

function ensureProjectManagementFields(pageId) {
  const page = getPage(pageId);
  if (!page?.database || isPageReadOnly(page)) return;

  updatePage(pageId, (target) => {
    const database = target.database;
    const hasNamed = (type, ...names) => database.properties.some((property) => property.type === type && propertyNameIncludes(property, ...names));
    const hasChoice = (...names) => database.properties.some((property) => ["select", "status"].includes(property.type) && propertyNameIncludes(property, ...names));
    const add = (name, type, options = normalizePropertyOptions(type)) => {
      const property = createProperty(name, type, options);
      database.properties.push(property);
      database.rows.forEach((row) => {
        row.cells[property.id] = getDefaultCellValue(property);
      });
      return property;
    };

    if (!database.properties.some((property) => property.type === "person")) add("Responsable", "person");
    if (!hasChoice("etat", "statut", "status")) add("Etat", "status", PROJECT_STATUS_OPTIONS);
    if (!hasChoice("priorite", "priority")) add("Priorite", "select", PROJECT_PRIORITY_OPTIONS);
    if (!hasNamed("date", "debut", "start")) add("Date de debut", "date");
    if (!hasNamed("date", "fin", "echeance", "deadline")) add("Date de fin", "date");
    if (!hasNamed("number", "duree", "duration")) add("Duree", "number");
    if (!database.properties.some((property) => ["relation", "text"].includes(property.type) && propertyNameIncludes(property, "depend", "bloque", "precedent"))) {
      add("Depend de", "relation");
    }
    reconcileDatabaseViews(database);
  }, "Pilotage projet active");

  toast("Colonnes projet ajoutees.");
  renderMain();
}

function buildMyTasksContent(options = {}) {
  const tasks = getMyProjectTasks();
  const panel = document.createElement("div");
  panel.className = "my-tasks-panel";

  const summary = document.createElement("div");
  summary.className = "my-tasks-summary";
  const overdueCount = tasks.filter(({ info }) => info.overdue).length;
  summary.textContent = tasks.length
    ? `${tasks.length} tache(s) assignee(s), dont ${overdueCount} en retard.`
    : "Aucune tache ne vous est assignee dans ce workspace.";
  panel.appendChild(summary);

  tasks.forEach(({ page, row, info }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `my-task-row ${info.overdue ? "overdue" : ""}`;

    const title = document.createElement("strong");
    title.textContent = info.title;

    const meta = document.createElement("span");
    meta.className = "my-task-meta";
    const parts = [page.title, info.status, info.dueIso ? `Echeance ${info.dueIso}` : ""].filter(Boolean);
    meta.textContent = parts.join(" - ");

    button.append(title, meta);
    const badges = renderProjectBadges(info);
    if (badges) button.appendChild(badges);
    button.addEventListener("click", () => {
      if (options.closeOnOpen !== false) closeModal();
      setActivePage(page.id);
      window.setTimeout(() => openBoardCardModal(page.id, row.id), 80);
    });
    panel.appendChild(button);
  });

  return panel;
}

function openMyTasksModal() {
  openModal({
    kicker: "Projet",
    title: "Mes taches",
    contentBuilder: () => buildMyTasksContent(),
  });
}

function shiftCalendarMonth(pageId, amount) {
  updatePage(pageId, (page) => {
    const view = getActiveDatabaseView(page);
    const base = parseISODate(view?.settings?.month) || new Date();
    base.setMonth(base.getMonth() + amount);
    if (view) view.settings.month = startOfMonthISO(base);
  });
  renderMain();
}

function setCalendarMonthToToday(pageId) {
  updatePage(pageId, (page) => {
    const view = getActiveDatabaseView(page);
    if (view) view.settings.month = startOfMonthISO(new Date());
  });
  renderMain();
}

function moveCalendarRowToDate(pageId, rowId, datePropertyId, isoDate) {
  const page = getPage(pageId);
  if (!page?.database || page.deletedAt || !parseISODate(isoDate)) return;
  const row = page.database.rows.find((candidate) => candidate.id === rowId);
  const property = page.database.properties.find((candidate) => candidate.id === datePropertyId && candidate.type === "date");
  if (!row || !property) return;
  if (row.cells[property.id] === isoDate) return;

  updateCellValue(pageId, rowId, property.id, isoDate, false);
  toast(`Carte deplacee au ${isoDate}.`);
  renderMain();
}

function seedDatabase(pageId) {
  const page = getPage(pageId);
  if (!page || !page.database) return;
  if (page.database.rows.length) {
    toast("Le tableau contient deja des lignes.");
    return;
  }
  const primary = page.database.properties.find((property) => property.type === "text") || page.database.properties[0];
  const select = getFirstPropertyByType(page.database, "select");
  const date = getFirstPropertyByType(page.database, "date");
  const checkbox = getFirstPropertyByType(page.database, "checkbox");
  const presets = [
    ["Priorite 1", "A faire", offsetDate(1), false],
    ["Priorite 2", "En cours", offsetDate(3), false],
    ["Priorite 3", "Termine", offsetDate(6), true],
  ];

  presets.forEach(([title, status, due, done]) => {
    const values = {};
    if (primary) values[primary.name] = title;
    if (select) values[select.name] = status;
    if (date) values[date.name] = due;
    if (checkbox) values[checkbox.name] = done;
    addDatabaseRow(pageId, values);
  });
  toast("Exemples ajoutes dans le tableau.");
}

function showSlashMenu(blockId, rect, filterText = "") {
  ui.slashBlockId = blockId;
  ui.slashAnchorRect = rect;
  elements.slashMenu.innerHTML = "";
  elements.slashMenu.classList.remove("hidden");
  const normalizedFilter = normalizeSearch(filterText);
  const activePage = getActivePage();
  const aiActions = activePage?.kind === "document"
    ? SLASH_AI_ACTIONS.filter((item) => (
      !normalizedFilter ||
      normalizeSearch(item.label).includes(normalizedFilter) ||
      normalizeSearch(item.hint).includes(normalizedFilter) ||
      item.keywords.some((keyword) => normalizeSearch(keyword).includes(normalizedFilter))
    ))
    : [];

  if (aiActions.length) {
    const aiTitle = document.createElement("div");
    aiTitle.className = "menu-section";
    aiTitle.textContent = "IA";
    elements.slashMenu.appendChild(aiTitle);

    aiActions.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "menu-item ai-slash-item";
      button.innerHTML = `<strong>${item.label}</strong><span>${item.hint}</span>`;
      button.addEventListener("click", () => {
        if (!ui.slashBlockId) return;
        executeSlashAiAction(activePage.id, ui.slashBlockId, item.action);
        hideSlashMenu();
      });
      elements.slashMenu.appendChild(button);
    });
  }

  const title = document.createElement("div");
  title.className = "menu-section";
  title.textContent = "Blocs";
  elements.slashMenu.appendChild(title);

  BLOCK_DEFINITIONS
    .filter((definition) => !normalizedFilter || normalizeSearch(definition.label).includes(normalizedFilter) || definition.type.includes(normalizedFilter))
    .forEach((definition) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "menu-item";
      button.innerHTML = `<strong>${definition.label}</strong><span>${definition.hint}</span>`;
      button.addEventListener("click", () => {
        if (!ui.slashBlockId) return;
        setBlockType(getActivePage().id, ui.slashBlockId, definition.type);
        hideSlashMenu();
      });
      elements.slashMenu.appendChild(button);
    });

  positionFloatingMenu(elements.slashMenu, rect.left, rect.bottom + 10);
}

function clearSlashCommandText(pageId, blockId) {
  updatePage(pageId, (target) => {
    const block = target.blocks.find((candidate) => candidate.id === blockId);
    if (block && String(block.text || "").trim().startsWith("/")) {
      block.text = "";
    }
  }, "Commande IA lancee");
}

function executeSlashAiAction(pageId, blockId, action) {
  clearSlashCommandText(pageId, blockId);
  if (action === "assistant") {
    renderMain();
    openAiAssistantModal();
    return;
  }
  if (action === "propose") {
    renderMain();
    void requestAiBlockProposals(pageId);
    return;
  }
  void runPageAiAction(pageId, action);
}

function hideSlashMenu() {
  ui.slashBlockId = null;
  elements.slashMenu.classList.add("hidden");
}

function createPageCreationOptions(parentId = null) {
  return [
    {
      label: "Page",
      hint: "Une page libre avec blocs, titres, texte et checklists.",
      action: () => createNewPage("document", parentId),
    },
    {
      label: "Word",
      hint: "Un vrai mode document: page papier, redaction longue, images et export PDF.",
      action: () => createNewPage("word", parentId),
    },
    {
      label: "Tableau",
      hint: "Un tableau partage avec vues Table, Cartes, Calendrier et Gantt.",
      action: () => createNewPage("database", parentId),
    },
    {
      label: "Excel",
      hint: "Un vrai mode tableur: grille de cellules, lignes numerotees et formules simples.",
      action: () => createNewPage("excel", parentId),
    },
    {
      label: "Modele",
      hint: "Demarrer depuis un modele Flowcean.",
      action: () => openTemplatesModal(parentId),
    },
  ];
}

function openCreatePageMenu(anchor, parentId = null) {
  showContextMenu(anchor, [
    { section: parentId ? "Ajouter dans cette page" : "Nouveau" },
    ...createPageCreationOptions(parentId),
  ]);
}

function openCreatePageModal(parentId = null) {
  openModal({
    kicker: "Creation",
    title: parentId ? "Ajouter une page, Word, Excel ou tableau" : "Creer dans ce workspace",
    contentBuilder: () => {
      const grid = document.createElement("div");
      grid.className = "creation-grid";

      createPageCreationOptions(parentId).forEach((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "creation-card";

        const title = document.createElement("strong");
        title.textContent = option.label;

        const body = document.createElement("span");
        body.textContent = option.hint;

        button.append(title, body);
        button.addEventListener("click", () => {
          closeModal();
          option.action();
        });
        grid.appendChild(button);
      });

      return grid;
    },
  });
}

function openDatabaseViewMenu(pageId, anchor) {
  showContextMenu(anchor, [
    { section: "Nouvelle vue liee" },
    { label: "Table", hint: "Edition detaillee en lignes et colonnes.", action: () => addDatabaseView(pageId, "table") },
    { label: "Cartes", hint: "Colonnes type kanban, regroupees par statut.", action: () => addDatabaseView(pageId, "board") },
    { label: "Calendrier", hint: "Planification par date sur un calendrier.", action: () => addDatabaseView(pageId, "calendar") },
    { label: "Gantt", hint: "Timeline si votre tableau contient des dates.", action: () => addDatabaseView(pageId, "gantt") },
  ]);
}

function openBlockMenu(pageId, blockId, anchor, index) {
  const page = getPage(pageId);
  const block = page?.blocks.find((candidate) => candidate.id === blockId);
  const canUseAi = Boolean(block && !["image", "divider", "table"].includes(block.type));
  showContextMenu(anchor, [
    { section: "Bloc" },
    ...BLOCK_DEFINITIONS.map((definition) => ({
      label: `Transformer en ${definition.label}`,
      hint: definition.hint,
      action: () => setBlockType(pageId, blockId, definition.type),
    })),
    ...(canUseAi ? [
      { section: "IA" },
      { label: "Proposer une modification", hint: "Relire, accepter puis appliquer dans ce bloc.", action: () => { void requestAiBlockProposals(pageId, blockId); } },
      { label: "Ameliorer ce bloc directement", hint: "Remplace immediatement le texte du bloc.", action: () => { void runBlockAiAction(pageId, blockId, "improve"); } },
      { label: "Resumer ce bloc", hint: "Ajoute un resume juste en dessous.", action: () => { void runBlockAiAction(pageId, blockId, "summary"); } },
      { label: "Transformer en taches", hint: "Ajoute une checklist depuis ce bloc.", action: () => { void runBlockAiAction(pageId, blockId, "tasks"); } },
    ] : []),
    { section: "Edition" },
    { label: "Dupliquer", hint: "Creer une copie juste en dessous.", action: () => duplicateBlock(pageId, blockId) },
    { label: "Monter", hint: "Deplacer le bloc vers le haut.", action: () => moveBlock(pageId, blockId, -1), disabled: index === 0 },
    { label: "Descendre", hint: "Deplacer le bloc vers le bas.", action: () => moveBlock(pageId, blockId, 1), disabled: index === getPage(pageId).blocks.length - 1 },
    { label: "Supprimer", hint: "Retirer ce bloc.", action: () => { const focusId = removeBlock(pageId, blockId); renderMain(); if (focusId) focusBlockEditor(focusId); }, danger: true },
  ]);
}

function openPageAiMenu(pageId, anchor) {
  showContextMenu(anchor, [
    { section: "IA de page" },
    { label: "Proposer des modifications", hint: "Affiche une revue bloc par bloc avant application.", action: () => { void requestAiBlockProposals(pageId); } },
    { label: "Resumer la page", hint: "Ajoute un resume structure en bas de page.", action: () => { void runPageAiAction(pageId, "summary"); } },
    { label: "Ameliorer le contenu", hint: "Reecrit la page dans un style plus clair.", action: () => { void runPageAiAction(pageId, "improve"); } },
    { label: "Extraire les taches", hint: "Cree une checklist a partir de la page.", action: () => { void runPageAiAction(pageId, "tasks"); } },
    { label: "Plan de projet", hint: "Genere objectifs, jalons, risques et actions.", action: () => { void runPageAiAction(pageId, "plan"); } },
    { section: "Assistant" },
    { label: "Ouvrir l'assistant IA", hint: "Question libre avec contexte de page.", action: () => openAiAssistantModal() },
  ]);
}

function openDatabaseAiMenu(pageId, rows, anchor) {
  showContextMenu(anchor, [
    { section: "IA du tableau" },
    { label: "Ajouter une colonne Resume IA", hint: "Ajoute une propriete IA qui resume chaque ligne.", action: () => addDatabaseProperty(pageId, "ai_summary") },
    { label: "Ajouter une colonne Traduction IA", hint: "Ajoute une propriete IA de traduction.", action: () => addDatabaseProperty(pageId, "ai_translate") },
    { label: "Remplir les colonnes IA visibles", hint: "Complete les cellules IA vides des lignes filtrees.", action: () => { void fillAiColumnsForRows(pageId, rows); } },
    { section: "Assistant" },
    { label: "Ouvrir l'assistant IA", hint: "Analyser ce tableau avec une demande libre.", action: () => openAiAssistantModal() },
  ]);
}

function openPageMenu(pageId, anchor) {
  const page = getPage(pageId);
  if (!page) return;
  showContextMenu(anchor, [
    { section: "Page" },
    ...(page.kind === "document"
      ? [{ label: "Actions IA", hint: "Resume, taches, plan de projet.", action: () => openPageAiMenu(pageId, anchor) }]
      : [{ label: "Actions IA", hint: "Colonnes IA et analyse du tableau.", action: () => openDatabaseAiMenu(pageId, page.database?.rows || [], anchor) }]),
    { label: "Ajouter page, Word, Excel ou tableau", hint: "Choisir entre page, document Word, tableau, feuille Excel ou modele.", action: () => openCreatePageModal(pageId) },
    { label: "Dupliquer", hint: "Copier la page et ses sous-pages.", action: () => duplicatePage(pageId) },
    ...(page.kind === "document"
      ? [{ label: "Exporter en PDF", hint: "Generer une version imprimable avec texte et images.", action: () => exportDocumentPagePdf(pageId) }]
      : []),
    { label: isPageFavorite(page) ? "Retirer des favoris" : "Ajouter aux favoris", hint: "Mettre a jour votre raccourci personnel.", action: () => { setPageFavorite(page.id, !isPageFavorite(page)); render(); } },
    {
      label: page.deletedAt ? "Restaurer" : "Envoyer a la corbeille",
      hint: page.deletedAt ? "Sortir cette page de la corbeille." : "Masquer la page sans la detruire.",
      action: () => (page.deletedAt ? restorePage(pageId) : movePageToTrash(pageId)),
      danger: !page.deletedAt,
    },
    ...(page.deletedAt ? [{
      label: "Supprimer definitivement",
      hint: "Retirer cette page et ses sous-pages de Flowcean.",
      action: () => permanentlyDeletePage(pageId),
      danger: true,
    }] : []),
  ]);
}

function openPropertyMenu(pageId, anchor) {
  const aiTypes = ["ai_summary", "ai_translate"];
  const standardTypes = PROPERTY_DEFINITIONS.map((definition) => definition.type).filter((type) => !aiTypes.includes(type));
  showContextMenu(anchor, [
    { section: "Remplissage automatique par l'IA" },
    ...aiTypes.map((type) => {
      const definition = getPropertyDefinition(type);
      return { label: definition.label, hint: definition.hint, action: () => addDatabaseProperty(pageId, type) };
    }),
    { section: "Selectionner le type" },
    ...standardTypes.map((type) => {
      const definition = getPropertyDefinition(type);
      return { label: definition.label, hint: definition.hint, action: () => addDatabaseProperty(pageId, type) };
    }),
  ]);
}

function openPropertySettingsMenu(pageId, propertyId, anchor) {
  const page = getPage(pageId);
  const property = page?.database?.properties.find((candidate) => candidate.id === propertyId);
  if (!page || !property) return;
  const activeView = getActiveDatabaseView(page);
  const isFrozen = Boolean(activeView?.settings?.frozenPropertyIds?.includes(propertyId));
  const isHidden = Boolean(activeView?.settings?.hiddenPropertyIds?.includes(propertyId));

  const optionItems = isOptionPropertyType(property.type)
    ? [
        { section: "Options" },
        ...normalizePropertyOptions(property.type, property.options).map((option) => ({
          label: option,
          hint: "Modifier les options de cette propriete.",
          action: () => openPropertyConfigModal(pageId, propertyId),
        })),
      ]
    : [];

  showContextMenu(anchor, [
    {
      summary: {
        icon: propertyTypeIcon(property.type),
        label: property.name || defaultPropertyName(property.type),
        hint: propertyTypeLabel(property.type),
      },
    },
    { label: "Modifier la propriete", hint: "Nom, options, formule ou bouton.", action: () => openPropertyConfigModal(pageId, propertyId) },
    { label: "Modifier le type", hint: propertyTypeLabel(property.type), action: () => openPropertyTypeModal(pageId, propertyId) },
    { label: "Remplissage automatique par l'IA", hint: "Resume ou traduction.", action: () => openPropertyTypeModal(pageId, propertyId, ["ai_summary", "ai_translate"]) },
    ...optionItems,
    { section: "Vue" },
    { label: "Filtrer", hint: "Limiter les lignes visibles dans cette vue.", action: () => { void openDatabaseFilterModal(pageId, propertyId); } },
    { label: "Trier", hint: "Trier les lignes par cette propriete.", action: () => sortDatabaseByProperty(pageId, propertyId) },
    { label: "Grouper", hint: "Basculer la vue Cartes sur cette propriete.", action: () => groupDatabaseByProperty(pageId, propertyId) },
    { label: "Calculer", hint: "Ajoutez une propriete Formule ou Agregation.", action: () => toast("Utilisez Formule ou Agregation pour calculer.") },
    { label: isFrozen ? "Defiger" : "Figer", hint: "Garder cette colonne visible a gauche dans la vue table.", action: () => togglePropertyFrozen(pageId, propertyId) },
    { label: isHidden ? "Afficher" : "Masquer", hint: "Masquer cette propriete dans la vue actuelle.", action: () => togglePropertyHidden(pageId, propertyId) },
    { label: "Renvoyer le contenu a la ligne", hint: "Option d'affichage a venir.", action: () => toast("Le renvoi a la ligne arrive bientot.") },
    { label: "Afficher en tant que", hint: propertyTypeLabel(property.type), meta: propertyTypeLabel(property.type), action: () => openPropertyTypeModal(pageId, propertyId) },
    { section: "Structure" },
    { label: "Inserer a gauche", hint: "Ajouter une propriete texte avant celle-ci.", action: () => insertDatabasePropertyRelative(pageId, propertyId, "left") },
    { label: "Inserer a droite", hint: "Ajouter une propriete texte apres celle-ci.", action: () => insertDatabasePropertyRelative(pageId, propertyId, "right") },
    { label: "Dupliquer la propriete", hint: "Copier la colonne et ses valeurs.", action: () => duplicateDatabaseProperty(pageId, propertyId) },
    { label: "Supprimer la propriete", hint: "Retirer cette colonne du tableau.", action: () => deleteDatabaseProperty(pageId, propertyId), danger: true, disabled: page.database.properties.length <= 1 },
  ]);
}

function getFilterableProperties(database) {
  return database.properties.filter((property) => property.type !== "button");
}

function openDatabaseFilterPickerModal(pageId) {
  const page = getPage(pageId);
  const view = getActiveDatabaseView(page);
  const properties = page?.database ? getFilterableProperties(page.database) : [];
  if (!page || !view || !properties.length) return;

  let propertySelect = null;

  openModal({
    kicker: "Filtre de vue",
    title: "Choisir une propriete",
    contentBuilder: () => {
      const form = document.createElement("form");
      form.className = "property-config-panel";

      const note = document.createElement("div");
      note.className = "property-config-note";
      note.textContent = `Le filtre sera applique uniquement a la vue "${view.name}".`;
      form.appendChild(note);

      propertySelect = document.createElement("select");
      properties.forEach((property) => {
        const option = document.createElement("option");
        option.value = property.id;
        option.textContent = `${property.name || defaultPropertyName(property.type)} - ${propertyTypeLabel(property.type)}`;
        propertySelect.appendChild(option);
      });
      form.appendChild(createPropertyConfigField("Propriete", propertySelect));

      const actions = document.createElement("div");
      actions.className = "modal-actions";

      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "inline-button";
      cancelButton.textContent = "Annuler";
      cancelButton.addEventListener("click", closeModal);

      const nextButton = document.createElement("button");
      nextButton.type = "submit";
      nextButton.className = "primary-button";
      nextButton.textContent = "Continuer";

      actions.append(cancelButton, nextButton);
      form.appendChild(actions);

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const propertyId = propertySelect.value;
        closeModal();
        void openDatabaseFilterModal(pageId, propertyId);
      });

      return form;
    },
    onOpen: () => propertySelect?.focus(),
  });
}

function openDatabaseSortModal(pageId) {
  const page = getPage(pageId);
  const view = getActiveDatabaseView(page);
  if (!page?.database || !view) return;
  let propertySelect = null;
  let directionSelect = null;

  openModal({
    kicker: "Tri de vue",
    title: "Trier les lignes",
    contentBuilder: () => {
      const form = document.createElement("form");
      form.className = "property-config-panel";

      const existing = getDatabaseViewSorts(view);
      const list = document.createElement("div");
      list.className = "sort-list";
      if (!existing.length) {
        const empty = document.createElement("div");
        empty.className = "nav-empty";
        empty.textContent = "Aucun tri applique.";
        list.appendChild(empty);
      }
      existing.forEach((sort) => {
        const property = findPropertyById(page.database, sort.propertyId);
        const item = document.createElement("button");
        item.type = "button";
        item.className = "database-filter-chip";
        item.textContent = `${property?.name || "Propriete"} ${sort.direction === "desc" ? "desc" : "asc"} x`;
        item.addEventListener("click", () => {
          updateDatabaseView(pageId, view.id, (settings) => {
            settings.sorts = getDatabaseViewSorts({ settings }).filter((candidate) => candidate.id !== sort.id);
          }, "Tri retire");
          closeModal();
        });
        list.appendChild(item);
      });

      propertySelect = document.createElement("select");
      page.database.properties.forEach((property) => {
        const option = document.createElement("option");
        option.value = property.id;
        option.textContent = property.name || defaultPropertyName(property.type);
        propertySelect.appendChild(option);
      });
      directionSelect = document.createElement("select");
      [["asc", "Ascendant"], ["desc", "Descendant"]].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        directionSelect.appendChild(option);
      });

      const actions = document.createElement("div");
      actions.className = "modal-actions";
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "inline-button danger";
      clear.textContent = "Effacer les tris";
      clear.addEventListener("click", () => {
        updateDatabaseView(pageId, view.id, (settings) => { settings.sorts = []; }, "Tris effaces");
        closeModal();
      });
      const submit = document.createElement("button");
      submit.type = "submit";
      submit.className = "primary-button";
      submit.textContent = "Ajouter le tri";
      actions.append(clear, submit);

      form.append(list, createPropertyConfigField("Propriete", propertySelect), createPropertyConfigField("Direction", directionSelect), actions);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        updateDatabaseView(pageId, view.id, (settings) => {
          const sorts = getDatabaseViewSorts({ settings }).filter((sort) => sort.propertyId !== propertySelect.value);
          sorts.push({ id: uid("sort"), propertyId: propertySelect.value, direction: directionSelect.value });
          settings.sorts = sorts;
        }, "Tri ajoute");
        closeModal();
      });
      return form;
    },
  });
}

async function openDatabaseFilterModal(pageId, propertyId) {
  const page = getPage(pageId);
  const view = getActiveDatabaseView(page);
  const property = page?.database?.properties.find((candidate) => candidate.id === propertyId);
  if (!page || !view || !property) return;

  if (property.type === "person") {
    try {
      await ensurePeopleDirectoryLoaded();
    } catch (error) {
      toast(error.message || "Impossible de charger les utilisateurs.");
    }
  }

  const filters = getDatabaseViewFilters(view);
  const existingFilter = filters.find((filter) => filter.propertyId === propertyId) || null;
  const operatorOptions = filterOperatorOptions(property);
  const initialOperator = operatorOptions.some(([operator]) => operator === existingFilter?.operator)
    ? existingFilter.operator
    : operatorOptions[0][0];

  let operatorSelect = null;
  let valueSlot = null;
  let valueControl = null;
  let valueField = null;

  openModal({
    kicker: "Filtre de vue",
    title: property.name || defaultPropertyName(property.type),
    contentBuilder: () => {
      const form = document.createElement("form");
      form.className = "property-config-panel";

      const note = document.createElement("div");
      note.className = "property-config-note";
      note.textContent = `Ce filtre s'applique uniquement a la vue "${view.name}".`;
      form.appendChild(note);

      operatorSelect = document.createElement("select");
      operatorOptions.forEach(([operator, label]) => {
        const option = document.createElement("option");
        option.value = operator;
        option.textContent = label;
        option.selected = operator === initialOperator;
        operatorSelect.appendChild(option);
      });
      form.appendChild(createPropertyConfigField("Condition", operatorSelect));

      valueSlot = document.createElement("div");
      valueSlot.className = "filter-value-slot";
      valueField = createPropertyConfigField("Valeur", valueSlot);
      form.appendChild(valueField);

      const renderValueControl = () => {
        valueSlot.innerHTML = "";
        const operator = operatorSelect.value;
        valueField.classList.toggle("hidden", !filterNeedsValue(operator));
        if (!filterNeedsValue(operator)) {
          valueControl = null;
          return;
        }
        valueControl = createFilterValueControl(property, existingFilter?.value || "");
        valueSlot.appendChild(valueControl);
      };

      operatorSelect.addEventListener("change", renderValueControl);
      renderValueControl();

      const actions = document.createElement("div");
      actions.className = "modal-actions";

      if (existingFilter) {
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "inline-button danger";
        deleteButton.textContent = "Supprimer";
        deleteButton.addEventListener("click", () => {
          removeDatabaseViewFilter(pageId, view.id, existingFilter.id);
          closeModal();
        });
        actions.appendChild(deleteButton);
      }

      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "inline-button";
      cancelButton.textContent = "Annuler";
      cancelButton.addEventListener("click", closeModal);

      const saveButton = document.createElement("button");
      saveButton.type = "submit";
      saveButton.className = "primary-button";
      saveButton.textContent = "Appliquer";

      actions.append(cancelButton, saveButton);
      form.appendChild(actions);

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const operator = operatorSelect.value;
        const value = filterNeedsValue(operator) ? readFilterControlValue(valueControl) : "";
        if (filterNeedsValue(operator) && !String(value).trim()) {
          toast("Choisissez une valeur ou utilisez 'est vide'.");
          return;
        }
        upsertDatabaseViewFilter(pageId, view.id, {
          id: existingFilter?.id || uid("filter"),
          propertyId,
          operator,
          value,
        });
        closeModal();
      });

      return form;
    },
    onOpen: () => {
      if (valueControl && typeof valueControl.focus === "function") {
        valueControl.focus();
      } else {
        operatorSelect?.focus();
      }
    },
  });
}

function createFilterValueControl(property, value = "") {
  if (property.type === "date") {
    const input = document.createElement("input");
    input.type = "date";
    input.value = value || "";
    return input;
  }

  if (property.type === "number") {
    const input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    input.value = value || "";
    return input;
  }

  if (["select", "status", "multi_select"].includes(property.type)) {
    const select = document.createElement("select");
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Choisir...";
    select.appendChild(empty);
    normalizePropertyOptions(property.type, property.options).forEach((optionValue) => {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionValue;
      option.selected = optionValue === value;
      select.appendChild(option);
    });
    return select;
  }

  if (property.type === "person") {
    const select = document.createElement("select");
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Choisir un utilisateur...";
    select.appendChild(empty);
    getPeopleOptions().forEach((person) => {
      const option = document.createElement("option");
      option.value = person.id;
      option.textContent = person.email ? `${person.displayName} (${person.email})` : person.displayName;
      option.selected = person.id === value;
      select.appendChild(option);
    });
    return select;
  }

  const input = document.createElement("input");
  input.type = inputTypeForProperty(property.type);
  input.value = value || "";
  input.placeholder = inputPlaceholderForProperty(property.type) || "Valeur du filtre";
  return input;
}

function readFilterControlValue(control) {
  return control ? String(control.value || "").trim() : "";
}

function openPropertyConfigModal(pageId, propertyId) {
  const page = getPage(pageId);
  const property = page?.database?.properties.find((candidate) => candidate.id === propertyId);
  if (!page || !property) return;

  let nameInput = null;
  let configControl = null;

  openModal({
    kicker: "Propriete",
    title: `Modifier ${property.name || defaultPropertyName(property.type)}`,
    contentBuilder: () => {
      const form = document.createElement("form");
      form.className = "property-config-panel";

      nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = property.name || defaultPropertyName(property.type);
      nameInput.placeholder = "Nom de la propriete";

      form.appendChild(createPropertyConfigField("Nom", nameInput));

      const typeInfo = document.createElement("div");
      typeInfo.className = "property-config-note";
      typeInfo.textContent = `${propertyTypeIcon(property.type)} ${propertyTypeLabel(property.type)}`;
      form.appendChild(typeInfo);

      if (CONFIGURABLE_PROPERTY_TYPES.includes(property.type)) {
        if (isOptionPropertyType(property.type)) {
          configControl = document.createElement("textarea");
          configControl.rows = 6;
          configControl.value = property.options.join("\n");
        } else {
          configControl = document.createElement("input");
          configControl.type = "text";
          configControl.value = property.options[0] || "";
        }
        configControl.placeholder = propertyConfigPlaceholder(property.type);
        form.appendChild(createPropertyConfigField(propertyConfigFieldLabel(property.type), configControl));
      }

      const actions = document.createElement("div");
      actions.className = "modal-actions";

      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "inline-button";
      cancelButton.textContent = "Annuler";
      cancelButton.addEventListener("click", closeModal);

      const saveButton = document.createElement("button");
      saveButton.type = "submit";
      saveButton.className = "primary-button";
      saveButton.textContent = "Enregistrer";

      actions.append(cancelButton, saveButton);
      form.appendChild(actions);

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        updateDatabaseProperty(pageId, propertyId, (target) => {
          target.name = nameInput.value.trim() || defaultPropertyName(target.type);
          if (configControl) {
            target.options = parsePropertyConfig(target.type, configControl.value);
          }
        });
        closeModal();
      });

      return form;
    },
    onOpen: () => nameInput?.focus(),
  });
}

function createPropertyConfigField(labelText, control) {
  const label = document.createElement("label");
  label.className = "property-config-field";
  const labelCopy = document.createElement("span");
  labelCopy.textContent = labelText;
  label.append(labelCopy, control);
  return label;
}

function propertyConfigFieldLabel(type) {
  if (isOptionPropertyType(type)) return "Options";
  if (type === "formula") return "Formule";
  if (type === "button") return "Libelle du bouton";
  return "Configuration";
}

function openPropertyTypeModal(pageId, propertyId, allowedTypes = PROPERTY_TYPE_IDS) {
  const page = getPage(pageId);
  const property = page?.database?.properties.find((candidate) => candidate.id === propertyId);
  if (!page || !property) return;

  const definitions = PROPERTY_DEFINITIONS.filter((definition) => allowedTypes.includes(definition.type));
  openModal({
    kicker: "Type de propriete",
    title: property.name || defaultPropertyName(property.type),
    contentBuilder: () => {
      const grid = document.createElement("div");
      grid.className = "property-type-grid";

      definitions.forEach((definition) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `property-type-option ${property.type === definition.type ? "active" : ""}`;

        const icon = document.createElement("span");
        icon.className = "property-type-chip";
        icon.textContent = propertyTypeIcon(definition.type);

        const copy = document.createElement("span");
        const title = document.createElement("strong");
        title.textContent = definition.label;
        const hint = document.createElement("small");
        hint.textContent = definition.hint;
        copy.append(title, hint);

        button.append(icon, copy);
        button.addEventListener("click", () => {
          setDatabasePropertyType(pageId, propertyId, definition.type);
          closeModal();
        });
        grid.appendChild(button);
      });

      return grid;
    },
  });
}

function showContextMenu(anchor, items) {
  elements.contextMenu.innerHTML = "";
  items.forEach((item) => {
    if (item.summary) {
      const summary = document.createElement("div");
      summary.className = "property-menu-summary";

      const icon = document.createElement("span");
      icon.className = "property-type-chip";
      icon.textContent = item.summary.icon || "Aa";

      const copy = document.createElement("div");
      const label = document.createElement("strong");
      label.textContent = item.summary.label;
      const hint = document.createElement("span");
      hint.textContent = item.summary.hint || "";
      copy.append(label, hint);

      summary.append(icon, copy);
      elements.contextMenu.appendChild(summary);
      return;
    }

    if (item.section) {
      const section = document.createElement("div");
      section.className = "menu-section";
      section.textContent = item.section;
      elements.contextMenu.appendChild(section);
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "menu-item";
    if (item.danger) button.style.color = "var(--danger)";
    if (item.disabled) button.disabled = true;
    const line = document.createElement("div");
    line.className = "menu-item-line";
    const label = document.createElement("strong");
    label.textContent = item.label;
    line.appendChild(label);
    if (item.meta) {
      const meta = document.createElement("em");
      meta.textContent = item.meta;
      line.appendChild(meta);
    }
    const hint = document.createElement("span");
    hint.textContent = item.hint || "";
    button.append(line, hint);
    button.addEventListener("click", () => {
      hideContextMenu();
      item.action?.();
    });
    elements.contextMenu.appendChild(button);
  });

  elements.contextMenu.classList.remove("hidden");
  const rect = anchor.getBoundingClientRect();
  positionFloatingMenu(elements.contextMenu, rect.left, rect.bottom + 8);
}

function hideContextMenu() {
  elements.contextMenu.classList.add("hidden");
}

function positionFloatingMenu(menu, x, y) {
  const padding = 14;
  const width = menu.offsetWidth || 280;
  const height = menu.offsetHeight || 320;
  const safeX = Math.min(x, window.innerWidth - width - padding);
  const safeY = Math.min(y, window.innerHeight - height - padding);
  menu.style.left = `${Math.max(padding, safeX)}px`;
  menu.style.top = `${Math.max(padding, safeY)}px`;
}

function openModal({ kicker, title, contentBuilder, onOpen }) {
  elements.modalKicker.textContent = kicker;
  elements.modalTitle.textContent = title;
  elements.modalBody.innerHTML = "";
  const content = contentBuilder();
  if (content) elements.modalBody.appendChild(content);
  elements.modal.classList.remove("hidden");
  ui.modalOpen = true;
  onOpen?.();
}

function closeModal() {
  hideCellDetailPopover(false);
  elements.modal.classList.add("hidden");
  elements.modalBody.innerHTML = "";
  ui.modalOpen = false;
}

function buildSearchContent(initialQuery = "", options = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "user-embedded-panel search-panel";
  const bar = document.createElement("div");
  bar.className = "search-bar";

  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = "Rechercher une page, un bloc ou une entree...";
  input.value = initialQuery;

  const results = document.createElement("div");
  results.className = "search-results";

  const renderResults = () => {
    const matches = searchWorkspace(input.value);
    results.innerHTML = "";
    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "nav-empty";
      empty.textContent = "Aucun resultat.";
      results.appendChild(empty);
      return;
    }

    matches.forEach((match) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "result-row";
      row.addEventListener("click", () => {
        if (options.closeOnSelect !== false) closeModal();
        setActivePage(match.page.id);
      });

      const copy = document.createElement("div");
      copy.className = "result-copy";
      const title = document.createElement("strong");
      title.textContent = match.page.title || "Sans titre";
      const snippet = document.createElement("p");
      snippet.textContent = match.snippet;
      copy.append(title, snippet);

      const meta = document.createElement("div");
      meta.className = "result-meta";
      const badge = document.createElement("span");
      badge.className = "template-badge";
      badge.textContent = pageKindLabel(match.page);
      const path = document.createElement("span");
      path.className = "result-path";
      path.textContent = getPagePath(match.page.id).join(" / ");
      meta.append(badge, path);

      row.append(copy, meta);
      results.appendChild(row);
    });
  };

  input.addEventListener("input", renderResults);
  bar.appendChild(input);
  wrapper.append(bar, results);
  window.setTimeout(() => input.focus(), 30);
  renderResults();
  return wrapper;
}

function openSearchModal(initialQuery = "") {
  openModal({
    kicker: "Commande",
    title: "Recherche globale",
    contentBuilder: () => buildSearchContent(initialQuery),
  });
}

function searchWorkspace(query) {
  const q = query.trim().toLowerCase();
  const pages = getVisiblePages();
  if (!q) {
    return pages
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 8)
      .map((page) => ({
        page,
        snippet: page.kind === "document"
          ? page.blocks.map((block) => block.text).find(Boolean) || "Page"
          : (isSpreadsheetPage(page)
            ? `${page.database.rows.length} lignes x ${page.database.properties.length} colonnes`
            : `${page.database.rows.length} lignes dans le tableau`),
      }));
  }

  return pages
    .map((page) => {
      const title = (page.title || "").toLowerCase();
      const path = getPagePath(page.id).join(" ").toLowerCase();
      let haystack = "";
      if (page.kind === "document") {
        haystack = page.blocks.map((block) => block.text).join(" ").toLowerCase();
      } else {
        haystack = page.database.rows
          .flatMap((row) => page.database.properties.map((property) => formatCellValue(row.cells[property.id], property)))
          .join(" ")
          .toLowerCase();
      }
      const match = title.includes(q) || haystack.includes(q) || path.includes(q);
      if (!match) return null;

      const snippetSource = page.kind === "document"
        ? page.blocks.map((block) => block.text).join(" ")
        : (isSpreadsheetPage(page)
          ? page.database.rows
              .flatMap((row) => page.database.properties.map((property) => formatCellValue(row.cells[property.id], property)))
              .join(" ")
          : page.database.rows.map((row) => getPrimaryCellValue(page.database, row)).join(" • "));

      return {
        page,
        snippet: truncate(snippetSource || pageKindLabel(page), 110),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.page.updatedAt - a.page.updatedAt)
    .slice(0, 20);
}

function buildTemplatesContent(parentId = null) {
  const grid = document.createElement("div");
  grid.className = "template-grid";

  TEMPLATES.forEach((template) => {
    const card = document.createElement("article");
    card.className = "template-card";

    const header = document.createElement("div");
    header.className = "template-card-header";

    const badge = document.createElement("span");
    badge.className = "template-badge";
    badge.textContent = template.badge;

    const title = document.createElement("h3");
    title.textContent = template.name;

    const description = document.createElement("p");
    description.textContent = template.description;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "card-button primary";
    button.textContent = "Creer depuis ce modele";
    button.addEventListener("click", () => createPageFromTemplate(template.id, parentId));

    header.append(badge);
    card.append(header, title, description, button);
    grid.appendChild(card);
  });

  return grid;
}

function openTemplatesModal(parentId = null) {
  openModal({
    kicker: "Bibliotheque",
    title: "Modeles de depart",
    contentBuilder: () => buildTemplatesContent(parentId),
  });
}

function openHelpModal() {
  openModal({
    kicker: "Guide",
    title: "Aide Flowcean",
    contentBuilder: () => {
      const grid = document.createElement("div");
      grid.className = "help-grid";

      [
        ["Edition", "Tapez / dans un bloc pour afficher les types de blocs. Les raccourcis #, ##, - ou [] fonctionnent aussi."],
        ["Tableaux", "Utilisez Table pour l'edition, Cartes pour glisser entre statuts, Calendrier pour planifier et Gantt pour la timeline."],
        ["Sauvegarde", "Les donnees sont stockees durablement dans MySQL via l API PHP locale. Une copie locale reste disponible pour le cache et les exports JSON."],
        ["Portee", "Cette version est une reproduction web locale des fonctions coeur, pas une copie 1:1 du stack Flutter/Rust/cloud officiel."],
      ].forEach(([titleText, bodyText]) => {
        const card = document.createElement("article");
        card.className = "help-card";
        const badge = document.createElement("span");
        badge.className = "help-badge";
        badge.textContent = titleText;
        const title = document.createElement("h3");
        title.textContent = titleText;
        const body = document.createElement("p");
        body.textContent = bodyText;
        card.append(badge, title, body);
        grid.appendChild(card);
      });

      return grid;
    },
  });
}

function openHistoryModal() {
  openModal({
    kicker: "Historique",
    title: "Actions recentes",
    contentBuilder: () => {
      const wrap = document.createElement("div");
      wrap.className = "history-list";
      const entries = undoStack.slice().reverse();
      if (!entries.length) {
        const empty = document.createElement("div");
        empty.className = "nav-empty";
        empty.textContent = "Aucune action a annuler pour l'instant.";
        wrap.appendChild(empty);
        return wrap;
      }
      entries.forEach((entry, index) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "history-item";
        item.innerHTML = `<strong>${entry.label}</strong><span>${formatRelative(entry.createdAt)}</span>`;
        item.addEventListener("click", () => {
          for (let step = 0; step <= index; step += 1) {
            undoLastAction();
          }
        });
        wrap.appendChild(item);
      });
      return wrap;
    },
  });
}

async function openNotificationsModal() {
  if (authState.authenticated) {
    try {
      await refreshAccountNotifications();
    } catch (error) {
      console.error("Failed to load account notifications", error);
      toast("Notifications compte indisponibles pour le moment.");
    }
  }

  openModal({
    kicker: "Notifications",
    title: "Centre de notifications",
    contentBuilder: () => buildNotificationsContent(),
  });
}

function buildNotificationsContent(options = {}) {
  const wrap = document.createElement("div");
  wrap.className = "notification-list";
  const notifications = normalizeNotifications([
    ...(accountNotifications.notifications || []),
    ...(state.notifications || []),
  ]);
  if (!notifications.length) {
    const empty = document.createElement("div");
    empty.className = "nav-empty";
    empty.textContent = "Aucune notification.";
    wrap.appendChild(empty);
    return wrap;
  }

  notifications.forEach((notification) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `notification-item ${notification.read ? "" : "unread"}`;
    item.innerHTML = `<strong>${notification.title}</strong><span>${notification.body || ""}</span><small>${formatRelative(notification.createdAt)}</small>`;
    item.addEventListener("click", async () => {
      if (notification.source === "server") {
        try {
          await markAccountNotificationRead(notification);
        } catch (error) {
          console.error("Failed to mark notification read", error);
        }
      } else {
        markNotificationRead(notification.id);
      }
      if (notification.pageId) {
        if (options.closeOnNavigate !== false) closeModal();
        setActivePage(notification.pageId);
      } else if (notification.payload?.invitationId || notification.type?.startsWith("workspace.invitation")) {
        if (options.openWorkspaceManager) {
          options.openWorkspaceManager();
        } else {
          closeModal();
          await openWorkspaceManager();
        }
      } else if (notification.payload?.workspaceSlug) {
        if (options.closeOnNavigate !== false) closeModal();
        await switchWorkspace(notification.payload.workspaceSlug, { toastMessage: "Workspace charge." });
      }
    });
    wrap.appendChild(item);
  });

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "inline-button";
  clear.textContent = "Tout marquer comme lu";
  clear.addEventListener("click", async () => {
    state.notifications = normalizeNotifications(state.notifications).map((notification) => ({ ...notification, read: true }));
    try {
      await markAllAccountNotificationsRead();
    } catch (error) {
      console.error("Failed to mark account notifications read", error);
    }
    scheduleSave("Notifications lues");
    if (options.closeAfterClear !== false) closeModal();
    render();
  });
  wrap.appendChild(clear);
  return wrap;
}

function markNotificationRead(notificationId) {
  state.notifications = normalizeNotifications(state.notifications).map((notification) => (
    notification.id === notificationId ? { ...notification, read: true } : notification
  ));
  scheduleSave("Notification lue");
}

function exportWorkspace() {
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `flowcean-${toISODate(new Date())}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  toast("Export JSON genere.");
}

function openDatabaseExportMenu(pageId, viewId, anchor) {
  showContextMenu(anchor, [
    { section: "Export" },
    { label: "Exporter la vue en CSV", hint: "Compatible Excel et tableurs.", action: () => exportDatabaseCsv(pageId, viewId) },
    { label: "Imprimer / PDF", hint: "Ouvre la boite d'impression du navigateur.", action: () => exportCurrentPagePdf() },
    { label: "Exporter tout le workspace JSON", hint: "Sauvegarde complete Flowcean.", action: exportWorkspace },
  ]);
}

function exportDatabaseCsv(pageId, viewId = null) {
  const page = getPage(pageId);
  const view = page?.database?.views.find((candidate) => candidate.id === viewId) || getActiveDatabaseView(page);
  if (!page?.database) return;
  const properties = getVisibleTableProperties(page);
  const rows = getVisibleDatabaseRows(page.database, view);
  const lines = [
    properties.map((property) => csvCell(property.name)).join(","),
    ...rows.map((row) => properties.map((property) => csvCell(formatCellValue(row.cells[property.id], property))).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slugifyFileName(page.title || "tableau")}-${toISODate(new Date())}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
  toast("Export CSV genere.");
}

function csvCell(value) {
  const text = isSpreadsheetImageValue(value) ? "[Image]" : String(value || "");
  return `"${text.replace(/"/g, '""')}"`;
}

const XLSX_ENCODER = new TextEncoder();

function xlsxXmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xlsxColumnName(index) {
  return spreadsheetColumnName(index);
}

function xlsxSheetName(value) {
  return (String(value || "Feuille")
    .replace(/[\[\]:*?\/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31)) || "Feuille";
}

function uint8FromString(value) {
  return XLSX_ENCODER.encode(value);
}

function concatUint8Arrays(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

let crcTable = null;

function crc32(bytes) {
  if (!crcTable) {
    crcTable = Array.from({ length: 256 }, (_, index) => {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
      }
      return value >>> 0;
    });
  }
  let crc = 0xFFFFFFFF;
  bytes.forEach((byte) => {
    crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  });
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function zipDateParts(date = new Date()) {
  const time = ((date.getHours() & 0x1F) << 11) | ((date.getMinutes() & 0x3F) << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function createZipBlob(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { time, day } = zipDateParts();

  files.forEach((file) => {
    const nameBytes = uint8FromString(file.name);
    const dataBytes = typeof file.content === "string" ? uint8FromString(file.content) : file.content;
    const crc = crc32(dataBytes);

    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0x0800);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, time);
    writeUint16(localView, 12, day);
    writeUint32(localView, 14, crc);
    writeUint32(localView, 18, dataBytes.length);
    writeUint32(localView, 22, dataBytes.length);
    writeUint16(localView, 26, nameBytes.length);
    writeUint16(localView, 28, 0);
    local.set(nameBytes, 30);
    localParts.push(local, dataBytes);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0x0800);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, time);
    writeUint16(centralView, 14, day);
    writeUint32(centralView, 16, crc);
    writeUint32(centralView, 20, dataBytes.length);
    writeUint32(centralView, 24, dataBytes.length);
    writeUint16(centralView, 28, nameBytes.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, offset);
    central.set(nameBytes, 46);
    centralParts.push(central);

    offset += local.length + dataBytes.length;
  });

  const centralDirectory = concatUint8Arrays(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, files.length);
  writeUint16(endView, 10, files.length);
  writeUint32(endView, 12, centralDirectory.length);
  writeUint32(endView, 16, offset);
  writeUint16(endView, 20, 0);

  return new Blob([...localParts, centralDirectory, end], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function buildXlsxWorksheetXml(page) {
  const rows = page.database.rows.map((row, rowIndex) => {
    const cells = page.database.properties.map((property, columnIndex) => {
      const ref = `${xlsxColumnName(columnIndex)}${rowIndex + 1}`;
      const raw = String(row.cells[property.id] ?? "");
      if (!raw) return "";
      if (isSpreadsheetImageValue(raw)) {
        return `<c r="${ref}" t="inlineStr"><is><t>[Image]</t></is></c>`;
      }
      if (raw.trim().startsWith("=")) {
        const formula = raw.trim().slice(1);
        const computed = formatSpreadsheetComputedValue(computeSpreadsheetCellValue(page, rowIndex, columnIndex));
        return `<c r="${ref}"><f>${xlsxXmlEscape(formula)}</f><v>${xlsxXmlEscape(computed)}</v></c>`;
      }
      const numeric = Number(raw.replace(",", "."));
      if (Number.isFinite(numeric) && raw.trim() !== "") {
        return `<c r="${ref}"><v>${numeric}</v></c>`;
      }
      return `<c r="${ref}" t="inlineStr"><is><t>${xlsxXmlEscape(raw)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");

  const maxColumn = xlsxColumnName(Math.max(0, page.database.properties.length - 1));
  const maxRow = Math.max(1, page.database.rows.length);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:${maxColumn}${maxRow}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <sheetData>${rows}</sheetData>
</worksheet>`;
}

async function exportSpreadsheetXlsx(pageId) {
  const page = getPage(pageId);
  if (!isSpreadsheetPage(page)) {
    toast("L'export XLSX est disponible uniquement pour les feuilles Excel.");
    return;
  }
  ensureSpreadsheetWorkbook(page);
  const safeTitle = xlsxXmlEscape(page.title || "Feuille Flowcean");
  const sheets = page.excelSheets.length ? page.excelSheets : [createSpreadsheetSheet(xlsxSheetName(page.title), page.database)];
  const worksheetOverrides = sheets
    .map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join("\n  ");
  const workbookSheets = sheets
    .map((sheet, index) => `<sheet name="${xlsxXmlEscape(xlsxSheetName(sheet.name || `Feuille ${index + 1}`))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join("");
  const workbookRels = sheets
    .map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`)
    .join("\n  ");
  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${worksheetOverrides}
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
    },
    {
      name: "docProps/core.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${safeTitle}</dc:title>
  <dc:creator>Flowcean</dc:creator>
  <cp:lastModifiedBy>Flowcean</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
</cp:coreProperties>`,
    },
    {
      name: "docProps/app.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Flowcean</Application>
</Properties>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${workbookSheets}</sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${workbookRels}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    {
      name: "xl/styles.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border/></borders>
  <cellStyleXfs count="1"><xf/></cellStyleXfs>
  <cellXfs count="1"><xf xfId="0"/></cellXfs>
</styleSheet>`,
    },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      content: buildXlsxWorksheetXml({ ...page, database: sheet.database }),
    })),
  ];

  const blob = createZipBlob(files);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slugifyFileName(page.title || "feuille-excel")}-${toISODate(new Date())}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
  toast("Export XLSX genere.");
}

async function unzipXlsxEntries(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const entries = new Map();
  let offset = 0;
  const decoder = new TextDecoder();
  while (offset + 30 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const flags = view.getUint16(offset + 6, true);
    const method = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    const compressed = bytes.slice(dataStart, dataEnd);
    let data = compressed;

    if (flags & 0x08) {
      throw new Error("Ce fichier XLSX utilise un mode ZIP non pris en charge par l'import local.");
    }
    if (method === 8) {
      if (typeof DecompressionStream !== "function") {
        throw new Error("Ce navigateur ne sait pas decomprimer ce XLSX. Reexportez-le depuis Flowcean ou utilisez un navigateur recent.");
      }
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      data = new Uint8Array(await new Response(stream).arrayBuffer());
    } else if (method !== 0) {
      throw new Error("Compression XLSX non prise en charge.");
    }
    if (uncompressedSize && data.length !== uncompressedSize) {
      console.warn(`XLSX size mismatch for ${name}`);
    }
    entries.set(name, data);
    offset = dataEnd;
  }
  return entries;
}

function parseXmlText(bytes) {
  const text = new TextDecoder().decode(bytes);
  return new DOMParser().parseFromString(text, "application/xml");
}

function firstXmlText(node, selector) {
  return node.querySelector(selector)?.textContent || "";
}

function parseXlsxCellRef(ref) {
  const match = String(ref || "").replace(/\$/g, "").match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;
  const letters = match[1].toUpperCase();
  let columnIndex = 0;
  for (let index = 0; index < letters.length; index += 1) {
    columnIndex = columnIndex * 26 + (letters.charCodeAt(index) - 64);
  }
  return { columnIndex: columnIndex - 1, rowIndex: Number(match[2]) - 1 };
}

function parseXlsxRangeRef(ref) {
  const [startRef, endRef = startRef] = String(ref || "").split(":");
  const start = parseXlsxCellRef(startRef);
  const end = parseXlsxCellRef(endRef);
  if (!start || !end) return null;
  return {
    startRow: Math.min(start.rowIndex, end.rowIndex),
    endRow: Math.max(start.rowIndex, end.rowIndex),
    startColumn: Math.min(start.columnIndex, end.columnIndex),
    endColumn: Math.max(start.columnIndex, end.columnIndex),
  };
}

function xlsxColumnLabelToIndex(label) {
  let columnIndex = 0;
  String(label || "").toUpperCase().split("").forEach((letter) => {
    columnIndex = columnIndex * 26 + (letter.charCodeAt(0) - 64);
  });
  return columnIndex - 1;
}

function shiftXlsxColumnLabel(label, delta) {
  return spreadsheetColumnName(Math.max(0, xlsxColumnLabelToIndex(label) + delta));
}

function translateXlsxFormulaReference(columnAbsolute, columnLabel, rowAbsolute, rowLabel, deltaColumn, deltaRow) {
  const nextColumn = columnAbsolute ? columnLabel : shiftXlsxColumnLabel(columnLabel, deltaColumn);
  const nextRow = rowAbsolute ? rowLabel : String(Math.max(1, Number(rowLabel) + deltaRow));
  return `${columnAbsolute ? "$" : ""}${nextColumn}${rowAbsolute ? "$" : ""}${nextRow}`;
}

function translateXlsxSharedFormula(formula, sourceRef, targetRef) {
  const source = parseXlsxCellRef(sourceRef);
  const target = parseXlsxCellRef(targetRef);
  if (!source || !target || !formula) return formula;
  const deltaColumn = target.columnIndex - source.columnIndex;
  const deltaRow = target.rowIndex - source.rowIndex;
  const cellReferencePattern = /((?:'[^']+(?:''[^']*)*'|[A-Za-z_][A-Za-z0-9_ .]*)!)?(\$?)([A-Z]{1,3})(\$?)(\d+)/g;

  return String(formula).replace(cellReferencePattern, (match, sheetPrefix = "", columnAbsolute, columnLabel, rowAbsolute, rowLabel, offset, sourceText) => {
    const previous = sourceText[offset - 1] || "";
    const next = sourceText[offset + match.length] || "";
    if (/[A-Za-z0-9_]/.test(previous) || /[A-Za-z0-9_]/.test(next)) return match;
    return `${sheetPrefix}${translateXlsxFormulaReference(columnAbsolute, columnLabel, rowAbsolute, rowLabel, deltaColumn, deltaRow)}`;
  });
}

function restoreXlsxColumnFormulaPatterns(cellValues, maxRow, maxColumn) {
  for (let columnIndex = 0; columnIndex < maxColumn; columnIndex += 1) {
    let sourceRowIndex = -1;
    let sourceFormula = "";
    for (let rowIndex = 0; rowIndex < Math.min(maxRow, 20); rowIndex += 1) {
      const candidate = String(cellValues.get(`${rowIndex}:${columnIndex}`) || "").trim();
      if (candidate.startsWith("=")) {
        sourceRowIndex = rowIndex;
        sourceFormula = candidate.slice(1);
        break;
      }
    }
    if (sourceRowIndex < 0) continue;

    const sourceRef = `${spreadsheetColumnName(columnIndex)}${sourceRowIndex + 1}`;
    for (let rowIndex = sourceRowIndex + 1; rowIndex < maxRow; rowIndex += 1) {
      const key = `${rowIndex}:${columnIndex}`;
      const current = String(cellValues.get(key) || "").trim();
      if (!current || current.startsWith("=")) continue;
      const targetRef = `${spreadsheetColumnName(columnIndex)}${rowIndex + 1}`;
      cellValues.set(key, `=${translateXlsxSharedFormula(sourceFormula, sourceRef, targetRef)}`);
    }
  }
}

function readXlsxCellValue(cell, sharedStrings, sharedFormulas) {
  const formulaElement = cell.querySelector("f");
  const formula = formulaElement?.textContent || "";
  if (formulaElement) {
    const sharedId = formulaElement.getAttribute("si");
    const cellRef = cell.getAttribute("r");
    if (formula) {
      if (formulaElement.getAttribute("t") === "shared" && sharedId) {
        sharedFormulas.set(sharedId, { formula, ref: cellRef, range: formulaElement.getAttribute("ref") || "" });
      }
      return `=${formula}`;
    }
    if (formulaElement.getAttribute("t") === "shared" && sharedId && sharedFormulas.has(sharedId)) {
      const shared = sharedFormulas.get(sharedId);
      return `=${translateXlsxSharedFormula(shared.formula, shared.ref, cellRef)}`;
    }
  }
  const type = cell.getAttribute("t");
  if (type === "inlineStr") return firstXmlText(cell, "is t");
  const value = firstXmlText(cell, "v");
  if (type === "s") return sharedStrings[Number(value)] || "";
  return value;
}

function parseXlsxWorksheetDatabase(sheetBytes, sharedStrings) {
  const sheetXml = parseXmlText(sheetBytes);
  const cellValues = new Map();
  const sharedFormulas = new Map();
  let maxRow = 0;
  let maxColumn = 0;
  sheetXml.querySelectorAll("sheetData c").forEach((cell) => {
    const ref = parseXlsxCellRef(cell.getAttribute("r"));
    if (!ref) return;
    const value = readXlsxCellValue(cell, sharedStrings, sharedFormulas);
    cellValues.set(`${ref.rowIndex}:${ref.columnIndex}`, value);
    maxRow = Math.max(maxRow, ref.rowIndex + 1);
    maxColumn = Math.max(maxColumn, ref.columnIndex + 1);
  });

  sharedFormulas.forEach((shared) => {
    const range = parseXlsxRangeRef(shared.range);
    if (!range) return;
    for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
      for (let columnIndex = range.startColumn; columnIndex <= range.endColumn; columnIndex += 1) {
        const key = `${rowIndex}:${columnIndex}`;
        const current = cellValues.get(key);
        if (!current || String(current).trim().startsWith("=")) continue;
        const targetRef = `${spreadsheetColumnName(columnIndex)}${rowIndex + 1}`;
        cellValues.set(key, `=${translateXlsxSharedFormula(shared.formula, shared.ref, targetRef)}`);
      }
    }
  });
  restoreXlsxColumnFormulaPatterns(cellValues, maxRow, maxColumn);

  maxRow = Math.max(maxRow, 1);
  maxColumn = Math.max(maxColumn, 1);
  const properties = Array.from({ length: maxColumn }, (_, index) => createProperty(spreadsheetColumnName(index), "text"));
  const rows = Array.from({ length: maxRow }, (_, rowIndex) => {
    const values = {};
    properties.forEach((property, columnIndex) => {
      values[property.name] = cellValues.get(`${rowIndex}:${columnIndex}`) || "";
    });
    return values;
  });
  return createDatabase(properties, rows, "table");
}

function resolveXlsxRelationshipTarget(target) {
  if (!target) return "";
  const normalized = target.replace(/^\/+/, "");
  return normalized.startsWith("xl/") ? normalized : `xl/${normalized}`;
}

function parseXlsxWorkbook(buffer) {
  return unzipXlsxEntries(buffer).then((entries) => {
    const sharedStrings = [];
    const sharedBytes = entries.get("xl/sharedStrings.xml");
    if (sharedBytes) {
      const sharedXml = parseXmlText(sharedBytes);
      sharedXml.querySelectorAll("si").forEach((item) => {
        sharedStrings.push(Array.from(item.querySelectorAll("t")).map((node) => node.textContent || "").join(""));
      });
    }

    const relationshipTargets = new Map();
    const relsBytes = entries.get("xl/_rels/workbook.xml.rels");
    if (relsBytes) {
      const relsXml = parseXmlText(relsBytes);
      relsXml.querySelectorAll("Relationship").forEach((relationship) => {
        relationshipTargets.set(relationship.getAttribute("Id"), resolveXlsxRelationshipTarget(relationship.getAttribute("Target")));
      });
    }

    let sheetDefinitions = [];
    const workbookBytes = entries.get("xl/workbook.xml");
    if (workbookBytes) {
      const workbookXml = parseXmlText(workbookBytes);
      sheetDefinitions = Array.from(workbookXml.querySelectorAll("sheets sheet")).map((sheet, index) => ({
        name: sheet.getAttribute("name") || `Feuille ${index + 1}`,
        target: relationshipTargets.get(sheet.getAttribute("r:id")) || `xl/worksheets/sheet${index + 1}.xml`,
      }));
    }

    if (!sheetDefinitions.length) {
      sheetDefinitions = Array.from(entries.keys())
        .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
        .sort()
        .map((target, index) => ({ name: `Feuille ${index + 1}`, target }));
    }

    const sheets = sheetDefinitions
      .map((definition, index) => {
        const sheetBytes = entries.get(definition.target);
        if (!sheetBytes) return null;
        return createSpreadsheetSheet(definition.name || `Feuille ${index + 1}`, parseXlsxWorksheetDatabase(sheetBytes, sharedStrings));
      })
      .filter(Boolean);

    if (!sheets.length) throw new Error("Aucune feuille XLSX lisible trouvee.");
    return {
      sheets,
      activeSheetId: sheets[0].id,
      database: sheets[0].database,
    };
  });
}

function openSpreadsheetXlsxImport(pageId) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) {
      void importSpreadsheetXlsx(file, pageId);
    }
  });
  input.click();
}

async function importSpreadsheetXlsx(file, pageId) {
  if (!file) return;
  try {
    const workbook = await parseXlsxWorkbook(await file.arrayBuffer());
    const page = getPage(pageId);
    if (!isSpreadsheetPage(page)) {
      toast("Import XLSX disponible uniquement dans une feuille Excel Flowcean.");
      return;
    }
    recordUndoSnapshot("Import XLSX");
    page.excelSheets = workbook.sheets;
    page.activeExcelSheetId = workbook.activeSheetId;
    page.database = workbook.database;
    page.title = page.title || file.name.replace(/\.xlsx$/i, "");
    page.updatedAt = Date.now();
    setLocalActiveDatabaseView(page.id, page.database.activeViewId || page.database.views[0]?.id || null);
    scheduleSave("Import XLSX");
    render();
    toast("Fichier XLSX importe.");
  } catch (error) {
    toast(error.message || "Import XLSX impossible.");
  }
}

function slugifyFileName(value) {
  return String(value || "flowcean").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "flowcean";
}

function exportCurrentPagePdf() {
  window.print();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function textToPdfHtml(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function inlineTableToPdfHtml(table) {
  const normalized = normalizeInlineTable(table);
  const header = normalized.columns
    .map((column) => `<th>${textToPdfHtml(column.name || "Colonne")}</th>`)
    .join("");
  const rows = normalized.rows
    .map((row) => `<tr>${normalized.columns.map((column) => `<td>${textToPdfHtml(row.cells[column.id] || "")}</td>`).join("")}</tr>`)
    .join("");
  return `<table class="pdf-inline-table"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
}

function documentBlockToPdfHtml(block, index) {
  const text = textToPdfHtml(block.text || "");
  const richText = block.html || text;
  const empty = '<span class="pdf-muted">Bloc vide</span>';

  switch (block.type) {
    case "h1":
      return `<h1>${richText || empty}</h1>`;
    case "h2":
      return `<h2>${richText || empty}</h2>`;
    case "h3":
      return `<h3>${richText || empty}</h3>`;
    case "bullet":
      return `<ul><li>${richText || empty}</li></ul>`;
    case "numbered":
      return `<ol start="${index + 1}"><li>${richText || empty}</li></ol>`;
    case "todo":
      return `<div class="pdf-todo"><span class="pdf-checkbox">${block.checked ? "✓" : ""}</span><span>${richText || empty}</span></div>`;
    case "quote":
      return `<blockquote>${richText || empty}</blockquote>`;
    case "callout":
      return `<div class="pdf-callout">${richText || empty}</div>`;
    case "code":
      return `<pre><code>${escapeHtml(block.text || "")}</code></pre>`;
    case "table":
      return inlineTableToPdfHtml(block.table);
    case "divider":
      return "<hr>";
    case "image": {
      if (!block.imageData) return '<div class="pdf-image-empty">Image non selectionnee</div>';
      const width = Math.max(20, Math.min(100, Number(block.imageWidth || 100)));
      return `
        <figure class="pdf-image" style="width:${width}%">
          <img src="${escapeHtml(block.imageData)}" alt="${escapeHtml(block.imageName || "Image")}">
        </figure>
      `;
    }
    default:
      return `<p>${richText || empty}</p>`;
  }
}

function buildDocumentPdfHtml(page) {
  const title = escapeHtml(page.title || "Sans titre");
  const updated = formatOceanDate(page.updatedAt || Date.now(), {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }) || new Intl.DateTimeFormat("fr-FR").format(new Date());
  const blocks = isWordPage(page)
    ? normalizeWordPages(page.wordPages, page.wordHtml, page.blocks)
        .map((wordPage) => `<section class="pdf-word-sheet">${wordPage.html || "<p></p>"}</section>`)
        .join("")
    : normalizeBlocks(page.blocks)
        .map((block, index) => documentBlockToPdfHtml(block, index))
        .join("\n");

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page { margin: 18mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111827;
      background: #fff;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 12pt;
      line-height: 1.55;
    }
    .pdf-page { max-width: 860px; margin: 0 auto; }
    .pdf-cover {
      padding-bottom: 20px;
      margin-bottom: 24px;
      border-bottom: 1px solid #d8dee8;
    }
    .pdf-kicker {
      margin: 0 0 8px;
      color: #64748b;
      font: 700 9pt Arial, sans-serif;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .pdf-title {
      margin: 0;
      font-size: 30pt;
      line-height: 1.08;
      color: #0f172a;
    }
    .pdf-meta {
      margin-top: 10px;
      color: #64748b;
      font: 10pt Arial, sans-serif;
    }
    h1, h2, h3 { color: #0f172a; break-after: avoid; }
    h1 { margin: 28px 0 10px; font-size: 24pt; line-height: 1.12; }
    h2 { margin: 24px 0 8px; font-size: 18pt; line-height: 1.2; }
    h3 { margin: 20px 0 6px; font-size: 14pt; line-height: 1.25; }
    p, ul, ol, blockquote, pre, .pdf-callout, .pdf-todo { margin: 10px 0; }
    ul, ol { padding-left: 24px; }
    blockquote {
      padding: 8px 0 8px 16px;
      border-left: 4px solid #94a3b8;
      color: #334155;
    }
    .pdf-callout {
      padding: 12px 14px;
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      background: #eff6ff;
      color: #1e3a8a;
    }
    pre {
      padding: 14px;
      border-radius: 12px;
      background: #0f172a;
      color: #e2e8f0;
      white-space: pre-wrap;
      font: 10pt Consolas, "Courier New", monospace;
    }
    .pdf-inline-table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 10pt;
      page-break-inside: avoid;
    }
    .pdf-inline-table th,
    .pdf-inline-table td {
      border: 1px solid #d1d5db;
      padding: 7px 9px;
      text-align: left;
      vertical-align: top;
    }
    .pdf-inline-table th {
      background: #f3f4f6;
      font-weight: 700;
    }
    hr {
      margin: 22px 0;
      border: 0;
      border-top: 1px solid #cbd5e1;
    }
    .pdf-todo {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    .pdf-checkbox {
      width: 15px;
      height: 15px;
      margin-top: 3px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #64748b;
      border-radius: 3px;
      font: 700 10pt Arial, sans-serif;
    }
    .pdf-image {
      max-width: 100%;
      margin: 14px 0;
      page-break-inside: avoid;
    }
    .pdf-image img {
      display: block;
      width: 100%;
      height: auto;
      border-radius: 12px;
      border: 1px solid #d8dee8;
    }
    .pdf-image-empty, .pdf-muted {
      color: #94a3b8;
      font-style: italic;
    }
    .pdf-word-sheet {
      page-break-after: always;
      break-after: page;
    }
    .pdf-word-sheet:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .word-inline-table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      page-break-inside: avoid;
    }
    .word-inline-table td,
    .word-inline-table th {
      border: 1px solid #d1d5db;
      padding: 7px 9px;
      vertical-align: top;
    }
    .word-image-frame {
      display: block;
      overflow: hidden;
      page-break-inside: avoid;
      border: 1px solid #d8dee8;
      border-radius: 12px;
    }
    .word-image-frame img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .word-image-frame figcaption {
      display: none;
    }
  </style>
</head>
<body>
  <main class="pdf-page">
    <header class="pdf-cover">
      <p class="pdf-kicker">Flowcean - Page exportee</p>
      <h1 class="pdf-title">${title}</h1>
      <div class="pdf-meta">Derniere mise a jour : ${escapeHtml(updated)}</div>
    </header>
    <section>${blocks}</section>
  </main>
</body>
</html>`;
}

function exportDocumentPagePdf(pageId = state.ui.activePageId) {
  const page = getPage(pageId);
  if (!page || page.kind !== "document") {
    toast("L'export PDF est disponible pour les pages classiques.");
    return;
  }

  const printWindow = window.open("", "_blank", "width=980,height=760");
  if (!printWindow) {
    toast("La fenetre d'impression a ete bloquee par le navigateur.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildDocumentPdfHtml(page));
  printWindow.document.close();

  const triggerPrint = () => {
    printWindow.focus();
    printWindow.print();
  };
  const waitForImagesAndPrint = () => {
    const images = Array.from(printWindow.document.images || []);
    if (!images.length) {
      window.setTimeout(triggerPrint, 120);
      return;
    }
    let pending = images.length;
    const done = () => {
      pending -= 1;
      if (pending <= 0) window.setTimeout(triggerPrint, 120);
    };
    images.forEach((image) => {
      if (image.complete) done();
      else {
        image.addEventListener("load", done, { once: true });
        image.addEventListener("error", done, { once: true });
      }
    });
  };
  window.setTimeout(waitForImagesAndPrint, 180);
  toast("Export PDF prepare. Choisissez \"Enregistrer en PDF\" dans la fenetre d'impression.");
}

async function importWorkspace(file) {
  if (!file) return;
  try {
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch (error) {
      console.error(error);
      toast("Import impossible: JSON invalide.");
      return;
    }

    const importedState = normalizeState(parsed);
    const fallbackName = file.name ? file.name.replace(/\.json$/i, "") : "Espace importe";
    const payload = await apiRequest(WORKSPACES_API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "import",
        name: importedState.workspace?.name || fallbackName,
        state: importedState,
      }),
    });
    const nextSlug = applyWorkspaceDirectory(payload, payload.preferredWorkspaceSlug || payload.workspace?.slug);
    if (nextSlug) {
      await switchWorkspace(nextSlug, { skipSave: true, toastMessage: "Workspace importe avec succes." });
    } else {
      await refreshWorkspaceDirectory();
      render();
      toast("Workspace importe avec succes.");
    }
  } catch (error) {
    console.error(error);
    toast(error.message || "Import impossible.");
  } finally {
    elements.importInput.value = "";
  }
}

function toast(message) {
  const item = document.createElement("div");
  item.className = "toast";
  item.textContent = message;
  elements.toastStack.appendChild(item);
  window.setTimeout(() => item.remove(), 2800);
}

function addNotification(notification) {
  state.notifications = normalizeNotifications([
    {
      id: uid("notification"),
      createdAt: Date.now(),
      read: false,
      ...notification,
    },
    ...(state.notifications || []),
  ]);
  scheduleSave("Notification ajoutee");
}

function unreadNotificationCount() {
  return normalizeNotifications(state.notifications).filter((notification) => !notification.read).length
    + Number(accountNotifications.unreadCount || 0);
}

function closeSidebar() {
  elements.sidebar.classList.remove("open");
}

function openSidebar() {
  elements.sidebar.classList.add("open");
}

function sidebarWidthStorageKey() {
  const userKey = authState.user?.id || authState.user?.email || "default";
  return `${SIDEBAR_WIDTH_STORAGE_KEY}:${userKey}`;
}

function getFlowceanUiScale() {
  const rootScale = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--flowcean-ui-scale"));
  return Number.isFinite(rootScale) && rootScale > 0 ? rootScale : 1;
}

function getCurrentSidebarWidth() {
  const cssWidth = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sidebar-width"));
  if (Number.isFinite(cssWidth) && cssWidth > 0) return cssWidth;
  return (elements.sidebar?.getBoundingClientRect().width || SIDEBAR_MIN_WIDTH) / getFlowceanUiScale();
}

function applySidebarWidth(width) {
  const nextWidth = clampNumber(width, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH, getCurrentSidebarWidth());
  document.documentElement.style.setProperty("--sidebar-width", `${Math.round(nextWidth)}px`);
  return nextWidth;
}

function applySavedSidebarWidth() {
  if (window.innerWidth <= 980) return;
  const savedWidth = Number.parseFloat(localStorage.getItem(sidebarWidthStorageKey()) || "");
  if (Number.isFinite(savedWidth)) applySidebarWidth(savedWidth);
}

function persistSidebarWidth(width) {
  localStorage.setItem(sidebarWidthStorageKey(), String(Math.round(width)));
}

function installSidebarResize() {
  const handle = elements.sidebarResizeHandle;
  if (!handle) return;

  handle.addEventListener("pointerdown", (event) => {
    if (window.innerWidth <= 980) return;
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = getCurrentSidebarWidth();
    const scale = getFlowceanUiScale();
    let nextWidth = startWidth;

    document.body.classList.add("sidebar-resizing");
    handle.setPointerCapture(event.pointerId);

    const onMove = (moveEvent) => {
      nextWidth = applySidebarWidth(startWidth + ((moveEvent.clientX - startX) / scale));
    };

    const onUp = (upEvent) => {
      handle.releasePointerCapture(upEvent.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      document.body.classList.remove("sidebar-resizing");
      persistSidebarWidth(nextWidth);
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  });

  handle.addEventListener("dblclick", () => {
    document.documentElement.style.removeProperty("--sidebar-width");
    localStorage.removeItem(sidebarWidthStorageKey());
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 980) applySavedSidebarWidth();
  });
}

function truncate(text, length = 90) {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

const USER_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris";

function parseOceanDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value);
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const normalized = text.replace(" ", "T");
  const withTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : `${normalized}Z`;
  const date = new Date(withTimezone);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatOceanDate(value, options = {}) {
  const date = parseOceanDateTime(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: USER_TIME_ZONE, ...options }).format(date);
}

function formatRelative(value) {
  if (!value) return "a l'instant";
  const date = parseOceanDateTime(value);
  if (!date) return "a l'instant";
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "a l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `il y a ${days} j`;
  return formatOceanDate(date);
}

function offsetDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function parseISODate(value) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDurationDays(value) {
  const duration = Number.parseFloat(String(value || "").replace(",", "."));
  return Number.isFinite(duration) && duration > 0 ? Math.ceil(duration) : null;
}

function stripTime(date) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy;
}

function addDays(date, days) {
  const copy = stripTime(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function diffInDays(leftDate, rightDate) {
  const left = stripTime(leftDate);
  const right = stripTime(rightDate);
  const leftUtc = Date.UTC(left.getFullYear(), left.getMonth(), left.getDate());
  const rightUtc = Date.UTC(right.getFullYear(), right.getMonth(), right.getDate());
  return Math.round((leftUtc - rightUtc) / 86400000);
}

function startOfMonthISO(date) {
  const copy = new Date(date);
  copy.setDate(1);
  return toISODate(copy);
}

function firstDayOfMonth(date) {
  const copy = new Date(date);
  copy.setDate(1);
  copy.setHours(12, 0, 0, 0);
  return copy;
}

function startOfCalendarGrid(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const normalized = day === 0 ? 6 : day - 1;
  copy.setDate(copy.getDate() - normalized);
  return copy;
}

function formatMonth(date) {
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function getSecondaryCalendarMeta(database, row, datePropertyId) {
  const selectProperty = getGroupableProperties(database)[0];
  const bits = [];
  if (selectProperty && row.cells[selectProperty.id]) bits.push(formatCellValue(row.cells[selectProperty.id], selectProperty));
  if (row.cells[datePropertyId]) bits.push(row.cells[datePropertyId]);
  return bits.join(" • ");
}

async function apiRequest(url, options = {}) {
  const { headers: optionHeaders = {}, ...fetchOptions } = options;
  const response = await fetch(url, {
    ...fetchOptions,
    credentials: "same-origin",
    headers: oceanErpAuthHeaders({
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...optionHeaders,
    }),
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch (error) {
    payload = {};
  }

  if (!response.ok || payload.ok === false) {
    const message = payload.message || `HTTP ${response.status}`;
    const enriched = new Error(message);
    enriched.status = response.status;
    enriched.payload = payload;
    throw enriched;
  }

  return payload;
}

function extractPageTextForAi(page = getActivePage()) {
  if (!page) return "";
  if (page.kind === "database" && page.database) {
    const headers = page.database.properties.map((property) => property.name).join(" | ");
    const rows = page.database.rows.slice(0, 80).map((row) => (
      page.database.properties
        .map((property) => formatCellValue(row.cells[property.id], property))
        .join(" | ")
    ));
    return [`Tableau: ${page.title || "Sans titre"}`, headers, ...rows].filter(Boolean).join("\n");
  }

  return (page.blocks || []).map((block) => {
    if (block.type === "image") return block.imageName ? `[Image: ${block.imageName}]` : "[Image]";
    if (block.type === "divider") return "---";
    if (block.type === "table") {
      const table = normalizeInlineTable(block.table);
      const headers = table.columns.map((column) => column.name).join(" | ");
      const rows = table.rows.map((row) => table.columns.map((column) => row.cells[column.id] || "").join(" | "));
      return [headers, ...rows].join("\n");
    }
    return block.text || "";
  }).filter(Boolean).join("\n\n");
}

function insertAiAnswerIntoPage(answer) {
  const page = getActivePage();
  if (!page || page.kind !== "document" || page.deletedAt || !String(answer || "").trim()) {
    toast("Le resultat IA est pret, mais il ne peut etre insere que dans une page classique.");
    return;
  }

  updatePage(page.id, (target) => {
    target.blocks.push(createBlock("paragraph", String(answer).trim()));
  }, "Resultat IA insere");
  renderMain();
}

async function loadAiSettings() {
  const payload = await apiRequest(AI_API_URL);
  return payload.settings || {};
}

async function saveAiSettings({ apiKey, model }) {
  openErpAiSettings();
  return loadAiSettings();
}

async function deleteAiSettings() {
  openErpAiSettings();
  return loadAiSettings();
}

async function runAiCompletion({ task, prompt, context }) {
  const payload = await apiRequest(AI_API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "complete",
      task,
      prompt,
      context,
    }),
  });
  return payload.answer || "";
}

async function testAiConnection() {
  const payload = await apiRequest(AI_API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "test", prompt: "test" }),
  });
  return payload.answer || "";
}

function appendDocumentBlock(pageId, type, text, saveMessage = "Bloc IA ajoute") {
  const page = getPage(pageId);
  if (!page || page.kind !== "document" || page.deletedAt) return null;
  let blockId = null;
  updatePage(pageId, (target) => {
    const block = createBlock(type, text);
    target.blocks.push(block);
    blockId = block.id;
  }, saveMessage);
  renderMain();
  if (blockId) focusBlockEditor(blockId);
  return blockId;
}

function insertBlocksAfterBlock(pageId, blockId, blocks, saveMessage = "Blocs IA ajoutes") {
  const page = getPage(pageId);
  if (!page || page.kind !== "document" || page.deletedAt || !blocks.length) return;
  updatePage(pageId, (target) => {
    const index = target.blocks.findIndex((candidate) => candidate.id === blockId);
    const insertIndex = index >= 0 ? index + 1 : target.blocks.length;
    target.blocks.splice(insertIndex, 0, ...blocks);
  }, saveMessage);
  renderMain();
  focusBlockEditor(blocks[0].id);
}

function parseAiTasksToBlocks(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•\d.\s[\]xX]+/, "").trim())
    .filter(Boolean);
  return (lines.length ? lines : [String(text || "").trim()].filter(Boolean))
    .map((line) => createBlock("todo", line, { checked: false }));
}

function getAiEditableBlocks(page, onlyBlockId = null) {
  if (!page || page.kind !== "document") return [];
  return (page.blocks || [])
    .filter((block) => (!onlyBlockId || block.id === onlyBlockId))
    .filter((block) => AI_EDITABLE_BLOCK_TYPES.includes(block.type))
    .filter((block) => String(block.text || "").trim().length > 0);
}

function extractAiJsonPayload(answer) {
  const text = String(answer || "").trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const firstArray = text.indexOf("[");
  const lastArray = text.lastIndexOf("]");
  const firstObject = text.indexOf("{");
  const lastObject = text.lastIndexOf("}");
  const candidate = firstArray >= 0 && lastArray > firstArray
    ? text.slice(firstArray, lastArray + 1)
    : (firstObject >= 0 && lastObject > firstObject ? text.slice(firstObject, lastObject + 1) : text);
  return JSON.parse(candidate);
}

function normalizeAiBlockProposals(page, payload) {
  const rawList = Array.isArray(payload) ? payload : (Array.isArray(payload?.proposals) ? payload.proposals : []);
  const byId = new Map(getAiEditableBlocks(page).map((block) => [block.id, block]));
  const seen = new Set();
  return rawList
    .map((item) => {
      const id = String(item?.id || item?.blockId || "").trim();
      const block = byId.get(id);
      const replacement = String(item?.replacement || item?.text || item?.proposed || "").trim();
      if (!block || !replacement || seen.has(id) || replacement === String(block.text || "").trim()) return null;
      seen.add(id);
      return {
        id,
        type: block.type,
        original: block.text || "",
        replacement,
        reason: String(item?.reason || item?.why || "Correction et clarification proposees par l'IA.").trim(),
      };
    })
    .filter(Boolean);
}

async function requestAiBlockProposals(pageId, onlyBlockId = null) {
  const page = getPage(pageId);
  if (!page || page.kind !== "document" || page.deletedAt) return;
  const blocks = getAiEditableBlocks(page, onlyBlockId);
  if (!blocks.length) {
    toast("Aucun bloc texte a proposer a l'IA.");
    return;
  }

  const context = JSON.stringify({
    pageTitle: page.title || "Sans titre",
    blocks: blocks.slice(0, 80).map((block) => ({
      id: block.id,
      type: block.type,
      text: block.text || "",
    })),
  }, null, 2);
  const prompt = [
    "Analyse ces blocs Flowcean et propose uniquement les modifications utiles.",
    "Tu dois conserver les ids fournis, ne pas fusionner les blocs et ne pas creer de nouveaux blocs.",
    "Reponds uniquement avec un tableau JSON valide au format:",
    '[{"id":"id-du-bloc","replacement":"nouveau texte complet du bloc","reason":"raison courte"}]',
    "Si aucun changement utile n'est necessaire, reponds avec [].",
  ].join("\n");

  toast("IA en train de preparer des propositions...");
  try {
    const answer = await runAiCompletion({ task: "patch", prompt, context });
    const proposals = normalizeAiBlockProposals(page, extractAiJsonPayload(answer));
    if (!proposals.length) {
      toast("L'IA ne propose pas de modification utile.");
      return;
    }
    openAiBlockProposalModal(pageId, proposals);
  } catch (error) {
    toast(`Propositions IA impossibles: ${error.message}`);
  }
}

function applyAiBlockProposals(pageId, proposals, saveMessage = "Propositions IA appliquees") {
  const list = proposals
    .map((proposal) => ({
      id: proposal.id,
      replacement: String(proposal.replacement || "").trim(),
    }))
    .filter((proposal) => proposal.id && proposal.replacement);
  if (!list.length) return;

  updatePage(pageId, (target) => {
    list.forEach((proposal) => {
      const block = target.blocks.find((candidate) => candidate.id === proposal.id);
      if (block && AI_EDITABLE_BLOCK_TYPES.includes(block.type)) {
        block.text = proposal.replacement;
      }
    });
  }, saveMessage);
  renderMain();
  toast(list.length > 1 ? "Propositions IA appliquees." : "Proposition IA appliquee.");
}

function openAiBlockProposalModal(pageId, proposals) {
  const page = getPage(pageId);
  if (!page) return;
  const remaining = new Map(proposals.map((proposal) => [proposal.id, { ...proposal }]));

  openModal({
    kicker: "Revue IA",
    title: "Propositions de modification",
    contentBuilder: () => {
      const wrapper = document.createElement("div");
      wrapper.className = "ai-proposal-panel";

      const intro = document.createElement("p");
      intro.className = "admin-hint";
      intro.textContent = "Relisez les propositions. Rien n'est applique tant que vous n'acceptez pas une modification.";

      const list = document.createElement("div");
      list.className = "ai-proposal-list";

      const refreshEmptyState = () => {
        if (remaining.size || list.querySelector(".ai-proposal-empty")) return;
        const empty = document.createElement("div");
        empty.className = "ai-proposal-empty";
        empty.textContent = "Toutes les propositions ont ete traitees.";
        list.appendChild(empty);
      };

      proposals.forEach((proposal) => {
        const card = document.createElement("section");
        card.className = "ai-proposal-card";
        card.dataset.blockId = proposal.id;

        const header = document.createElement("div");
        header.className = "ai-proposal-header";
        const title = document.createElement("strong");
        title.textContent = getBlockLabel(proposal.type);
        const reason = document.createElement("span");
        reason.textContent = proposal.reason;
        header.append(title, reason);

        const compare = document.createElement("div");
        compare.className = "ai-proposal-compare";

        const original = document.createElement("div");
        original.className = "ai-proposal-text original";
        const originalLabel = document.createElement("span");
        originalLabel.textContent = "Actuel";
        const originalText = document.createElement("pre");
        originalText.textContent = proposal.original;
        original.append(originalLabel, originalText);

        const proposed = document.createElement("label");
        proposed.className = "ai-proposal-text proposed";
        const proposedLabel = document.createElement("span");
        proposedLabel.textContent = "Propose";
        const textarea = document.createElement("textarea");
        textarea.value = proposal.replacement;
        textarea.rows = Math.min(10, Math.max(4, proposal.replacement.split(/\r?\n/).length + 1));
        textarea.addEventListener("input", () => {
          const current = remaining.get(proposal.id);
          if (current) current.replacement = textarea.value;
        });
        proposed.append(proposedLabel, textarea);

        compare.append(original, proposed);

        const actions = document.createElement("div");
        actions.className = "modal-actions";

        const reject = document.createElement("button");
        reject.type = "button";
        reject.className = "inline-button";
        reject.textContent = "Ignorer";
        reject.addEventListener("click", () => {
          remaining.delete(proposal.id);
          card.remove();
          refreshEmptyState();
        });

        const accept = document.createElement("button");
        accept.type = "button";
        accept.className = "inline-button primary";
        accept.textContent = "Accepter";
        accept.addEventListener("click", () => {
          const current = remaining.get(proposal.id);
          if (!current) return;
          applyAiBlockProposals(pageId, [current], "Proposition IA appliquee");
          remaining.delete(proposal.id);
          closeModal();
        });

        actions.append(reject, accept);
        card.append(header, compare, actions);
        list.appendChild(card);
      });

      const footer = document.createElement("div");
      footer.className = "modal-actions ai-proposal-footer";

      const close = document.createElement("button");
      close.type = "button";
      close.className = "inline-button";
      close.textContent = "Fermer";
      close.addEventListener("click", closeModal);

      const applyAll = document.createElement("button");
      applyAll.type = "button";
      applyAll.className = "inline-button primary";
      applyAll.textContent = "Tout accepter";
      applyAll.addEventListener("click", () => {
        applyAiBlockProposals(pageId, Array.from(remaining.values()));
        closeModal();
      });

      footer.append(close, applyAll);
      wrapper.append(intro, list, footer);
      return wrapper;
    },
  });
}

function getBlockLabel(type) {
  return BLOCK_DEFINITIONS.find((definition) => definition.type === type)?.label || "Bloc";
}

async function runPageAiAction(pageId, action) {
  const page = getPage(pageId);
  if (!page || page.deletedAt) return;
  const context = extractPageTextForAi(page);
  if (!context.trim()) {
    toast("Cette page est vide, l'IA n'a rien a analyser.");
    return;
  }

  const tasks = {
    summary: {
      task: "summary",
      prompt: "Resume cette page en francais avec les decisions, points importants et prochaines actions.",
      insertType: "callout",
      message: "Resume IA ajoute",
    },
    improve: {
      task: "improve",
      prompt: "Reecris le contenu de cette page dans un francais plus clair, structure et professionnel.",
      insertType: "paragraph",
      message: "Texte ameliore par IA ajoute",
    },
    tasks: {
      task: "tasks",
      prompt: "Extrais les actions concretes de cette page. Une action par ligne, sans introduction.",
      insertType: "todo",
      message: "Taches IA ajoutees",
    },
    plan: {
      task: "plan",
      prompt: "Transforme cette page en plan de projet: objectifs, jalons, risques, dependances, prochaines actions.",
      insertType: "callout",
      message: "Plan projet IA ajoute",
    },
  };
  const config = tasks[action];
  if (!config) return;

  toast("IA en cours...");
  try {
    const answer = await runAiCompletion({ task: config.task, prompt: config.prompt, context });
    if (config.insertType === "todo") {
      const blocks = parseAiTasksToBlocks(answer);
      updatePage(pageId, (target) => {
        target.blocks.push(...blocks);
      }, config.message);
      renderMain();
      if (blocks[0]) focusBlockEditor(blocks[0].id);
    } else {
      appendDocumentBlock(pageId, config.insertType, answer, config.message);
    }
    toast(config.message);
  } catch (error) {
    toast(error.message);
  }
}

async function runBlockAiAction(pageId, blockId, action) {
  const page = getPage(pageId);
  const block = page?.blocks.find((candidate) => candidate.id === blockId);
  if (!page || !block || page.deletedAt) return;
  const text = String(block.text || "").trim();
  if (!text) {
    toast("Ce bloc est vide.");
    return;
  }

  const actions = {
    improve: {
      task: "improve",
      prompt: "Ameliore ce texte en francais, corrige les fautes et garde le sens.",
      mode: "replace",
      message: "Bloc ameliore par IA",
    },
    summary: {
      task: "summary",
      prompt: "Resume ce texte en une version courte et claire.",
      mode: "insert",
      type: "callout",
      message: "Resume du bloc ajoute",
    },
    tasks: {
      task: "tasks",
      prompt: "Transforme ce texte en actions concretes. Une action par ligne, sans introduction.",
      mode: "tasks",
      message: "Actions IA ajoutees",
    },
  };
  const config = actions[action];
  if (!config) return;

  toast("IA en cours...");
  try {
    const answer = await runAiCompletion({ task: config.task, prompt: config.prompt, context: text });
    if (config.mode === "replace") {
      updatePage(pageId, (target) => {
        const current = target.blocks.find((candidate) => candidate.id === blockId);
        if (current) current.text = answer.trim();
      }, config.message);
      renderMain();
      focusBlockEditor(blockId);
    } else if (config.mode === "tasks") {
      insertBlocksAfterBlock(pageId, blockId, parseAiTasksToBlocks(answer), config.message);
    } else {
      insertBlocksAfterBlock(pageId, blockId, [createBlock(config.type || "paragraph", answer.trim())], config.message);
    }
    toast(config.message);
  } catch (error) {
    toast(error.message);
  }
}

function getRowContextForAi(database, row, excludedPropertyId = null) {
  return database.properties
    .filter((property) => property.id !== excludedPropertyId && !["button", "identifier", "rollup", "formula", "ai_summary", "ai_translate"].includes(property.type))
    .map((property) => `${property.name}: ${formatCellValue(row.cells[property.id], property) || "-"}`)
    .join("\n");
}

async function generateAiCellValue(pageId, rowId, propertyId, options = {}) {
  const page = getPage(pageId);
  const row = page?.database?.rows.find((candidate) => candidate.id === rowId);
  const property = page?.database?.properties.find((candidate) => candidate.id === propertyId);
  if (!page || !row || !property || isPageReadOnly(page)) return;
  const shouldRender = options.render !== false;
  const silent = options.silent === true;

  const context = getRowContextForAi(page.database, row, property.id);
  if (!context.trim()) {
    toast("Cette ligne est vide.");
    return;
  }

  const prompt = property.type === "ai_translate"
    ? "Traduis les informations utiles de cette ligne en francais naturel. Reponds uniquement avec la traduction."
    : "Resume cette ligne en une phrase courte et utile. Reponds uniquement avec le resume.";
  const task = property.type === "ai_translate" ? "translate" : "summary";

  if (!silent) toast("Cellule IA en cours...");
  try {
    const answer = await runAiCompletion({ task, prompt, context });
    updateCellValue(page.id, row.id, property.id, answer.trim(), shouldRender);
    if (!silent) toast("Cellule IA remplie.");
  } catch (error) {
    toast(error.message);
  }
}

async function fillAiColumnsForRows(pageId, rows = []) {
  const page = getPage(pageId);
  if (!page?.database || isPageReadOnly(page)) return;
  const aiProperties = page.database.properties.filter((property) => ["ai_summary", "ai_translate"].includes(property.type));
  if (!aiProperties.length) {
    toast("Ajoutez d'abord une propriete IA.");
    return;
  }

  const targetRows = rows.length ? rows : page.database.rows;
  toast("Remplissage IA du tableau...");
  for (const row of targetRows.slice(0, 30)) {
    for (const property of aiProperties) {
      if (!String(row.cells[property.id] || "").trim()) {
        await generateAiCellValue(pageId, row.id, property.id, { render: false, silent: true });
      }
    }
  }
  renderMain();
  toast("Remplissage IA termine.");
}

function openAiAssistantModal() {
  let lastAnswer = "";

  openModal({
    kicker: "Assistant IA",
    title: "Assistant IA ERP",
    contentBuilder: () => {
      const panel = document.createElement("div");
      panel.className = "ai-panel";

      const intro = document.createElement("p");
      intro.className = "admin-hint";
      intro.textContent = "L'assistant utilise la configuration Groq definie dans Parametres > IA de l'ERP. La cle reste protegee cote serveur et n'est jamais envoyee a Flowcean.";

      const settingsCard = document.createElement("section");
      settingsCard.className = "ai-card";

      const status = document.createElement("div");
      status.className = "ai-status";
      status.textContent = "Chargement des parametres IA...";

      const form = document.createElement("form");
      form.className = "ai-settings-form";

      const modelInput = document.createElement("input");
      modelInput.type = "text";
      modelInput.placeholder = "Modele Groq";
      modelInput.value = "llama-3.3-70b-versatile";
      modelInput.disabled = true;

      const saveButton = document.createElement("button");
      saveButton.type = "submit";
      saveButton.className = "card-button primary";
      saveButton.textContent = "Ouvrir les parametres IA";

      const testButton = document.createElement("button");
      testButton.type = "button";
      testButton.className = "card-button";
      testButton.textContent = "Tester";

      form.append(modelInput, saveButton, testButton);
      settingsCard.append(status, form);

      const promptCard = document.createElement("section");
      promptCard.className = "ai-card";

      const taskSelect = document.createElement("select");
      taskSelect.className = "ai-task-select";
      [
        ["chat", "Question libre"],
        ["summary", "Resumer la page active"],
        ["improve", "Ameliorer le texte"],
        ["tasks", "Extraire les actions projet"],
        ["plan", "Creer un plan projet"],
        ["translate", "Traduire en francais"],
      ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        taskSelect.appendChild(option);
      });

      const promptInput = document.createElement("textarea");
      promptInput.className = "ai-prompt";
      promptInput.placeholder = "Ex: resume cette page, reformule ce texte, propose les prochaines actions...";
      promptInput.rows = 5;

      const includeContext = document.createElement("label");
      includeContext.className = "ai-checkbox";
      const includeContextInput = document.createElement("input");
      includeContextInput.type = "checkbox";
      includeContextInput.checked = true;
      const includeContextText = document.createElement("span");
      includeContextText.textContent = "Inclure le contenu de la page active";
      includeContext.append(includeContextInput, includeContextText);

      const runButton = document.createElement("button");
      runButton.type = "button";
      runButton.className = "card-button primary";
      runButton.textContent = "Lancer l'IA";

      const result = document.createElement("textarea");
      result.className = "ai-result";
      result.placeholder = "La reponse IA apparaitra ici...";
      result.rows = 9;

      const resultActions = document.createElement("div");
      resultActions.className = "modal-actions";

      const insertButton = document.createElement("button");
      insertButton.type = "button";
      insertButton.className = "inline-button";
      insertButton.textContent = "Inserer dans la page";

      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "inline-button";
      copyButton.textContent = "Copier";

      resultActions.append(insertButton, copyButton);
      promptCard.append(taskSelect, promptInput, includeContext, runButton, result, resultActions);

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        openErpAiSettings();
      });

      testButton.addEventListener("click", async () => {
        testButton.disabled = true;
        try {
          const answer = await testAiConnection();
          result.value = answer;
          lastAnswer = answer;
          status.textContent = "Connexion Groq valide.";
        } catch (error) {
          status.textContent = error.message;
          toast(error.message);
        } finally {
          testButton.disabled = false;
        }
      });

      runButton.addEventListener("click", async () => {
        runButton.disabled = true;
        result.value = "Generation en cours...";
        try {
          const answer = await runAiCompletion({
            task: taskSelect.value,
            prompt: promptInput.value.trim(),
            context: includeContextInput.checked ? extractPageTextForAi() : "",
          });
          lastAnswer = answer;
          result.value = answer;
        } catch (error) {
          result.value = "";
          toast(error.message);
        } finally {
          runButton.disabled = false;
        }
      });

      insertButton.addEventListener("click", () => insertAiAnswerIntoPage(result.value || lastAnswer));
      copyButton.addEventListener("click", async () => {
        const text = result.value || lastAnswer;
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
          toast("Resultat IA copie.");
        } catch (error) {
          toast("Copie impossible dans ce navigateur.");
        }
      });

      void loadAiSettings()
        .then((settings) => {
          modelInput.value = settings.model || "llama-3.3-70b-versatile";
          status.textContent = settings.isEnabled && settings.hasApiKey
            ? `IA ERP active - modele ${modelInput.value}`
            : (settings.isEnabled ? "IA ERP active, mais aucune cle Groq n'est configuree." : "IA ERP desactivee dans les parametres.");
        })
        .catch((error) => {
          status.textContent = error.message;
        });

      panel.append(intro, settingsCard, promptCard);
      return panel;
    },
  });
}

function formatRoleLabel(role) {
  if (role === "super") return "Super-utilisateur";
  return role === "admin" ? "Administrateur" : "Membre";
}

function showAuthMessage(message) {
  elements.authMessage.textContent = message;
  elements.authMessage.classList.remove("hidden");
}

function clearAuthMessage() {
  elements.authMessage.textContent = "";
  elements.authMessage.classList.add("hidden");
}

function showAuthScreen() {
  elements.authScreen.classList.remove("hidden");
  elements.appShell.classList.add("hidden");
}

function showAppShell() {
  elements.authScreen.classList.add("hidden");
  elements.appShell.classList.remove("hidden");
}

function applyAuthState(payload) {
  authState = {
    authenticated: Boolean(payload.authenticated),
    needsSetup: Boolean(payload.needsSetup),
    user: payload.user || null,
  };

  if (!authState.authenticated) {
    stopAccountNotificationPolling();
    workspaceDirectory = {
      workspaces: [],
      deletedWorkspaces: [],
      pendingInvitations: [],
      activeWorkspaceSlug: null,
    };
    peopleDirectory = {
      users: [],
      loaded: false,
    };
    accountNotifications = {
      notifications: [],
      unreadCount: 0,
      loaded: false,
    };
    peopleDirectoryPromise = null;
    peopleDirectoryRenderQueued = false;
    realtimePresence = [];
    realtimePresenceKey = "[]";
    lastRealtimeEventId = 0;
  }

  const permissions = authState.user?.permissions || {};
  const isAdmin = Boolean(permissions.canManageUsers || permissions.canManageWorkspace || permissions.canSuperviseEverything);
  if (authState.user) {
    elements.currentUserChip.textContent = `${authState.user.displayName} • ${formatRoleLabel(authState.user.role)}`;
    elements.currentUserChip.classList.remove("hidden");
    elements.currentUserChip.setAttribute("role", "button");
    elements.currentUserChip.setAttribute("tabindex", "0");
    elements.currentUserChip.title = "Ouvrir le menu utilisateur";
  } else {
    elements.currentUserChip.classList.add("hidden");
    elements.currentUserChip.textContent = "";
    elements.currentUserChip.removeAttribute("role");
    elements.currentUserChip.removeAttribute("tabindex");
    elements.currentUserChip.removeAttribute("title");
  }

  elements.adminButton.classList.toggle("hidden", !isAdmin);
  if (elements.workspaceButton) {
    elements.workspaceButton.classList.toggle("hidden", !authState.authenticated);
  }
  if (elements.shareWorkspaceButton) {
    elements.shareWorkspaceButton.classList.toggle("hidden", !authState.authenticated);
  }
  renderWorkspaceChrome();
  renderLivePresence();
}

function renderAuthGate() {
  clearAuthMessage();

  if (authState.authenticated) {
    showAppShell();
    return;
  }

  showAuthScreen();

  if (authState.needsSetup) {
    elements.authKicker.textContent = "Initialisation";
    elements.authTitle.textContent = "Créer le premier administrateur";
    elements.authSubtitle.textContent = "Aucun compte n'existe encore. Ce premier compte admin pourra ensuite créer d'autres admins et utilisateurs.";
    elements.authNameField.classList.remove("hidden");
    elements.authSubmit.textContent = "Créer le compte admin";
    elements.authNote.textContent = "Après cette étape, toute personne non connectée verra l'écran de connexion avant l'application.";
    elements.authPassword.setAttribute("autocomplete", "new-password");
  } else {
    elements.authKicker.textContent = "Connexion requise";
    elements.authTitle.textContent = "Connectez-vous à Flowcean";
    elements.authSubtitle.textContent = "Vous devez être authentifié avant d'accéder à l'espace de travail.";
    elements.authNameField.classList.add("hidden");
    elements.authSubmit.textContent = "Se connecter";
    elements.authNote.textContent = "Seuls les utilisateurs autorisés peuvent entrer dans Flowcean.";
    elements.authPassword.setAttribute("autocomplete", "current-password");
  }
}

async function fetchAuthState() {
  const payload = await apiRequest(AUTH_API_URL, { method: "GET" });
  applyAuthState(payload);
  renderAuthGate();
  return payload;
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  clearAuthMessage();
  elements.authSubmit.disabled = true;

  try {
    const body = authState.needsSetup
      ? {
          action: "bootstrap",
          displayName: elements.authName.value.trim(),
          email: elements.authEmail.value.trim(),
          password: elements.authPassword.value,
        }
      : {
          action: "login",
          email: elements.authEmail.value.trim(),
          password: elements.authPassword.value,
        };

    const payload = await apiRequest(AUTH_API_URL, {
      method: "POST",
      body: JSON.stringify(body),
    });

    applyAuthState(payload);
    renderAuthGate();
    elements.authPassword.value = "";
    if (authState.authenticated) {
      await initializeApp();
    }
  } catch (error) {
    showAuthMessage(error.message || "Connexion impossible.");
  } finally {
    elements.authSubmit.disabled = false;
  }
}

async function handleLogout() {
  stopAccountNotificationPolling();
  stopRealtimeSession({ leave: true });
  try {
    await apiRequest(AUTH_API_URL, { method: "DELETE" });
  } catch (error) {
    console.error("Failed to logout", error);
  }

  authState = {
    authenticated: false,
    needsSetup: false,
    user: null,
  };
  workspaceDirectory = {
    workspaces: [],
    deletedWorkspaces: [],
    pendingInvitations: [],
    activeWorkspaceSlug: null,
  };
  peopleDirectory = {
    users: [],
    loaded: false,
  };
  accountNotifications = {
    notifications: [],
    unreadCount: 0,
    loaded: false,
  };
  peopleDirectoryPromise = null;
  peopleDirectoryRenderQueued = false;
  state = createInitialState();
  elements.currentUserChip.classList.add("hidden");
  elements.adminButton.classList.add("hidden");
  renderWorkspaceChrome();
  window.parent?.postMessage({ type: "oceanerp:logout" }, window.location.origin);
}

async function fetchAdminUsers() {
  const payload = await apiRequest(USERS_API_URL, { method: "GET" });
  return payload.users || [];
}

async function updateAdminUser(userId, changes) {
  const payload = await apiRequest(USERS_API_URL, {
    method: "PATCH",
    body: JSON.stringify({
      id: userId,
      ...changes,
    }),
  });
  if (payload.currentUser) {
    authState.user = payload.currentUser;
    applyAuthState();
  }
  peopleDirectory = { users: [], loaded: false };
  peopleDirectoryPromise = null;
  return payload.users || [];
}

async function deleteAdminUser(userId) {
  const payload = await apiRequest(USERS_API_URL, {
    method: "DELETE",
    body: JSON.stringify({ id: userId }),
  });
  peopleDirectory = { users: [], loaded: false };
  peopleDirectoryPromise = null;
  return payload.users || [];
}

function renderAdminUserList(users, callbacks = {}) {
  const list = document.createElement("div");
  list.className = "admin-user-list";

  users.forEach((user) => {
    const row = document.createElement("div");
    row.className = `admin-user-row ${user.isActive === false ? "inactive" : ""}`;

    const identity = document.createElement("div");
    identity.className = "admin-user-identity";

    const name = document.createElement("strong");
    name.textContent = user.displayName;

    const meta = document.createElement("span");
    meta.className = "admin-user-meta";
    meta.textContent = `${user.email} - cree le ${formatOceanDate(user.createdAt) || ""}`;

    identity.append(name, meta);

    const badge = document.createElement("span");
    badge.className = `admin-role-badge ${user.role}`;
    badge.textContent = formatRoleLabel(user.role);

    const badges = document.createElement("div");
    badges.className = "admin-user-badges";
    badges.appendChild(badge);
    if (user.isActive === false) {
      const inactive = document.createElement("span");
      inactive.className = "admin-role-badge inactive";
      inactive.textContent = "Desactive";
      badges.appendChild(inactive);
    }

    const actions = document.createElement("div");
    actions.className = "admin-user-actions";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "tiny-button";
    edit.textContent = "Modifier";
    edit.addEventListener("click", () => callbacks.onEdit?.(user));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "tiny-button danger";
    remove.textContent = "Supprimer";
    remove.disabled = user.id === authState.user?.id;
    remove.title = remove.disabled ? "Vous ne pouvez pas supprimer votre propre compte." : "Supprimer ce compte";
    remove.addEventListener("click", () => callbacks.onDelete?.(user));

    actions.append(edit, remove);

    row.append(identity, badges, actions);
    list.appendChild(row);
  });

  if (!users.length) {
    const empty = document.createElement("div");
    empty.className = "nav-empty";
    empty.textContent = "Aucun utilisateur pour le moment.";
    list.appendChild(empty);
  }

  return list;
}

function openAdminUserEditor(user) {
  if (!user) return;

  openModal({
    kicker: "Administration",
    title: `Modifier ${user.displayName}`,
    contentBuilder: () => {
      const wrapper = document.createElement("div");
      wrapper.className = "admin-edit-panel";

      const hint = document.createElement("p");
      hint.className = "admin-hint";
      hint.textContent = "Modifiez les informations du compte. Le mot de passe reste inchange si le champ est laisse vide.";

      const form = document.createElement("form");
      form.className = "admin-form";

      const nameInput = document.createElement("input");
      nameInput.placeholder = "Nom affiche";
      nameInput.value = user.displayName || "";

      const emailInput = document.createElement("input");
      emailInput.type = "email";
      emailInput.placeholder = "email@flowcean.local";
      emailInput.value = user.email || "";

      const passwordInput = document.createElement("input");
      passwordInput.type = "password";
      passwordInput.placeholder = "Nouveau mot de passe (optionnel)";

      const roleSelect = document.createElement("select");
      const canAssignSuper = Boolean(authState.user?.permissions?.canAccessAllWorkspaces);
      [
        ["member", "Membre"],
        ["admin", "Administrateur"],
        ...(canAssignSuper ? [["super", "Super-utilisateur"]] : []),
      ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        roleSelect.appendChild(option);
      });
      roleSelect.value = user.role === "super" && canAssignSuper
        ? "super"
        : (user.role === "admin" ? "admin" : "member");

      const activeLabel = document.createElement("label");
      activeLabel.className = "admin-active-toggle full-span";
      const activeInput = document.createElement("input");
      activeInput.type = "checkbox";
      activeInput.checked = user.isActive !== false;
      activeInput.disabled = user.id === authState.user?.id;
      const activeText = document.createElement("span");
      activeText.textContent = activeInput.disabled
        ? "Compte actif (vous ne pouvez pas desactiver votre propre compte)"
        : "Compte actif";
      activeLabel.append(activeInput, activeText);

      const actions = document.createElement("div");
      actions.className = "modal-actions full-span";

      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "card-button";
      cancel.textContent = "Retour";
      cancel.addEventListener("click", () => {
        void openAdminPanel();
      });

      const submit = document.createElement("button");
      submit.type = "submit";
      submit.className = "card-button primary";
      submit.textContent = "Enregistrer";

      actions.append(cancel, submit);
      form.append(nameInput, emailInput, passwordInput, roleSelect, activeLabel, actions);

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        submit.disabled = true;

        try {
          await updateAdminUser(user.id, {
            displayName: nameInput.value.trim(),
            email: emailInput.value.trim(),
            password: passwordInput.value,
            role: roleSelect.value,
            isActive: activeInput.checked,
          });
          toast("Utilisateur mis a jour.");
          if (authState.user?.permissions?.canManageUsers) {
            await openAdminPanel();
          } else {
            closeModal();
          }
        } catch (error) {
          toast(error.message || "Impossible de modifier l'utilisateur.");
          submit.disabled = false;
        }
      });

      wrapper.append(hint, form);
      return wrapper;
    },
  });
}

async function openAdminPanel() {
  if (!authState.user?.permissions?.canManageUsers) {
    toast("Accès réservé aux administrateurs.");
    return;
  }

  let users = [];
  try {
    users = await fetchAdminUsers();
  } catch (error) {
    toast(error.message || "Impossible de charger les utilisateurs.");
  }

  openModal({
    kicker: "Administration",
    title: "Comptes et rôles",
    contentBuilder: () => {
      const wrapper = document.createElement("div");

      const intro = document.createElement("p");
      intro.className = "admin-hint";
      intro.textContent = "Les administrateurs peuvent créer des comptes membres ou admin. Les visiteurs non connectés restent bloqués sur l'écran de connexion.";

      const form = document.createElement("form");
      form.className = "admin-form";

      const nameInput = document.createElement("input");
      nameInput.placeholder = "Nom affiché";

      const emailInput = document.createElement("input");
      emailInput.type = "email";
      emailInput.placeholder = "email@flowcean.local";

      const passwordInput = document.createElement("input");
      passwordInput.type = "password";
      passwordInput.placeholder = "Mot de passe (8 caractères min.)";

      const roleSelect = document.createElement("select");
      [
        ["member", "Membre"],
        ["admin", "Administrateur"],
        ...(authState.user?.permissions?.canAccessAllWorkspaces ? [["super", "Super-utilisateur"]] : []),
      ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        roleSelect.appendChild(option);
      });

      const submit = document.createElement("button");
      submit.type = "submit";
      submit.className = "card-button primary full-span";
      submit.textContent = "Créer le compte";

      form.append(nameInput, emailInput, passwordInput, roleSelect, submit);

      const renderList = () => renderAdminUserList(users, {
        onEdit: (user) => openAdminUserEditor(user),
        onDelete: async (user) => {
          const confirmed = window.confirm(
            `Supprimer le compte de ${user.displayName} ?\n\nSes acces, preferences, notifications et espace personnel seront supprimes. Cette action est definitive.`
          );
          if (!confirmed) return;

          try {
            users = await deleteAdminUser(user.id);
            const nextList = renderList();
            list.replaceWith(nextList);
            list = nextList;
            toast("Utilisateur supprime.");
          } catch (error) {
            toast(error.message || "Impossible de supprimer l'utilisateur.");
          }
        },
      });

      let list = renderList();
      wrapper.append(intro, form, list);

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        submit.disabled = true;

        try {
          const payload = await apiRequest(USERS_API_URL, {
            method: "POST",
            body: JSON.stringify({
              displayName: nameInput.value.trim(),
              email: emailInput.value.trim(),
              password: passwordInput.value,
              role: roleSelect.value,
            }),
          });

          users = payload.users || [];
          const nextList = renderList();
          list.replaceWith(nextList);
          list = nextList;
          form.reset();
          roleSelect.value = "member";
          toast("Compte créé avec succès.");
        } catch (error) {
          toast(error.message || "Impossible de créer le compte.");
        } finally {
          submit.disabled = false;
        }
      });

      return wrapper;
    },
  });
}

function currentWorkspaceSlug() {
  return workspaceDirectory.activeWorkspaceSlug || state?.meta?.workspaceSlug || DEFAULT_WORKSPACE_SLUG;
}

function buildWorkspaceApiUrl(slug = currentWorkspaceSlug()) {
  return `${WORKSPACE_API_URL}?slug=${encodeURIComponent(slug)}`;
}

function buildWorkspacesApiUrl(slug = null) {
  return slug
    ? `${WORKSPACES_API_URL}?slug=${encodeURIComponent(slug)}`
    : WORKSPACES_API_URL;
}

function buildPreferencesApiUrl(slug = currentWorkspaceSlug()) {
  return `${PREFERENCES_API_URL}?slug=${encodeURIComponent(slug)}`;
}

function buildRealtimeApiUrl(slug = currentWorkspaceSlug()) {
  const url = new URL(REALTIME_API_URL, window.location.href);
  url.searchParams.set("slug", slug);
  if (lastRealtimeEventId > 0) {
    url.searchParams.set("sinceEventId", String(lastRealtimeEventId));
  }
  return url.toString();
}

function buildServerStateSnapshot() {
  const snapshot = JSON.parse(JSON.stringify(state));
  const fallbackActivePageId = getVisiblePages()[0]?.id || snapshot.pages?.[0]?.id || null;
  snapshot.ui = {
    activePageId: fallbackActivePageId,
  };
  snapshot.meta = {
    ...(snapshot.meta || {}),
    workspaceSlug: currentWorkspaceSlug(),
  };
  delete snapshot.meta.serverVersion;
  delete snapshot.meta.lastSyncedAt;
  delete snapshot.meta.source;
  delete snapshot.meta.memberRole;
  delete snapshot.meta.permissions;
  delete snapshot.meta.isPersonal;
  delete snapshot.userPreferences;
  return snapshot;
}

function getPreservedActivePageId(nextPages, fallbackPageId = null) {
  const candidate = state?.ui?.activePageId || fallbackPageId;
  if (candidate && nextPages.some((page) => page.id === candidate && !page.deletedAt)) {
    return candidate;
  }
  return nextPages.find((page) => !page.deletedAt)?.id || nextPages[0]?.id || null;
}

function storeStateLocally() {
  if (!authState.authenticated) return;
  localStorage.setItem(stateCacheKey(), JSON.stringify(state));
}

function canEditCurrentWorkspace() {
  const permissions = state.meta?.permissions || currentWorkspaceRecord()?.permissions || {};
  if (permissions.canEdit === false) return false;
  return true;
}

function isPageReadOnly(page) {
  return Boolean(page?.deletedAt) || !canEditCurrentWorkspace();
}

function mergeServerMeta(meta = {}) {
  state.meta = {
    ...(state.meta || {}),
    workspaceSlug: meta.slug || currentWorkspaceSlug(),
    serverVersion: typeof meta.version === "number" ? meta.version : (state.meta?.serverVersion || 0),
    lastSyncedAt: meta.updatedAt || new Date().toISOString(),
    source: "server",
    memberRole: meta.memberRole || state.meta?.memberRole || null,
    permissions: meta.permissions || state.meta?.permissions || {},
    isPersonal: typeof meta.isPersonal === "boolean" ? meta.isPersonal : Boolean(state.meta?.isPersonal),
  };
}

function applyServerPayload(payload, options = {}) {
  const fallbackPageId = options.fallbackPageId || null;
  const preserveLocalView = options.preserveLocalView !== false;
  rememberActiveWorkspaceSlug(payload.meta?.slug || currentWorkspaceSlug());
  const localPreferences = normalizeUserPreferences(state.userPreferences);
  const shouldKeepLocalPreferences =
    payload.userPreferencesMeta?.exists === false &&
    (localPreferences.initialized || localPreferences.favoritePageIds.length > 0);
  const nextState = normalizeState({
    ...(payload.workspace || createInitialState()),
    userPreferences: shouldKeepLocalPreferences
      ? localPreferences
      : payload.userPreferences || localPreferences || createDefaultUserPreferences(),
    meta: {
      ...((payload.workspace && payload.workspace.meta) || {}),
      workspaceSlug: payload.meta?.slug || currentWorkspaceSlug(),
      serverVersion: payload.meta?.version || 0,
      lastSyncedAt: payload.meta?.updatedAt || new Date().toISOString(),
      source: "server",
      memberRole: payload.meta?.memberRole || null,
      permissions: payload.meta?.permissions || {},
      isPersonal: Boolean(payload.meta?.isPersonal),
    },
  });
  if (preserveLocalView) {
    nextState.ui.activePageId = getPreservedActivePageId(nextState.pages, fallbackPageId);
    nextState.ui.activeDatabaseViewIds = preserveLocalDatabaseViews(nextState.pages);
  }
  state = nextState;
  if (payload.userPreferencesMeta?.exists === true) {
    state.userPreferences.initialized = true;
  }
  if (payload.userPreferencesMeta?.exists === false && migrateLegacyFavoritesToUserPreferences()) {
    void persistUserPreferencesNow("Favoris personnels initialises");
  }
  storeStateLocally();
  if (!options.preserveUndo) {
    clearUndoHistory();
  }
}

async function fetchWorkspaceFromServer(slug = currentWorkspaceSlug()) {
  return apiRequest(buildWorkspaceApiUrl(slug), { method: "GET" });
}

async function fetchWorkspaceDirectory() {
  return apiRequest(buildWorkspacesApiUrl(), { method: "GET" });
}

async function fetchWorkspaceDetails(slug = currentWorkspaceSlug()) {
  return apiRequest(buildWorkspacesApiUrl(slug), { method: "GET" });
}

async function requestWorkspaceDeletion(workspace) {
  const canDeletePersonalWorkspace = Boolean(authState.user?.permissions?.canAccessAllWorkspaces);
  if (!workspace || (workspace.isPersonal && !canDeletePersonalWorkspace)) {
    toast("L'espace personnel ne peut pas etre supprime.");
    return null;
  }

  const confirmed = window.confirm(
    `Supprimer le workspace "${workspace.name}" ?\n\nVous pourrez le restaurer pendant 30 jours depuis le menu utilisateur.`
  );
  if (!confirmed) return null;

  if (workspace.slug === currentWorkspaceSlug()) {
    clearTimeout(saveTimer);
    try {
      await persistNow("Donnees synchronisees avant suppression");
    } catch (error) {
      console.error("Failed to save before deleting workspace", error);
    }
  }

  const payload = await apiRequest(WORKSPACES_API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "delete_workspace",
      workspaceSlug: workspace.slug,
    }),
  });
  applyWorkspaceDirectory(payload, payload.preferredWorkspaceSlug);

  if (workspace.slug === currentWorkspaceSlug()) {
    const nextSlug = payload.preferredWorkspaceSlug || workspaceDirectory.workspaces[0]?.slug || null;
    if (nextSlug) {
      await switchWorkspace(nextSlug, {
        skipSave: true,
        toastMessage: "Workspace supprime. Restaurable pendant 30 jours.",
      });
    }
  } else {
    renderWorkspaceChrome();
  }

  toast("Workspace supprime. Restaurable pendant 30 jours.");
  return payload;
}

async function requestWorkspaceRestore(workspace) {
  if (!workspace) return null;

  const payload = await apiRequest(WORKSPACES_API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "restore_workspace",
      workspaceSlug: workspace.slug,
    }),
  });
  applyWorkspaceDirectory(payload, payload.workspace?.slug);
  toast("Workspace restaure.");
  return payload;
}

function applyWorkspaceDirectory(payload, preferredSlug = null) {
  workspaceDirectory.workspaces = Array.isArray(payload.workspaces) ? payload.workspaces : workspaceDirectory.workspaces;
  workspaceDirectory.deletedWorkspaces = Array.isArray(payload.deletedWorkspaces)
    ? payload.deletedWorkspaces
    : workspaceDirectory.deletedWorkspaces;
  workspaceDirectory.pendingInvitations = Array.isArray(payload.pendingInvitations)
    ? payload.pendingInvitations
    : workspaceDirectory.pendingInvitations;

  const accessibleSlugs = new Set(workspaceDirectory.workspaces.map((workspace) => workspace.slug));
  const candidates = [
    preferredSlug,
    workspaceDirectory.activeWorkspaceSlug,
    readRememberedWorkspaceSlug(),
    payload.preferredWorkspaceSlug,
    workspaceDirectory.workspaces[0]?.slug,
  ].filter(Boolean);
  const nextSlug = candidates.find((slug) => accessibleSlugs.has(slug)) || null;
  rememberActiveWorkspaceSlug(nextSlug);
  renderWorkspaceChrome();
  return nextSlug;
}

async function refreshWorkspaceDirectory(preferredSlug = null) {
  const payload = await fetchWorkspaceDirectory();
  applyWorkspaceDirectory(payload, preferredSlug);
  return payload;
}

function createWorkspaceTag(label, className = "") {
  const tag = document.createElement("span");
  tag.className = `workspace-tag ${className}`.trim();
  tag.textContent = label;
  return tag;
}

function renderWorkspaceList(workspaces, activeSlug, handlers = {}) {
  const list = document.createElement("div");
  list.className = "workspace-list";

  if (!workspaces.length) {
    const empty = document.createElement("div");
    empty.className = "nav-empty";
    empty.textContent = "Aucun workspace disponible pour le moment.";
    list.appendChild(empty);
    return list;
  }

  workspaces.forEach((workspace) => {
    const row = document.createElement("div");
    row.className = "workspace-row";

    const copy = document.createElement("div");
    copy.className = "workspace-row-copy";

    const title = document.createElement("div");
    title.className = "workspace-row-title";
    title.textContent = workspace.name;

    const meta = document.createElement("div");
    meta.className = "workspace-row-meta";
    meta.textContent = `${formatWorkspaceRoleLabel(workspace.memberRole)} - ${workspace.memberCount || 1} membre(s) - maj ${formatRelative(workspace.updatedAt)}`;

    copy.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "workspace-row-actions";

    const badges = document.createElement("div");
    badges.className = "workspace-badges";
    badges.appendChild(createWorkspaceTag(formatWorkspaceRoleLabel(workspace.memberRole), workspace.memberRole || ""));
    if (workspace.isPersonal) {
      badges.appendChild(createWorkspaceTag("Personnel", "personal"));
    }

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = workspace.slug === activeSlug ? "card-button subtle" : "card-button primary";
    openButton.textContent = workspace.slug === activeSlug ? "Actif" : "Ouvrir";
    openButton.disabled = workspace.slug === activeSlug;
    openButton.addEventListener("click", () => handlers.onOpen?.(workspace));

    actions.append(badges, openButton);

    if (workspace.permissions?.canInvite) {
      const shareButton = document.createElement("button");
      shareButton.type = "button";
      shareButton.className = "card-button";
      shareButton.textContent = "Partager";
      shareButton.addEventListener("click", () => handlers.onShare?.(workspace));
      actions.appendChild(shareButton);
    }

    if (!workspace.isPersonal && workspace.permissions?.canManageWorkspace) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "card-button danger-soft";
      deleteButton.textContent = "Supprimer";
      deleteButton.addEventListener("click", () => handlers.onDelete?.(workspace));
      actions.appendChild(deleteButton);
    }

    row.append(copy, actions);
    list.appendChild(row);
  });

  return list;
}

function formatWorkspaceRestoreLimit(workspace) {
  if (!workspace?.deleteExpiresAt) return "Restaurable pendant 30 jours.";
  const expiry = new Date(`${workspace.deleteExpiresAt.replace(" ", "T")}Z`);
  if (Number.isNaN(expiry.getTime())) return "Restaurable pendant 30 jours.";
  return `Restaurable jusqu'au ${expiry.toLocaleDateString("fr-FR")}.`;
}

function renderDeletedWorkspaceList(workspaces, handlers = {}) {
  const list = document.createElement("div");
  list.className = "workspace-list deleted-workspace-list";

  if (!workspaces.length) {
    const empty = document.createElement("div");
    empty.className = "nav-empty";
    empty.textContent = "Aucun workspace supprime recemment.";
    list.appendChild(empty);
    return list;
  }

  workspaces.forEach((workspace) => {
    const row = document.createElement("div");
    row.className = "workspace-row deleted-workspace-row";

    const copy = document.createElement("div");
    copy.className = "workspace-row-copy";

    const title = document.createElement("div");
    title.className = "workspace-row-title";
    title.textContent = workspace.name;

    const meta = document.createElement("div");
    meta.className = "workspace-row-meta";
    meta.textContent = `Supprime ${formatRelative(workspace.deletedAt)} - ${formatWorkspaceRestoreLimit(workspace)}`;

    copy.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "workspace-row-actions";

    const restoreButton = document.createElement("button");
    restoreButton.type = "button";
    restoreButton.className = "card-button primary";
    restoreButton.textContent = "Restaurer";
    restoreButton.addEventListener("click", () => handlers.onRestore?.(workspace));

    actions.appendChild(restoreButton);
    row.append(copy, actions);
    list.appendChild(row);
  });

  return list;
}

function renderPendingInvitationList(invitations, handlers = {}) {
  const list = document.createElement("div");
  list.className = "workspace-invitation-list";

  if (!invitations.length) {
    const empty = document.createElement("div");
    empty.className = "nav-empty";
    empty.textContent = "Aucune invitation en attente.";
    list.appendChild(empty);
    return list;
  }

  invitations.forEach((invitation) => {
    const row = document.createElement("div");
    row.className = "workspace-invitation-row";

    const copy = document.createElement("div");
    copy.className = "workspace-invitation-copy";

    const title = document.createElement("div");
    title.className = "workspace-row-title";
    title.textContent = invitation.workspace.name;

    const meta = document.createElement("div");
    meta.className = "workspace-invitation-meta";
    meta.textContent = `${formatWorkspaceRoleLabel(invitation.role)} invite par ${invitation.invitedBy.displayName || invitation.invitedBy.email}`;

    copy.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "workspace-invitation-actions";

    if (invitation.workspace.isPersonal) {
      actions.appendChild(createWorkspaceTag("Personnel", "personal"));
    }

    const acceptButton = document.createElement("button");
    acceptButton.type = "button";
    acceptButton.className = "card-button primary";
    acceptButton.textContent = "Rejoindre";
    acceptButton.addEventListener("click", () => handlers.onAccept?.(invitation));

    const declineButton = document.createElement("button");
    declineButton.type = "button";
    declineButton.className = "card-button danger-soft";
    declineButton.textContent = "Refuser";
    declineButton.addEventListener("click", () => handlers.onDecline?.(invitation));

    actions.append(acceptButton, declineButton);
    row.append(copy, actions);
    list.appendChild(row);
  });

  return list;
}

function renderWorkspaceMemberList(members, options = {}) {
  const list = document.createElement("div");
  list.className = "workspace-member-list";

  if (!members.length) {
    const empty = document.createElement("div");
    empty.className = "nav-empty";
    empty.textContent = "Aucun membre dans ce workspace.";
    list.appendChild(empty);
    return list;
  }

  members.forEach((member) => {
    const row = document.createElement("div");
    row.className = "workspace-member-row";

    const copy = document.createElement("div");
    copy.className = "workspace-member-copy";

    const name = document.createElement("div");
    name.className = "workspace-member-name";
    name.textContent = member.displayName;

    const meta = document.createElement("div");
    meta.className = "workspace-member-meta";
    meta.textContent = `${member.email} - ${formatWorkspaceRoleLabel(member.workspaceRole)}`;

    copy.append(name, meta);

    const actions = document.createElement("div");
    actions.className = "workspace-member-actions";
    const canManageMember = Boolean(options.canManage)
      && member.workspaceRole !== "owner"
      && member.id !== authState.user?.id;

    if (canManageMember) {
      const roleSelect = document.createElement("select");
      roleSelect.className = "workspace-role-select";
      [
        ["viewer", "Lecture seule"],
        ["editor", "Editeur"],
        ["admin", "Admin workspace"],
      ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        roleSelect.appendChild(option);
      });
      roleSelect.value = member.workspaceRole === "admin" || member.workspaceRole === "viewer" ? member.workspaceRole : "editor";
      roleSelect.addEventListener("change", () => options.onRoleChange?.(member, roleSelect.value, roleSelect));
      actions.appendChild(roleSelect);

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "card-button danger-soft";
      removeButton.textContent = "Retirer";
      removeButton.addEventListener("click", () => options.onRemove?.(member, removeButton));
      actions.appendChild(removeButton);
    } else {
      actions.appendChild(createWorkspaceTag(formatWorkspaceRoleLabel(member.workspaceRole), member.workspaceRole || ""));
    }

    row.append(copy, actions);
    list.appendChild(row);
  });

  return list;
}

function renderWorkspaceInvitationAdminList(invitations) {
  const list = document.createElement("div");
  list.className = "workspace-invitation-list";

  if (!invitations.length) {
    const empty = document.createElement("div");
    empty.className = "nav-empty";
    empty.textContent = "Aucune invitation en attente pour ce workspace.";
    list.appendChild(empty);
    return list;
  }

  invitations.forEach((invitation) => {
    const row = document.createElement("div");
    row.className = "workspace-invitation-row";

    const copy = document.createElement("div");
    copy.className = "workspace-invitation-copy";

    const title = document.createElement("div");
    title.className = "workspace-row-title";
    title.textContent = invitation.email;

    const meta = document.createElement("div");
    meta.className = "workspace-invitation-meta";
    meta.textContent = `${formatWorkspaceRoleLabel(invitation.role)} - invite par ${invitation.invitedBy.displayName || invitation.invitedBy.email}`;

    copy.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "workspace-invitation-actions";
    actions.appendChild(createWorkspaceTag(formatWorkspaceRoleLabel(invitation.role), invitation.role || ""));

    row.append(copy, actions);
    list.appendChild(row);
  });

  return list;
}

function getWorkspaceInviteCandidates(users, details) {
  const memberEmails = new Set((details?.members || []).map((member) => String(member.email || "").toLowerCase()));
  const invitedEmails = new Set((details?.invitations || []).map((invitation) => String(invitation.email || "").toLowerCase()));

  return normalizePeople(users)
    .filter((user) => {
      const email = user.email.toLowerCase();
      return email && !memberEmails.has(email) && !invitedEmails.has(email);
    });
}

function renderInviteSuggestionList(candidates, input, onPick) {
  const list = document.createElement("div");
  list.className = "invite-suggestion-list hidden";
  let source = Array.isArray(candidates) ? candidates : [];

  const renderMatches = () => {
    list.innerHTML = "";
    const query = input.value.trim().toLowerCase();
    if (!query) {
      list.classList.add("hidden");
      return;
    }

    const matches = source
      .filter((user) => (
        user.displayName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
      ))
      .slice(0, 8);

    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "invite-suggestion-empty";
      empty.textContent = query.includes("@")
        ? "Aucun compte existant. L'email sera invite directement."
        : "Aucun utilisateur trouve. Entrez une adresse email complete ou creez le compte.";
      list.appendChild(empty);
      list.classList.remove("hidden");
      return;
    }

    matches.forEach((user) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "invite-suggestion-option";
      option.addEventListener("mousedown", (event) => {
        event.preventDefault();
        onPick(user);
        list.classList.add("hidden");
      });

      const avatar = document.createElement("span");
      avatar.className = "invite-suggestion-avatar";
      avatar.textContent = (user.displayName || user.email || "?").slice(0, 1).toUpperCase();

      const copy = document.createElement("span");
      const name = document.createElement("strong");
      name.textContent = user.displayName || user.email;
      const email = document.createElement("small");
      email.textContent = user.email;
      copy.append(name, email);

      option.append(avatar, copy);
      list.appendChild(option);
    });

    list.classList.remove("hidden");
  };

  input.addEventListener("input", () => {
    delete input.dataset.selectedUserId;
    renderMatches();
  });
  input.addEventListener("focus", renderMatches);
  input.addEventListener("blur", () => {
    window.setTimeout(() => list.classList.add("hidden"), 120);
  });

  return {
    list,
    renderMatches,
    setCandidates(nextCandidates) {
      source = Array.isArray(nextCandidates) ? nextCandidates : [];
      renderMatches();
    },
  };
}

async function switchWorkspace(slug, options = {}) {
  if (!slug) return;

  stopRealtimeSession({ leave: true });

  if (!options.skipSave && authState.authenticated && currentWorkspaceRecord()) {
    clearTimeout(saveTimer);
    try {
      await persistNow("Donnees synchronisees sur le serveur");
    } catch (error) {
      console.error("Failed to save before switching workspace", error);
    }
  }

  rememberActiveWorkspaceSlug(slug);
  bootstrapCacheState = loadCachedState(slug);
  clearUndoHistory();
  state = normalizeState(bootstrapCacheState || createInitialState());
  state.meta.workspaceSlug = slug;
  render();
  await hydrateStateFromServer(slug);
  startRealtimeSession();

  if (options.toastMessage) {
    toast(options.toastMessage);
  }
}

async function openWorkspaceManager() {
  try {
    await refreshWorkspaceDirectory();
  } catch (error) {
    toast(error.message || "Impossible de charger les workspaces.");
    return;
  }

  openModal({
    kicker: "Workspaces",
    title: "Vos espaces",
    contentBuilder: () => {
      const wrapper = document.createElement("div");
      wrapper.className = "workspace-panel";

      const intro = document.createElement("p");
      intro.className = "admin-hint";
      intro.textContent = "Chaque utilisateur dispose de son espace personnel. Vous pouvez aussi creer d autres workspaces et rejoindre ceux pour lesquels vous avez une invitation.";

      const createForm = document.createElement("form");
      createForm.className = "workspace-form";

      const nameInput = document.createElement("input");
      nameInput.placeholder = "Nom du nouveau workspace";

      const submit = document.createElement("button");
      submit.type = "submit";
      submit.className = "card-button primary";
      submit.textContent = "Creer";

      createForm.append(nameInput, submit);

      const workspaceSection = document.createElement("section");
      workspaceSection.className = "workspace-section";
      const workspaceHeader = document.createElement("div");
      workspaceHeader.className = "workspace-section-header";
      const workspaceTitle = document.createElement("h3");
      workspaceTitle.className = "workspace-section-title";
      workspaceTitle.textContent = "Mes workspaces";
      workspaceHeader.appendChild(workspaceTitle);

      let deletedWorkspaceList = null;
      let workspaceList = renderWorkspaceList(workspaceDirectory.workspaces, currentWorkspaceSlug(), {
        onOpen: async (workspace) => {
          closeModal();
          await switchWorkspace(workspace.slug, { toastMessage: "Workspace charge." });
        },
        onShare: async (workspace) => {
          closeModal();
          await openWorkspaceSharePanel(workspace.slug);
        },
        onDelete: async (workspace) => {
          try {
            const payload = await requestWorkspaceDeletion(workspace);
            if (!payload) return;
            const nextWorkspaceList = renderWorkspaceList(workspaceDirectory.workspaces, currentWorkspaceSlug(), {
              onOpen: async (targetWorkspace) => {
                closeModal();
                await switchWorkspace(targetWorkspace.slug, { toastMessage: "Workspace charge." });
              },
              onShare: async (targetWorkspace) => {
                closeModal();
                await openWorkspaceSharePanel(targetWorkspace.slug);
              },
              onDelete: async (targetWorkspace) => {
                closeModal();
                await requestWorkspaceDeletion(targetWorkspace);
              },
            });
            workspaceList.replaceWith(nextWorkspaceList);
            workspaceList = nextWorkspaceList;
            if (deletedWorkspaceList) {
              const nextDeletedList = renderDeletedWorkspaceList(workspaceDirectory.deletedWorkspaces, {
                onRestore: async (deletedWorkspace) => {
                  closeModal();
                  await requestWorkspaceRestore(deletedWorkspace);
                  await switchWorkspace(deletedWorkspace.slug, { skipSave: true, toastMessage: "Workspace restaure." });
                },
              });
              deletedWorkspaceList.replaceWith(nextDeletedList);
              deletedWorkspaceList = nextDeletedList;
            }
          } catch (error) {
            toast(error.message || "Impossible de supprimer le workspace.");
          }
        },
      });
      workspaceSection.append(workspaceHeader, workspaceList);

      const invitationSection = document.createElement("section");
      invitationSection.className = "workspace-section";
      const invitationHeader = document.createElement("div");
      invitationHeader.className = "workspace-section-header";
      const invitationTitle = document.createElement("h3");
      invitationTitle.className = "workspace-section-title";
      invitationTitle.textContent = "Invitations en attente";
      invitationHeader.appendChild(invitationTitle);

      let invitationList = renderPendingInvitationList(workspaceDirectory.pendingInvitations, {
        onAccept: async (invitation) => {
          try {
            const payload = await apiRequest(WORKSPACES_API_URL, {
              method: "POST",
              body: JSON.stringify({
                action: "accept_invite",
                invitationId: invitation.id,
              }),
            });
            applyWorkspaceDirectory(payload, payload.workspace?.slug);
            await refreshAccountNotifications().catch((error) => console.error("Failed to refresh notifications", error));
            closeModal();
            await switchWorkspace(payload.workspace?.slug, {
              skipSave: true,
              toastMessage: "Invitation acceptee.",
            });
          } catch (error) {
            toast(error.message || "Impossible d accepter l invitation.");
          }
        },
        onDecline: async (invitation) => {
          try {
            const confirmed = window.confirm(`Refuser l'invitation au workspace "${invitation.workspace.name}" ?`);
            if (!confirmed) return;
            const payload = await apiRequest(WORKSPACES_API_URL, {
              method: "POST",
              body: JSON.stringify({
                action: "decline_invite",
                invitationId: invitation.id,
              }),
            });
            applyWorkspaceDirectory(payload);
            await refreshAccountNotifications().catch((error) => console.error("Failed to refresh notifications", error));
            const nextInvitationList = renderPendingInvitationList(workspaceDirectory.pendingInvitations, {
              onAccept: async (nextInvitation) => {
                closeModal();
                const acceptPayload = await apiRequest(WORKSPACES_API_URL, {
                  method: "POST",
                  body: JSON.stringify({ action: "accept_invite", invitationId: nextInvitation.id }),
                });
                applyWorkspaceDirectory(acceptPayload, acceptPayload.workspace?.slug);
                await switchWorkspace(acceptPayload.workspace?.slug, { skipSave: true, toastMessage: "Invitation acceptee." });
              },
              onDecline: async (nextInvitation) => {
                closeModal();
                await apiRequest(WORKSPACES_API_URL, {
                  method: "POST",
                  body: JSON.stringify({ action: "decline_invite", invitationId: nextInvitation.id }),
                });
                toast("Invitation refusee.");
              },
            });
            invitationList.replaceWith(nextInvitationList);
            invitationList = nextInvitationList;
            renderWorkspaceChrome();
            renderInspector(getActivePage());
            toast("Invitation refusee.");
          } catch (error) {
            toast(error.message || "Impossible de refuser l invitation.");
          }
        },
      });
      invitationSection.append(invitationHeader, invitationList);

      createForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        submit.disabled = true;

        try {
          const payload = await apiRequest(WORKSPACES_API_URL, {
            method: "POST",
            body: JSON.stringify({
              action: "create",
              name: nameInput.value.trim(),
            }),
          });
          applyWorkspaceDirectory(payload, payload.workspace?.slug);
          closeModal();
          await switchWorkspace(payload.workspace?.slug, {
            skipSave: true,
            toastMessage: "Workspace cree avec succes.",
          });
        } catch (error) {
          toast(error.message || "Impossible de creer le workspace.");
        } finally {
          submit.disabled = false;
        }
      });

      const deletedSection = document.createElement("section");
      deletedSection.className = "workspace-section";
      const deletedHeader = document.createElement("div");
      deletedHeader.className = "workspace-section-header";
      const deletedTitle = document.createElement("h3");
      deletedTitle.className = "workspace-section-title";
      deletedTitle.textContent = "Workspaces supprimes";
      deletedHeader.appendChild(deletedTitle);
      deletedWorkspaceList = renderDeletedWorkspaceList(workspaceDirectory.deletedWorkspaces, {
        onRestore: async (workspace) => {
          try {
            closeModal();
            await requestWorkspaceRestore(workspace);
            await switchWorkspace(workspace.slug, { skipSave: true, toastMessage: "Workspace restaure." });
          } catch (error) {
            toast(error.message || "Impossible de restaurer le workspace.");
          }
        },
      });
      deletedSection.append(deletedHeader, deletedWorkspaceList);

      wrapper.append(intro, createForm, workspaceSection, deletedSection, invitationSection);
      return wrapper;
    },
  });
}

function createUserMenuAction({ label, hint, meta = "", disabled = false, danger = false, closeBeforeAction = true, action }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `user-control-action ${danger ? "danger" : ""}`;
  button.disabled = disabled;

  const copy = document.createElement("span");
  const title = document.createElement("strong");
  title.textContent = label;
  const description = document.createElement("small");
  description.textContent = hint || "";
  copy.append(title, description);

  const badge = document.createElement("em");
  badge.textContent = meta || "Ouvrir";

  button.append(copy, badge);
  button.addEventListener("click", () => {
    if (disabled) return;
    if (closeBeforeAction) closeModal();
    action?.();
  });
  return button;
}

function createUserMenuInfo(label, value) {
  const row = document.createElement("div");
  row.className = "user-control-info";
  const title = document.createElement("span");
  title.textContent = label;
  const content = document.createElement("strong");
  content.textContent = value || "-";
  row.append(title, content);
  return row;
}

function buildUserMenuAiContent() {
  let lastAnswer = "";
  const panel = document.createElement("div");
  panel.className = "ai-panel user-embedded-panel";

  const settingsCard = document.createElement("section");
  settingsCard.className = "ai-card";

  const status = document.createElement("div");
  status.className = "ai-status";
  status.textContent = "Chargement des parametres IA...";

  const form = document.createElement("form");
  form.className = "ai-settings-form";

  const modelInput = document.createElement("input");
  modelInput.type = "text";
  modelInput.placeholder = "Modele Groq";
  modelInput.value = "llama-3.3-70b-versatile";
  modelInput.disabled = true;

  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.className = "card-button primary";
  saveButton.textContent = "Ouvrir les parametres IA";

  const testButton = document.createElement("button");
  testButton.type = "button";
  testButton.className = "card-button";
  testButton.textContent = "Tester";

  form.append(modelInput, saveButton, testButton);
  settingsCard.append(status, form);

  const promptCard = document.createElement("section");
  promptCard.className = "ai-card";

  const taskSelect = document.createElement("select");
  taskSelect.className = "ai-task-select";
  [
    ["chat", "Question libre"],
    ["summary", "Resumer la page active"],
    ["improve", "Ameliorer le texte"],
    ["tasks", "Extraire les actions projet"],
    ["plan", "Creer un plan projet"],
    ["translate", "Traduire en francais"],
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    taskSelect.appendChild(option);
  });

  const promptInput = document.createElement("textarea");
  promptInput.className = "ai-prompt";
  promptInput.placeholder = "Votre demande IA...";
  promptInput.rows = 4;

  const includeContext = document.createElement("label");
  includeContext.className = "ai-checkbox";
  const includeContextInput = document.createElement("input");
  includeContextInput.type = "checkbox";
  includeContextInput.checked = true;
  const includeContextText = document.createElement("span");
  includeContextText.textContent = "Inclure le contenu de la page active";
  includeContext.append(includeContextInput, includeContextText);

  const runButton = document.createElement("button");
  runButton.type = "button";
  runButton.className = "card-button primary";
  runButton.textContent = "Lancer l'IA";

  const result = document.createElement("textarea");
  result.className = "ai-result";
  result.placeholder = "La reponse IA apparaitra ici...";
  result.rows = 8;

  const resultActions = document.createElement("div");
  resultActions.className = "modal-actions";

  const insertButton = document.createElement("button");
  insertButton.type = "button";
  insertButton.className = "inline-button";
  insertButton.textContent = "Inserer dans la page";

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "inline-button";
  copyButton.textContent = "Copier";

  resultActions.append(insertButton, copyButton);
  promptCard.append(taskSelect, promptInput, includeContext, runButton, result, resultActions);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    openErpAiSettings();
  });

  testButton.addEventListener("click", async () => {
    testButton.disabled = true;
    try {
      const answer = await testAiConnection();
      result.value = answer;
      lastAnswer = answer;
      status.textContent = "Connexion Groq valide.";
    } catch (error) {
      status.textContent = error.message;
      toast(error.message);
    } finally {
      testButton.disabled = false;
    }
  });

  runButton.addEventListener("click", async () => {
    runButton.disabled = true;
    result.value = "Generation en cours...";
    try {
      const answer = await runAiCompletion({
        task: taskSelect.value,
        prompt: promptInput.value.trim(),
        context: includeContextInput.checked ? extractPageTextForAi() : "",
      });
      lastAnswer = answer;
      result.value = answer;
    } catch (error) {
      result.value = "";
      toast(error.message);
    } finally {
      runButton.disabled = false;
    }
  });

  insertButton.addEventListener("click", () => insertAiAnswerIntoPage(result.value || lastAnswer));
  copyButton.addEventListener("click", async () => {
    const text = result.value || lastAnswer;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast("Resultat IA copie.");
    } catch (error) {
      toast("Copie impossible dans ce navigateur.");
    }
  });

  void loadAiSettings()
    .then((settings) => {
      modelInput.value = settings.model || "llama-3.3-70b-versatile";
      status.textContent = settings.isEnabled && settings.hasApiKey
        ? `IA ERP active - modele ${modelInput.value}`
        : (settings.isEnabled ? "IA ERP active, mais aucune cle Groq n'est configuree." : "IA ERP desactivee dans les parametres.");
    })
    .catch((error) => {
      status.textContent = error.message;
    });

  panel.append(settingsCard, promptCard);
  return panel;
}

function buildUserMenuWorkspaceShareContent(workspaceSlug, onBack = null) {
  const wrapper = document.createElement("div");
  wrapper.className = "workspace-share-panel user-embedded-panel";

  const loading = document.createElement("div");
  loading.className = "nav-empty";
  loading.textContent = "Chargement du partage...";
  wrapper.appendChild(loading);

  let details = null;
  let invitePeople = [];

  const render = () => {
    wrapper.innerHTML = "";

    const header = document.createElement("div");
    header.className = "workspace-section-header";
    const title = document.createElement("h3");
    title.className = "workspace-section-title";
    title.textContent = details?.workspace?.name || "Partage du workspace";
    const back = document.createElement("button");
    back.type = "button";
    back.className = "card-button";
    back.textContent = "Retour";
    back.addEventListener("click", () => onBack?.());
    header.append(title, back);

    const intro = document.createElement("p");
    intro.className = "admin-hint";
    intro.textContent = details?.workspace?.permissions?.canInvite
      ? "Invitez un utilisateur deja cree dans Flowcean, ou une adresse email qui rejoindra le workspace plus tard avec le role choisi."
      : "Voici les membres de ce workspace. Seuls les proprietaires et admins du workspace peuvent inviter de nouveaux membres.";

    const roleHelp = document.createElement("div");
    roleHelp.className = "permission-help";
    [
      ["Lecture seule", "Peut consulter sans modifier."],
      ["Editeur", "Peut creer, modifier et commenter."],
      ["Admin workspace", "Peut inviter et gerer les membres."],
    ].forEach(([label, description]) => {
      const item = document.createElement("span");
      item.innerHTML = `<strong>${label}</strong> ${description}`;
      roleHelp.appendChild(item);
    });

    wrapper.append(header, intro, roleHelp);

    const canManageMembers = Boolean(details?.workspace?.permissions?.canManageMembers);

    const updateMemberRole = async (member, role, control) => {
      const previousRole = member.workspaceRole;
      control.disabled = true;
      try {
        const payload = await apiRequest(WORKSPACES_API_URL, {
          method: "POST",
          body: JSON.stringify({
            action: "update_member_role",
            workspaceSlug,
            userId: member.id,
            role,
          }),
        });
        details = {
          ...details,
          workspace: payload.workspace || details.workspace,
          members: payload.members || details.members,
          invitations: payload.invitations || details.invitations,
        };
        render();
        toast("Droits modifies.");
      } catch (error) {
        control.value = previousRole;
        toast(error.message || "Impossible de modifier les droits.");
      } finally {
        control.disabled = false;
      }
    };

    const removeMember = async (member, button) => {
      const confirmed = window.confirm(`Retirer ${member.displayName} du workspace "${details.workspace?.name || "Workspace"}" ?`);
      if (!confirmed) return;
      button.disabled = true;
      try {
        const payload = await apiRequest(WORKSPACES_API_URL, {
          method: "POST",
          body: JSON.stringify({
            action: "remove_member",
            workspaceSlug,
            userId: member.id,
          }),
        });
        details = {
          ...details,
          workspace: payload.workspace || details.workspace,
          members: payload.members || details.members,
          invitations: payload.invitations || details.invitations,
        };
        render();
        toast("Membre retire du workspace.");
      } catch (error) {
        toast(error.message || "Impossible de retirer ce membre.");
      } finally {
        button.disabled = false;
      }
    };

    if (details?.workspace?.permissions?.canInvite) {
      const form = document.createElement("form");
      form.className = "workspace-form";

      let candidateUsers = getWorkspaceInviteCandidates(invitePeople, details);
      const emailField = document.createElement("div");
      emailField.className = "invite-search-field";

      const emailInput = document.createElement("input");
      emailInput.type = "text";
      emailInput.placeholder = "Nom, prenom ou email";
      emailInput.autocomplete = "off";
      emailInput.setAttribute("aria-label", "Utilisateur a inviter");

      const suggestions = renderInviteSuggestionList(candidateUsers, emailInput, (user) => {
        emailInput.value = user.email;
        emailInput.dataset.selectedUserId = user.id;
      });
      emailField.append(emailInput, suggestions.list);

      const roleSelect = document.createElement("select");
      [
        ["editor", "Editeur"],
        ["viewer", "Lecture seule"],
        ["admin", "Admin workspace"],
      ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        roleSelect.appendChild(option);
      });

      const submit = document.createElement("button");
      submit.type = "submit";
      submit.className = "card-button primary";
      submit.textContent = "Inviter";

      form.append(emailField, roleSelect, submit);
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        submit.disabled = true;
        try {
          const rawTarget = emailInput.value.trim();
          const selectedUser = candidateUsers.find((user) => (
            user.id === emailInput.dataset.selectedUserId ||
            user.email.toLowerCase() === rawTarget.toLowerCase() ||
            user.displayName.toLowerCase() === rawTarget.toLowerCase()
          ));
          const email = selectedUser?.email || rawTarget;
          if (!email.includes("@")) {
            throw new Error("Choisissez un utilisateur propose ou entrez une adresse email complete.");
          }

          const payload = await apiRequest(WORKSPACES_API_URL, {
            method: "POST",
            body: JSON.stringify({
              action: "invite",
              workspaceSlug,
              email,
              role: roleSelect.value,
            }),
          });
          details = {
            ...details,
            members: payload.members || details.members,
            invitations: payload.invitations || details.invitations,
          };
          await refreshAccountNotifications().catch((error) => console.error("Failed to refresh notifications", error));
          render();
          toast("Invitation enregistree.");
        } catch (error) {
          toast(error.message || "Impossible d inviter cet utilisateur.");
        } finally {
          submit.disabled = false;
        }
      });
      wrapper.appendChild(form);
    }

    const membersSection = document.createElement("section");
    membersSection.className = "workspace-section";
    const membersTitle = document.createElement("h3");
    membersTitle.className = "workspace-section-title";
    membersTitle.textContent = "Membres";
    membersSection.append(
      membersTitle,
      renderWorkspaceMemberList(details?.members || [], {
        canManage: canManageMembers,
        onRoleChange: updateMemberRole,
        onRemove: removeMember,
      })
    );

    const invitesSection = document.createElement("section");
    invitesSection.className = "workspace-section";
    const invitesTitle = document.createElement("h3");
    invitesTitle.className = "workspace-section-title";
    invitesTitle.textContent = "Invitations en attente";
    invitesSection.append(invitesTitle, renderWorkspaceInvitationAdminList(details?.invitations || []));

    wrapper.append(membersSection, invitesSection);
  };

  void fetchWorkspaceDetails(workspaceSlug)
    .then(async (payload) => {
      details = payload;
      if (details.workspace?.permissions?.canInvite) {
        try {
          invitePeople = await ensurePeopleDirectoryLoaded();
        } catch (error) {
          console.error("Failed to load invite suggestions", error);
          toast("Les suggestions d'utilisateurs sont indisponibles, mais l'invitation par email reste possible.");
        }
      }
      render();
    })
    .catch((error) => {
      loading.textContent = error.message || "Impossible de charger le partage du workspace.";
    });

  return wrapper;
}

function buildUserMenuWorkspaceContent(renderUserSection = null) {
  const wrapper = document.createElement("div");
  wrapper.className = "workspace-panel user-embedded-panel";

  const intro = document.createElement("p");
  intro.className = "admin-hint";
  intro.textContent = "Gerez vos espaces, invitations et workspaces supprimes sans quitter le menu utilisateur.";

  const createForm = document.createElement("form");
  createForm.className = "workspace-form";

  const nameInput = document.createElement("input");
  nameInput.placeholder = "Nom du nouveau workspace";

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "card-button primary";
  submit.textContent = "Creer";
  createForm.append(nameInput, submit);

  const workspaceSection = document.createElement("section");
  workspaceSection.className = "workspace-section";
  const workspaceHeader = document.createElement("div");
  workspaceHeader.className = "workspace-section-header";
  const workspaceTitle = document.createElement("h3");
  workspaceTitle.className = "workspace-section-title";
  workspaceTitle.textContent = "Mes workspaces";
  workspaceHeader.appendChild(workspaceTitle);
  let workspaceList = renderWorkspaceList(workspaceDirectory.workspaces, currentWorkspaceSlug(), {
    onOpen: async (workspace) => {
      closeModal();
      await switchWorkspace(workspace.slug, { toastMessage: "Workspace charge." });
    },
    onShare: async (workspace) => {
      const sharePanel = buildUserMenuWorkspaceShareContent(workspace.slug, renderUserSection);
      wrapper.replaceChildren(sharePanel);
    },
    onDelete: async (workspace) => {
      await requestWorkspaceDeletion(workspace);
      renderUserSection?.();
    },
  });
  workspaceSection.append(workspaceHeader, workspaceList);

  const deletedSection = document.createElement("section");
  deletedSection.className = "workspace-section";
  const deletedHeader = document.createElement("div");
  deletedHeader.className = "workspace-section-header";
  const deletedTitle = document.createElement("h3");
  deletedTitle.className = "workspace-section-title";
  deletedTitle.textContent = "Workspaces supprimes";
  deletedHeader.appendChild(deletedTitle);
  const deletedList = renderDeletedWorkspaceList(workspaceDirectory.deletedWorkspaces, {
    onRestore: async (workspace) => {
      closeModal();
      await requestWorkspaceRestore(workspace);
      await switchWorkspace(workspace.slug, { skipSave: true, toastMessage: "Workspace restaure." });
    },
  });
  deletedSection.append(deletedHeader, deletedList);

  const invitationSection = document.createElement("section");
  invitationSection.className = "workspace-section";
  const invitationHeader = document.createElement("div");
  invitationHeader.className = "workspace-section-header";
  const invitationTitle = document.createElement("h3");
  invitationTitle.className = "workspace-section-title";
  invitationTitle.textContent = "Invitations en attente";
  invitationHeader.appendChild(invitationTitle);
  const invitationList = renderPendingInvitationList(workspaceDirectory.pendingInvitations, {
    onAccept: async (invitation) => {
      const payload = await apiRequest(WORKSPACES_API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "accept_invite", invitationId: invitation.id }),
      });
      applyWorkspaceDirectory(payload, payload.workspace?.slug);
      closeModal();
      await switchWorkspace(payload.workspace?.slug, { skipSave: true, toastMessage: "Invitation acceptee." });
    },
    onDecline: async (invitation) => {
      const confirmed = window.confirm(`Refuser l'invitation au workspace "${invitation.workspace.name}" ?`);
      if (!confirmed) return;
      const payload = await apiRequest(WORKSPACES_API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "decline_invite", invitationId: invitation.id }),
      });
      applyWorkspaceDirectory(payload);
      renderUserSection?.();
      toast("Invitation refusee.");
    },
  });
  invitationSection.append(invitationHeader, invitationList);

  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    try {
      const payload = await apiRequest(WORKSPACES_API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "create", name: nameInput.value.trim() }),
      });
      applyWorkspaceDirectory(payload, payload.workspace?.slug);
      closeModal();
      await switchWorkspace(payload.workspace?.slug, { skipSave: true, toastMessage: "Workspace cree avec succes." });
    } catch (error) {
      toast(error.message || "Impossible de creer le workspace.");
    } finally {
      submit.disabled = false;
    }
  });

  wrapper.append(intro, createForm, workspaceSection, deletedSection, invitationSection);
  return wrapper;
}

function buildUserMenuAdminEditContent(user, callbacks = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "admin-edit-panel user-embedded-panel";

  const header = document.createElement("div");
  header.className = "workspace-section-header";
  const title = document.createElement("h3");
  title.className = "workspace-section-title";
  title.textContent = `Modifier ${user.displayName}`;
  const back = document.createElement("button");
  back.type = "button";
  back.className = "card-button";
  back.textContent = "Retour";
  back.addEventListener("click", () => callbacks.onBack?.());
  header.append(title, back);

  const hint = document.createElement("p");
  hint.className = "admin-hint";
  hint.textContent = "Modifiez les informations du compte. Le mot de passe reste inchange si le champ est laisse vide.";

  const form = document.createElement("form");
  form.className = "admin-form";

  const nameInput = document.createElement("input");
  nameInput.placeholder = "Nom affiche";
  nameInput.value = user.displayName || "";

  const emailInput = document.createElement("input");
  emailInput.type = "email";
  emailInput.placeholder = "email@flowcean.local";
  emailInput.value = user.email || "";

  const passwordInput = document.createElement("input");
  passwordInput.type = "password";
  passwordInput.placeholder = "Nouveau mot de passe (optionnel)";

  const roleSelect = document.createElement("select");
  const canAssignSuper = Boolean(authState.user?.permissions?.canAccessAllWorkspaces);
  [
    ["member", "Membre"],
    ["admin", "Administrateur"],
    ...(canAssignSuper ? [["super", "Super-utilisateur"]] : []),
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    roleSelect.appendChild(option);
  });
  roleSelect.value = user.role === "super" && canAssignSuper
    ? "super"
    : (user.role === "admin" ? "admin" : "member");

  const activeLabel = document.createElement("label");
  activeLabel.className = "admin-active-toggle full-span";
  const activeInput = document.createElement("input");
  activeInput.type = "checkbox";
  activeInput.checked = user.isActive !== false;
  activeInput.disabled = user.id === authState.user?.id;
  const activeText = document.createElement("span");
  activeText.textContent = activeInput.disabled
    ? "Compte actif (vous ne pouvez pas desactiver votre propre compte)"
    : "Compte actif";
  activeLabel.append(activeInput, activeText);

  const actions = document.createElement("div");
  actions.className = "modal-actions full-span";

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "card-button primary";
  submit.textContent = "Enregistrer";
  actions.appendChild(submit);

  form.append(nameInput, emailInput, passwordInput, roleSelect, activeLabel, actions);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;

    try {
      const users = await updateAdminUser(user.id, {
        displayName: nameInput.value.trim(),
        email: emailInput.value.trim(),
        password: passwordInput.value,
        role: roleSelect.value,
        isActive: activeInput.checked,
      });
      toast("Utilisateur mis a jour.");
      callbacks.onSaved?.(users);
    } catch (error) {
      toast(error.message || "Impossible de modifier l'utilisateur.");
      submit.disabled = false;
    }
  });

  wrapper.append(header, hint, form);
  return wrapper;
}

function buildUserMenuAdminContent() {
  const wrapper = document.createElement("div");
  wrapper.className = "user-embedded-panel";
  const loading = document.createElement("div");
  loading.className = "nav-empty";
  loading.textContent = "Chargement des utilisateurs...";
  wrapper.appendChild(loading);

  void fetchAdminUsers()
    .then((users) => {
      wrapper.innerHTML = "";
      const intro = document.createElement("p");
      intro.className = "admin-hint";
      intro.textContent = "Creez, modifiez ou supprimez les comptes directement depuis le menu utilisateur.";

      const form = document.createElement("form");
      form.className = "admin-form";

      const nameInput = document.createElement("input");
      nameInput.placeholder = "Nom affiche";

      const emailInput = document.createElement("input");
      emailInput.type = "email";
      emailInput.placeholder = "email@flowcean.local";

      const passwordInput = document.createElement("input");
      passwordInput.type = "password";
      passwordInput.placeholder = "Mot de passe (8 caracteres min.)";

      const roleSelect = document.createElement("select");
      [
        ["member", "Membre"],
        ["admin", "Administrateur"],
        ...(authState.user?.permissions?.canAccessAllWorkspaces ? [["super", "Super-utilisateur"]] : []),
      ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        roleSelect.appendChild(option);
      });

      const submit = document.createElement("button");
      submit.type = "submit";
      submit.className = "card-button primary full-span";
      submit.textContent = "Creer le compte";
      form.append(nameInput, emailInput, passwordInput, roleSelect, submit);

      let currentUsers = users;
      const showList = () => {
        wrapper.innerHTML = "";
        wrapper.append(intro, form, list);
      };
      const renderList = () => renderAdminUserList(currentUsers, {
        onEdit: (targetUser) => {
          wrapper.replaceChildren(buildUserMenuAdminEditContent(targetUser, {
            onBack: showList,
            onSaved: (updatedUsers) => {
              currentUsers = updatedUsers;
              list = renderList();
              showList();
            },
          }));
        },
        onDelete: async (targetUser) => {
          const confirmed = window.confirm(`Supprimer le compte de ${targetUser.displayName} ?`);
          if (!confirmed) return;
          try {
            currentUsers = await deleteAdminUser(targetUser.id);
            const nextList = renderList();
            list.replaceWith(nextList);
            list = nextList;
            toast("Utilisateur supprime.");
          } catch (error) {
            toast(error.message || "Impossible de supprimer l'utilisateur.");
          }
        },
      });
      let list = renderList();

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        submit.disabled = true;
        try {
          const payload = await apiRequest(USERS_API_URL, {
            method: "POST",
            body: JSON.stringify({
              displayName: nameInput.value.trim(),
              email: emailInput.value.trim(),
              password: passwordInput.value,
              role: roleSelect.value,
            }),
          });
          currentUsers = payload.users || [];
          const nextList = renderList();
          list.replaceWith(nextList);
          list = nextList;
          form.reset();
          roleSelect.value = "member";
          toast("Compte cree avec succes.");
        } catch (error) {
          toast(error.message || "Impossible de creer le compte.");
        } finally {
          submit.disabled = false;
        }
      });

      showList();
    })
    .catch((error) => {
      loading.textContent = error.message || "Impossible de charger les utilisateurs.";
    });

  return wrapper;
}

function openUserMenu() {
  if (!authState.authenticated) return;

  const user = authState.user;
  const page = getActivePage();
  const workspace = currentWorkspaceRecord();
  const pendingCount = workspaceDirectory.pendingInvitations.length;
  const deletedCount = workspaceDirectory.deletedWorkspaces.length;
  const unreadCount = unreadNotificationCount();
  const isAdmin = false;
  const canShareWorkspace = Boolean(workspace?.permissions?.canInvite || workspace?.permissions?.canManageMembers);

  openModal({
    kicker: "Menu utilisateur",
    title: user?.displayName || "Mon compte",
    contentBuilder: () => {
      const shell = document.createElement("div");
      shell.className = "user-control-center";

      const rail = document.createElement("div");
      rail.className = "user-control-rail";

      const content = document.createElement("div");
      content.className = "user-control-content";

      const sections = [
        {
          id: "account",
          label: "Compte",
          hint: formatRoleLabel(user?.role),
          render: () => {
            const fragment = document.createDocumentFragment();
            const card = document.createElement("div");
            card.className = "user-control-profile";

            const avatar = document.createElement("div");
            avatar.className = "user-menu-avatar";
            avatar.textContent = (user?.displayName || user?.email || "F").slice(0, 1).toUpperCase();

            const copy = document.createElement("div");
            const name = document.createElement("strong");
            name.textContent = user?.displayName || "Utilisateur";
            const email = document.createElement("span");
            email.textContent = user?.email || "";
            copy.append(name, email);
            card.append(avatar, copy);

            const infoGrid = document.createElement("div");
            infoGrid.className = "user-control-info-grid";
            infoGrid.append(
              createUserMenuInfo("Role", formatRoleLabel(user?.role)),
              createUserMenuInfo("Workspace actif", workspace?.name || state.workspace?.name || "Flowcean")
            );

            const actions = document.createElement("div");
            actions.className = "user-control-actions";
            actions.append(
              createUserMenuAction({
                label: deletedCount > 0 ? `Compte et espaces supprimes (${deletedCount})` : "Compte et restaurations",
                hint: "Voir le profil et restaurer un workspace supprime sous 30 jours.",
                meta: "Onglet",
                closeBeforeAction: false,
                action: () => {
                  renderSection(sections.find((section) => section.id === "workspaces"));
                },
              }),
              createUserMenuAction({
                label: "Deconnexion",
                hint: "Quitter Flowcean sur cet appareil.",
                danger: true,
                action: () => {
                  void handleLogout();
                },
              })
            );
            fragment.append(card, infoGrid, actions);
            return fragment;
          },
        },
        {
          id: "workspaces",
          label: pendingCount > 0 ? `Espaces (${pendingCount})` : "Espaces",
          hint: workspace?.name || "Workspaces",
          render: () => buildUserMenuWorkspaceContent(() => renderSection(sections.find((section) => section.id === "workspaces"))),
        },
        {
          id: "page",
          label: "Page active",
          hint: page?.title || "Aucune page",
          render: () => {
            const actions = document.createElement("div");
            actions.className = "user-control-actions";
            actions.append(
              createUserMenuAction({
                label: "Dupliquer la page",
                hint: "Creer une copie de la page courante.",
                disabled: !page,
                action: () => {
                  if (page) duplicatePage(page.id);
                },
              })
            );

            if (page?.kind === "document") {
              actions.appendChild(createUserMenuAction({
                label: "Exporter en PDF",
                hint: "Exporter texte, formatage et images.",
                action: () => exportDocumentPagePdf(page.id),
              }));
            }

            actions.appendChild(createUserMenuAction({
              label: page?.deletedAt ? "Restaurer la page" : "Envoyer a la corbeille",
              hint: page?.deletedAt ? "Remettre cette page dans l'espace." : "Supprimer temporairement cette page.",
              disabled: !page,
              danger: Boolean(page && !page.deletedAt),
              action: () => {
                if (!page) return;
                if (page.deletedAt) restorePage(page.id);
                else movePageToTrash(page.id);
              },
            }));
            if (page?.deletedAt) {
              actions.appendChild(createUserMenuAction({
                label: "Supprimer definitivement",
                hint: "Retirer cette page et ses sous-pages de Flowcean.",
                danger: true,
                action: () => permanentlyDeletePage(page.id),
              }));
            }
            return actions;
          },
        },
        {
          id: "tools",
          label: "Outils",
          hint: "Raccourcis integres",
          render: () => {
            const actions = document.createElement("div");
            actions.className = "user-control-actions";
            actions.append(
              createUserMenuAction({
                label: "Rechercher",
                hint: "Disponible dans l'onglet Recherche de ce menu.",
                meta: "Onglet",
                closeBeforeAction: false,
                action: () => renderSection(sections.find((section) => section.id === "search")),
              }),
              createUserMenuAction({
                label: "Modeles",
                hint: "Disponible dans l'onglet Modeles de ce menu.",
                meta: "Onglet",
                closeBeforeAction: false,
                action: () => renderSection(sections.find((section) => section.id === "templates")),
              }),
              createUserMenuAction({
                label: "Mes taches",
                hint: "Disponible dans l'onglet Mes taches de ce menu.",
                meta: "Onglet",
                closeBeforeAction: false,
                action: () => renderSection(sections.find((section) => section.id === "tasks")),
              }),
              createUserMenuAction({
                label: "Assistant IA",
                hint: "Disponible dans l'onglet IA de ce menu.",
                meta: "Onglet",
                closeBeforeAction: false,
                action: () => renderSection(sections.find((section) => section.id === "ai")),
              }),
              createUserMenuAction({
                label: unreadCount > 0 ? `Notifications (${unreadCount})` : "Notifications",
                hint: "Disponible dans l'onglet Notifications de ce menu.",
                meta: unreadCount > 0 ? `${unreadCount} non lue(s)` : "Onglet",
                closeBeforeAction: false,
                action: () => {
                  renderSection(sections.find((section) => section.id === "notifications"));
                },
              })
            );
            return actions;
          },
        },
        {
          id: "search",
          label: "Recherche",
          hint: "Pages, blocs et tableaux",
          render: () => buildSearchContent("", { closeOnSelect: true }),
        },
        {
          id: "templates",
          label: "Modeles",
          hint: "Bibliotheque Flowcean",
          render: () => buildTemplatesContent(page?.id || null),
        },
        {
          id: "tasks",
          label: "Mes taches",
          hint: "Assignations du workspace",
          render: () => buildMyTasksContent(),
        },
        {
          id: "ai",
          label: "Assistant IA",
          hint: "Parametres ERP",
          render: () => buildUserMenuAiContent(),
        },
        {
          id: "notifications",
          label: unreadCount > 0 ? `Notifications (${unreadCount})` : "Notifications",
          hint: unreadCount > 0 ? `${unreadCount} non lue(s)` : "Centre de notifications",
          render: () => buildNotificationsContent({
            closeOnNavigate: true,
            closeAfterClear: false,
            openWorkspaceManager: () => renderSection(sections.find((section) => section.id === "workspaces")),
          }),
        },
      ];

      if (isAdmin) {
        sections.push({
          id: "admin",
          label: "Admin",
          hint: "Comptes et droits",
          render: () => buildUserMenuAdminContent(),
        });
      }

      const visibleSections = sections.filter((section) => !["account", "tools"].includes(section.id));
      let activeId = visibleSections[0]?.id || "";

      const renderSection = (section) => {
        if (!section) return;
        activeId = section.id;
        rail.querySelectorAll(".user-control-tab").forEach((tab) => {
          tab.classList.toggle("active", tab.dataset.sectionId === activeId);
        });
        content.innerHTML = "";

        const heading = document.createElement("div");
        heading.className = "user-control-heading";
        const title = document.createElement("h4");
        title.textContent = section.label.replace(/ \(.*\)$/, "");
        const hint = document.createElement("p");
        hint.textContent = section.hint || "";
        heading.append(title, hint);
        content.appendChild(heading);

        const body = section.render();
        if (body) content.appendChild(body);
      };

      visibleSections.forEach((section) => {
        const tab = document.createElement("button");
        tab.type = "button";
        tab.className = `user-control-tab ${section.id === activeId ? "active" : ""}`;
        tab.dataset.sectionId = section.id;

        const label = document.createElement("strong");
        label.textContent = section.label;
        const hint = document.createElement("span");
        hint.textContent = section.hint || "";
        tab.append(label, hint);
        tab.addEventListener("click", () => renderSection(section));
        rail.appendChild(tab);
      });

      shell.append(rail, content);
      renderSection(visibleSections[0]);
      return shell;
    },
  });
}

async function openUserAccountModal() {
  if (!authState.authenticated) return;

  try {
    await refreshWorkspaceDirectory();
  } catch (error) {
    toast(error.message || "Impossible de charger le menu utilisateur.");
  }

  openModal({
    kicker: "Compte utilisateur",
    title: authState.user?.displayName || "Mon compte",
    contentBuilder: () => {
      const wrapper = document.createElement("div");
      wrapper.className = "workspace-panel";

      const identity = document.createElement("div");
      identity.className = "user-menu-card";

      const avatar = document.createElement("div");
      avatar.className = "user-menu-avatar";
      avatar.textContent = (authState.user?.displayName || authState.user?.email || "F").slice(0, 1).toUpperCase();

      const copy = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = authState.user?.displayName || "Utilisateur";
      const meta = document.createElement("span");
      meta.textContent = `${authState.user?.email || ""} - ${formatRoleLabel(authState.user?.role)}`;
      copy.append(name, meta);
      identity.append(avatar, copy);

      const deletedSection = document.createElement("section");
      deletedSection.className = "workspace-section";

      const deletedHeader = document.createElement("div");
      deletedHeader.className = "workspace-section-header";
      const deletedTitle = document.createElement("h3");
      deletedTitle.className = "workspace-section-title";
      deletedTitle.textContent = "Workspaces supprimes recemment";
      const deletedHint = document.createElement("span");
      deletedHint.className = "workspace-section-hint";
      deletedHint.textContent = "30 jours";
      deletedHeader.append(deletedTitle, deletedHint);

      let deletedList = renderDeletedWorkspaceList(workspaceDirectory.deletedWorkspaces, {
        onRestore: async (workspace) => {
          try {
            closeModal();
            await requestWorkspaceRestore(workspace);
            await switchWorkspace(workspace.slug, { skipSave: true, toastMessage: "Workspace restaure." });
          } catch (error) {
            toast(error.message || "Impossible de restaurer le workspace.");
          }
        },
      });

      deletedSection.append(deletedHeader, deletedList);
      wrapper.append(identity, deletedSection);
      return wrapper;
    },
  });
}

async function openWorkspaceSharePanel(workspaceSlug = currentWorkspaceSlug()) {
  let details;
  let invitePeople = [];
  try {
    details = await fetchWorkspaceDetails(workspaceSlug);
  } catch (error) {
    toast(error.message || "Impossible de charger le partage du workspace.");
    return;
  }
  if (details.workspace?.permissions?.canInvite) {
    try {
      invitePeople = await ensurePeopleDirectoryLoaded();
    } catch (error) {
      console.error("Failed to load invite suggestions", error);
      toast("Les suggestions d'utilisateurs sont indisponibles, mais l'invitation par email reste possible.");
    }
  }

  openModal({
    kicker: "Partage",
    title: details.workspace?.name || "Workspace",
    contentBuilder: () => {
      const wrapper = document.createElement("div");
      wrapper.className = "workspace-share-panel";

      const intro = document.createElement("p");
      intro.className = "admin-hint";
      intro.textContent = details.workspace?.permissions?.canInvite
        ? "Invitez un utilisateur deja cree dans Flowcean, ou une adresse email qui rejoindra le workspace plus tard avec le role choisi."
        : "Voici les membres de ce workspace. Seuls les proprietaires et admins du workspace peuvent inviter de nouveaux membres.";

      wrapper.appendChild(intro);

      const roleHelp = document.createElement("div");
      roleHelp.className = "permission-help";
      [
        ["Lecture seule", "Peut consulter sans modifier."],
        ["Editeur", "Peut creer, modifier et commenter."],
        ["Admin workspace", "Peut inviter et gerer les membres."],
      ].forEach(([label, description]) => {
        const item = document.createElement("span");
        item.innerHTML = `<strong>${label}</strong> ${description}`;
        roleHelp.appendChild(item);
      });
      wrapper.appendChild(roleHelp);

      if (details.workspace?.permissions?.canInvite) {
        const form = document.createElement("form");
        form.className = "workspace-form";
        const canManageMembers = Boolean(details.workspace?.permissions?.canManageMembers);

        let candidateUsers = getWorkspaceInviteCandidates(invitePeople, details);

        const emailField = document.createElement("div");
        emailField.className = "invite-search-field";

        const emailInput = document.createElement("input");
        emailInput.type = "text";
        emailInput.placeholder = "Nom, prenom ou email";
        emailInput.autocomplete = "off";
        emailInput.setAttribute("aria-label", "Utilisateur a inviter");

        const suggestions = renderInviteSuggestionList(candidateUsers, emailInput, (user) => {
          emailInput.value = user.email;
          emailInput.dataset.selectedUserId = user.id;
        });
        emailField.append(emailInput, suggestions.list);

        const roleSelect = document.createElement("select");
        [
          ["editor", "Editeur"],
          ["viewer", "Lecture seule"],
          ["admin", "Admin workspace"],
        ].forEach(([value, label]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = label;
          roleSelect.appendChild(option);
        });

        const submit = document.createElement("button");
        submit.type = "submit";
        submit.className = "card-button primary";
        submit.textContent = "Inviter";

        let memberList;
        let inviteList;
        const updateMemberRole = async (member, role, control) => {
          const previousRole = member.workspaceRole;
          control.disabled = true;
          try {
            const payload = await apiRequest(WORKSPACES_API_URL, {
              method: "POST",
              body: JSON.stringify({
                action: "update_member_role",
                workspaceSlug,
                userId: member.id,
                role,
              }),
            });
            details = {
              ...details,
              workspace: payload.workspace || details.workspace,
              members: payload.members || details.members,
              invitations: payload.invitations || details.invitations,
            };
            renderLists();
            toast("Droits modifies.");
          } catch (error) {
            control.value = previousRole;
            toast(error.message || "Impossible de modifier les droits.");
          } finally {
            control.disabled = false;
          }
        };
        const removeMember = async (member, button) => {
          const confirmed = window.confirm(`Retirer ${member.displayName} du workspace "${details.workspace?.name || "Workspace"}" ?`);
          if (!confirmed) return;
          button.disabled = true;
          try {
            const payload = await apiRequest(WORKSPACES_API_URL, {
              method: "POST",
              body: JSON.stringify({
                action: "remove_member",
                workspaceSlug,
                userId: member.id,
              }),
            });
            details = {
              ...details,
              workspace: payload.workspace || details.workspace,
              members: payload.members || details.members,
              invitations: payload.invitations || details.invitations,
            };
            candidateUsers = getWorkspaceInviteCandidates(invitePeople, details);
            suggestions.setCandidates(candidateUsers);
            renderLists();
            toast("Membre retire du workspace.");
          } catch (error) {
            toast(error.message || "Impossible de retirer ce membre.");
          } finally {
            button.disabled = false;
          }
        };
        const renderLists = () => {
          const nextMembers = renderWorkspaceMemberList(details.members || [], {
            canManage: canManageMembers,
            onRoleChange: updateMemberRole,
            onRemove: removeMember,
          });
          const nextInvitations = renderWorkspaceInvitationAdminList(details.invitations || []);

          if (memberList) memberList.replaceWith(nextMembers);
          if (inviteList) inviteList.replaceWith(nextInvitations);

          memberList = nextMembers;
          inviteList = nextInvitations;
        };

        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          submit.disabled = true;

          try {
            const rawTarget = emailInput.value.trim();
            const selectedUser = candidateUsers.find((user) => (
              user.id === emailInput.dataset.selectedUserId ||
              user.email.toLowerCase() === rawTarget.toLowerCase() ||
              user.displayName.toLowerCase() === rawTarget.toLowerCase()
            ));
            const email = selectedUser?.email || rawTarget;
            if (!email.includes("@")) {
              throw new Error("Choisissez un utilisateur propose ou entrez une adresse email complete.");
            }

            const payload = await apiRequest(WORKSPACES_API_URL, {
              method: "POST",
              body: JSON.stringify({
                action: "invite",
                workspaceSlug,
                email,
                role: roleSelect.value,
              }),
            });
            details = {
              ...details,
              members: payload.members || details.members,
              invitations: payload.invitations || details.invitations,
            };
            candidateUsers = getWorkspaceInviteCandidates(invitePeople, details);
            suggestions.setCandidates(candidateUsers);
            renderLists();
            form.reset();
            delete emailInput.dataset.selectedUserId;
            suggestions.renderMatches();
            roleSelect.value = "editor";
            toast("Invitation enregistree.");
          } catch (error) {
            toast(error.message || "Impossible d inviter cet utilisateur.");
          } finally {
            submit.disabled = false;
          }
        });

        form.append(emailField, roleSelect, submit);
        wrapper.appendChild(form);

        const membersSection = document.createElement("section");
        membersSection.className = "workspace-section";
        const membersTitle = document.createElement("h3");
        membersTitle.className = "workspace-section-title";
        membersTitle.textContent = "Membres";
        memberList = renderWorkspaceMemberList(details.members || [], {
          canManage: canManageMembers,
          onRoleChange: updateMemberRole,
          onRemove: removeMember,
        });
        membersSection.append(membersTitle, memberList);

        const invitesSection = document.createElement("section");
        invitesSection.className = "workspace-section";
        const invitesTitle = document.createElement("h3");
        invitesTitle.className = "workspace-section-title";
        invitesTitle.textContent = "Invitations en attente";
        inviteList = renderWorkspaceInvitationAdminList(details.invitations || []);
        invitesSection.append(invitesTitle, inviteList);

        wrapper.append(membersSection, invitesSection);
      } else {
        const membersSection = document.createElement("section");
        membersSection.className = "workspace-section";
        const membersTitle = document.createElement("h3");
        membersTitle.className = "workspace-section-title";
        membersTitle.textContent = "Membres";
        membersSection.append(membersTitle, renderWorkspaceMemberList(details.members || []));
        wrapper.appendChild(membersSection);
      }

      return wrapper;
    },
  });
}

async function sendPresenceHeartbeat(action = "heartbeat") {
  const workspaceSlug = currentWorkspaceSlug();
  if (!authState.authenticated || !workspaceSlug) return null;

  try {
    const payload = await apiRequest(PRESENCE_API_URL, {
      method: "POST",
      body: JSON.stringify({ ...buildPresencePayload(action), workspaceSlug }),
    });
    if (payload.workspaceSlug === workspaceSlug && payload.presence) {
      applyPresenceSnapshot(payload.presence);
    }
    return payload;
  } catch (error) {
    if (error.status === 401) {
      await fetchAuthState();
    } else {
      console.error("Failed to sync presence", error);
    }
    return null;
  }
}

function sendPresenceLeaveBeacon(workspaceSlug = currentWorkspaceSlug()) {
  if (!workspaceSlug || !navigator.sendBeacon) return;

  const payload = {
    action: "leave",
    workspaceSlug,
    clientId: CLIENT_INSTANCE_ID,
  };

  try {
    const body = new Blob([JSON.stringify(payload)], { type: "application/json" });
    navigator.sendBeacon(PRESENCE_API_URL, body);
  } catch (error) {
    console.error("Failed to send presence leave beacon", error);
  }
}

async function refreshWorkspaceFromRealtime() {
  if (isRealtimeRefreshing) {
    pendingRealtimeRefresh = true;
    return;
  }

  isRealtimeRefreshing = true;
  try {
    const payload = await fetchWorkspaceFromServer(currentWorkspaceSlug());
    if ((payload.meta?.version || 0) <= Number(state.meta?.serverVersion || 0)) {
      return;
    }

    applyServerPayload(payload, { fallbackPageId: state.ui.activePageId });
    render();
    elements.storageChip.textContent = `Mises a jour recues • v${state.meta.serverVersion}`;
  } catch (error) {
    console.error("Failed to refresh workspace from realtime event", error);
    if (error.status === 401) {
      await fetchAuthState();
    }
  } finally {
    isRealtimeRefreshing = false;
    if (pendingRealtimeRefresh) {
      pendingRealtimeRefresh = false;
      void refreshWorkspaceFromRealtime();
    }
  }
}

function handleRealtimeWorkspaceEvent(event) {
  lastRealtimeEventId = Math.max(lastRealtimeEventId, Number(event.id || 0));
  if (event.eventType !== "workspace.saved") return;

  const payload = event.payload || {};
  const remoteVersion = Number(payload.version || 0);
  const remoteClientId = payload.clientId || null;

  if (remoteVersion <= Number(state.meta?.serverVersion || 0)) return;
  if (event.actorUserId === authState.user?.id && remoteClientId === CLIENT_INSTANCE_ID) return;

  void refreshWorkspaceFromRealtime();
}

function stopRealtimeSession(options = {}) {
  if (realtimeSource) {
    realtimeSource.close();
    realtimeSource = null;
  }
  if (realtimeHeartbeatTimer) {
    window.clearInterval(realtimeHeartbeatTimer);
    realtimeHeartbeatTimer = null;
  }
  if (realtimeReconnectTimer) {
    window.clearTimeout(realtimeReconnectTimer);
    realtimeReconnectTimer = null;
  }

  if (options.leave !== false && authState.authenticated && currentWorkspaceSlug()) {
    sendPresenceLeaveBeacon(options.slug || currentWorkspaceSlug());
  }

  realtimePresence = [];
  realtimePresenceKey = "[]";
  lastRealtimeEventId = 0;
  renderLivePresence();
}

function connectRealtime() {
  if (!authState.authenticated || !currentWorkspaceSlug()) return;
  if (typeof EventSource !== "function") return;

  if (realtimeSource) {
    realtimeSource.close();
    realtimeSource = null;
  }

  const source = new EventSource(buildRealtimeApiUrl(currentWorkspaceSlug()));
  realtimeSource = source;

  source.addEventListener("ready", (event) => {
    try {
      const payload = JSON.parse(event.data || "{}");
      lastRealtimeEventId = Math.max(lastRealtimeEventId, Number(payload.lastEventId || 0));
    } catch (error) {
      console.error("Failed to parse realtime ready payload", error);
    }
  });

  source.addEventListener("presence.sync", (event) => {
    try {
      const payload = JSON.parse(event.data || "{}");
      if (payload.workspaceSlug && payload.workspaceSlug !== currentWorkspaceSlug()) return;
      applyPresenceSnapshot(payload.presence || []);
    } catch (error) {
      console.error("Failed to parse presence payload", error);
    }
  });

  source.addEventListener("workspace.event", (event) => {
    try {
      const payload = JSON.parse(event.data || "{}");
      handleRealtimeWorkspaceEvent(payload);
    } catch (error) {
      console.error("Failed to parse realtime workspace event", error);
    }
  });

  source.onerror = () => {
    if (realtimeSource !== source) return;
    source.close();
    realtimeSource = null;
    if (realtimeReconnectTimer) {
      window.clearTimeout(realtimeReconnectTimer);
    }
    realtimeReconnectTimer = window.setTimeout(() => {
      if (authState.authenticated) {
        connectRealtime();
      }
    }, 2000);
  };
}

function startRealtimeSession() {
  stopRealtimeSession({ leave: false });
  void sendPresenceHeartbeat("heartbeat");
  realtimeHeartbeatTimer = window.setInterval(() => {
    void sendPresenceHeartbeat("heartbeat");
  }, 10000);
}

async function hydrateStateFromServer(slug = currentWorkspaceSlug()) {
  elements.storageChip.textContent = "Connexion serveur...";

  try {
    const payload = await fetchWorkspaceFromServer(slug);

    if (payload.meta?.created && bootstrapCacheState) {
      state = normalizeState(bootstrapCacheState);
      state.meta.workspaceSlug = payload.meta.slug || slug;
      render();
      await persistNow("Donnees locales migrees vers MySQL");
      toast("L'ancien espace local a ete migre vers le serveur.");
      return;
    }

    applyServerPayload(payload);
    render();
    elements.storageChip.textContent = `Serveur synchronise • v${state.meta.serverVersion}`;
  } catch (error) {
    console.error("Failed to hydrate workspace from server", error);
    if (error.status === 401) {
      await fetchAuthState();
      return;
    }
    elements.storageChip.textContent = bootstrapCacheState
      ? "Mode hors ligne • copie locale ouverte"
      : "Serveur indisponible";

    if (bootstrapCacheState) {
      toast("Serveur indisponible, ouverture de la copie locale.");
    } else {
      render();
      toast("Impossible de joindre le stockage serveur.");
    }
  }
}

function scheduleSave(message = "Donnees synchronisees sur le serveur", delay = 240) {
  clearTimeout(saveTimer);
  elements.storageChip.textContent = "Synchronisation en attente...";
  saveTimer = window.setTimeout(() => {
    void persistNow(message);
  }, delay);
}

function scheduleUserPreferencesSave(message = "Preferences utilisateur synchronisees") {
  clearTimeout(preferencesSaveTimer);
  storeStateLocally();
  elements.storageChip.textContent = "Preferences en attente...";
  preferencesSaveTimer = window.setTimeout(() => {
    void persistUserPreferencesNow(message);
  }, 180);
}

async function persistUserPreferencesNow(message = "Preferences utilisateur synchronisees") {
  state.userPreferences = normalizeUserPreferences(state.userPreferences);
  storeStateLocally();

  if (!authState.authenticated || !currentWorkspaceSlug()) {
    elements.storageChip.textContent = message;
    return null;
  }

  try {
    elements.storageChip.textContent = "Synchronisation preferences...";
    const payload = await apiRequest(buildPreferencesApiUrl(), {
      method: "PUT",
      body: JSON.stringify({ preferences: state.userPreferences }),
    });
    state.userPreferences = normalizeUserPreferences(payload.userPreferences || state.userPreferences);
    storeStateLocally();
    elements.storageChip.textContent = message;
    return payload;
  } catch (error) {
    console.error("Failed to persist user preferences", error);
    if (error.status === 401) {
      await fetchAuthState();
      return null;
    }
    elements.storageChip.textContent = "Preferences locales conservees";
    toast("Favori garde localement en attendant le serveur.");
    return null;
  }
}

async function persistNow(message = "Donnees synchronisees sur le serveur", options = {}) {
  state.ui.activePageId = getActivePage()?.id || state.ui.activePageId;
  storeStateLocally();

  if (options.server === false) {
    elements.storageChip.textContent = message;
    return null;
  }

  const saveId = ++lastServerSaveId;
  const serverState = buildServerStateSnapshot();

  try {
    isSyncingState = true;
    elements.storageChip.textContent = "Synchronisation serveur...";

    const response = await fetch(buildWorkspaceApiUrl(options.slug || currentWorkspaceSlug()), {
      method: "PUT",
      credentials: "same-origin",
      headers: oceanErpAuthHeaders({
        "Content-Type": "application/json",
        Accept: "application/json",
      }),
      body: JSON.stringify({
        name: state.workspace?.name || "Flowcean",
        expectedVersion: Number.isFinite(state.meta?.serverVersion) ? state.meta.serverVersion : null,
        clientId: CLIENT_INSTANCE_ID,
        state: serverState,
      }),
    });

    const payload = await response.json();

    if (response.status === 409 && payload.workspace && payload.meta) {
      applyServerPayload(payload);
      render();
      elements.storageChip.textContent = "Conflit de synchronisation";
      toast("Une version plus recente existe deja sur le serveur.");
      return null;
    }

    if (!response.ok || !payload.ok) {
      throw new Error(payload.message || `HTTP ${response.status}`);
    }

    if (saveId === lastServerSaveId) {
      mergeServerMeta(payload.meta || {});
      storeStateLocally();
    }

    elements.storageChip.textContent = message;
    return payload;
  } catch (error) {
    console.error("Failed to persist workspace", error);
    if (error.status === 401) {
      await fetchAuthState();
      return null;
    }
    elements.storageChip.textContent = "Serveur indisponible • copie locale conservee";
    toast("Modification gardee localement en attente du serveur.");
    return null;
  } finally {
    isSyncingState = false;
  }
}

async function initializeApp() {
  await refreshWorkspaceDirectory();
  try {
    await refreshAccountNotifications();
  } catch (error) {
    console.error("Failed to load account notifications", error);
  }
  const activeSlug = currentWorkspaceSlug();
  bootstrapCacheState = loadCachedState(activeSlug);
  clearUndoHistory();
  state = normalizeState(bootstrapCacheState || createInitialState());
  state.meta.workspaceSlug = activeSlug;
  if (!appListenersInstalled) {
    installEventListeners();
    appListenersInstalled = true;
  }
  applySavedSidebarWidth();
  render();
  if (activeSlug) {
    await hydrateStateFromServer(activeSlug);
  }
  startAccountNotificationPolling();
  startRealtimeSession();
}

function installEventListeners() {
  elements.newPageLauncher.addEventListener("click", (event) => openCreatePageMenu(event.currentTarget));
  elements.newRootPage.addEventListener("click", (event) => openCreatePageMenu(event.currentTarget));
  elements.pageTitle.addEventListener("input", () => {
    const page = getActivePage();
    if (!page || page.deletedAt) return;
    if (page.title !== elements.pageTitle.value) {
      recordUndoSnapshot("Titre modifie", {
        coalesceKey: `page-title:${page.id}`,
        coalesceMs: UNDO_TEXT_COALESCE_MS,
      });
    }
    page.title = elements.pageTitle.value;
    page.updatedAt = Date.now();
    elements.heroTitle.textContent = page.title || "Sans titre";
    scheduleSave();
    void sendPresenceHeartbeat("heartbeat");
    renderSidebar();
    renderBreadcrumbs(page);
  });

  elements.toggleTheme.addEventListener("click", () => {
    state.workspace.theme = state.workspace.theme === "dark" ? "light" : "dark";
    persistNow("Theme modifie");
    render();
  });

  elements.cycleIcon.addEventListener("click", openIconPickerModal);
  elements.toggleFavorite.addEventListener("click", toggleActiveFavorite);
  elements.openSearch.addEventListener("click", () => openSearchModal());
  elements.searchButton.addEventListener("click", () => openSearchModal());
  elements.openTemplates.addEventListener("click", () => openTemplatesModal());
  elements.templateButton.addEventListener("click", () => openTemplatesModal());
  elements.openHelp.addEventListener("click", openHelpModal);
  elements.currentUserChip.addEventListener("click", (event) => {
    openUserMenu(event.currentTarget);
  });
  elements.currentUserChip.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openUserMenu(elements.currentUserChip);
    }
  });
  elements.workspaceButton.addEventListener("click", () => { void openWorkspaceManager(); });
  elements.shareWorkspaceButton.addEventListener("click", () => { void openWorkspaceSharePanel(); });
  elements.adminButton.addEventListener("click", () => { window.location.href = "/OceanOS/"; });
  elements.logoutButton.addEventListener("click", () => { void handleLogout(); });
  elements.duplicatePage.addEventListener("click", () => duplicatePage(getActivePage().id));
  elements.deletePage.addEventListener("click", () => {
    const page = getActivePage();
    if (!page) return;
    if (page.deletedAt) restorePage(page.id);
    else movePageToTrash(page.id);
  });
  elements.triggerExport.addEventListener("click", exportWorkspace);
  elements.triggerImport.addEventListener("click", () => elements.importInput.click());
  elements.importInput.addEventListener("change", () => importWorkspace(elements.importInput.files[0]));
  elements.closeModal.addEventListener("click", closeModal);
  elements.modalBackdrop.addEventListener("click", closeModal);
  elements.openSidebar.addEventListener("click", openSidebar);
  elements.closeSidebar.addEventListener("click", closeSidebar);
  installSidebarResize();
  elements.brandHome.addEventListener("click", () => {
    const first = getVisiblePages()[0];
    if (first) setActivePage(first.id);
  });

  document.addEventListener("mousedown", (event) => {
    if (ui.cellDetailPopover?.element && !ui.cellDetailPopover.element.contains(event.target)) {
      hideCellDetailPopover(true);
    }
    if (!elements.contextMenu.contains(event.target) && !event.target.closest(".tiny-button")) {
      hideContextMenu();
    }
    if (!elements.slashMenu.contains(event.target)) {
      hideSlashMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && ((event.shiftKey && event.key.toLowerCase() === "z") || event.key.toLowerCase() === "y")) {
      if (shouldLetBrowserHandleUndo(event.target)) return;
      event.preventDefault();
      redoLastAction();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
      if (shouldLetBrowserHandleUndo(event.target)) return;
      event.preventDefault();
      undoLastAction();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openSearchModal();
    }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "d") {
      event.preventDefault();
      const page = getActivePage();
      if (page) duplicatePage(page.id);
    }
    if (event.key === "Escape") {
      hideCellDetailPopover(true);
      closeModal();
      hideContextMenu();
      hideSlashMenu();
      closeSidebar();
    }
  });

  window.addEventListener("beforeunload", () => {
    stopRealtimeSession({ leave: true });
  });
}

function installAuthEventListeners() {
  if (authListenersInstalled) return;
  authListenersInstalled = true;
  elements.authForm.addEventListener("submit", (event) => { void handleAuthSubmit(event); });
}

async function initializeRuntime() {
  installAuthEventListeners();
  try {
    await fetchAuthState();
    if (authState.authenticated) {
      await initializeApp();
    }
  } catch (error) {
    redirectToOceanOS();
  }
}

void initializeRuntime();
