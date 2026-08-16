import { SkipThrottle } from '@nestjs/throttler';
import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';

// Version-neutral: infrastructure health checks (ALB target group, ECS
// container health check) must hit a stable path regardless of API version.
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  // Sin límite: lo consulta el balanceador cada pocos segundos y limitarlo
  // haría que ECS diera por muerta una instancia sana justo cuando hay tráfico.
  //
  // Hay que nombrar los limitadores. `@SkipThrottle()` sin argumentos apunta al
  // nombre «default», que aquí no existe porque los nuestros se llaman «corta»
  // y «larga»: sin esto el decorador parece puesto y no exime de nada.
  @SkipThrottle({ corta: true, larga: true })
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
    ]);
  }
}
