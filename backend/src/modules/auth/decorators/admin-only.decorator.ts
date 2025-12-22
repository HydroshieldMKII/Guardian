import { SetMetadata } from '@nestjs/common';

export const ADMIN_ONLY_KEY = 'adminOnly';

/**
 * Mark a route as admin-only.
 * This reject Plex user sessions and require a full admin session.
 */
export const AdminOnly = () => SetMetadata(ADMIN_ONLY_KEY, true);
