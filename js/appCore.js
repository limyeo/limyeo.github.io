const BOARD_PAGE_SIZE = 5;
const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=1800&q=80";
const DEFAULT_HERO_LOGO_TEXT = "복음을 전하고, 삶을 나누는 선교 편지";
const DEFAULT_HERO_LOGO_SIZE = 100;
const DEFAULT_HERO_LOGO_POSITION = "center-center";
const VALID_HERO_LOGO_POSITIONS = new Set([
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "center-center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right"
]);
const DEFAULT_IMAGE_BUCKET = "image";
const DEFAULT_AUDIO_BUCKET = "audio";
const ADMIN_TABLE_CAPACITY_BYTES = 500 * 1024 * 1024;
const ADMIN_STORAGE_CAPACITY_BYTES = 1024 * 1024 * 1024;
const HERO_SETTINGS_CACHE_KEY = "hero_settings_cache_v1";
const HERO_POSITION_CLASS_PREFIX = "is-hero-pos-";
const HOME_RECENT_NAV_INTENT_KEY = "home_recent_nav_intent_v1";

const CONFIG = getSupabaseConfig();
const supabaseClient = createSupabaseBrowserClient();

const state = {
  bgMusic: {
    apiReady: false,
    player: null,
    playerReady: false,
    videoId: "",
    isPlaying: false,
    isMuted: true,
    hasUserInteracted: false
  },
  letters: [],
  settings: {
    heroImageUrl: DEFAULT_HERO_IMAGE,
    heroImageStoragePath: "",
    heroLogoText: DEFAULT_HERO_LOGO_TEXT,
    heroLogoSize: DEFAULT_HERO_LOGO_SIZE,
    heroLogoPosition: DEFAULT_HERO_LOGO_POSITION
  },
  boardPage: 1,
  boardMode: "list",
  selectedLetterId: null,
  isAdmin: false,
  authSubscription: null,
  connectivity: {
    bound: false,
    noticeVisible: false,
    lastFingerprint: ""
  }
};

/* =========================================================
   boot / config
========================================================= */
function getSupabaseConfig() {
  const fromWindow = window.__SUPABASE_CONFIG__ || {};

  return {
    url: fromWindow.url || "YOUR_SUPABASE_URL",
    publishableKey:
      fromWindow.publishableKey || fromWindow.anonKey || "YOUR_SUPABASE_PUBLISHABLE_KEY",
    imageBucket: fromWindow.imageBucket || DEFAULT_IMAGE_BUCKET,
    audioBucket: fromWindow.audioBucket || DEFAULT_AUDIO_BUCKET
  };
}

function createSupabaseBrowserClient() {
  if (!window.supabase) return null;

  if (
    !CONFIG.url ||
    !CONFIG.publishableKey ||
    CONFIG.url.includes("YOUR_SUPABASE_URL") ||
    CONFIG.publishableKey.includes("YOUR_SUPABASE_PUBLISHABLE_KEY")
  ) {
    return null;
  }

  return window.supabase.createClient(CONFIG.url, CONFIG.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}


function getHeroPositionClassName(position) {
  return `${HERO_POSITION_CLASS_PREFIX}${resolveHeroLogoPosition(position)}`;
}

function clearHeroPositionClasses(container) {
  if (!container) return;
  [...container.classList]
    .filter((name) => name.startsWith(HERO_POSITION_CLASS_PREFIX))
    .forEach((name) => container.classList.remove(name));
}

function cacheHeroSettings() {
  try {
    localStorage.setItem(
      HERO_SETTINGS_CACHE_KEY,
      JSON.stringify({
        heroImageUrl: getCurrentHeroImage(),
        heroLogoText: getCurrentHeroLogoText(),
        heroLogoSize: getCurrentHeroLogoSize(),
        heroLogoPosition: getCurrentHeroLogoPosition()
      })
    );
  } catch (_error) {
    // noop
  }
}

function hydrateHeroSettingsFromCache() {
  try {
    const raw = localStorage.getItem(HERO_SETTINGS_CACHE_KEY);
    if (!raw) return;

    const cached = JSON.parse(raw);
    state.settings.heroImageUrl = cached?.heroImageUrl || state.settings.heroImageUrl;
    state.settings.heroLogoText = resolveHeroLogoText(cached?.heroLogoText);
    state.settings.heroLogoSize = resolveHeroLogoSize(cached?.heroLogoSize);
    state.settings.heroLogoPosition = resolveHeroLogoPosition(cached?.heroLogoPosition);
  } catch (_error) {
    // noop
  }
}

function applyCachedHeroPresentationEarly(page) {
  if (page !== "home") return;
  applyHeroImage();
  applyHeroLogoText();
}

async function bootstrapApp(page) {
  if (!supabaseClient) {
    const message = "app.js 상단의 Supabase 설정값을 먼저 입력해주세요.";

    if (page === "admin") {
      alert(message);
      window.location.href = "index.html";
      return;
    }

    showGlobalError(message);
    return;
  }

  await refreshAuthState();
  await Promise.all([loadSiteSettings(), loadPosts()]);
  initializeBackgroundMusicPlayer();

  if (page === "home") initializeHomePage();
  if (page === "board") initializeBoardPage();

  if (page === "admin") {
    if (!state.isAdmin) {
      window.location.href = "index.html?adminLogin=1";
      return;
    }
    initializeAdminPage();
  }

  bindHashNavigation();
  subscribeAuthStateChanges(page);
}

function subscribeAuthStateChanges(page) {
  if (!supabaseClient || state.authSubscription) return;

  const { data } = supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    const previousIsAdmin = Boolean(state.isAdmin);

    state.isAdmin = await checkIsAdmin(session?.user || null, {
      fallbackValue: previousIsAdmin,
      silent: true
    });

    if (page === "board") {
      updateBoardAdminVisibility();
    }

    if (page === "admin" && !state.isAdmin) {
      window.location.href = "index.html?adminLogin=1";
    }
  });

  state.authSubscription = data?.subscription || null;
}

