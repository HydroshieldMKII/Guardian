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
    "components/settings/settings-utils.ts",
    "app/api/**/*.ts",
    "!**/*.d.ts",
  ],
  coverageReporters: ["text-summary", "lcov", "json-summary"],
  coverageThreshold: {
    global: {
      statements: 43,
      branches: 41,
      functions: 61,
      lines: 42,
    },
  },
};

export default createJestConfig(config);
