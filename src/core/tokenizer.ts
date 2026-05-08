const cjkPattern =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const latinPattern = /[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu;

export interface TextCounts {
  words: number;
  characters: number;
}

export function countText(content: string): TextCounts {
  const text = stripMarkdownSyntax(content);
  let words = 0;
  const latinSegments = text.replace(latinPattern, (match) => {
    if (containsCjk(match)) {
      return match;
    }
    words += 1;
    return " ";
  });

  for (const char of latinSegments) {
    if (cjkPattern.test(char)) {
      words += 1;
    }
  }

  return {
    words,
    characters: Array.from(text.replace(/\s/g, "")).length,
  };
}

function containsCjk(value: string): boolean {
  return Array.from(value).some((char) => cjkPattern.test(char));
}

function stripMarkdownSyntax(content: string): string {
  return content
    .replace(/^---[\s\S]*?---\s*/u, "")
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/gu, "$2 $1")
    .replace(/!?\[([^\]]*)\]\([^)]+\)/gu, "$1")
    .replace(/[#>*_`~|[\]()-]/gu, " ");
}
