import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService, RequestContext } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ConfirmEnrollmentDto } from './dto/confirm-enrollment.dto';
import { Idempotent } from '../common/decorators/idempotent.decorator';
import { ApiErrorResponses } from '../common/decorators/api-error-responses.decorator';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Idempotent()
  @ApiOperation({
    summary: 'Registrar un usuario o comercio',
    description:
      'Las cuentas de administrador NO pueden crearse por esta vía: enviar role=admin devuelve 403.',
  })
  @ApiErrorResponses(400, 403, 409)
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, this.buildContext(req));
  }

  @Post('login')
  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'Para administradores la respuesta es {"mfaRequired": true} hasta que se envíe un mfaToken válido.',
  })
  @ApiErrorResponses(400, 401, 403)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, this.buildContext(req));
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Renovar tokens',
    description:
      'El refresh token es de un solo uso: reutilizarlo devuelve 401.',
  })
  @ApiErrorResponses(400, 401)
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, this.buildContext(req));
  }

  @Post('logout')
  @ApiOperation({ summary: 'Revocar un refresh token' })
  @ApiErrorResponses(400)
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  // Public by design: authorization comes from the short-lived enrollmentToken
  // itself (see AuthService.resolveEnrollmentToken), not a session — the account
  // is not yet active at this point, so it could never hold a normal JWT anyway.
  @Post('mfa/confirm-enrollment')
  @ApiOperation({
    summary: 'Confirmar el alta de MFA de un administrador',
    description:
      'Activa la cuenta. Requiere el enrollmentToken entregado al crear el admin y un código TOTP válido.',
  })
  @ApiErrorResponses(400, 401)
  async confirmMfaEnrollment(@Body() dto: ConfirmEnrollmentDto) {
    const userId = await this.auth.resolveEnrollmentToken(dto.enrollmentToken);
    await this.auth.confirmMfaEnrollment(userId, dto.token);
    return { activated: true };
  }

  private buildContext(req: Request): RequestContext {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      correlationId: (req.headers['x-correlation-id'] as string) ?? undefined,
    };
  }
}
