import { IsBoolean } from 'class-validator';

export class SetUserActiveDto {
  /** true para reactivar la cuenta, false para desactivarla. */
  @IsBoolean()
  isActive: boolean;
}
