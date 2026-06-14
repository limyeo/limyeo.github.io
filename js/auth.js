/* =========================================================
   auth
========================================================= */
const SESSION_DURATION_MS = 60 * 60 * 1000;
const SESSION_WARNING_MS = 5 * 60 * 1000;
const ADMIN_SESSION_EXPIRES_AT_KEY = "adminSessionExpiresAt";
const ADMIN_SESSION_WARNING_FOR_KEY = "adminSessionWarningFor";

let sessionCountdownTimer = null;
let hasSessionStorageListener = false;
let isAutoLogoutInProgress = false;

async function initializeAuthFlow(page) {
  injectSessionExpiryModal();
  bindSessionExpiryModalEvents();
  startSessionCountdownLoop();
  bindAdminEntryButtons();

  if (page === "admin") return true;

  injectAuthModal();
  bindAuthModalEvents();
  autoOpenAdminLoginIfRequested();
  return true;
}

async function refreshAuthState(options = {}) {
  const { keepPreviousOnRecoverableError = true, silent = false } = options;
  const previousIsAdmin = Boolean(state.isAdmin);

  try {
    const user = await getAuthenticatedUser({ throwOnError: true });

    if (!user?.id) {
      state.isAdmin = false;
      syncAdminSessionState();
      return false;
    }

    state.isAdmin = await checkIsAdmin(user, {
      fallbackValue: keepPreviousOnRecoverableError ? previousIsAdmin : false,
      silent
    });

    syncAdminSessionState();
    return state.isAdmin;
  } catch (error) {
    if (keepPreviousOnRecoverableError && isRecoverableRequestError?.(error)) {
      state.isAdmin = previousIsAdmin;
      syncAdminSessionState();
      if (!silent) {
        notifyRecoverableRequestIssue?.(error, "관리자 인증 확인");
      }
      return state.isAdmin;
    }

    state.isAdmin = false;
    syncAdminSessionState();
    if (!silent) {
      notifyRecoverableRequestIssue?.(error, "관리자 인증 확인");
    }
    return false;
  }
}

async function getAuthenticatedUser(options = {}) {
  const { throwOnError = false } = options;
  if (!supabaseClient) return null;

  const { data, error } = await supabaseClient.auth.getUser();
  if (error) {
    if (throwOnError) throw error;
    return null;
  }

  return data?.user || null;
}

async function checkIsAdmin(user, options = {}) {
  const { fallbackValue = false, silent = false } = options;
  if (!user?.id || !supabaseClient) return false;

  const { data, error } = await supabaseClient
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("관리자 조회 실패:", error.message);

    if (isRecoverableRequestError?.(error)) {
      if (!silent) {
        notifyRecoverableRequestIssue?.(error, "관리자 권한 조회");
      }
      return Boolean(fallbackValue);
    }

    return false;
  }

  return Boolean(data?.user_id);
}

function injectAuthModal() {
  if (document.getElementById("authModal")) return;

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div id="authModal" class="auth-modal is-hidden" aria-hidden="true">
        <button type="button" class="auth-modal__backdrop" data-close-auth-modal aria-label="닫기"></button>

        <div class="auth-modal__panel" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">
          <button type="button" class="auth-modal__close" data-close-auth-modal aria-label="닫기">×</button>

          <div class="auth-modal__content">
            <p class="section-label">admin access</p>
            <h2 id="authModalTitle" class="auth-modal__title">관리자 로그인</h2>
            <p class="auth-modal__desc">이메일/비밀번호 계정으로 로그인합니다.</p>

            <form id="authLoginForm" class="admin-form">
              <label class="admin-field">
                <span class="admin-field__label">이메일</span>
                <input id="authEmailInput" class="admin-input" type="email" placeholder="admin@email.com" required />
              </label>

              <label class="admin-field">
                <span class="admin-field__label">비밀번호</span>
                <input id="authPasswordInput" class="admin-input" type="password" placeholder="비밀번호" required />
              </label>

              <p id="authStatus" class="auth-status" aria-live="polite"></p>

              <div class="admin-actions">
                <button id="authSubmitButton" type="submit" class="solid-button">login</button>
                <button type="button" class="outline-button" data-close-auth-modal>cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `
  );
}

function injectSessionExpiryModal() {
  if (document.getElementById("sessionExpiryModal")) return;

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div id="sessionExpiryModal" class="session-expiry-modal is-hidden" aria-hidden="true">
        <button type="button" class="session-expiry-modal__backdrop" data-session-modal-cancel aria-label="닫기"></button>

        <div class="session-expiry-modal__panel" role="dialog" aria-modal="true" aria-labelledby="sessionExpiryTitle">
          <div class="session-expiry-modal__content">
            <h2 id="sessionExpiryTitle" class="session-expiry-modal__title">세션 만료 안내</h2>
            <p class="session-expiry-modal__desc">보안을 위해 5분 후 자동 로그아웃됩니다. 계속 이용하시려면 연장 버튼을 눌러 주세요.</p>

            <div class="session-expiry-modal__actions">
              <button type="button" class="solid-button" data-session-modal-extend>연장</button>
              <button type="button" class="outline-button" data-session-modal-cancel>취소</button>
            </div>
          </div>
        </div>
      </div>
    `
  );
}

