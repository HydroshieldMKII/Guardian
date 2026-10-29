export type PosterShape = "portrait" | "square" | "landscape";

export const POSTER_FRAME: Record<PosterShape, string> = {
  portrait: "aspect-[2/3] w-16 sm:w-[4.5rem]",
  square: "aspect-square w-16 sm:w-[6.75rem]",
  landscape: "aspect-video w-28 sm:w-40",
};

export const expectedShape = (type?: string): PosterShape => {
  if (type === "track") return "square";
  if (type === "episode") return "landscape";
  return "portrait";
};

export const measuredShape = (width: number, height: number): PosterShape => {
  const ratio = width / height;
  if (ratio < 0.85) return "portrait";
  if (ratio > 1.2) return "landscape";
  return "square";
};
