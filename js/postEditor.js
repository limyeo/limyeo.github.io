/* =========================================================
   게시물 에디터 공통
========================================================= */
function getPostMusicFormElements() {
  return {
    fileInput: document.getElementById("postMusicFileInput"),
    fileName: document.getElementById("postMusicFileName"),
    removeButton: document.getElementById("postMusicRemoveButton"),
    form: document.getElementById("postForm")
  };
}

function resetPostMusicFormState() {
  const { fileInput, fileName, form } = getPostMusicFormElements();
  if (fileInput) fileInput.value = "";

  if (form) {
    form.dataset.musicStoragePath = "";
    form.dataset.musicFileName = "";
    form.dataset.musicContentType = "";
    form.dataset.musicRemoveRequested = "";
  }

  if (fileName) {
    fileName.textContent = "";
  }
}

function updatePostMusicFieldStatus() {
  const { fileInput, fileName, removeButton, form } = getPostMusicFormElements();
  if (!fileName || !form) return;

  const selectedFile = fileInput?.files?.[0] || null;
  const existingFileName = form.dataset.musicFileName || "";
  const hasExistingMusic = Boolean(form.dataset.musicStoragePath);
  const removeRequested = form.dataset.musicRemoveRequested === "true";
  const canDeleteFile = Boolean(selectedFile || hasExistingMusic);

  if (removeButton) {
    removeButton.disabled = !canDeleteFile;
  }

  if (selectedFile) {
    fileName.textContent = `선택된 오디오 파일: ${selectedFile.name}`;
    return;
  }

  if (removeRequested && hasExistingMusic) {
    fileName.textContent = `현재 저장된 파일: ${existingFileName || "이름 없음"} · 저장 시 제거됩니다.`;
    return;
  }

  if (hasExistingMusic) {
    fileName.textContent = `현재 저장된 파일: ${existingFileName || "이름 없음"}`;
    return;
  }

  fileName.textContent = "";
}

function bindPostMusicFieldEvents() {
  if (bindPostMusicFieldEvents._bound) return;
  bindPostMusicFieldEvents._bound = true;

  const { fileInput, removeButton, form } = getPostMusicFormElements();

  fileInput?.addEventListener("change", () => {
    if (fileInput.files?.[0] && form) {
      form.dataset.musicRemoveRequested = "";
    }
    updatePostMusicFieldStatus();
  });

  removeButton?.addEventListener("click", () => {
    const hasExistingMusic = Boolean(form?.dataset.musicStoragePath);
    if (fileInput) fileInput.value = "";
    if (form) {
      form.dataset.musicRemoveRequested = hasExistingMusic ? "true" : "";
    }
    updatePostMusicFieldStatus();
  });
}

function collectPostMusicFromForm() {
  const { fileInput, form } = getPostMusicFormElements();
  const file = fileInput?.files?.[0] || null;

  return {
    file,
    removeRequested: form?.dataset.musicRemoveRequested === "true",
    existingStoragePath: form?.dataset.musicStoragePath || "",
    existingFileName: form?.dataset.musicFileName || "",
    existingContentType: form?.dataset.musicContentType || ""
  };
}

function resetPostForm() {
  const idInput = document.getElementById("postIdInput");
  const titleInput = document.getElementById("postTitleInput");
  const blockList = document.getElementById("blockList");
  if (!idInput || !titleInput || !blockList) return;

  idInput.value = "";
  titleInput.value = "";
  resetPostMusicFormState();
  blockList.innerHTML = "";
  addBlock("text");
}

function loadPostToForm(letter) {
  const idInput = document.getElementById("postIdInput");
  const titleInput = document.getElementById("postTitleInput");
  const blockList = document.getElementById("blockList");
  const { fileInput, form } = getPostMusicFormElements();
  if (!idInput || !titleInput || !blockList) return;

  idInput.value = letter.id;
  titleInput.value = letter.title;

  if (fileInput) fileInput.value = "";

  if (form) {
    form.dataset.musicStoragePath = letter.musicStoragePath || "";
    form.dataset.musicFileName = letter.musicFileName || "";
    form.dataset.musicContentType = letter.musicContentType || "";
    form.dataset.musicRemoveRequested = "";
  }

  updatePostMusicFieldStatus();
  blockList.innerHTML = "";

  (letter.blocks || []).forEach((block) => {
    addBlock(block.type, block.value, block.storagePath || "", block.imageSource || "url");
  });

  if ((letter.blocks || []).length === 0) addBlock("text");
}