/* =========================================================
   global message
========================================================= */
function showGlobalError(message) {
  showGlobalMessage(message, "error");
}

function showGlobalSuccess(message) {
  showGlobalMessage(message, "success");
}

function showGlobalMessage(message, type = "success") {
  if (!message) return;

  let box = document.getElementById("globalMessageBox");

  if (!box) {
    box = document.createElement("div");
    box.id = "globalMessageBox";
    box.style.position = "fixed";
    box.style.left = "50%";
    box.style.top = "24px";
    box.style.transform = "translateX(-50%)";
    box.style.zIndex = "200";
    box.style.padding = "14px 20px";
    box.style.borderRadius = "999px";
    box.style.boxShadow = "0 12px 34px rgba(0,0,0,0.18)";
    box.style.fontSize = "14px";
    box.style.maxWidth = "calc(100vw - 32px)";
    box.style.textAlign = "center";
    document.body.appendChild(box);
  }

  box.textContent = message;
  box.style.background = type === "error" ? "#7f1d1d" : "#111111";
  box.style.color = "#ffffff";

  window.clearTimeout(showGlobalMessage._timer);
  showGlobalMessage._timer = window.setTimeout(() => box?.remove(), 2600);
}

function getRequestErrorStatus(error) {
  const status = Number(error?.status ?? error?.statusCode ?? error?.code);
  return Number.isFinite(status) ? status : 0;
}

function isRecoverableRequestError(error) {
  if (!error) return false;

  if (navigator.onLine === false) return true;

  const status = getRequestErrorStatus(error);
  if ([0, 404, 408, 409, 425, 429, 500, 502, 503, 504].includes(status)) return true;

  const message = String(error?.message || error?.error_description || error || "").toLowerCase();
  return [
    "failed to fetch",
    "fetch failed",
    "networkerror",
    "network request failed",
    "load failed",
    "timeout",
    "timed out",
    "gateway",
    "terminated",
    "offline",
    "status 404",
    "404"
  ].some((keyword) => message.includes(keyword));
}

function getRecoverableRequestMessage(error, actionLabel = "서버 통신") {
  if (navigator.onLine === false) {
    return "인터넷 연결이 끊긴 상태입니다. 연결이 복구되면 새로고침 후 다시 시도해주세요.";
  }

  const status = getRequestErrorStatus(error);
  if (status === 404) {
    return `${actionLabel} 중 서버가 일시적으로 404를 반환했습니다. 잠시 후 다시 시도하거나 새로고침하면 복구될 수 있습니다.`;
  }

  if (status >= 500 || status === 408 || status === 429) {
    return `${actionLabel} 중 서버 응답이 불안정했습니다. 잠시 후 다시 시도하거나 새로고침해주세요.`;
  }

  return `${actionLabel} 중 통신이 잠시 끊겼습니다. 잠시 후 다시 시도하거나 새로고침해주세요.`;
}

