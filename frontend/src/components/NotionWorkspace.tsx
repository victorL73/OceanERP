import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  BookOpen,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Database,
  Download,
  FileText,
  FolderTree,
  GripVertical,
  Hash,
  Image as ImageIcon,
  KanbanSquare,
  LayoutList,
  List,
  ListTodo,
  MoreHorizontal,
  PanelRight,
  Plus,
  Quote,
  Search,
  Share2,
  Star,
  Table2,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
import { api } from '../api/client';
import type { FlowceanWorkspace, FlowceanWorkspaceSummary } from '../types';

type NotionBlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'todo'
  | 'bullet'
  | 'numbered'
  | 'quote'
  | 'callout'
  | 'code'
  | 'divider'
  | 'image'
  | 'file'
  | 'database';

type NotionDatabaseView = 'table' | 'board' | 'calendar' | 'list';
type NotionPropertyType = 'text' | 'select' | 'status' | 'date' | 'checkbox' | 'number' | 'email' | 'url';
type NotionCellValue = string | number | boolean | null;

type NotionBlock = {
  id: string;
  type: NotionBlockType;
  text: string;
  checked?: boolean;
  url?: string;
  caption?: string;
  color?: string;
  database?: NotionDatabase;
};

type NotionProperty = {
  id: string;
  name: string;
  type: NotionPropertyType;
  options: string[];
};

type NotionRow = {
  id: string;
  cells: Record<string, NotionCellValue>;
};

type NotionDatabase = {
  activeView: NotionDatabaseView;
  properties: NotionProperty[];
  rows: NotionRow[];
};

type NotionPage = {
  id: string;
  parentId: string | null;
  title: string;
  icon: string;
  cover?: string;
  favorite?: boolean;
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
  blocks: NotionBlock[];
  database?: NotionDatabase | null;
};

type NotionActivity = {
  id: string;
  label: string;
  at: number;
};

type NotionShare = {
  id: string;
  email: string;
  role: 'lecture' | 'edition';
};

type NotionWorkspaceState = {
  schema: 'ocean-notion-v1';
  workspace: {
    name: string;
    icon: string;
    theme: 'light' | 'focus';
  };
  ui: {
    activePageId: string;
    expandedPageIds: string[];
  };
  pages: NotionPage[];
  shares: NotionShare[];
  activity: NotionActivity[];
};

type SearchHit = {
  page: NotionPage;
  block?: NotionBlock;
  label: string;
};

const CACHE_PREFIX = 'oceanerp.notion.cache';
const ACTIVE_WORKSPACE_KEY = 'oceanerp.notion.active-workspace';

const blockTools: Array<{ type: NotionBlockType; label: string; description: string; icon: typeof Type }> = [
  { type: 'paragraph', label: 'Texte', description: 'Un bloc de texte simple', icon: Type },
  { type: 'heading1', label: 'Titre 1', description: 'Grand titre de section', icon: Hash },
  { type: 'heading2', label: 'Titre 2', description: 'Sous-section', icon: Hash },
  { type: 'heading3', label: 'Titre 3', description: 'Titre compact', icon: Hash },
  { type: 'todo', label: 'Todo', description: 'Case a cocher', icon: CheckSquare },
  { type: 'bullet', label: 'Liste', description: 'Liste a puces', icon: List },
  { type: 'numbered', label: 'Liste numerotee', description: 'Liste ordonnee', icon: LayoutList },
  { type: 'quote', label: 'Citation', description: 'Mise en avant sobre', icon: Quote },
  { type: 'callout', label: 'Encart', description: 'Information importante', icon: PanelRight },
  { type: 'code', label: 'Code', description: 'Bloc technique', icon: Code2 },
  { type: 'image', label: 'Image', description: 'Image par URL', icon: ImageIcon },
  { type: 'file', label: 'Fichier', description: 'Lien vers un fichier', icon: FileText },
  { type: 'database', label: 'Base de donnees', description: 'Tableau, cartes, calendrier', icon: Database },
  { type: 'divider', label: 'Separateur', description: 'Ligne de separation', icon: MoreHorizontal },
];

function blockTool(type: NotionBlockType) {
  return blockTools.find((tool) => tool.type === type) ?? blockTools[0];
}

function nextBlockType(type: NotionBlockType): NotionBlockType {
  return type === 'bullet' || type === 'numbered' || type === 'todo' ? type : 'paragraph';
}

const propertyTypes: NotionPropertyType[] = ['text', 'select', 'status', 'date', 'checkbox', 'number', 'email', 'url'];

