/* =========================================================
   admin.html 전용
========================================================= */
function bindAdminEvents() {
  const heroForm = document.getElementById("heroForm");
  const createPostButton = document.getElementById("adminCreatePostButton");
  const recentPosts = document.getElementById("adminRecentPosts");
  const heroImageInput = document.getElementById("heroImageInput");
  const heroImageFileInput = document.getElementById("heroImageFileInput");
  const heroLogoTextInput = document.getElementById("heroLogoTextInput");
  const heroLogoSizeInput = document.getElementById("heroLogoSizeInput");
  const heroLogoPositionPicker = document.getElementById("heroLogoPositionPicker");

  heroForm?.addEventListener("submit", handleHeroSave);
  createPostButton?.addEventListener("click", handleAdminCreatePost);
  recentPosts?.addEventListener("click", handleAdminRecentPostsClick);

  heroImageInput?.addEventListener("input", updateHeroAdminPreviewFromControls);
  heroLogoTextInput?.addEventListener("input", updateHeroAdminPreviewFromControls);
  heroImageFileInput?.addEventListener("change", updateHeroAdminPreviewFromControls);
  heroLogoSizeInput?.addEventListener("input", updateHeroAdminPreviewFromControls);
  heroLogoPositionPicker?.addEventListener("click", handleHeroPositionPickerClick);

  document.querySelectorAll("[data-admin-viewer-close]").forEach((button) => {
    button.addEventListener("click", closeAdminPostViewer);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAdminPostViewer();
  });
}

