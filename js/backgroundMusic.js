/* =========================================================
   board post music only
   - 전역 플로팅 배경음악 제거
   - 게시글 상세 헤더 우측 미니 플레이어만 사용
   - recent 영역에도 동일한 미니 플레이어 지원
   - YouTube URL 방식 제거 / Supabase Storage 오디오 파일 재생
========================================================= */
const MINI_PLAYER_ICONS = {
  play: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6.8v10.4c0 .8.86 1.3 1.56.9l8.06-5.2a1.05 1.05 0 0 0 0-1.8L9.56 5.9A1.04 1.04 0 0 0 8 6.8Z" fill="currentColor" />
    </svg>
  `,
  pause: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6.5h2.8c.39 0 .7.31.7.7v9.6c0 .39-.31.7-.7.7H8.7a.7.7 0 0 1-.7-.7V7.2c0-.39.31-.7.7-.7Zm5.2 0H16c.39 0 .7.31.7.7v9.6c0 .39-.31.7-.7.7h-2.1a.7.7 0 0 1-.7-.7V7.2c0-.39.31-.7.7-.7Z" fill="currentColor" />
    </svg>
  `,
  volumeOn: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 10.2h3.42l4.62-3.7a.85.85 0 0 1 1.38.67v9.62a.85.85 0 0 1-1.38.67l-4.62-3.7H4.5a.9.9 0 0 1-.9-.9v-1.76c0-.5.4-.9.9-.9Z" fill="currentColor" />
      <path d="M16.7 9.2a4.55 4.55 0 0 1 0 5.6M18.95 6.9a7.7 7.7 0 0 1 0 10.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>
  `,
  volumeOff: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 10.2h3.42l4.62-3.7a.85.85 0 0 1 1.38.67v9.62a.85.85 0 0 1-1.38.67l-4.62-3.7H4.5a.9.9 0 0 1-.9-.9v-1.76c0-.5.4-.9.9-.9Z" fill="currentColor" />
      <path d="m17.2 9.4 4.1 4.1m0-4.1-4.1 4.1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>
  `
};

function normalizeInlineVolume(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 40;
  return Math.min(Math.max(Math.round(numeric), 0), 100);
}

function rememberLastNonZeroVolume(store, volume) {
  const normalized = normalizeInlineVolume(volume);
  if (normalized > 0) {
    store.lastNonZeroVolume = normalized;
  }
}

function getRestoreVolume(store) {
  const candidate = normalizeInlineVolume(store.lastNonZeroVolume || store.volume || 70);
  return candidate <= 0 ? 70 : candidate;
}

function initializeBackgroundMusicPlayer() {
  if (document.body.dataset.page === "board") {
    prepareBoardInlineMusicPlayer();
  }

  if (document.body.dataset.page === "home") {
    prepareHomeRecentMusicPlayer();
  }
}

function ensureBoardInlineMusicState() {
  state.bgMusic.currentPostId = String(state.bgMusic.currentPostId || "");
  state.bgMusic.currentUrl = String(state.bgMusic.currentUrl || "");
  state.bgMusic.volume = normalizeInlineVolume(state.bgMusic.volume);
  state.bgMusic.lastNonZeroVolume = normalizeInlineVolume(
    state.bgMusic.lastNonZeroVolume || state.bgMusic.volume || 70
  );
}

function getBoardInlineMusicElements() {
  ensureBoardInlineMusicState();

  return {
    root: document.getElementById("boardDetailMusicPlayer"),
    playButton: document.getElementById("boardDetailMusicPlayButton"),
    muteButton: document.getElementById("boardDetailMusicMuteButton"),
    volumeInput: document.getElementById("boardDetailMusicVolumeInput"),
    equalizer: document.getElementById("boardDetailMusicEq"),
    host: document.getElementById("boardDetailMusicEmbedHost")
  };
}

function ensureBoardInlineMusicVolumeUi() {
  const root = document.getElementById("boardDetailMusicPlayer");
  const muteButton = document.getElementById("boardDetailMusicMuteButton");
  const host = document.getElementById("boardDetailMusicEmbedHost");

  if (!root || !muteButton) return;
  if (document.getElementById("boardDetailMusicVolumeInput")) return;

  const control = document.createElement("div");
  control.className = "post-mini-player__volume-control";

  const panel = document.createElement("div");
  panel.className = "post-mini-player__volume-panel";

  const range = document.createElement("input");
  range.id = "boardDetailMusicVolumeInput";
  range.className = "post-mini-player__volume-range";
  range.type = "range";
  range.min = "0";
  range.max = "100";
  range.step = "1";
  range.value = String(normalizeInlineVolume(state.bgMusic.volume));
  range.setAttribute("aria-label", "볼륨 조절");
  range.setAttribute("title", "볼륨 조절");

  panel.appendChild(range);

  muteButton.insertAdjacentElement("beforebegin", control);
  control.appendChild(muteButton);
  control.appendChild(panel);

  if (host) {
    root.appendChild(host);
  }
}