export function NotionWorkspaceModule() {
  const [workspaces, setWorkspaces] = useState<FlowceanWorkspaceSummary[]>([]);
  const [workspace, setWorkspace] = useState<FlowceanWorkspace | null>(null);
  const [state, setState] = useState<NotionWorkspaceState | null>(null);
  const [status, setStatus] = useState('Chargement...');
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [query, setQuery] = useState('');
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<'lecture' | 'edition'>('edition');
  const [showTrash, setShowTrash] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [slashBlockId, setSlashBlockId] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);
  const lastSerialized = useRef('');

  useEffect(() => {
    void loadWorkspaces();
  }, []);

  useEffect(() => {
    if (!dirty || !workspace || !state) {
      return;
    }

    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }

    saveTimer.current = window.setTimeout(() => {
      void saveWorkspace('Sauvegarde automatique');
    }, 900);

    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [dirty, state, workspace]);

  const pages = state?.pages ?? [];
  const activePage = state ? pages.find((page) => page.id === state.ui.activePageId && !page.archived) ?? pages.find((page) => !page.archived) ?? null : null;
  const visiblePages = pages.filter((page) => (showTrash ? page.archived : !page.archived));
  const rootPages = visiblePages.filter((page) => !page.parentId);
  const favoritePages = pages.filter((page) => page.favorite && !page.archived);
  const recentPages = [...pages.filter((page) => !page.archived)].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
  const searchHits = useMemo(() => buildSearchHits(pages.filter((page) => !page.archived), query || sidebarSearch), [pages, query, sidebarSearch]);
  const breadcrumbs = activePage ? buildBreadcrumbs(pages, activePage) : [];

  async function loadWorkspaces() {
    setStatus('Chargement...');
    setError(null);
    try {
      const result = await api.flowceanWorkspaces();
      setWorkspaces(result.items);
      const preferredSlug = localStorage.getItem(ACTIVE_WORKSPACE_KEY) ?? result.items[0]?.slug ?? 'main';
      await openWorkspace(preferredSlug);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Impossible de charger les espaces.';
      setError(message);
      setStatus('Mode local');
      const fallback = createDefaultState('Espace OceanERP');
      setState(fallback);
      lastSerialized.current = JSON.stringify(fallback);
    }
  }

  async function openWorkspace(slug: string) {
    setStatus('Chargement...');
    setError(null);
    try {
      const loaded = await api.flowceanWorkspace(slug);
      const parsed = parseWorkspaceState(loaded);
      setWorkspace(loaded);
      setState(parsed);
      setDirty(false);
      lastSerialized.current = JSON.stringify(parsed);
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, loaded.slug);
      localStorage.setItem(cacheKey(loaded.slug), lastSerialized.current);
      setStatus('Synchronise');
    } catch (loadError) {
      const cached = localStorage.getItem(cacheKey(slug));
      if (cached) {
        const parsed = normalizeWorkspaceState(JSON.parse(cached), 'Espace hors ligne');
        setState(parsed);
        lastSerialized.current = JSON.stringify(parsed);
        setStatus('Cache local');
        return;
      }

      setError(loadError instanceof Error ? loadError.message : 'Chargement impossible.');
      setStatus('Erreur');
    }
  }

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newWorkspaceName.trim();
    if (!name) {
      return;
    }

    setStatus('Creation...');
    setError(null);
    try {
      const created = await api.createFlowceanWorkspace({ name });
      setNewWorkspaceName('');
      setWorkspaces((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      await openWorkspace(created.slug);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Creation impossible.');
      setStatus('Erreur');
    }
  }

  async function saveWorkspace(label: string) {
    if (!workspace || !state) {
      return;
    }

    const serialized = JSON.stringify(state);
    if (serialized === lastSerialized.current) {
      setDirty(false);
      return;
    }

    setStatus('Sauvegarde...');
    try {
      const saved = await api.saveFlowceanWorkspace(workspace.slug, {
        dataJson: serialized,
        version: workspace.version,
        eventType: label,
      });
      setWorkspace(saved);
      setWorkspaces((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      lastSerialized.current = serialized;
      localStorage.setItem(cacheKey(saved.slug), serialized);
      setDirty(false);
      setStatus('Sauvegarde');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Sauvegarde impossible.');
      setStatus('Erreur sauvegarde');
    }
  }

  function mutate(mutator: (draft: NotionWorkspaceState) => void, activityLabel?: string) {
    setState((current) => {
      if (!current) {
        return current;
      }

      const draft = cloneState(current);
      mutator(draft);
      if (activityLabel) {
        draft.activity = [{ id: createId('activity'), label: activityLabel, at: Date.now() }, ...draft.activity].slice(0, 60);
      }
      setDirty(true);
      return draft;
    });
  }

  function openPage(pageId: string) {
    mutate((draft) => {
      draft.ui.activePageId = pageId;
      const page = draft.pages.find((item) => item.id === pageId);
      if (page) {
        page.updatedAt = Date.now();
      }
    });
  }

  function toggleExpanded(pageId: string) {
    mutate((draft) => {
      draft.ui.expandedPageIds = draft.ui.expandedPageIds.includes(pageId)
        ? draft.ui.expandedPageIds.filter((id) => id !== pageId)
        : [...draft.ui.expandedPageIds, pageId];
    });
  }

  function createPage(parentId: string | null = null, kind: 'document' | 'database' = 'document') {
    mutate((draft) => {
      const page = createPageModel(parentId, kind);
      draft.pages.unshift(page);
      draft.ui.activePageId = page.id;
      if (parentId && !draft.ui.expandedPageIds.includes(parentId)) {
        draft.ui.expandedPageIds.push(parentId);
      }
    }, 'Page creee');
  }

  function createFromTemplate(template: NotionPage) {
    mutate((draft) => {
      const page = rekeyPage(template);
      draft.pages.unshift(page);
      draft.ui.activePageId = page.id;
    }, `Modele ajoute : ${template.title}`);
    setShowTemplates(false);
  }

  function updatePage(pageId: string, patch: Partial<NotionPage>, label?: string) {
    mutate((draft) => {
      const page = draft.pages.find((item) => item.id === pageId);
      if (!page) {
        return;
      }
      Object.assign(page, patch, { updatedAt: Date.now() });
    }, label);
  }

  function duplicatePage(pageId: string) {
    mutate((draft) => {
      const page = draft.pages.find((item) => item.id === pageId);
      if (!page) {
        return;
      }
      const clone = rekeyPage(page);
      clone.title = `${page.title} copie`;
      clone.favorite = false;
      draft.pages.unshift(clone);
      draft.ui.activePageId = clone.id;
    }, 'Page dupliquee');
  }

  function archivePage(pageId: string) {
    mutate((draft) => {
      const page = draft.pages.find((item) => item.id === pageId);
      if (!page) {
        return;
      }
      page.archived = true;
      page.updatedAt = Date.now();
      const children = draft.pages.filter((item) => item.parentId === pageId);
      children.forEach((child) => {
        child.archived = true;
        child.updatedAt = Date.now();
      });
      draft.ui.activePageId = draft.pages.find((item) => !item.archived)?.id ?? pageId;
    }, 'Page envoyee a la corbeille');
  }

  function restorePage(pageId: string) {
    updatePage(pageId, { archived: false }, 'Page restauree');
  }

  function addPageBlock(pageId: string, type: NotionBlockType) {
    mutate((draft) => {
      const page = draft.pages.find((item) => item.id === pageId);
      if (!page) {
        return;
      }
      if (type === 'database') {
        page.blocks.push(createBlock('database'));
      } else {
        page.blocks.push(createBlock(type));
      }
      page.updatedAt = Date.now();
    }, 'Bloc ajoute');
  }

  function deletePageForever(pageId: string) {
    if (!window.confirm('Supprimer definitivement cette page et ses sous-pages ?')) {
      return;
    }

    mutate((draft) => {
      const ids = collectPageAndChildren(draft.pages, pageId);
      draft.pages = draft.pages.filter((page) => !ids.includes(page.id));
      draft.ui.activePageId = draft.pages.find((page) => !page.archived)?.id ?? '';
    }, 'Page supprimee definitivement');
  }

  function addShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = shareEmail.trim().toLowerCase();
    if (!email) {
      return;
    }

    mutate((draft) => {
      const existing = draft.shares.find((share) => share.email === email);
      if (existing) {
        existing.role = shareRole;
      } else {
        draft.shares.push({ id: createId('share'), email, role: shareRole });
      }
    }, 'Partage mis a jour');
    setShareEmail('');
  }

  function removeShare(shareId: string) {
    mutate((draft) => {
      draft.shares = draft.shares.filter((share) => share.id !== shareId);
    }, 'Partage retire');
  }

  function importWorkspace(event: FormEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = normalizeWorkspaceState(JSON.parse(String(reader.result)), workspace?.name ?? 'Espace importe');
        setState(imported);
        setDirty(true);
        setStatus('Import a sauvegarder');
      } catch {
        setError('Le fichier importe ne correspond pas a un espace valide.');
      }
    };
    reader.readAsText(file);
    event.currentTarget.value = '';
  }

  function exportWorkspace() {
    if (!state) {
      return;
    }

    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${workspace?.slug ?? 'espace'}-notion.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!state) {
    return (
      <section className="notion-empty">
        <div className="loading">{status}</div>
      </section>
    );
  }

  return (
    <section className={`notion-shell notion-theme-${state.workspace.theme}`}>
      <aside className="notion-sidebar">
        <div className="notion-workspace-card">
          <button type="button" className="notion-workspace-icon" onClick={() => activePage && updatePage(activePage.id, { icon: promptIcon(activePage.icon) })}>
            {state.workspace.icon}
          </button>
          <div>
            <span>Workspace interne</span>
            <strong>{state.workspace.name}</strong>
          </div>
        </div>

        <button className="primary notion-wide-button" type="button" onClick={() => createPage(null)}>
          <Plus size={16} /> Nouvelle page
        </button>

        <div className="notion-sidebar-actions">
          <button type="button" onClick={() => setShowSearch(true)}><Search size={15} /> Rechercher</button>
          <button type="button" onClick={() => setShowTemplates(true)}><BookOpen size={15} /> Modeles</button>
          <label>
            <Upload size={15} /> Importer
            <input type="file" accept="application/json" onChange={importWorkspace} hidden />
          </label>
          <button type="button" onClick={exportWorkspace}><Download size={15} /> Exporter</button>
        </div>

        <div className="search notion-sidebar-search">
          <Search size={16} />
          <input value={sidebarSearch} onChange={(event) => setSidebarSearch(event.target.value)} placeholder="Rechercher dans l'espace" />
        </div>

        {sidebarSearch.trim() && (
          <section className="notion-nav-section">
            <div className="notion-section-title">Resultats</div>
            <div className="notion-page-list">
              {searchHits.slice(0, 8).map((hit) => (
                <button key={`${hit.page.id}-${hit.block?.id ?? 'page'}`} type="button" onClick={() => openPage(hit.page.id)}>
                  <span className="notion-page-icon">{hit.page.icon}</span>
                  <span>{hit.label}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="notion-sidebar-scroll">
          <NotionMiniList title="Favoris" pages={favoritePages} activeId={activePage?.id ?? null} onOpen={openPage} />

          <section className="notion-nav-section">
            <div className="notion-section-title">
              <span>Espace</span>
              <button type="button" onClick={() => createPage(null)}><Plus size={14} /></button>
            </div>
            <div className="notion-page-list">
              {rootPages.map((page) => (
                <NotionTreeNode
                  key={page.id}
                  page={page}
                  pages={pages}
                  activeId={activePage?.id ?? null}
                  expandedIds={state.ui.expandedPageIds}
                  onOpen={openPage}
                  onToggleExpanded={toggleExpanded}
                  onCreateChild={createPage}
                  depth={0}
                />
              ))}
            </div>
          </section>

          <NotionMiniList title="Recents" pages={recentPages} activeId={activePage?.id ?? null} onOpen={openPage} />

          <section className="notion-nav-section">
            <button className={showTrash ? 'notion-trash-toggle active' : 'notion-trash-toggle'} type="button" onClick={() => setShowTrash((value) => !value)}>
              <Trash2 size={15} /> Corbeille ({pages.filter((page) => page.archived).length})
            </button>
          </section>
        </div>

        <div className="notion-sidebar-footer">
          <span className={dirty ? 'notion-save-state dirty' : 'notion-save-state'}>{dirty ? 'Modifications en attente' : status}</span>
          <button type="button" onClick={() => void saveWorkspace('Sauvegarde manuelle')}>Sauver</button>
        </div>
      </aside>

      <main className="notion-main">
        <header className="notion-topbar">
          <div className="notion-breadcrumbs">
            {breadcrumbs.map((crumb, index) => (
              <button key={crumb.id} type="button" onClick={() => openPage(crumb.id)}>
                {index > 0 && <ChevronRight size={14} />}
                <span>{crumb.icon}</span>
                {crumb.title}
              </button>
            ))}
          </div>
          <div className="notion-topbar-actions">
            <button
              type="button"
              onClick={() => mutate((draft) => { draft.workspace.theme = draft.workspace.theme === 'focus' ? 'light' : 'focus'; }, 'Theme modifie')}
            >
              Theme {state.workspace.theme === 'focus' ? 'clair' : 'focus'}
            </button>
            <select value={workspace?.slug ?? ''} onChange={(event) => void openWorkspace(event.target.value)}>
              {workspaces.map((item) => (
                <option key={item.id} value={item.slug}>{item.name}</option>
              ))}
            </select>
            <form className="notion-new-workspace" onSubmit={createWorkspace}>
              <input value={newWorkspaceName} onChange={(event) => setNewWorkspaceName(event.target.value)} placeholder="Nouvel espace" />
              <button type="submit"><Plus size={14} /> Creer</button>
            </form>
          </div>
        </header>

        {error && <div className="alert danger">{error}</div>}

        {activePage ? (
          <article className="notion-page">
            <div className="notion-cover">
              <button className="notion-page-big-icon" type="button" onClick={() => updatePage(activePage.id, { icon: promptIcon(activePage.icon) }, 'Icone modifiee')}>
                {activePage.icon}
              </button>
              <div className="notion-page-meta">
                <span>Page</span>
                <small>Mise a jour {formatDate(activePage.updatedAt)}</small>
              </div>
            </div>

            <div className="notion-title-row">
              <input value={activePage.title} onChange={(event) => updatePage(activePage.id, { title: event.target.value })} placeholder="Sans titre" />
              <div className="notion-page-actions">
                <button type="button" onClick={() => updatePage(activePage.id, { favorite: !activePage.favorite }, activePage.favorite ? 'Favori retire' : 'Favori ajoute')}>
                  <Star size={16} fill={activePage.favorite ? 'currentColor' : 'none'} /> Favori
                </button>
                <button type="button" onClick={() => duplicatePage(activePage.id)}><Copy size={16} /> Dupliquer</button>
                <button type="button" onClick={() => window.print()}><Download size={16} /> PDF</button>
                {activePage.archived ? (
                  <>
                    <button type="button" onClick={() => restorePage(activePage.id)}><Archive size={16} /> Restaurer</button>
                    <button className="danger" type="button" onClick={() => deletePageForever(activePage.id)}><Trash2 size={16} /> Supprimer</button>
                  </>
                ) : (
                  <button className="danger" type="button" onClick={() => archivePage(activePage.id)}><Trash2 size={16} /> Corbeille</button>
                )}
              </div>
            </div>

            <div className="notion-page-toolbar">
              {blockTools.filter((tool) => tool.type !== 'divider').slice(0, 10).map((tool) => (
                <button key={tool.type} type="button" onClick={() => addPageBlock(activePage.id, tool.type)}>
                  <tool.icon size={15} /> {tool.label}
                </button>
              ))}
            </div>

            {activePage.database ? (
              <NotionDatabaseEditor page={activePage} mutate={mutate} />
            ) : (
              <NotionBlockEditor
                page={activePage}
                slashBlockId={slashBlockId}
                setSlashBlockId={setSlashBlockId}
                mutate={mutate}
              />
            )}
          </article>
        ) : (
          <div className="notion-empty-state">
            <FolderTree size={42} />
            <strong>Aucune page active</strong>
            <button type="button" className="primary" onClick={() => createPage(null)}>Creer une page</button>
          </div>
        )}
      </main>

      <aside className="notion-inspector">
        <div className="notion-inspector-card">
          <h3>Resume</h3>
          <div className="notion-fact-grid">
            <div><span>Pages</span><strong>{pages.filter((page) => !page.archived).length}</strong></div>
            <div><span>Corbeille</span><strong>{pages.filter((page) => page.archived).length}</strong></div>
            <div><span>Blocs</span><strong>{activePage?.blocks.length ?? 0}</strong></div>
            <div><span>Version</span><strong>{workspace?.version ?? '-'}</strong></div>
          </div>
        </div>

        <div className="notion-inspector-card">
          <h3>Actions rapides</h3>
          <button type="button" onClick={() => activePage && createPage(activePage.id)}>Ajouter une sous-page</button>
          <button type="button" onClick={() => createPage(null, 'database')}>Nouvelle base</button>
          <button type="button" onClick={() => setShowTemplates(true)}>Inserer un modele</button>
          <button type="button" onClick={() => window.print()}>Exporter la page en PDF</button>
        </div>

        <div className="notion-inspector-card">
          <h3>Partage</h3>
          <form className="notion-share-form" onSubmit={addShare}>
            <input value={shareEmail} onChange={(event) => setShareEmail(event.target.value)} placeholder="email@entreprise.fr" />
            <select value={shareRole} onChange={(event) => setShareRole(event.target.value as 'lecture' | 'edition')}>
              <option value="edition">Edition</option>
              <option value="lecture">Lecture</option>
            </select>
            <button type="submit"><Share2 size={14} /> Inviter</button>
          </form>
          <div className="notion-share-list">
            {state.shares.length === 0 && <span>Aucun collaborateur invite.</span>}
            {state.shares.map((share) => (
              <article key={share.id}>
                <div>
                  <strong>{share.email}</strong>
                  <small>{share.role}</small>
                </div>
                <button type="button" onClick={() => removeShare(share.id)}><Trash2 size={14} /></button>
              </article>
            ))}
          </div>
        </div>

        <div className="notion-inspector-card">
          <h3>Activite</h3>
          <div className="notion-activity">
            {state.activity.length === 0 && <span>Aucune activite.</span>}
            {state.activity.slice(0, 10).map((item) => (
              <article key={item.id}>
                <strong>{item.label}</strong>
                <small>{formatDate(item.at)}</small>
              </article>
            ))}
          </div>
        </div>
      </aside>

      {showTemplates && (
        <div className="modal-backdrop" onClick={() => setShowTemplates(false)}>
          <section className="modal-card notion-template-modal" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span className="eyebrow">Modeles</span>
                <h2>Ajouter une page structuree</h2>
              </div>
              <button type="button" onClick={() => setShowTemplates(false)}>Fermer</button>
            </header>
            <div className="notion-template-grid">
              {notionTemplates().map((template) => (
                <button key={template.id} type="button" onClick={() => createFromTemplate(template)}>
                  <span>{template.icon}</span>
                  <strong>{template.title}</strong>
                  <small>{template.blocks[0]?.text || 'Modele pret a remplir'}</small>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {showSearch && (
        <div className="modal-backdrop" onClick={() => setShowSearch(false)}>
          <section className="modal-card notion-search-modal" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span className="eyebrow">Recherche</span>
                <h2>Recherche globale</h2>
              </div>
              <button type="button" onClick={() => setShowSearch(false)}>Fermer</button>
            </header>
            <div className="search">
              <Search size={18} />
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Page, bloc, base de donnees..." />
            </div>
            <div className="notion-search-results">
              {searchHits.length === 0 && <span>Aucun resultat.</span>}
              {searchHits.map((hit) => (
                <button key={`${hit.page.id}-${hit.block?.id ?? 'page'}`} type="button" onClick={() => {
                  openPage(hit.page.id);
                  setShowSearch(false);
                }}>
                  <span>{hit.page.icon}</span>
                  <strong>{hit.label}</strong>
                  <small>{hit.page.title}</small>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function NotionBlockEditor({
  page,
  slashBlockId,
  setSlashBlockId,
  mutate,
}: {
  page: NotionPage;
  slashBlockId: string | null;
  setSlashBlockId: (id: string | null) => void;
  mutate: (mutator: (draft: NotionWorkspaceState) => void, activityLabel?: string) => void;
}) {
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);

  function updateBlock(blockId: string, patch: Partial<NotionBlock>, label?: string) {
    mutate((draft) => {
      const targetPage = draft.pages.find((item) => item.id === page.id);
      const block = targetPage?.blocks.find((item) => item.id === blockId);
      if (!targetPage || !block) {
        return;
      }
      Object.assign(block, patch);
      targetPage.updatedAt = Date.now();
    }, label);
  }

  function insertAfter(blockId: string, type: NotionBlockType = 'paragraph') {
    mutate((draft) => {
      const targetPage = draft.pages.find((item) => item.id === page.id);
      if (!targetPage) {
        return;
      }
      const index = targetPage.blocks.findIndex((block) => block.id === blockId);
      targetPage.blocks.splice(index + 1, 0, createBlock(type));
      targetPage.updatedAt = Date.now();
    });
  }

  function moveBlock(blockId: string, direction: -1 | 1) {
    mutate((draft) => {
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
      targetPage.updatedAt = Date.now();
    }, 'Bloc deplace');
  }

  function moveBlockTo(blockId: string, targetBlockId: string) {
    if (blockId === targetBlockId) {
      return;
    }

    mutate((draft) => {
      const targetPage = draft.pages.find((item) => item.id === page.id);
      if (!targetPage) {
        return;
      }
      const from = targetPage.blocks.findIndex((block) => block.id === blockId);
      const to = targetPage.blocks.findIndex((block) => block.id === targetBlockId);
      if (from < 0 || to < 0) {
        return;
      }
      const [block] = targetPage.blocks.splice(from, 1);
      targetPage.blocks.splice(to, 0, block);
      targetPage.updatedAt = Date.now();
    }, 'Bloc deplace');
  }

  function duplicateBlock(blockId: string) {
    mutate((draft) => {
      const targetPage = draft.pages.find((item) => item.id === page.id);
      if (!targetPage) {
        return;
      }
      const index = targetPage.blocks.findIndex((block) => block.id === blockId);
      if (index < 0) {
        return;
      }
      targetPage.blocks.splice(index + 1, 0, { ...clone(targetPage.blocks[index]), id: createId('block') });
      targetPage.updatedAt = Date.now();
    }, 'Bloc duplique');
  }

  function deleteBlock(blockId: string) {
    mutate((draft) => {
      const targetPage = draft.pages.find((item) => item.id === page.id);
      if (!targetPage) {
        return;
      }
      targetPage.blocks = targetPage.blocks.filter((block) => block.id !== blockId);
      if (targetPage.blocks.length === 0) {
        targetPage.blocks.push(createBlock('paragraph'));
      }
      targetPage.updatedAt = Date.now();
    }, 'Bloc supprime');
  }

  function applySlash(blockId: string, type: NotionBlockType) {
    updateBlock(blockId, {
      type,
      text: '',
      checked: type === 'todo' ? false : undefined,
      database: type === 'database' ? createDatabase() : undefined,
    }, 'Type de bloc modifie');
    setSlashBlockId(null);
  }

  return (
    <div className="notion-editor">
      {page.blocks.map((block, index) => {
        const tool = blockTool(block.type);
        const ToolIcon = tool.icon;
        return (
          <div
            key={block.id}
            className={`notion-block notion-block-${block.type}${draggedBlockId === block.id ? ' dragging' : ''}`}
            draggable
            onDragStart={() => setDraggedBlockId(block.id)}
            onDragEnd={() => setDraggedBlockId(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (draggedBlockId) {
                moveBlockTo(draggedBlockId, block.id);
              }
              setDraggedBlockId(null);
            }}
          >
            <div className="notion-block-handle">
              <GripVertical size={15} />
              <button type="button" onClick={() => insertAfter(block.id)}><Plus size={14} /></button>
            </div>

            <button
              type="button"
              className="notion-block-type"
              onClick={() => setSlashBlockId(block.id)}
              title={`Transformer en ${tool.label}`}
            >
              <ToolIcon size={15} />
            </button>

            <BlockInput
              block={block}
              index={index}
              onChange={(patch) => updateBlock(block.id, patch)}
              onEnter={() => insertAfter(block.id, nextBlockType(block.type))}
              onSlash={() => setSlashBlockId(block.id)}
            />

            {slashBlockId === block.id && (
              <div className="notion-slash-menu">
                {blockTools.map((tool) => (
                  <button key={tool.type} type="button" onClick={() => applySlash(block.id, tool.type)}>
                    <tool.icon size={16} />
                    <span>{tool.label}</span>
                    <small>{tool.description}</small>
                  </button>
                ))}
              </div>
            )}

            <div className="notion-block-actions">
              <button type="button" onClick={() => moveBlock(block.id, -1)} disabled={index === 0}>↑</button>
              <button type="button" onClick={() => moveBlock(block.id, 1)} disabled={index === page.blocks.length - 1}>↓</button>
              <button type="button" onClick={() => duplicateBlock(block.id)}><Copy size={14} /></button>
              <button type="button" onClick={() => deleteBlock(block.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BlockInput({
  block,
  index,
  onChange,
  onEnter,
  onSlash,
}: {
  block: NotionBlock;
  index: number;
  onChange: (patch: Partial<NotionBlock>) => void;
  onEnter: () => void;
  onSlash: () => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && block.type !== 'code') {
      event.preventDefault();
      onEnter();
    }

    if (event.key === '/' && !block.text.trim()) {
      onSlash();
    }
  }

  if (block.type === 'divider') {
    return <button type="button" className="notion-divider" onClick={onEnter}>Ajouter un bloc dessous</button>;
  }

  if (block.type === 'todo') {
    return (
      <div className="notion-todo-input">
        <input type="checkbox" checked={Boolean(block.checked)} onChange={(event) => onChange({ checked: event.target.checked })} />
        <textarea value={block.text} onKeyDown={handleKeyDown} onChange={(event) => onChange({ text: event.target.value })} placeholder="Tache a faire" />
      </div>
    );
  }

  if (block.type === 'image') {
    return (
      <div className="notion-media-block">
        <input value={block.url ?? ''} onChange={(event) => onChange({ url: event.target.value })} placeholder="URL de l'image" />
        {block.url && <img src={block.url} alt={block.caption || block.text || 'Image'} />}
        <textarea value={block.caption ?? ''} onChange={(event) => onChange({ caption: event.target.value })} placeholder="Legende" />
      </div>
    );
  }

  if (block.type === 'file') {
    return (
      <div className="notion-file-block">
        <FileText size={18} />
        <input value={block.url ?? ''} onChange={(event) => onChange({ url: event.target.value })} placeholder="Lien du fichier" />
        <input value={block.text} onChange={(event) => onChange({ text: event.target.value })} placeholder="Nom du fichier" />
      </div>
    );
  }

  if (block.type === 'database') {
    return <InlineDatabase database={block.database ?? createDatabase()} onChange={(database) => onChange({ database })} />;
  }

  const placeholder = index === 0 ? 'Tapez / pour ajouter un bloc...' : 'Continuer...';
  const prefix = block.type === 'bullet'
    ? '-'
    : block.type === 'numbered'
      ? `${index + 1}.`
      : block.type === 'quote'
        ? 'Citation'
        : block.type === 'callout'
          ? 'Info'
          : '';

  return (
    <div className={`notion-text-frame notion-text-${block.type}`}>
      {prefix && <span>{prefix}</span>}
      <textarea
        value={block.text}
        onKeyDown={handleKeyDown}
        onChange={(event) => onChange({ text: event.target.value })}
        placeholder={placeholder}
        rows={block.type === 'code' ? 5 : Math.max(1, Math.min(12, block.text.split('\n').length))}
      />
    </div>
  );
}

function InlineDatabase({ database, onChange }: { database: NotionDatabase; onChange: (database: NotionDatabase) => void }) {
  const titleProperty = database.properties[0];

  function updateCell(rowId: string, propertyId: string, value: NotionCellValue) {
    const draft = clone(database);
    const row = draft.rows.find((item) => item.id === rowId);
    if (row) {
      row.cells[propertyId] = value;
    }
    onChange(draft);
  }

  function addRow() {
    const draft = clone(database);
    draft.rows.unshift({ id: createId('row'), cells: Object.fromEntries(draft.properties.map((property) => [property.id, defaultCellValue(property.type)])) });
    onChange(draft);
  }

  return (
    <div className="notion-inline-db">
      <div className="notion-inline-db-head">
        <strong>Base de donnees</strong>
        <button type="button" onClick={addRow}><Plus size={14} /> Ligne</button>
      </div>
      <div className="notion-inline-board">
        {database.rows.map((row) => (
          <article key={row.id}>
            <input value={String(row.cells[titleProperty.id] ?? '')} onChange={(event) => updateCell(row.id, titleProperty.id, event.target.value)} />
          </article>
        ))}
      </div>
    </div>
  );
}

function NotionDatabaseEditor({
  page,
  mutate,
}: {
  page: NotionPage;
  mutate: (mutator: (draft: NotionWorkspaceState) => void, activityLabel?: string) => void;
}) {
  const database = page.database ?? createDatabase();

  function mutateDatabase(mutator: (database: NotionDatabase) => void, label?: string) {
    mutate((draft) => {
      const targetPage = draft.pages.find((item) => item.id === page.id);
      if (!targetPage) {
        return;
      }
      targetPage.database ??= createDatabase();
      mutator(targetPage.database);
      targetPage.updatedAt = Date.now();
    }, label);
  }

  function addProperty() {
    mutateDatabase((draft) => {
      const property: NotionProperty = { id: createId('prop'), name: 'Propriete', type: 'text', options: [] };
      draft.properties.push(property);
      draft.rows.forEach((row) => {
        row.cells[property.id] = '';
      });
    }, 'Propriete ajoutee');
  }

  function addRow() {
    mutateDatabase((draft) => {
      draft.rows.unshift({ id: createId('row'), cells: Object.fromEntries(draft.properties.map((property) => [property.id, defaultCellValue(property.type)])) });
    }, 'Ligne ajoutee');
  }

  function updateProperty(propertyId: string, patch: Partial<NotionProperty>) {
    mutateDatabase((draft) => {
      const property = draft.properties.find((item) => item.id === propertyId);
      if (property) {
        Object.assign(property, patch);
      }
    });
  }

  function updateCell(rowId: string, property: NotionProperty, value: string) {
    mutateDatabase((draft) => {
      const row = draft.rows.find((item) => item.id === rowId);
      if (!row) {
        return;
      }
      row.cells[property.id] = parseCellValue(property.type, value);
    });
  }

  function deleteRow(rowId: string) {
    mutateDatabase((draft) => {
      draft.rows = draft.rows.filter((row) => row.id !== rowId);
    }, 'Ligne supprimee');
  }

  return (
    <div className="notion-database">
      <div className="notion-db-toolbar">
        {(['table', 'board', 'calendar', 'list'] as NotionDatabaseView[]).map((view) => {
          const Icon = view === 'table' ? Table2 : view === 'board' ? KanbanSquare : view === 'calendar' ? CalendarDays : LayoutList;
          return (
            <button key={view} className={database.activeView === view ? 'active' : ''} type="button" onClick={() => mutateDatabase((draft) => { draft.activeView = view; })}>
              <Icon size={15} /> {databaseViewLabel(view)}
            </button>
          );
        })}
        <button type="button" onClick={addProperty}><Plus size={15} /> Propriete</button>
        <button type="button" onClick={addRow}><Plus size={15} /> Ligne</button>
      </div>

      <div className="notion-db-properties">
        {database.properties.map((property) => (
          <article key={property.id}>
            <input value={property.name} onChange={(event) => updateProperty(property.id, { name: event.target.value })} />
            <select value={property.type} onChange={(event) => updateProperty(property.id, { type: event.target.value as NotionPropertyType })}>
              {propertyTypes.map((type) => (
                <option key={type} value={type}>{propertyTypeLabel(type)}</option>
              ))}
            </select>
          </article>
        ))}
      </div>

      {database.activeView === 'table' && (
        <div className="notion-db-table">
          <table>
            <thead>
              <tr>
                {database.properties.map((property) => <th key={property.id}>{property.name}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {database.rows.map((row) => (
                <tr key={row.id}>
                  {database.properties.map((property) => (
                    <td key={property.id}>{renderCellInput(row, property, (value) => updateCell(row.id, property, value))}</td>
                  ))}
                  <td><button type="button" onClick={() => deleteRow(row.id)}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {database.activeView === 'board' && (
        <div className="notion-db-board">
          {groupRows(database).map((group) => (
            <section key={group.label}>
              <h3>{group.label}</h3>
              {group.rows.map((row) => (
                <article key={row.id}>{String(row.cells[database.properties[0].id] ?? 'Sans titre')}</article>
              ))}
            </section>
          ))}
        </div>
      )}

      {database.activeView === 'calendar' && (
        <div className="notion-db-calendar">
          {database.rows.map((row) => (
            <article key={row.id}>
              <strong>{String(row.cells[database.properties[0].id] ?? 'Evenement')}</strong>
              <span>{findDateValue(database, row) || 'Aucune date'}</span>
            </article>
          ))}
        </div>
      )}

      {database.activeView === 'list' && (
        <div className="notion-db-list">
          {database.rows.map((row) => (
            <article key={row.id}>
              <strong>{String(row.cells[database.properties[0].id] ?? 'Sans titre')}</strong>
              <span>{database.properties.slice(1).map((property) => String(row.cells[property.id] ?? '')).filter(Boolean).join(' - ')}</span>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function NotionMiniList({ title, pages, activeId, onOpen }: { title: string; pages: NotionPage[]; activeId: string | null; onOpen: (id: string) => void }) {
  return (
    <section className="notion-nav-section">
      <div className="notion-section-title">{title}</div>
      <div className="notion-page-list">
        {pages.length === 0 && <span className="notion-muted">Aucun element.</span>}
        {pages.map((page) => (
          <button key={page.id} className={activeId === page.id ? 'active' : ''} type="button" onClick={() => onOpen(page.id)}>
            <span className="notion-page-icon">{page.icon}</span>
            <span>{page.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function NotionTreeNode({
  page,
  pages,
  activeId,
  expandedIds,
  onOpen,
  onToggleExpanded,
  onCreateChild,
  depth,
}: {
  page: NotionPage;
  pages: NotionPage[];
  activeId: string | null;
  expandedIds: string[];
  onOpen: (id: string) => void;
  onToggleExpanded: (id: string) => void;
  onCreateChild: (parentId: string | null) => void;
  depth: number;
}) {
  const children = pages.filter((item) => item.parentId === page.id && item.archived === page.archived);
  const expanded = expandedIds.includes(page.id);

  return (
    <div className="notion-tree-node">
      <div className="notion-tree-row" style={{ paddingLeft: depth * 14 }}>
        <button type="button" className="notion-tree-toggle" onClick={() => onToggleExpanded(page.id)} disabled={children.length === 0}>
          {children.length > 0 ? expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : <span />}
        </button>
        <button type="button" className={activeId === page.id ? 'active' : ''} onClick={() => onOpen(page.id)}>
          <span className="notion-page-icon">{page.icon}</span>
          <span>{page.title}</span>
        </button>
        <button type="button" className="notion-tree-add" onClick={() => onCreateChild(page.id)}><Plus size={13} /></button>
      </div>
      {expanded && children.map((child) => (
        <NotionTreeNode
          key={child.id}
          page={child}
          pages={pages}
          activeId={activeId}
          expandedIds={expandedIds}
          onOpen={onOpen}
          onToggleExpanded={onToggleExpanded}
          onCreateChild={onCreateChild}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

function parseWorkspaceState(workspace: FlowceanWorkspace): NotionWorkspaceState {
  try {
    return normalizeWorkspaceState(JSON.parse(workspace.dataJson), workspace.name);
  } catch {
    return createDefaultState(workspace.name);
  }
}

function normalizeWorkspaceState(raw: unknown, fallbackName: string): NotionWorkspaceState {
  const value = isRecord(raw) ? raw : {};
  const workspaceValue = isRecord(value.workspace) ? value.workspace : {};
  const uiValue = isRecord(value.ui) ? value.ui : {};
  const rawPages = Array.isArray(value.pages) ? value.pages : [];
  const pages = rawPages.map(normalizePage).filter((page): page is NotionPage => Boolean(page));
  const normalizedPages = pages.length > 0 ? pages : createDefaultState(fallbackName).pages;
  const activePageId = typeof uiValue.activePageId === 'string' && normalizedPages.some((page) => page.id === uiValue.activePageId)
    ? uiValue.activePageId
    : normalizedPages[0].id;

  return {
    schema: 'ocean-notion-v1',
    workspace: {
      name: typeof workspaceValue.name === 'string' ? workspaceValue.name : fallbackName,
      icon: typeof workspaceValue.icon === 'string' ? workspaceValue.icon : 'OE',
      theme: workspaceValue.theme === 'focus' ? 'focus' : 'light',
    },
    ui: {
      activePageId,
      expandedPageIds: Array.isArray(uiValue.expandedPageIds)
        ? uiValue.expandedPageIds.filter((id): id is string => typeof id === 'string')
        : normalizedPages.filter((page) => !page.parentId).map((page) => page.id),
    },
    pages: normalizedPages,
    shares: Array.isArray(value.shares)
      ? value.shares.filter(isRecord).map((share): NotionShare => ({
        id: typeof share.id === 'string' ? share.id : createId('share'),
        email: typeof share.email === 'string' ? share.email : '',
        role: share.role === 'lecture' ? 'lecture' : 'edition',
      })).filter((share) => share.email)
      : [],
    activity: Array.isArray(value.activity)
      ? value.activity.filter(isRecord).map((item) => ({
        id: typeof item.id === 'string' ? item.id : createId('activity'),
        label: typeof item.label === 'string' ? item.label : 'Modification',
        at: typeof item.at === 'number' ? item.at : Date.now(),
      })).slice(0, 60)
      : [],
  };
}

function normalizePage(raw: unknown): NotionPage | null {
  if (!isRecord(raw)) {
    return null;
  }

  const kind = raw.kind === 'database' || raw.database ? 'database' : 'document';
  const legacyBlocks = Array.isArray(raw.blocks) ? raw.blocks.map(normalizeBlock).filter((block): block is NotionBlock => Boolean(block)) : [];
  return {
    id: typeof raw.id === 'string' ? raw.id : createId('page'),
    parentId: typeof raw.parentId === 'string' ? raw.parentId : null,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : 'Sans titre',
    icon: typeof raw.icon === 'string' ? raw.icon : pageIcon(kind),
    cover: typeof raw.cover === 'string' ? raw.cover : undefined,
    favorite: Boolean(raw.favorite),
    archived: Boolean(raw.archived || raw.deletedAt),
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
    blocks: kind === 'database' ? [] : legacyBlocks.length > 0 ? legacyBlocks : [createBlock('paragraph')],
    database: kind === 'database' ? normalizeDatabase(raw.database) : null,
  };
}

function normalizeBlock(raw: unknown): NotionBlock | null {
  if (!isRecord(raw)) {
    return null;
  }

  const type = mapBlockType(raw.type);
  return {
    id: typeof raw.id === 'string' ? raw.id : createId('block'),
    type,
    text: typeof raw.text === 'string' ? raw.text : '',
    checked: typeof raw.checked === 'boolean' ? raw.checked : type === 'todo' ? false : undefined,
    url: typeof raw.url === 'string' ? raw.url : undefined,
    caption: typeof raw.caption === 'string' ? raw.caption : undefined,
    color: typeof raw.color === 'string' ? raw.color : undefined,
    database: type === 'database' ? normalizeDatabase(raw.database) : undefined,
  };
}

function normalizeDatabase(raw: unknown): NotionDatabase {
  if (!isRecord(raw)) {
    return createDatabase();
  }

  const properties = Array.isArray(raw.properties)
    ? raw.properties.filter(isRecord).map((property) => ({
      id: typeof property.id === 'string' ? property.id : createId('prop'),
      name: typeof property.name === 'string' ? property.name : 'Propriete',
      type: propertyTypes.includes(property.type as NotionPropertyType) ? property.type as NotionPropertyType : 'text',
      options: Array.isArray(property.options) ? property.options.filter((item): item is string => typeof item === 'string') : [],
    }))
    : createDatabase().properties;

  const safeProperties = properties.length > 0 ? properties : createDatabase().properties;
  const rows = Array.isArray(raw.rows)
    ? raw.rows.filter(isRecord).map((row) => ({
      id: typeof row.id === 'string' ? row.id : createId('row'),
      cells: isRecord(row.cells) ? row.cells as Record<string, NotionCellValue> : {},
    }))
    : [];

  return {
    activeView: raw.activeView === 'board' || raw.activeView === 'calendar' || raw.activeView === 'list' ? raw.activeView : 'table',
    properties: safeProperties,
    rows,
  };
}

function createDefaultState(name: string): NotionWorkspaceState {
  const home = createPageModel(null, 'document', 'Accueil OceanERP');
  home.icon = 'OE';
  home.blocks = [
    createBlock('heading1', 'Espace de travail collaboratif'),
    createBlock('paragraph', "Centralisez les notes, procedures, projets et bases de connaissances de l'entreprise."),
    createBlock('callout', 'Tapez / dans un bloc vide pour transformer le bloc en titre, todo, liste, image, fichier ou base de donnees.'),
    createBlock('todo', 'Adapter les pages aux methodes de l entreprise'),
  ];

  const roadmap = createPageModel(null, 'database', 'Roadmap ERP');
  roadmap.icon = 'DB';
  roadmap.database = {
    activeView: 'table',
    properties: [
      { id: 'prop-name', name: 'Sujet', type: 'text', options: [] },
      { id: 'prop-status', name: 'Statut', type: 'status', options: ['A faire', 'En cours', 'Termine'] },
      { id: 'prop-owner', name: 'Responsable', type: 'text', options: [] },
      { id: 'prop-date', name: 'Date', type: 'date', options: [] },
    ],
    rows: [
      { id: createId('row'), cells: { 'prop-name': 'Finaliser le drive', 'prop-status': 'En cours', 'prop-owner': '', 'prop-date': '' } },
      { id: createId('row'), cells: { 'prop-name': 'Documenter les processus', 'prop-status': 'A faire', 'prop-owner': '', 'prop-date': '' } },
    ],
  };

  return {
    schema: 'ocean-notion-v1',
    workspace: { name, icon: 'OE', theme: 'light' },
    ui: { activePageId: home.id, expandedPageIds: [home.id, roadmap.id] },
    pages: [home, roadmap],
    shares: [],
    activity: [{ id: createId('activity'), label: 'Espace initialise', at: Date.now() }],
  };
}

function createPageModel(parentId: string | null, kind: 'document' | 'database', title = kind === 'database' ? 'Nouvelle base' : 'Nouvelle page'): NotionPage {
  const now = Date.now();
  return {
    id: createId('page'),
    parentId,
    title,
    icon: pageIcon(kind),
    favorite: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
    blocks: kind === 'document' ? [createBlock('paragraph')] : [],
    database: kind === 'database' ? createDatabase() : null,
  };
}

function createBlock(type: NotionBlockType, text = ''): NotionBlock {
  return {
    id: createId('block'),
    type,
    text,
    checked: type === 'todo' ? false : undefined,
    database: type === 'database' ? createDatabase() : undefined,
  };
}

function createDatabase(): NotionDatabase {
  return {
    activeView: 'table',
    properties: [
      { id: 'prop-title', name: 'Nom', type: 'text', options: [] },
      { id: 'prop-status', name: 'Statut', type: 'status', options: ['A faire', 'En cours', 'Termine'] },
      { id: 'prop-date', name: 'Date', type: 'date', options: [] },
      { id: 'prop-owner', name: 'Responsable', type: 'text', options: [] },
    ],
    rows: [
      { id: createId('row'), cells: { 'prop-title': 'Nouvelle ligne', 'prop-status': 'A faire', 'prop-date': '', 'prop-owner': '' } },
    ],
  };
}

function notionTemplates(): NotionPage[] {
  const meeting = createPageModel(null, 'document', 'Compte rendu de reunion');
  meeting.icon = 'CR';
  meeting.blocks = [
    createBlock('heading1', 'Compte rendu'),
    createBlock('paragraph', 'Date, participants et contexte.'),
    createBlock('heading2', 'Decisions'),
    createBlock('bullet', ''),
    createBlock('heading2', 'Actions'),
    createBlock('todo', ''),
  ];

  const project = createPageModel(null, 'document', 'Pilotage projet');
  project.icon = 'PR';
  project.blocks = [
    createBlock('heading1', 'Objectif'),
    createBlock('callout', 'Resultat attendu, responsable, echeance.'),
    createBlock('heading2', 'Risques'),
    createBlock('bullet', ''),
    createBlock('heading2', 'Plan d action'),
    createBlock('todo', ''),
  ];

  const procedure = createPageModel(null, 'document', 'Procedure interne');
  procedure.icon = 'PI';
  procedure.blocks = [
    createBlock('heading1', 'Procedure'),
    createBlock('paragraph', 'But, perimetre et prerequis.'),
    createBlock('numbered', 'Etape 1'),
    createBlock('numbered', 'Etape 2'),
    createBlock('callout', 'Point de controle qualite.'),
  ];

  const crm = createPageModel(null, 'database', 'Suivi commercial');
  crm.icon = 'DB';
  crm.database = {
    activeView: 'board',
    properties: [
      { id: 'prop-name', name: 'Opportunite', type: 'text', options: [] },
      { id: 'prop-status', name: 'Statut', type: 'status', options: ['A qualifier', 'Devis', 'Gagne', 'Perdu'] },
      { id: 'prop-owner', name: 'Responsable', type: 'text', options: [] },
      { id: 'prop-amount', name: 'Montant', type: 'number', options: [] },
    ],
    rows: [
      { id: createId('row'), cells: { 'prop-name': 'Nouveau prospect', 'prop-status': 'A qualifier', 'prop-owner': '', 'prop-amount': 0 } },
      { id: createId('row'), cells: { 'prop-name': 'Devis a relancer', 'prop-status': 'Devis', 'prop-owner': '', 'prop-amount': 0 } },
    ],
  };

  return [meeting, project, procedure, crm];
}

function rekeyPage(page: NotionPage): NotionPage {
  const next = clone(page);
  const oldId = next.id;
  next.id = createId('page');
  next.parentId = null;
  next.createdAt = Date.now();
  next.updatedAt = Date.now();
  next.blocks = next.blocks.map((block) => ({ ...block, id: createId('block') }));
  if (next.database) {
    next.database = {
      ...next.database,
      rows: next.database.rows.map((row) => ({ ...row, id: createId('row') })),
    };
  }
  if (next.title === oldId) {
    next.title = 'Nouvelle page';
  }
  return next;
}

function buildBreadcrumbs(pages: NotionPage[], page: NotionPage) {
  const chain: NotionPage[] = [];
  let cursor: NotionPage | undefined = page;
  while (cursor) {
    chain.unshift(cursor);
    cursor = cursor.parentId ? pages.find((item) => item.id === cursor?.parentId) : undefined;
  }
  return chain;
}

function buildSearchHits(pages: NotionPage[], query: string): SearchHit[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return pages.flatMap((page) => {
    const hits: SearchHit[] = [];
    if (page.title.toLowerCase().includes(normalized)) {
      hits.push({ page, label: page.title });
    }
    page.blocks.forEach((block) => {
      const text = block.text || block.caption || block.url || '';
      if (text.toLowerCase().includes(normalized)) {
        hits.push({ page, block, label: text.slice(0, 120) || page.title });
      }
    });
    if (page.database) {
      page.database.rows.forEach((row) => {
        const content = Object.values(row.cells).map(String).join(' ');
        if (content.toLowerCase().includes(normalized)) {
          hits.push({ page, label: content.slice(0, 120) || page.title });
        }
      });
    }
    return hits;
  }).slice(0, 30);
}

function collectPageAndChildren(pages: NotionPage[], pageId: string): string[] {
  const children = pages.filter((page) => page.parentId === pageId);
  return [pageId, ...children.flatMap((child) => collectPageAndChildren(pages, child.id))];
}

function groupRows(database: NotionDatabase) {
  const statusProperty = database.properties.find((property) => property.type === 'status' || property.type === 'select') ?? database.properties[1] ?? database.properties[0];
  const groups = new Map<string, NotionRow[]>();
  database.rows.forEach((row) => {
    const label = String(row.cells[statusProperty.id] || 'Sans statut');
    groups.set(label, [...(groups.get(label) ?? []), row]);
  });
  return Array.from(groups, ([label, rows]) => ({ label, rows }));
}

function findDateValue(database: NotionDatabase, row: NotionRow) {
  const property = database.properties.find((item) => item.type === 'date');
  return property ? String(row.cells[property.id] ?? '') : '';
}

function renderCellInput(row: NotionRow, property: NotionProperty, onChange: (value: string) => void) {
  const value = row.cells[property.id];
  if (property.type === 'checkbox') {
    return <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked ? 'true' : 'false')} />;
  }
  if (property.type === 'select' || property.type === 'status') {
    const options = property.options.length > 0 ? property.options : ['A faire', 'En cours', 'Termine'];
    return (
      <select value={String(value ?? '')} onChange={(event) => onChange(event.target.value)}>
        <option value="">-</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  }
  return <input type={inputType(property.type)} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />;
}

function parseCellValue(type: NotionPropertyType, value: string): NotionCellValue {
  if (type === 'checkbox') {
    return value === 'true';
  }
  if (type === 'number') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return value;
}

function defaultCellValue(type: NotionPropertyType): NotionCellValue {
  if (type === 'checkbox') {
    return false;
  }
  if (type === 'number') {
    return 0;
  }
  return '';
}

function mapBlockType(value: unknown): NotionBlockType {
  if (value === 'h1') {
    return 'heading1';
  }
  if (value === 'h2') {
    return 'heading2';
  }
  if (value === 'h3') {
    return 'heading3';
  }
  return blockTools.some((tool) => tool.type === value) ? value as NotionBlockType : 'paragraph';
}

function pageIcon(kind: 'document' | 'database') {
  return kind === 'database' ? 'DB' : 'PG';
}

function promptIcon(current: string) {
  return window.prompt('Icone ou initiales de la page', current)?.slice(0, 3).trim() || current;
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
}

function inputType(type: NotionPropertyType) {
  if (type === 'date') {
    return 'date';
  }
  if (type === 'number') {
    return 'number';
  }
  if (type === 'email') {
    return 'email';
  }
  if (type === 'url') {
    return 'url';
  }
  return 'text';
}

function propertyTypeLabel(type: NotionPropertyType) {
  return ({
    text: 'Texte',
    select: 'Select',
    status: 'Statut',
    date: 'Date',
    checkbox: 'Case',
    number: 'Nombre',
    email: 'Email',
    url: 'URL',
  } satisfies Record<NotionPropertyType, string>)[type];
}

function databaseViewLabel(view: NotionDatabaseView) {
  return ({ table: 'Tableau', board: 'Cartes', calendar: 'Calendrier', list: 'Liste' } satisfies Record<NotionDatabaseView, string>)[view];
}

function cacheKey(slug: string) {
  return `${CACHE_PREFIX}.${slug}`;
}

function cloneState(state: NotionWorkspaceState): NotionWorkspaceState {
  return clone(state);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