function ensureConnectivityNoticeStyles() {
  if (document.getElementById("connectivityNoticeStyles")) return;

  const style = document.createElement("style");
  style.id = "connectivityNoticeStyles";
  style.textContent = `
    .connectivity-notice {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 220;
      width: min(420px, calc(100vw - 32px));
      padding: 16px;
      border-radius: 22px;
      border: 1px solid rgba(17, 17, 17, 0.08);
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 18px 44px rgba(0, 0, 0, 0.18);
      backdrop-filter: blur(14px);
    }

    .connectivity-notice.is-hidden {
      display: none !important;
    }

    .connectivity-notice.is-error {
      border-color: rgba(185, 28, 28, 0.18);
      background: rgba(255, 245, 245, 0.98);
    }

    .connectivity-notice.is-success {
      border-color: rgba(22, 101, 52, 0.16);
      background: rgba(240, 255, 244, 0.98);
    }

    .connectivity-notice__title {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      line-height: 1.5;
      color: #111111;
    }

    .connectivity-notice__body {
      margin: 8px 0 0;
      font-size: 13px;
      line-height: 1.7;
      color: #333333;
    }

    .connectivity-notice__actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 14px;
    }

    .connectivity-notice__button {
      min-width: 0;
      padding: 10px 14px;
      border-radius: 999px;
      border: 1px solid rgba(17, 17, 17, 0.12);
      background: #ffffff;
      color: #111111;
      font-size: 13px;
      line-height: 1;
      transition: transform 0.2s ease, background-color 0.2s ease;
    }

    .connectivity-notice__button:hover {
      transform: translateY(-1px);
    }

    .connectivity-notice__button--primary {
      background: #111111;
      border-color: #111111;
      color: #ffffff;
    }

    @media (max-width: 640px) {
      .connectivity-notice {
        right: 16px;
        bottom: 16px;
        width: calc(100vw - 24px);
        padding: 14px;
      }

      .connectivity-notice__actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }

      .connectivity-notice__button {
        width: 100%;
        justify-content: center;
      }
    }
  `;

  document.head.appendChild(style);
}

function getOrCreateConnectivityNotice() {
  ensureConnectivityNoticeStyles();

  let notice = document.getElementById("connectivityNotice");
  if (notice) return notice;

  notice = document.createElement("aside");
  notice.id = "connectivityNotice";
  notice.className = "connectivity-notice is-hidden";
  notice.setAttribute("aria-live", "polite");
  notice.innerHTML = `
    <p id="connectivityNoticeTitle" class="connectivity-notice__title"></p>
    <p id="connectivityNoticeBody" class="connectivity-notice__body"></p>
    <div class="connectivity-notice__actions">
      <button
        id="connectivityNoticeReloadButton"
        type="button"
        class="connectivity-notice__button connectivity-notice__button--primary"
      >
        새로고침
      </button>
      <button
        id="connectivityNoticeCloseButton"
        type="button"
        class="connectivity-notice__button"
      >
        닫기
      </button>
    </div>
  `;

  document.body.appendChild(notice);

  document.getElementById("connectivityNoticeReloadButton")?.addEventListener("click", () => {
    window.location.reload();
  });

  document.getElementById("connectivityNoticeCloseButton")?.addEventListener("click", () => {
    hideConnectivityNotice();
  });

  return notice;
}

function showConnectivityNotice({
  title = "연결 상태 안내",
  message = "서버와 통신 상태를 확인해주세요.",
  tone = "error"
} = {}) {
  const notice = getOrCreateConnectivityNotice();
  const titleElement = document.getElementById("connectivityNoticeTitle");
  const bodyElement = document.getElementById("connectivityNoticeBody");
  if (!notice || !titleElement || !bodyElement) return;

  titleElement.textContent = title;
  bodyElement.textContent = message;
  notice.classList.remove("is-hidden", "is-error", "is-success");
  notice.classList.add(tone === "success" ? "is-success" : "is-error");
  state.connectivity.noticeVisible = true;
}

function hideConnectivityNotice() {
  const notice = document.getElementById("connectivityNotice");
  if (!notice) return;

  notice.classList.add("is-hidden");
  notice.classList.remove("is-error", "is-success");
  state.connectivity.noticeVisible = false;
}

