/* =========================================================
   data load / save
========================================================= */
function hasMeaningfulText(value) {
  return /\S/.test(String(value || ""));
}

function resolveHeroLogoText(value) {
  return hasMeaningfulText(value) ? String(value) : DEFAULT_HERO_LOGO_TEXT;
}

function resolveHeroLogoSize(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_HERO_LOGO_SIZE;
  return Math.min(Math.max(Math.round(numeric), 60), 160);
}

function resolveHeroLogoPosition(value) {
  return VALID_HERO_LOGO_POSITIONS.has(value) ? value : DEFAULT_HERO_LOGO_POSITION;
}

function resolvePostMusicStoragePath(value) {
  return String(value || "").trim();
}

function resolvePostMusicFileName(value) {
  return String(value || "").trim();
}

function resolvePostMusicContentType(value) {
  return String(value || "").trim();
}

function getImagePublicUrl(path) {
  if (!path || !supabaseClient) return "";
  const { data } = supabaseClient.storage.from(CONFIG.imageBucket).getPublicUrl(path);
  return data?.publicUrl || "";
}

function getAudioPublicUrl(path) {
  if (!path || !supabaseClient) return "";
  const { data } = supabaseClient.storage.from(CONFIG.audioBucket).getPublicUrl(path);
  return data?.publicUrl || "";
}

function getStoragePublicUrl(path) {
  return getImagePublicUrl(path) || getAudioPublicUrl(path);
}

function getLetterMusicUrl(letter) {
  const storagePath = resolvePostMusicStoragePath(letter?.musicStoragePath || "");
  if (!storagePath) return "";
  return getAudioPublicUrl(storagePath);
}

function hasLetterMusic(letter) {
  return Boolean(getLetterMusicUrl(letter));
}

async function removeFilesFromBucket(bucketName, paths) {
  const uniquePaths = [...new Set((paths || []).filter(Boolean))];
  if (!uniquePaths.length) return;

  const { error } = await supabaseClient.storage.from(bucketName).remove(uniquePaths);
  if (error) {
    console.warn(`스토리지 파일 삭제 실패(${bucketName}):`, error.message);
  }
}

async function removeFilesFromStorage(paths) {
  const uniquePaths = [...new Set((paths || []).filter(Boolean))];
  if (!uniquePaths.length) return;

  await Promise.allSettled([
    removeFilesFromBucket(CONFIG.imageBucket, uniquePaths),
    removeFilesFromBucket(CONFIG.audioBucket, uniquePaths)
  ]);
}

