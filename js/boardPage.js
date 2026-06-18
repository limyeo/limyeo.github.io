/* =========================================================
   board.html 전용
========================================================= */
function bindBoardEvents() {
  document.getElementById("boardCreateButton")?.addEventListener("click", handleBoardCreateClick);
  document.getElementById("boardDetailListButton")?.addEventListener("click", () => showBoardListView());
  document.getElementById("boardDetailEditButton")?.addEventListener("click", handleBoardEditClick);
  document.getElementById("boardDetailDeleteButton")?.addEventListener("click", handleBoardDeleteClick);
  document.getElementById("postForm")?.addEventListener("submit", handleBoardPostSave);
  document.getElementById("boardEditorListButton")?.addEventListener("click", handleBoardEditorListClick);
  document.getElementById("boardEditorCancelButton")?.addEventListener("click", handleBoardEditorCancelClick);
  document.getElementById("addTextBlockButton")?.addEventListener("click", () => addBlock("text"));
  document.getElementById("addImageBlockButton")?.addEventListener("click", toggleImageBlockTypeMenu);
  document.getElementById("addImageUrlBlockButton")?.addEventListener("click", () => {
    addBlock("image", "", "", "url");
    closeImageBlockTypeMenu();
  });
  document.getElementById("addImageFileBlockButton")?.addEventListener("click", () => {
    addBlock("image", "", "", "file");
    closeImageBlockTypeMenu();
  });
  document.getElementById("blockList")?.addEventListener("click", handleBlockListClick);

  document.addEventListener("click", handleImageBlockMenuOutsideClick);
  bindPostMusicFieldEvents?.();
  prepareBoardInlineMusicPlayer();
}

async function handleBoardWindowFocus() {
  if (document.body.dataset.page !== "board") return;

  try {
    await refreshAuthState({ keepPreviousOnRecoverableError: true, silent: true });
    await loadPosts();

    if (state.boardMode === "detail") {
      const letter = resolveCurrentBoardLetter();
      if (letter) {
        await openBoardDetail(letter, {
          skipScroll: true,
          autoplayOnOpen: false,
          preservePlayingMusic: true
        });
      } else {
        showBoardListView({ skipScroll: true });
      }
    } else {
      renderBoardList();
    }
  } catch (error) {
    console.error(error);
    notifyRecoverableRequestIssue?.(error, "게시판 새로 불러오기");
  } finally {
    updateBoardAdminVisibility();
  }
}

function getOrCreateBoardPaginationContainer() {
  let container = document.getElementById("boardPagination");
  if (container) return container;

  const boardList = document.getElementById("boardList");
  if (!boardList) return null;

  container = document.createElement("div");
  container.id = "boardPagination";
  container.className = "board-pagination";
  boardList.insertAdjacentElement("afterend", container);
  return container;
}

function renderBoardList() {
  const container = document.getElementById("boardList");
  const paginationContainer = getOrCreateBoardPaginationContainer();
  if (!container) return;

  const letters = getLettersSorted();
  const totalPages = Math.max(1, Math.ceil(letters.length / BOARD_PAGE_SIZE));

  if (state.boardPage > totalPages) state.boardPage = totalPages;
  if (state.boardPage < 1) state.boardPage = 1;

  if (letters.length === 0) {
    container.innerHTML = `<div class="empty-message">등록된 선교 편지가 없습니다.</div>`;

    if (paginationContainer) {
      paginationContainer.innerHTML = "";
      paginationContainer.classList.add("is-hidden");
    }
    return;
  }

  const startIndex = (state.boardPage - 1) * BOARD_PAGE_SIZE;
  const currentLetters = letters.slice(startIndex, startIndex + BOARD_PAGE_SIZE);

  container.innerHTML = currentLetters.map((letter) => renderBoardCard(letter)).join("");

  container.querySelectorAll("[data-letter-id]").forEach((target) => {
    target.addEventListener("click", async () => {
      const letter = getLetterById(target.dataset.letterId);
      if (!letter) return;
      await openBoardDetail(letter, { autoplayOnOpen: true, fromUserGesture: true });
    });
  });

  renderBoardPagination(totalPages);
}

