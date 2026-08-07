import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type FraudEventType = 'register' | 'login';
export type FraudDecision = 'allow' | 'challenge' | 'deny';

export interface FraudEventInput {
  type: FraudEventType;
  email: string;
  ip?: string;
  userAgent?: string;
}

export interface FraudScoreResult {
  score: number; // 0-100, higher = riskier
  decision: FraudDecision;
  reasons: string[];
}

const CHALLENGE_THRESHOLD = 40;
const DENY_THRESHOLD = 75;
const VELOCITY_WINDOW_MS = 60_000;
const VELOCITY_MAX_ATTEMPTS = 5;

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  // Base/initial engine for Fase 1 (see plan revisado): velocity + known-device
  // heuristics only. Per-process in-memory state — correct for a single task,
  // and acceptable for this phase; once ECS runs >1 task this should move to a
  // shared store (Redis/Postgres) so counters are consistent across replicas.
  private readonly attemptsByKey = new Map<string, number[]>();

  constructor(private readonly config: ConfigService) {}

  // Not `async` on purpose: scoring is currently pure/synchronous, but the
  // public contract stays a Promise so a real risk-data lookup (device
  // reputation service, geoip) can be added later without a signature change.
  scoreEvent(input: FraudEventInput): Promise<FraudScoreResult> {
    try {
      return Promise.resolve(this.scoreSync(input));
    } catch (err) {
      const policy = this.config.get<string>('FRAUD_POLICY') ?? 'fail-open';
      this.logger.error(
        `Fraud scoring failed for ${input.type}/${input.email}: ${(err as Error).message}. Applying policy=${policy}.`,
      );
      return Promise.resolve(
        policy === 'fail-closed'
          ? {
              score: 100,
              decision: 'deny' as const,
              reasons: ['fraud_engine_unavailable_fail_closed'],
            }
          : {
              score: 0,
              decision: 'allow' as const,
              reasons: ['fraud_engine_unavailable_fail_open'],
            },
      );
    }
  }

  private scoreSync(input: FraudEventInput): FraudScoreResult {
    const reasons: string[] = [];
    let score = 0;

    const key = `${input.type}:${input.email}:${input.ip ?? 'unknown'}`;
    const now = Date.now();
    const attempts = (this.attemptsByKey.get(key) ?? []).filter(
      (t) => now - t < VELOCITY_WINDOW_MS,
    );
    attempts.push(now);
    this.attemptsByKey.set(key, attempts);

    if (attempts.length > VELOCITY_MAX_ATTEMPTS) {
      score += 60;
      reasons.push('velocity_threshold_exceeded');
    }

    if (!input.userAgent) {
      score += 15;
      reasons.push('missing_user_agent');
    }

    if (!input.ip) {
      score += 10;
      reasons.push('missing_ip_address');
    }

    score = Math.min(score, 100);
    const decision: FraudDecision =
      score >= DENY_THRESHOLD
        ? 'deny'
        : score >= CHALLENGE_THRESHOLD
          ? 'challenge'
          : 'allow';

    return { score, decision, reasons };
  }
}
