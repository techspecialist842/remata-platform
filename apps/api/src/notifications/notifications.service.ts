import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Notification,
  NotificationChannelType,
  NotificationPriority,
  NotificationStatus,
} from '../entities/notification.entity';
import { NotificationPreference } from '../entities/notification-preference.entity';
import { LogChannel } from './channels/log-channel';

export interface EnqueueNotificationInput {
  userId: string;
  channel: NotificationChannelType;
  templateKey: string;
  payload?: Record<string, unknown>;
  priority?: NotificationPriority;
}

const MAX_ATTEMPTS = 3;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  // Channel registry — the only place that needs to change to add a real
  // provider (SES/FCM/Twilio) instead of the LogChannel stub used in Fase 1.
  private readonly channels: Record<NotificationChannelType, LogChannel>;

  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private readonly preferences: Repository<NotificationPreference>,
    logChannel: LogChannel,
  ) {
    this.channels = {
      [NotificationChannelType.EMAIL]: logChannel,
      [NotificationChannelType.PUSH]: logChannel,
      [NotificationChannelType.SMS]: logChannel,
    };
  }

  async enqueue(input: EnqueueNotificationInput): Promise<Notification | null> {
    const pref = await this.preferences.findOne({
      where: { userId: input.userId, channel: input.channel },
    });
    if (pref && !pref.enabled) {
      this.logger.log(
        `Skipping ${input.channel} notification for user ${input.userId}: disabled by preference`,
      );
      return null;
    }

    const notification = this.notifications.create({
      userId: input.userId,
      channel: input.channel,
      templateKey: input.templateKey,
      payload: input.payload ?? {},
      priority: input.priority ?? NotificationPriority.NORMAL,
      status: NotificationStatus.PENDING,
    });
    return this.notifications.save(notification);
  }

  async setPreference(
    userId: string,
    channel: NotificationChannelType,
    enabled: boolean,
  ): Promise<void> {
    const existing = await this.preferences.findOne({
      where: { userId, channel },
    });
    if (existing) {
      existing.enabled = enabled;
      await this.preferences.save(existing);
      return;
    }
    await this.preferences.save(
      this.preferences.create({ userId, channel, enabled }),
    );
  }

  async processPendingBatch(batchSize = 20): Promise<number> {
    const pending = await this.notifications.find({
      where: { status: NotificationStatus.PENDING },
      order: { priority: 'DESC', createdAt: 'ASC' },
      take: batchSize,
    });

    for (const notification of pending) {
      await this.deliver(notification);
    }
    return pending.length;
  }

  private async deliver(notification: Notification): Promise<void> {
    const channel = this.channels[notification.channel];
    try {
      await channel.send(notification);
      notification.status = NotificationStatus.SENT;
      notification.sentAt = new Date();
    } catch (err) {
      notification.attempts += 1;
      notification.lastError = (err as Error).message;
      if (notification.attempts >= MAX_ATTEMPTS) {
        notification.status = NotificationStatus.FAILED;
      }
    }
    await this.notifications.save(notification);
  }
}
