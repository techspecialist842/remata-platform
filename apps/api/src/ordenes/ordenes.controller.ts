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
import { ApiErrorResponses } from '../common/decorators/api-error-responses.decorator';
import { Idempotent } from '../common/decorators/idempotent.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { OrdenesService } from './ordenes.service';
import { ResenasService } from './resenas.service';
import { ReputacionService } from './reputacion.service';
import { CrearOrdenDto } from './dto/crear-orden.dto';
import { CancelarOrdenDto, CrearResenaDto } from './dto/acciones-orden.dto';

@ApiTags('ordenes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiErrorResponses(401, 403)
@Controller({ path: 'ordenes', version: '1' })
export class OrdenesController {
  constructor(
    private readonly ordenes: OrdenesService,
    private readonly resenas: ResenasService,
    private readonly reputacion: ReputacionService,
  ) {}

  // --- Comprador ---

  @Post()
  @Idempotent()
  @ApiOperation({
    summary: 'Crear una orden',
    description:
      'Reserva las unidades de forma atómica. Si otro comprador se lleva las últimas, devuelve 409. La orden expira si el comercio no la confirma dentro de la ventana.',
  })
  @ApiErrorResponses(400, 404, 409)
  crear(@CurrentUser() user: AuthenticatedUser, @Body() dto: CrearOrdenDto) {
    return this.ordenes.crear(user.userId, dto);
  }

  @Get('mias')
  @ApiOperation({ summary: 'Mis órdenes como comprador' })
  @ApiErrorResponses(400)
  mias(@CurrentUser() user: AuthenticatedUser, @Query() q: PaginationQueryDto) {
    return this.ordenes.misOrdenes(user.userId, q.page, q.pageSize);
  }

  @Post(':id/resena')
  @ApiOperation({
    summary: 'Reseñar una orden cumplida',
    description:
      'Verificada por compra: solo el comprador de una orden cumplida puede reseñarla, y una sola vez.',
  })
  @ApiErrorResponses(400, 404, 409)
  resenar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CrearResenaDto,
  ) {
    return this.resenas.crear(
      user.userId,
      id,
      dto.calificacion,
      dto.comentario,
    );
  }

  // --- Comercio ---

  @Get('recibidas')
  @Roles(Role.COMERCIO)
  @ApiOperation({ summary: 'Órdenes recibidas por mi comercio' })
  @ApiErrorResponses(400)
  recibidas(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: PaginationQueryDto,
  ) {
    return this.ordenes.ordenesDelComercio(user.userId, q.page, q.pageSize);
  }

  @Patch(':id/confirmar')
  @Roles(Role.COMERCIO)
  @ApiOperation({ summary: 'Confirmar una orden' })
  @ApiErrorResponses(400, 404)
  confirmar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordenes.confirmar(user.userId, id);
  }

  @Patch(':id/cumplir')
  @Roles(Role.COMERCIO)
  @ApiOperation({
    summary: 'Marcar una orden como cumplida',
    description: 'El inventario no se devuelve: la mercadería fue entregada.',
  })
  @ApiErrorResponses(400, 404)
  cumplir(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordenes.cumplir(user.userId, id);
  }

  // --- Ambos ---

  @Patch(':id/cancelar')
  @ApiOperation({
    summary: 'Cancelar una orden',
    description:
      'Devuelve las unidades al catálogo y libera el cupón. Solo el comercio puede indicar no-show.',
  })
  @ApiErrorResponses(400, 404)
  cancelar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelarOrdenDto,
  ) {
    return this.ordenes.cancelar(user.userId, id, dto.motivo, dto.nota);
  }

  @Get('reputacion/:sujetoId')
  @ApiOperation({
    summary: 'Reputación de un comercio o comprador',
    description: 'Promedio de calificaciones, órdenes cumplidas y no-shows.',
  })
  @ApiErrorResponses(400)
  reputacionDe(@Param('sujetoId', ParseUUIDPipe) sujetoId: string) {
    return this.reputacion.resumen(sujetoId);
  }
}
