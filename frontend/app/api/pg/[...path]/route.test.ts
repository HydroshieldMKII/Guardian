import { NextRequest } from "next/server";
import { DELETE, GET, PATCH, POST, PUT } from "./route";

const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>();

const params = (...path: string[]) => ({ params: Promise.resolve({ path }) });

const request = (
  url: string,
  init: RequestInit & { method: string } = { method: "GET" },
) => new NextRequest(new URL(url), init);

const upstreamCall = () => fetchMock.mock.calls[0];

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock as typeof fetch;
  fetchMock.mockImplementation(
    async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
});

describe("the API proxy", () => {
  it("forwards a GET to the backend under the same path", async () => {
    await GET(request("http://localhost:3000/api/pg/health"), params("health"));

    expect(upstreamCall()[0]).toBe("http://localhost:3001/health");
  });

  it("rejoins a nested path", async () => {
    await GET(
      request("http://localhost:3000/api/pg/users/u1/rules"),
      params("users", "u1", "rules"),
    );

    expect(upstreamCall()[0]).toBe("http://localhost:3001/users/u1/rules");
  });

  it("carries the query string across", async () => {
    await GET(
      request("http://localhost:3000/api/pg/sessions?limit=10&active=true"),
      params("sessions"),
    );

    expect(upstreamCall()[0]).toBe(
      "http://localhost:3001/sessions?limit=10&active=true",
    );
  });

  it("returns the backend's status and body", async () => {
    fetchMock.mockImplementation(
      async () => new Response("nope", { status: 404 }),
    );

    const res = await GET(
      request("http://localhost:3000/api/pg/missing"),
      params("missing"),
    );

    expect(res.status).toBe(404);
    await expect(res.text()).resolves.toBe("nope");
  });

  it.each([
    ["POST", POST],
    ["PUT", PUT],
    ["PATCH", PATCH],
  ] as const)("forwards a %s body", async (method, handler) => {
    await handler(
      request("http://localhost:3000/api/pg/config", {
        method,
        body: JSON.stringify({ value: 1 }),
        headers: { "Content-Type": "application/json" },
      }),
      params("config"),
    );

    const init = upstreamCall()[1];
    expect(init?.method).toBe(method);
    expect(Buffer.from(init?.body as ArrayBuffer).toString()).toBe(
      '{"value":1}',
    );
  });

  it("forwards a DELETE", async () => {
    await DELETE(
      request("http://localhost:3000/api/pg/devices/1/note", {
        method: "DELETE",
      }),
      params("devices", "1", "note"),
    );

    expect(upstreamCall()[0]).toBe("http://localhost:3001/devices/1/note");
    expect(upstreamCall()[1]?.method).toBe("DELETE");
  });

  it("sends no body on a GET", async () => {
    await GET(request("http://localhost:3000/api/pg/health"), params("health"));
    expect(upstreamCall()[1]?.body).toBeUndefined();
  });

  it("passes the caller's cookies through to the backend", async () => {
    await GET(
      request("http://localhost:3000/api/pg/auth/me", {
        method: "GET",
        headers: { cookie: "session_token=abc" },
      }),
      params("auth", "me"),
    );

    const headers = upstreamCall()[1]?.headers as Headers;
    expect(headers.get("cookie")).toBe("session_token=abc");
  });

  it.each([
    "connection",
    "keep-alive",
    "transfer-encoding",
    "upgrade",
    "proxy-authenticate",
    "proxy-authorization",
  ])("strips the hop-by-hop header %s from the request", async (banned) => {
    await GET(
      request("http://localhost:3000/api/pg/health", {
        method: "GET",
        headers: { [banned]: "something" },
      }),
      params("health"),
    );

    const headers = upstreamCall()[1]?.headers as Headers;
    expect(headers.get(banned)).toBeNull();
  });

  it("strips hop-by-hop headers from the response", async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response("body", {
          status: 200,
          headers: { connection: "close", "x-custom": "kept" },
        }),
    );

    const res = await GET(
      request("http://localhost:3000/api/pg/health"),
      params("health"),
    );

    expect(res.headers.get("connection")).toBeNull();
    expect(res.headers.get("x-custom")).toBe("kept");
  });

  it("passes the backend's set-cookie through", async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response("{}", {
          status: 200,
          headers: { "set-cookie": "session_token=abc; HttpOnly" },
        }),
    );

    const res = await POST(
      request("http://localhost:3000/api/pg/auth/login", { method: "POST" }),
      params("auth", "login"),
    );

    expect(res.headers.get("set-cookie")).toContain("session_token=abc");
  });
});