function renderBoardPagination(totalPages) {
  const container = getOrCreateBoardPaginationContainer();
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = "";
    container.classList.add("is-hidden");
    return;
  }

  container.classList.remove("is-hidden");

  let html = `
    <div class="board-pagination__inner">
      <button
        type="button"
        class="board-pagination__button board-pagination__button--nav"
        data-board-page-nav="prev"
        ${state.boardPage === 1 ? "disabled" : ""}
      >
        prev
      </button>
  `;

  for (let page = 1; page <= totalPages; page += 1) {
    html += `
      <button
        type="button"
        class="board-pagination__button ${page === state.boardPage ? "is-active" : ""}"
        data-board-page="${page}"
        aria-current="${page === state.boardPage ? "page" : "false"}"
      >
        ${page}
      </button>
    `;
  }

  html += `
      <button
        type="button"
        class="board-pagination__button board-pagination__button--nav"
        data-board-page-nav="next"
        ${state.boardPage === totalPages ? "disabled" : ""}
      >
        next
      </button>
    </div>
  `;

  container.innerHTML = html;

  container.querySelectorAll("[data-board-page]").forEach((button) => {
    button.addEventListener("click", () => setBoardPage(Number(button.dataset.boardPage)));
  });

  container.querySelector('[data-board-page-nav="prev"]')?.addEventListener("click", () => {
    setBoardPage(state.boardPage - 1);
  });

  container.querySelector('[data-board-page-nav="next"]')?.addEventListener("click", () => {
    setBoardPage(state.boardPage + 1);
  });
}

function setBoardPage(page) {
  const totalPages = Math.max(1, Math.ceil(getLettersSorted().length / BOARD_PAGE_SIZE));
  const nextPage = Math.min(Math.max(page, 1), totalPages);
  if (nextPage === state.boardPage) return;

  state.boardPage = nextPage;
  renderBoardList();
  scrollBoardContentIntoView();
}

function scrollBoardContentIntoView() {
  const target = document.querySelector(".board-page__content");
  if (!target) return;

  const top = target.getBoundingClientRect().top + window.scrollY - 120;
  window.scrollTo({ top, behavior: "smooth" });
}

function renderBoardCard(letter) {
  return `
    <article class="board-card">
      ${renderBoardThumb(letter)}
      <h2 class="board-card__title">
        <button type="button" class="board-card__title-link" data-letter-id="${letter.id}">${escapeHtml(letter.title)}</button>
      </h2>
    </article>
  `;
}

function renderBoardThumb(letter) {
  const imageUrl = getLetterThumbnail(letter);

  if (!imageUrl) {
    return `<button type="button" class="board-card__thumb board-card__thumb--empty" data-letter-id="${letter.id}">이미지 없음</button>`;
  }

  return `
    <button type="button" class="board-card__thumb" data-letter-id="${letter.id}">
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(letter.title)}" />
    </button>
  `;
}

function getLetterThumbnail(letter) {
  const imageBlock = (letter.blocks || []).find((block) => block.type === "image");
  return imageBlock?.value || "";
}

function setBoardDetailPostContext(letter) {
  const detailView = document.getElementById("boardDetailView");
  if (!detailView) return;

  detailView.dataset.postId = letter?.id || "";
}

function getBoardDetailPostId() {
  const detailViewPostId = document.getElementById("boardDetailView")?.dataset.postId || "";
  return detailViewPostId || state.selectedLetterId || document.getElementById("postIdInput")?.value || "";
}

function resolveCurrentBoardLetter() {
  const detailPostId = getBoardDetailPostId();
  return getSelectedLetter() || getLetterById(detailPostId) || null;
}

function shouldPreserveBoardDetailMusic(letter, options = {}) {
  if (!options.preservePlayingMusic) return false;
  if (!letter?.id) return false;
  if (!state.bgMusic?.audio) return false;

  const targetUrl = getLetterMusicUrl(letter);
  if (!targetUrl) return false;

  return (
    state.bgMusic.currentPostId === letter.id &&
    state.bgMusic.currentUrl === targetUrl
  );
}