function bindSessionExpiryModalEvents() {
  if (bindSessionExpiryModalEvents._bound) return;
  bindSessionExpiryModalEvents._bound = true;

  document.querySelectorAll("[data-session-modal-cancel]").forEach((button) => {
    button.addEventListener("click", hideSessionExpiryModal);
  });

  document.querySelectorAll("[data-session-modal-extend]").forEach((button) => {
    button.addEventListener("click", () => {
      extendAdminSession();
      hideSessionExpiryModal();
    });
  });
}

function bindAdminEntryButtons() {
  document.querySelectorAll("[data-admin-entry]").forEach((button) => {
    if (button.dataset.menuBound === "true") return;
    button.dataset.menuBound = "true";

    const wrapper = document.createElement("div");
    wrapper.className = "site-nav__admin-menu";

    const menu = document.createElement("div");
    menu.className = "admin-entry-menu";
    menu.setAttribute("aria-hidden", "true");
    menu.innerHTML = `
      <div class="admin-entry-menu__timer-row" data-auth-only>
        <p class="admin-entry-menu__timer">
          <span class="admin-entry-menu__timer-label">로그인 세션 만료까지</span>
          <strong data-session-countdown>로그인 필요</strong>
        </p>
        <button type="button" class="admin-entry-menu__timer-extend" data-session-extend-action>연장</button>
      </div>
      <button type="button" class="admin-entry-menu__button" data-login-action>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M13.2 4.3a1 1 0 0 1 1 1v1.2h3.6a1.9 1.9 0 0 1 1.9 1.9v9.2a1.9 1.9 0 0 1-1.9 1.9h-3.6v1.2a1 1 0 1 1-2 0v-2.2a1 1 0 0 1 1-1h4.6V8.4h-4.6a1 1 0 0 1-1-1V5.3a1 1 0 0 1 1-1m-4.8 4.3a1 1 0 0 1 1.4 0 1 1 0 0 1 0 1.4L8.3 11.5h7.5a1 1 0 1 1 0 2H8.3l1.5 1.5a1 1 0 1 1-1.4 1.4l-3.2-3.2a1 1 0 0 1 0-1.4z"/>
        </svg>
        <span>로그인</span>
      </button>
      <button type="button" class="admin-entry-menu__button" data-admin-settings-action>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M19.4 13a7.7 7.7 0 0 0 0-2l2-1.6a.5.5 0 0 0 .1-.6l-1.9-3.3a.5.5 0 0 0-.6-.2l-2.4 1a8 8 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.4h-3.8a.5.5 0 0 0-.5.4l-.4 2.6c-.6.2-1.2.6-1.7 1l-2.4-1a.5.5 0 0 0-.6.2L2.5 8.8a.5.5 0 0 0 .1.6l2 1.6a7.7 7.7 0 0 0 0 2l-2 1.6a.5.5 0 0 0-.1.6l1.9 3.3a.5.5 0 0 0 .6.2l2.4-1c.5.4 1.1.8 1.7 1l.4 2.6a.5.5 0 0 0 .5.4h3.8a.5.5 0 0 0 .5-.4l.4-2.6c.6-.2 1.2-.6 1.7-1l2.4 1a.5.5 0 0 0 .6-.2l1.9-3.3a.5.5 0 0 0-.1-.6zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z"/>
        </svg>
        <span>설정</span>
      </button>
      <button type="button" class="admin-entry-menu__button" data-logout-action data-auth-only>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M10.8 3.3a1 1 0 0 1 1 1v2.2a1 1 0 1 1-2 0V5.3H6.2a1.9 1.9 0 0 0-1.9 1.9v9.6a1.9 1.9 0 0 0 1.9 1.9h3.6v-1.2a1 1 0 1 1 2 0v2.2a1 1 0 0 1-1 1H6.2a3.9 3.9 0 0 1-3.9-3.9V7.2a3.9 3.9 0 0 1 3.9-3.9zm6.8 4.4a1 1 0 0 1 1.4 0l3.3 3.3a1 1 0 0 1 0 1.4L19 15.7a1 1 0 0 1-1.4-1.4l1.6-1.6h-7a1 1 0 0 1 0-2h7l-1.6-1.6a1 1 0 0 1 0-1.4"/>
        </svg>
        <span>로그아웃</span>
      </button>
    `;

    button.parentNode?.insertBefore(wrapper, button);
    wrapper.append(button, menu);

    button.setAttribute("aria-haspopup", "true");
    button.setAttribute("aria-expanded", "false");

    const openMenu = () => {
      wrapper.classList.add("is-open");
      menu.setAttribute("aria-hidden", "false");
      button.setAttribute("aria-expanded", "true");
    };

    const closeMenu = () => {
      wrapper.classList.remove("is-open");
      menu.setAttribute("aria-hidden", "true");
      button.setAttribute("aria-expanded", "false");
    };

    wrapper.addEventListener("mouseenter", openMenu);
    wrapper.addEventListener("mouseleave", closeMenu);
    wrapper.addEventListener("focusin", openMenu);
    wrapper.addEventListener("focusout", (event) => {
      if (wrapper.contains(event.relatedTarget)) return;
      closeMenu();
    });

    button.addEventListener("click", (event) => {
      event.preventDefault();
    });

    menu.querySelector("[data-admin-settings-action]")?.addEventListener("click", handleSettingsEntryFromMenu);
    menu.querySelector("[data-login-action]")?.addEventListener("click", handleSettingsEntryFromMenu);
    menu.querySelector("[data-session-extend-action]")?.addEventListener("click", () => extendAdminSession(true));
    menu.querySelector("[data-logout-action]")?.addEventListener("click", () => handleLogout({ reason: "loggedOut" }));

    updateAdminEntryMenus();
  });
}

