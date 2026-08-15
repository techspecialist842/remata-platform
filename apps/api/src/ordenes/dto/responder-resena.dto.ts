import { IsString, Length } from 'class-validator';

export class ResponderResenaDto {
  /**
   * Mínimo 3 caracteres: una respuesta vacía o de un signo no aporta y ocupa
   * el único turno que tiene el comercio.
   */
  @IsString()
  @Length(3, 1000)
  texto: string;
}
