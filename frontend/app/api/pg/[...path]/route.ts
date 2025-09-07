import { NextRequest } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  return proxy(req, resolvedParams);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  return proxy(req, resolvedParams);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  return proxy(req, resolvedParams);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  return proxy(req, resolvedParams);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  return proxy(req, resolvedParams);
}

async function proxy(req: NextRequest, params: { path: string[] }) {
  const backend = process.env.PLEXGUARD_BACKEND_URL ?? "http://backend:3001";
  const target = new URL(backend.replace(/\/$/, ""));
  const upstream = new URL(`${target.origin}/${params.path.join("/")}${req.nextUrl.search}`);

  const init: RequestInit = {
    method: req.method,
    headers: filterHeaders(Object.fromEntries(req.headers)),
    body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer(),
  };

  const res = await fetch(upstream.toString(), init);
  const headers = filterHeaders(Object.fromEntries(res.headers));
  return new Response(res.body, { status: res.status, headers });
}

function filterHeaders(h: Record<string, string>) {
  const banned = new Set([
    "connection", 
    "keep-alive", 
    "transfer-encoding", 
    "upgrade", 
    "proxy-authenticate", 
    "proxy-authorization"
  ]);
  
  for (const k of Object.keys(h)) {
    if (banned.has(k.toLowerCase())) delete h[k];
  }
  return new Headers(h);
}
