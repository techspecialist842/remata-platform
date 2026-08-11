import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { NotificationChannelType } from './notification.entity';

@Entity('notification_preferences')
@Index(['userId', 'channel'], { unique: true })
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: NotificationChannelType })
  channel: NotificationChannelType;

  @Column({ default: true })
  enabled: boolean;
}
