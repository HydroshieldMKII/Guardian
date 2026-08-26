import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserDevice } from '@/entities/user-device.entity';
import { UserPreference } from '@/entities/user-preference.entity';

@Entity('session_history')
@Index(['userId', 'startedAt'])
export class SessionHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'session_key' })
  sessionKey: string;

  @Column({ name: 'user_id' })
  userId: string;

  // Foreign key to UserPreference to get user info (username, etc.)
  @ManyToOne(() => UserPreference, { eager: false, nullable: true })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'userId' })
  userPreference?: UserPreference | null;

  // Foreign key to UserDevice
  @Column({ type: 'int', name: 'user_device_id', nullable: true })
  userDeviceId: number | null;

  @ManyToOne(() => UserDevice, { eager: false })
  @JoinColumn({ name: 'user_device_id' })
  userDevice: UserDevice | null;

  @Column({ type: 'varchar', name: 'device_address', nullable: true })
  deviceAddress: string | null;

  @Column({ type: 'varchar', name: 'content_title', nullable: true })
  contentTitle: string | null;

  @Column({ type: 'varchar', name: 'content_type', nullable: true })
  contentType: string | null;

  @Column({ type: 'varchar', name: 'grandparent_title', nullable: true })
  grandparentTitle: string | null;

  @Column({ type: 'varchar', name: 'parent_title', nullable: true })
  parentTitle: string | null;

  @Column({ type: 'int', name: 'year', nullable: true })
  year: number | null;

  @Column({ type: 'int', name: 'duration', nullable: true })
  duration: number | null;

  @Column({ type: 'int', name: 'view_offset', nullable: true })
  viewOffset: number | null;

  @Column({ type: 'varchar', name: 'thumb', nullable: true })
  thumb: string | null;

  @Column({ type: 'varchar', name: 'art', nullable: true })
  art: string | null;

  @Column({ type: 'varchar', name: 'video_resolution', nullable: true })
  videoResolution: string | null;

  @Column({ type: 'int', name: 'bitrate', nullable: true })
  bitrate: number | null;

  @Column({ type: 'varchar', name: 'container', nullable: true })
  container: string | null;

  @Column({ type: 'varchar', name: 'video_codec', nullable: true })
  videoCodec: string | null;

  @Column({ type: 'varchar', name: 'audio_codec', nullable: true })
  audioCodec: string | null;

  @Column({ type: 'varchar', name: 'session_location', nullable: true })
  sessionLocation: string | null;

  @Column({ type: 'int', name: 'bandwidth', nullable: true })
  bandwidth: number | null;

  @CreateDateColumn({ name: 'started_at' })
  startedAt: Date;

  @Column({
    name: 'ended_at',
    type: 'datetime',
    nullable: true,
  })
  endedAt?: Date | null;

  @Column({ name: 'terminated', default: false })
  terminated: boolean;

  @Column({ type: 'varchar', name: 'player_state', nullable: true })
  playerState: string | null;

  @Column({ type: 'varchar', name: 'product', nullable: true })
  product: string | null;

  @Column({ type: 'varchar', name: 'rating_key', nullable: true })
  ratingKey: string | null;

  @Column({ type: 'varchar', name: 'parent_rating_key', nullable: true })
  parentRatingKey: string | null;
}
