import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { Idempotent } from '../common/decorators/idempotent.decorator';
import { ApiErrorResponses } from '../common/decorators/api-error-responses.decorator';
import { SetUserActiveDto } from './dto/set-user-active.dto';
import { RetirarRescateDto } from './dto/moderar-rescate.dto';
import { ModeracionService } from './moderacion.service';
import { ReportesService } from '../catalogo/reportes.service';
import { OrdenStatus, RescateStatus } from '../common/enums/marketplace.enum';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiErrorResponses(401, 403)
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly moderacion: ModeracionService,
    private readonly reportes: ReportesService,
  ) {}

  @Post('admins')
  @Idempotent()
  @ApiOperation({
    summary: 'Crear una cuenta de administrador',
    description:
      'La cuenta nace inactiva: devuelve otpauthUrl y enrollmentToken, y solo se activa al confirmar el alta de MFA.',
  })
  @ApiErrorResponses(400, 409)
  createAdmin(
    @Body() dto: CreateAdminDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.createAdmin(dto, user.userId);
  }

  @Get('users')
  @ApiOperation({ summary: 'Listar usuarios (paginado)' })
  @ApiErrorResponses(400)
  listUsers(@Query() query: PaginationQueryDto) {
    return this.admin.listUsers(query.page, query.pageSize);
  }

  @Patch('users/:id/active')
  @ApiOperation({ summary: 'Activar o desactivar una cuenta' })
  @ApiErrorResponses(400, 404)
  setUserActive(
    @Param('id') id: string,
    @Body() dto: SetUserActiveDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.setUserActive(id, dto.isActive, user.userId);
  }

  // --- Moderación del marketplace (Fase 2) ---

  @Get('rescates')
  @ApiOperation({
    summary: 'Listar rescates de toda la plataforma',
    description: 'Cualquier estado y cualquier comercio. Filtrable por estado.',
  })
  @ApiErrorResponses(400)
  listarRescates(
    @Query() query: PaginationQueryDto,
    @Query('status') status?: RescateStatus,
  ) {
    return this.moderacion.listarRescates(status, query.page, query.pageSize);
  }

  @Get('reportes')
  @ApiOperation({
    summary: 'Cola de moderación',
    description:
      'Publicaciones con reportes sin revisar, la más denunciada primero. Se agrupa por publicación: diez reportes sobre lo mismo son una decisión, no diez.',
  })
  @ApiErrorResponses(400)
  colaModeracion(@Query() query: PaginationQueryDto) {
    return this.reportes.cola(query.page, query.pageSize);
  }

  @Patch('reportes/:rescateId/descartar')
  @ApiOperation({
    summary: 'Descartar los reportes de una publicación',
    description:
      'La saca de la cola sin retirarla: se revisó y no había motivo.',
  })
  @ApiErrorResponses(404)
  descartarReportes(
    @Param('rescateId', ParseUUIDPipe) rescateId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportes.descartar(user.userId, rescateId);
  }

  @Patch('rescates/:id/retirar')
  @ApiOperation({
    summary: 'Retirar un rescate del marketplace',
    description:
      'Estado terminal: el comercio no puede republicarlo, debe crear uno nuevo. El motivo queda registrado y se le muestra.',
  })
  @ApiErrorResponses(400, 404)
  retirarRescate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RetirarRescateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.moderacion.retirar(user.userId, id, dto.motivo);
  }

  @Get('ordenes')
  @ApiOperation({
    summary: 'Listar órdenes de toda la plataforma',
    description: 'Para soporte y resolución de incidencias.',
  })
  @ApiErrorResponses(400)
  listarOrdenes(
    @Query() query: PaginationQueryDto,
    @Query('status') status?: OrdenStatus,
  ) {
    return this.moderacion.listarOrdenes(status, query.page, query.pageSize);
  }

  @Get('ordenes/:id')
  @ApiOperation({ summary: 'Ver una orden' })
  @ApiErrorResponses(400, 404)
  verOrden(@Param('id', ParseUUIDPipe) id: string) {
    return this.moderacion.verOrden(id);
  }
}
