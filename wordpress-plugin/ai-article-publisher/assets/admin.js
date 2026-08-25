(function () {
  if (typeof window.AIAArticlePublisher === "undefined") {
    return;
  }

  const config = window.AIAArticlePublisher;
  const state = { busy: false };
  const maxEditorImageBytes = 2 * 1024 * 1024;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const statusEl = $("#aia-status");
  const resultEl = $("#aia-result");
  const previewEl = $("#aia-preview");
  const previewModalEl = $("#aia-preview-modal");
  const previewModalBodyEl = $("#aia-preview-modal-body");
  const imageWrapEl = $("#aia-image-wrap");
  const imageEmptyEl = $("#aia-image-empty");
  const imagePreviewEl = $("#aia-image-preview");
  const linksListEl = $("#aia-links-list");
  const linkTemplate = $("#aia-link-row-template");
  const categoryCountEl = $("#aia-category-count");

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return entities[character] || character;
    });

  const getEmptyStateMarkup = (message) =>
    `<div class="aia-empty-state"><p>${escapeHtml(message)}</p></div>`;

  const setBusy = (busy, activeButton = null) => {
    state.busy = busy;
    document.body.classList.toggle("aia-is-busy", busy);

    $$(
      ".aia-wrap button, .aia-wrap input, .aia-wrap textarea, .aia-wrap select"
    ).forEach((element) => {
      if (element.type === "hidden") {
        return;
      }
      element.disabled = busy;
    });

    $$(".aia-wrap button[data-busy-label]").forEach((button) => {
      if (!button.dataset.defaultLabel) {
        button.dataset.defaultLabel = button.textContent.trim();
      }
      button.textContent =
        busy && button === activeButton
          ? button.dataset.busyLabel
          : button.dataset.defaultLabel;
    });
  };

  const showStatus = (type, message) => {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.className = `aia-status is-${type}`;
    statusEl.textContent = message;
  };

  const clearStatus = () => {
    if (!statusEl) return;
    statusEl.hidden = true;
    statusEl.className = "aia-status";
    statusEl.textContent = "";
  };

  const setResult = (payload) => {
    if (!resultEl) return;
    resultEl.textContent =
      typeof payload === "string"
        ? payload
        : JSON.stringify(payload, null, 2);
  };

  const setPreviewHtml = (html) => {
    if (!previewEl) return;
    previewEl.innerHTML = html
      ? html
      : getEmptyStateMarkup(
          config.strings?.noDraftYet ||
            "No draft generated yet. Generate a manual draft to preview the article here."
        );
  };

  const clearImagePreview = () => {
    if (!imageWrapEl || !imagePreviewEl) return;
    imageWrapEl.hidden = true;
    imagePreviewEl.removeAttribute("src");
    imagePreviewEl.alt = "";
    if (imageEmptyEl) {
      imageEmptyEl.hidden = false;
    }
  };

  const setImagePreviewSource = (src, altText) => {
    if (!imageWrapEl || !imagePreviewEl || !src) return;
    if (imageEmptyEl) {
      imageEmptyEl.hidden = true;
    }
    imageWrapEl.hidden = false;
    imagePreviewEl.src = src;
    imagePreviewEl.alt = altText || "";
  };

  const setImagePreview = (imageBase64, mimeType, altText) => {
    if (!imageBase64 || !mimeType) {
      clearImagePreview();
      return;
    }
    setImagePreviewSource(`data:${mimeType};base64,${imageBase64}`, altText);
  };

  const getValue = (selector) => {
    if (selector === "#aia-manual-html" && window.tinymce) {
      const editor = window.tinymce.get("aia-manual-html");
      if (editor && !editor.isHidden()) {
        return editor.getContent();
      }
    }
    const element = $(selector);
    return element ? element.value : "";
  };

  const setValue = (selector, value) => {
    if (selector === "#aia-manual-html" && window.tinymce) {
      const editor = window.tinymce.get("aia-manual-html");
      if (editor) {
        editor.setContent(value ?? "");
      }
    }
    const element = $(selector);
    if (element) {
      element.value = value ?? "";
    }
  };

  const slugify = (value) =>
    String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120);

  const appendHtmlToManualEditor = (htmlToAppend) => {
    const currentHtml = getValue("#aia-manual-html").trim();
    const nextHtml = `${currentHtml}\n${htmlToAppend}`.trim();
    setValue("#aia-manual-html", nextHtml);
    setPreviewHtml(nextHtml);
  };

  const buildImageFigure = (src, altText) =>
    `<figure class="wp-block-image size-large"><img src="${escapeHtml(
      src
    )}" alt="${escapeHtml(altText || "")}" loading="lazy" decoding="async" /></figure>`;

  const insertEditorImage = (src, altText) => {
    if (!src) {
      throw new Error("Add an image URL or upload an image first.");
    }
    appendHtmlToManualEditor(buildImageFigure(src, altText));
  };

  const localDateTimeToIso = (value) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Invalid schedule date/time.");
    }
    return parsed.toISOString();
  };

  const collectSeoPayload = () => ({
    seoTitle: getValue("#aia-seo-title").trim(),
    metaDescription: getValue("#aia-meta-description").trim(),
    focusKeyword: getValue("#aia-focus-keyword").trim(),
    additionalKeywords: getValue("#aia-additional-keywords")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    canonicalUrl: getValue("#aia-canonical-url").trim(),
    og: {
      title: getValue("#aia-og-title").trim(),
      description: getValue("#aia-og-description").trim(),
      imageUrl: getValue("#aia-og-image-url").trim(),
    },
    twitter: {
      title: getValue("#aia-twitter-title").trim(),
      description: getValue("#aia-twitter-description").trim(),
      imageUrl: getValue("#aia-twitter-image-url").trim(),
    },
  });

  const populateSeoPayload = (seo) => {
    if (!seo) return;
    setValue("#aia-seo-title", seo.seoTitle || "");
    setValue("#aia-meta-description", seo.metaDescription || "");
    setValue("#aia-focus-keyword", seo.focusKeyword || "");
    setValue(
      "#aia-additional-keywords",
      Array.isArray(seo.additionalKeywords) ? seo.additionalKeywords.join(", ") : ""
    );
    setValue("#aia-canonical-url", seo.canonicalUrl || "");
    setValue("#aia-og-title", seo.og?.title || "");
    setValue("#aia-og-description", seo.og?.description || "");
    setValue("#aia-og-image-url", seo.og?.imageUrl || "");
    setValue("#aia-twitter-title", seo.twitter?.title || "");
    setValue("#aia-twitter-description", seo.twitter?.description || "");
    setValue("#aia-twitter-image-url", seo.twitter?.imageUrl || "");
  };

  const collectSharedPayload = () => ({
    selectedCategoryIds: $$(".aia-category-checkbox:checked").map((checkbox) =>
      Number(checkbox.value)
    ),
    newCategoryName: getValue("#aia-new-category-name").trim(),
    seoProvider: getValue("#aia-seo-provider") || "None",
    seoPayload: collectSeoPayload(),
  });

  const getPublishWarnings = () => {
    const warnings = [];
    const htmlText = getValue("#aia-manual-html").replace(/<[^>]+>/g, " ");
    const seoTitle = getValue("#aia-seo-title").trim();
    const metaDescription = getValue("#aia-meta-description").trim();
    const focusKeyword = getValue("#aia-focus-keyword").trim();
    if (seoTitle.length > 65) warnings.push("SEO title is longer than 65 characters.");
    if (metaDescription.length < 120 || metaDescription.length > 160) {
      warnings.push("Meta description is outside the 120-160 character range.");
    }
    if (focusKeyword && !htmlText.toLowerCase().includes(focusKeyword.toLowerCase())) {
      warnings.push("Focus keyword was not found in the article body.");
    }
    if (!getValue("#aia-manual-html").trim()) warnings.push("Article HTML is empty.");
    return warnings;
  };

  const confirmPublishWarnings = () => {
    const warnings = getPublishWarnings();
    if (!warnings.length) return true;
    return window.confirm(`Review these validation warnings before publishing:\n\n${warnings.join("\n")}\n\nContinue?`);
  };

  const updateCategoryCount = () => {
    if (!categoryCountEl) return;
    const count = $$(".aia-category-checkbox:checked").length;
    categoryCountEl.textContent = `${count} selected`;
  };

  const createLinkRow = (values = {}) => {
    if (!linkTemplate || !linksListEl) return;
    const fragment = linkTemplate.content.cloneNode(true);
    const row = fragment.querySelector(".aia-link-row");
    row.querySelector(".aia-link-url").value = values.url || "";
    row.querySelector(".aia-link-anchor").value = values.anchorText || "";
    row.querySelector(".aia-link-follow").value = values.followType || "dofollow";
    row.querySelector(".aia-link-required").checked =
      typeof values.required === "boolean" ? values.required : true;
    row.querySelector(".aia-link-remove").addEventListener("click", () => {
      row.remove();
      if (!linksListEl.children.length) {
        createLinkRow();
      }
    });
    linksListEl.appendChild(fragment);
  };

  const collectLinks = () =>
    $$(".aia-link-row").map((row) => ({
      url: row.querySelector(".aia-link-url").value.trim(),
      anchorText: row.querySelector(".aia-link-anchor").value.trim(),
      followType: row.querySelector(".aia-link-follow").value || "dofollow",
      required: row.querySelector(".aia-link-required").checked,
    }));

  const request = async (action, payload) => {
    const body = new FormData();
    body.append("action", action);
    body.append("nonce", config.nonce);
    body.append("payload", JSON.stringify(payload));

    const response = await fetch(config.ajaxUrl, {
      method: "POST",
      credentials: "same-origin",
      body,
    });

    let data;
    try {
      data = await response.json();
    } catch (error) {
      throw new Error(`Unexpected response while running ${action}.`);
    }

    if (!response.ok || !data.success) {
      throw new Error(data?.data?.message || `Request failed with ${response.status}`);
    }
    return data.data;
  };

  const withBusy = async (work, activeButton = null) => {
    if (state.busy) return;
    setBusy(true, activeButton);
    clearStatus();
    try {
      await work();
    } catch (error) {
      showStatus("error", error instanceof Error ? error.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  };

  const activateTab = (target, persist = true) => {
    const tabs = $$("button.aia-tab");
    const panels = $$(".aia-tabpanel");
    const selectedTab = tabs.find((tab) => tab.dataset.aiaTab === target);
    if (!selectedTab) {
      return;
    }

    tabs.forEach((tab) => {
      const isActive = tab === selectedTab;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
      tab.tabIndex = isActive ? 0 : -1;
    });

    panels.forEach((panel) => {
      const isActive = panel.dataset.aiaPanel === target;
      panel.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
    });

    if (persist && config.tabStorageKey) {
      try {
        window.localStorage.setItem(config.tabStorageKey, target);
      } catch (error) {
        // Ignore localStorage failures in locked-down environments.
      }
    }
  };

  const bindTabs = () => {
    const tabs = $$("button.aia-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => activateTab(tab.dataset.aiaTab));
      tab.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
          return;
        }
        event.preventDefault();
        const currentIndex = tabs.indexOf(tab);
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
        tabs[nextIndex].focus();
        activateTab(tabs[nextIndex].dataset.aiaTab);
      });
    });

    let initialTab = "manual";
    if (config.tabStorageKey) {
      try {
        initialTab = window.localStorage.getItem(config.tabStorageKey) || initialTab;
      } catch (error) {
        initialTab = "manual";
      }
    }
    activateTab(initialTab, false);
  };

  const bindScheduleFields = () => {
    [
      ["#aia-manual-status", "#aia-manual-schedule"],
      ["#aia-google-status", "#aia-google-schedule"],
      ["#aia-news-status", "#aia-news-schedule"],
    ].forEach(([statusSelector, scheduleSelector]) => {
      const statusField = $(statusSelector);
      const scheduleField = $(scheduleSelector);
      if (!statusField || !scheduleField) return;
      const sync = () => {
        scheduleField.disabled = statusField.value !== "future";
      };
      sync();
      statusField.addEventListener("change", sync);
    });
  };

  const bindSharedHelpers = () => {
    $$(".aia-category-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", updateCategoryCount);
    });
    updateCategoryCount();
  };

  const bindSlugField = () => {
    const titleField = $("#aia-manual-title");
    const slugField = $("#aia-manual-slug");
    if (!titleField || !slugField) return;
    let slugEdited = false;
    titleField.addEventListener("input", () => {
      if (!slugEdited) {
        slugField.value = slugify(titleField.value);
      }
    });
    slugField.addEventListener("input", () => {
      slugEdited = true;
      slugField.value = slugify(slugField.value);
    });
  };

  const bindEditorImages = () => {
    $("#aia-insert-editor-image-url")?.addEventListener("click", () => {
      try {
        insertEditorImage(
          getValue("#aia-editor-image-url").trim(),
          getValue("#aia-editor-image-alt").trim()
        );
        setValue("#aia-editor-image-url", "");
        setValue("#aia-editor-image-alt", "");
        showStatus("success", "Image inserted into the article editor.");
      } catch (error) {
        showStatus("error", error.message || "Failed to insert image.");
      }
    });

    $("#aia-editor-image-file")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        showStatus("error", "Choose an image file.");
        return;
      }
      if (file.size > maxEditorImageBytes) {
        showStatus("error", "Choose an image under 2 MB for manual editor uploads.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          insertEditorImage(
            String(reader.result || ""),
            getValue("#aia-editor-image-alt").trim() || file.name.replace(/\.[^.]+$/, "")
          );
          setValue("#aia-editor-image-alt", "");
          showStatus("success", "Image added. It will be uploaded to WordPress media during publish.");
        } catch (error) {
          showStatus("error", error.message || "Failed to insert image.");
        }
      };
      reader.onerror = () => showStatus("error", "Could not read image file.");
      reader.readAsDataURL(file);
    });

    $("#aia-insert-generated-image")?.addEventListener("click", () => {
      const imageBase64 = getValue("#aia-manual-image-base64");
      const mimeType = getValue("#aia-manual-image-mime");
      if (!imageBase64 || !mimeType) {
        showStatus("error", "Generate an image first.");
        return;
      }
      insertEditorImage(
        `data:${mimeType};base64,${imageBase64}`,
        getValue("#aia-editor-image-alt").trim() || getValue("#aia-manual-title").trim()
      );
      setValue("#aia-editor-image-alt", "");
      showStatus("success", "Generated image inserted into the article body.");
    });
  };

  const bindClassicEditorPreview = () => {
    const bindTinyMce = () => {
      if (!window.tinymce) return;
      const editor = window.tinymce.get("aia-manual-html");
      if (!editor || editor.aiaPreviewBound) return;
      editor.aiaPreviewBound = true;
      editor.on("change keyup input undo redo", () => {
        setPreviewHtml(editor.getContent());
      });
    };
    bindTinyMce();
    window.setTimeout(bindTinyMce, 500);
  };

  const bindManualActions = () => {
    $("#aia-generate-draft")?.addEventListener("click", (event) =>
      withBusy(async () => {
        const data = await request("aia_generate_article", {
          title: getValue("#aia-manual-title").trim(),
          brief: getValue("#aia-manual-brief").trim(),
          keywords: getValue("#aia-manual-keywords")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          focusKeyword: getValue("#aia-focus-keyword").trim(),
          tone: getValue("#aia-manual-tone") || config.defaultTone || "Professional",
          wordCount: Number(getValue("#aia-manual-word-count") || 1200),
          links: collectLinks(),
        });

        setValue("#aia-manual-html", data.html || "");
        setValue("#aia-manual-excerpt", data.meta?.excerpt || "");
        setValue(
          "#aia-manual-tags",
          Array.isArray(data.meta?.suggestedTags)
            ? data.meta.suggestedTags.join(", ")
            : ""
        );
        populateSeoPayload(data.meta?.seo || {});
        setPreviewHtml(data.html || "");
        setResult(data);
        activateTab("manual");
        showStatus("success", "Draft generated.");
      }, event.currentTarget)
    );

    $("#aia-generate-image")?.addEventListener("click", (event) =>
      withBusy(async () => {
        const data = await request("aia_generate_image", {
          title: getValue("#aia-manual-title").trim(),
          brief: getValue("#aia-manual-brief").trim(),
        });
        setValue("#aia-manual-image-base64", data.imageBase64 || "");
        setValue("#aia-manual-image-mime", data.mimeType || "");
        setImagePreview(data.imageBase64, data.mimeType, data.altTextSuggestion || "");
        setResult(data);
        showStatus("success", "Featured image generated.");
      }, event.currentTarget)
    );

    $("#aia-publish-manual")?.addEventListener("click", (event) =>
      withBusy(async () => {
        if ((getValue("#aia-manual-status") || "draft") === "publish" && !confirmPublishWarnings()) {
          return;
        }
        const data = await request("aia_publish_post", {
          ...collectSharedPayload(),
          title: getValue("#aia-manual-title").trim(),
          slug: slugify(getValue("#aia-manual-slug") || getValue("#aia-manual-title")),
          brief: getValue("#aia-manual-brief").trim(),
          html: getValue("#aia-manual-html"),
          excerpt: getValue("#aia-manual-excerpt").trim(),
          status: getValue("#aia-manual-status") || "draft",
          scheduledAt:
            getValue("#aia-manual-status") === "future"
              ? localDateTimeToIso(getValue("#aia-manual-schedule"))
              : "",
          featuredImageBase64: getValue("#aia-manual-image-base64"),
          featuredImageMime: getValue("#aia-manual-image-mime"),
          inPostImageCount: Number(getValue("#aia-manual-inline-images") || 0),
          suggestedTags: getValue("#aia-manual-tags"),
          links: collectLinks(),
        });
        setResult(data);
        showStatus("success", config.strings.manualSaved);
      }, event.currentTarget)
    );
  };

  const collectClaudePayload = () => ({
    title: getValue("#aia-claude-title").trim(),
    keyword: getValue("#aia-claude-keyword").trim(),
    tone: getValue("#aia-claude-tone").trim() || config.defaultTone || "Professional",
    articleType: getValue("#aia-claude-type").trim() || "SEO article",
    country: getValue("#aia-claude-country").trim(),
    audience: getValue("#aia-claude-audience").trim(),
    wordCount: Number(getValue("#aia-claude-word-count") || 1200),
    requiredLinks: getValue("#aia-claude-required-links"),
    optionalLinks: getValue("#aia-claude-optional-links"),
    seoInstructions: getValue("#aia-claude-seo-instructions").trim(),
  });

  const applyArticleToEditor = (data) => {
    setValue("#aia-manual-title", data.meta?.title || getValue("#aia-claude-title"));
    setValue("#aia-manual-brief", data.meta?.excerpt || "");
    setValue("#aia-manual-html", data.html || "");
    setValue("#aia-manual-excerpt", data.meta?.excerpt || "");
    setValue(
      "#aia-manual-tags",
      Array.isArray(data.meta?.suggestedTags) ? data.meta.suggestedTags.join(", ") : ""
    );
    populateSeoPayload(data.meta?.seo || {});
    setPreviewHtml(data.html || "");
  };

  const bindClaudeActions = () => {
    $("#aia-generate-claude-prompt")?.addEventListener("click", (event) =>
      withBusy(async () => {
        const data = await request("aia_generate_claude_prompt", collectClaudePayload());
        setValue("#aia-claude-prompt", data.prompt || "");
        setResult({ mode: "Claude Desktop Manual", promptReady: true });
        showStatus("success", "Claude prompt generated.");
      }, event.currentTarget)
    );

    $("#aia-copy-claude-prompt")?.addEventListener("click", async () => {
      const prompt = getValue("#aia-claude-prompt");
      if (!prompt) {
        showStatus("warning", "Generate a Claude prompt first.");
        return;
      }
      await navigator.clipboard?.writeText(prompt);
      showStatus("success", "Prompt copied.");
    });

    $("#aia-validate-claude-json")?.addEventListener("click", (event) =>
      withBusy(async () => {
        const data = await request("aia_validate_claude_json", {
          ...collectClaudePayload(),
          json: getValue("#aia-claude-json"),
        });
        applyArticleToEditor(data);
        setResult(data.validation || data);
        showStatus(data.validation?.warnings?.length ? "warning" : "success", "Claude JSON validated and previewed.");
      }, event.currentTarget)
    );

    const publishClaude = (status, button) =>
      withBusy(async () => {
        const data = await request("aia_validate_claude_json", {
          ...collectClaudePayload(),
          json: getValue("#aia-claude-json"),
        });
        applyArticleToEditor(data);
        if (status === "publish" && !confirmPublishWarnings()) {
          return;
        }
        const published = await request("aia_publish_post", {
          ...collectSharedPayload(),
          title: data.meta?.title || getValue("#aia-claude-title").trim(),
          brief: data.meta?.excerpt || "",
          html: data.html || "",
          excerpt: data.meta?.excerpt || "",
          status,
          scheduledAt: "",
          featuredImageBase64: getValue("#aia-manual-image-base64"),
          featuredImageMime: getValue("#aia-manual-image-mime"),
          inPostImageCount: 0,
          suggestedTags: Array.isArray(data.meta?.suggestedTags)
            ? data.meta.suggestedTags.join(", ")
            : "",
          requiredLinks: getValue("#aia-claude-required-links"),
          optionalLinks: getValue("#aia-claude-optional-links"),
        });
        setResult(published);
        showStatus("success", status === "publish" ? "Claude article published." : "Claude draft created.");
      }, button);

    $("#aia-create-claude-draft")?.addEventListener("click", (event) =>
      publishClaude("draft", event.currentTarget)
    );
    $("#aia-publish-claude")?.addEventListener("click", (event) =>
      publishClaude("publish", event.currentTarget)
    );
  };

  const bindQualityTools = () => {
    $$("[data-aia-tool]").forEach((button) => {
      button.addEventListener("click", (event) =>
        withBusy(async () => {
          const data = await request("aia_ai_tool", {
            tool: button.dataset.aiaTool,
            title: getValue("#aia-manual-title").trim(),
            brief: getValue("#aia-manual-brief").trim(),
            html: getValue("#aia-manual-html"),
            focusKeyword: getValue("#aia-focus-keyword").trim(),
          });
          if (["improve_draft", "humanize", "full_article"].includes(button.dataset.aiaTool)) {
            setValue("#aia-manual-html", data.content || "");
            setPreviewHtml(data.content || "");
          } else if (button.dataset.aiaTool === "faq") {
            const nextHtml = `${getValue("#aia-manual-html")}\n${data.content || ""}`.trim();
            setValue("#aia-manual-html", nextHtml);
            setPreviewHtml(nextHtml);
          }
          setResult(data);
          showStatus("success", "Tool output generated.");
        }, event.currentTarget)
      );
    });

    $("#aia-copy-og-to-twitter")?.addEventListener("click", () => {
      setValue("#aia-twitter-title", getValue("#aia-og-title"));
      setValue("#aia-twitter-description", getValue("#aia-og-description"));
      setValue("#aia-twitter-image-url", getValue("#aia-og-image-url"));
      showStatus("success", "Facebook/Open Graph data copied to X.");
    });

    $("#aia-open-preview-modal")?.addEventListener("click", () => {
      if (!previewModalEl || !previewModalBodyEl) return;
      previewModalBodyEl.innerHTML = getValue("#aia-manual-html")
        ? getValue("#aia-manual-html")
        : previewEl?.innerHTML || "";
      previewModalEl.hidden = false;
      document.body.classList.add("aia-modal-open");
    });

    $$("[data-aia-close-modal]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!previewModalEl) return;
        previewModalEl.hidden = true;
        document.body.classList.remove("aia-modal-open");
      });
    });
  };

  const bindMcpDashboard = () => {
    $("#aia-copy-mcp-url")?.addEventListener("click", async () => {
      const url = getValue("#aia-mcp-url");
      if (!url) return;
      await navigator.clipboard?.writeText(url);
      showStatus("success", "MCP URL copied.");
    });

    $("#aia-test-mcp-connection")?.addEventListener("click", (event) =>
      withBusy(async () => {
        const url = getValue("#aia-mcp-url");
        if (!url) {
          throw new Error("MCP URL is not available.");
        }
        const response = await fetch(url, { credentials: "same-origin" });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || "MCP connection test failed.");
        }
        setResult(data);
        showStatus("success", "MCP endpoint responded successfully.");
      }, event.currentTarget)
    );
  };

  const bindImportActions = () => {
    $("#aia-publish-google")?.addEventListener("click", (event) =>
      withBusy(async () => {
        const data = await request("aia_import_google_doc", {
          ...collectSharedPayload(),
          document: getValue("#aia-google-document").trim(),
          status: getValue("#aia-google-status") || "draft",
          scheduledAt:
            getValue("#aia-google-status") === "future"
              ? localDateTimeToIso(getValue("#aia-google-schedule"))
              : "",
        });
        setResult(data);
        if (data.featuredImage?.sourceUrl) {
          setImagePreviewSource(data.featuredImage.sourceUrl, data.title || "");
        } else {
          clearImagePreview();
        }
        showStatus("success", config.strings.googleSaved);
      }, event.currentTarget)
    );

    $("#aia-run-news")?.addEventListener("click", (event) =>
      withBusy(async () => {
        const data = await request("aia_news_autopilot", {
          ...collectSharedPayload(),
          category: getValue("#aia-news-category"),
          query: getValue("#aia-news-query").trim(),
          language: getValue("#aia-news-language").trim() || "en",
          maxArticles: Number(getValue("#aia-news-max-articles") || 1),
          tone: getValue("#aia-news-tone") || config.defaultTone || "Professional",
          wordCount: Number(getValue("#aia-news-word-count") || 1200),
          status: getValue("#aia-news-status") || "publish",
          scheduledAt:
            getValue("#aia-news-status") === "future"
              ? localDateTimeToIso(getValue("#aia-news-schedule"))
              : "",
          inPostImageCount: Number(getValue("#aia-news-inline-images") || 0),
        });
        setResult(data);
        showStatus(
          data.failed > 0 ? "warning" : "success",
          data.failed > 0
            ? `${data.published} article(s) published, ${data.failed} failed.`
            : config.strings.newsSaved
        );
      }, event.currentTarget)
    );
  };

  const init = () => {
    bindTabs();
    bindScheduleFields();
    bindSharedHelpers();
    bindSlugField();
    bindEditorImages();
    bindManualActions();
    bindClaudeActions();
    bindQualityTools();
    bindMcpDashboard();
    bindImportActions();

    $("#aia-manual-html")?.addEventListener("input", (event) =>
      setPreviewHtml(event.target.value)
    );
    bindClassicEditorPreview();
    $("#aia-add-link")?.addEventListener("click", () => createLinkRow());

    if (!linksListEl?.children.length) {
      createLinkRow();
    }

    clearStatus();
    clearImagePreview();
    setPreviewHtml("");
    setResult(config.strings?.noActionsYet || "No actions run yet.");
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
