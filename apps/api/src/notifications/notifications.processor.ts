import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';

const POLL_INTERVAL_MS = 5_000;

@Injectable()
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);
  private running = false;

  constructor(private readonly notifications: NotificationsService) {}

  @Interval(POLL_INTERVAL_MS)
  async tick(): Promise<void> {
    if (this.running) return; // don't overlap runs if a batch takes longer than the interval
    this.running = true;
    try {
      const processed = await this.notifications.processPendingBatch();
      if (processed > 0) {
        this.logger.debug(`Processed ${processed} pending notification(s)`);
      }
    } catch (err) {
      this.logger.error(
        `Notification batch processing failed: ${(err as Error).message}`,
      );
    } finally {
      this.running = false;
    }
  }
}