function notifyRecoverableRequestIssue(error, actionLabel = "서버 통신") {
  if (!isRecoverableRequestError(error)) return false;

  const status = getRequestErrorStatus(error);
  const fingerprint = `${actionLabel}::${status}::${String(error?.message || "")}`;
  if (state.connectivity.lastFingerprint !== fingerprint) {
    showGlobalError(getRecoverableRequestMessage(error, actionLabel));
    state.connectivity.lastFingerprint = fingerprint;
  }

  showConnectivityNotice({
    title: navigator.onLine === false ? "오프라인 상태입니다." : "서버 통신이 잠시 불안정합니다.",
    message: getRecoverableRequestMessage(error, actionLabel),
    tone: "error"
  });

  return true;
}

function initializeConnectivityHints() {
  if (state.connectivity.bound) return;
  state.connectivity.bound = true;

  ensureConnectivityNoticeStyles();

  window.addEventListener("offline", () => {
    showGlobalError("인터넷 연결이 끊겼습니다.");
    showConnectivityNotice({
      title: "오프라인 상태입니다.",
      message: "인터넷 연결이 끊어져 서버와 통신할 수 없습니다. 연결이 복구되면 새로고침해주세요.",
      tone: "error"
    });
  });

  window.addEventListener("online", () => {
    state.connectivity.lastFingerprint = "";
    showGlobalSuccess("인터넷 연결이 복구되었습니다.");
    showConnectivityNotice({
      title: "연결이 복구되었습니다.",
      message: "이제 다시 시도할 수 있습니다. 이전 요청이 실패했다면 새로고침 후 다시 진행해주세요.",
      tone: "success"
    });
    window.setTimeout(() => {
      hideConnectivityNotice();
    }, 3200);
  });
}

/* =========================================================
   common init / helpers
========================================================= */
function initializeHomePage() {
  bindHomeScrollButtons();
  bindHomeActiveState();
  applyHeroImage();
  applyHeroLogoText();
  renderRecentLetter();
}

function initializeBoardPage() {
  state.boardPage = 1;
  state.boardMode = "list";
  applyStaticPageHeaderContrast();
  bindBoardEvents();
  renderBoardList();
  updateBoardAdminVisibility();
  showBoardListView({ skipScroll: true });
  handleBoardInitialRoute();
  window.addEventListener("focus", handleBoardWindowFocus);
}

function initializeAdminPage() {
  applyStaticPageHeaderContrast();
  injectAdminPostViewer();
  bindAdminEvents();
  renderHeroAdmin();
  renderAdminDashboard();
}