function bindAuthModalEvents() {
  const form = document.getElementById("authLoginForm");
  if (!form) return;

  form.addEventListener("submit", handleAdminLoginSubmit);

  document.querySelectorAll("[data-close-auth-modal]").forEach((button) => {
    button.addEventListener("click", closeAuthModal);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAuthModal();
      hideSessionExpiryModal();
    }
  });
}

function openAuthModal() {
  const modal = document.getElementById("authModal");
  if (!modal) return;

  modal.classList.remove("is-hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setAuthStatus("");
  document.getElementById("authEmailInput")?.focus();
}

function closeAuthModal() {
  const modal = document.getElementById("authModal");
  if (!modal) return;

  modal.classList.add("is-hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  setAuthStatus("");
}

function openSessionExpiryModal() {
  const modal = document.getElementById("sessionExpiryModal");
  if (!modal) return;

  modal.classList.remove("is-hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function hideSessionExpiryModal() {
  const modal = document.getElementById("sessionExpiryModal");
  if (!modal) return;

  modal.classList.add("is-hidden");
  modal.setAttribute("aria-hidden", "true");

  const authModal = document.getElementById("authModal");
  const authModalVisible = Boolean(authModal && !authModal.classList.contains("is-hidden"));
  if (!authModalVisible) {
    document.body.classList.remove("modal-open");
  }
}

function setAuthStatus(message, type = "") {
  const status = document.getElementById("authStatus");
  if (!status) return;

  status.textContent = message || "";
  status.classList.remove("is-error", "is-success");
  if (type) status.classList.add(type);
}

function setAuthSubmitting(isSubmitting) {
  const submitButton = document.getElementById("authSubmitButton");
  const emailInput = document.getElementById("authEmailInput");
  const passwordInput = document.getElementById("authPasswordInput");

  if (submitButton) {
    submitButton.disabled = isSubmitting;
    submitButton.textContent = isSubmitting ? "logging in..." : "login";
  }

  if (emailInput) emailInput.disabled = isSubmitting;
  if (passwordInput) passwordInput.disabled = isSubmitting;
}

function setLogoutSubmitting(isSubmitting) {
  const buttons = [...document.querySelectorAll("[data-logout-action]")].filter(Boolean);

  buttons.forEach((button) => {
    const defaultText = button.dataset.defaultText || button.textContent.trim();
    button.dataset.defaultText = defaultText;
    button.disabled = isSubmitting;
    button.textContent = isSubmitting ? "logging out..." : defaultText;
  });
}

async function handleAdminLoginSubmit(event) {
  event.preventDefault();

  if (!supabaseClient) {
    setAuthStatus("Supabase 설정이 비어 있습니다.", "is-error");
    return;
  }

  const email = document.getElementById("authEmailInput")?.value.trim() || "";
  const password = document.getElementById("authPasswordInput")?.value || "";

  if (!email || !password) {
    setAuthStatus("이메일과 비밀번호를 모두 입력해주세요.", "is-error");
    return;
  }

  try {
    setAuthSubmitting(true);
    setAuthStatus("로그인 중입니다...");

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthStatus(error.message, "is-error");
      return;
    }

    const user = data?.user || (await getAuthenticatedUser());
    const isAdmin = await checkIsAdmin(user);

    if (!isAdmin) {
      await supabaseClient.auth.signOut();
      setAuthStatus("관리자 권한이 없는 계정입니다.", "is-error");
      return;
    }

    state.isAdmin = true;
    extendAdminSession(true);
    setAuthStatus("로그인 성공. 관리자 페이지로 이동합니다.", "is-success");
    window.location.href = "admin.html";
  } catch (error) {
    console.error(error);
    setAuthStatus("로그인 처리 중 오류가 발생했습니다.", "is-error");
  } finally {
    setAuthSubmitting(false);
  }
}

async function handleSettingsEntryFromMenu() {
  const isAdmin = await refreshAuthState({ keepPreviousOnRecoverableError: true, silent: false });

  if (isAdmin) {
    window.location.href = "admin.html";
    return;
  }

  openAuthModal();
}

async function handleLogout(options = {}) {
  const { reason = "loggedOut" } = options;

  if (!supabaseClient) {
    alert("Supabase 설정이 비어 있습니다.");
    return;
  }

  try {
    setLogoutSubmitting(true);

    const { error } = await supabaseClient.auth.signOut({ scope: "global" });
    if (error) throw error;

    const cleanKeys = Object.keys(localStorage).filter(
      (key) => key.startsWith("sb-") || key.includes("supabase")
    );
    cleanKeys.forEach((key) => localStorage.removeItem(key));
    clearAdminSessionTimer();
    sessionStorage.clear();

    const isAdminPage = document.body?.dataset?.page === "admin" || window.location.pathname.endsWith("/admin.html") || window.location.pathname.endsWith("admin.html");

    if (reason === "sessionExpired" && isAdminPage) {
      window.location.replace("index.html");
      return;
    }

    const params = new URLSearchParams({ adminLogin: "1" });
    if (reason === "sessionExpired") {
      params.set("sessionExpired", "1");
    } else {
      params.set("loggedOut", "1");
    }

    window.location.replace(`index.html?${params.toString()}`);
  } catch (error) {
    console.error("로그아웃 실패:", error);
    alert(error?.message || "로그아웃 중 오류가 발생했습니다.");
  } finally {
    setLogoutSubmitting(false);
  }
}

function autoOpenAdminLoginIfRequested() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("adminLogin") !== "1") return;

  openAuthModal();

  if (params.get("sessionExpired") === "1") {
    setAuthStatus("세션이 만료되어 자동 로그아웃되었습니다. 다시 로그인해주세요.", "is-error");
  } else if (params.get("loggedOut") === "1") {
    setAuthStatus("로그아웃되었습니다. 다시 로그인해주세요.", "is-success");
  }

  const cleanUrl = `${window.location.pathname}${window.location.hash}`;
  window.history.replaceState({}, "", cleanUrl);
}