async function openBoardDetail(letter, options = {}) {
  state.selectedLetterId = letter.id;
  setBoardDetailPostContext(letter);

  const title = document.getElementById("boardDetailTitle");
  const date = document.getElementById("boardDetailDate");
  const body = document.getElementById("boardDetailBody");
  if (!title || !date || !body) return;

  title.textContent = letter.title;
  date.textContent = formatDateTime(letter.createdAt);
  body.innerHTML = (letter.blocks || []).map((block) => renderRecentBlock(block, letter.title)).join("");

  const preserveMusic = shouldPreserveBoardDetailMusic(letter, options);

  if (preserveMusic) {
    state.bgMusic.currentPostId = letter.id;
    setBoardInlineMusicRootVisible(true);
    updateBoardInlineMusicUi();
  } else {
    await syncBoardDetailMusicForLetter(letter, { prewarm: true });
  }

  showBoardDetailView(options);

  if (options.autoplayOnOpen === true && options.fromUserGesture === true) {
    await playBoardDetailMusicByGesture(letter);
  }
}

function showBoardListView(options = {}) {
  state.boardMode = "list";
  setBoardDetailPostContext(null);
  toggleBoardViews({ list: true, detail: false, editor: false });
  stopBoardInlineMusic();
  setBoardInlineMusicRootVisible(false);
  renderBoardList();
  updateBoardAdminVisibility();
  if (!options.skipScroll) scrollBoardContentIntoView();
}

function showBoardDetailView(options = {}) {
  state.boardMode = "detail";
  toggleBoardViews({ list: false, detail: true, editor: false });
  updateBoardAdminVisibility();
  if (!options.skipScroll) scrollBoardContentIntoView();
}

function showBoardEditorView(mode = "create", letter = null, options = {}) {
  state.boardMode = "editor";
  toggleBoardViews({ list: false, detail: false, editor: true });
  stopBoardInlineMusic();
  setBoardInlineMusicRootVisible(false);

  const heading = document.getElementById("boardEditorHeading");
  if (heading) heading.textContent = mode === "edit" ? "선교 편지 수정" : "선교 편지 등록";

  if (mode === "edit" && letter) {
    loadPostToForm(letter);
    state.selectedLetterId = letter.id;
  } else {
    state.selectedLetterId = null;
    resetPostForm();
  }

  updateBoardAdminVisibility();
  if (!options.skipScroll) scrollBoardContentIntoView();
}

function toggleBoardViews({ list, detail, editor }) {
  document.getElementById("boardListView")?.classList.toggle("is-hidden", !list);
  document.getElementById("boardDetailView")?.classList.toggle("is-hidden", !detail);
  document.getElementById("boardEditorView")?.classList.toggle("is-hidden", !editor);
}

function updateBoardAdminVisibility() {
  if (document.body.dataset.page !== "board") return;

  const createButton = document.getElementById("boardCreateButton");
  const editButton = document.getElementById("boardDetailEditButton");
  const deleteButton = document.getElementById("boardDetailDeleteButton");
  const showAdminButtons = Boolean(state.isAdmin);

  if (createButton) {
    createButton.classList.toggle("is-hidden", !(showAdminButtons && state.boardMode === "list"));
  }
  if (editButton) {
    editButton.classList.toggle("is-hidden", !(showAdminButtons && state.boardMode === "detail"));
  }
  if (deleteButton) {
    deleteButton.classList.toggle("is-hidden", !(showAdminButtons && state.boardMode === "detail"));
  }
}

