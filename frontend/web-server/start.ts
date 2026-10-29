import { createRequire } from "node:module";
import { forwardClientAddresses } from "./client-address.ts";

forwardClientAddresses();
createRequire(import.meta.url)("../server.js");
