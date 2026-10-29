import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Check,
} from 'typeorm';
import { minutesOfDay } from '@/common/utils/time-of-day';

@Entity('user_time_rules')
@Index(['userId'])
@Index(['userId', 'dayOfWeek'])
export class UserTimeRule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', name: 'device_identifier', nullable: true })
  deviceIdentifier?: string; // null for user-wide rule

  @Column({ name: 'rule_name' })
  ruleName: string;

  @Column({ name: 'enabled', type: 'boolean', default: true })
  enabled: boolean;

  // Single day constraint (0=Sunday, 1=Monday, ..., 6=Saturday)
  @Column({ name: 'day_of_week', type: 'int' })
  @Check('day_of_week >= 0 AND day_of_week <= 6')
  dayOfWeek: number;

  @Column({ name: 'start_time', type: 'varchar' })
  startTime: string; // HH:mm format (24-hour)

  @Column({ name: 'end_time', type: 'varchar' })
  endTime: string; // HH:mm format (24-hour)

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  validateTimeRange(): boolean {
    return minutesOfDay(this.endTime) > minutesOfDay(this.startTime);
  }

  overlaps(other: UserTimeRule): boolean {
    if (this.userId !== other.userId || this.dayOfWeek !== other.dayOfWeek) {
      return false;
    }

    if (
      this.deviceIdentifier &&
      other.deviceIdentifier &&
      this.deviceIdentifier !== other.deviceIdentifier
    ) {
      return false;
    }

    if (this.id === other.id) {
      return false;
    }

    return (
      minutesOfDay(this.startTime) < minutesOfDay(other.endTime) &&
      minutesOfDay(this.endTime) > minutesOfDay(other.startTime)
    );
  }
}
