import { IsBoolean, IsEnum } from 'class-validator';
import { NotificationChannelType } from '../../entities/notification.entity';

export class UpdatePreferenceDto {
  /** Canal cuya preferencia se quiere cambiar. */
  @IsEnum(NotificationChannelType)
  channel: NotificationChannelType;

  /** false silencia este canal para el usuario autenticado. */
  @IsBoolean()
  enabled: boolean;
}