async function loadSiteSettings() {
  if (!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from("site_settings")
    .select("key, value_text, value_json")
    .in("key", ["hero_image", "hero_logo_text", "hero_logo_style"]);

  if (error) throw error;

  const rows = data || [];
  const heroImageRow = rows.find((row) => row.key === "hero_image");
  const heroTextRow = rows.find((row) => row.key === "hero_logo_text");
  const heroStyleRow = rows.find((row) => row.key === "hero_logo_style");

  const heroImageJson = heroImageRow?.value_json || {};
  const heroTextJson = heroTextRow?.value_json || {};
  const heroStyleJson = heroStyleRow?.value_json || {};

  state.settings.heroImageUrl =
    heroImageRow?.value_text || heroImageJson.url || DEFAULT_HERO_IMAGE;
  state.settings.heroImageStoragePath = heroImageJson.storage_path || "";
  state.settings.heroLogoText = resolveHeroLogoText(heroTextRow?.value_text ?? heroTextJson.text);
  state.settings.heroLogoSize = resolveHeroLogoSize(
    heroStyleJson.size_percent ?? heroStyleRow?.value_text
  );
  state.settings.heroLogoPosition = resolveHeroLogoPosition(heroStyleJson.position);
  cacheHeroSettings();
}

async function loadPosts() {
  if (!supabaseClient) return;

  const { data: posts, error: postsError } = await supabaseClient
    .from("mission_posts")
    .select("id, title, bg_music_storage_path, bg_music_file_name, bg_music_content_type, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (postsError) throw postsError;

  const postIds = (posts || []).map((post) => post.id);
  let blockRows = [];

  if (postIds.length > 0) {
    const { data, error } = await supabaseClient
      .from("mission_post_blocks")
      .select("id, post_id, block_order, block_type, content, storage_path")
      .in("post_id", postIds)
      .order("block_order", { ascending: true });

    if (error) throw error;
    blockRows = data || [];
  }

  state.letters = (posts || []).map((post) => {
    const musicStoragePath = resolvePostMusicStoragePath(post.bg_music_storage_path);
    const musicFileName = resolvePostMusicFileName(post.bg_music_file_name);
    const musicContentType = resolvePostMusicContentType(post.bg_music_content_type);

    const blocks = blockRows
      .filter((block) => block.post_id === post.id)
      .map((block) => ({
        id: block.id,
        type: block.block_type,
        value:
          block.block_type === "image"
            ? resolveImageBlockValue(block.content || "", block.storage_path || "")
            : block.content || "",
        storagePath: block.storage_path || "",
        imageSource: block.block_type === "image" ? (block.storage_path ? "file" : "url") : ""
      }));

    return {
      id: post.id,
      title: post.title,
      musicStoragePath,
      musicFileName,
      musicContentType,
      musicUrl: musicStoragePath ? getAudioPublicUrl(musicStoragePath) : "",
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      blocks
    };
  });
}

async function saveHeroSettings({ imageUrl, logoText, logoSize, logoPosition }) {
  const resolvedImageUrl = imageUrl || DEFAULT_HERO_IMAGE;
  const resolvedLogoText = resolveHeroLogoText(logoText);
  const resolvedLogoSize = resolveHeroLogoSize(logoSize);
  const resolvedLogoPosition = resolveHeroLogoPosition(logoPosition);

  const payload = [
    {
      key: "hero_image",
      value_text: resolvedImageUrl,
      value_json: {
        url: resolvedImageUrl,
        storage_path: state.settings.heroImageStoragePath || ""
      }
    },
    {
      key: "hero_logo_text",
      value_text: resolvedLogoText,
      value_json: {
        text: resolvedLogoText
      }
    },
    {
      key: "hero_logo_style",
      value_text: String(resolvedLogoSize),
      value_json: {
        size_percent: resolvedLogoSize,
        position: resolvedLogoPosition
      }
    }
  ];

  const { error } = await supabaseClient.from("site_settings").upsert(payload, {
    onConflict: "key"
  });

  if (error) throw error;

  state.settings.heroImageUrl = resolvedImageUrl;
  state.settings.heroLogoText = resolvedLogoText;
  state.settings.heroLogoSize = resolvedLogoSize;
  state.settings.heroLogoPosition = resolvedLogoPosition;
  cacheHeroSettings();
}

async function createPostInSupabase(payload) {
  const music = payload.music || {};

  const { data: insertedPost, error: postError } = await supabaseClient
    .from("mission_posts")
    .insert({
      title: payload.title,
      bg_music_storage_path: music.storagePath || null,
      bg_music_file_name: music.fileName || null,
      bg_music_content_type: music.contentType || null
    })
    .select("id")
    .single();

  if (postError) throw postError;

  if (payload.blocks.length > 0) {
    const rows = payload.blocks.map((block, index) => ({
      post_id: insertedPost.id,
      block_order: index + 1,
      block_type: block.type,
      content: block.value,
      storage_path: block.storagePath || null
    }));

    const { error: blockError } = await supabaseClient.from("mission_post_blocks").insert(rows);
    if (blockError) throw blockError;
  }

  return insertedPost.id;
}

async function updatePostInSupabase(payload) {
  const previous = getLetterById(payload.id);
  const music = payload.music || {};

  const { error: postError } = await supabaseClient
    .from("mission_posts")
    .update({
      title: payload.title,
      bg_music_storage_path: music.storagePath || null,
      bg_music_file_name: music.fileName || null,
      bg_music_content_type: music.contentType || null
    })
    .eq("id", payload.id);

  if (postError) throw postError;

  const removableImagePaths = (previous?.blocks || [])
    .filter((block) => block.type === "image" && block.storagePath)
    .map((block) => block.storagePath);

  const { error: deleteBlocksError } = await supabaseClient
    .from("mission_post_blocks")
    .delete()
    .eq("post_id", payload.id);

  if (deleteBlocksError) throw deleteBlocksError;

  if (payload.blocks.length > 0) {
    const rows = payload.blocks.map((block, index) => ({
      post_id: payload.id,
      block_order: index + 1,
      block_type: block.type,
      content: block.value,
      storage_path: block.storagePath || null
    }));

    const { error: insertBlocksError } = await supabaseClient.from("mission_post_blocks").insert(rows);
    if (insertBlocksError) throw insertBlocksError;
  }

  const keptImagePaths = new Set(
    payload.blocks.filter((block) => block.storagePath).map((block) => block.storagePath)
  );
  await removeFilesFromBucket(
    CONFIG.imageBucket,
    removableImagePaths.filter((path) => !keptImagePaths.has(path))
  );

  const previousMusicPath = resolvePostMusicStoragePath(previous?.musicStoragePath);
  const nextMusicPath = resolvePostMusicStoragePath(music.storagePath);
  if (previousMusicPath && previousMusicPath !== nextMusicPath) {
    await removeFilesFromBucket(CONFIG.audioBucket, [previousMusicPath]);
  }
}

async function deletePostInSupabase(letter) {
  const removableImagePaths = (letter.blocks || [])
    .filter((block) => block.type === "image" && block.storagePath)
    .map((block) => block.storagePath);

  const removableAudioPaths = letter?.musicStoragePath ? [letter.musicStoragePath] : [];

  const { error } = await supabaseClient.from("mission_posts").delete().eq("id", letter.id);
  if (error) throw error;

  await removeFilesFromBucket(CONFIG.imageBucket, removableImagePaths);
  await removeFilesFromBucket(CONFIG.audioBucket, removableAudioPaths);
}

function resolveImageBlockValue(rawValue = "", storagePath = "") {
  if (storagePath) return getImagePublicUrl(storagePath);
  return rawValue || "";
}

function getFileExtension(filename = "") {
  const sanitized = String(filename).split("?")[0];
  const lastDotIndex = sanitized.lastIndexOf(".");
  if (lastDotIndex < 0) return "";
  return sanitized.slice(lastDotIndex + 1).toLowerCase();
}

function createPostImageStoragePath(file) {
  const extension = getFileExtension(file?.name || "") || "jpg";
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  return `posts/${year}/${month}/${crypto.randomUUID()}.${extension}`;
}

function createPostAudioStoragePath(file) {
  const extension = getFileExtension(file?.name || "") || "mp3";
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  return `posts/${year}/${month}/${crypto.randomUUID()}.${extension}`;
}

async function uploadImageFileToStorage(file) {
  if (!(file instanceof File)) {
    throw new Error("업로드할 이미지 파일을 찾을 수 없습니다.");
  }

  const storagePath = createPostImageStoragePath(file);
  const { error } = await supabaseClient.storage.from(CONFIG.imageBucket).upload(storagePath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined
  });

  if (error) throw error;

  return {
    storagePath,
    publicUrl: getImagePublicUrl(storagePath)
  };
}

async function uploadAudioFileToStorage(file) {
  if (!(file instanceof File)) {
    throw new Error("업로드할 오디오 파일을 찾을 수 없습니다.");
  }

  const storagePath = createPostAudioStoragePath(file);
  const { error } = await supabaseClient.storage.from(CONFIG.audioBucket).upload(storagePath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "audio/mpeg"
  });

  if (error) throw error;

  return {
    storagePath,
    publicUrl: getAudioPublicUrl(storagePath),
    fileName: file.name,
    contentType: file.type || "audio/mpeg"
  };
}

