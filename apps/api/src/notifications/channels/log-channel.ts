import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel } from '../notification-channel.interface';
import { Notification } from '../../entities/notification.entity';

// Default transport for Fase 1: proves the queue/template/preference plumbing end
// to end without requiring a real provider yet. Swapping to SES/FCM/Twilio later
// is a one-file change (implement NotificationChannel, register it in the
// CHANNEL_MAP in notifications.module.ts) — the rest of the pipeline is untouched.
@Injectable()
export class LogChannel implements NotificationChannel {
  private readonly logger = new Logger('NotificationChannel:log');

  send(notification: Notification): Promise<void> {
    this.logger.log(
      `[${notification.channel}] to user ${notification.userId} — template=${notification.templateKey} payload=${JSON.stringify(notification.payload)}`,
    );
    return Promise.resolve();
  }
}
