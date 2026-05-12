export function normalizeReviewCandidateTitle(title?: string): string {
  let normalized = (title ?? "").trim();

  for (let depth = 0; depth < 3; depth += 1) {
    const inner = unwrapWikilink(normalized);
    if (!inner) {
      break;
    }
    normalized = wikilinkDisplayText(inner);
  }

  normalized = normalized
    .replace(/^\[(?:theme-hypothesis|topic|candidate|signal)\]\s*/iu, "")
    .replace(
      /^(?:folder thread|linked thread|recurring entity|tag thread|link cluster|topic signal)\s*:\s*/iu,
      "",
    )
    .replace(/\.md$/iu, "")
    .trim();

  const timeContainerTitle = titleFromTimeContainer(normalized);
  if (timeContainerTitle) {
    return timeContainerTitle;
  }

  return humanizeSlugTitle(normalized) || "Untitled";
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

function titleFromTimeContainer(value: string): string | null {
  const yearMonthlyReview = value.match(/^((?:19|20)\d{2})月复盘$/u);
  if (yearMonthlyReview?.[1]) {
    return `${yearMonthlyReview[1]} Monthly Review Notes`;
  }
  const month = value.match(/^(0?[1-9]|1[0-2])月$/u)?.[1];
  if (month) {
    return `${monthName(Number(month))} Review Notes`;
  }
  return null;
}

function monthName(month: number): string {
  return (
    [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ][month - 1] ?? "Monthly"
  );
}

function humanizeSlugTitle(value: string): string {
  const expanded = value.replace(/[_-]+/gu, " ").replace(/\s+/gu, " ").trim();
  if (!/^[a-z0-9 ]+$/u.test(expanded) || /[A-Z]/u.test(expanded)) {
    return expanded;
  }
  return expanded.replace(/\b[a-z][a-z0-9]*\b/gu, (word) => {
    const lower = word.toLowerCase();
    if (lower === "ai") {
      return "AI";
    }
    if (lower === "ui") {
      return "UI";
    }
    if (lower === "ux") {
      return "UX";
    }
    return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
  });
}
