/* =========================================================
   index.html 전용
========================================================= */
function bindHomeScrollButtons() {
  document.querySelectorAll("[data-scroll-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.scrollTarget;

      if (targetId === "home") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      if (targetId === "recent") {
        requestHomeRecentAutoplayFromGesture?.("button");
      }

      document.getElementById(targetId)?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });
}

function bindHomeActiveState() {
  const header = document.querySelector(".site-header");
  const homeButton = document.querySelector('[data-scroll-target="home"]');
  const recentButton = document.querySelector('[data-scroll-target="recent"]');
  const recentSection = document.getElementById("recent");
  const scrollIndicator = document.querySelector(".scroll-indicator");

  if (!header || !homeButton || !recentButton || !recentSection) return;

  const setActive = (name) => {
    homeButton.classList.toggle("is-active", name === "home");
    recentButton.classList.toggle("is-active", name === "recent");
  };

  const updateActive = () => {
    const rect = recentSection.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const visibleRatio = Math.min(Math.max((window.innerHeight - rect.top) / window.innerHeight, 0), 1);
    const isRecentActive = visibleRatio >= 0.45;
    const shouldUseContrast = rect.top <= headerRect.bottom;
    const shouldHideIndicator = rect.top <= window.innerHeight * 0.72;

    setActive(isRecentActive ? "recent" : "home");
    header.classList.toggle("site-header--contrast", shouldUseContrast);
    scrollIndicator?.classList.toggle("is-hidden-by-scroll", shouldHideIndicator);
    notifyHomeRecentVisibilityChange?.(visibleRatio);
  };

  window.addEventListener("scroll", updateActive, { passive: true });
  window.addEventListener("resize", updateActive);
  updateActive();
}

function renderRecentLetter() {
  const container = document.getElementById("recentLetter");
  if (!container) return;

  const latest = getLatestLetter();
  if (!latest) {
    container.innerHTML = `<div class="empty-message">등록된 선교 편지가 없습니다.</div>`;
    notifyHomeRecentVisibilityChange?.(0);
    return;
  }

  const blocksHtml = (latest.blocks || []).map((block) => renderRecentBlock(block, latest.title)).join("");
  const hasMusic = hasLetterMusic(latest);

  container.innerHTML = `
    <article class="recent-letter__article">
      <header class="recent-letter__meta">
        <div class="recent-letter__meta-main">
          <h2 class="recent-letter__post-title">${escapeHtml(latest.title)}</h2>
          <p class="recent-letter__post-date">${formatDateTime(latest.createdAt)}</p>
        </div>

        ${
          hasMusic
            ? `
              <div class="recent-letter__music">
                <div
                  id="homeRecentMusicPlayer"
                  class="post-mini-player is-hidden"
                  aria-label="최근 게시글 음악 플레이어"
                >
                  <div id="homeRecentMusicEq" class="post-mini-player__eq" aria-hidden="true">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>

                  <button
                    id="homeRecentMusicPlayButton"
                    type="button"
                    class="post-mini-player__button"
                    aria-label="재생"
                    title="재생"
                  ></button>

                  <button
                    id="homeRecentMusicMuteButton"
                    type="button"
                    class="post-mini-player__button"
                    aria-label="음소거 해제"
                    title="음소거 해제"
                  ></button>

                  <div id="homeRecentMusicEmbedHost" class="post-mini-player__embed-host" aria-hidden="true"></div>
                </div>
              </div>
            `
            : ""
        }
      </header>

      <div class="recent-letter__blocks">
        ${blocksHtml || `<div class="empty-message">표시할 내용이 없습니다.</div>`}
      </div>
    </article>
  `;

  if (typeof prepareHomeRecentMusicPlayer === "function") {
    prepareHomeRecentMusicPlayer();
  }

  if (hasMusic && typeof syncHomeRecentMusicForLetter === "function") {
    Promise.resolve(syncHomeRecentMusicForLetter(latest, { prewarm: true }))
      .then(() => {
        notifyHomeRecentVisibilityChange?.();
      })
      .catch(() => {});
  } else {
    notifyHomeRecentVisibilityChange?.();
  }
}

function renderRecentBlock(block, title = "") {
  if (!block || !block.type) return "";

  if (block.type === "text") {
    return `
      <section class="recent-letter__block recent-letter__block--text">
        <div class="recent-letter__text-inner">${escapeHtml(block.value || "")}</div>
      </section>
    `;
  }

  if (block.type === "image") {
    if (!block.value) {
      return `
        <section class="recent-letter__block recent-letter__block--image">
          <div class="recent-letter__fallback">이미지가 등록되지 않았습니다.</div>
        </section>
      `;
    }

    return `
      <section class="recent-letter__block recent-letter__block--image">
        <img class="recent-letter__image" src="${escapeHtml(block.value)}" alt="${escapeHtml(title)}" />
      </section>
    `;
  }

  return "";
}
