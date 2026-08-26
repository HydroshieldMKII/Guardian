import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_devices')
@Index(['userId', 'deviceIdentifier'], { unique: true })
export class UserDevice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', name: 'username', nullable: true })
  username: string | null;

  @Column({ type: 'varchar', name: 'avatar_url', nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'device_identifier' })
  deviceIdentifier: string;

  @Column({ type: 'varchar', name: 'device_name', nullable: true })
  deviceName: string | null;

  @Column({ type: 'varchar', name: 'device_platform', nullable: true })
  devicePlatform: string | null;

  @Column({ type: 'varchar', name: 'device_product', nullable: true })
  deviceProduct: string | null;

  @Column({ type: 'varchar', name: 'device_version', nullable: true })
  deviceVersion: string | null;

  @Column({ name: 'status', default: 'pending' })
  status: 'pending' | 'approved' | 'rejected';

  @CreateDateColumn({ name: 'first_seen' })
  firstSeen: Date;

  @UpdateDateColumn({ name: 'last_seen' })
  lastSeen: Date;

  @Column({ name: 'session_count', default: 0 })
  sessionCount: number;

  // To keep track if it's a new session
  @Column({ type: 'varchar', name: 'current_session_key', nullable: true })
  currentSessionKey: string | null;

  @Column({ type: 'varchar', name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'datetime', name: 'temporary_access_until', nullable: true })
  temporaryAccessUntil: Date | null;

  @Column({
    type: 'datetime',
    name: 'temporary_access_granted_at',
    nullable: true,
  })
  temporaryAccessGrantedAt: Date | null;

  @Column({
    type: 'int',
    name: 'temporary_access_duration_minutes',
    nullable: true,
  })
  temporaryAccessDurationMinutes: number | null;

  @Column({ name: 'temporary_access_bypass_policies', default: false })
  temporaryAccessBypassPolicies: boolean;

  @Column({ name: 'exclude_from_concurrent_limit', default: false })
  excludeFromConcurrentLimit: boolean;

  // Description provided by user when requesting device approval
  @Column({
    name: 'request_description',
    nullable: true,
    type: 'varchar',
    length: 500,
  })
  requestDescription: string | null;

  // Timestamp when user submitted a note/request
  @Column({ type: 'datetime', name: 'request_submitted_at', nullable: true })
  requestSubmittedAt: Date | null;

  // Timestamp when admin read the user's note
  @Column({ type: 'datetime', name: 'request_note_read_at', nullable: true })
  requestNoteReadAt: Date | null;
}
