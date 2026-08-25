import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_preferences')
@Index(['userId'], { unique: true })
export class UserPreference {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @Column({ type: 'varchar', name: 'username', nullable: true })
  username: string | null;

  @Column({ type: 'varchar', name: 'avatar_url', nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'default_block', type: 'boolean', nullable: true })
  defaultBlock: boolean | null; // true, false, or null for global default

  @Column({ name: 'hidden', type: 'boolean', default: false })
  hidden: boolean;

  // IP/Network access policies
  @Column({ name: 'network_policy', type: 'varchar', default: 'both' })
  networkPolicy: 'both' | 'lan' | 'wan'; // Default: both LAN and WAN allowed

  @Column({ name: 'ip_access_policy', type: 'varchar', default: 'all' })
  ipAccessPolicy: 'all' | 'restricted'; // Default: all IPs allowed

  @Column({ name: 'allowed_ips', type: 'json', nullable: true })
  allowedIPs: string[]; // IP addresses or ranges

  // Concurrent stream limit (null = use global default, 0 = unlimited)
  @Column({ name: 'concurrent_stream_limit', type: 'int', nullable: true })
  concurrentStreamLimit: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
