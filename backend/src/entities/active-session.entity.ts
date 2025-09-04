import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('active_sessions')
@Index(['sessionKey'], { unique: true })
export class ActiveSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'session_key' })
  sessionKey: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column({ name: 'username', nullable: true })
  username: string;

  @Column({ name: 'device_identifier', nullable: true })
  deviceIdentifier: string;

  @Column({ name: 'device_name', nullable: true })
  deviceName: string;

  @Column({ name: 'device_platform', nullable: true })
  devicePlatform: string;

  @Column({ name: 'device_product', nullable: true })
  deviceProduct: string;

  @Column({ name: 'device_title', nullable: true })
  deviceTitle: string;

  @Column({ name: 'device_address', nullable: true })
  deviceAddress: string;

  @Column({ name: 'player_state', nullable: true })
  playerState: string;

  @Column({ name: 'content_title', nullable: true })
  contentTitle: string;

  @Column({ name: 'content_type', nullable: true })
  contentType: string;

  @Column({ name: 'grandparent_title', nullable: true })
  grandparentTitle: string;

  @Column({ name: 'parent_title', nullable: true })
  parentTitle: string;

  @Column({ name: 'year', nullable: true })
  year: number;

  @Column({ name: 'duration', nullable: true })
  duration: number;

  @Column({ name: 'view_offset', nullable: true })
  viewOffset: number;

  @Column({ name: 'thumb', nullable: true })
  thumb: string;

  @Column({ name: 'art', nullable: true })
  art: string;

  @Column({ name: 'video_resolution', nullable: true })
  videoResolution: string;

  @Column({ name: 'bitrate', nullable: true })
  bitrate: number;

  @Column({ name: 'container', nullable: true })
  container: string;

  @Column({ name: 'video_codec', nullable: true })
  videoCodec: string;

  @Column({ name: 'audio_codec', nullable: true })
  audioCodec: string;

  @Column({ name: 'session_location', nullable: true })
  sessionLocation: string;

  @Column({ name: 'bandwidth', nullable: true })
  bandwidth: number;

  @Column({ name: 'raw_data', type: 'text', nullable: true })
  rawData: string; // JSON string of the complete session data

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({
    name: 'last_activity',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  lastActivity: Date;
}