function ensureBoardInlineAudioElement() {
  ensureBoardInlineMusicState();
  const { host } = getBoardInlineMusicElements();
  if (!host) return null;

  if (state.bgMusic.audio instanceof Audio) {
    if (!host.contains(state.bgMusic.audio)) {
      host.innerHTML = "";
      host.appendChild(state.bgMusic.audio);
    }
    return state.bgMusic.audio;
  }

  const audio = document.createElement("audio");
  audio.className = "post-mini-player__native-host";
  audio.preload = "auto";
  audio.loop = true;
  audio.playsInline = true;

  audio.addEventListener("play", () => {
    state.bgMusic.isPlaying = true;
    state.bgMusic.playerReady = true;
    updateBoardInlineMusicUi();
  });

  audio.addEventListener("pause", () => {
    state.bgMusic.isPlaying = false;
    updateBoardInlineMusicUi();
  });

  audio.addEventListener("loadeddata", () => {
    state.bgMusic.playerReady = true;
    updateBoardInlineMusicUi();
  });

  audio.addEventListener("volumechange", () => {
    const nextVolume = normalizeInlineVolume(audio.volume * 100);
    state.bgMusic.volume = nextVolume;
    state.bgMusic.isMuted = Boolean(audio.muted || nextVolume <= 0);
    if (!state.bgMusic.isMuted) rememberLastNonZeroVolume(state.bgMusic, nextVolume);
    updateBoardInlineMusicUi();
  });

  audio.addEventListener("ended", () => {
    state.bgMusic.isPlaying = false;
    updateBoardInlineMusicUi();
  });

  audio.addEventListener("error", () => {
    state.bgMusic.isPlaying = false;
    state.bgMusic.playerReady = false;
    updateBoardInlineMusicUi();
  });

  host.innerHTML = "";
  host.appendChild(audio);
  state.bgMusic.audio = audio;
  state.bgMusic.player = audio;
  return audio;
}

function bindBoardInlineMusicEvents() {
  if (bindBoardInlineMusicEvents._bound) return;
  bindBoardInlineMusicEvents._bound = true;

  document.getElementById("boardDetailMusicPlayButton")?.addEventListener("click", async () => {
    state.bgMusic.hasUserInteracted = true;

    const letter = getSelectedLetter?.();
    if (!hasLetterMusic(letter)) return;

    if (state.bgMusic.isPlaying) {
      pauseBoardInlineMusic();
      return;
    }

    await playBoardInlineMusic({
      url: getLetterMusicUrl(letter),
      unmute: !state.bgMusic.isMuted,
      forceLoad: true
    });
  });

  document.getElementById("boardDetailMusicMuteButton")?.addEventListener("click", async () => {
    state.bgMusic.hasUserInteracted = true;

    const letter = getSelectedLetter?.();
    if (!hasLetterMusic(letter)) return;

    if (state.bgMusic.isMuted) {
      await unmuteBoardInlineMusic();
      return;
    }

    muteBoardInlineMusic();
  });

  document.getElementById("boardDetailMusicVolumeInput")?.addEventListener("input", async (event) => {
    state.bgMusic.hasUserInteracted = true;
    await setBoardInlineMusicVolume(event.target.value);
  });
}

function syncBoardInlineVolumeInput() {
  const { volumeInput } = getBoardInlineMusicElements();
  if (!volumeInput) return;
  volumeInput.value = String(normalizeInlineVolume(state.bgMusic.volume));
}

function applyBoardInlinePlayerVolume(audio = state.bgMusic.audio) {
  if (!(audio instanceof Audio)) return;

  const normalizedVolume = normalizeInlineVolume(state.bgMusic.volume);
  audio.volume = normalizedVolume / 100;
  audio.muted = Boolean(state.bgMusic.isMuted || normalizedVolume <= 0);

  if (!audio.muted) {
    rememberLastNonZeroVolume(state.bgMusic, normalizedVolume);
    state.bgMusic.isMuted = false;
  } else {
    state.bgMusic.isMuted = true;
  }
}

async function setBoardInlineMusicVolume(nextVolume) {
  const normalizedVolume = normalizeInlineVolume(nextVolume);
  state.bgMusic.volume = normalizedVolume;

  if (normalizedVolume <= 0) {
    state.bgMusic.isMuted = true;
  } else {
    rememberLastNonZeroVolume(state.bgMusic, normalizedVolume);
    state.bgMusic.isMuted = false;
  }

  applyBoardInlinePlayerVolume();
  updateBoardInlineMusicUi();
}

function setBoardInlineMusicRootVisible(isVisible) {
  const { root } = getBoardInlineMusicElements();
  if (!root) return;
  root.classList.toggle("is-hidden", !isVisible);
}

function prepareBoardInlineMusicPlayer() {
  if (document.body.dataset.page !== "board") return;

  ensureBoardInlineMusicState();
  ensureBoardInlineMusicVolumeUi();
  ensureBoardInlineAudioElement();
  bindBoardInlineMusicEvents();
  updateBoardInlineMusicUi();
}

