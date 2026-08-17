import { Repository } from 'typeorm';
import { SenalesResenaService } from './senales-resena.service';
import { Orden } from '../entities/orden.entity';
import { Resena } from '../entities/resena.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { Merchant } from '../entities/merchant.entity';
import { User } from '../entities/user.entity';

/**
 * Lo que importa de estas señales no es que detecten: es que no se disparen con
 * clientes normales.
 *
 * Un falso positivo aquí manda a un administrador a revisar la reseña de alguien
 * que solo compró y quedó contento. Diez falsos positivos y nadie vuelve a mirar
 * la cola. Por eso la mayoría de las pruebas de abajo comprueban que NO se marca.
 *
 * Las dependencias son repositorios, y el escenario se describe con números —
 * cuántas compras, hace cuánto se creó la cuenta— así que se sustituyen por
 * dobles en vez de levantar la base: aquí se prueba la regla, no el SQL.
 */

const HORA = 3_600_000;
const AHORA = new Date('2026-08-16T12:00:00.000Z');

interface Escenario {
  /** Horas entre el alta de la cuenta y su primera compra a este comercio. */
  horasHastaLaCompra: number;
  /** Órdenes cumplidas del comprador, en total. */
  cumplidas: number;
  /** De ellas, cuántas fueron a otros comercios. */
  cumplidasEnOtros: number;
  /** Reseñas al comercio en la última hora, sin contar esta. */
  resenasRecientes: number;
  /** Comprador y comercio dados de alta desde la misma dirección. */
  mismaIp: boolean;
}

const corriente: Escenario = {
  horasHastaLaCompra: 30 * 24,
  cumplidas: 6,
  cumplidasEnOtros: 4,
  resenasRecientes: 0,
  mismaIp: false,
};

const AUTOR = 'autor-1';
const COMERCIO = 'comercio-1';
const DUENO = 'dueno-1';

/** Monta el servicio con repositorios falsos que responden al escenario dado. */
const servicio = (
  parcial: Partial<Escenario> = {},
  merchantsFalso?: { findOne: () => Promise<Merchant | null> },
) => {
  const e = { ...corriente, ...parcial };
  const alta = new Date(AHORA.getTime() - 90 * 24 * HORA);

  const users = {
    findOne: () => Promise.resolve({ id: AUTOR, createdAt: alta } as User),
  };

  const ordenes = {
    findOne: () =>
      Promise.resolve({
        createdAt: new Date(alta.getTime() + e.horasHastaLaCompra * HORA),
      } as Orden),
    // La segunda consulta es la que excluye a este comercio: se distingue por
    // llevar merchantId en el filtro.
    count: (opciones: { where: Record<string, unknown> }) =>
      Promise.resolve(
        'merchantId' in opciones.where ? e.cumplidasEnOtros : e.cumplidas,
      ),
  };

  const resenas = { count: () => Promise.resolve(e.resenasRecientes) };

  const merchants = merchantsFalso ?? {
    findOne: () => Promise.resolve({ id: COMERCIO, userId: DUENO } as Merchant),
  };

  const auditoria = {
    findOne: (opciones: { where: { actorUserId: string } }) =>
      Promise.resolve({
        ipAddress:
          e.mismaIp || opciones.where.actorUserId === AUTOR
            ? '200.0.0.1'
            : '200.0.0.2',
      } as AuditLog),
  };

  return new SenalesResenaService(
    ordenes as unknown as Repository<Orden>,
    resenas as unknown as Repository<Resena>,
    auditoria as unknown as Repository<AuditLog>,
    merchants as unknown as Repository<Merchant>,
    users as unknown as Repository<User>,
  );
};

const evaluar = (parcial: Partial<Escenario> = {}) =>
  servicio(parcial).evaluar(AUTOR, COMERCIO, AHORA);