async function preparePostMusicForSave(musicInput = {}) {
  const uploadedPaths = [];

  if (musicInput.file instanceof File) {
    const uploaded = await uploadAudioFileToStorage(musicInput.file);
    uploadedPaths.push(uploaded.storagePath);

    return {
      music: {
        storagePath: uploaded.storagePath,
        fileName: uploaded.fileName,
        contentType: uploaded.contentType,
        publicUrl: uploaded.publicUrl
      },
      uploadedPaths
    };
  }

  if (musicInput.removeRequested) {
    return {
      music: {
        storagePath: "",
        fileName: "",
        contentType: "",
        publicUrl: ""
      },
      uploadedPaths
    };
  }

  if (musicInput.existingStoragePath) {
    return {
      music: {
        storagePath: musicInput.existingStoragePath,
        fileName: musicInput.existingFileName || musicInput.existingStoragePath.split("/").pop() || "",
        contentType: musicInput.existingContentType || "audio/mpeg",
        publicUrl: getAudioPublicUrl(musicInput.existingStoragePath)
      },
      uploadedPaths
    };
  }

  return {
    music: {
      storagePath: "",
      fileName: "",
      contentType: "",
      publicUrl: ""
    },
    uploadedPaths
  };
}

async function preparePostBlocksForSave(blocks) {
  const preparedBlocks = [];
  const uploadedPaths = [];

  for (const block of blocks) {
    if (block.type === "text") {
      preparedBlocks.push({ type: "text", value: block.value, storagePath: "" });
      continue;
    }

    if (block.type !== "image") continue;

    if (block.imageSource === "url") {
      if (!block.value) continue;

      preparedBlocks.push({
        type: "image",
        value: block.value,
        storagePath: ""
      });
      continue;
    }

    if (block.imageSource === "file") {
      if (block.file instanceof File) {
        const uploaded = await uploadImageFileToStorage(block.file);
        uploadedPaths.push(uploaded.storagePath);
        preparedBlocks.push({
          type: "image",
          value: uploaded.publicUrl,
          storagePath: uploaded.storagePath
        });
        continue;
      }

      if (block.storagePath) {
        preparedBlocks.push({
          type: "image",
          value: getImagePublicUrl(block.storagePath),
          storagePath: block.storagePath
        });
      }
    }
  }

  return {
    blocks: preparedBlocks,
    uploadedPaths
  };
}
