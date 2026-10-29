import { channel } from "node:diagnostics_channel";
import { createServer, IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Socket } from "node:net";
import { appendClientAddress, forwardClientAddresses } from "./client-address";

const LOOPBACK = /^(::ffff:)?127\.0\.0\.1$/;

describe("forwardClientAddresses", () => {
  let server: Server;
  let origin: string;

  beforeAll(async () => {
    forwardClientAddresses();
    server = createServer((request, response) => {
      response.end(request.headers["x-forwarded-for"] ?? "");
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const forwardedFor = async (headers: Record<string, string> = {}) =>
    (await fetch(origin, { headers })).text();

  it("records the caller address when no proxy sent one", async () => {
    expect(await forwardedFor()).toMatch(LOOPBACK);
  });

  it("appends the caller address after the addresses it was sent", async () => {
    const [sent, caller] = (
      await forwardedFor({ "X-Forwarded-For": "203.0.113.5" })
    ).split(", ");

    expect(sent).toBe("203.0.113.5");
    expect(caller).toMatch(LOOPBACK);
  });

  it("ignores messages without a request", () => {
    expect(() =>
      channel("http.server.request.start").publish({}),
    ).not.toThrow();
  });
});

describe("appendClientAddress", () => {
  it("leaves the header alone when the caller address is unknown", () => {
    const request = new IncomingMessage(new Socket());
    request.headers["x-forwarded-for"] = "203.0.113.5";

    appendClientAddress(request);

    expect(request.headers["x-forwarded-for"]).toBe("203.0.113.5");
  });
});
