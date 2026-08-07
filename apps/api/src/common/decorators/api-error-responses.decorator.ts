import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

// Every error in this API comes back in the same envelope, produced by
// HttpExceptionFilter. Declaring it once here keeps the OpenAPI spec honest
// without repeating the same schema on every route.
const ERROR_SCHEMA = {
  type: 'object',
  properties: {
    statusCode: { type: 'number', example: 400 },
    error: { type: 'string', example: 'BAD_REQUEST' },
    message: { type: 'string', example: 'Descripción del error' },
    correlationId: {
      type: 'string',
      nullable: true,
      description:
        'Identificador para rastrear esta petición en los logs y en la auditoría.',
      example: '8f8c1839-7eba-4e6c-91e6-8c52b7e14db8',
    },
    path: { type: 'string', example: '/api/v1/auth/login' },
    timestamp: { type: 'string', format: 'date-time' },
  },
} as const;

type ErrorCode = 400 | 401 | 403 | 404 | 409;

const DESCRIPTIONS: Record<ErrorCode, string> = {
  400: 'Petición inválida: cuerpo malformado o falla de validación.',
  401: 'No autenticado, o credenciales/código MFA inválidos.',
  403: 'Autenticado, pero sin permisos para esta operación.',
  404: 'El recurso solicitado no existe.',
  409: 'Conflicto con el estado actual (por ejemplo, email ya registrado o Idempotency-Key reutilizada con otro cuerpo).',
};

export const ApiErrorResponses = (...codes: ErrorCode[]) =>
  applyDecorators(
    ...codes.map((status) =>
      ApiResponse({
        status,
        description: DESCRIPTIONS[status],
        schema: ERROR_SCHEMA,
      }),
    ),
  );
