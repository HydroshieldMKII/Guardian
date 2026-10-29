const UNREACHABLE =
  "Unable to reach the backend service. Please ensure the service is running and accessible.";
const UNKNOWN = "Unable to connect to the backend service.";
const FALLBACK =
  "The backend service is not responding correctly. Please try again.";

const BY_STATUS: { codes: string[]; message: string }[] = [
  {
    codes: ["500"],
    message: "The backend service encountered an internal error.",
  },
  {
    codes: ["502", "503"],
    message:
      "The backend service is temporarily unavailable. Please try again shortly.",
  },
  {
    codes: ["404"],
    message:
      "The backend service is not properly configured. Please check your setup.",
  },
];

export function backendErrorMessage(error: unknown): string {
  if (error instanceof TypeError) return UNREACHABLE;
  if (!(error instanceof Error)) return UNKNOWN;

  const match = BY_STATUS.find(({ codes }) =>
    codes.some((code) => error.message.includes(code)),
  );
  return match?.message ?? FALLBACK;
}
