import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';

export const LIVE_EVENT_DASHBOARD = 'dashboard';
const HEARTBEAT_MS = 25000;

/**
 * Holds the open Server-Sent Events streams and writes updates to them.
 *
 * SSE is used rather than WebSockets because the web tier proxies /api/pg/*
 * and cannot forward an upgrade handshake; a streaming HTTP response passes
 * through untouched. Traffic here is server-to-client only, so the extra
 * duplex channel a socket would provide has no use.
 */
@Injectable()
export class LiveEventsService {
  private readonly logger = new Logger(LiveEventsService.name);
  private readonly clients = new Set<Response>();
  private heartbeat?: NodeJS.Timeout;

  register(res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write(': connected\n\n');

    this.clients.add(res);
    this.startHeartbeat();

    res.on('close', () => this.release(res));
  }

  broadcastDashboard(payload: unknown): void {
    this.publish(LIVE_EVENT_DASHBOARD, payload);
  }

  hasListeners(): boolean {
    return this.clients.size > 0;
  }

  listenerCount(): number {
    return this.clients.size;
  }

  private publish(event: string, payload: unknown): void {
    if (this.clients.size === 0) {
      return;
    }

    const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;

    for (const client of [...this.clients]) {
      try {
        client.write(frame);
      } catch (error) {
        this.logger.warn('Dropping a live client that could not be written to');
        this.logger.debug(error);
        this.release(client);
      }
    }
  }

  private release(res: Response): void {
    this.clients.delete(res);

    if (this.clients.size === 0 && this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = undefined;
    }
  }

  /**
   * Comment frames keep intermediaries from closing an idle stream.
   */
  private startHeartbeat(): void {
    if (this.heartbeat) {
      return;
    }

    this.heartbeat = setInterval(() => {
      for (const client of [...this.clients]) {
        try {
          client.write(': keep-alive\n\n');
        } catch {
          this.release(client);
        }
      }
    }, HEARTBEAT_MS);

    this.heartbeat.unref?.();
  }
}
