import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from '@/modules/auth/auth.service';
import { ConfigService } from '@/modules/config/services/config.service';
import { PUBLIC_KEY } from '@/modules/auth/decorators/public.decorator';
import { ADMIN_ONLY_KEY } from '@/modules/auth/decorators/admin-only.decorator';
import { extractSessionToken } from '@/modules/auth/session-cookie';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    // (CORS preflight)
    if (req.method === 'OPTIONS') {
      return true;
    }

    // Check if route is marked as public
    const isPublic =
      this.reflector.get<boolean>(PUBLIC_KEY, context.getHandler()) ||
      this.reflector.get<boolean>(PUBLIC_KEY, context.getClass());

    if (isPublic) {
      return true;
    }

    const token = extractSessionToken(req);

    if (!token) {
      throw new UnauthorizedException('No session token provided');
    }

    // Validate session and attach user to request
    const user = await this.authService.validateSession(token);

    if (!user) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // If user is a Plex user (not admin), check if portal is enabled
    if (user.userType === 'plex_user') {
      const portalEnabled = await this.configService.getSetting(
        'USER_PORTAL_ENABLED',
      );
      if (portalEnabled !== true) {
        throw new ForbiddenException(
          'The user portal is currently disabled. Please contact your administrator.',
        );
      }
    }

    // Check if route requires admin access
    const adminOnly =
      this.reflector.get<boolean>(ADMIN_ONLY_KEY, context.getHandler()) ||
      this.reflector.get<boolean>(ADMIN_ONLY_KEY, context.getClass());

    if (adminOnly && user.userType !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    req.user = user;
    return true;
  }
}
