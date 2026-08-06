import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';

export const IDEMPOTENT_KEY = 'idempotent';

// Marks a route as requiring an Idempotency-Key header (enforced by
// IdempotencyInterceptor) AND documents that header in the OpenAPI spec, so
// Swagger UI renders an input for it. Keeping both in one decorator means the
// docs can't drift out of sync with the actual requirement.
export const Idempotent = () =>
  applyDecorators(
    SetMetadata(IDEMPOTENT_KEY, true),
    ApiHeader({
      name: 'Idempotency-Key',
      description:
        'Unique client-generated value. Replaying the same key with the same body returns the original response instead of repeating the operation.',
      required: true,
      schema: { type: 'string', example: 'a1b2c3d4-0001' },
    }),
  );
