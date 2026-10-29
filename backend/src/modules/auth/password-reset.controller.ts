import { Controller, Post, Get, Body } from '@nestjs/common';
import { PasswordResetService } from '@/modules/auth/password-reset.service';
import {
  ConfirmPasswordResetDto,
  RequestPasswordResetDto,
  VerifyPasswordResetDto,
} from '@/modules/auth/dto/password-reset.dto';
import { Public } from '@/modules/auth/decorators/public.decorator';

@Controller('auth/password-reset')
export class PasswordResetController {
  constructor(private passwordResetService: PasswordResetService) {}

  @Public()
  @Get('status')
  async passwordResetStatus() {
    return this.passwordResetService.getStatus();
  }

  @Public()
  @Post('request')
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    await this.passwordResetService.requestReset(dto.email);
    return { success: true };
  }

  @Public()
  @Post('verify')
  async verifyPasswordReset(@Body() dto: VerifyPasswordResetDto) {
    return { valid: await this.passwordResetService.verify(dto.token) };
  }

  @Public()
  @Post('confirm')
  async confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto) {
    await this.passwordResetService.confirm(dto);
    return { success: true };
  }
}