async function ensureBoardInlinePlayerReady(url) {
  const audio = ensureBoardInlineAudioElement();
  if (!(audio instanceof Audio)) return null;

  if (url && state.bgMusic.currentUrl !== url) {
    audio.src = url;
    audio.load();
    state.bgMusic.currentUrl = url;
    state.bgMusic.playerReady = false;
  }

  state.bgMusic.player = audio;
  return audio;
}

async function syncBoardDetailMusicForLetter(letter, options = {}) {
  const url = getLetterMusicUrl(letter);
  const shouldShow = Boolean(url);

  setBoardInlineMusicRootVisible(shouldShow);

  if (!shouldShow) {
    stopBoardInlineMusic();
    return;
  }

  state.bgMusic.currentPostId = letter.id || "";
  updateBoardInlineMusicUi();

  if (options.prewarm !== false) {
    const audio = await ensureBoardInlinePlayerReady(url);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      state.bgMusic.isPlaying = false;
      state.bgMusic.isMuted = true;
      applyBoardInlinePlayerVolume(audio);
      updateBoardInlineMusicUi();
    }
  }
}

async function playBoardDetailMusicByGesture(letter) {
  const url = getLetterMusicUrl(letter);
  if (!url) return;

  state.bgMusic.hasUserInteracted = true;
  setBoardInlineMusicRootVisible(true);

  const audio = await ensureBoardInlinePlayerReady(url);
  if (!(audio instanceof Audio)) return;

  state.bgMusic.currentUrl = url;
  state.bgMusic.currentPostId = letter?.id || "";

  if (normalizeInlineVolume(state.bgMusic.volume) <= 0) {
    state.bgMusic.volume = getRestoreVolume(state.bgMusic);
  }

  try {
    state.bgMusic.isMuted = false;
    applyBoardInlinePlayerVolume(audio);
    await audio.play();
    state.bgMusic.isPlaying = true;
    rememberLastNonZeroVolume(state.bgMusic, state.bgMusic.volume);
    updateBoardInlineMusicUi();
  } catch (_error) {
    state.bgMusic.isMuted = true;
    state.bgMusic.isPlaying = false;
    updateBoardInlineMusicUi();
    showGlobalMessage?.("브라우저 정책으로 자동 소리 재생이 막혔습니다. 우측 재생 버튼을 눌러주세요.", "error");
  }
}

async function playBoardInlineMusic({ url = "", unmute = false, forceLoad = false } = {}) {
  const selected = getSelectedLetter?.();
  const resolvedUrl = url || getLetterMusicUrl(selected);
  if (!resolvedUrl) return;

  const audio = await ensureBoardInlinePlayerReady(forceLoad ? resolvedUrl : resolvedUrl);
  if (!(audio instanceof Audio)) return;

  try {
    if (unmute) {
      if (normalizeInlineVolume(state.bgMusic.volume) <= 0) {
        state.bgMusic.volume = getRestoreVolume(state.bgMusic);
      }
      state.bgMusic.isMuted = false;
    } else {
      state.bgMusic.isMuted = true;
    }

    applyBoardInlinePlayerVolume(audio);
    await audio.play();
    state.bgMusic.isPlaying = true;
    state.bgMusic.currentUrl = resolvedUrl;
    state.bgMusic.currentPostId = selected?.id || state.bgMusic.currentPostId || "";
  } catch (_error) {
    console.warn("inline play failed:", _error);
  }

  updateBoardInlineMusicUi();
}

function pauseBoardInlineMusic() {
  const audio = state.bgMusic.audio;
  if (!(audio instanceof Audio)) return;

  audio.pause();
  state.bgMusic.isPlaying = false;
  updateBoardInlineMusicUi();
}

async function unmuteBoardInlineMusic() {
  const audio = state.bgMusic.audio;
  if (!(audio instanceof Audio)) return;

  if (normalizeInlineVolume(state.bgMusic.volume) <= 0) {
    state.bgMusic.volume = getRestoreVolume(state.bgMusic);
  }

  try {
    state.bgMusic.isMuted = false;
    applyBoardInlinePlayerVolume(audio);

    if (!state.bgMusic.isPlaying) {
      await audio.play();
      state.bgMusic.isPlaying = true;
    }
  } catch (_error) {
    console.warn("inline unmute failed:", _error);
  }

  updateBoardInlineMusicUi();
}

function muteBoardInlineMusic() {
  const audio = state.bgMusic.audio;
  if (!(audio instanceof Audio)) return;

  rememberLastNonZeroVolume(state.bgMusic, state.bgMusic.volume);
  audio.muted = true;
  state.bgMusic.isMuted = true;
  updateBoardInlineMusicUi();
}

function stopBoardInlineMusic() {
  const audio = state.bgMusic.audio;

  if (audio instanceof Audio) {
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch (_error) {
      /* noop */
    }
  }

  state.bgMusic.isPlaying = false;
  state.bgMusic.isMuted = true;
  state.bgMusic.currentPostId = "";
  updateBoardInlineMusicUi();
}

