import type { HyperlinkInput } from "@/lib/types";

export interface RequiredLinkValidationResult {
  present: HyperlinkInput[];
  missing: HyperlinkInput[];
  duplicateRequired: HyperlinkInput[];
}

const isConfiguredLink = (link: HyperlinkInput) =>
  link.url.trim().length > 0 && link.anchorText.trim().length > 0;

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const countExactAnchorMatches = (html: string, link: HyperlinkInput) => {
  const href = escapeRegExp(link.url.trim());
  const anchorText = escapeRegExp(link.anchorText.trim());
  const pattern = `<a\\b[^>]*\\bhref\\s*=\\s*(['"])${href}\\1[^>]*>\\s*${anchorText}\\s*<\\/a>`;
  const regex = new RegExp(pattern, "gi");
  const matches = html.match(regex);
  return matches ? matches.length : 0;
};

export const validateRequiredLinks = (
  html: string,
  links: HyperlinkInput[],
): RequiredLinkValidationResult => {
  const requiredLinks = links.filter(
    (link) => link.required && isConfiguredLink(link),
  );
  const present: HyperlinkInput[] = [];
  const missing: HyperlinkInput[] = [];
  const duplicateRequired: HyperlinkInput[] = [];

  for (const link of requiredLinks) {
    const count = countExactAnchorMatches(html, link);
    if (count === 1) {
      present.push(link);
      continue;
    }
    if (count === 0) {
      missing.push(link);
      continue;
    }
    duplicateRequired.push(link);
  }

  return {
    present,
    missing,
    duplicateRequired,
  };
};

const buildExactAnchorRegex = (link: HyperlinkInput) => {
  const href = escapeRegExp(link.url.trim());
  const anchorText = escapeRegExp(link.anchorText.trim());
  const pattern = `<a\\b[^>]*\\bhref\\s*=\\s*(['"])${href}\\1[^>]*>\\s*${anchorText}\\s*<\\/a>`;
  return new RegExp(pattern, "gi");
};

export const dedupeRequiredLinksInHtml = (
  html: string,
  links: HyperlinkInput[],
): string => {
  let nextHtml = html;
  const requiredLinks = links.filter(
    (link) => link.required && isConfiguredLink(link),
  );

  for (const link of requiredLinks) {
    const regex = buildExactAnchorRegex(link);
    let seen = false;
    nextHtml = nextHtml.replace(regex, (fullMatch) => {
      if (!seen) {
        seen = true;
        return fullMatch;
      }
      return link.anchorText;
    });
  }

  return nextHtml;
};

const normalizeUrlForComparison = (url: string) =>
  url.trim().replace(/\/+$/, "").toLowerCase();

const getHrefFromAnchorTag = (anchorTag: string): string | null => {
  const hrefMatch = anchorTag.match(/\bhref\s*=\s*(['"])(.*?)\1/i);
  return hrefMatch?.[2] ?? null;
};

const stripAttribute = (anchorTag: string, attribute: string) => {
  const pattern = new RegExp(
    `\\s${attribute}\\s*=\\s*(\"[^\"]*\"|'[^']*'|[^\\s>]+)`,
    "gi",
  );
  return anchorTag.replace(pattern, "");
};

const setAttribute = (anchorTag: string, attribute: string, value: string) => {
  const withoutAttribute = stripAttribute(anchorTag, attribute);
  return withoutAttribute.replace(/>$/, ` ${attribute}="${value}">`);
};

export const enforceLinkPoliciesInHtml = (
  html: string,
  links: HyperlinkInput[],
): string => {
  const followTypeByUrl = new Map<string, HyperlinkInput["followType"]>();
  for (const link of links) {
    if (!link.url.trim()) {
      continue;
    }
    followTypeByUrl.set(normalizeUrlForComparison(link.url), link.followType);
  }

  return html.replace(/<a\b[^>]*>/gi, (anchorTag) => {
    const href = getHrefFromAnchorTag(anchorTag);
    if (!href) {
      return anchorTag;
    }

    const followType =
      followTypeByUrl.get(normalizeUrlForComparison(href)) ?? "dofollow";

    let updated = setAttribute(anchorTag, "target", "_blank");
    const relTokens = ["noopener", "noreferrer"];
    if (followType === "nofollow") {
      relTokens.push("nofollow");
    }
    updated = setAttribute(updated, "rel", relTokens.join(" "));
    return updated;
  });
};
