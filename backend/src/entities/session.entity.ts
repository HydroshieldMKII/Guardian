import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { AdminUser } from './admin-user.entity';

@Entity('sessions')
@Index('idx_token', ['token'], { unique: true })
@Index('idx_user_id', ['userId'])
@Index('idx_expires_at', ['expiresAt'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 512 })
  token: string;

  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ type: 'datetime', nullable: true })
  lastActivityAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => AdminUser, { onDelete: 'CASCADE' })
  user: AdminUser;
}
