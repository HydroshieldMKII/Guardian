import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;
