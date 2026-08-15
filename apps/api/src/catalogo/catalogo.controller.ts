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
import { CatalogoService } from './catalogo.service';
import { CrearRescateDto } from './dto/crear-rescate.dto';
import { BuscarRescatesDto } from './dto/buscar-rescates.dto';
import { UbicacionComercioDto } from './dto/ubicacion-comercio.dto';
import { ReportarRescateDto } from './dto/reportar-rescate.dto';
import { ReportesService } from './reportes.service';

@ApiTags('catalogo')
@Controller({ path: 'catalogo', version: '1' })
export class CatalogoController {
  constructor(
    private readonly catalogo: CatalogoService,
    private readonly reportes: ReportesService,
  ) {}

  // --- Público: sin autenticación. Es la vitrina del marketplace.
  @Get('rescates')
  @ApiOperation({
    summary: 'Buscar rescates publicados',
    description:
      'Solo devuelve rescates comprables ahora: publicados, dentro de su vigencia y con unidades disponibles. Ordenados por vencimiento más próximo.',
  })
  @ApiErrorResponses(400)
  buscar(@Query() dto: BuscarRescatesDto) {
    return this.catalogo.buscar(dto);
  }

  @Get('rescates/:id')
  @ApiOperation({ summary: 'Ver un rescate publicado' })
  @ApiErrorResponses(404)
  ver(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogo.verPublicado(id);
  }

  @Post('rescates/:id/reportar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reportar una publicación',
    description:
      'No la oculta: la pone en la cola de moderación. Solo un administrador retira, y un reporte por persona y publicación.',
  })
  @ApiErrorResponses(400, 401, 404, 409)
  reportar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportarRescateDto,
  ) {
    return this.reportes.reportar(user.userId, id, dto.motivo, dto.nota);
  }

  // --- Comercio: su perfil y sus propias publicaciones.
  @Get('mi-comercio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.COMERCIO)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Ver mi perfil de comercio',
    description:
      'Devuelve el merchantId, que es la clave con la que se consulta la reputación propia: la sesión solo lleva el userId.',
  })
  @ApiErrorResponses(401, 403)
  miComercio(@CurrentUser() user: AuthenticatedUser) {
    return this.catalogo.miComercio(user.userId);
  }

  @Patch('mi-comercio/ubicacion')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.COMERCIO)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Fijar la dirección y el punto de retiro',
    description:
      'Sin coordenadas el comercio sigue vendiendo, pero no aparece en las búsquedas por cercanía.',
  })
  @ApiErrorResponses(400, 401, 403)
  fijarUbicacion(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UbicacionComercioDto,
  ) {
    return this.catalogo.fijarUbicacion(user.userId, dto);
  }

  @Post('rescates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.COMERCIO)
  @ApiBearerAuth()
  @Idempotent()
  @ApiOperation({
    summary: 'Crear un rescate',
    description:
      'Nace en borrador; publicarlo es una acción aparte y deliberada.',
  })
  @ApiErrorResponses(400, 401, 403)
  crear(@CurrentUser() user: AuthenticatedUser, @Body() dto: CrearRescateDto) {
    return this.catalogo.crear(user.userId, dto);
  }

  @Get('mis-rescates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.COMERCIO)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar mis rescates, en cualquier estado' })
  @ApiErrorResponses(400, 401, 403)
  mios(@CurrentUser() user: AuthenticatedUser, @Query() q: PaginationQueryDto) {
    return this.catalogo.misRescates(user.userId, q.page, q.pageSize);
  }

  @Patch('rescates/:id/publicar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.COMERCIO)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publicar un rescate' })
  @ApiErrorResponses(400, 401, 403, 404)
  publicar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.catalogo.publicar(user.userId, id);
  }

  @Patch('rescates/:id/pausar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.COMERCIO)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pausar un rescate publicado' })
  @ApiErrorResponses(400, 401, 403, 404)
  pausar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.catalogo.pausar(user.userId, id);
  }
}
