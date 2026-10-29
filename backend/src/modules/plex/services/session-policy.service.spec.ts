import { DEFAULT_BLOCK_MESSAGES } from '@/common/utils/block-messages';
import { PlexSession } from '@/types/plex.types';
import { SessionPolicyService } from '@/modules/plex/services/session-policy.service';
import {
  approvedDevice,
  createSessionTerminationTestbed,
  session,
  SessionTerminationTestbed,
} from '@/modules/plex/services/session-termination-testbed.fixture';

describe('SessionPolicyService', () => {
  let policy: SessionPolicyService;
  let deviceRepo: SessionTerminationTestbed['deviceRepo'];
  let preferenceRepo: SessionTerminationTestbed['preferenceRepo'];
  let usersService: SessionTerminationTestbed['usersService'];
  let timePolicyService: SessionTerminationTestbed['timePolicyService'];
  let configService: SessionTerminationTestbed['configService'];
  let temporaryAccessService: SessionTerminationTestbed['temporaryAccessService'];
  let ipValidationService: SessionTerminationTestbed['ipValidationService'];

  const evaluate = (target: PlexSession = session()) => policy.evaluate(target);

  beforeEach(async () => {
    const testbed = await createSessionTerminationTestbed();
    ({
      deviceRepo,
      preferenceRepo,
      usersService,
      timePolicyService,
      configService,
      temporaryAccessService,
      ipValidationService,
    } = testbed);
    policy = testbed.module.get(SessionPolicyService);
  });

  describe('device approval', () => {
    it('allows an approved device', async () => {
      await expect(evaluate()).resolves.toEqual({ shouldStop: false });
    });

    it('blocks a rejected device', async () => {
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({ status: 'rejected' }),
      );

      await expect(evaluate()).resolves.toEqual({
        shouldStop: true,
        reason: 'msg:MSG_DEVICE_REJECTED',
        stopCode: 'DEVICE_REJECTED',
      });
    });

    it('uses the default message when the rejected text is unset', async () => {
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({ status: 'rejected' }),
      );
      configService.getSetting.mockResolvedValue(null);

      const decision = await evaluate();
      expect(decision.reason).toBe(DEFAULT_BLOCK_MESSAGES.deviceRejected);
    });

    it('blocks a pending device when the user default is block', async () => {
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({ status: 'pending' }),
      );

      await expect(evaluate()).resolves.toEqual({
        shouldStop: true,
        reason: 'msg:MSG_DEVICE_PENDING',
        stopCode: 'DEVICE_PENDING',
      });
    });

    it('allows a pending device when the user default is allow', async () => {
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({ status: 'pending' }),
      );
      usersService.getEffectiveDefaultBlock.mockResolvedValue(false);

      await expect(evaluate()).resolves.toEqual({ shouldStop: false });
    });

    it('treats an untracked device as pending', async () => {
      deviceRepo.findOne.mockResolvedValue(null);

      const decision = await evaluate();
      expect(decision.stopCode).toBe('DEVICE_PENDING');
    });

    it('allows a pending device holding temporary access', async () => {
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({ status: 'pending' }),
      );
      temporaryAccessService.isTemporaryAccessValid.mockResolvedValue(true);

      await expect(evaluate()).resolves.toEqual({ shouldStop: false });
    });

    it('allows a rejected device holding temporary access', async () => {
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({ status: 'rejected' }),
      );
      temporaryAccessService.isTemporaryAccessValid.mockResolvedValue(true);

      await expect(evaluate()).resolves.toEqual({ shouldStop: false });
    });

    it('still applies time rules to temporary access without a bypass', async () => {
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({ status: 'pending' }),
      );
      temporaryAccessService.isTemporaryAccessValid.mockResolvedValue(true);
      timePolicyService.isTimeScheduleAllowed.mockResolvedValue(false);

      const decision = await evaluate();
      expect(decision.stopCode).toBe('TIME_RESTRICTED');
    });

    it('skips every policy for a device granted a policy bypass', async () => {
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({
          status: 'rejected',
          temporaryAccessBypassPolicies: true,
        }),
      );
      temporaryAccessService.isTemporaryAccessValid.mockResolvedValue(true);
      timePolicyService.isTimeScheduleAllowed.mockResolvedValue(false);

      await expect(evaluate()).resolves.toEqual({ shouldStop: false });
      expect(timePolicyService.isTimeScheduleAllowed).not.toHaveBeenCalled();
    });

    it('ignores the bypass flag once temporary access has expired', async () => {
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({
          status: 'rejected',
          temporaryAccessBypassPolicies: true,
        }),
      );

      const decision = await evaluate();
      expect(decision.stopCode).toBe('DEVICE_REJECTED');
    });

    it('never touches Plexamp music', async () => {
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({ status: 'rejected' }),
      );

      await expect(
        evaluate(session({ product: 'Plexamp', type: 'track' })),
      ).resolves.toEqual({ shouldStop: false });
      expect(deviceRepo.findOne).not.toHaveBeenCalled();
    });

    it('applies the rules to video from a player calling itself Plexamp', async () => {
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({ status: 'rejected' }),
      );

      await expect(
        evaluate(session({ product: 'Plexamp', type: 'movie' })),
      ).resolves.toMatchObject({ shouldStop: true });
    });

    it('leaves a session with no user or device identifier alone', async () => {
      const anonymous = session();
      delete (anonymous as { User?: unknown }).User;

      await expect(evaluate(anonymous)).resolves.toEqual({
        shouldStop: false,
      });
    });

    it('allows the session when the policy check itself fails', async () => {
      deviceRepo.findOne.mockRejectedValue(new Error('db down'));

      await expect(evaluate()).resolves.toEqual({ shouldStop: false });
    });
  });

  describe('time policies', () => {
    it('blocks a session outside the allowed schedule', async () => {
      timePolicyService.isTimeScheduleAllowed.mockResolvedValue(false);

      await expect(evaluate()).resolves.toEqual({
        shouldStop: true,
        reason: 'msg:MSG_TIME_RESTRICTED',
        stopCode: 'TIME_RESTRICTED',
      });
    });

    it('falls back to the default message when none is configured', async () => {
      timePolicyService.isTimeScheduleAllowed.mockResolvedValue(false);
      configService.getSetting.mockResolvedValue('');

      const decision = await evaluate();
      expect(decision.reason).toBe(DEFAULT_BLOCK_MESSAGES.timeRestricted);
    });

    it('checks the schedule for the device being played', async () => {
      await evaluate();

      expect(timePolicyService.isTimeScheduleAllowed).toHaveBeenCalledWith(
        'u1',
        'dev-1',
      );
    });
  });

  describe('IP policies', () => {
    it('does not consult the validator for a user with no preferences', async () => {
      await evaluate();
      expect(ipValidationService.validateIPAccess).not.toHaveBeenCalled();
    });

    it('passes the stored policy and custom messages to the validator', async () => {
      preferenceRepo.findOne.mockResolvedValue({
        userId: 'u1',
        networkPolicy: 'lan',
        ipAccessPolicy: 'restricted',
        allowedIPs: ['10.0.0.0/8'],
      });

      await evaluate();

      expect(ipValidationService.validateIPAccess).toHaveBeenCalledWith(
        '10.0.0.5',
        {
          networkPolicy: 'lan',
          ipAccessPolicy: 'restricted',
          allowedIPs: ['10.0.0.0/8'],
        },
        {
          lanOnly: 'msg:MSG_IP_LAN_ONLY',
          wanOnly: 'msg:MSG_IP_WAN_ONLY',
          notAllowed: 'msg:MSG_IP_NOT_ALLOWED',
        },
      );
    });

    it('defaults a preference row with no policy fields to the permissive settings', async () => {
      preferenceRepo.findOne.mockResolvedValue({ userId: 'u1' });

      await evaluate();

      expect(ipValidationService.validateIPAccess).toHaveBeenCalledWith(
        '10.0.0.5',
        { networkPolicy: 'both', ipAccessPolicy: 'all', allowedIPs: [] },
        expect.anything(),
      );
    });

    it('leaves unset texts to the validator defaults', async () => {
      preferenceRepo.findOne.mockResolvedValue({ userId: 'u1' });
      configService.getSetting.mockResolvedValue(null);

      await evaluate();

      expect(ipValidationService.validateIPAccess).toHaveBeenCalledWith(
        '10.0.0.5',
        expect.anything(),
        { lanOnly: undefined, wanOnly: undefined, notAllowed: undefined },
      );
    });

    it('blocks a session the validator rejects, keeping its stop code', async () => {
      preferenceRepo.findOne.mockResolvedValue({ userId: 'u1' });
      ipValidationService.validateIPAccess.mockReturnValue({
        allowed: false,
        reason: 'Only LAN access is allowed',
        stopCode: 'IP_POLICY_LAN_ONLY',
      });

      await expect(evaluate()).resolves.toEqual({
        shouldStop: true,
        reason: 'Only LAN access is allowed',
        stopCode: 'IP_POLICY_LAN_ONLY',
      });
    });

    it('checks the IP before the schedule', async () => {
      preferenceRepo.findOne.mockResolvedValue({ userId: 'u1' });
      ipValidationService.validateIPAccess.mockReturnValue({
        allowed: false,
        reason: 'Only LAN access is allowed',
      });

      await evaluate();
      expect(timePolicyService.isTimeScheduleAllowed).not.toHaveBeenCalled();
    });

    it('blocks a session Plex reported no address for', async () => {
      preferenceRepo.findOne.mockResolvedValue({ userId: 'u1' });
      const noAddress = session();
      delete (noAddress.Player as { address?: string }).address;

      await expect(evaluate(noAddress)).resolves.toEqual({
        shouldStop: true,
        reason: 'Invalid or missing client IP address from Plex',
        stopCode: undefined,
      });
    });

    it('allows the session when the IP check itself fails', async () => {
      preferenceRepo.findOne.mockRejectedValue(new Error('db down'));

      await expect(evaluate()).resolves.toEqual({ shouldStop: false });
    });

    it('looks up preferences by account uuid when there is no user id', async () => {
      await evaluate({
        ...session(),
        User: { uuid: 'uuid-1', title: 'testuser' },
      });

      expect(preferenceRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'uuid-1' },
      });
    });
  });

  describe('message fallbacks', () => {
    it('uses the default message when the pending text is unset', async () => {
      deviceRepo.findOne.mockResolvedValue(
        approvedDevice({ status: 'pending' }),
      );
      configService.getSetting.mockResolvedValue(null);

      const decision = await evaluate();
      expect(decision.reason).toBe(DEFAULT_BLOCK_MESSAGES.devicePending);
    });
  });
});
