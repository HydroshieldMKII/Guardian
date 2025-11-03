/**
 * Checks if a string is a valid URL.
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the backend URL for the application, based on environment variables.
 */
function getBackendUrl(): string {
  const backendUrl = process.env.BACKEND_URL;

  // If BACKEND_URL is defined and valid, normalize and return it
  if (backendUrl && isValidUrl(backendUrl)) {
    return new URL(backendUrl).toString().replace(/\/$/, "");
  }

  // If invalid or not defined, choose default based on DEPLOYMENT_MODE
  return process.env.DEPLOYMENT_MODE === "standalone"
    ? "http://localhost:3001"
    : "http://backend:3001";
}

export const config = {
  api: {
    baseUrl: "/api/pg",
    backendUrl: getBackendUrl(),
  },
  app: {
    environment: process.env.NODE_ENV || "development",
    refreshInterval: 3000, // 3 seconds
  },
};

export { getBackendUrl };