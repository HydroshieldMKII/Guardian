import { Controller, Get, Req } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import { trustProxyHops } from '@/common/security/rate-limit';

@Controller()
class ClientIpController {
  @Get('client-ip')
  clientIp(@Req() req: Request): { ip: string } {
    return { ip: req.ip ?? '' };
  }
}

const CLIENT = '203.0.113.5';
const EDGE_PROXY = '198.51.100.7';
const LOOPBACK = '::ffff:127.0.0.1';

describe('trust proxy wiring', () => {
  const original = process.env.TRUST_PROXY_HOPS;
  let app: NestExpressApplication;

  const bootWith = async (hops: string | undefined) => {
    if (hops === undefined) {
      delete process.env.TRUST_PROXY_HOPS;
    } else {
      process.env.TRUST_PROXY_HOPS = hops;
    }

    const moduleRef = await Test.createTestingModule({
      controllers: [ClientIpController],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.set('trust proxy', trustProxyHops());
    await app.init();
    return app;
  };

  const clientIpFor = async (forwardedFor?: string): Promise<string> => {
    const pending = request(app.getHttpServer()).get('/client-ip');
    const response = forwardedFor
      ? await pending.set('X-Forwarded-For', forwardedFor)
      : await pending;
    return (response.body as { ip: string }).ip;
  };

  afterEach(async () => {
    await app?.close();
    if (original === undefined) {
      delete process.env.TRUST_PROXY_HOPS;
    } else {
      process.env.TRUST_PROXY_HOPS = original;
    }
  });

  it('reads the client through the bundled web proxy by default', async () => {
    await bootWith(undefined);

    expect(await clientIpFor(`${CLIENT}, ${EDGE_PROXY}`)).toBe(EDGE_PROXY);
  });

  it('reads the client through one proxy by default', async () => {
    await bootWith(undefined);

    expect(await clientIpFor(CLIENT)).toBe(CLIENT);
  });

  it('reads past a second proxy when two hops are trusted', async () => {
    await bootWith('2');

    expect(await clientIpFor(`${CLIENT}, ${EDGE_PROXY}`)).toBe(CLIENT);
  });

  it('ignores the forwarded header when nothing is trusted', async () => {
    await bootWith('0');

    expect(await clientIpFor(`${CLIENT}, ${EDGE_PROXY}`)).toBe(LOOPBACK);
  });

  it('falls back to one hop when the setting is nonsense', async () => {
    await bootWith('many');

    expect(await clientIpFor(`${CLIENT}, ${EDGE_PROXY}`)).toBe(EDGE_PROXY);
  });

  it('uses the socket address when no proxy forwards a header', async () => {
    await bootWith(undefined);

    expect(await clientIpFor()).toBe(LOOPBACK);
  });
});
