import type { HyperlinkInput } from "@/lib/types";

export interface RequiredLinkValidationResult {
  present: HyperlinkInput[];
  missing: HyperlinkInput[];
  duplicateRequired: HyperlinkInput[];
}

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
  const requiredLinks = links.filter((link) => link.required);
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

