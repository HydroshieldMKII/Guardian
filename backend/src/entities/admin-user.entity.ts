import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('admin_users')
@Index('idx_username', ['username'], { unique: true })
@Index('idx_email', ['email'], { unique: true })
@Index('idx_plex_user_id', ['plexUserId'])
export class AdminUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  username: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatarUrl: string;

  // Plex account linking
  @Column({ type: 'varchar', length: 255, nullable: true })
  plexUserId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  plexUsername: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  plexEmail: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  plexThumb: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
