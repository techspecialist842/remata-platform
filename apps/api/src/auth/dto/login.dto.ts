import { IsEmail, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  // Required on the second call when the first response is `mfaRequired: true`.
  @IsOptional()
  @IsString()
  mfaToken?: string;
}