function destroyBoardInlineMusicPlayer(resetUrl = true) {
  const audio = state.bgMusic.audio;
  if (audio instanceof Audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    audio.remove();
  }

  state.bgMusic.audio = null;
  state.bgMusic.player = null;
  state.bgMusic.playerReady = false;
  state.bgMusic.isPlaying = false;
  state.bgMusic.isMuted = true;

  if (resetUrl) {
    state.bgMusic.currentUrl = "";
    state.bgMusic.currentPostId = "";
  }

  const { host } = getBoardInlineMusicElements();
  if (host) host.innerHTML = "";
  updateBoardInlineMusicUi();
}

function updateBoardInlineMusicUi() {
  const { root, playButton, muteButton, volumeInput, equalizer } = getBoardInlineMusicElements();
  const hasMusic = Boolean(state.bgMusic.currentPostId || state.bgMusic.currentUrl);
  const resolvedVolume = normalizeInlineVolume(state.bgMusic.volume);

  if (root) {
    root.classList.toggle("is-playing", state.bgMusic.isPlaying);
    root.classList.toggle("is-muted", state.bgMusic.isMuted || resolvedVolume <= 0);
  }

  if (playButton) {
    playButton.disabled = !hasMusic;
    playButton.innerHTML = state.bgMusic.isPlaying ? MINI_PLAYER_ICONS.pause : MINI_PLAYER_ICONS.play;
    playButton.setAttribute("aria-label", state.bgMusic.isPlaying ? "일시정지" : "재생");
    playButton.setAttribute("title", state.bgMusic.isPlaying ? "일시정지" : "재생");
  }

  if (muteButton) {
    const isSilent = state.bgMusic.isMuted || resolvedVolume <= 0;
    muteButton.disabled = !hasMusic;
    muteButton.innerHTML = isSilent ? MINI_PLAYER_ICONS.volumeOff : MINI_PLAYER_ICONS.volumeOn;
    muteButton.setAttribute("aria-label", isSilent ? "음소거 해제" : "음소거");
    muteButton.setAttribute("title", isSilent ? "음소거 해제" : "음소거");
  }

  if (volumeInput) {
    volumeInput.disabled = !hasMusic;
    volumeInput.value = String(resolvedVolume);
    volumeInput.setAttribute("aria-valuenow", String(resolvedVolume));
  }

  if (equalizer) {
    equalizer.classList.toggle("is-playing", state.bgMusic.isPlaying);
    equalizer.setAttribute("aria-hidden", hasMusic ? "false" : "true");
  }

  syncBoardInlineVolumeInput();
}

function ensureHomeRecentMusicState() {
  if (!state.bgMusic.homeRecent) {
    state.bgMusic.homeRecent = {
      audio: null,
      player: null,
      playerReady: false,
      currentUrl: "",
      currentPostId: "",
      isPlaying: false,
      isMuted: true,
      volume: 40,
      lastNonZeroVolume: 40,
      hasUserInteracted: false,
      userPaused: false,
      lastInteractionAt: 0,
      lastAutoPlayKey: "",
      lastVisibilityRatio: 0,
      pendingGestureAutoplay: false,
      hintVisible: false,
      hintText: "음악을 재생하려면 클릭하세요"
    };
  }

  state.bgMusic.homeRecent.currentPostId = String(state.bgMusic.homeRecent.currentPostId || "");
  state.bgMusic.homeRecent.currentUrl = String(state.bgMusic.homeRecent.currentUrl || "");
  state.bgMusic.homeRecent.volume = normalizeInlineVolume(state.bgMusic.homeRecent.volume);
  state.bgMusic.homeRecent.lastNonZeroVolume = normalizeInlineVolume(
    state.bgMusic.homeRecent.lastNonZeroVolume || state.bgMusic.homeRecent.volume || 70
  );
  state.bgMusic.homeRecent.userPaused = Boolean(state.bgMusic.homeRecent.userPaused);
  state.bgMusic.homeRecent.lastInteractionAt = Number(state.bgMusic.homeRecent.lastInteractionAt || 0);
  state.bgMusic.homeRecent.lastAutoPlayKey = String(state.bgMusic.homeRecent.lastAutoPlayKey || "");
  state.bgMusic.homeRecent.lastVisibilityRatio = Number(state.bgMusic.homeRecent.lastVisibilityRatio || 0);
  state.bgMusic.homeRecent.pendingGestureAutoplay = Boolean(
    state.bgMusic.homeRecent.pendingGestureAutoplay
  );
  state.bgMusic.homeRecent.hintVisible = Boolean(state.bgMusic.homeRecent.hintVisible);
  state.bgMusic.homeRecent.hintText = String(
    state.bgMusic.homeRecent.hintText || "음악을 재생하려면 클릭하세요"
  );

  return state.bgMusic.homeRecent;
}

function getHomeRecentMusicElements() {
  ensureHomeRecentMusicState();

  return {
    root: document.getElementById("homeRecentMusicPlayer"),
    playButton: document.getElementById("homeRecentMusicPlayButton"),
    muteButton: document.getElementById("homeRecentMusicMuteButton"),
    volumeInput: document.getElementById("homeRecentMusicVolumeInput"),
    equalizer: document.getElementById("homeRecentMusicEq"),
    host: document.getElementById("homeRecentMusicEmbedHost"),
    hint: document.getElementById("homeRecentMusicHint")
  };
}

