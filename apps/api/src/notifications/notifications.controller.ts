import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import { ApiErrorResponses } from '../common/decorators/api-error-responses.decorator';
import { NotificationsService } from './notifications.service';
import { UpdatePreferenceDto } from './dto/update-preference.dto';
import {
  NotificationChannelType,
  NotificationPriority,
} from '../entities/notification.entity';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiErrorResponses(401, 403)
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // Fase 1 acceptance criterion: "Infraestructura base de notificaciones envía
  // alertas de prueba correctamente" — admin-only, enqueues then immediately
  // drains one batch so the caller gets a definitive sent/failed result.
  @Post('test-alert')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Enviar una notificación de prueba al administrador autenticado',
    description:
      'Encola la alerta y procesa el lote de inmediato, de modo que la respuesta refleje el resultado real del envío.',
  })
  async sendTestAlert(@CurrentUser() user: AuthenticatedUser) {
    const notification = await this.notifications.enqueue({
      userId: user.userId,
      channel: NotificationChannelType.EMAIL,
      templateKey: 'test.alert',
      priority: NotificationPriority.HIGH,
      payload: { triggeredBy: user.email },
    });
    if (!notification) {
      return { queued: false, reason: 'disabled_by_preference' };
    }
    await this.notifications.processPendingBatch(1);
    return { queued: true, notificationId: notification.id };
  }

  @Post('preferences')
  @ApiOperation({
    summary: 'Activar o silenciar un canal de notificaciones',
    description: 'Aplica al usuario autenticado.',
  })
  @ApiErrorResponses(400)
  async updatePreference(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferenceDto,
  ) {
    await this.notifications.setPreference(
      user.userId,
      dto.channel,
      dto.enabled,
    );
    return { updated: true };
  }
}
