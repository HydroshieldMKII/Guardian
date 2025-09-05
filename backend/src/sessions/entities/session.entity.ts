import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'session_key', unique: true })
  sessionKey: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'username', nullable: true })
  username: string;

  @Column({ name: 'device_identifier' })
  deviceIdentifier: string;

  @Column({ name: 'device_name', nullable: true })
  deviceName: string;

  @Column({ name: 'player_machine_identifier', nullable: true })
  playerMachineIdentifier: string;

  @Column({ name: 'media_title', nullable: true })
  mediaTitle: string;

  @Column({ name: 'media_type', nullable: true })
  mediaType: string;

  @Column({ name: 'state', default: 'playing' })
  state: string;

  @Column({ name: 'view_offset', nullable: true })
  viewOffset: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