async function ensureAdminAccess(actionLabel = "이 기능") {
  const isAdmin = await refreshAuthState();

  if (isAdmin) {
    updateBoardAdminVisibility();
    return true;
  }

  updateBoardAdminVisibility();
  alert(`${actionLabel}은(는) 관리자 로그인 후 이용할 수 있습니다.`);
  openAuthModal();
  return false;
}

function syncAdminSessionState() {
  if (state.isAdmin) {
    if (hasAdminSessionExpired()) {
      triggerSessionExpiredLogout();
      return;
    }
    ensureAdminSessionExpiry();
  } else {
    clearAdminSessionTimer();
    hideSessionExpiryModal();
  }

  updateSessionCountdownText();
}

function ensureAdminSessionExpiry() {
  const expiresAt = readAdminSessionExpiryAt();
  if (Number.isFinite(expiresAt) && expiresAt > Date.now()) return;
  extendAdminSession(true);
}

function extendAdminSession(resetWarning = false) {
  const nextExpiresAt = Date.now() + SESSION_DURATION_MS;
  localStorage.setItem(ADMIN_SESSION_EXPIRES_AT_KEY, String(nextExpiresAt));

  if (resetWarning) {
    localStorage.removeItem(ADMIN_SESSION_WARNING_FOR_KEY);
  }

  updateSessionCountdownText();
}

