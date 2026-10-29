import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '@/modules/auth/auth.service';
import { AuthSessionService } from '@/modules/auth/auth-session.service';
import { PlexOAuthService, PlexUser } from '@/modules/auth/plex-oauth.service';
import { ConfigService } from '@/modules/config/services/config.service';
import { AuthResponseDto } from '@/modules/auth/dto/session.dto';

export interface AdminPlexLogin {
  userType: 'admin';
  user: AuthResponseDto['user'];
  session: { expiresAt: Date };
}

export interface PortalPlexLogin {
  userType: 'plex_user';
  user: { plexUserId: string; plexUsername: string; plexThumb?: string };
  session: { expiresAt: Date };
}

export interface PlexLogin {
  token: string;
  body: AdminPlexLogin | PortalPlexLogin;
}

@Injectable()
export class PlexLoginService {
  constructor(
    private readonly authService: AuthService,
    private readonly authSessions: AuthSessionService,
    private readonly plexOAuthService: PlexOAuthService,
    private readonly configService: ConfigService,
  ) {}

  async isEnabled(): Promise<boolean> {
    if (await this.plexOAuthService.getAdminWithPlexLinked()) {
      return true;
    }
    return (await this.portalEnabled()) === true;
  }

  async login(authToken: string): Promise<PlexLogin> {
    const plexUser =
      await this.plexOAuthService.getPlexUserFromToken(authToken);
    const admin = await this.authService.findAdminByPlexUserId(
      String(plexUser.id),
    );

    return admin ? this.adminLogin(admin.id) : this.portalLogin(plexUser);
  }

  private async adminLogin(adminId: string): Promise<PlexLogin> {
    const { user, session } =
      await this.authService.createAdminSessionByPlex(adminId);
    return {
      token: session.token,
      body: {
        userType: 'admin',
        user,
        session: { expiresAt: session.expiresAt },
      },
    };
  }

  private async portalLogin(plexUser: PlexUser): Promise<PlexLogin> {
    const plexUserId = String(plexUser.id);
    if (!(await this.plexOAuthService.isPlexUserOnServer(plexUserId))) {
      throw new UnauthorizedException(
        'Your Plex account does not have access to this server.',
      );
    }

    if ((await this.portalEnabled()) !== true) {
      throw new UnauthorizedException(
        'The user portal is currently disabled. Please contact your administrator.',
      );
    }

    const session = await this.authSessions.createPlexUserSession({
      plexUserId,
      plexUsername: plexUser.username,
      plexThumb: plexUser.thumb,
    });
    return {
      token: session.token,
      body: {
        userType: 'plex_user',
        user: {
          plexUserId: session.plexUserId,
          plexUsername: session.plexUsername,
          plexThumb: session.plexThumb,
        },
        session: { expiresAt: session.expiresAt },
      },
    };
  }

  private portalEnabled() {
    return this.configService.getSetting('USER_PORTAL_ENABLED');
  }
}
