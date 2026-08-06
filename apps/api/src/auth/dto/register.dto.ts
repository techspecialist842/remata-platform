import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(10)
  password: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  // Admin accounts are never created through self-service registration —
  // enforced in AuthService regardless of what a caller sends here.
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