function getLettersSorted() {
  return [...state.letters].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getLatestLetter() {
  return getLettersSorted()[0] || null;
}

function getLetterById(letterId) {
  return getLettersSorted().find((item) => item.id === letterId) || null;
}

function getSelectedLetter() {
  return state.selectedLetterId ? getLetterById(state.selectedLetterId) : null;
}

function getCurrentHeroImage() {
  return state.settings.heroImageUrl || DEFAULT_HERO_IMAGE;
}

function getCurrentHeroLogoText() {
  return resolveHeroLogoText(state.settings.heroLogoText);
}

function getCurrentHeroLogoSize() {
  return resolveHeroLogoSize(state.settings.heroLogoSize);
}

function getCurrentHeroLogoPosition() {
  return resolveHeroLogoPosition(state.settings.heroLogoPosition);
}

function applyHeroImage() {
  const heroImage = document.getElementById("heroImage");
  if (!heroImage) return;
  heroImage.src = getCurrentHeroImage();
}

function applyHeroPresentation({
  container,
  textElement,
  text,
  sizePercent,
  position
}) {
  if (!container || !textElement) return;

  const resolvedPosition = resolveHeroLogoPosition(position);
  clearHeroPositionClasses(container);
  container.classList.add(getHeroPositionClassName(resolvedPosition));
  container.dataset.heroPosition = resolvedPosition;
  container.style.setProperty("--hero-logo-scale", String(resolveHeroLogoSize(sizePercent) / 100));
  textElement.textContent = resolveHeroLogoText(text);
}

function applyHeroLogoText() {
  const heroContent = document.querySelector(".hero-section__content");
  const heroLogoText = document.getElementById("heroLogoText");
  if (!heroContent || !heroLogoText) return;

  applyHeroPresentation({
    container: heroContent,
    textElement: heroLogoText,
    text: getCurrentHeroLogoText(),
    sizePercent: getCurrentHeroLogoSize(),
    position: getCurrentHeroLogoPosition()
  });
}

function applyStaticPageHeaderContrast() {
  const header = document.querySelector(".site-header");
  const hero = document.querySelector(".sub-hero");
  const nextSection = document.querySelector(".board-shell, .admin-shell");
  if (!header || !hero || !nextSection) return;

  const updateHeader = () => {
    const nextSectionRect = nextSection.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const shouldUseContrast = nextSectionRect.top <= headerRect.bottom;
    header.classList.toggle("site-header--contrast", shouldUseContrast);
  };

  window.addEventListener("scroll", updateHeader, { passive: true });
  window.addEventListener("resize", updateHeader);
  updateHeader();
}

function bindHashNavigation() {
  if (document.body.dataset.page !== "home") return;
  if (window.location.hash !== "#recent") return;

  const handleRecentHashNavigation = () => {
    document.getElementById("recent")?.scrollIntoView({ behavior: "smooth", block: "start" });

    const hasCrossPageRecentIntent = consumeHomeRecentNavigationIntent();
    if (hasCrossPageRecentIntent) {
      const maxAttempts = 12;
      let attempts = 0;

      const tryAutoplay = () => {
        attempts += 1;
        const visibleRatio = getHomeRecentVisibleRatio?.() || 0;
        const isRecentVisible = visibleRatio >= 0.45;

        if (isRecentVisible) {
          requestHomeRecentAutoplayFromGesture?.("cross-page-recent-link");
          return;
        }

        if (attempts < maxAttempts) {
          window.setTimeout(tryAutoplay, 120);
        }
      };

      window.setTimeout(tryAutoplay, 120);
    }
  };

  if (document.readyState === "complete") {
    handleRecentHashNavigation();
    return;
  }

  window.addEventListener("load", handleRecentHashNavigation, { once: true });
}

function markHomeRecentNavigationIntent() {
  try {
    sessionStorage.setItem(HOME_RECENT_NAV_INTENT_KEY, "1");
  } catch (_error) {
    // noop
  }
}

function consumeHomeRecentNavigationIntent() {
  try {
    const hasIntent = sessionStorage.getItem(HOME_RECENT_NAV_INTENT_KEY) === "1";
    if (!hasIntent) return false;
    sessionStorage.removeItem(HOME_RECENT_NAV_INTENT_KEY);
    return true;
  } catch (_error) {
    return false;
  }
}

function bindHomeRecentNavigationIntentCapture() {
  document.querySelectorAll('a[href*="index.html#recent"], a[href="#recent"]').forEach((link) => {
    link.addEventListener("click", () => {
      markHomeRecentNavigationIntent();
    });
  });
}

/* =========================================================
   util
========================================================= */
function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function formatDateTime(dateValue) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}.${month}.${day} ${hours}:${minutes}`;
}

function truncateText(text = "", maxLength = 160) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeHtmlForTextarea(text = "") {
  return escapeHtml(text);
}

function escapeHtmlForAttribute(text = "") {
  return escapeHtml(text);
}

function openImageBlockTypeMenu() {
  const menu = document.getElementById("imageBlockTypeMenu");
  if (!menu) return;
  menu.classList.remove("is-hidden");
  menu.setAttribute("aria-hidden", "false");
}

function closeImageBlockTypeMenu() {
  const menu = document.getElementById("imageBlockTypeMenu");
  if (!menu) return;
  menu.classList.add("is-hidden");
  menu.setAttribute("aria-hidden", "true");
}

function toggleImageBlockTypeMenu(event) {
  event?.stopPropagation();
  const menu = document.getElementById("imageBlockTypeMenu");
  if (!menu) return;

  if (menu.classList.contains("is-hidden")) {
    openImageBlockTypeMenu();
  } else {
    closeImageBlockTypeMenu();
  }
}

function handleImageBlockMenuOutsideClick(event) {
  const picker = event.target.closest(".block-type-picker");
  if (picker) return;
  closeImageBlockTypeMenu();
}

document.addEventListener("DOMContentLoaded", async () => {
  const page = document.body.dataset.page;

  initializeConnectivityHints();
  bindHomeRecentNavigationIntentCapture();
  hydrateHeroSettingsFromCache();
  applyCachedHeroPresentationEarly(page);

  try {
    const canContinue = await initializeAuthFlow(page);
    if (!canContinue) return;

    await bootstrapApp(page);
  } catch (error) {
    console.error(error);
    notifyRecoverableRequestIssue(error, "초기 데이터 불러오기");
    showGlobalError(error?.message || "데이터를 불러오는 중 오류가 발생했습니다.");
  }
});