describe('señales de reseña amañada', () => {
  it('un cliente corriente no dispara ninguna señal', async () => {
    const r = await evaluar();
    expect(r.senales).toEqual([]);
    expect(r.sospechosa).toBe(false);
  });

  describe('una sola señal nunca marca', () => {
    // Es el caso más común de un marketplace que crece: alguien se registra
    // porque vio una oferta, la compra y queda contento. Marcarlo sería marcar
    // a media plataforma.
    it('cuenta nueva que compra una vez y ya', async () => {
      const r = await evaluar({ horasHastaLaCompra: 1, cumplidas: 6 });
      expect(r.senales).toEqual(['cuenta_nueva']);
      expect(r.sospechosa).toBe(false);
    });

    it('primera compra de alguien que se registró hace meses', async () => {
      const r = await evaluar({ cumplidas: 1 });
      expect(r.senales).toEqual(['unica_compra']);
      expect(r.sospechosa).toBe(false);
    });

    // Un cliente fiel se ve exactamente igual que una cuenta dedicada a inflar
    // a un comercio. Sola, esta señal no dice nada.
    it('cliente que solo compra en un sitio', async () => {
      const r = await evaluar({ cumplidasEnOtros: 0 });
      expect(r.senales).toEqual(['solo_este_comercio']);
      expect(r.sospechosa).toBe(false);
    });

    // Una oficina, un café, una red móvil compartida.
    it('misma dirección de alta', async () => {
      const r = await evaluar({ mismaIp: true });
      expect(r.senales).toEqual(['misma_ip']);
      expect(r.sospechosa).toBe(false);
    });

    // Un comercio que reparte cien pedidos a mediodía recibe varias reseñas
    // seguidas sin que nadie amañe nada.
    it('varias reseñas seguidas al mismo comercio', async () => {
      const r = await evaluar({ resenasRecientes: 5 });
      expect(r.senales).toEqual(['rafaga']);
      expect(r.sospechosa).toBe(false);
    });
  });

  describe('dos señales o más marcan', () => {
    // El ataque que justifica todo esto: el comercio se compra a sí mismo desde
    // una cuenta creada para eso.
    it('cuenta creada el mismo día, única compra y misma dirección que el comercio', async () => {
      const r = await evaluar({
        horasHastaLaCompra: 0.5,
        cumplidas: 1,
        mismaIp: true,
      });
      expect(r.senales).toEqual(['cuenta_nueva', 'unica_compra', 'misma_ip']);
      expect(r.sospechosa).toBe(true);
    });

    it('cuenta dedicada: compra varias veces, siempre al mismo comercio, desde su misma red', async () => {
      const r = await evaluar({ cumplidasEnOtros: 0, mismaIp: true });
      expect(r.senales).toEqual(['solo_este_comercio', 'misma_ip']);
      expect(r.sospechosa).toBe(true);
    });
  });

  describe('los umbrales son exactos', () => {
    // 24 horas justas ya no es una cuenta nueva. Un umbral que se aplica en el
    // borde acaba marcando por un segundo de diferencia.
    it('a las 24 horas exactas la cuenta ya no es nueva', async () => {
      expect((await evaluar({ horasHastaLaCompra: 24 })).senales).toEqual([]);
      expect((await evaluar({ horasHastaLaCompra: 23.9 })).senales).toEqual([
        'cuenta_nueva',
      ]);
    });

    it('dos reseñas en una hora no son una ráfaga; tres sí', async () => {
      expect((await evaluar({ resenasRecientes: 2 })).senales).toEqual([]);
      expect((await evaluar({ resenasRecientes: 3 })).senales).toEqual([
        'rafaga',
      ]);
    });

    it('una segunda compra en otro comercio despeja las dos señales de historial', async () => {
      expect(
        (await evaluar({ cumplidas: 2, cumplidasEnOtros: 1 })).senales,
      ).toEqual([]);
    });
  });

  it('sin el comercio a mano no inventa la señal de dirección', async () => {
    const s = servicio(
      { mismaIp: true },
      { findOne: () => Promise.resolve(null) },
    );
    expect((await s.evaluar(AUTOR, COMERCIO, AHORA)).senales).toEqual([]);
  });
});
