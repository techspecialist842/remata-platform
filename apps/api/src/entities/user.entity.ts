import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../common/enums/role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'enum', enum: Role, default: Role.USUARIO })
  role: Role;

  @Column({ name: 'display_name', type: 'varchar', nullable: true })
  displayName: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // TOTP secret, only ever set for admin accounts (MFA is mandatory for admin, see DEC below).
  @Column({
    name: 'mfa_secret',
    type: 'varchar',
    nullable: true,
    select: false,
  })
  mfaSecret: string | null;

  @Column({ name: 'mfa_enabled', default: false })
  mfaEnabled: boolean;

  /**
   * Último paso temporal TOTP consumido (hallazgo 3 de la revisión).
   *
   * Un código vale ~30 segundos, y hasta ~90 si la librería tolera pasos
   * adyacentes. Sin esto, quien vea el código por encima del hombro puede
   * reutilizarlo dentro de esa ventana y el segundo factor deja de ser de un
   * solo uso. Guardar el último paso y rechazar los menores o iguales lo
   * convierte en estrictamente irrepetible.
   *
   * Nulo hasta el primer uso. `select: false` como el propio secreto: no tiene
   * por qué salir en ninguna respuesta.
   */
  @Column({
    name: 'mfa_last_step',
    type: 'integer',
    nullable: true,
    select: false,
  })
  mfaLastStep: number | null;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
