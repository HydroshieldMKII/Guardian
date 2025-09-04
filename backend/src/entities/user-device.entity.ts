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

  @Column({ name: 'username', nullable: true })
  username: string;

  @Column({ name: 'device_identifier' })
  deviceIdentifier: string;

  @Column({ name: 'device_name', nullable: true })
  deviceName: string;

  @Column({ name: 'device_platform', nullable: true })
  devicePlatform: string;

  @Column({ name: 'device_product', nullable: true })
  deviceProduct: string;

  @Column({ name: 'device_version', nullable: true })
  deviceVersion: string;

  @Column({ name: 'approved', default: false })
  approved: boolean;

  @Column({ name: 'status', default: 'pending' })
  status: 'pending' | 'approved' | 'rejected';

  @CreateDateColumn({ name: 'first_seen' })
  firstSeen: Date;

  @UpdateDateColumn({ name: 'last_seen' })
  lastSeen: Date;

  @Column({ name: 'session_count', default: 1 })
  sessionCount: number;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', nullable: true })
  userAgent: string;
}
