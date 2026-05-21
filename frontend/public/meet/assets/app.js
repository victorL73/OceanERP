const API_URL = "/api/meetings";
const AUTH_URL = "/api/auth/logout";
const OCEANOS_URL = "/";
const URL_PARAMS = new URLSearchParams(window.location.search);
const ERP_ID_CACHE = {
  signal: new Map(),
  transcript: new Map(),
  chat: new Map(),
  next: { signal: 0, transcript: 0, chat: 0 },
};

const $ = (id) => document.getElementById(id);

const elements = {
  loadingView: $("loading-view"),
  appView: $("app-view"),
  currentUser: $("current-user"),
  connectionPill: $("connection-pill"),
  appMessage: $("app-message"),
  aiPill: $("ai-pill"),
  logoutButton: $("logout-button"),
  sideColumn: $("side-column"),
  guestPanel: $("guest-panel"),
  guestRoomCode: $("guest-room-code"),
  guestName: $("guest-name"),
  guestSourceLanguage: $("guest-source-language"),
  guestTargetLanguage: $("guest-target-language"),
  guestJoinButton: $("guest-join-button"),
  startPanel: $("start-panel"),
  meetingStage: $("meeting-stage"),
  roomTitle: $("room-title"),
  roomScheduledStart: $("room-scheduled-start"),
  roomCode: $("room-code"),
  sourceLanguage: $("source-language"),
  targetLanguage: $("target-language"),
  activeSourceLanguage: $("active-source-language"),
  activeTargetLanguage: $("active-target-language"),
  cameraBackgroundEffect: $("camera-background-effect"),
  cameraBackgroundFileField: $("camera-background-file-field"),
  cameraBackgroundFile: $("camera-background-file"),
  createRoomButton: $("create-room-button"),
  joinRoomButton: $("join-room-button"),
  recentRooms: $("recent-rooms"),
  activeRoomTitle: $("active-room-title"),
  activeRoomCode: $("active-room-code"),
  copyRoomButton: $("copy-room-button"),
  copyInviteButton: $("copy-invite-button"),
  toggleMicButton: $("toggle-mic-button"),
  microphoneDeviceSelect: $("microphone-device-select"),
  toggleCameraButton: $("toggle-camera-button"),
  cameraDeviceSelect: $("camera-device-select"),
  shareScreenButton: $("share-screen-button"),
  deleteRoomButton: $("delete-room-button"),
  leaveRoomButton: $("leave-room-button"),
  videoGrid: $("video-grid"),
  liveCaption: $("live-caption"),
  transcriptionToggle: $("transcription-toggle"),
  translationToggle: $("translation-toggle"),
  participantCount: $("participant-count"),
  participantList: $("participant-list"),
  chatList: $("chat-list"),
  chatForm: $("chat-form"),
  chatMessageInput: $("chat-message-input"),
  chatFileButton: $("chat-file-button"),
  chatFileInput: $("chat-file-input"),
  chatFilePreview: $("chat-file-preview"),
  chatSendButton: $("chat-send-button"),
  transcriptList: $("transcript-list"),
  clearTranscriptButton: $("clear-transcript-button"),
};

const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

let iceServers = [...DEFAULT_ICE_SERVERS];
let iceTransportPolicy = "all";

const state = {
  clientId: clientId(),
  currentUser: null,
  isGuest: false,
  inviteToken: URL_PARAMS.get("invite") || URL_PARAMS.get("token") || "",
  inviteRoomCode: (URL_PARAMS.get("room") || URL_PARAMS.get("code") || "").trim().toUpperCase(),
  initialRoomId: (URL_PARAMS.get("roomId") || "").trim(),
  inviteRoom: null,
  languages: {},
  ai: null,
  room: null,
  participants: [],
  localStream: null,
  cameraStream: null,
  screenStream: null,
  cameraBackgroundEffect: "none",
  cameraBackgroundImage: null,
  cameraBackgroundProcessor: null,
  cameraSegmentation: null,
  cameraSegmentationPromise: null,
  cameraSegmentationPending: false,
  cameraSegmentationMask: null,
  cameraSegmentationLastFrameAt: 0,
  mediaDevices: [],
  selectedMicrophoneDeviceId: readStringStorage("meetocean_microphone_device_id"),
  selectedCameraDeviceId: readStringStorage("meetocean_camera_device_id"),
  peers: new Map(),
  videoTiles: new Map(),
  transcriptMap: new Map(),
  chatMap: new Map(),
  lastSignalId: 0,
  lastTranscriptId: 0,
  lastChatId: 0,
  lastSyncAt: null,
  chatFileMaxBytes: 5 * 1024 * 1024,
  pendingChatFile: null,
  syncTimer: null,
  pendingSync: false,
  sourceLanguage: "fr-FR",
  targetLanguage: "fr-FR",
  translationEnabled: true,
  transcriptionEnabled: true,
  media: {
    microphone: false,
    camera: false,
    screen: false,
    connectionState: "online",
  },
  recognition: null,
  recognitionActive: false,
  recognitionShouldRun: false,
  speechNoticeShown: false,
  pendingTranscriptText: "",
  pendingTranscriptTimer: null,
  transcriptFingerprints: [],
  autoJoinAttempted: false,
  guestAccessTimer: null,
};

function clientId() {
  try {
    localStorage.removeItem("meetocean_client_id");
  } catch (error) {}
  try {
    const existing = sessionStorage.getItem("meetocean_session_client_id");
    if (existing) return existing;
    const generated = crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "")
      : `me_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    sessionStorage.setItem("meetocean_session_client_id", generated);
    return generated;
  } catch (error) {
    return `me_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  }
}

function readStringStorage(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch (error) {
    return "";
  }
}

