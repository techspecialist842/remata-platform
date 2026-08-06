import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { generateSecret, generateURI } from 'otplib';
import { AppDataSource } from '../data-source';
import { User } from '../../entities/user.entity';
import { Role } from '../../common/enums/role.enum';

loadEnv();

// One-time bootstrap for the very first admin account, run manually
// (`npm run seed:admin`) since no admin exists yet to call
// POST /api/v1/admin/admins. Every admin created after this one goes through
// that endpoint instead. Reads INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD —
// never hardcode credentials here.
async function main() {
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD before running this seed',
    );
  }

  const dataSource = await AppDataSource.initialize();
  const users = dataSource.getRepository(User);

  const existing = await users.findOne({ where: { email } });
  if (existing) {
    console.log(
      `Admin ${email} already exists (id=${existing.id}); nothing to do.`,
    );
    await dataSource.destroy();
    return;
  }

  const mfaSecret = generateSecret();
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await users.save(
    users.create({
      email,
      passwordHash,
      role: Role.ADMIN,
      isActive: false,
      mfaEnabled: false,
      mfaSecret,
    }),
  );

  const enrollmentSecret = process.env.JWT_ENROLLMENT_SECRET;
  if (!enrollmentSecret) {
    throw new Error(
      'JWT_ENROLLMENT_SECRET must be set to mint an enrollment token',
    );
  }
  const enrollmentToken = jwt.sign(
    { sub: user.id, purpose: 'mfa-enrollment' },
    enrollmentSecret,
    { expiresIn: '1h' },
  );

  const otpauthUrl = generateURI({
    issuer: 'REMATA',
    label: email,
    secret: mfaSecret,
  });
  console.log(`Created pending admin ${user.id} (${email}).`);
  console.log(
    '1. Scan this URL in an authenticator app (Google Authenticator, 1Password, etc.):',
  );
  console.log(otpauthUrl);
  console.log(
    '2. Within 1 hour, call POST /api/v1/auth/mfa/confirm-enrollment with:',
  );
  console.log(
    JSON.stringify(
      { enrollmentToken, token: '<6-digit code from the app>' },
      null,
      2,
    ),
  );

  await dataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
