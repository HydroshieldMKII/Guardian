#!/usr/bin/env node
const { spawn } = require("child_process");
const http = require("http");

async function getConfigFromBackend() {
  return new Promise((resolve, reject) => {
    const req = http.get(
      "http://localhost:3001/config/PLEXGUARD_FRONTEND_PORT",
      (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const config = JSON.parse(data);
            resolve(config.value || "3000");
          } catch (error) {
            reject(new Error("Could not parse config response"));
          }
        });
      }
    );

    req.on("error", (error) => {
      reject(new Error("Backend not available"));
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error("Backend timeout"));
    });
  });
}

async function waitForBackendAndGetConfig() {
  console.log("Checking backend for port configuration...");

  while (true) {
    try {
      const port = await getConfigFromBackend();
      console.log(`Backend connected! Using port ${port}`);
      return port;
    } catch (error) {
      console.log(
        `Backend not available (${error.message}), retrying in 10 seconds...`
      );
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}

async function startFrontend() {
  try {
    const port = await waitForBackendAndGetConfig();
    console.log(`Starting frontend on port ${port}`);

    // Set the environment variable
    process.env.PLEXGUARD_FRONTEND_PORT = port;

    // Start the Next.js dev server
    const args = process.argv.slice(2);
    const isProduction = args.includes("--production");

    const command = isProduction ? "start" : "dev";
    const nextArgs = isProduction
      ? ["start", "-p", port]
      : ["dev", "--turbopack", "-p", port];

    const child = spawn("npx", ["next", ...nextArgs], {
      stdio: "inherit",
      env: { ...process.env, PLEXGUARD_FRONTEND_PORT: port },
    });

    child.on("error", (error) => {
      console.error("Failed to start frontend:", error);
      process.exit(1);
    });

    child.on("exit", (code) => {
      process.exit(code);
    });
  } catch (error) {
    console.error("Error starting frontend:", error);
    process.exit(1);
  }
}

startFrontend();
