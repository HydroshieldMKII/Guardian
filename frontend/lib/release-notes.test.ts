import {
  parseInline,
  parseListItem,
  parseReleaseNotes,
  shortUrl,
} from "@/lib/release-notes";

const GITHUB_NOTES = [
  "## What's Changed",
  "### New Features",
  "* feat: automatic releases by @someone in https://github.com/owner/repo/pull/131",
  "### Dependencies",
  "* chore(deps): bump the group by @dependabot[bot] in https://github.com/owner/repo/pull/142",
  "* chore(deps)!: drop old node by @someone in https://github.com/owner/repo/pull/143",
  "",
  "",
  "**Full Changelog**: https://github.com/owner/repo/compare/v2.0.0...v2.1.0",
].join("\n");

describe("shortUrl", () => {
  it.each([
    ["https://github.com/owner/repo/pull/131", "#131"],
    ["https://github.com/owner/repo/issues/7/", "#7"],
    ["https://github.com/owner/repo/compare/v1...v2", "v1...v2"],
    ["https://example.com/", "example.com"],
    ["https://example.com/docs/page", "example.com/docs/page"],
    ["not a url", "not a url"],
  ])("shortens %s to %s", (href, expected) => {
    expect(shortUrl(href)).toBe(expected);
  });
});

describe("parseInline", () => {
  it("splits text, bold, code and links", () => {
    expect(
      parseInline("a **b** `c` [d](https://d.dev) https://e.dev/x end"),
    ).toEqual([
      { type: "text", value: "a " },
      { type: "strong", value: "b" },
      { type: "text", value: " " },
      { type: "code", value: "c" },
      { type: "text", value: " " },
      { type: "link", href: "https://d.dev", label: "d" },
      { type: "text", value: " " },
      { type: "link", href: "https://e.dev/x", label: "e.dev/x" },
      { type: "text", value: " end" },
    ]);
  });

  it("leaves links that are not http as text", () => {
    expect(parseInline("[x](javascript:alert(1))")).toEqual([
      { type: "text", value: "[x](javascript:alert(1))" },
    ]);
  });
});

describe("parseListItem", () => {
  it("drops the commit prefix and credit and keeps a short pull link", () => {
    expect(
      parseListItem(
        "fix(api): handle errors by @someone in https://github.com/owner/repo/pull/9",
      ),
    ).toEqual([
      { type: "text", value: "Handle errors" },
      { type: "text", value: " " },
      {
        type: "link",
        href: "https://github.com/owner/repo/pull/9",
        label: "#9",
      },
    ]);
  });

  it("keeps plain items as written apart from the first letter", () => {
    expect(parseListItem("small change")).toEqual([
      { type: "text", value: "Small change" },
    ]);
  });
});

describe("parseReleaseNotes", () => {
  it("turns GitHub generated notes into tight blocks", () => {
    const blocks = parseReleaseNotes(GITHUB_NOTES);

    expect(blocks.map((block) => block.type)).toEqual([
      "heading",
      "list",
      "heading",
      "list",
      "paragraph",
    ]);
    expect(blocks[0]).toEqual({
      type: "heading",
      content: [{ type: "text", value: "New Features" }],
    });
    expect(blocks[3]).toEqual({
      type: "list",
      items: [
        [
          { type: "text", value: "Bump the group" },
          { type: "text", value: " " },
          {
            type: "link",
            href: "https://github.com/owner/repo/pull/142",
            label: "#142",
          },
        ],
        [
          { type: "text", value: "Drop old node" },
          { type: "text", value: " " },
          {
            type: "link",
            href: "https://github.com/owner/repo/pull/143",
            label: "#143",
          },
        ],
      ],
    });
    expect(blocks[4]).toEqual({
      type: "paragraph",
      content: [
        { type: "strong", value: "Full Changelog" },
        { type: "text", value: ": " },
        {
          type: "link",
          href: "https://github.com/owner/repo/compare/v2.0.0...v2.1.0",
          label: "v2.0.0...v2.1.0",
        },
      ],
    });
  });

  it("joins wrapped lines into one paragraph and splits on blank lines", () => {
    expect(parseReleaseNotes("one\r\ntwo\n\nthree")).toEqual([
      { type: "paragraph", content: [{ type: "text", value: "one two" }] },
      { type: "paragraph", content: [{ type: "text", value: "three" }] },
    ]);
  });

  it.each([
    [
      "a GitHub generator comment",
      "<!-- Release notes generated using configuration in .github/release.yml at d8f2166 -->\n## What's Changed\n- Fix",
    ],
    ["a comment spread over lines", "<!--\nhidden\n-->\n- Fix"],
    ["a comment that never closes", "- Fix\n<!-- left open"],
  ])("drops %s", (_label, notes) => {
    expect(JSON.stringify(parseReleaseNotes(notes))).not.toMatch(
      /<!--|hidden|left open|release\.yml/,
    );
    expect(JSON.stringify(parseReleaseNotes(notes))).toContain("Fix");
  });

  it("keeps the text around an inline comment", () => {
    expect(parseReleaseNotes("before <!-- note --> after")).toEqual([
      { type: "paragraph", content: [{ type: "text", value: "before after" }] },
    ]);
  });

  it("returns nothing for empty notes", () => {
    expect(parseReleaseNotes("")).toEqual([]);
  });
});