function injectAdminPostViewer() {
  if (document.getElementById("adminPostViewer")) return;

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div id="adminPostViewer" class="viewer is-hidden" aria-hidden="true">
        <button type="button" class="viewer__backdrop" data-admin-viewer-close aria-label="닫기"></button>

        <div class="viewer__panel" role="dialog" aria-modal="true" aria-labelledby="adminPostViewerTitle">
          <button type="button" class="viewer__close" data-admin-viewer-close aria-label="닫기">×</button>

          <div class="viewer__content">
            <h2 id="adminPostViewerTitle" class="viewer__title"></h2>
            <p id="adminPostViewerDate" class="viewer__date"></p>
            <div id="adminPostViewerBody" class="viewer__body"></div>
          </div>
        </div>
      </div>
    `
  );
}

function handleAdminRecentPostsClick(event) {
  const viewButton = event.target.closest("[data-admin-view-post-id]");
  if (!viewButton) return;
  openAdminPostViewer(viewButton.dataset.adminViewPostId);
}

function openAdminPostViewer(letterOrId) {
  const letter = typeof letterOrId === "string" ? getLetterById(letterOrId) : letterOrId;
  if (!letter) {
    alert("게시글을 찾을 수 없습니다.");
    return;
  }

  const viewer = document.getElementById("adminPostViewer");
  const title = document.getElementById("adminPostViewerTitle");
  const date = document.getElementById("adminPostViewerDate");
  const body = document.getElementById("adminPostViewerBody");
  if (!viewer || !title || !date || !body) return;

  title.textContent = letter.title;
  date.textContent = formatDate(letter.createdAt);
  body.innerHTML = (letter.blocks || []).length
    ? letter.blocks.map((block) => renderAdminViewerBlock(block, letter.title)).join("")
    : `<div class="empty-message">표시할 내용이 없습니다.</div>`;

  viewer.classList.remove("is-hidden");
  viewer.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeAdminPostViewer() {
  const viewer = document.getElementById("adminPostViewer");
  if (!viewer || viewer.classList.contains("is-hidden")) return;

  viewer.classList.add("is-hidden");
  viewer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function renderAdminViewerBlock(block, title = "") {
  if (!block || !block.type) return "";

  if (block.type === "text") {
    return `<p class="viewer__paragraph">${escapeHtml(block.value || "")}</p>`;
  }

  if (block.type === "image") {
    if (!block.value) {
      return `<div class="empty-message">이미지가 등록되지 않았습니다.</div>`;
    }

    return `<img class="viewer__image" src="${escapeHtml(block.value)}" alt="${escapeHtml(title)}" />`;
  }

  return "";
}

function renderHeroAdmin() {
  const heroImageInput = document.getElementById("heroImageInput");
  const heroLogoTextInput = document.getElementById("heroLogoTextInput");
  const heroLogoSizeInput = document.getElementById("heroLogoSizeInput");
  const heroLogoPositionInput = document.getElementById("heroLogoPositionInput");
  const heroStorageInfo = document.getElementById("heroStorageInfo");
  if (!heroImageInput || !heroLogoTextInput || !heroLogoSizeInput || !heroLogoPositionInput) return;

  heroImageInput.value = getCurrentHeroImage();
  heroLogoTextInput.value = getCurrentHeroLogoText();
  heroLogoSizeInput.value = String(getCurrentHeroLogoSize());
  heroLogoPositionInput.value = getCurrentHeroLogoPosition();
  updateHeroLogoSizeValue(heroLogoSizeInput.value);
  syncHeroPositionPicker(heroLogoPositionInput.value);

  if (heroStorageInfo) {
    heroStorageInfo.textContent = state.settings.heroImageStoragePath
      ? `storage path: ${state.settings.heroImageStoragePath}`
      : "";
  }

  updateHeroAdminPreview({
    imageUrl: getCurrentHeroImage(),
    logoText: getCurrentHeroLogoText(),
    logoSize: getCurrentHeroLogoSize(),
    logoPosition: getCurrentHeroLogoPosition()
  });
}

function updateHeroLogoSizeValue(sizeValue) {
  const heroLogoSizeValue = document.getElementById("heroLogoSizeValue");
  if (!heroLogoSizeValue) return;
  heroLogoSizeValue.textContent = `${resolveHeroLogoSize(sizeValue)}%`;
}

function syncHeroPositionPicker(position) {
  const resolvedPosition = resolveHeroLogoPosition(position);
  document.querySelectorAll("[data-hero-position-choice]").forEach((button) => {
    const isActive = button.dataset.heroPositionChoice === resolvedPosition;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function updateHeroAdminPreview({ imageUrl, logoText, logoSize, logoPosition }) {
  const heroPreview = document.getElementById("heroPreview");
  const heroPreviewContent = document.getElementById("heroPreviewContent");
  const heroLogoPreviewText = document.getElementById("heroLogoPreviewText");
  if (!heroPreview || !heroPreviewContent || !heroLogoPreviewText) return;

  heroPreview.src = imageUrl || DEFAULT_HERO_IMAGE;
  applyHeroPresentation({
    container: heroPreviewContent,
    textElement: heroLogoPreviewText,
    text: logoText,
    sizePercent: logoSize,
    position: logoPosition
  });
}

function handleHeroPositionPickerClick(event) {
  const button = event.target.closest("[data-hero-position-choice]");
  if (!button) return;

  const heroLogoPositionInput = document.getElementById("heroLogoPositionInput");
  if (!heroLogoPositionInput) return;

  heroLogoPositionInput.value = resolveHeroLogoPosition(button.dataset.heroPositionChoice);
  syncHeroPositionPicker(heroLogoPositionInput.value);
  updateHeroAdminPreviewFromControls();
}

function updateHeroAdminPreviewFromControls() {
  const heroImageInput = document.getElementById("heroImageInput");
  const heroImageFileInput = document.getElementById("heroImageFileInput");
  const heroLogoTextInput = document.getElementById("heroLogoTextInput");
  const heroLogoSizeInput = document.getElementById("heroLogoSizeInput");
  const heroLogoPositionInput = document.getElementById("heroLogoPositionInput");

  const textValue = heroLogoTextInput?.value ?? "";
  const file = heroImageFileInput?.files?.[0] || null;
  const urlValue = heroImageInput?.value.trim() || getCurrentHeroImage();
  const logoSize = resolveHeroLogoSize(heroLogoSizeInput?.value);
  const logoPosition = resolveHeroLogoPosition(heroLogoPositionInput?.value);

  updateHeroLogoSizeValue(logoSize);
  syncHeroPositionPicker(logoPosition);

  if (file) {
    const previewUrl = URL.createObjectURL(file);
    updateHeroAdminPreview({
      imageUrl: previewUrl,
      logoText: textValue,
      logoSize,
      logoPosition
    });
    return;
  }

  updateHeroAdminPreview({
    imageUrl: urlValue || getCurrentHeroImage(),
    logoText: textValue,
    logoSize,
    logoPosition
  });
}

async function renderAdminDashboard() {
  const summaryGrid = document.getElementById("adminSummaryGrid");
  const overview = document.getElementById("adminOverview");
  const recentPosts = document.getElementById("adminRecentPosts");
  const updatedAt = document.getElementById("adminDashboardUpdatedAt");
  if (!summaryGrid || !overview || !recentPosts) return;

  summaryGrid.innerHTML = `
    <article class="admin-summary-card">
      <p class="admin-summary-card__label">dashboard</p>
      <p class="admin-summary-card__value">불러오는 중...</p>
      <p class="admin-summary-card__meta">Supabase 사용량을 계산하고 있습니다.</p>
    </article>
  `;
  overview.innerHTML = `<div class="empty-message">운영 현황을 불러오는 중입니다.</div>`;
  recentPosts.innerHTML = `<div class="empty-message">최근 게시글을 불러오는 중입니다.</div>`;
  if (updatedAt) updatedAt.textContent = "";

  try {
    const dashboard = await getAdminDashboardData();

    summaryGrid.innerHTML = dashboard.summaryCards
      .map(
        (card) => `
          <article class="admin-summary-card">
            <p class="admin-summary-card__label">${escapeHtml(card.label)}</p>
            <p class="admin-summary-card__value">${escapeHtml(card.value)}</p>
            <p class="admin-summary-card__meta">${escapeHtml(card.meta)}</p>
          </article>
        `
      )
      .join("");

    overview.innerHTML = renderAdminUsageOverview(dashboard);
    recentPosts.innerHTML = renderAdminRecentPostsList(dashboard.recentPosts);
    if (updatedAt) updatedAt.textContent = `updated ${dashboard.updatedAtLabel}`;
  } catch (error) {
    console.error(error);

    summaryGrid.innerHTML = `
      <article class="admin-summary-card">
        <p class="admin-summary-card__label">dashboard</p>
        <p class="admin-summary-card__value">불러오기 실패</p>
        <p class="admin-summary-card__meta">${escapeHtml(error?.message || "운영 현황을 불러오지 못했습니다.")}</p>
      </article>
    `;
    overview.innerHTML = `<div class="empty-message">운영 현황을 불러오지 못했습니다.</div>`;
    recentPosts.innerHTML = renderAdminRecentPostsList(getLettersSorted().slice(0, 3));
    if (updatedAt) updatedAt.textContent = "";
  }
}

async function getAdminDashboardData() {
  const letters = getLettersSorted();
  const latestPost = getLatestLetter();

  const [tableUsageRows, imageStorageRows, audioStorageRows] = await Promise.all([
    fetchAdminTableUsage(),
    fetchAdminStorageUsage(CONFIG.imageBucket),
    fetchAdminStorageUsage(CONFIG.audioBucket)
  ]);

  const totalTableBytes = tableUsageRows.reduce((sum, row) => sum + row.total_bytes, 0);

  const totalImageStorageBytes = imageStorageRows.reduce((sum, row) => sum + row.total_bytes, 0);
  const totalImageStorageFiles = imageStorageRows.reduce((sum, row) => sum + row.file_count, 0);

  const totalAudioStorageBytes = audioStorageRows.reduce((sum, row) => sum + row.total_bytes, 0);
  const totalAudioStorageFiles = audioStorageRows.reduce((sum, row) => sum + row.file_count, 0);

  const totalStorageBytes = totalImageStorageBytes + totalAudioStorageBytes;
  const totalStorageFiles = totalImageStorageFiles + totalAudioStorageFiles;

  const tableUsagePercent = calculateUsagePercent(totalTableBytes, ADMIN_TABLE_CAPACITY_BYTES);
  const storageUsagePercent = calculateUsagePercent(totalStorageBytes, ADMIN_STORAGE_CAPACITY_BYTES);

  return {
    summaryCards: [
      {
        label: "게시글 수",
        value: `${formatCount(letters.length)}개`,
        meta:
          letters.length === 0
            ? "등록된 게시글이 없습니다."
            : "현재 공개/관리 대상 게시글 수입니다."
      },
      {
        label: "DB 테이블 사용량",
        value: formatBytes(totalTableBytes),
        meta:
          tableUsageRows.length === 0
            ? `최대 ${formatBytes(ADMIN_TABLE_CAPACITY_BYTES)} 기준 0% 사용 중입니다.`
            : `최대 ${formatBytes(ADMIN_TABLE_CAPACITY_BYTES)} 대비 ${formatPercent(tableUsagePercent)} 사용 중입니다.`
      },
      {
        label: "Storage 사용량",
        value: formatBytes(totalStorageBytes),
        meta:
          totalStorageFiles === 0
            ? `최대 ${formatBytes(ADMIN_STORAGE_CAPACITY_BYTES)} 기준 0% 사용 중입니다.`
            : `최대 ${formatBytes(ADMIN_STORAGE_CAPACITY_BYTES)} 대비 ${formatPercent(storageUsagePercent)} 사용 중입니다.`
            // : `image + audio 합산 ${formatCount(totalStorageFiles)}개 파일 · ${formatPercent(storageUsagePercent)} 사용 중입니다.`
      },
      {
        label: "최근 게시일",
        value: latestPost ? formatDate(latestPost.createdAt) : "-",
        meta: latestPost ? truncateText(latestPost.title, 34) : "최신 글이 없습니다."
      }
    ],
    updatedAtLabel: formatDateTime(new Date()),
    recentPosts: letters.slice(0, 3),
    tableUsageRows,
    imageStorageRows,
    audioStorageRows,
    totalTableBytes,
    totalImageStorageBytes,
    totalImageStorageFiles,
    totalAudioStorageBytes,
    totalAudioStorageFiles,
    totalStorageBytes,
    totalStorageFiles,
    tableCapacityBytes: ADMIN_TABLE_CAPACITY_BYTES,
    storageCapacityBytes: ADMIN_STORAGE_CAPACITY_BYTES,
    tableUsagePercent,
    storageUsagePercent
  };
}

async function fetchAdminTableUsage() {
  if (!supabaseClient) return [];

  const { data, error } = await supabaseClient.rpc("get_admin_table_usage");
  if (error) {
    throw new Error(`테이블 사용량 조회 실패: ${error.message}`);
  }

  return (data || [])
    .map((row) => ({
      table_name: row.table_name || "",
      row_estimate: Number(row.row_estimate || 0),
      table_bytes: Number(row.table_bytes || 0),
      index_bytes: Number(row.index_bytes || 0),
      total_bytes: Number(row.total_bytes || 0)
    }))
    .sort((a, b) => b.total_bytes - a.total_bytes);
}

async function fetchAdminStorageUsage(bucketName) {
  if (!supabaseClient) return [];

  const { data, error } = await supabaseClient.rpc("get_admin_storage_usage", {
    target_bucket: bucketName
  });
  if (error) {
    throw new Error(`Storage 사용량 조회 실패(${bucketName}): ${error.message}`);
  }

  return (data || [])
    .map((row) => ({
      bucket_id: row.bucket_id || bucketName,
      folder_name: row.folder_name || "(root)",
      file_count: Number(row.file_count || 0),
      total_bytes: Number(row.total_bytes || 0)
    }))
    .sort((a, b) => b.total_bytes - a.total_bytes);
}

function getAdminTableDisplayName(tableName = "") {
  const normalized = String(tableName || "").trim().toLowerCase();

  const tableNameMap = {
    admin_users: "관리자 계정",
    mission_post_blocks: "게시글 내용 블록",
    mission_posts_blocks: "게시글 내용 블록",
    mission_posts: "선교 편지 게시글",
    site_settings: "사이트 설정"
  };

  return tableNameMap[normalized] || tableName || "-";
}

function renderAdminUsageOverview(dashboard) {
  const tableSection = renderUsageCapacitySection({
    title: "DB 테이블 사용량",
    description: `최대 500 MB 기준 현재 사용량입니다.
아래는 public 테이블별 세부 사용량입니다.`,
    usedBytes: dashboard.totalTableBytes,
    maxBytes: dashboard.tableCapacityBytes,
    rows: dashboard.tableUsageRows.map((row) => ({
      label: getAdminTableDisplayName(row.table_name),
      valueLabel: `${formatBytes(row.total_bytes)} · 약 ${formatCount(row.row_estimate)} rows · 전체 한도의 ${formatPercent(calculateUsagePercent(row.total_bytes, dashboard.tableCapacityBytes))}`,
      bytes: row.total_bytes
    })),
    emptyMessage: "표시할 테이블 사용량이 없습니다."
  });

  const storageSection = renderUsageCapacitySection({
    title: "Storage 사용량",
    description: `최대 ${formatBytes(dashboard.storageCapacityBytes)} 기준 현재 사용량입니다.
아래는 image, audio 각각의 사용량입니다.`,
    usedBytes: dashboard.totalStorageBytes,
    maxBytes: dashboard.storageCapacityBytes,
    rows: [
      {
        label: "image",
        valueLabel: `${formatBytes(dashboard.totalImageStorageBytes)} · ${formatCount(dashboard.totalImageStorageFiles)} files · 전체 한도의 ${formatPercent(calculateUsagePercent(dashboard.totalImageStorageBytes, dashboard.storageCapacityBytes))}`,
        bytes: dashboard.totalImageStorageBytes
      },
      {
        label: "audio",
        valueLabel: `${formatBytes(dashboard.totalAudioStorageBytes)} · ${formatCount(dashboard.totalAudioStorageFiles)} files · 전체 한도의 ${formatPercent(calculateUsagePercent(dashboard.totalAudioStorageBytes, dashboard.storageCapacityBytes))}`,
        bytes: dashboard.totalAudioStorageBytes
      }
    ],
    emptyMessage: "표시할 Storage 사용량이 없습니다."
  });

  return `
    <div class="admin-usage-stack">
      ${tableSection}
      ${storageSection}
    </div>
  `;
}

function renderUsageCapacitySection({ title, description, usedBytes, maxBytes, rows, emptyMessage }) {
  const usagePercent = calculateUsagePercent(usedBytes, maxBytes);
  const remainingBytes = Math.max(maxBytes - usedBytes, 0);
  const trackWidth = clampPercent(usagePercent);
  const isOverLimit = usedBytes > maxBytes;

  return `
    <section class="admin-usage-card">
      <div class="admin-usage-card__head">
        <div>
          <h3 class="admin-usage-card__title">${escapeHtml(title)}</h3>
          <p class="admin-usage-card__desc">${escapeHtml(description)}</p>
        </div>
        <span class="admin-usage-card__total">${escapeHtml(`${formatBytes(usedBytes)} / ${formatBytes(maxBytes)}`)}</span>
      </div>

      <div class="admin-capacity-summary">
        <div class="admin-capacity-summary__chips">
          <span class="admin-capacity-chip">현재 ${escapeHtml(formatBytes(usedBytes))}</span>
          <span class="admin-capacity-chip">최대 ${escapeHtml(formatBytes(maxBytes))}</span>
          <span class="admin-capacity-chip">잔여 ${escapeHtml(formatBytes(remainingBytes))}</span>
          <span class="admin-capacity-chip ${isOverLimit ? "is-over" : ""}">${escapeHtml(`${formatPercent(usagePercent)} 사용`)}</span>
        </div>

        <div class="admin-capacity-progress">
          <div class="admin-capacity-progress__track">
            <span
              class="admin-capacity-progress__fill ${isOverLimit ? "is-over" : ""}"
              style="width:${trackWidth}%"
            ></span>
          </div>
          <p class="admin-capacity-progress__caption">
            ${escapeHtml(`현재 ${formatBytes(usedBytes)} / 최대 ${formatBytes(maxBytes)} (${formatPercent(usagePercent)})`)}
          </p>
        </div>
      </div>

      ${
        rows.length
          ? `
            <div class="admin-usage-bars">
              ${rows
                .map((row) => {
                  const width =
                    row.bytes > 0
                      ? Math.max(3, clampPercent(calculateUsagePercent(row.bytes, maxBytes)))
                      : 0;

                  return `
                    <div class="admin-usage-bar">
                      <div class="admin-usage-bar__meta">
                        <span class="admin-usage-bar__label">${escapeHtml(row.label)}</span>
                        <span class="admin-usage-bar__value">${escapeHtml(row.valueLabel)}</span>
                      </div>
                      <div class="admin-usage-bar__track">
                        <span class="admin-usage-bar__fill" style="width:${width}%"></span>
                      </div>
                    </div>
                  `;
                })
                .join("")}
            </div>
          `
          : `<div class="empty-message">${escapeHtml(emptyMessage)}</div>`
      }
    </section>
  `;
}

function renderAdminRecentPostsList(posts) {
  if (!posts.length) {
    return `<div class="empty-message">최근 게시글이 없습니다.</div>`;
  }

  return posts
    .map(
      (letter) => `
        <article class="admin-recent-row">
          <p class="admin-recent-row__date">${escapeHtml(formatDate(letter.createdAt))}</p>
          <h3 class="admin-recent-row__title">${escapeHtml(letter.title)}</h3>
          <div class="admin-recent-row__actions">
            <button
              type="button"
              class="outline-button"
              data-admin-view-post-id="${escapeHtml(letter.id)}"
            >
              read
            </button>
          </div>
        </article>
      `
    )
    .join("");
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;

  const units = ["KB", "MB", "GB", "TB"];
  let size = value / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const fixed = size >= 100 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(fixed)} ${units[unitIndex]}`;
}

