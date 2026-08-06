import {
  Body,
  Controller,
  Get,
  Param,
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

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiErrorResponses(401, 403)
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly admin: AdminService) {}

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
}
