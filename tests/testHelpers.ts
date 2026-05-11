import { extractNoteStats } from "../src/core/extract";
import type { ReviewCandidate, ReviewSessionState } from "../src/core/reviewState";
import { DEFAULT_SETTINGS } from "../src/core/settings";

export type ReportWriterMockFile = { path: string; content: string };

export function createReportWriterMockApp(initialFiles: Array<[string, string]> = []): {
  app: {
    vault: {
      getFolderByPath: (path: string) => { path: string } | null;
      createFolder: (path: string) => Promise<void>;
      getFileByPath: (path: string) => ReportWriterMockFile | null;
      create: (path: string, content: string) => Promise<ReportWriterMockFile>;
      modify: (file: ReportWriterMockFile, content: string) => Promise<void>;
      read: (file: ReportWriterMockFile) => Promise<string>;
      process: (
        file: ReportWriterMockFile,
        fn: (content: string) => string,
      ) => Promise<string>;
    };
  };
  files: Map<string, ReportWriterMockFile>;
  writes: string[];
  modifyCalls: string[];
  processCalls: string[];
} {
  const writes: string[] = [];
  const modifyCalls: string[] = [];
  const processCalls: string[] = [];
  const files = new Map<string, ReportWriterMockFile>();
  const folders = new Set<string>();

  for (const [path, content] of initialFiles) {
    files.set(path, { path, content });
    const folder = path.split("/").slice(0, -1).join("/");
    if (folder) {
      folders.add(folder);
    }
  }

  return {
    app: {
      vault: {
        getFolderByPath: (path: string) => (folders.has(path) ? { path } : null),
        createFolder: async (path: string) => {
          folders.add(path);
        },
        getFileByPath: (path: string) => files.get(path) ?? null,
        create: async (path: string, content: string) => {
          writes.push(path);
          const file = { path, content };
          files.set(path, file);
          return file;
        },
        modify: async (file: ReportWriterMockFile, content: string) => {
          writes.push(file.path);
          modifyCalls.push(file.path);
          file.content = content;
        },
        read: async (file: ReportWriterMockFile) => file.content,
        process: async (file: ReportWriterMockFile, fn: (content: string) => string) => {
          writes.push(file.path);
          processCalls.push(file.path);
          file.content = fn(file.content);
          return file.content;
        },
      },
    },
    files,
    writes,
    modifyCalls,
    processCalls,
  };
}

export function sectionBetween(markdown: string, start: string, end: string): string {
  const startIndex = markdown.indexOf(start);
  const endIndex = markdown.indexOf(end, startIndex);
  return markdown.slice(startIndex, endIndex);
}

export function reviewSessionFixture(): ReviewSessionState {
  const candidates = [
    reviewCandidateFixture("accepted", "Accepted Topic", "accepted", {
      mergedSourceIds: ["merged"],
    }),
    reviewCandidateFixture("renamed", "Renamed Topic", "renamed"),
    reviewCandidateFixture("ignored", "Ignored Topic", "ignored"),
    reviewCandidateFixture("merged", "Merged Topic", "merged", {
      mergedIntoId: "accepted",
    }),
    reviewCandidateFixture("unreviewed", "Unreviewed Topic", "candidate"),
  ];

  return {
    schemaVersion: 1,
    year: 2026,
    scopeHash: "scope",
    scanId: "scan",
    candidates,
    decisions: [],
    progress: {
      total: candidates.length,
      reviewed: 4,
      candidate: 1,
      accepted: 1,
      renamed: 1,
      merged: 1,
      ignored: 1,
    },
    createdAt: "2026-05-08T00:00:00.000Z",
    updatedAt: "2026-05-08T00:00:00.000Z",
  };
}

export class FakeDomElement {
  readonly children: FakeDomElement[] = [];
  className = "";
  textContent = "";
  max = 0;
  value = 0;
  private parent: FakeDomElement | null = null;
  private readonly attributes = new Map<string, string>();

  constructor(private readonly tagName: string) {}

