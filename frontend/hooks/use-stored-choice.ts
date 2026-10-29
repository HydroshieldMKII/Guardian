"use client";

import { useEffect, useState } from "react";

const readStored = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStored = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
};

export function useStoredChoice<Choice extends string>(
  key: string,
  fallback: Choice,
) {
  const [choice, setChoice] = useState<Choice>(
    () => (readStored(key) || fallback) as Choice,
  );

  useEffect(() => {
    writeStored(key, choice);
  }, [key, choice]);

  return [choice, setChoice] as const;
}
