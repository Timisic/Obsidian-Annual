export function normalizeReviewCandidateTitle(title?: string): string {
  let normalized = (title ?? "").trim();

  for (let depth = 0; depth < 3; depth += 1) {
    const inner = unwrapWikilink(normalized);
    if (!inner) {
      break;
    }
    normalized = wikilinkDisplayText(inner);
  }

  return normalized.replace(/\.md$/iu, "").trim() || "Untitled";
}

export function reviewCandidateDisplayTitle(title?: string, userTitle?: string): string {
  return normalizeReviewCandidateTitle(userTitle || title);
}

function unwrapWikilink(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[[") || !trimmed.endsWith("]]")) {
    return null;
  }
  return trimmed.slice(2, -2).trim() || null;
}

function wikilinkDisplayText(inner: string): string {
  const [targetAndHeading = "", alias] = inner.split("|", 2);
  const [target = ""] = targetAndHeading.split("#", 2);
  return (alias || target).trim();
}
