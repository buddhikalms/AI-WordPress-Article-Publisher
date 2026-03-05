(function () {
  if (typeof window.AIAArticlePublisher === "undefined") {
    return;
  }

  const config = window.AIAArticlePublisher;
  const state = { busy: false };
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const statusEl = $("#aia-status");
  const resultEl = $("#aia-result");
  const previewEl = $("#aia-preview");
  const imageWrapEl = $("#aia-image-wrap");
  const imagePreviewEl = $("#aia-image-preview");
  const linksListEl = $("#aia-links-list");
  const linkTemplate = $("#aia-link-row-template");

  const setBusy = (busy) => {
    state.busy = busy;
    $$("button").forEach((button) => {
      button.disabled = busy;
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
      typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  };

  const setPreviewHtml = (html) => {
    if (!previewEl) return;
    previewEl.innerHTML = html || "<p>No draft generated yet.</p>";
  };

  const setImagePreview = (imageBase64, mimeType, altText) => {
    if (!imageWrapEl || !imagePreviewEl) return;
    if (!imageBase64 || !mimeType) {
      imageWrapEl.hidden = true;
      imagePreviewEl.removeAttribute("src");
      return;
    }
    imageWrapEl.hidden = false;
    imagePreviewEl.src = `data:${mimeType};base64,${imageBase64}`;
    imagePreviewEl.alt = altText || "";
  };

  const getValue = (selector) => {
    const element = $(selector);
    return element ? element.value : "";
  };

  const setValue = (selector, value) => {
    const element = $(selector);
    if (element) {
      element.value = value ?? "";
    }
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
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data?.data?.message || `Request failed with ${response.status}`);
    }
    return data.data;
  };

  const withBusy = async (work) => {
    if (state.busy) return;
    setBusy(true);
    clearStatus();
    try {
      await work();
    } catch (error) {
      showStatus("error", error instanceof Error ? error.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  };

  const bindTabs = () => {
    const tabs = $$(".aia-tab");
    const panels = $$(".aia-tabpanel");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.aiaTab;
        tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
        panels.forEach((panel) => {
          panel.classList.toggle("is-active", panel.dataset.aiaPanel === target);
        });
      });
    });
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

  const bindManualActions = () => {
    $("#aia-generate-draft")?.addEventListener("click", () =>
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
          Array.isArray(data.meta?.suggestedTags) ? data.meta.suggestedTags.join(", ") : ""
        );
        populateSeoPayload(data.meta?.seo || {});
        setPreviewHtml(data.html || "");
        setResult(data);
        showStatus("success", "Draft generated.");
      })
    );

    $("#aia-generate-image")?.addEventListener("click", () =>
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
      })
    );

    $("#aia-publish-manual")?.addEventListener("click", () =>
      withBusy(async () => {
        const shared = collectSharedPayload();
        const data = await request("aia_publish_post", {
          ...shared,
          title: getValue("#aia-manual-title").trim(),
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
        });
        setResult(data);
        showStatus("success", config.strings.manualSaved);
      })
    );
  };

  const bindImportActions = () => {
    $("#aia-publish-google")?.addEventListener("click", () =>
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
          imageWrapEl.hidden = false;
          imagePreviewEl.src = data.featuredImage.sourceUrl;
          imagePreviewEl.alt = data.title || "";
        }
        showStatus("success", config.strings.googleSaved);
      })
    );

    $("#aia-run-news")?.addEventListener("click", () =>
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
      })
    );
  };

  const init = () => {
    bindTabs();
    bindScheduleFields();
    bindManualActions();
    bindImportActions();
    $("#aia-manual-html")?.addEventListener("input", (event) =>
      setPreviewHtml(event.target.value)
    );
    $("#aia-add-link")?.addEventListener("click", () => createLinkRow());
    if (!linksListEl?.children.length) {
      createLinkRow();
    }
    setPreviewHtml("");
    setResult("No actions run yet.");
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