async function handleBoardInitialRoute() {
  const params = new URLSearchParams(window.location.search);
  const requestedMode = params.get("mode");
  const postId = params.get("postId");

  if (requestedMode === "create") {
    const allowed = await ensureAdminAccess("게시물 등록");
    if (allowed) showBoardEditorView("create", null, { skipScroll: true });
  }

  if (postId) {
    const letter = getLetterById(postId);
    if (letter) await openBoardDetail(letter, { skipScroll: true, autoplayOnOpen: false });
  }

  if (requestedMode || postId) {
    const cleanUrl = `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState({}, "", cleanUrl);
  }
}

async function handleBoardCreateClick() {
  const allowed = await ensureAdminAccess("게시물 등록");
  if (allowed) showBoardEditorView("create");
}

async function handleBoardEditClick() {
  const allowed = await ensureAdminAccess("게시물 수정");
  if (!allowed) return;

  const letter = resolveCurrentBoardLetter();

  if (!letter) {
    showGlobalError("수정할 게시물을 다시 찾지 못했습니다. 목록 또는 새로고침 후 다시 시도해주세요.");
    return;
  }

  showBoardEditorView("edit", letter);
}

async function handleBoardDeleteClick() {
  const allowed = await ensureAdminAccess("게시물 삭제");
  if (!allowed) return;

  const letter = resolveCurrentBoardLetter();
  if (!letter) {
    showGlobalError("삭제할 게시물을 다시 찾지 못했습니다. 목록 또는 새로고침 후 다시 시도해주세요.");
    return;
  }

  if (!window.confirm(`"${letter.title}" 게시물을 삭제할까요?`)) return;

  try {
    await deletePostInSupabase(letter);
    await loadPosts();
    state.selectedLetterId = null;
    setBoardDetailPostContext(null);
    showGlobalSuccess("게시물이 삭제되었습니다.");
    showBoardListView();
  } catch (error) {
    console.error(error);
    const recovered = notifyRecoverableRequestIssue?.(error, "게시물 삭제");
    if (!recovered) {
      alert(error?.message || "게시물 삭제 중 오류가 발생했습니다.");
    }
  }
}

async function handleBoardPostSave(event) {
  event.preventDefault();

  const allowed = await ensureAdminAccess("게시물 저장");
  if (!allowed) return;

  const idInput = document.getElementById("postIdInput");
  const titleInput = document.getElementById("postTitleInput");
  if (!idInput || !titleInput) return;

  const title = titleInput.value.trim();
  const rawBlocks = collectBlocksFromForm();
  const musicInput = collectPostMusicFromForm();

  if (!title) {
    alert("제목을 입력해주세요.");
    return;
  }

  if (rawBlocks.length === 0) {
    alert("내용 블록을 하나 이상 추가해주세요.");
    return;
  }

  const selectedAudioFile = musicInput.file;
  if (selectedAudioFile && !(selectedAudioFile.type || "").startsWith("audio/")) {
    alert("오디오 파일만 업로드할 수 있습니다.");
    return;
  }

  const submitButton = document.querySelector("#postForm .solid-button");
  let uploadedPaths = [];

  try {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "saving...";
    }

    const [preparedBlocks, preparedMusic] = await Promise.all([
      preparePostBlocksForSave(rawBlocks),
      preparePostMusicForSave(musicInput)
    ]);

    uploadedPaths = [...preparedBlocks.uploadedPaths, ...preparedMusic.uploadedPaths];

    if (preparedBlocks.blocks.length === 0) {
      alert("내용 블록을 하나 이상 입력하거나 선택해주세요.");
      return;
    }

    const payload = {
      id: idInput.value || "",
      title,
      music: preparedMusic.music,
      blocks: preparedBlocks.blocks
    };

    if (payload.id) {
      await updatePostInSupabase(payload);
    } else {
      payload.id = await createPostInSupabase(payload);
    }

    await loadPosts();
    state.selectedLetterId = payload.id;

    const savedPost = getLetterById(payload.id);
    if (savedPost) {
      await openBoardDetail(savedPost, {
        autoplayOnOpen: true,
        fromUserGesture: true
      });
    } else {
      showBoardListView();
    }

    showGlobalSuccess("게시물이 저장되었습니다.");
  } catch (error) {
    console.error(error);
    await removeFilesFromStorage(uploadedPaths);
    const recovered = notifyRecoverableRequestIssue?.(error, "게시물 저장");
    if (!recovered) {
      alert(error?.message || "게시물 저장 중 오류가 발생했습니다.");
    }
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "저장";
    }
  }
}

function handleBoardEditorListClick() {
  showBoardListView();
}

async function handleBoardEditorCancelClick() {
  const editingId = document.getElementById("postIdInput")?.value || "";

  if (editingId) {
    const letter = getLetterById(editingId);
    if (letter) {
      await openBoardDetail(letter, {
        autoplayOnOpen: true,
        fromUserGesture: true
      });
      return;
    }
  }

  showBoardListView();
}