function getBlockActionIcon(action) {
  const icons = {
    up: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5l-6 6m6-6 6 6m-6-6v14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>`,
    down: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19l-6-6m6 6 6-6m-6 6V5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>`,
    remove: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14m-9 4v6m4-6v6M9 7l.7-2h4.6l.7 2m-8 0 .8 13h8.4L17 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>`
  };
  return icons[action] || "";
}

function renderBlockActionButton(action, variant = "outline-button") {
  const labels = { up: "위로 이동", down: "아래로 이동", remove: "삭제" };
  return `<button type="button" class="${variant} icon-button block-action-button" data-block-action="${action}" aria-label="${labels[action]}" title="${labels[action]}">${getBlockActionIcon(action)}</button>`;
}

function addBlock(type = "text", value = "", storagePath = "", imageSource = "url") {
  const blockList = document.getElementById("blockList");
  if (!blockList) return;

  const blockElement = document.createElement("section");
  blockElement.className = "block-item";
  blockElement.dataset.blockType = type;
  blockElement.dataset.storagePath = storagePath || "";
  blockElement.dataset.imageSource = imageSource || (storagePath ? "file" : "url");
  blockElement.dataset.imageValue = value || "";

  if (type === "text") {
    blockElement.innerHTML = `
      <div class="block-item__head">
        <h4 class="block-item__title">글</h4>
        <div class="block-item__actions">
          ${renderBlockActionButton("up")}
          ${renderBlockActionButton("down")}
          ${renderBlockActionButton("remove", "outline-button")}
        </div>
      </div>
      <textarea class="admin-textarea" placeholder="본문 내용을 입력하세요">${escapeHtmlForTextarea(value)}</textarea>
    `;
  }

  if (type === "image") {
    const isFileBlock = blockElement.dataset.imageSource === "file";
    const badgeLabel = isFileBlock ? "파일 업로드" : "URL 등록";
    const currentFileName = storagePath ? storagePath.split("/").pop() : "";

    blockElement.innerHTML = `
      <div class="block-item__head">
        <h4 class="block-item__title">이미지</h4>
        <div class="block-item__actions">
          ${renderBlockActionButton("up")}
          ${renderBlockActionButton("down")}
          ${renderBlockActionButton("remove", "outline-button")}
        </div>
      </div>

      <div class="block-item__meta">
        <span class="block-item__badge">${badgeLabel}</span>
      </div>

      ${
        isFileBlock
          ? `
            <input class="admin-input block-file-input" type="file" accept="image/*" />
            <p class="block-item__file-name">${currentFileName ? `현재 저장된 파일: ${escapeHtml(currentFileName)}` : ""}</p>
          `
          : `
            <input class="admin-input block-image-input" type="url" placeholder="https://..." value="${escapeHtmlForAttribute(value)}" />
          `
      }

      <div class="block-item__preview ${value ? "" : "is-hidden"}">
        <img src="${escapeHtmlForAttribute(value)}" alt="이미지 미리보기" />
      </div>
    `;

    if (isFileBlock) {
      const input = blockElement.querySelector(".block-file-input");
      input?.addEventListener("change", () => {
        const file = input.files?.[0] || null;
        const fileName = blockElement.querySelector(".block-item__file-name");

        if (fileName) {
          fileName.textContent = file
            ? `선택된 파일: ${file.name}`
            : currentFileName
              ? `현재 저장된 파일: ${currentFileName}`
              : "";
        }

        if (file) {
          const previewUrl = URL.createObjectURL(file);
          blockElement.dataset.imageValue = previewUrl;
          updateImageBlockPreview(blockElement, previewUrl);
          return;
        }

        const fallbackUrl = blockElement.dataset.storagePath
          ? getStoragePublicUrl(blockElement.dataset.storagePath)
          : "";
        blockElement.dataset.imageValue = fallbackUrl;
        updateImageBlockPreview(blockElement, fallbackUrl);
      });
    } else {
      const input = blockElement.querySelector(".block-image-input");
      input?.addEventListener("input", () => {
        blockElement.dataset.storagePath = "";
        blockElement.dataset.imageValue = input.value.trim();
        updateImageBlockPreview(blockElement, input.value.trim());
      });
    }
  }

  blockList.appendChild(blockElement);
  updateBlockLabels();
}

function updateImageBlockPreview(blockElement, value) {
  const preview = blockElement.querySelector(".block-item__preview");
  const image = preview?.querySelector("img");
  if (!preview || !image) return;

  if (!value) {
    preview.classList.add("is-hidden");
    image.src = "";
    return;
  }

  preview.classList.remove("is-hidden");
  image.src = value;
}

function handleBlockListClick(event) {
  const button = event.target.closest("[data-block-action]");
  if (!button) return;

  const block = button.closest(".block-item");
  const blockList = document.getElementById("blockList");
  if (!block || !blockList) return;

  const action = button.dataset.blockAction;

  if (action === "remove") {
    block.remove();
    if (blockList.children.length === 0) addBlock("text");
    updateBlockLabels();
    return;
  }

  if (action === "up") {
    const prev = block.previousElementSibling;
    if (prev) {
      blockList.insertBefore(block, prev);
      updateBlockLabels();
    }
    return;
  }

  if (action === "down") {
    const next = block.nextElementSibling;
    if (next) {
      blockList.insertBefore(next, block);
      updateBlockLabels();
    }
  }
}

function updateBlockLabels() {
  document.querySelectorAll(".block-item").forEach((block) => {
    const title = block.querySelector(".block-item__title");
    if (!title) return;
    title.textContent = block.dataset.blockType === "image" ? "이미지" : "글";
  });
}

function collectBlocksFromForm() {
  const blocks = [];

  document.querySelectorAll(".block-item").forEach((block) => {
    const type = block.dataset.blockType;
    const storagePath = block.dataset.storagePath || "";
    const imageSource = block.dataset.imageSource || "url";

    if (type === "text") {
      const value = block.querySelector("textarea")?.value.trim() || "";
      if (value) blocks.push({ type: "text", value, storagePath: "" });
    }

    if (type === "image") {
      if (imageSource === "url") {
        const value = block.querySelector(".block-image-input")?.value.trim() || "";
        if (value) {
          blocks.push({ type: "image", imageSource: "url", value, storagePath: "" });
        }
      }

      if (imageSource === "file") {
        const file = block.querySelector(".block-file-input")?.files?.[0] || null;
        const previewValue = block.dataset.imageValue || "";

        if (file || storagePath) {
          blocks.push({
            type: "image",
            imageSource: "file",
            value: previewValue,
            storagePath,
            file
          });
        }
      }
    }
  });

  return blocks;
}
