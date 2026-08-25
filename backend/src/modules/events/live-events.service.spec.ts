import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import {
  LIVE_EVENT_DASHBOARD,
  LiveEventsService,
} from '@/modules/events/live-events.service';

describe('LiveEventsService', () => {
  let service: LiveEventsService;

  type Client = {
    res: Response;
    write: jest.Mock;
    setHeader: jest.Mock;
    flushHeaders: jest.Mock;
    close: () => void;
  };

  const client = (): Client => {
    const listeners = new Map<string, () => void>();
    const write = jest.fn();
    const setHeader = jest.fn();
    const flushHeaders = jest.fn();
    const stub: Pick<Response, 'setHeader' | 'flushHeaders' | 'write' | 'on'> =
      {
        setHeader,
        flushHeaders,
        write,
        on: ((event: string, handler: () => void) => {
          listeners.set(event, handler);
          return stub;
        }) as Response['on'],
      };

    return {
      res: stub as Response,
      write,
      setHeader,
      flushHeaders,
      close: () => listeners.get('close')?.(),
    };
  };

  const framesOf = (c: Client) =>
    c.write.mock.calls.map(([frame]) => frame as string);

  const dataFrames = (c: Client) =>
    framesOf(c).filter((frame) => frame.startsWith('event:'));

  beforeEach(async () => {
    jest.useFakeTimers();
    const module = await Test.createTestingModule({
      providers: [LiveEventsService],
    }).compile();

    service = module.get(LiveEventsService);
  });

  afterEach(() => jest.useRealTimers());

  describe('register', () => {
    it('announces an event stream that must not be cached', () => {
      const c = client();
      service.register(c.res);

      expect(c.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream',
      );
      expect(c.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-cache, no-transform',
      );
      expect(c.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
    });

    it('asks intermediaries not to buffer the stream', () => {
      const c = client();
      service.register(c.res);

      expect(c.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    });

    it('sends the headers before anything is published', () => {
      const c = client();
      service.register(c.res);

      expect(c.flushHeaders).toHaveBeenCalled();
      expect(c.flushHeaders.mock.invocationCallOrder[0]).toBeLessThan(
        c.write.mock.invocationCallOrder[0],
      );
    });

    it('opens with a comment so the client sees the stream immediately', () => {
      const c = client();
      service.register(c.res);

      expect(framesOf(c)[0]).toBe(': connected\n\n');
    });

    it('counts the connected client', () => {
      service.register(client().res);
      service.register(client().res);

      expect(service.listenerCount()).toBe(2);
      expect(service.hasListeners()).toBe(true);
    });
  });

  describe('broadcastDashboard', () => {
    it('writes a named event frame carrying the json payload', () => {
      const c = client();
      service.register(c.res);

      service.broadcastDashboard({ stats: { total: 2 } });

      expect(dataFrames(c)).toEqual([
        `event: ${LIVE_EVENT_DASHBOARD}\ndata: {"stats":{"total":2}}\n\n`,
      ]);
    });

    it('reaches every connected client', () => {
      const a = client();
      const b = client();
      service.register(a.res);
      service.register(b.res);

      service.broadcastDashboard({ ok: true });

      expect(dataFrames(a)).toHaveLength(1);
      expect(dataFrames(b)).toHaveLength(1);
    });

    it('does nothing when nobody is listening', () => {
      expect(() => service.broadcastDashboard({})).not.toThrow();
      expect(service.hasListeners()).toBe(false);
    });

    it('keeps the payload on a single line so the frame stays valid', () => {
      const c = client();
      service.register(c.res);

      service.broadcastDashboard({ note: 'line one\nline two' });

      const body = dataFrames(c)[0].split('data: ')[1];
      expect(body.split('\n')).toHaveLength(3);
    });
  });

  describe('disconnects', () => {
    it('forgets a client once its request closes', () => {
      const c = client();
      service.register(c.res);

      c.close();

      expect(service.hasListeners()).toBe(false);
    });

    it('stops writing to a closed client', () => {
      const open = client();
      const gone = client();
      service.register(open.res);
      service.register(gone.res);

      gone.close();
      service.broadcastDashboard({ ok: true });

      expect(dataFrames(open)).toHaveLength(1);
      expect(dataFrames(gone)).toHaveLength(0);
    });

    it('drops a client whose socket rejects the write', () => {
      const healthy = client();
      const broken = client();
      service.register(healthy.res);
      service.register(broken.res);
      broken.write.mockImplementation(() => {
        throw new Error('EPIPE');
      });

      service.broadcastDashboard({ ok: true });

      expect(service.listenerCount()).toBe(1);
      expect(dataFrames(healthy)).toHaveLength(1);
    });

    it('keeps serving the survivors after one client breaks', () => {
      const broken = client();
      const healthy = client();
      service.register(broken.res);
      service.register(healthy.res);
      broken.write.mockImplementation(() => {
        throw new Error('EPIPE');
      });

      service.broadcastDashboard({ first: true });
      service.broadcastDashboard({ second: true });

      expect(dataFrames(healthy)).toHaveLength(2);
    });
  });

  describe('heartbeat', () => {
    it('sends a keep-alive comment while the stream is idle', () => {
      const c = client();
      service.register(c.res);

      jest.advanceTimersByTime(25000);

      expect(framesOf(c)).toContain(': keep-alive\n\n');
    });

    it('keeps sending them on a schedule', () => {
      const c = client();
      service.register(c.res);

      jest.advanceTimersByTime(75000);

      expect(
        framesOf(c).filter((frame) => frame === ': keep-alive\n\n'),
      ).toHaveLength(3);
    });

    it('runs a single timer no matter how many clients connect', () => {
      const a = client();
      const b = client();
      service.register(a.res);
      service.register(b.res);

      jest.advanceTimersByTime(25000);

      expect(
        framesOf(a).filter((frame) => frame === ': keep-alive\n\n'),
      ).toHaveLength(1);
    });

    it('stops once the last client leaves', () => {
      const c = client();
      service.register(c.res);
      c.close();

      jest.advanceTimersByTime(50000);

      expect(framesOf(c)).not.toContain(': keep-alive\n\n');
    });

    it('drops a client that breaks during a heartbeat', () => {
      const c = client();
      service.register(c.res);
      c.write.mockImplementation(() => {
        throw new Error('EPIPE');
      });

      jest.advanceTimersByTime(25000);

      expect(service.hasListeners()).toBe(false);
    });

    it('restarts the heartbeat for a client that reconnects', () => {
      const first = client();
      service.register(first.res);
      first.close();

      const second = client();
      service.register(second.res);
      jest.advanceTimersByTime(25000);

      expect(framesOf(second)).toContain(': keep-alive\n\n');
    });
  });
});
