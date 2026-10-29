import {
  EMPTY_PLACEMENT,
  placeStreams,
  samePlacement,
  type StreamPlacement,
} from "@/lib/stream-placement";

const columnOf = (placement: StreamPlacement, column: 0 | 1) =>
  placement.order.filter((key) => placement.columns[key] === column);

describe("placeStreams", () => {
  it("alternates the first streams between the two columns", () => {
    const placement = placeStreams(["a", "b", "c", "d", "e"], EMPTY_PLACEMENT);

    expect(columnOf(placement, 0)).toEqual(["a", "c", "e"]);
    expect(columnOf(placement, 1)).toEqual(["b", "d"]);
  });

  it("keeps existing streams in their column when one ends", () => {
    const first = placeStreams(["a", "b", "c", "d"], EMPTY_PLACEMENT);
    const next = placeStreams(["b", "c", "d"], first);

    expect(columnOf(next, 0)).toEqual(["c"]);
    expect(columnOf(next, 1)).toEqual(["b", "d"]);
  });

  it("adds a new stream to the shorter column", () => {
    const first = placeStreams(["a", "b", "c", "d"], EMPTY_PLACEMENT);
    const next = placeStreams(["b", "c", "d", "e"], first);

    expect(columnOf(next, 0)).toEqual(["c", "e"]);
    expect(columnOf(next, 1)).toEqual(["b", "d"]);
  });

  it("keeps the order streams were first seen in", () => {
    const first = placeStreams(["a", "b", "c"], EMPTY_PLACEMENT);
    const next = placeStreams(["c", "x", "a", "b"], first);

    expect(next.order).toEqual(["a", "b", "c", "x"]);
  });

  it("moves the last card across when one column gets two longer", () => {
    const first = placeStreams(["a", "b", "c", "d", "e"], EMPTY_PLACEMENT);
    const next = placeStreams(["a", "c", "e"], first);

    expect(columnOf(next, 0)).toEqual(["a", "c"]);
    expect(columnOf(next, 1)).toEqual(["e"]);
  });

  it("moves the last card left when the left column empties", () => {
    const first = placeStreams(["a", "b"], EMPTY_PLACEMENT);
    const next = placeStreams(["b"], first);

    expect(columnOf(next, 0)).toEqual(["b"]);
    expect(columnOf(next, 1)).toEqual([]);
  });

  it("leaves a pinned card alone even when the left column empties", () => {
    const first = placeStreams(["a", "b"], EMPTY_PLACEMENT);
    const next = placeStreams(["b"], first, "b");

    expect(columnOf(next, 0)).toEqual([]);
    expect(columnOf(next, 1)).toEqual(["b"]);
  });

  it("never moves the pinned card", () => {
    const first = placeStreams(["a", "b", "c", "d", "e"], EMPTY_PLACEMENT);
    const next = placeStreams(["a", "c", "e"], first, "e");

    expect(columnOf(next, 0)).toEqual(["a", "e"]);
    expect(columnOf(next, 1)).toEqual(["c"]);
  });

  it("gives the same placement when nothing changed", () => {
    const first = placeStreams(["a", "b", "c"], EMPTY_PLACEMENT);

    expect(samePlacement(placeStreams(["a", "b", "c"], first), first)).toBe(
      true,
    );
  });
});

describe("samePlacement", () => {
  it("spots a different order", () => {
    expect(
      samePlacement(
        { order: ["a", "b"], columns: { a: 0, b: 1 } },
        { order: ["b", "a"], columns: { a: 0, b: 1 } },
      ),
    ).toBe(false);
  });

  it("spots a card in another column", () => {
    expect(
      samePlacement(
        { order: ["a", "b"], columns: { a: 0, b: 1 } },
        { order: ["a", "b"], columns: { a: 1, b: 0 } },
      ),
    ).toBe(false);
  });

  it("spots a different number of cards", () => {
    expect(
      samePlacement(
        { order: ["a"], columns: { a: 0 } },
        { order: ["a", "b"], columns: { a: 0, b: 1 } },
      ),
    ).toBe(false);
  });
});