function clearAdminSessionTimer() {
  localStorage.removeItem(ADMIN_SESSION_EXPIRES_AT_KEY);
  localStorage.removeItem(ADMIN_SESSION_WARNING_FOR_KEY);
}

function readAdminSessionExpiryAt() {
  const raw = localStorage.getItem(ADMIN_SESSION_EXPIRES_AT_KEY);
  if (!raw) return null;

  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return value;
}

function hasAdminSessionExpired() {
  const expiresAt = readAdminSessionExpiryAt();
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

function triggerSessionExpiredLogout() {
  if (isAutoLogoutInProgress) return;
  isAutoLogoutInProgress = true;
  hideSessionExpiryModal();
  handleLogout({ reason: "sessionExpired" }).finally(() => {
    isAutoLogoutInProgress = false;
  });
}

function formatRemainingTime(milliseconds) {
  const safeMs = Math.max(0, milliseconds);
  const totalSeconds = safeMs > 0 ? Math.floor((safeMs - 1) / 1000) : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const timeLabel = `${String(minutes).padStart(2, "0")}분 ${String(seconds).padStart(2, "0")}초`;
  return hours > 0 ? `${hours}시간 ${timeLabel}` : timeLabel;
}

function updateSessionCountdownText() {
  const countdownNodes = document.querySelectorAll("[data-session-countdown]");
  if (!countdownNodes.length) {
    updateAdminEntryMenus();
    return;
  }

  if (!state.isAdmin) {
    countdownNodes.forEach((node) => {
      node.textContent = "로그인 필요";
    });
    return;
  }

  const expiresAt = readAdminSessionExpiryAt();
  const remaining = Number.isFinite(expiresAt) ? expiresAt - Date.now() : 0;
  const label = formatRemainingTime(remaining);

  countdownNodes.forEach((node) => {
    node.textContent = label;
  });

  updateAdminEntryMenus();
}

function updateAdminEntryMenus() {
  document.querySelectorAll(".admin-entry-menu").forEach((menu) => {
    const authOnlyElements = menu.querySelectorAll("[data-auth-only]");
    const loginButton = menu.querySelector("[data-login-action]");
    const settingsButton = menu.querySelector("[data-admin-settings-action]");

    authOnlyElements.forEach((element) => {
      element.classList.toggle("is-hidden", !state.isAdmin);
    });

    if (loginButton) loginButton.classList.toggle("is-hidden", state.isAdmin);
    if (settingsButton) settingsButton.classList.toggle("is-hidden", !state.isAdmin);
  });
}

function startSessionCountdownLoop() {
  if (sessionCountdownTimer) return;

  updateSessionCountdownText();
  sessionCountdownTimer = window.setInterval(runSessionCountdownTick, 1000);

  if (!hasSessionStorageListener) {
    hasSessionStorageListener = true;
    window.addEventListener("storage", (event) => {
      if (![ADMIN_SESSION_EXPIRES_AT_KEY, ADMIN_SESSION_WARNING_FOR_KEY].includes(event.key)) return;
      runSessionCountdownTick();
    });
  }
}

function runSessionCountdownTick() {
  if (!state.isAdmin || isAutoLogoutInProgress) {
    updateSessionCountdownText();
    return;
  }

  const expiresAt = readAdminSessionExpiryAt();
  if (!Number.isFinite(expiresAt)) {
    triggerSessionExpiredLogout();
    return;
  }

  const remaining = expiresAt - Date.now();
  updateSessionCountdownText();

  if (remaining <= 0) {
    triggerSessionExpiredLogout();
    return;
  }

  const warnedFor = Number(localStorage.getItem(ADMIN_SESSION_WARNING_FOR_KEY) || 0);
  if (remaining <= SESSION_WARNING_MS && warnedFor !== expiresAt) {
    localStorage.setItem(ADMIN_SESSION_WARNING_FOR_KEY, String(expiresAt));
    openSessionExpiryModal();
  }
}