  appendChild(child: FakeDomElement): FakeDomElement {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  remove(): void {
    const siblings = this.parent?.children;
    const index = siblings?.indexOf(this) ?? -1;
    if (siblings && index >= 0) {
      siblings.splice(index, 1);
    }
    this.parent = null;
  }

  querySelector(selector: string): FakeDomElement | null {
    for (const child of this.children) {
      if (child.matches(selector)) {
        return child;
      }
      const nested = child.querySelector(selector);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  private matches(selector: string): boolean {
    if (selector.startsWith(".")) {
      return this.className.split(/\s+/u).includes(selector.slice(1));
    }
    return this.tagName === selector.toLowerCase();
  }
}

export function withFakeDocument(run: (root: FakeDomElement) => void): void {
  const hadDocument = Object.prototype.hasOwnProperty.call(globalThis, "document");
  const previousDocument = globalThis.document;
  const root = new FakeDomElement("body");

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      body: root,
      createElement: (tagName: string) => new FakeDomElement(tagName.toLowerCase()),
    },
  });

  try {
    run(root);
  } finally {
    if (hadDocument) {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    } else {
      Reflect.deleteProperty(globalThis, "document");
    }
  }
}

export function reviewCandidateFixture(
  id: string,
  title: string,
  status: ReviewCandidate["status"],
  overrides: Partial<ReviewCandidate> = {},
): ReviewCandidate {
  const sourcePath = `Projects/${id[0]?.toUpperCase() ?? ""}${id.slice(1)}.md`;
  return {
    id,
    type: "theme-hypothesis",
    title,
    reason: `${id} unsupported reason`,
    reasons: [],
    status,
    evidence: [
      {
        id: `${id}-evidence`,
        kind: "note",
        label: title,
        target: sourcePath,
        sourcePath,
      },
    ],
    sourcePaths: [sourcePath],
    decisionIds: [],
    createdAt: "2026-05-08T00:00:00.000Z",
    updatedAt: "2026-05-08T00:00:00.000Z",
    ...overrides,
  };
}

export function themeEvidenceFiles() {
  return [
    sourceFrom({
      path: "Projects/Research.md",
      ctime: "2026-01-10T08:00:00.000Z",
      mtime: "2026-03-01T08:00:00.000Z",
      content: [
        "---",
        "topic: Local AI",
        "tags: [theme/ai]",
        "---",
        "# Research",
        "The local evidence loop connects annual review signals to [[Areas/AI Systems.md]].",
        "How should this evidence package stay auditable?",
      ].join("\n"),
    }),
    sourceFrom({
      path: "Daily/2026-02-01.md",
      ctime: "2026-02-01T08:00:00.000Z",
      mtime: "2026-02-01T09:00:00.000Z",
      content: [
        "# Daily",
        "The local evidence loop keeps appearing in [[Projects/Research.md]] and [[Areas/AI Systems.md]].",
        "What changed after the review board?",
        "#theme/ai",
      ].join("\n"),
    }),
    sourceFrom({
      path: "Projects/Legacy.md",
      ctime: "2025-10-01T08:00:00.000Z",
      mtime: "2026-02-20T09:00:00.000Z",
      content:
        "An old note resurfaced with the local evidence loop and now links to [[Projects/Research.md]].",
    }),
    sourceFrom({
      path: "Areas/AI Systems.md",
      ctime: "2026-01-05T08:00:00.000Z",
      mtime: "2026-02-15T09:00:00.000Z",
      content: "AI Systems collects cross-folder context for local review evidence.",
    }),
  ];
}

export function noteFrom(input: {
  path: string;
  ctime: string;
  mtime: string;
  content: string;
}) {
  return extractNoteStats(
    {
      path: input.path,
      ctime: Date.parse(input.ctime),
      mtime: Date.parse(input.mtime),
      content: input.content,
    },
    DEFAULT_SETTINGS,
  );
}

export function sourceFrom(input: {
  path: string;
  ctime: string;
  mtime: string;
  content: string;
}) {
  return {
    path: input.path,
    ctime: Date.parse(input.ctime),
    mtime: Date.parse(input.mtime),
    content: input.content,
  };
}

export function repeatedWords(count: number): string {
  return Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
}
