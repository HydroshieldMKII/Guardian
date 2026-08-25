import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  testEnvironment: "<rootDir>/jest.environment.ts",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  collectCoverageFrom: [
    "lib/**/*.{ts,tsx}",
    "hooks/**/*.{ts,tsx}",
    "contexts/**/*.{ts,tsx}",
    "components/auth-guard.tsx",
    "components/dashboard.tsx",
    "components/error-boundary.tsx",
    "components/error-handler.tsx",
    "components/global-update-banner.tsx",
    "components/global-version-mismatch-banner.tsx",
    "components/three-dot-loader.tsx",
    "components/device-management/ConcurrentStreamModal.tsx",
    "components/device-management/ConfirmationModal.tsx",
    "components/device-management/IPAccessModal.tsx",
    "components/device-management/SharedComponents.tsx",
    "components/settings/settings-utils.ts",
    "components/streams/RemoveAccessModal.tsx",
    "components/streams/SharedComponents.tsx",
    "components/streams/StreamDeviceInfo.tsx",
    "components/streams/StreamProgress.tsx",
    "app/api/**/*.ts",
    "!**/*.d.ts",
  ],
  coverageReporters: ["text-summary", "lcov", "json-summary"],
  coverageThreshold: {
    global: { statements: 95, branches: 95, functions: 95, lines: 95 },
  },
};

export default createJestConfig(config);
