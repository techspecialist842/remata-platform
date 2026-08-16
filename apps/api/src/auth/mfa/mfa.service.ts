import { Injectable } from '@nestjs/common';
import { generateSecret, generateURI, verifySync } from 'otplib';

@Injectable()
export class MfaService {
  generateSecret(): string {
    return generateSecret();
  }

  buildOtpAuthUrl(email: string, secret: string): string {
    return generateURI({ issuer: 'REMATA', label: email, secret });
  }

  /**
   * Verifica un código y devuelve el paso temporal que consumió, o null si no
   * es válido.
   *
   * Devolver el paso —y no solo un booleano— es lo que permite impedir que el
   * mismo código se use dos veces: quien lo guarde puede rechazar cualquier
   * código de un paso ya consumido. Sin eso, un código observado por encima
   * del hombro sigue sirviendo el resto de su ventana, y el segundo factor
   * deja de ser de un solo uso.
   */
  verificar(token: string, secret: string): number | null {
    try {
      // El tipo de retorno de la librería es una unión y `timeStep` solo
      // existe en la rama válida; se estrecha aquí en vez de confiar en la
      // inferencia, que degrada a `any`.
      const r = verifySync({ secret, token }) as {
        valid: boolean;
        timeStep?: number;
      };
      return r.valid && typeof r.timeStep === 'number' ? r.timeStep : null;
    } catch {
      return null;
    }
  }

  /** Compatibilidad: hay llamadas que solo necesitan saber si vale. */
  verify(token: string, secret: string): boolean {
    return this.verificar(token, secret) !== null;
  }
}
