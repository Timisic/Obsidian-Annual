export const ANNUAL_REVIEW_START_MARKER = "<!-- time-range-review:generated:start -->";
export const ANNUAL_REVIEW_END_MARKER = "<!-- time-range-review:generated:end -->";
export const REVIEW_USER_REFLECTION_START_MARKER =
  "<!-- time-range-review:user-reflection:start -->";
export const REVIEW_USER_REFLECTION_END_MARKER =
  "<!-- time-range-review:user-reflection:end -->";

const LEGACY_ANNUAL_REVIEW_START_MARKER = "<!-- annual-review:start -->";
const LEGACY_ANNUAL_REVIEW_END_MARKER = "<!-- annual-review:end -->";

interface DelimitedSection {
  startIndex: number;
  endIndex: number;
}

interface LeadingFrontmatter {
  block: string;
  body: string;
  endIndex: number;
}

export function formatReportDocument(content: string): string {
  return ensureUserReflectionBlock(formatMachineSection(content));
}

export function mergeReportContent(
  existingContent: string,
  nextMachineContent: string,
): string {
  const section = findMachineSection(existingContent);
  const preservedUserReflection = extractUserReflectionBlock(existingContent);
  const nextContent = preservedUserReflection
    ? replaceOrAppendUserReflectionBlock(nextMachineContent, preservedUserReflection)
    : nextMachineContent;
  if (!section) {
    return formatReportDocument(nextContent);
  }

  const managedStartIndex = machineSectionStartIndex(existingContent, section.startIndex);
  return ensureUserReflectionBlock(
    appendUserContent(
      formatMachineSection(nextContent),
      removeUserReflectionBlock(existingContent.slice(0, managedStartIndex)),
      removeUserReflectionBlock(existingContent.slice(section.endIndex)),
    ),
  );
}

export function hasMachineSection(content: string): boolean {
  return Boolean(findMachineSection(content));
}

function formatMachineSection(content: string): string {
  const frontmatter = extractLeadingFrontmatter(content);
  const machineContent = frontmatter ? frontmatter.body : content;
  const normalizedContent = machineContent.endsWith("\n")
    ? machineContent
    : `${machineContent}\n`;
  const machineSection = `${ANNUAL_REVIEW_START_MARKER}\n${normalizedContent}${ANNUAL_REVIEW_END_MARKER}`;
  return frontmatter ? `${frontmatter.block}\n\n${machineSection}` : machineSection;
}

function findMachineSection(content: string): DelimitedSection | null {
  const startIndex = content.indexOf(ANNUAL_REVIEW_START_MARKER);
  if (startIndex === -1) {
    return findDelimitedSection(
      content,
      LEGACY_ANNUAL_REVIEW_START_MARKER,
      LEGACY_ANNUAL_REVIEW_END_MARKER,
    );
  }
  return findDelimitedSection(
    content,
    ANNUAL_REVIEW_START_MARKER,
    ANNUAL_REVIEW_END_MARKER,
  );
}

function findDelimitedSection(
  content: string,
  startMarker: string,
  endMarker: string,
): DelimitedSection | null {
  const startIndex = content.indexOf(startMarker);
  if (startIndex === -1) {
    return null;
  }

  const endMarkerIndex = content.indexOf(endMarker, startIndex + startMarker.length);
  if (endMarkerIndex === -1) {
    return null;
  }

  return {
    startIndex,
    endIndex: endMarkerIndex + endMarker.length,
  };
}

function machineSectionStartIndex(content: string, markerStartIndex: number): number {
  const frontmatter = extractLeadingFrontmatter(content);
  if (!frontmatter) {
    return markerStartIndex;
  }

  const betweenFrontmatterAndMarker = content.slice(
    frontmatter.endIndex,
    markerStartIndex,
  );
  return betweenFrontmatterAndMarker.trim().length === 0 ? 0 : markerStartIndex;
}

function extractLeadingFrontmatter(content: string): LeadingFrontmatter | null {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/u);
  if (!match) {
    return null;
  }

  const block = match[0] ?? "";
  const endIndex = block.length;
  return {
    block,
    body: content.slice(endIndex).replace(/^\r?\n/u, ""),
    endIndex,
  };
}

function appendUserContent(
  machineSection: string,
  userBeforeSection: string,
  userAfterSection: string,
): string {
  const userContent = [userBeforeSection, userAfterSection]
    .map((content) => content.trim())
    .filter(Boolean)
    .join("\n\n");

  return userContent ? `${machineSection}\n\n${userContent}\n` : machineSection;
}

function ensureUserReflectionBlock(content: string): string {
  if (
    content.includes(REVIEW_USER_REFLECTION_START_MARKER) &&
    content.includes(REVIEW_USER_REFLECTION_END_MARKER)
  ) {
    return content;
  }

  return `${content.trimEnd()}\n\n${REVIEW_USER_REFLECTION_START_MARKER}\n\n${REVIEW_USER_REFLECTION_END_MARKER}`;
}

function extractUserReflectionBlock(content: string): string | null {
  const section = findDelimitedSection(
    content,
    REVIEW_USER_REFLECTION_START_MARKER,
    REVIEW_USER_REFLECTION_END_MARKER,
  );
  return section ? content.slice(section.startIndex, section.endIndex) : null;
}

function replaceOrAppendUserReflectionBlock(content: string, block: string): string {
  const section = findDelimitedSection(
    content,
    REVIEW_USER_REFLECTION_START_MARKER,
    REVIEW_USER_REFLECTION_END_MARKER,
  );
  if (!section) {
    return `${content.trimEnd()}\n\n${block}`;
  }
  return `${content.slice(0, section.startIndex)}${block}${content.slice(section.endIndex)}`;
}

function removeUserReflectionBlock(content: string): string {
  const section = findDelimitedSection(
    content,
    REVIEW_USER_REFLECTION_START_MARKER,
    REVIEW_USER_REFLECTION_END_MARKER,
  );
  if (!section) {
    return content;
  }
  const before = content
    .slice(0, section.startIndex)
    .replace(/\n{0,2}## (?:User Reflection|我的补充)\s*\n{2}$/u, "");
  return `${before}${content.slice(section.endIndex)}`;
}
