export type Inline =
  | { type: "text"; value: string }
  | { type: "strong"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; href: string; label: string };

export type Block =
  | { type: "heading"; content: Inline[] }
  | { type: "list"; items: Inline[][] }
  | { type: "paragraph"; content: Inline[] };

const INLINE =
  /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s)]+)/g;

const CONVENTIONAL_PREFIX = /^[a-z]+(\([^)]*\))?!?:\s+/i;
const CREDIT = /^(.*?) by @\S+ in (https?:\/\/\S+)$/;
const SKIPPED_HEADINGS = new Set(["what's changed", "what’s changed"]);

export const shortUrl = (href: string): string => {
  try {
    const url = new URL(href);
    const pull = url.pathname.match(/\/(?:pull|issues)\/(\d+)\/?$/);
    if (url.hostname === "github.com" && pull) return `#${pull[1]}`;
    const compare = url.pathname.match(/\/compare\/(.+)$/);
    if (url.hostname === "github.com" && compare) return compare[1];
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return href;
  }
};

export const parseInline = (text: string): Inline[] => {
  const parts: Inline[] = [];
  let last = 0;

  for (const match of text.matchAll(INLINE)) {
    const index = match.index;
    if (index > last) {
      parts.push({ type: "text", value: text.slice(last, index) });
    }
    const [, strong, code, label, href, bare] = match;
    if (strong !== undefined) parts.push({ type: "strong", value: strong });
    else if (code !== undefined) parts.push({ type: "code", value: code });
    else if (label !== undefined && href !== undefined)
      parts.push({ type: "link", href, label });
    else if (bare !== undefined)
      parts.push({ type: "link", href: bare, label: shortUrl(bare) });
    last = index + match[0].length;
  }

  if (last < text.length) {
    parts.push({ type: "text", value: text.slice(last) });
  }
  return parts;
};

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

export const parseListItem = (text: string): Inline[] => {
  const credit = text.match(CREDIT);
  const summary = capitalize(
    (credit ? credit[1] : text).replace(CONVENTIONAL_PREFIX, ""),
  );
  const content = parseInline(summary);
  if (credit) {
    content.push(
      { type: "text", value: " " },
      { type: "link", href: credit[2], label: shortUrl(credit[2]) },
    );
  }
  return content;
};

const HTML_COMMENT = /<!--[\s\S]*?(?:-->|$)/g;

export const parseReleaseNotes = (notes: string): Block[] => {
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({
        type: "paragraph",
        content: parseInline(paragraph.join(" ")),
      });
      paragraph = [];
    }
  };

  for (const raw of notes.replace(HTML_COMMENT, "\n").split(/\r?\n/)) {
    const line = raw.trim();
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    const item = line.match(/^[-*+]\s+(.*)$/);

    if (!line) {
      flushParagraph();
    } else if (heading) {
      flushParagraph();
      if (!SKIPPED_HEADINGS.has(heading[1].trim().toLowerCase())) {
        blocks.push({ type: "heading", content: parseInline(heading[1]) });
      }
    } else if (item) {
      flushParagraph();
      const previous = blocks[blocks.length - 1];
      const parsed = parseListItem(item[1]);
      if (previous?.type === "list") previous.items.push(parsed);
      else blocks.push({ type: "list", items: [parsed] });
    } else {
      paragraph.push(line);
    }
  }

  flushParagraph();
  return blocks;
};
