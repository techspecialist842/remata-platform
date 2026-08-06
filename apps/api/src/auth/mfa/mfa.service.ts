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

  verify(token: string, secret: string): boolean {
    try {
      return verifySync({ secret, token }).valid;
    } catch {
      return false;
    }
  }
}