function getHomeRecentLetterKey(letter) {
  const resolvedUrl = getLetterMusicUrl(letter);
  return `${letter?.id || ""}::${resolvedUrl}`;
}

function markHomeRecentInteraction(source = "general") {
  const homeMusic = ensureHomeRecentMusicState();
  homeMusic.hasUserInteracted = true;
  homeMusic.lastInteractionAt = Date.now();
  homeMusic.lastInteractionSource = source;
}

function getHomeRecentVisibleRatio() {
  const section = document.getElementById("recent");
  if (!section) return 0;

  const rect = section.getBoundingClientRect();
  return Math.min(Math.max((window.innerHeight - rect.top) / window.innerHeight, 0), 1);
}

function ensureHomeRecentHintUi() {
  const { root } = getHomeRecentMusicElements();
  if (!root) return;

  let hint = document.getElementById("homeRecentMusicHint");
  if (hint) return;

  hint = document.createElement("div");
  hint.id = "homeRecentMusicHint";
  hint.className = "post-mini-player__hint-bubble is-hidden";
  hint.setAttribute("aria-hidden", "true");
  hint.textContent = "음악을 재생하려면 클릭하세요";
  root.appendChild(hint);
}

function setHomeRecentHintVisible(isVisible, message = "음악을 재생하려면 클릭하세요") {
  const homeMusic = ensureHomeRecentMusicState();
  homeMusic.hintVisible = Boolean(isVisible);
  homeMusic.hintText = String(message || "음악을 재생하려면 클릭하세요");

  const { hint } = getHomeRecentMusicElements();
  if (!hint) return;

  hint.textContent = homeMusic.hintText;
  hint.classList.toggle("is-hidden", !homeMusic.hintVisible);
  hint.setAttribute("aria-hidden", homeMusic.hintVisible ? "false" : "true");
}

async function attemptHomeRecentAutoplay({ trigger = "button", visibleRatio } = {}) {
  const latest = getLatestLetter?.();
  const homeMusic = ensureHomeRecentMusicState();
  const ratio = Number.isFinite(Number(visibleRatio)) ? Number(visibleRatio) : getHomeRecentVisibleRatio();

  if (trigger !== "button") return false;
  if (!latest || !hasLetterMusic(latest)) return false;
  if (ratio < 0.45) return false;

  const letterKey = getHomeRecentLetterKey(latest);
  const audio = await ensureHomeRecentPlayerReady(getLetterMusicUrl(latest));
  if (!(audio instanceof Audio)) return false;

  homeMusic.pendingGestureAutoplay = true;
  homeMusic.currentPostId = latest?.id || "";
  homeMusic.currentUrl = getLetterMusicUrl(latest);

  if (normalizeInlineVolume(homeMusic.volume) <= 0) {
    homeMusic.volume = getRestoreVolume(homeMusic);
  }

  try {
    homeMusic.isMuted = false;
    homeMusic.userPaused = false;
    applyHomeRecentPlayerVolume(audio);
    await audio.play();
    homeMusic.isPlaying = true;
    homeMusic.lastAutoPlayKey = letterKey;
    homeMusic.pendingGestureAutoplay = false;
    setHomeRecentHintVisible(false);
    updateHomeRecentMusicUi();
    return true;
  } catch (_error) {
    homeMusic.isMuted = true;
    homeMusic.isPlaying = false;
    homeMusic.pendingGestureAutoplay = false;
    setHomeRecentHintVisible(true);
    updateHomeRecentMusicUi();
    return false;
  }
}

function requestHomeRecentAutoplayFromGesture(source = "button") {
  if (document.body.dataset.page !== "home") return;

  markHomeRecentInteraction(source);

  const homeMusic = ensureHomeRecentMusicState();
  homeMusic.pendingGestureAutoplay = true;
  homeMusic.userPaused = false;
  setHomeRecentHintVisible(false);

  Promise.resolve(
    attemptHomeRecentAutoplay({
      trigger: "button",
      visibleRatio: getHomeRecentVisibleRatio()
    })
  ).catch(() => {});
}