function calculateUsagePercent(usedBytes, maxBytes) {
  const used = Number(usedBytes || 0);
  const max = Number(maxBytes || 0);
  if (max <= 0) return 0;
  return (used / max) * 100;
}

function clampPercent(value) {
  return Math.min(Math.max(Number(value || 0), 0), 100);
}

function formatPercent(value) {
  const numeric = Number(value || 0);
  const fixed = numeric >= 100 ? 0 : numeric >= 10 ? 1 : 2;
  return `${numeric.toFixed(fixed)}%`;
}

function formatCount(value) {
  return new Intl.NumberFormat("ko-KR").format(Number(value || 0));
}

function handleAdminCreatePost() {
  window.location.href = "board.html?mode=create";
}

async function handleHeroSave(event) {
  event.preventDefault();

  const heroImageInput = document.getElementById("heroImageInput");
  const heroPreview = document.getElementById("heroPreview");
  const heroImageFileInput = document.getElementById("heroImageFileInput");
  const heroStorageInfo = document.getElementById("heroStorageInfo");
  const heroLogoTextInput = document.getElementById("heroLogoTextInput");
  const heroLogoSizeInput = document.getElementById("heroLogoSizeInput");
  const heroLogoPositionInput = document.getElementById("heroLogoPositionInput");
  if (
    !heroImageInput ||
    !heroPreview ||
    !heroLogoTextInput ||
    !heroLogoSizeInput ||
    !heroLogoPositionInput
  ) {
    return;
  }

  const file = heroImageFileInput?.files?.[0] || null;
  const imageValue = heroImageInput.value.trim();
  const logoText = heroLogoTextInput.value;
  const logoSize = resolveHeroLogoSize(heroLogoSizeInput.value);
  const logoPosition = resolveHeroLogoPosition(heroLogoPositionInput.value);

  if (!file && !imageValue) {
    alert("이미지 URL을 입력하거나 파일을 업로드해주세요.");
    return;
  }

  if (!hasMeaningfulText(logoText)) {
    alert("히어로 로고 텍스트를 입력해주세요.");
    return;
  }

  try {
    const submitButton = document.querySelector("#heroForm .solid-button");
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "saving...";
    }

    let finalUrl = imageValue || getCurrentHeroImage();

    if (file) {
      const uploaded = await uploadHeroImageFileToStorage(file);
      finalUrl = uploaded.publicUrl;
      state.settings.heroImageStoragePath = uploaded.storagePath;
      if (heroStorageInfo) heroStorageInfo.textContent = `storage path: ${uploaded.storagePath}`;
    } else {
      state.settings.heroImageStoragePath = "";
      if (heroStorageInfo) heroStorageInfo.textContent = "";
    }

    await saveHeroSettings({
      imageUrl: finalUrl,
      logoText,
      logoSize,
      logoPosition
    });

    heroImageInput.value = finalUrl;
    if (heroImageFileInput) heroImageFileInput.value = "";

    updateHeroAdminPreview({
      imageUrl: finalUrl,
      logoText,
      logoSize,
      logoPosition
    });

    applyHeroImage();
    applyHeroLogoText();
    await renderAdminDashboard();
    showGlobalSuccess("첫 화면 이미지, 로고 텍스트, 크기, 위치가 저장되었습니다.");
  } catch (error) {
    console.error(error);
    alert(error?.message || "첫 화면 설정 저장 중 오류가 발생했습니다.");
  } finally {
    const submitButton = document.querySelector("#heroForm .solid-button");
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "save hero";
    }
  }
}

function getHeroFileExtension(filename = "") {
  const sanitized = String(filename).split("?")[0];
  const lastDotIndex = sanitized.lastIndexOf(".");
  if (lastDotIndex < 0) return "";
  return sanitized.slice(lastDotIndex + 1).toLowerCase();
}

function createHeroImageStoragePath(file) {
  const extension = getHeroFileExtension(file?.name || "") || "jpg";
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  return `hero/${year}/${month}/${crypto.randomUUID()}.${extension}`;
}

async function uploadHeroImageFileToStorage(file) {
  if (!(file instanceof File)) {
    throw new Error("업로드할 히어로 이미지를 찾을 수 없습니다.");
  }

  const storagePath = createHeroImageStoragePath(file);
  const { error } = await supabaseClient.storage.from(CONFIG.imageBucket).upload(storagePath, file, {
    upsert: false,
    contentType: file.type || "image/jpeg"
  });
  if (error) throw error;

  const { data } = supabaseClient.storage.from(CONFIG.imageBucket).getPublicUrl(storagePath);
  const publicUrl = data?.publicUrl || "";
  if (!publicUrl) throw new Error("업로드 후 public URL 생성에 실패했습니다.");

  return { storagePath, publicUrl };
}
