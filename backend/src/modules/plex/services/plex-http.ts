import type { ClientRequest, IncomingMessage } from 'http';
import type { RequestOptions } from 'https';

export const PLEX_CLIENT_IDENTIFIER = 'Guardian';

export interface PlexHttpResponse<T = unknown> {
  ok: boolean;
  status: number;
  json: () => T;
  text: () => string;
}

export class PlexHttpError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'PlexHttpError';
  }
}

export interface PlexReply {
  statusCode: number;
  statusMessage: string;
  body: Buffer;
}

export interface PlexDispatch {
  send: (
    options: RequestOptions,
    callback: (res: IncomingMessage) => void,
  ) => ClientRequest;
  options: RequestOptions;
  body?: string;
  timeoutMs: number;
  timeoutMessage: string;
}

export const isSuccessStatus = (status: number): boolean =>
  status >= 200 && status < 300;

export function withPlexToken(endpoint: string, token: string): string {
  const path = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}X-Plex-Token=${encodeURIComponent(token)}`;
}

export function toPlexHttpResponse(reply: PlexReply): PlexHttpResponse {
  const text = reply.body.toString();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  return {
    ok: true,
    status: reply.statusCode,
    json: () => json,
    text: () => text,
  };
}

export function describeFailedReply(reply: PlexReply): string {
  return `HTTP ${reply.statusCode}: ${reply.statusMessage} - ${reply.body.toString()}`;
}

export function dispatchPlexRequest({
  send,
  options,
  body,
  timeoutMs,
  timeoutMessage,
}: PlexDispatch): Promise<PlexReply> {
  return new Promise((resolve, reject) => {
    const req = send(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () =>
        resolve({
          statusCode: res.statusCode ?? 0,
          statusMessage: res.statusMessage ?? '',
          body: Buffer.concat(chunks),
        }),
      );
    });

    req.on('error', reject);

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(Object.assign(new Error(timeoutMessage), { code: 'ETIMEDOUT' }));
    });

    if (body) {
      req.write(body);
    }

    req.end();
  });
}