function notifyHomeRecentVisibilityChange(visibleRatio) {
  if (document.body.dataset.page !== "home") return;

  const latest = getLatestLetter?.();
  const homeMusic = ensureHomeRecentMusicState();
  const hasMusic = hasLetterMusic(latest);
  const nextRatio = Number.isFinite(Number(visibleRatio)) ? Number(visibleRatio) : getHomeRecentVisibleRatio();
  const previousRatio = Number(homeMusic.lastVisibilityRatio || 0);

  homeMusic.lastVisibilityRatio = nextRatio;

  const crossedIntoRecent = previousRatio < 0.45 && nextRatio >= 0.45;
  const leftRecent = previousRatio >= 0.45 && nextRatio < 0.2;

  if (!hasMusic) {
    setHomeRecentHintVisible(false);
    return;
  }

  if (leftRecent) {
    setHomeRecentHintVisible(false);
    return;
  }

  if (homeMusic.pendingGestureAutoplay) {
    if (nextRatio >= 0.45) {
      setHomeRecentHintVisible(false);
      Promise.resolve(
        attemptHomeRecentAutoplay({
          trigger: "button",
          visibleRatio: nextRatio
        })
      ).catch(() => {});
    }
    return;
  }

  if (crossedIntoRecent && !homeMusic.isPlaying) {
    setHomeRecentHintVisible(true);
    return;
  }

  if (nextRatio < 0.45 || homeMusic.isPlaying) {
    setHomeRecentHintVisible(false);
  }
}

function ensureHomeRecentMusicVolumeUi() {
  const root = document.getElementById("homeRecentMusicPlayer");
  const muteButton = document.getElementById("homeRecentMusicMuteButton");
  const host = document.getElementById("homeRecentMusicEmbedHost");
  const homeMusic = ensureHomeRecentMusicState();

  if (!root || !muteButton) return;
  if (document.getElementById("homeRecentMusicVolumeInput")) return;

  const control = document.createElement("div");
  control.className = "post-mini-player__volume-control";

  const panel = document.createElement("div");
  panel.className = "post-mini-player__volume-panel";

  const range = document.createElement("input");
  range.id = "homeRecentMusicVolumeInput";
  range.className = "post-mini-player__volume-range";
  range.type = "range";
  range.min = "0";
  range.max = "100";
  range.step = "1";
  range.value = String(normalizeInlineVolume(homeMusic.volume));
  range.setAttribute("aria-label", "볼륨 조절");
  range.setAttribute("title", "볼륨 조절");

  panel.appendChild(range);

  muteButton.insertAdjacentElement("beforebegin", control);
  control.appendChild(muteButton);
  control.appendChild(panel);

  if (host) {
    root.appendChild(host);
  }
}

function ensureHomeRecentAudioElement() {
  const homeMusic = ensureHomeRecentMusicState();
  const { host } = getHomeRecentMusicElements();
  if (!host) return null;

  if (homeMusic.audio instanceof Audio) {
    if (!host.contains(homeMusic.audio)) {
      host.innerHTML = "";
      host.appendChild(homeMusic.audio);
    }
    return homeMusic.audio;
  }

  const audio = document.createElement("audio");
  audio.className = "post-mini-player__native-host";
  audio.preload = "auto";
  audio.loop = true;
  audio.playsInline = true;

  audio.addEventListener("play", () => {
    homeMusic.isPlaying = true;
    homeMusic.playerReady = true;
    setHomeRecentHintVisible(false);
    updateHomeRecentMusicUi();
  });

  audio.addEventListener("pause", () => {
    homeMusic.isPlaying = false;
    updateHomeRecentMusicUi();
  });

  audio.addEventListener("loadeddata", () => {
    homeMusic.playerReady = true;
    updateHomeRecentMusicUi();
  });

  audio.addEventListener("volumechange", () => {
    const nextVolume = normalizeInlineVolume(audio.volume * 100);
    homeMusic.volume = nextVolume;
    homeMusic.isMuted = Boolean(audio.muted || nextVolume <= 0);
    if (!homeMusic.isMuted) rememberLastNonZeroVolume(homeMusic, nextVolume);
    updateHomeRecentMusicUi();
  });

  audio.addEventListener("ended", () => {
    homeMusic.isPlaying = false;
    updateHomeRecentMusicUi();
  });

  audio.addEventListener("error", () => {
    homeMusic.isPlaying = false;
    homeMusic.playerReady = false;
    updateHomeRecentMusicUi();
  });

  host.innerHTML = "";
  host.appendChild(audio);
  homeMusic.audio = audio;
  homeMusic.player = audio;
  return audio;
}

function prepareHomeRecentMusicPlayer() {
  if (document.body.dataset.page !== "home") return;

  ensureHomeRecentMusicState();
  ensureHomeRecentMusicVolumeUi();
  ensureHomeRecentHintUi();
  ensureHomeRecentAudioElement();
  bindHomeRecentMusicEvents();
  updateHomeRecentMusicUi();
  notifyHomeRecentVisibilityChange(getHomeRecentVisibleRatio());
}

