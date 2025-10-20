import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SessionHistory } from './session-history.entity';

@Entity('notifications')
@Index(['userId', 'createdAt'])
@Index(['read'])
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'session_history_id', nullable: true })
  sessionHistoryId?: number;

  @ManyToOne(() => SessionHistory, {
    eager: false,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'session_history_id' })
  sessionHistory?: SessionHistory;

  @Column({ name: 'text', type: 'text' })
  text: string;

  @Column({ name: 'type', default: 'info' })
  type: 'info' | 'warning' | 'error' | 'block';

  @Column({ name: 'read', default: false })
  read: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
