import { BadRequestException } from '@nestjs/common';
import { PasswordResetController } from '@/modules/auth/password-reset.controller';
import {
  AuthControllersTestbed,
  createAuthControllersTestbed,
} from '@/modules/auth/auth-controllers-testbed.fixture';

describe('PasswordResetController', () => {
  let controller: PasswordResetController;
  let passwordResetService: AuthControllersTestbed['passwordResetService'];

  beforeEach(async () => {
    const testbed = await createAuthControllersTestbed();
    ({ passwordResetService } = testbed);
    controller = testbed.module.get(PasswordResetController);
  });

  describe('password reset', () => {
    it('reports what the login page needs to know', async () => {
      await expect(controller.passwordResetStatus()).resolves.toEqual({
        enabled: true,
        emailConfigured: true,
        appUrlConfigured: true,
      });
    });

    it('hands the address to the service', async () => {
      await controller.requestPasswordReset({ email: 'owner@example.com' });

      expect(passwordResetService.requestReset).toHaveBeenCalledWith(
        'owner@example.com',
      );
    });

    it('reports success for an address nobody owns', async () => {
      passwordResetService.requestReset.mockResolvedValue(undefined);

      await expect(
        controller.requestPasswordReset({ email: 'stranger@example.com' }),
      ).resolves.toEqual({ success: true });
    });

    it('reports whether a link is still usable', async () => {
      await expect(
        controller.verifyPasswordReset({ token: 'abc' }),
      ).resolves.toEqual({ valid: true });

      passwordResetService.verify.mockResolvedValue(false);
      await expect(
        controller.verifyPasswordReset({ token: 'abc' }),
      ).resolves.toEqual({ valid: false });
    });

    it('passes the new password through to the service', async () => {
      const dto = {
        token: 'abc',
        password: 'BrandNewPass1!',
        confirmPassword: 'BrandNewPass1!',
      };

      await expect(controller.confirmPasswordReset(dto)).resolves.toEqual({
        success: true,
      });
      expect(passwordResetService.confirm).toHaveBeenCalledWith(dto);
    });

    it('surfaces a rejected link', async () => {
      passwordResetService.confirm.mockRejectedValue(
        new BadRequestException('This reset link is no longer valid.'),
      );

      await expect(
        controller.confirmPasswordReset({
          token: 'abc',
          password: 'BrandNewPass1!',
          confirmPassword: 'BrandNewPass1!',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