function bindHomeRecentMusicEvents() {
  if (bindHomeRecentMusicEvents._bound) return;
  bindHomeRecentMusicEvents._bound = true;

  document.addEventListener("click", async (event) => {
    const playButton = event.target.closest("#homeRecentMusicPlayButton");
    const muteButton = event.target.closest("#homeRecentMusicMuteButton");
    const homeMusic = ensureHomeRecentMusicState();

    if (playButton) {
      markHomeRecentInteraction("player-play-button");
      const latest = getLatestLetter?.();
      if (!hasLetterMusic(latest)) return;

      if (homeMusic.isPlaying) {
        homeMusic.userPaused = true;
        setHomeRecentHintVisible(false);
        pauseHomeRecentMusic();
        return;
      }

      homeMusic.userPaused = false;
      setHomeRecentHintVisible(false);
      await playHomeRecentMusic({
        url: getLetterMusicUrl(latest),
        unmute: true,
        forceLoad: true
      });
      return;
    }

    if (muteButton) {
      markHomeRecentInteraction("player-mute-button");
      const latest = getLatestLetter?.();
      if (!hasLetterMusic(latest)) return;

      setHomeRecentHintVisible(false);

      if (homeMusic.isMuted) {
        homeMusic.userPaused = false;
        await unmuteHomeRecentMusic();
        return;
      }

      muteHomeRecentMusic();
    }
  });

  document.addEventListener("input", async (event) => {
    const volumeInput = event.target.closest("#homeRecentMusicVolumeInput");
    if (!volumeInput) return;

    markHomeRecentInteraction("player-volume");
    const homeMusic = ensureHomeRecentMusicState();
    homeMusic.userPaused = false;
    setHomeRecentHintVisible(false);
    await setHomeRecentMusicVolume(volumeInput.value);
  });
}

function syncHomeRecentVolumeInput() {
  const { volumeInput } = getHomeRecentMusicElements();
  const homeMusic = ensureHomeRecentMusicState();
  if (!volumeInput) return;
  volumeInput.value = String(normalizeInlineVolume(homeMusic.volume));
}

function applyHomeRecentPlayerVolume(audio = ensureHomeRecentMusicState().audio) {
  const homeMusic = ensureHomeRecentMusicState();
  if (!(audio instanceof Audio)) return;

  const normalizedVolume = normalizeInlineVolume(homeMusic.volume);
  audio.volume = normalizedVolume / 100;
  audio.muted = Boolean(homeMusic.isMuted || normalizedVolume <= 0);

  if (!audio.muted) {
    rememberLastNonZeroVolume(homeMusic, normalizedVolume);
    homeMusic.isMuted = false;
  } else {
    homeMusic.isMuted = true;
  }
}

async function setHomeRecentMusicVolume(nextVolume) {
  const homeMusic = ensureHomeRecentMusicState();
  const normalizedVolume = normalizeInlineVolume(nextVolume);
  homeMusic.volume = normalizedVolume;

  if (normalizedVolume <= 0) {
    homeMusic.isMuted = true;
  } else {
    rememberLastNonZeroVolume(homeMusic, normalizedVolume);
    homeMusic.isMuted = false;
  }

  applyHomeRecentPlayerVolume();
  updateHomeRecentMusicUi();
}

function setHomeRecentMusicRootVisible(isVisible) {
  const { root } = getHomeRecentMusicElements();
  if (!root) return;
  root.classList.toggle("is-hidden", !isVisible);
  if (!isVisible) setHomeRecentHintVisible(false);
}

async function ensureHomeRecentPlayerReady(url) {
  const homeMusic = ensureHomeRecentMusicState();
  const audio = ensureHomeRecentAudioElement();
  if (!(audio instanceof Audio)) return null;

  if (url && homeMusic.currentUrl !== url) {
    audio.src = url;
    audio.load();
    homeMusic.currentUrl = url;
    homeMusic.playerReady = false;
  }

  homeMusic.player = audio;
  return audio;
}

async function syncHomeRecentMusicForLetter(letter, options = {}) {
  const homeMusic = ensureHomeRecentMusicState();
  const url = getLetterMusicUrl(letter);
  const shouldShow = Boolean(url);
  const nextLetterKey = getHomeRecentLetterKey(letter);

  setHomeRecentMusicRootVisible(shouldShow);

  if (!shouldShow) {
    stopHomeRecentMusic();
    return;
  }

  if (homeMusic.lastAutoPlayKey && homeMusic.lastAutoPlayKey !== nextLetterKey) {
    homeMusic.lastAutoPlayKey = "";
    homeMusic.userPaused = false;
  }

  homeMusic.currentPostId = letter?.id || "";
  updateHomeRecentMusicUi();

  if (options.prewarm !== false) {
    const audio = await ensureHomeRecentPlayerReady(url);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      homeMusic.isPlaying = false;
      homeMusic.isMuted = true;
      applyHomeRecentPlayerVolume(audio);
      updateHomeRecentMusicUi();
    }
  }
}

async function playHomeRecentMusic({ url = "", unmute = false } = {}) {
  const latest = getLatestLetter?.();
  const homeMusic = ensureHomeRecentMusicState();
  const resolvedUrl = url || getLetterMusicUrl(latest);
  if (!resolvedUrl) return false;

  const audio = await ensureHomeRecentPlayerReady(resolvedUrl);
  if (!(audio instanceof Audio)) return false;

  try {
    if (unmute) {
      if (normalizeInlineVolume(homeMusic.volume) <= 0) {
        homeMusic.volume = getRestoreVolume(homeMusic);
      }
      homeMusic.isMuted = false;
    } else {
      homeMusic.isMuted = true;
    }

    applyHomeRecentPlayerVolume(audio);
    await audio.play();
    homeMusic.isPlaying = true;
    homeMusic.currentPostId = latest?.id || "";
    homeMusic.currentUrl = resolvedUrl;
    setHomeRecentHintVisible(false);
    updateHomeRecentMusicUi();
    return true;
  } catch (_error) {
    console.warn("home recent play failed:", _error);
    updateHomeRecentMusicUi();
    return false;
  }
}

