import { Notification } from '../entities/notification.entity';

export interface NotificationChannel {
  send(notification: Notification): Promise<void>;
}
