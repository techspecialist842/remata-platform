import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Passport rechaza en inglés —«Unauthorized»— cuando no hay token o no vale,
   * y ese texto llegaba tal cual a la pantalla de una app en español.
   *
   * Se dice lo mismo y nada más: no distinguir entre «no mandaste token» y
   * «tu token no sirve» no es descuido, es que la diferencia solo le interesa
   * a quien esté probando.
   *
   * Las razones concretas que sí importan —cuenta desactivada, por ejemplo—
   * las lanza la estrategia con su propio mensaje, y se respetan.
   */
  handleRequest<TUser>(err: Error | null, user: TUser | false): TUser {
    if (err) throw err;
    if (!user) {
      throw new UnauthorizedException('Tienes que iniciar sesión');
    }
    return user;
  }
}
