import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { AdminUser } from './admin-user.entity';

export type SessionUserType = 'admin' | 'plex_user';

@Entity('sessions')
@Index('idx_token', ['token'], { unique: true })
@Index('idx_user_id', ['userId'])
@Index('idx_expires_at', ['expiresAt'])
@Index('idx_user_type', ['userType'])
@Index('idx_plex_user_id_session', ['plexUserId'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 512 })
  token: string;

  // For admin sessions: AdminUser.id (UUID)
  // For plex_user sessions: null (use plexUserId instead)
  @Column({ type: 'varchar', length: 36, nullable: true })
  userId: string | null;

  // Type of user session - determines permissions/scope
  @Column({ type: 'varchar', length: 20, default: 'admin' })
  userType: SessionUserType;

  // For plex_user sessions: the Plex user ID
  // For admin sessions: null
  @Column({ type: 'varchar', length: 50, nullable: true })
  plexUserId: string | null;

  // Plex username for display purposes (plex_user sessions only)
  @Column({ type: 'varchar', length: 255, nullable: true })
  plexUsername: string | null;

  // Plex user thumbnail URL (plex_user sessions only)
  @Column({ type: 'varchar', length: 500, nullable: true })
  plexThumb: string | null;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ type: 'datetime', nullable: true })
  lastActivityAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  // Only populated for admin sessions
  @ManyToOne(() => AdminUser, { onDelete: 'CASCADE', nullable: true })
  user: AdminUser | null;
}
