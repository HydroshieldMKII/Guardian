import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Check,
} from 'typeorm';

@Entity('user_time_rules')
@Index(['userId'])
@Index(['userId', 'dayOfWeek'])
export class UserTimeRule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'device_identifier', nullable: true })
  deviceIdentifier?: string; // null for user-wide rule

  @Column({ name: 'rule_name' })
  ruleName: string;

  @Column({ name: 'enabled', type: 'boolean', default: true })
  enabled: boolean;

  @Column({ name: 'action', type: 'varchar' })
  action: 'allow' | 'block';

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

  // Validation method to ensure end time is after start time
  validateTimeRange(): boolean {
    const [startHour, startMinute] = this.startTime.split(':').map(Number);
    const [endHour, endMinute] = this.endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    
    return endMinutes > startMinutes;
  }

  // Check if this rule overlaps with another rule for the same user/day
  overlaps(other: UserTimeRule): boolean {
    // Different users or days don't overlap
    if (this.userId !== other.userId || this.dayOfWeek !== other.dayOfWeek) {
      return false;
    }

    // Different device identifiers only don't overlap if BOTH rules specify devices
    // If one rule is user-wide (null device) and another is device-specific, they can overlap
    if (this.deviceIdentifier && other.deviceIdentifier && this.deviceIdentifier !== other.deviceIdentifier) {
      return false;
    }

    // Same rule doesn't overlap with itself
    if (this.id === other.id) {
      return false;
    }

    const [thisStartHour, thisStartMinute] = this.startTime.split(':').map(Number);
    const [thisEndHour, thisEndMinute] = this.endTime.split(':').map(Number);
    const [otherStartHour, otherStartMinute] = other.startTime.split(':').map(Number);
    const [otherEndHour, otherEndMinute] = other.endTime.split(':').map(Number);
    
    const thisStart = thisStartHour * 60 + thisStartMinute;
    const thisEnd = thisEndHour * 60 + thisEndMinute;
    const otherStart = otherStartHour * 60 + otherStartMinute;
    const otherEnd = otherEndHour * 60 + otherEndMinute;
    
    // Check for overlap: this starts before other ends AND this ends after other starts
    return thisStart < otherEnd && thisEnd > otherStart;
  }
}