function writeStringStorage(key, value) {
  try {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch (error) {}
}

function setVisible(ready) {
  elements.loadingView.classList.toggle("hidden", ready);
  elements.appView.classList.toggle("hidden", !ready);
}

function setMessage(message = "", type = "", action = null) {
  elements.appMessage.replaceChildren();
  if (message) {
    const text = document.createElement("span");
    text.textContent = message;
    elements.appMessage.appendChild(text);
  }
  if (action?.href && action?.label) {
    const link = document.createElement("a");
    link.className = "message-action";
    link.href = action.href;
    link.textContent = action.label;
    elements.appMessage.appendChild(link);
  }
  elements.appMessage.dataset.type = type;
  elements.appMessage.classList.toggle("hidden", message === "");
}

function isLoopbackHost(hostname = window.location.hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function localMeetOceanUrl() {
  const path = window.location.pathname.endsWith("/")
    ? window.location.pathname
    : `${window.location.pathname}/`;
  const url = new URL(window.location.href);
  url.protocol = "http:";
  url.hostname = "localhost";
  url.port = "";
  url.pathname = path;
  return url.toString();
}

function secureMeetOceanUrl() {
  const url = new URL(window.location.href);
  url.protocol = "https:";
  return url.toString();
}

function insecureMediaAction() {
  if (window.isSecureContext) return null;
  if (!isLoopbackHost()) {
    return {
      href: secureMeetOceanUrl(),
      label: "Reessayer en HTTPS",
    };
  }
  return {
    href: localMeetOceanUrl(),
    label: "Ouvrir avec localhost",
  };
}

function showMediaSecurityMessage() {
  setMessage(mediaAccessMessage(), "error", insecureMediaAction());
}

function hasInviteAccess() {
  return state.inviteToken !== "" && state.inviteRoomCode !== "";
}

function readJsonStorage(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function accessToken() {
  try {
    return localStorage.getItem("oceanerp.accessToken") || "";
  } catch (error) {
    return "";
  }
}

function currentErpUser() {
  return readJsonStorage("oceanerp.user", null) || {};
}

function currentDisplayName() {
  const guestName = elements.guestName?.value?.trim();
  if (guestName) return guestName;
  const user = state.currentUser || currentErpUser();
  return user.displayName || user.email || "Invite";
}

function authHeaders(includeAuth = true) {
  const headers = { "Content-Type": "application/json" };
  const token = includeAuth ? accessToken() : "";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function erpFetch(path, options = {}, includeAuth = true) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...authHeaders(includeAuth),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function normalizeIceServer(server) {
  if (!server) return null;
  const urls = Array.isArray(server.urls)
    ? server.urls.filter(Boolean)
    : typeof server.urls === "string"
      ? [server.urls]
      : [];

  if (urls.length === 0) return null;

  return {
    urls,
    ...(server.username ? { username: server.username } : {}),
    ...(server.credential ? { credential: server.credential } : {}),
  };
}

function booleanConfig(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
  return false;
}

function hasTurnServer(servers) {
  return servers.some((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.some((url) => String(url || "").toLowerCase().startsWith("turn:") || String(url || "").toLowerCase().startsWith("turns:"));
  });
}

async function loadIceConfiguration() {
  try {
    const payload = await erpFetch(`${API_URL}/ice`, { method: "GET" }, false);
    const configuredServers = (payload.iceServers || payload.ice_servers || [])
      .map(normalizeIceServer)
      .filter(Boolean);
    iceServers = configuredServers.length > 0 ? configuredServers : [...DEFAULT_ICE_SERVERS];
    const forceRelay = booleanConfig(payload.forceRelay ?? payload.force_relay);
    iceTransportPolicy = forceRelay && hasTurnServer(iceServers) ? "relay" : "all";
    if (forceRelay && iceTransportPolicy !== "relay") {
      setMessage("TURN force dans la configuration Meet, mais aucun serveur TURN n'est annonce par l'API.", "error");
    }
  } catch (error) {
    iceServers = [...DEFAULT_ICE_SERVERS];
    iceTransportPolicy = "all";
  }
}

function numericId(kind, rawId) {
  const text = String(rawId || "");
  if (!text) return 0;
  const direct = Number(text);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const cache = ERP_ID_CACHE[kind];
  if (cache.has(text)) return cache.get(text);
  ERP_ID_CACHE.next[kind] += 1;
  cache.set(text, ERP_ID_CACHE.next[kind]);
  return ERP_ID_CACHE.next[kind];
}

function normalizeLanguages(languages = []) {
  if (!Array.isArray(languages)) return { "fr-FR": "Francais", "en-US": "Anglais" };
  return languages.reduce((acc, language) => {
    acc[language.code] = language.label;
    return acc;
  }, {});
}

function publicInviteUrl(room) {
  if (!room?.inviteToken) return "";
  const url = new URL("/meet/index.html", window.location.origin);
  url.searchParams.set("room", room.code || state.inviteRoomCode || "");
  url.searchParams.set("invite", room.inviteToken);
  return url.toString();
}

function normalizeRoom(room = {}) {
  return {
    ...room,
    id: room.id,
    code: room.code,
    title: room.title || "Reunion Meet",
    scheduledStartAt: room.scheduledStartAt || room.createdAt || "",
    participantCount: room.participantCount || 0,
    canDelete: !state.isGuest && room.canDelete !== false,
    inviteUrl: room.inviteUrl || publicInviteUrl(room),
  };
}

function normalizeDashboard(payload = {}) {
  const user = currentErpUser();
  return {
    ok: true,
    isGuest: false,
    currentUser: {
      displayName: user.displayName || user.email || "Utilisateur",
      email: user.email || "",
    },
    ai: { hasApiKey: false },
    defaults: { sourceLanguage: "fr-FR" },
    languages: normalizeLanguages(payload.languages),
    chat: { fileMaxBytes: payload.chatAttachmentMaxBytes || state.chatFileMaxBytes },
    recentRooms: (payload.rooms || []).map(normalizeRoom),
  };
}

function normalizeParticipant(participant = {}) {
  return {
    ...participant,
    microphoneEnabled: Boolean(participant.microphoneEnabled),
    cameraEnabled: Boolean(participant.cameraEnabled),
    screenEnabled: Boolean(participant.screenEnabled),
    connectionState: participant.connectionState || "online",
  };
}

function normalizeSignal(signal = {}) {
  let payload = signal.payload || {};
  if (!signal.payload && signal.payloadJson) {
    try {
      payload = JSON.parse(signal.payloadJson);
    } catch (error) {
      payload = {};
    }
  }
  return {
    ...signal,
    id: numericId("signal", signal.id),
    payload,
  };
}

function normalizeTranscript(item = {}) {
  return {
    ...item,
    id: numericId("transcript", item.id),
    sourceLabel: state.languages[item.sourceLanguage] || item.sourceLanguage,
    targetLanguage: item.targetLanguage || state.targetLanguage,
  };
}

function normalizeChat(item = {}) {
  return {
    ...item,
    id: numericId("chat", item.id),
    text: item.message || item.text || "",
    messageType: item.hasFile ? "file" : "text",
    fileMime: item.fileMimeType || item.fileMime || "",
    fileSize: item.fileSize || 0,
    fileData: item.fileData || "",
    fileUrl: item.hasFile ? `/api/meetings/chat/${item.id}/attachment` : "",
  };
}

function normalizeRoomState(payload = {}) {
  return {
    ...payload,
    ok: true,
    room: payload.room ? normalizeRoom(payload.room) : null,
    participants: (payload.participants || []).map(normalizeParticipant),
    signals: (payload.signals || []).map(normalizeSignal),
    transcripts: (payload.transcripts || []).map(normalizeTranscript),
    chatMessages: (payload.chatMessages || []).map(normalizeChat),
    serverTime: payload.serverTime || new Date().toISOString(),
  };
}

function inviteDashboard() {
  const languages = { "fr-FR": "Francais", "en-US": "Anglais", "es-ES": "Espagnol" };
  return {
    ok: true,
    isGuest: true,
    currentUser: { displayName: "Invite externe", email: "" },
    ai: { hasApiKey: false },
    defaults: { sourceLanguage: "fr-FR" },
    languages,
    chat: { fileMaxBytes: state.chatFileMaxBytes },
    room: {
      id: state.inviteToken,
      code: state.inviteRoomCode,
      title: "Reunion invitee",
      canDelete: false,
      inviteUrl: window.location.href,
    },
    recentRooms: [],
  };
}

function activeRoomPath(suffix = "") {
  const roomId = state.room?.id || state.initialRoomId;
  if (state.isGuest || hasInviteAccess()) {
    return `/api/meetings/public/rooms/${encodeURIComponent(state.inviteToken)}${suffix}`;
  }
  return `/api/meetings/rooms/${encodeURIComponent(roomId)}${suffix}`;
}

function dashboardUrl() {
  if (!hasInviteAccess()) return API_URL;
  const params = new URLSearchParams({
    room: state.inviteRoomCode,
    invite: state.inviteToken,
  });
  const guestName = elements.guestName?.value?.trim() || "";
  if (guestName) params.set("name", guestName);
  return `${API_URL}?${params.toString()}`;
}

function guestPayload(data = {}) {
  if (!hasInviteAccess()) return data;
  return {
    roomCode: state.inviteRoomCode,
    inviteToken: state.inviteToken,
    guestName: elements.guestName?.value?.trim() || state.currentUser?.displayName || "",
    ...data,
  };
}

async function requestJson(url, options = {}) {
  if (url.startsWith(API_URL)) {
    if (hasInviteAccess()) return inviteDashboard();
    const payload = await erpFetch("/api/meetings/dashboard", options, true);
    return normalizeDashboard(payload);
  }
  return erpFetch(url, options, !hasInviteAccess());
}

async function postAction(action, data = {}) {
  const auth = !state.isGuest && !hasInviteAccess();
  const displayName = currentDisplayName();
  const sourceLanguage = data.sourceLanguage || state.sourceLanguage || "fr-FR";
  const targetLanguage = data.targetLanguage || effectiveTargetLanguage();
  const media = data.mediaState || mediaState();

  if (action === "create_room") {
    const payload = await erpFetch("/api/meetings/rooms", {
      method: "POST",
      body: JSON.stringify({
        title: data.title || "Reunion Meet",
        scheduledStartAt: data.scheduledStartAt || null,
        clientId: data.clientId || state.clientId,
        displayName,
        sourceLanguage,
        targetLanguage,
        media,
      }),
    }, true);
    return normalizeRoomState(payload);
  }

  if (action === "join_room") {
    const publicJoin = hasInviteAccess();
    const payload = await erpFetch(publicJoin ? "/api/meetings/public/rooms/join" : "/api/meetings/rooms/join", {
      method: "POST",
      body: JSON.stringify({
        codeOrToken: publicJoin ? state.inviteToken : data.roomCode,
        clientId: data.clientId || state.clientId,
        displayName,
        sourceLanguage,
        targetLanguage,
        media,
      }),
    }, !publicJoin);
    return normalizeRoomState({ ...payload, isGuest: publicJoin });
  }

  if (action === "sync") {
    const payload = await erpFetch(activeRoomPath("/sync"), {
      method: "POST",
      body: JSON.stringify({
        clientId: data.clientId || state.clientId,
        displayName,
        sourceLanguage,
        targetLanguage,
        media,
        since: state.lastSyncAt,
      }),
    }, auth);
    return normalizeRoomState(payload);
  }

  if (action === "signal") {
    const payload = await erpFetch(activeRoomPath("/signals"), {
      method: "POST",
      body: JSON.stringify({
        senderClientId: data.senderClientId || state.clientId,
        recipientClientId: data.recipientClientId,
        signalType: data.signalType,
        payloadJson: JSON.stringify(data.payload || {}),
      }),
    }, auth);
    return normalizeRoomState(payload);
  }

  if (action === "ensure_invite") {
    const payload = await erpFetch(`/api/meetings/rooms/${encodeURIComponent(data.roomId || state.room.id)}/invite`, { method: "POST" }, true);
    const inviteToken = payload.token || payload.inviteToken || "";
    const room = { ...state.room, inviteToken };
    return { ok: true, token: inviteToken, inviteUrl: publicInviteUrl(room), room: normalizeRoom(room) };
  }

  if (action === "delete_room") {
    await erpFetch(`/api/meetings/rooms/${encodeURIComponent(data.roomId || data.id)}`, { method: "DELETE" }, true);
    const dashboard = await erpFetch("/api/meetings/dashboard", {}, true);
    return normalizeDashboard(dashboard);
  }

  if (action === "leave_room") {
    await erpFetch(activeRoomPath("/leave"), {
      method: "POST",
      body: JSON.stringify({ clientId: data.clientId || state.clientId }),
    }, auth);
    return { ok: true };
  }

  if (action === "add_transcript") {
    await erpFetch(activeRoomPath("/transcripts"), {
      method: "POST",
      body: JSON.stringify({
        clientId: data.clientId || state.clientId,
        speakerName: data.speakerName || displayName,
        text: data.text || "",
        sourceLanguage,
        translatedText: data.translatedText || null,
        isFinal: data.isFinal !== false,
      }),
    }, auth);
    return postAction("sync", data);
  }

  if (action === "add_chat_message") {
    await erpFetch(activeRoomPath("/chat"), {
      method: "POST",
      body: JSON.stringify({
        clientId: data.clientId || state.clientId,
        senderName: data.senderName || displayName,
        message: data.text || data.message || "",
        fileName: data.file?.name || null,
        fileMimeType: data.file?.mime || null,
        fileBase64: data.file?.data || null,
      }),
    }, auth);
    return postAction("sync", data);
  }

  return { ok: true };
}

const USER_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris";

function parseOceanDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
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

function formatDate(value) {
  if (!value) return "";
  const date = parseOceanDateTime(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: USER_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMeetingDate(value) {
  if (!value) return "";
  const date = parseOceanDateTime(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: USER_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function currentGuestAccess(payload = null) {
  return payload?.guestAccess || payload?.room?.guestAccess || state.room?.guestAccess || state.inviteRoom?.guestAccess || null;
}

function guestAccessBlocked(payload = null) {
  const access = currentGuestAccess(payload);
  return Boolean(access?.restricted) && !access.available;
}

function guestAccessBlockedMessage(payload = null) {
  if (!guestAccessBlocked(payload)) return "";
  const access = currentGuestAccess(payload) || {};
  const openLabel = formatMeetingDate(access.opensAt) || access.opensAtLabel || "";
  return openLabel
    ? `Cette reunion sera accessible aux invites a partir du ${openLabel}.`
    : access.message || "Cette reunion n est pas encore accessible aux invites.";
}

function scheduleGuestAccessRefresh(payload = null) {
  window.clearTimeout(state.guestAccessTimer);
  state.guestAccessTimer = null;

  const access = currentGuestAccess(payload);
  if (!access?.restricted || access.available) return;

  const waitSeconds = Number(access.availableInSeconds);
  const nextRefreshSeconds = Number.isFinite(waitSeconds)
    ? Math.max(5, Math.min(waitSeconds + 1, 60))
    : 30;

  state.guestAccessTimer = window.setTimeout(() => {
    state.guestAccessTimer = null;
    void loadDashboard(true);
  }, nextRefreshSeconds * 1000);
}

function localDatetimeValue(minutesFromNow = 0) {
  const date = new Date(Date.now() + minutesFromNow * 60000);
  date.setSeconds(0, 0);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function localInputToUtcSql(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (!text) return "";
  const normalized = text.length === 16 ? `${text}:00` : text;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return text;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function syncScheduledStartInput() {
  if (!elements.roomScheduledStart) return;
  elements.roomScheduledStart.min = localDatetimeValue(0);
}

const CAMERA_BACKGROUND_EFFECTS = new Set(["none", "blur", "ocean", "studio", "workshop", "custom"]);

function loadCameraBackgroundPreference() {
  try {
    const saved = localStorage.getItem("meetocean_camera_background") || "none";
    state.cameraBackgroundEffect = CAMERA_BACKGROUND_EFFECTS.has(saved) && saved !== "custom" ? saved : "none";
  } catch (error) {
    state.cameraBackgroundEffect = "none";
  }
}

function saveCameraBackgroundPreference() {
  try {
    if (state.cameraBackgroundEffect === "custom") return;
    localStorage.setItem("meetocean_camera_background", state.cameraBackgroundEffect);
  } catch (error) {}
}

function syncCameraBackgroundControls() {
  if (!elements.cameraBackgroundEffect) return;
  elements.cameraBackgroundEffect.value = state.cameraBackgroundEffect;
  elements.cameraBackgroundFileField?.classList.toggle("hidden", state.cameraBackgroundEffect !== "custom");
}

function cameraBackgroundUsesProcessor() {
  return state.cameraBackgroundEffect !== "none";
}

function mediaPipeSelfieAsset(file) {
  return `assets/vendor/mediapipe-selfie-segmentation/${file}`;
}

async function ensureCameraSegmentation() {
  if (state.cameraSegmentation) return state.cameraSegmentation;
  if (state.cameraSegmentationPromise) return state.cameraSegmentationPromise;
  if (typeof window.SelfieSegmentation !== "function") {
    throw new Error("Detourage camera indisponible dans ce navigateur.");
  }

  state.cameraSegmentationPromise = (async () => {
    const segmentation = new window.SelfieSegmentation({
      locateFile: (file) => mediaPipeSelfieAsset(file),
    });
    segmentation.setOptions({
      modelSelection: 1,
      selfieMode: false,
    });
    segmentation.onResults((results) => {
      state.cameraSegmentationMask = results.segmentationMask || null;
      state.cameraSegmentationPending = false;
    });
    await segmentation.initialize();
    state.cameraSegmentation = segmentation;
    return segmentation;
  })();

  try {
    return await state.cameraSegmentationPromise;
  } catch (error) {
    state.cameraSegmentationPromise = null;
    state.cameraSegmentation = null;
    throw error;
  }
}

function drawCoverSource(ctx, source, width, height) {
  const sourceWidth = source.videoWidth || source.naturalWidth || source.width || width;
  const sourceHeight = source.videoHeight || source.naturalHeight || source.height || height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.drawImage(source, x, y, drawWidth, drawHeight);
}

function drawStudioBackground(ctx, width, height) {
  const wall = ctx.createLinearGradient(0, 0, width, height);
  wall.addColorStop(0, "#e8edf0");
  wall.addColorStop(0.48, "#cad6dc");
  wall.addColorStop(1, "#9aa9b3");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255,255,255,0.34)";
  for (let index = 0; index < 5; index += 1) {
    const x = width * (0.12 + index * 0.18);
    ctx.fillRect(x, height * 0.12, 2, height * 0.76);
  }
  ctx.fillStyle = "rgba(28,45,55,0.18)";
  ctx.fillRect(0, height * 0.74, width, height * 0.26);
}

function drawOceanBackground(ctx, width, height) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#d7f0ff");
  sky.addColorStop(0.48, "#84c7df");
  sky.addColorStop(0.49, "#1d7f9c");
  sky.addColorStop(1, "#0c506c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.beginPath();
  ctx.arc(width * 0.78, height * 0.18, Math.min(width, height) * 0.07, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.26)";
  ctx.lineWidth = Math.max(2, width * 0.003);
  for (let index = 0; index < 8; index += 1) {
    const y = height * (0.56 + index * 0.045);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(width * 0.25, y - 16, width * 0.48, y + 18, width, y - 6);
    ctx.stroke();
  }
}

function drawWorkshopBackground(ctx, width, height) {
  const wall = ctx.createLinearGradient(0, 0, width, height);
  wall.addColorStop(0, "#d8e2df");
  wall.addColorStop(1, "#738784");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(23,33,31,0.16)";
  ctx.fillRect(width * 0.08, height * 0.16, width * 0.84, height * 0.08);
  ctx.fillRect(width * 0.1, height * 0.32, width * 0.78, height * 0.06);
  ctx.fillStyle = "rgba(22,143,131,0.28)";
  ctx.fillRect(width * 0.12, height * 0.49, width * 0.76, height * 0.05);
  ctx.fillStyle = "rgba(23,33,31,0.26)";
  ctx.fillRect(0, height * 0.76, width, height * 0.24);
}

function drawSelectedVirtualBackground(processor, width, height) {
  const { ctx, sourceVideo } = processor;
  const effect = state.cameraBackgroundEffect;

  if (effect === "blur") {
    ctx.save();
    ctx.filter = "blur(22px) saturate(1.08)";
    drawCoverSource(ctx, sourceVideo, width, height);
    ctx.restore();
    return;
  }

  if (effect === "custom" && state.cameraBackgroundImage) {
    drawCoverSource(ctx, state.cameraBackgroundImage, width, height);
    return;
  }

  if (effect === "ocean") {
    drawOceanBackground(ctx, width, height);
    return;
  }

  if (effect === "workshop") {
    drawWorkshopBackground(ctx, width, height);
    return;
  }

  drawStudioBackground(ctx, width, height);
}

function drawSegmentedPersonForeground(processor, width, height) {
  const { ctx, sourceVideo, foregroundCanvas, maskCanvas } = processor;
  const segmentationMask = state.cameraSegmentationMask;
  if (!segmentationMask) {
    drawCoverSource(ctx, sourceVideo, width, height);
    return;
  }

  foregroundCanvas.width = width;
  foregroundCanvas.height = height;
  maskCanvas.width = width;
  maskCanvas.height = height;

  const fg = foregroundCanvas.getContext("2d");
  fg.clearRect(0, 0, width, height);
  drawCoverSource(fg, sourceVideo, width, height);

  const mask = maskCanvas.getContext("2d");
  mask.clearRect(0, 0, width, height);
  mask.filter = `blur(${Math.max(3, Math.round(width * 0.006))}px)`;
  drawCoverSource(mask, segmentationMask, width, height);
  mask.filter = "none";

  fg.globalCompositeOperation = "destination-in";
  fg.drawImage(maskCanvas, 0, 0);
  fg.globalCompositeOperation = "source-over";

  ctx.drawImage(foregroundCanvas, 0, 0);
}

function stopCameraBackgroundProcessor() {
  const processor = state.cameraBackgroundProcessor;
  if (!processor) return;

  window.cancelAnimationFrame(processor.animationFrame);
  processor.outputTrack?.stop();
  processor.sourceVideo.pause();
  processor.sourceVideo.srcObject = null;
  state.cameraBackgroundProcessor = null;
  state.cameraSegmentationPending = false;
  state.cameraSegmentationMask = null;
}

async function startCameraBackgroundProcessor(sourceTrack) {
  if (!sourceTrack || sourceTrack.readyState !== "live") return null;
  if (!HTMLCanvasElement.prototype.captureStream) {
    throw new Error("Effets camera indisponibles dans ce navigateur.");
  }

  const sourceStream = new MediaStream([sourceTrack]);
  const sourceVideo = document.createElement("video");
  sourceVideo.muted = true;
  sourceVideo.playsInline = true;
  sourceVideo.srcObject = sourceStream;
  await sourceVideo.play();
  const segmentation = await ensureCameraSegmentation();

  const settings = sourceTrack.getSettings ? sourceTrack.getSettings() : {};
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const foregroundCanvas = document.createElement("canvas");
  const maskCanvas = document.createElement("canvas");
  const frameRate = Math.min(30, Number(settings.frameRate || 24) || 24);
  const outputStream = canvas.captureStream(frameRate);
  const outputTrack = outputStream.getVideoTracks()[0] || null;
  if (!ctx || !outputTrack) {
    throw new Error("Effets camera indisponibles dans ce navigateur.");
  }

  outputTrack.enabled = sourceTrack.enabled;
  const processor = {
    sourceTrack,
    sourceVideo,
    canvas,
    ctx,
    foregroundCanvas,
    maskCanvas,
    outputStream,
    outputTrack,
    animationFrame: 0,
  };

  const draw = () => {
    if (state.cameraBackgroundProcessor !== processor || sourceTrack.readyState !== "live") {
      return;
    }

    if (sourceVideo.readyState < 2) {
      processor.animationFrame = window.requestAnimationFrame(draw);
      return;
    }

    const width = sourceVideo.videoWidth || Number(settings.width || 1280);
    const height = sourceVideo.videoHeight || Number(settings.height || 720);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);
    const now = performance.now();
    if (!state.cameraSegmentationPending && now - state.cameraSegmentationLastFrameAt > 90) {
      state.cameraSegmentationPending = true;
      state.cameraSegmentationLastFrameAt = now;
      void segmentation.send({ image: sourceVideo }).catch(() => {
        state.cameraSegmentationPending = false;
      });
    }

    drawSelectedVirtualBackground(processor, width, height);
    drawSegmentedPersonForeground(processor, width, height);
    outputTrack.enabled = sourceTrack.enabled;
    processor.animationFrame = window.requestAnimationFrame(draw);
  };

  state.cameraBackgroundProcessor = processor;
  draw();
  return outputTrack;
}

function activeCameraSourceTrack() {
  return state.cameraStream?.getVideoTracks().find((track) => track.readyState === "live") || null;
}

async function applyCameraBackgroundEffect(options = {}) {
  const { sync = true, quiet = false } = options;
  if (!state.localStream || state.media.screen) return;

  const sourceTrack = activeCameraSourceTrack();
  stopCameraBackgroundProcessor();

  if (!sourceTrack || !sourceTrack.enabled) {
    replaceLocalVideoTrack(null);
    refreshMediaStateFromTracks();
    updateControlButtons();
    if (sync) void syncNow();
    return;
  }

  let nextTrack = sourceTrack;
  if (cameraBackgroundUsesProcessor()) {
    try {
      nextTrack = await startCameraBackgroundProcessor(sourceTrack);
    } catch (error) {
      state.cameraBackgroundEffect = "none";
      syncCameraBackgroundControls();
      saveCameraBackgroundPreference();
      nextTrack = sourceTrack;
      if (!quiet) {
        setMessage(error.message || "Effet camera indisponible, camera normale active.", "info");
      }
    }
  }

  replaceLocalVideoTrack(nextTrack);
  refreshMediaStateFromTracks();
  updateControlButtons();
  renderVideos();
  if (sync) void syncNow();
}

async function changeCameraBackgroundEffect() {
  const selected = elements.cameraBackgroundEffect?.value || "none";
  if (selected === "custom" && !state.cameraBackgroundImage) {
    elements.cameraBackgroundEffect.value = state.cameraBackgroundEffect;
    elements.cameraBackgroundFileField?.classList.remove("hidden");
    setMessage("Choisissez une image de fond pour l'activer.", "info");
    elements.cameraBackgroundFile?.click();
    return;
  }

  state.cameraBackgroundEffect = CAMERA_BACKGROUND_EFFECTS.has(selected) ? selected : "none";
  syncCameraBackgroundControls();
  saveCameraBackgroundPreference();
  await applyCameraBackgroundEffect();
}

async function loadCustomCameraBackground() {
  const file = elements.cameraBackgroundFile?.files?.[0] || null;
  if (!file) return;

  const image = new Image();
  const url = URL.createObjectURL(file);
  try {
    image.src = url;
    await image.decode();
    state.cameraBackgroundImage = image;
    state.cameraBackgroundEffect = "custom";
    syncCameraBackgroundControls();
    await applyCameraBackgroundEffect();
    setMessage("Fond camera personnalise active.", "success");
  } catch (error) {
    setMessage("Image de fond illisible.", "error");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function initials(name) {
  return String(name || "ME")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "ME";
}

function effectiveTargetLanguage() {
  return state.sourceLanguage;
}

function setSpokenLanguage(language) {
  const selected = language || state.sourceLanguage || "fr-FR";
  state.sourceLanguage = selected;
  state.targetLanguage = selected;
}

function mediaState(extra = {}) {
  return {
    microphone: state.media.microphone,
    camera: state.media.camera,
    screen: state.media.screen,
    connectionState: state.media.connectionState,
    ...extra,
  };
}

function populateLanguageSelect(select, selected) {
  select.innerHTML = "";
  Object.entries(state.languages).forEach(([code, label]) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = label;
    option.selected = code === selected;
    select.appendChild(option);
  });
}

function syncLanguageControls() {
  state.targetLanguage = state.sourceLanguage;
  populateLanguageSelect(elements.sourceLanguage, state.sourceLanguage);
  populateLanguageSelect(elements.targetLanguage, state.targetLanguage);
  populateLanguageSelect(elements.activeSourceLanguage, state.sourceLanguage);
  populateLanguageSelect(elements.activeTargetLanguage, state.targetLanguage);
  populateLanguageSelect(elements.guestSourceLanguage, state.sourceLanguage);
  populateLanguageSelect(elements.guestTargetLanguage, state.targetLanguage);
  elements.activeTargetLanguage.disabled = !state.translationEnabled;
}

function renderIdentity(payload) {
  const user = payload.currentUser || {};
  state.currentUser = user;
  state.ai = payload.ai || {};
  elements.currentUser.textContent = user.displayName || user.email || "Utilisateur";
  if (state.isGuest && user.displayName && user.displayName !== "Invite" && !elements.guestName.value) {
    elements.guestName.value = user.displayName;
  }
  elements.logoutButton.classList.toggle("hidden", state.isGuest);
  elements.aiPill.textContent = state.ai.hasApiKey ? "Traduction IA active" : "IA a configurer";
  elements.connectionPill.textContent = state.room ? "En reunion" : "Hors reunion";
}

function renderRecentRooms(rooms = []) {
  elements.recentRooms.innerHTML = "";
  if (!Array.isArray(rooms) || rooms.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state inline";
    empty.textContent = "Aucune reunion recente";
    elements.recentRooms.appendChild(empty);
    return;
  }

  rooms.forEach((room) => {
    const row = document.createElement("article");
    row.className = "room-row";
    row.dataset.code = room.code || "";

    const body = document.createElement("button");
    body.type = "button";
    body.className = "room-row-main";
    const title = document.createElement("strong");
    title.textContent = room.title || "Reunion Meet";
    const meta = document.createElement("span");
    const scheduled = formatMeetingDate(room.scheduledStartAt);
    const participantText = `${room.participantCount || 0} participant${Number(room.participantCount || 0) > 1 ? "s" : ""}`;
    meta.textContent = scheduled
      ? `${room.code || ""} - ${scheduled} - ${participantText}`
      : `${room.code || ""} - ${participantText}`;

    body.append(title, meta);
    body.addEventListener("click", () => {
      elements.roomCode.value = room.code || "";
      void joinRoom();
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "room-row-delete";
    deleteButton.textContent = "Supprimer";
    deleteButton.hidden = !room.canDelete;
    deleteButton.addEventListener("click", () => void deleteRoom(room));

    row.append(body, deleteButton);
    elements.recentRooms.appendChild(row);
  });
}

function renderDashboard(payload) {
  state.isGuest = Boolean(payload.isGuest);
  state.languages = payload.languages || { "fr-FR": "Francais", "en-US": "Anglais" };
  state.chatFileMaxBytes = Number(payload.chat?.fileMaxBytes || state.chatFileMaxBytes);
  setSpokenLanguage(payload.defaults?.sourceLanguage || "fr-FR");
  state.inviteRoom = payload.room || state.inviteRoom;
  if (state.inviteRoom?.code) {
    state.inviteRoomCode = state.inviteRoom.code;
    elements.guestRoomCode.textContent = state.inviteRoom.code;
  }
  renderIdentity(payload);
  syncLanguageControls();
  if (!state.isGuest && state.initialRoomId && !state.autoJoinAttempted && !state.room) {
    const matchingRoom = (payload.recentRooms || []).find((room) => room.id === state.initialRoomId);
    if (matchingRoom?.code) {
      state.autoJoinAttempted = true;
      state.initialRoomId = "";
      elements.roomCode.value = matchingRoom.code;
      void joinRoom();
    }
  }
  if (!state.isGuest && state.inviteRoomCode && !state.room) {
    elements.roomCode.value = state.inviteRoomCode;
  }
  elements.guestPanel.classList.toggle("hidden", !state.isGuest || Boolean(state.room));
  elements.startPanel.classList.toggle("hidden", state.isGuest || Boolean(state.room));
  elements.sideColumn?.classList.toggle("hidden", state.isGuest && !state.room);
  const guestWaiting = state.isGuest && !state.room && guestAccessBlocked(payload);
  elements.guestJoinButton.disabled = guestWaiting;
  elements.guestJoinButton.title = guestWaiting ? guestAccessBlockedMessage(payload) : "";
  scheduleGuestAccessRefresh(payload);
  renderRecentRooms(state.isGuest ? [] : payload.recentRooms || []);
}

function setRoomActive(active) {
  elements.startPanel.classList.toggle("hidden", active || state.isGuest);
  elements.guestPanel.classList.toggle("hidden", active || !state.isGuest);
  elements.meetingStage.classList.toggle("hidden", !active);
  elements.sideColumn?.classList.toggle("hidden", state.isGuest && !active);
  elements.connectionPill.textContent = active ? "En reunion" : "Hors reunion";
  elements.chatMessageInput.disabled = !active;
  elements.chatFileButton.disabled = !active;
  elements.chatSendButton.disabled = !active;
}

function updateRoomHeader() {
  if (!state.room) return;
  elements.activeRoomTitle.textContent = state.room.title || "Reunion Meet";
  elements.activeRoomCode.textContent = state.room.code || "---";
  elements.copyInviteButton.classList.toggle("hidden", !state.room.inviteUrl);
  elements.deleteRoomButton.classList.toggle("hidden", state.isGuest || !state.room.canDelete);
}

function participantByClient(clientIdValue) {
  return state.participants.find((participant) => participant.clientId === clientIdValue) || null;
}

function displayNameFor(clientIdValue) {
  if (clientIdValue === state.clientId) {
    return `${state.currentUser?.displayName || "Vous"} (vous)`;
  }
  return participantByClient(clientIdValue)?.displayName || "Invite";
}

function renderParticipants() {
  const participants = state.participants || [];
  elements.participantCount.textContent = String(participants.length);
  elements.participantList.innerHTML = "";

  if (participants.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state inline";
    empty.textContent = "Aucun participant";
    elements.participantList.appendChild(empty);
    return;
  }

  participants.forEach((participant) => {
    const row = document.createElement("article");
    row.className = "participant-item";

    const avatar = document.createElement("span");
    avatar.className = "avatar";
    avatar.textContent = initials(participant.displayName);

    const body = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = participant.clientId === state.clientId
      ? `${participant.displayName || "Vous"} (vous)`
      : participant.displayName || "Invite";
    const meta = document.createElement("span");
    const language = state.languages[participant.sourceLanguage] || participant.sourceLanguage || "";
    const media = [
      participant.microphoneEnabled ? "micro" : "muet",
      participant.cameraEnabled || participant.screenEnabled ? "video" : "sans video",
    ].join(" - ");
    meta.textContent = `${language} - ${media}`;
    body.append(name, meta);
    row.append(avatar, body);
    elements.participantList.appendChild(row);
  });
}

function playVideoElement(video) {
  if (!video || !video.srcObject) return;
  const result = video.play?.();
  if (result && typeof result.catch === "function") {
    result.catch(() => {});
  }
}

function ensureVideoTile(clientIdValue, label, stream, local = false) {
  let entry = state.videoTiles.get(clientIdValue);
  if (!entry) {
    const tile = document.createElement("article");
    tile.className = "video-tile";
    tile.dataset.clientId = clientIdValue;

    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.muted = local;
    video.addEventListener("loadedmetadata", () => playVideoElement(video));
    video.addEventListener("canplay", () => playVideoElement(video));

    const placeholder = document.createElement("div");
    placeholder.className = "video-placeholder";
    const avatar = document.createElement("span");
    avatar.textContent = initials(label);
    placeholder.appendChild(avatar);

    const meta = document.createElement("div");
    meta.className = "tile-meta";
    const name = document.createElement("strong");
    const status = document.createElement("span");
    meta.append(name, status);

    tile.append(video, placeholder, meta);
    tile.addEventListener("click", () => playVideoElement(video));
    elements.videoGrid.appendChild(tile);
    entry = { tile, video, placeholder, name, status };
    state.videoTiles.set(clientIdValue, entry);
  }

  if (entry.video.srcObject !== stream) {
    entry.video.srcObject = stream || null;
    playVideoElement(entry.video);
  }
  entry.name.textContent = label;
  entry.placeholder.querySelector("span").textContent = initials(label);

  const participant = clientIdValue === state.clientId
    ? {
        microphoneEnabled: state.media.microphone,
        cameraEnabled: state.media.camera,
        screenEnabled: state.media.screen,
      }
    : participantByClient(clientIdValue);
  const hasVideo = Boolean(stream && stream.getVideoTracks().some((track) => track.readyState === "live" && track.enabled));
  const mediaLabel = participant?.screenEnabled ? "partage ecran" : hasVideo ? "camera" : "sans video";
  entry.status.textContent = participant?.microphoneEnabled ? mediaLabel : `${mediaLabel} - muet`;
  entry.tile.classList.toggle("is-local", local);
  entry.tile.classList.toggle("is-video-off", !hasVideo);
  if (hasVideo) {
    playVideoElement(entry.video);
  }

  return entry;
}

function renderVideos() {
  if (!state.room) {
    state.videoTiles.forEach((entry) => entry.tile.remove());
    state.videoTiles.clear();
    return;
  }

  const activeIds = new Set([state.clientId]);
  const localLabel = state.currentUser?.displayName || "Vous";
  ensureVideoTile(state.clientId, `${localLabel} (vous)`, state.localStream, true);

  state.participants
    .filter((participant) => participant.clientId !== state.clientId)
    .forEach((participant) => {
      activeIds.add(participant.clientId);
      const peer = state.peers.get(participant.clientId);
      ensureVideoTile(participant.clientId, participant.displayName || "Invite", peer?.remoteStream || null, false);
    });

  Array.from(state.videoTiles.entries()).forEach(([clientIdValue, entry]) => {
    if (!activeIds.has(clientIdValue)) {
      entry.tile.remove();
      state.videoTiles.delete(clientIdValue);
    }
  });
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} o`;
  if (value < 1024 * 1024) return `${Math.round(value / 102.4) / 10} Ko`;
  return `${Math.round(value / 1024 / 102.4) / 10} Mo`;
}

function chatFileDataUrl(item) {
  if (item.fileUrl) return item.fileUrl;
  if (!item.fileData) return "";
  const mime = item.fileMime || "application/octet-stream";
  return `data:${mime};base64,${item.fileData}`;
}

async function downloadChatFile(item) {
  if (!item.fileUrl) return;
  const includeAuth = !state.isGuest && !hasInviteAccess();
  const url = hasInviteAccess()
    ? `${item.fileUrl.replace("/api/meetings/chat/", "/api/meetings/public/chat/")}?token=${encodeURIComponent(state.inviteToken)}`
    : item.fileUrl;
  const response = await fetch(url, {
    headers: includeAuth ? { Authorization: `Bearer ${accessToken()}` } : {},
  });
  if (!response.ok) throw new Error("Telechargement impossible.");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = item.fileName || "piece-jointe";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function renderChatMessages() {
  const items = Array.from(state.chatMap.values()).sort((a, b) => a.id - b.id);
  elements.chatList.innerHTML = "";

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state inline";
    empty.textContent = "Aucun message";
    elements.chatList.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const article = document.createElement("article");
    article.className = `chat-item ${item.clientId === state.clientId ? "is-own" : ""}`.trim();

    const head = document.createElement("div");
    const sender = document.createElement("strong");
    sender.textContent = item.clientId === state.clientId ? "Vous" : item.senderName || "Participant";
    const time = document.createElement("span");
    time.textContent = formatDate(item.createdAt);
    head.append(sender, time);
    article.appendChild(head);

    if (item.text) {
      const text = document.createElement("p");
      text.textContent = item.text;
      article.appendChild(text);
    }

    if (item.messageType === "file" && item.fileName) {
      const fileLink = document.createElement("a");
      fileLink.className = "chat-file-link";
      fileLink.href = chatFileDataUrl(item);
      fileLink.download = item.fileName;
      fileLink.textContent = `${item.fileName} (${formatBytes(item.fileSize)})`;
      fileLink.addEventListener("click", (event) => {
        if (!item.fileUrl) return;
        event.preventDefault();
        void downloadChatFile(item).catch((error) => setMessage(error.message || "Telechargement impossible.", "error"));
      });
      article.appendChild(fileLink);
    }

    elements.chatList.appendChild(article);
  });
  elements.chatList.scrollTop = elements.chatList.scrollHeight;
}

function updateChatFilePreview() {
  if (!elements.chatFilePreview) return;
  elements.chatFilePreview.replaceChildren();

  if (!state.pendingChatFile) {
    elements.chatFilePreview.classList.add("hidden");
    return;
  }

  const label = document.createElement("span");
  label.textContent = `${state.pendingChatFile.name} - ${formatBytes(state.pendingChatFile.size)}`;
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "Retirer";
  remove.addEventListener("click", () => {
    state.pendingChatFile = null;
    if (elements.chatFileInput) {
      elements.chatFileInput.value = "";
    }
    updateChatFilePreview();
  });
  elements.chatFilePreview.append(label, remove);
  elements.chatFilePreview.classList.remove("hidden");
}

function selectChatFile() {
  const file = elements.chatFileInput?.files?.[0] || null;
  if (!file) {
    state.pendingChatFile = null;
    updateChatFilePreview();
    return;
  }

  if (file.size > state.chatFileMaxBytes) {
    state.pendingChatFile = null;
    elements.chatFileInput.value = "";
    updateChatFilePreview();
    setMessage(`Fichier trop volumineux. Maximum ${formatBytes(state.chatFileMaxBytes)}.`, "error");
    return;
  }

  state.pendingChatFile = file;
  updateChatFilePreview();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

async function sendChatMessage(event = null) {
  event?.preventDefault();
  if (!state.room) return;

  const text = elements.chatMessageInput.value.trim();
  const file = state.pendingChatFile;
  if (!text && !file) {
    elements.chatMessageInput.focus();
    return;
  }
  if (file && file.size > state.chatFileMaxBytes) {
    setMessage(`Fichier trop volumineux. Maximum ${formatBytes(state.chatFileMaxBytes)}.`, "error");
    return;
  }

  elements.chatSendButton.disabled = true;
  elements.chatFileButton.disabled = true;
  try {
    const payload = {
      roomId: state.room.id,
      clientId: state.clientId,
      text,
      sourceLanguage: state.sourceLanguage,
      targetLanguage: effectiveTargetLanguage(),
      mediaState: mediaState(),
      sinceSignalId: state.lastSignalId,
      sinceTranscriptId: state.lastTranscriptId,
      sinceChatId: state.lastChatId,
    };

    if (file) {
      payload.file = {
        name: file.name,
        mime: file.type || "application/octet-stream",
        size: file.size,
        data: await fileToBase64(file),
      };
    }

    const response = await postAction("add_chat_message", payload);
    elements.chatMessageInput.value = "";
    state.pendingChatFile = null;
    if (elements.chatFileInput) {
      elements.chatFileInput.value = "";
    }
    updateChatFilePreview();
    await applySyncPayload(response);
  } catch (error) {
    setMessage(error.message || "Message non envoye.", "error");
  } finally {
    elements.chatSendButton.disabled = false;
    elements.chatFileButton.disabled = false;
  }
}

function renderTranscripts() {
  const items = Array.from(state.transcriptMap.values()).sort((a, b) => a.id - b.id);
  elements.transcriptList.innerHTML = "";

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state inline";
    empty.textContent = "Aucune parole transcrite";
    elements.transcriptList.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const article = document.createElement("article");
    article.className = "transcript-item";

    const head = document.createElement("div");
    const speaker = document.createElement("strong");
    speaker.textContent = item.clientId === state.clientId ? "Vous" : item.speakerName || "Participant";
    const time = document.createElement("span");
    time.textContent = `${formatDate(item.createdAt)} - ${item.sourceLabel || item.sourceLanguage}`;
    head.append(speaker, time);

    const original = document.createElement("p");
    original.textContent = item.text || "";
    article.append(head, original);

    const shouldTranslate = state.translationEnabled && item.targetLanguage !== item.sourceLanguage;
    if (shouldTranslate && item.translatedText) {
      const translated = document.createElement("p");
      translated.className = "translated-text";
      translated.textContent = item.translatedText;
      article.appendChild(translated);
    } else if (shouldTranslate) {
      const note = document.createElement("small");
      note.textContent = item.translationStatus === "unavailable" ? "Traduction indisponible" : "Traduction en attente";
      article.appendChild(note);
    }

    elements.transcriptList.appendChild(article);
  });
  elements.transcriptList.scrollTop = elements.transcriptList.scrollHeight;
}

function updateControlButtons() {
  elements.toggleMicButton.classList.toggle("is-off", !state.media.microphone);
  elements.toggleMicButton.textContent = state.media.microphone ? "Micro" : "Muet";
  elements.toggleCameraButton.classList.toggle("is-off", !state.media.camera);
  elements.toggleCameraButton.textContent = state.media.camera ? "Camera" : "Camera off";
  elements.shareScreenButton.classList.toggle("is-active", state.media.screen);
  elements.shareScreenButton.textContent = state.media.screen ? "Ecran actif" : "Ecran";
}

function mediaAccessMessage(error) {
  if (!window.isSecureContext) {
    return isLoopbackHost()
      ? "Le navigateur bloque camera et micro hors HTTPS. En local, ouvrez Meet avec localhost ou utilisez HTTPS."
      : "Camera et micro exigent HTTPS. Configurez la box pour rediriger le port 443 vers le serveur web, puis ouvrez Meet en HTTPS.";
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return "Camera et micro indisponibles dans ce navigateur. Essayez Chrome, Edge ou Firefox.";
  }

  const name = error?.name || "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Autorisation camera/micro refusee ou bloquee. Cliquez sur le cadenas dans la barre d'adresse, autorisez camera et micro, puis rechargez la page.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Aucun micro ou aucune camera compatible n'a ete detecte.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Le micro ou la camera est deja utilise par une autre application.";
  }
  if (name === "SecurityError") {
    return "Le navigateur bloque l'acces media pour cette page. Verifiez HTTPS et les permissions du site.";
  }

  return error?.message || "Acces micro/camera refuse ou indisponible.";
}

function pruneEndedTracks(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    if (track.readyState !== "live") {
      stream.removeTrack(track);
    }
  });
}

function hasLiveTrack(stream, kind) {
  if (!stream) return false;
  return stream.getTracks().some((track) => track.kind === kind && track.readyState === "live");
}

function addLocalTracks(stream) {
  if (!state.localStream) {
    state.localStream = new MediaStream();
  }

  stream.getTracks().forEach((track) => {
    state.localStream
      .getTracks()
      .filter((existing) => existing.kind === track.kind && existing.id !== track.id)
      .forEach((existing) => {
        state.localStream.removeTrack(existing);
        existing.stop();
      });

    if (!state.localStream.getTracks().some((existing) => existing.id === track.id)) {
      state.localStream.addTrack(track);
    }
  });
}

function refreshMediaStateFromTracks() {
  pruneEndedTracks(state.localStream);
  state.media.microphone = hasLiveTrack(state.localStream, "audio")
    && state.localStream.getAudioTracks().some((track) => track.enabled);
  state.media.camera = hasLiveTrack(state.localStream, "video")
    && !state.media.screen
    && state.localStream.getVideoTracks().some((track) => track.enabled);
}

function mediaDeviceLabel(device, fallback, index) {
  return device.label || `${fallback} ${index + 1}`;
}

function populateDeviceSelect(select, devices, selectedDeviceId, fallbackLabel) {
  if (!select) return;
  select.replaceChildren();

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = `${fallbackLabel} par defaut`;
  select.appendChild(defaultOption);

  devices.forEach((device, index) => {
    const option = document.createElement("option");
    option.value = device.deviceId;
    option.textContent = mediaDeviceLabel(device, fallbackLabel, index);
    select.appendChild(option);
  });

  select.value = devices.some((device) => device.deviceId === selectedDeviceId)
    ? selectedDeviceId
    : "";
  select.disabled = devices.length === 0;
}

function renderMediaDeviceControls() {
  const microphones = state.mediaDevices.filter((device) => device.kind === "audioinput" && device.deviceId);
  const cameras = state.mediaDevices.filter((device) => device.kind === "videoinput" && device.deviceId);
  populateDeviceSelect(elements.microphoneDeviceSelect, microphones, state.selectedMicrophoneDeviceId, "Micro");
  populateDeviceSelect(elements.cameraDeviceSelect, cameras, state.selectedCameraDeviceId, "Camera");
}

async function loadMediaDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    renderMediaDeviceControls();
    return;
  }

  try {
    state.mediaDevices = await navigator.mediaDevices.enumerateDevices();
    const microphoneIds = new Set(
      state.mediaDevices.filter((device) => device.kind === "audioinput").map((device) => device.deviceId)
    );
    const cameraIds = new Set(
      state.mediaDevices.filter((device) => device.kind === "videoinput").map((device) => device.deviceId)
    );
    if (state.selectedMicrophoneDeviceId && !microphoneIds.has(state.selectedMicrophoneDeviceId)) {
      state.selectedMicrophoneDeviceId = "";
      writeStringStorage("meetocean_microphone_device_id", "");
    }
    if (state.selectedCameraDeviceId && !cameraIds.has(state.selectedCameraDeviceId)) {
      state.selectedCameraDeviceId = "";
      writeStringStorage("meetocean_camera_device_id", "");
    }
  } catch (error) {
    state.mediaDevices = [];
  }
  renderMediaDeviceControls();
}

function audioConstraints(useSelectedDevice = true) {
  const constraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
  if (useSelectedDevice && state.selectedMicrophoneDeviceId) {
    constraints.deviceId = { exact: state.selectedMicrophoneDeviceId };
  }
  return constraints;
}

function videoConstraints(useSelectedDevice = true) {
  const constraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
  };
  if (useSelectedDevice && state.selectedCameraDeviceId) {
    constraints.deviceId = { exact: state.selectedCameraDeviceId };
  }
  return constraints;
}

async function requestMediaTracks({ audio, video }, allowDeviceFallback = true) {
  const constraints = {
    audio: audio ? audioConstraints() : false,
    video: video ? videoConstraints() : false,
  };
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    void loadMediaDevices();
    return stream;
  } catch (error) {
    const isDeviceSelectionError = error?.name === "OverconstrainedError"
      || error?.name === "ConstraintNotSatisfiedError"
      || error?.name === "NotFoundError"
      || error?.name === "DevicesNotFoundError";
    if (!allowDeviceFallback || !isDeviceSelectionError) {
      throw error;
    }

    if (audio) {
      state.selectedMicrophoneDeviceId = "";
      writeStringStorage("meetocean_microphone_device_id", "");
    }
    if (video) {
      state.selectedCameraDeviceId = "";
      writeStringStorage("meetocean_camera_device_id", "");
    }
    renderMediaDeviceControls();
    return navigator.mediaDevices.getUserMedia({
      audio: audio ? audioConstraints(false) : false,
      video: video ? videoConstraints(false) : false,
    });
  }
}

async function ensureLocalMedia(options = {}) {
  const wantsAudio = options.audio !== false;
  const wantsVideo = options.video !== false;

  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    const error = new Error(mediaAccessMessage());
    setMessage(error.message, "error", insecureMediaAction());
    throw error;
  }

  if (!state.localStream) {
    state.localStream = new MediaStream();
  }
  pruneEndedTracks(state.localStream);

  const needsAudio = wantsAudio && !hasLiveTrack(state.localStream, "audio");
  const needsVideo = wantsVideo && !state.media.screen && !hasLiveTrack(state.localStream, "video");
  if (!needsAudio && !needsVideo) {
    refreshMediaStateFromTracks();
    updateControlButtons();
    return state.localStream;
  }

  setMessage("Demande d'autorisation camera/micro...", "info");
  try {
    const capturedStream = await requestMediaTracks({ audio: needsAudio, video: needsVideo });
    if (capturedStream.getVideoTracks().length > 0) {
      state.cameraStream = capturedStream;
    }
    addLocalTracks(capturedStream);
  } catch (error) {
    if (needsAudio && needsVideo) {
      try {
        const audioStream = await requestMediaTracks({ audio: true, video: false });
        addLocalTracks(audioStream);
        setMessage("Camera indisponible, audio active.", "info");
      } catch (audioError) {
        throw new Error(mediaAccessMessage(audioError));
      }
    } else {
      throw new Error(mediaAccessMessage(error));
    }
  }

  if (needsVideo && !state.media.screen) {
    await applyCameraBackgroundEffect({ sync: false, quiet: true });
  }

  refreshMediaStateFromTracks();
  attachLocalTracksToPeers();
  renderVideos();
  updateControlButtons();
  return state.localStream;
}

async function changeMicrophoneDevice() {
  const deviceId = elements.microphoneDeviceSelect?.value || "";
  state.selectedMicrophoneDeviceId = deviceId;
  writeStringStorage("meetocean_microphone_device_id", deviceId);
  if (!state.media.microphone) return;

  try {
    const stream = await requestMediaTracks({ audio: true, video: false }, false);
    addLocalTracks(stream);
    refreshMediaStateFromTracks();
    attachLocalTracksToPeers();
    updateControlButtons();
    renderVideos();
    void syncNow();
  } catch (error) {
    setMessage(error.message || mediaAccessMessage(error), "error", insecureMediaAction());
    void loadMediaDevices();
  }
}

async function changeCameraDevice() {
  const deviceId = elements.cameraDeviceSelect?.value || "";
  state.selectedCameraDeviceId = deviceId;
  writeStringStorage("meetocean_camera_device_id", deviceId);
  if (!state.media.camera || state.media.screen) return;

  try {
    stopCameraBackgroundProcessor();
    state.cameraStream?.getVideoTracks().forEach((track) => track.stop());
    const stream = await requestMediaTracks({ audio: false, video: true }, false);
    state.cameraStream = stream;
    addLocalTracks(stream);
    await applyCameraBackgroundEffect({ sync: false, quiet: true });
    refreshMediaStateFromTracks();
    attachLocalTracksToPeers();
    updateControlButtons();
    renderVideos();
    void syncNow();
  } catch (error) {
    setMessage(error.message || mediaAccessMessage(error), "error", insecureMediaAction());
    void loadMediaDevices();
  }
}

function attachLocalTracksToPeers() {
  if (!state.localStream) return;
  const audioTrack = state.localStream
    .getAudioTracks()
    .find((track) => track.readyState === "live" && track.enabled) || null;
  const videoTrack = state.localStream
    .getVideoTracks()
    .find((track) => track.readyState === "live" && track.enabled) || null;

  state.peers.forEach((peer) => {
    let needsNegotiation = false;
    needsNegotiation = syncPeerTrack(peer, "audio", audioTrack) || needsNegotiation;
    needsNegotiation = syncPeerTrack(peer, "video", videoTrack) || needsNegotiation;
    if (needsNegotiation) {
      requestPeerNegotiation(peer);
    }
  });
}

function findPeerTransceiver(peer, kind) {
  return peer.pc.getTransceivers()
    .find((transceiver) => transceiver.sender?.track?.kind === kind
      || transceiver.receiver?.track?.kind === kind) || null;
}

function syncPeerTrack(peer, kind, track) {
  if (!peer || peer.pc.signalingState === "closed") return false;

  const transceiver = findPeerTransceiver(peer, kind);
  if (!track) {
    if (!transceiver?.sender?.track) return false;
    try {
      void transceiver.sender.replaceTrack(null).catch(() => {});
      if (transceiver.direction === "sendrecv" || transceiver.direction === "sendonly") {
        transceiver.direction = "recvonly";
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  if (transceiver) {
    if (transceiver.sender.track?.id === track.id && transceiver.sender.track.readyState === "live") {
      if (transceiver.direction === "recvonly" || transceiver.direction === "inactive") {
        transceiver.direction = "sendrecv";
        return true;
      }
      return false;
    }
    try {
      void transceiver.sender.replaceTrack(track).catch(() => {});
      if (transceiver.direction === "recvonly" || transceiver.direction === "inactive") {
        transceiver.direction = "sendrecv";
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  try {
    peer.pc.addTrack(track, state.localStream);
    return true;
  } catch (error) {
    return false;
  }
}

function requestPeerNegotiation(peer) {
  if (!peer || !state.room || peer.pc.signalingState === "closed") return;
  peer.lastNegotiationRequestedAt = Date.now();
  peer.pendingNegotiation = true;
  peer.offerSent = false;
  window.clearTimeout(peer.negotiationTimer);
  peer.negotiationTimer = window.setTimeout(() => {
    peer.negotiationTimer = null;
    void makeOffer(peer);
  }, 120);
}

function replaceLocalVideoTrack(track) {
  if (!state.localStream) return;
  state.localStream.getVideoTracks().forEach((existing) => {
    if (!track || existing.id !== track.id) {
      state.localStream.removeTrack(existing);
    }
  });
  if (track && !state.localStream.getVideoTracks().some((existing) => existing.id === track.id)) {
    state.localStream.addTrack(track);
  }
  attachLocalTracksToPeers();
  renderVideos();
}

async function toggleMicrophone() {
  const enabled = !state.media.microphone;
  if (enabled) {
    try {
      await ensureLocalMedia({ audio: true, video: false });
    } catch (error) {
      setMessage(error.message || mediaAccessMessage(error), "error", insecureMediaAction());
      return;
    }
  }

  state.localStream?.getAudioTracks().forEach((track) => {
    track.enabled = enabled;
  });
  refreshMediaStateFromTracks();
  attachLocalTracksToPeers();
  updateControlButtons();
  renderVideos();
  if (state.media.microphone) {
    startRecognitionIfNeeded();
  } else {
    stopRecognition();
  }
  void syncNow();
}

async function toggleCamera() {
  const enabled = !state.media.camera;
  if (enabled) {
    try {
      await ensureLocalMedia({ audio: false, video: true });
    } catch (error) {
      setMessage(error.message || mediaAccessMessage(error), "error", insecureMediaAction());
      return;
    }
  }

  state.cameraStream?.getVideoTracks().forEach((track) => {
    track.enabled = enabled;
  });
  if (!state.media.screen) {
    await applyCameraBackgroundEffect({ sync: false });
  } else {
    state.localStream?.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }
  refreshMediaStateFromTracks();
  attachLocalTracksToPeers();
  updateControlButtons();
  renderVideos();
  void syncNow();
}

async function shareScreen() {
  try {
    await ensureLocalMedia({ audio: true, video: false });
  } catch (error) {}
  if (state.media.screen) {
    stopScreenShare();
    return;
  }
  if (!navigator.mediaDevices?.getDisplayMedia) {
    setMessage("Partage d ecran indisponible dans ce navigateur.", "error");
    return;
  }

  try {
    state.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const [screenTrack] = state.screenStream.getVideoTracks();
    if (!screenTrack) return;
    screenTrack.onended = () => stopScreenShare();
    stopCameraBackgroundProcessor();
    state.media.screen = true;
    replaceLocalVideoTrack(screenTrack);
    updateControlButtons();
    void syncNow();
  } catch (error) {
    setMessage("Partage d ecran annule.", "info");
  }
}

function stopScreenShare() {
  state.screenStream?.getTracks().forEach((track) => track.stop());
  state.screenStream = null;
  state.media.screen = false;
  void applyCameraBackgroundEffect();
  updateControlButtons();
}

function shouldInitiate(peerId) {
  return state.clientId.localeCompare(peerId) < 0;
}

function createPeer(participant) {
  const clientIdValue = participant.clientId;
  const existing = state.peers.get(clientIdValue);
  if (existing) return existing;

  const pc = new RTCPeerConnection({ iceServers, iceTransportPolicy });
  pc.addTransceiver("audio", { direction: "recvonly" });
  pc.addTransceiver("video", { direction: "recvonly" });
  const remoteStream = new MediaStream();
  const peer = {
    clientId: clientIdValue,
    pc,
    remoteStream,
    offerSent: false,
    makingOffer: false,
    pendingNegotiation: false,
    pendingCandidates: [],
    negotiationTimer: null,
    lastNegotiationRequestedAt: 0,
  };

  pc.onicecandidate = (event) => {
    if (!event.candidate || !state.room) return;
    void sendSignal(clientIdValue, "candidate", {
      candidate: event.candidate.toJSON(),
    });
  };

  pc.onnegotiationneeded = () => {
    requestPeerNegotiation(peer);
  };

  pc.onsignalingstatechange = () => {
    if (pc.signalingState === "stable" && peer.pendingNegotiation) {
      requestPeerNegotiation(peer);
    }
    renderVideos();
  };

  pc.ontrack = (event) => {
    const stream = event.streams[0];
    const tracks = stream ? stream.getTracks() : [event.track];
    tracks.forEach((track) => {
      if (!remoteStream.getTracks().some((existingTrack) => existingTrack.id === track.id)) {
        remoteStream.addTrack(track);
      }
      track.onunmute = () => {
        renderVideos();
        const tile = state.videoTiles.get(clientIdValue);
        playVideoElement(tile?.video);
      };
      track.onended = () => {
        renderVideos();
      };
    });
    renderVideos();
    const tile = state.videoTiles.get(clientIdValue);
    playVideoElement(tile?.video);
  };

  pc.onconnectionstatechange = () => {
    if (["failed", "disconnected"].includes(pc.connectionState)) {
      pc.restartIce?.();
      requestPeerNegotiation(peer);
    }
    renderVideos();
  };

  pc.oniceconnectionstatechange = () => {
    if (["failed", "disconnected"].includes(pc.iceConnectionState)) {
      pc.restartIce?.();
      requestPeerNegotiation(peer);
    }
    renderVideos();
  };

  state.peers.set(clientIdValue, peer);
  attachLocalTracksToPeers();
  renderVideos();
  return peer;
}

function hasLiveRemoteTrack(peer, kind) {
  return Boolean(peer?.remoteStream?.getTracks().some((track) => track.kind === kind && track.readyState === "live"));
}

function ensurePeerMediaHealth() {
  const now = Date.now();
  state.participants
    .filter((participant) => participant.clientId !== state.clientId)
    .forEach((participant) => {
      const peer = state.peers.get(participant.clientId);
      if (!peer || peer.pc.signalingState === "closed") return;

      const expectsVideo = participant.cameraEnabled || participant.screenEnabled;
      const expectsAudio = participant.microphoneEnabled;
      const missingExpectedMedia = (expectsVideo && !hasLiveRemoteTrack(peer, "video"))
        || (expectsAudio && !hasLiveRemoteTrack(peer, "audio"));

      if (!missingExpectedMedia) return;
      if (now - peer.lastNegotiationRequestedAt < 5000) return;
      requestPeerNegotiation(peer);
    });
}

async function makeOffer(peer) {
  if (!state.room || peer.makingOffer || peer.pc.signalingState === "closed") return;
  if (peer.pc.signalingState !== "stable") {
    requestPeerNegotiation(peer);
    return;
  }
  peer.makingOffer = true;
  try {
    peer.pendingNegotiation = false;
    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    await sendSignal(peer.clientId, "offer", {
      description: peer.pc.localDescription,
    });
    peer.offerSent = true;
  } catch (error) {
    console.error(error);
    setMessage("Connexion video impossible avec un participant.", "error");
  } finally {
    peer.makingOffer = false;
  }
}

function syncPeersWithParticipants() {
  if (!state.room) return;
  const remoteParticipants = state.participants.filter((participant) => participant.clientId !== state.clientId);
  const activeIds = new Set(remoteParticipants.map((participant) => participant.clientId));

  remoteParticipants.forEach((participant) => {
    const peer = createPeer(participant);
    if (shouldInitiate(participant.clientId) && !peer.offerSent) {
      void makeOffer(peer);
    }
  });

  Array.from(state.peers.entries()).forEach(([clientIdValue, peer]) => {
    if (!activeIds.has(clientIdValue)) {
      peer.pc.close();
      state.peers.delete(clientIdValue);
    }
  });
}

async function sendSignal(recipientClientId, signalType, payload = {}) {
  if (!state.room) return null;
  return postAction("signal", {
    roomId: state.room.id,
    senderClientId: state.clientId,
    recipientClientId,
    signalType,
    payload,
  });
}

async function flushPendingCandidates(peer) {
  if (!peer.pc.remoteDescription) return;
  while (peer.pendingCandidates.length > 0) {
    const candidate = peer.pendingCandidates.shift();
    try {
      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {}
  }
}

async function handleSignal(signal) {
  const senderId = signal.senderClientId;
  if (!senderId || senderId === state.clientId) return;

  if (signal.signalType === "leave") {
    const peer = state.peers.get(senderId);
    if (peer) {
      peer.pc.close();
      state.peers.delete(senderId);
      renderVideos();
    }
    return;
  }

  const participant = participantByClient(senderId) || {
    clientId: senderId,
    displayName: "Participant",
  };
  const peer = createPeer(participant);
  const payload = signal.payload || {};

  try {
    if (signal.signalType === "offer") {
      const description = payload.description || payload.sdp || payload;
      const offerCollision = peer.makingOffer || peer.pc.signalingState !== "stable";
      const polite = !shouldInitiate(senderId);
      if (offerCollision) {
        if (!polite) return;
        try {
          await peer.pc.setLocalDescription({ type: "rollback" });
        } catch (rollbackError) {}
      }
      await peer.pc.setRemoteDescription(new RTCSessionDescription(description));
      attachLocalTracksToPeers();
      await flushPendingCandidates(peer);
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      await sendSignal(senderId, "answer", {
        description: peer.pc.localDescription,
      });
      peer.offerSent = false;
      return;
    }

    if (signal.signalType === "answer") {
      const description = payload.description || payload.sdp || payload;
      if (peer.pc.signalingState !== "stable") {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(description));
        await flushPendingCandidates(peer);
      }
      if (peer.pendingNegotiation) {
        requestPeerNegotiation(peer);
      }
      return;
    }

    if (signal.signalType === "candidate" && payload.candidate) {
      if (peer.pc.remoteDescription) {
        await peer.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } else {
        peer.pendingCandidates.push(payload.candidate);
      }
    }
  } catch (error) {
    setMessage("Signal WebRTC ignore pendant la reconnexion.", "info");
  }
}

async function applySyncPayload(payload) {
  if (payload.room) {
    state.room = payload.room;
    updateRoomHeader();
  }
  if (Array.isArray(payload.participants)) {
    state.participants = payload.participants;
    renderParticipants();
  }
  if (Array.isArray(payload.transcripts)) {
    payload.transcripts.forEach((item) => {
      state.transcriptMap.set(item.id, item);
      state.lastTranscriptId = Math.max(state.lastTranscriptId, Number(item.id || 0));
    });
    renderTranscripts();
  }
  if (Array.isArray(payload.chatMessages)) {
    payload.chatMessages.forEach((item) => {
      state.chatMap.set(item.id, item);
      state.lastChatId = Math.max(state.lastChatId, Number(item.id || 0));
    });
    renderChatMessages();
  }
  syncPeersWithParticipants();
  ensurePeerMediaHealth();
  renderVideos();

  if (Array.isArray(payload.signals)) {
    for (const signal of payload.signals) {
      state.lastSignalId = Math.max(state.lastSignalId, Number(signal.id || 0));
      await handleSignal(signal);
    }
  }
  if (payload.serverTime) {
    state.lastSyncAt = payload.serverTime;
  }
}

async function syncNow() {
  if (!state.room || state.pendingSync) return;
  state.pendingSync = true;
  try {
    const payload = await postAction("sync", {
      roomId: state.room.id,
      clientId: state.clientId,
      sourceLanguage: state.sourceLanguage,
      targetLanguage: effectiveTargetLanguage(),
      mediaState: mediaState(),
      sinceSignalId: state.lastSignalId,
      sinceTranscriptId: state.lastTranscriptId,
      sinceChatId: state.lastChatId,
    });
    await applySyncPayload(payload);
  } catch (error) {
    if (error.code === "database_busy") return;
    if (error.code === "guest_waiting") {
      cleanupMeeting();
      setMessage(error.message || "Cette reunion n est pas encore accessible aux invites.", "info");
      void loadDashboard(false).catch(() => {});
      return;
    }
    setMessage(error.message || "Synchronisation indisponible.", "error");
  } finally {
    state.pendingSync = false;
  }
}

function startSyncLoop() {
  window.clearInterval(state.syncTimer);
  state.syncTimer = window.setInterval(() => {
    void syncNow();
  }, 1600);
}

function stopSyncLoop() {
  window.clearInterval(state.syncTimer);
  state.syncTimer = null;
}

async function createRoom() {
  if (state.room) return;
  elements.createRoomButton.disabled = true;
  setMessage("Preparation de la reunion...");
  try {
    setSpokenLanguage(elements.sourceLanguage.value);
    syncLanguageControls();
    await ensureLocalMedia();
    const payload = await postAction("create_room", {
      title: elements.roomTitle.value,
      scheduledStartAt: localInputToUtcSql(elements.roomScheduledStart?.value || ""),
      clientId: state.clientId,
      sourceLanguage: state.sourceLanguage,
      targetLanguage: effectiveTargetLanguage(),
      mediaState: mediaState(),
    });
    await enterRoom(payload);
  } catch (error) {
    setMessage(error.message || "Creation impossible.", "error", insecureMediaAction());
  } finally {
    elements.createRoomButton.disabled = false;
  }
}

async function joinRoom() {
  if (state.room) return;
  const code = elements.roomCode.value.trim();
  if (!code) {
    setMessage("Indiquez un code reunion.", "error");
    return;
  }
  elements.joinRoomButton.disabled = true;
  setMessage("Connexion a la reunion...");
  try {
    setSpokenLanguage(elements.sourceLanguage.value);
    syncLanguageControls();
    await ensureLocalMedia();
    const payload = await postAction("join_room", {
      roomCode: code,
      clientId: state.clientId,
      sourceLanguage: state.sourceLanguage,
      targetLanguage: effectiveTargetLanguage(),
      mediaState: mediaState(),
    });
    await enterRoom(payload);
  } catch (error) {
    setMessage(error.message || "Connexion impossible.", "error", insecureMediaAction());
  } finally {
    elements.joinRoomButton.disabled = false;
  }
}

async function enterRoom(payload) {
  state.isGuest = Boolean(payload.isGuest);
  state.room = payload.room;
  state.lastSignalId = 0;
  state.lastTranscriptId = 0;
  state.lastChatId = 0;
  state.lastSyncAt = null;
  state.transcriptMap.clear();
  state.chatMap.clear();
  updateRoomHeader();
  setRoomActive(true);
  await applySyncPayload(payload);
  startSyncLoop();
  startRecognitionIfNeeded();
  setMessage(payload.message || "Reunion active.", "success");
  void syncNow();
}

async function leaveRoom() {
  if (!state.room) return;
  const roomId = state.room.id;
  const peers = Array.from(state.peers.keys());
  try {
    await Promise.all(peers.map((peerId) => sendSignal(peerId, "leave", {})));
  } catch (error) {}
  try {
    await postAction("leave_room", {
      roomId,
      clientId: state.clientId,
    });
  } catch (error) {}
  cleanupMeeting();
  setMessage("Reunion quittee.", "success");
  void loadDashboard(false);
}

function cleanupMeeting() {
  stopSyncLoop();
  stopRecognition();
  stopCameraBackgroundProcessor();
  state.recognitionShouldRun = false;
  clearPendingTranscript();
  state.peers.forEach((peer) => peer.pc.close());
  state.peers.clear();
  state.videoTiles.forEach((entry) => entry.tile.remove());
  state.videoTiles.clear();
  state.localStream?.getTracks().forEach((track) => track.stop());
  state.cameraStream?.getTracks().forEach((track) => track.stop());
  state.screenStream?.getTracks().forEach((track) => track.stop());
  state.localStream = null;
  state.cameraStream = null;
  state.screenStream = null;
  state.room = null;
  state.participants = [];
  state.transcriptMap.clear();
  state.chatMap.clear();
  state.lastSignalId = 0;
  state.lastTranscriptId = 0;
  state.lastChatId = 0;
  state.lastSyncAt = null;
  state.pendingChatFile = null;
  if (elements.chatFileInput) {
    elements.chatFileInput.value = "";
  }
  state.media = {
    microphone: false,
    camera: false,
    screen: false,
    connectionState: "online",
  };
  renderParticipants();
  renderChatMessages();
  updateChatFilePreview();
  renderTranscripts();
  renderVideos();
  updateControlButtons();
  setRoomActive(false);
}

function recognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function recognitionErrorMessage(errorCode = "") {
  const messages = {
    "not-allowed": "Transcription bloquee par les permissions du navigateur. Autorisez le micro puis rechargez la page.",
    "service-not-allowed": "Service de transcription bloque par le navigateur. Essayez Chrome ou Edge avec HTTPS.",
    "audio-capture": "Aucun flux micro disponible pour la transcription.",
    network: "Transcription indisponible cote navigateur. Verifiez la connexion Internet du poste.",
    "language-not-supported": "Langue de transcription non prise en charge par ce navigateur.",
  };
  return messages[errorCode] || "Transcription interrompue par le navigateur.";
}

function cleanTranscriptText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function clearPendingTranscript() {
  window.clearTimeout(state.pendingTranscriptTimer);
  state.pendingTranscriptTimer = null;
  state.pendingTranscriptText = "";
}

async function flushPendingTranscript() {
  const text = cleanTranscriptText(state.pendingTranscriptText);
  clearPendingTranscript();
  if (text) {
    await addTranscript(text);
  }
}

function queueTranscript(text) {
  const cleaned = cleanTranscriptText(text);
  if (!cleaned) return;
  state.pendingTranscriptText = cleanTranscriptText(`${state.pendingTranscriptText} ${cleaned}`);
  showLiveCaption(state.pendingTranscriptText);
  window.clearTimeout(state.pendingTranscriptTimer);
  const delay = state.pendingTranscriptText.length > 220 ? 120 : 850;
  state.pendingTranscriptTimer = window.setTimeout(() => {
    void flushPendingTranscript();
  }, delay);
}

function startRecognitionIfNeeded() {
  state.transcriptionEnabled = elements.transcriptionToggle.checked;
  if (!state.room || !state.transcriptionEnabled || !state.media.microphone) {
    stopRecognition();
    return;
  }

  const Ctor = recognitionConstructor();
  if (!Ctor) {
    if (!state.speechNoticeShown) {
      setMessage("Transcription navigateur indisponible. Essayez Chrome ou Edge.", "error");
      state.speechNoticeShown = true;
    }
    return;
  }

  if (state.recognitionActive) return;
  state.recognitionShouldRun = true;
  const recognition = new Ctor();
  recognition.lang = state.sourceLanguage;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    state.recognitionActive = true;
  };
  recognition.onresult = (event) => {
    let interim = "";
    for (let index = event.resultIndex; index < event.results.length; index++) {
      const result = event.results[index];
      const text = result[0]?.transcript?.trim() || "";
      if (!text) continue;
      if (result.isFinal) {
        queueTranscript(text);
      } else {
        interim += `${text} `;
      }
    }
    const interimText = interim.trim();
    if (interimText) {
      showLiveCaption(interimText);
    } else if (state.pendingTranscriptText) {
      showLiveCaption(state.pendingTranscriptText);
    } else {
      showLiveCaption("");
    }
  };
  recognition.onerror = (event) => {
    if (!["no-speech", "aborted"].includes(event.error || "")) {
      setMessage(recognitionErrorMessage(event.error), "info");
    }
  };
  recognition.onend = () => {
    state.recognitionActive = false;
    void flushPendingTranscript();
    if (state.recognitionShouldRun && state.room && state.transcriptionEnabled && state.media.microphone) {
      window.setTimeout(() => startRecognitionIfNeeded(), 450);
    }
  };

  state.recognition = recognition;
  try {
    recognition.start();
  } catch (error) {}
}

function stopRecognition() {
  state.recognitionShouldRun = false;
  clearPendingTranscript();
  if (!state.recognition) return;
  try {
    state.recognition.stop();
  } catch (error) {}
  state.recognition = null;
  state.recognitionActive = false;
  showLiveCaption("");
}

function restartRecognition() {
  stopRecognition();
  window.setTimeout(() => {
    state.recognitionShouldRun = true;
    startRecognitionIfNeeded();
  }, 300);
}

function showLiveCaption(text) {
  elements.liveCaption.textContent = text;
  elements.liveCaption.classList.toggle("hidden", text === "");
}

function transcriptFingerprint(text) {
  return `${state.sourceLanguage}:${cleanTranscriptText(text).toLowerCase()}`;
}

function rememberTranscript(text) {
  const fingerprint = transcriptFingerprint(text);
  if (state.transcriptFingerprints.includes(fingerprint)) {
    return false;
  }
  state.transcriptFingerprints.push(fingerprint);
  if (state.transcriptFingerprints.length > 40) {
    state.transcriptFingerprints.shift();
  }
  return true;
}

function forgetTranscript(text) {
  const fingerprint = transcriptFingerprint(text);
  state.transcriptFingerprints = state.transcriptFingerprints.filter((item) => item !== fingerprint);
}

async function addTranscript(text) {
  if (!state.room || !rememberTranscript(text)) return;
  showLiveCaption(text);
  try {
    const payload = await postAction("add_transcript", {
      roomId: state.room.id,
      clientId: state.clientId,
      text,
      sourceLanguage: state.sourceLanguage,
      targetLanguage: effectiveTargetLanguage(),
      mediaState: mediaState(),
      sinceSignalId: state.lastSignalId,
      sinceTranscriptId: state.lastTranscriptId,
      sinceChatId: state.lastChatId,
    });
    await applySyncPayload(payload);
  } catch (error) {
    if (error.code === "database_busy") {
      forgetTranscript(text);
      state.pendingTranscriptText = cleanTranscriptText(`${text} ${state.pendingTranscriptText}`);
      window.clearTimeout(state.pendingTranscriptTimer);
      state.pendingTranscriptTimer = window.setTimeout(() => {
        void flushPendingTranscript();
      }, 1200);
      return;
    }
    forgetTranscript(text);
    setMessage(error.message || "Transcription non enregistree.", "error");
  }
}

function changeActiveLanguage() {
  setSpokenLanguage(elements.activeSourceLanguage.value);
  syncLanguageControls();
  state.lastTranscriptId = 0;
  state.transcriptMap.clear();
  renderTranscripts();
  restartRecognition();
  void syncNow();
}

function changeStartLanguage() {
  setSpokenLanguage(elements.sourceLanguage.value);
  syncLanguageControls();
}

function toggleTranslation() {
  state.translationEnabled = elements.translationToggle.checked;
  setSpokenLanguage(elements.activeSourceLanguage.value);
  syncLanguageControls();
  state.lastTranscriptId = 0;
  state.transcriptMap.clear();
  renderTranscripts();
  void syncNow();
}

async function logout() {
  try {
    const refreshToken = localStorage.getItem("oceanerp.refreshToken") || "";
    if (refreshToken) {
      await fetch(AUTH_URL, {
        method: "POST",
        headers: authHeaders(false),
        body: JSON.stringify({ refreshToken }),
      });
    }
    localStorage.removeItem("oceanerp.accessToken");
    localStorage.removeItem("oceanerp.refreshToken");
    localStorage.removeItem("oceanerp.user");
  } catch (error) {}
  window.location.href = OCEANOS_URL;
}

async function copyRoomCode() {
  if (!state.room?.code) return;
  try {
    await navigator.clipboard.writeText(state.room.code);
    setMessage("Code reunion copie.", "success");
  } catch (error) {
    setMessage(state.room.code, "info");
  }
}

async function ensureInviteLink() {
  if (!state.room?.id) return "";
  if (state.room.inviteUrl) return state.room.inviteUrl;
  const payload = await postAction("ensure_invite", {
    roomId: state.room.id,
  });
  state.room = payload.room || state.room;
  updateRoomHeader();
  return payload.inviteUrl || state.room.inviteUrl || "";
}

async function copyInviteLink() {
  if (!state.room?.id) return;
  try {
    const inviteUrl = await ensureInviteLink();
    if (!inviteUrl) {
      setMessage("Lien invite indisponible.", "error");
      return;
    }
    await navigator.clipboard.writeText(inviteUrl);
    setMessage("Lien invite copie.", "success");
  } catch (error) {
    setMessage(error.message || "Lien invite impossible.", "error");
  }
}

async function deleteRoom(room) {
  if (!room?.id || state.isGuest) return;
  const label = room.code || room.title || "cette reunion";
  if (!window.confirm(`Supprimer ${label} ?`)) return;
  try {
    const payload = await postAction("delete_room", {
      roomId: room.id,
    });
    renderRecentRooms(payload.recentRooms || []);
    setMessage(payload.message || "Reunion supprimee.", "success");
  } catch (error) {
    setMessage(error.message || "Suppression impossible.", "error");
  }
}

async function deleteCurrentRoom() {
  if (!state.room?.id || state.isGuest) return;
  if (!window.confirm(`Supprimer ${state.room.code || "cette reunion"} ?`)) return;
  try {
    await postAction("delete_room", {
      roomId: state.room.id,
    });
    cleanupMeeting();
    setMessage("Reunion supprimee.", "success");
    void loadDashboard(false);
  } catch (error) {
    setMessage(error.message || "Suppression impossible.", "error");
  }
}

async function joinGuestRoom() {
  if (!hasInviteAccess()) {
    setMessage("Lien invite invalide.", "error");
    return;
  }
  const waitingMessage = guestAccessBlockedMessage();
  if (waitingMessage) {
    setMessage(waitingMessage, "info");
    scheduleGuestAccessRefresh();
    return;
  }
  const guestName = elements.guestName.value.trim();
  if (!guestName) {
    setMessage("Indiquez votre nom pour rejoindre la reunion.", "error");
    elements.guestName.focus();
    return;
  }
  elements.guestJoinButton.disabled = true;
  setMessage("Connexion a la reunion...");
  try {
    setSpokenLanguage(elements.guestSourceLanguage.value);
    state.currentUser = {
      displayName: guestName,
      isGuest: true,
    };
    syncLanguageControls();
    await ensureLocalMedia();
    const payload = await postAction("join_room", {
      roomCode: state.inviteRoomCode,
      clientId: state.clientId,
      guestName,
      sourceLanguage: state.sourceLanguage,
      targetLanguage: effectiveTargetLanguage(),
      mediaState: mediaState(),
    });
    await enterRoom(payload);
  } catch (error) {
    if (error.code === "guest_waiting") {
      await loadDashboard(false).catch(() => {});
      setMessage(error.message || "Cette reunion n est pas encore accessible aux invites.", "info");
      return;
    }
    setMessage(error.message || "Connexion invite impossible.", "error", insecureMediaAction());
  } finally {
    elements.guestJoinButton.disabled = guestAccessBlocked();
  }
}

function bindEvents() {
  elements.createRoomButton.addEventListener("click", () => void createRoom());
  elements.joinRoomButton.addEventListener("click", () => void joinRoom());
  elements.guestJoinButton.addEventListener("click", () => void joinGuestRoom());
  elements.guestName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void joinGuestRoom();
    }
  });
  elements.roomCode.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void joinRoom();
    }
  });
  elements.logoutButton.addEventListener("click", () => void logout());
  elements.copyRoomButton.addEventListener("click", () => void copyRoomCode());
  elements.copyInviteButton.addEventListener("click", () => void copyInviteLink());
  elements.deleteRoomButton.addEventListener("click", () => void deleteCurrentRoom());
  elements.leaveRoomButton.addEventListener("click", () => void leaveRoom());
  elements.toggleMicButton.addEventListener("click", () => void toggleMicrophone());
  elements.microphoneDeviceSelect?.addEventListener("change", () => void changeMicrophoneDevice());
  elements.toggleCameraButton.addEventListener("click", () => void toggleCamera());
  elements.cameraDeviceSelect?.addEventListener("change", () => void changeCameraDevice());
  elements.shareScreenButton.addEventListener("click", () => void shareScreen());
  elements.transcriptionToggle.addEventListener("change", () => {
    state.transcriptionEnabled = elements.transcriptionToggle.checked;
    if (state.transcriptionEnabled) {
      state.recognitionShouldRun = true;
      startRecognitionIfNeeded();
    } else {
      stopRecognition();
    }
    void syncNow();
  });
  elements.translationToggle.addEventListener("change", toggleTranslation);
  elements.activeSourceLanguage.addEventListener("change", changeActiveLanguage);
  elements.activeTargetLanguage.addEventListener("change", changeActiveLanguage);
  elements.cameraBackgroundEffect?.addEventListener("change", () => void changeCameraBackgroundEffect());
  elements.cameraBackgroundFile?.addEventListener("change", () => void loadCustomCameraBackground());
  elements.sourceLanguage.addEventListener("change", changeStartLanguage);
  elements.targetLanguage.addEventListener("change", changeStartLanguage);
  elements.chatForm?.addEventListener("submit", (event) => void sendChatMessage(event));
  elements.chatFileButton?.addEventListener("click", () => elements.chatFileInput?.click());
  elements.chatFileInput?.addEventListener("change", selectChatFile);
  elements.chatMessageInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendChatMessage();
    }
  });
  elements.clearTranscriptButton.addEventListener("click", () => {
    state.transcriptMap.clear();
    renderTranscripts();
  });
  window.addEventListener("beforeunload", () => {
    if (!state.room) return;
    cleanupMeeting();
  });
  if (navigator.mediaDevices) {
    navigator.mediaDevices.ondevicechange = () => void loadMediaDevices();
  }
}

async function loadDashboard(showReadyMessage = true) {
  syncScheduledStartInput();
  const payload = await requestJson(dashboardUrl());
  renderDashboard(payload);
  setVisible(true);
  const waitingMessage = state.isGuest && !state.room ? guestAccessBlockedMessage(payload) : "";
  if (waitingMessage) {
    if (showReadyMessage) {
      setMessage(waitingMessage, "info");
    }
    return;
  }
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    showMediaSecurityMessage();
    return;
  }
  if (showReadyMessage) {
    if (state.isGuest) {
      setMessage("");
    } else {
      setMessage("");
    }
  }
  if (!state.isGuest && state.inviteRoomCode && !state.autoJoinAttempted && !state.room) {
    state.autoJoinAttempted = true;
    void joinRoom();
  }
}

async function boot() {
  loadCameraBackgroundPreference();
  syncCameraBackgroundControls();
  bindEvents();
  renderParticipants();
  renderChatMessages();
  renderTranscripts();
  updateControlButtons();
  syncScheduledStartInput();
  await loadIceConfiguration();
  await loadMediaDevices();
  try {
    await loadDashboard();
  } catch (error) {
    setVisible(true);
    if (hasInviteAccess()) {
      state.isGuest = true;
      elements.currentUser.textContent = "Invite externe";
      elements.logoutButton.classList.add("hidden");
      elements.startPanel.classList.add("hidden");
      elements.guestPanel.classList.remove("hidden");
      elements.guestRoomCode.textContent = state.inviteRoomCode || "Invitation";
    }
    setMessage(error.message || "Meet indisponible.", "error");
  }
}

boot();

