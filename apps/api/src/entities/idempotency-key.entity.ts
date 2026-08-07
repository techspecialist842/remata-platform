import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('idempotency_keys')
export class IdempotencyKey {
  // "<method>:<path>:<Idempotency-Key header>" — composed by the middleware so the
  // same header value can't collide across unrelated routes.
  @PrimaryColumn()
  key: string;

  @Column({ name: 'request_hash' })
  requestHash: string;

  @Column({ name: 'response_status' })
  responseStatus: number;

  @Column({ name: 'response_body', type: 'jsonb' })
  responseBody: unknown;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
