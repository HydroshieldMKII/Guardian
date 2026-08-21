import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Request } from 'express';
import { ADMIN_ONLY_KEY, AdminOnly } from './admin-only.decorator';
import { PUBLIC_KEY, Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';

describe('Public', () => {
  it('stamps the public flag onto a handler', () => {
    class Controller {
      @Public()
      handler() {}
    }

    expect(Reflect.getMetadata(PUBLIC_KEY, Controller.prototype.handler)).toBe(
      true,
    );
  });

  it('stamps the public flag onto a class', () => {
    @Public()
    class Controller {}

    expect(Reflect.getMetadata(PUBLIC_KEY, Controller)).toBe(true);
  });

  it('leaves an undecorated handler unmarked', () => {
    class Controller {
      handler() {}
    }

    expect(
      Reflect.getMetadata(PUBLIC_KEY, Controller.prototype.handler),
    ).toBeUndefined();
  });
});

describe('AdminOnly', () => {
  it('stamps the admin-only flag onto a handler', () => {
    class Controller {
      @AdminOnly()
      handler() {}
    }

    expect(
      Reflect.getMetadata(ADMIN_ONLY_KEY, Controller.prototype.handler),
    ).toBe(true);
  });

  it('uses a metadata key distinct from the public one', () => {
    expect(ADMIN_ONLY_KEY).not.toBe(PUBLIC_KEY);
  });
});

describe('CurrentUser', () => {
  const extractFactory = () => {
    class Controller {
      handler(@CurrentUser() _user: unknown) {}
    }

    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      Controller,
      'handler',
    ) as Record<
      string,
      { factory: (data: unknown, ctx: ExecutionContext) => unknown }
    >;

    return Object.values(metadata)[0].factory;
  };

  const contextFor = (request: Partial<Request>) =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as ExecutionContext;

  it('returns the user attached to the request', () => {
    const user = { userType: 'admin' };
    expect(extractFactory()(undefined, contextFor({ user }))).toBe(user);
  });

  it('returns undefined when no user is attached', () => {
    expect(extractFactory()(undefined, contextFor({}))).toBeUndefined();
  });
});
