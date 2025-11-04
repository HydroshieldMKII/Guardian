import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
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

    const token = this.extractToken(req);

    if (!token) {
      throw new UnauthorizedException('No session token provided');
    }

    // Validate session and attach user to request
    const user = await this.authService.validateSession(token);

    if (!user) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    req.user = user;
    return true;
  }

  /**
   * Extract token from cookies
   */
  private extractToken(req: Request): string | null {
    // Try cookie
    const cookies = req.cookies as Record<string, string> | undefined;
    if (cookies?.session_token) {
      return cookies.session_token;
    }

    return null;
  }
}
