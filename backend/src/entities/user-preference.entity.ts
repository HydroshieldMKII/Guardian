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

  @Column({ name: 'username', nullable: true })
  username: string;

  @Column({ name: 'default_block', type: 'text', nullable: true })
  defaultBlock: string | null; // 'true', 'false', or null for global default

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Helper methods to work with boolean values
  getDefaultBlockBoolean(): boolean | null {
    if (this.defaultBlock === null) return null;
    return this.defaultBlock === 'true';
  }

  setDefaultBlockBoolean(value: boolean | null): void {
    if (value === null) {
      this.defaultBlock = null;
    } else {
      this.defaultBlock = value.toString();
    }
  }
}
