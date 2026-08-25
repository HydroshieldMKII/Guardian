import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { EventsController } from '@/modules/events/events.controller';
import { LiveEventsService } from '@/modules/events/live-events.service';
import { ADMIN_ONLY_KEY } from '@/modules/auth/decorators/admin-only.decorator';
import { PUBLIC_KEY } from '@/modules/auth/decorators/public.decorator';

describe('EventsController', () => {
  let controller: EventsController;
  let liveEvents: { register: jest.Mock };

  beforeEach(async () => {
    liveEvents = { register: jest.fn() };

    const module = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [{ provide: LiveEventsService, useValue: liveEvents }],
    }).compile();

    controller = module.get(EventsController);
  });

  it('hands the raw response to the live stream registry', () => {
    const res = {} as Response;

    controller.stream(res);

    expect(liveEvents.register).toHaveBeenCalledWith(res);
  });

  it('is restricted to admins', () => {
    const reflector = new Reflector();

    expect(
      reflector.get<boolean>(ADMIN_ONLY_KEY, EventsController.prototype.stream),
    ).toBe(true);
  });

  it('is not reachable without a session', () => {
    const reflector = new Reflector();

    expect(
      reflector.get<boolean>(PUBLIC_KEY, EventsController.prototype.stream),
    ).toBeUndefined();
    expect(
      reflector.get<boolean>(PUBLIC_KEY, EventsController),
    ).toBeUndefined();
  });
});