function pauseHomeRecentMusic() {
  const homeMusic = ensureHomeRecentMusicState();
  const audio = homeMusic.audio;
  if (!(audio instanceof Audio)) return;

  audio.pause();
  homeMusic.isPlaying = false;
  updateHomeRecentMusicUi();
}

async function unmuteHomeRecentMusic() {
  const homeMusic = ensureHomeRecentMusicState();
  const audio = homeMusic.audio;
  if (!(audio instanceof Audio)) return false;

  if (normalizeInlineVolume(homeMusic.volume) <= 0) {
    homeMusic.volume = getRestoreVolume(homeMusic);
  }

  try {
    homeMusic.isMuted = false;
    applyHomeRecentPlayerVolume(audio);

    if (!homeMusic.isPlaying) {
      await audio.play();
      homeMusic.isPlaying = true;
    }

    setHomeRecentHintVisible(false);
    updateHomeRecentMusicUi();
    return true;
  } catch (_error) {
    console.warn("home recent unmute failed:", _error);
    updateHomeRecentMusicUi();
    return false;
  }
}

function muteHomeRecentMusic() {
  const homeMusic = ensureHomeRecentMusicState();
  const audio = homeMusic.audio;
  if (!(audio instanceof Audio)) return;

  rememberLastNonZeroVolume(homeMusic, homeMusic.volume);
  audio.muted = true;
  homeMusic.isMuted = true;
  updateHomeRecentMusicUi();
}

function stopHomeRecentMusic() {
  const homeMusic = ensureHomeRecentMusicState();
  const audio = homeMusic.audio;

  if (audio instanceof Audio) {
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch (_error) {
      /* noop */
    }
  }

  homeMusic.isPlaying = false;
  homeMusic.isMuted = true;
  homeMusic.currentPostId = "";
  homeMusic.pendingGestureAutoplay = false;
  setHomeRecentHintVisible(false);
  updateHomeRecentMusicUi();
}

function destroyHomeRecentMusicPlayer(resetUrl = true) {
  const homeMusic = ensureHomeRecentMusicState();
  const audio = homeMusic.audio;

  if (audio instanceof Audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    audio.remove();
  }

  homeMusic.audio = null;
  homeMusic.player = null;
  homeMusic.playerReady = false;
  homeMusic.isPlaying = false;
  homeMusic.isMuted = true;

  if (resetUrl) {
    homeMusic.currentUrl = "";
    homeMusic.currentPostId = "";
  }

  const { host } = getHomeRecentMusicElements();
  if (host) host.innerHTML = "";
  setHomeRecentHintVisible(false);
  updateHomeRecentMusicUi();
}

function updateHomeRecentMusicUi() {
  const homeMusic = ensureHomeRecentMusicState();
  const { root, playButton, muteButton, volumeInput, equalizer } = getHomeRecentMusicElements();
  const hasMusic = Boolean(homeMusic.currentPostId || homeMusic.currentUrl);
  const resolvedVolume = normalizeInlineVolume(homeMusic.volume);

  if (root) {
    root.classList.toggle("is-playing", homeMusic.isPlaying);
    root.classList.toggle("is-muted", homeMusic.isMuted || resolvedVolume <= 0);
  }

  if (playButton) {
    playButton.disabled = !hasMusic;
    playButton.innerHTML = homeMusic.isPlaying ? MINI_PLAYER_ICONS.pause : MINI_PLAYER_ICONS.play;
    playButton.setAttribute("aria-label", homeMusic.isPlaying ? "일시정지" : "재생");
    playButton.setAttribute("title", homeMusic.isPlaying ? "일시정지" : "재생");
  }

  if (muteButton) {
    const isSilent = homeMusic.isMuted || resolvedVolume <= 0;
    muteButton.disabled = !hasMusic;
    muteButton.innerHTML = isSilent ? MINI_PLAYER_ICONS.volumeOff : MINI_PLAYER_ICONS.volumeOn;
    muteButton.setAttribute("aria-label", isSilent ? "음소거 해제" : "음소거");
    muteButton.setAttribute("title", isSilent ? "음소거 해제" : "음소거");
  }

  if (volumeInput) {
    volumeInput.disabled = !hasMusic;
    volumeInput.value = String(resolvedVolume);
    volumeInput.setAttribute("aria-valuenow", String(resolvedVolume));
  }

  if (equalizer) {
    equalizer.classList.toggle("is-playing", homeMusic.isPlaying);
    equalizer.setAttribute("aria-hidden", hasMusic ? "false" : "true");
  }

  if (homeMusic.isPlaying) {
    setHomeRecentHintVisible(false);
  }

  syncHomeRecentVolumeInput();
}