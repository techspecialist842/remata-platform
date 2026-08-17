import {
  descuentoDinamicoCentavos,
  precioVigente,
  RescateConPrecio,
} from './precio-dinamico';

/**
 * El precio es dinero. Lo que se prueba aquí no es que la función devuelva algo,
 * sino que no pueda cobrar de más, cobrar de menos, ni sorprender a nadie.
 */

// Ventana de 10 horas, para que las fracciones salgan redondas.
const INICIO = new Date('2026-08-16T00:00:00.000Z');
const FIN = new Date('2026-08-16T10:00:00.000Z');

const enHoras = (h: number) => new Date(INICIO.getTime() + h * 60 * 60 * 1000);

const rescate = (precio: number, suelo: number | null): RescateConPrecio => ({
  precioCentavos: precio,
  precioMinimoCentavos: suelo,
  validoDesde: INICIO,
  validoHasta: FIN,
});

describe('precio dinámico', () => {
  describe('sin suelo no pasa nada', () => {
    // Quien no pidió precio dinámico no debe encontrarse con que su precio
    // baja solo.
    it('mantiene el precio del comercio durante toda la ventana', () => {
      const r = rescate(500, null);
      for (const h of [0, 3, 5, 7, 9, 10]) {
        expect(precioVigente(r, enHoras(h))).toBe(500);
      }
      expect(descuentoDinamicoCentavos(r, enHoras(9))).toBe(0);
    });
  });

  describe('con suelo, baja por tramos', () => {
    const r = rescate(1000, 400);

    it('cobra el precio completo en la primera mitad', () => {
      expect(precioVigente(r, enHoras(0))).toBe(1000);
      expect(precioVigente(r, enHoras(2))).toBe(1000);
      // A las 5 h queda exactamente la mitad. El umbral se abre al pasarlo, no
      // al alcanzarlo, así que aquí todavía es precio completo.
      expect(precioVigente(r, enHoras(5))).toBe(1000);
    });

    it('baja a mitad de camino entre la mitad y el último cuarto', () => {
      // (1000 + 400) / 2 = 700
      expect(precioVigente(r, enHoras(6))).toBe(700);
      expect(precioVigente(r, enHoras(7))).toBe(700);
      expect(precioVigente(r, enHoras(7.4))).toBe(700);
      // Un instante después de pasar la mitad ya se aplica.
      expect(precioVigente(r, enHoras(5.1))).toBe(700);
    });

    it('aplica el suelo en el último cuarto', () => {
      // A las 7,5 h queda exactamente un cuarto: el umbral todavía no se pasó,
      // así que sigue el tramo intermedio. El descuento se abre al pasarlo.
      expect(precioVigente(r, enHoras(7.5))).toBe(700);
      expect(precioVigente(r, enHoras(7.6))).toBe(400);
      expect(precioVigente(r, enHoras(9))).toBe(400);
      expect(precioVigente(r, enHoras(10))).toBe(400);
    });

    it('nunca baja del suelo ni sube del precio fijado', () => {
      for (let h = -2; h <= 14; h += 0.5) {
        const p = precioVigente(r, enHoras(h));
        expect(p).toBeGreaterThanOrEqual(400);
        expect(p).toBeLessThanOrEqual(1000);
      }
    });
  });

  describe('los casos que rompen las reglas mal escritas', () => {
    it('un suelo mayor que el precio se ignora, no sube el precio', () => {
      // Si esto no se controlara, el comercio vería subir su precio solo.
      const r = rescate(500, 900);
      expect(precioVigente(r, enHoras(9))).toBe(500);
    });

    it('un suelo igual al precio no produce descuento', () => {
      const r = rescate(500, 500);
      expect(precioVigente(r, enHoras(9))).toBe(500);
    });

    it('una ventana de duración cero no divide entre cero', () => {
      const r: RescateConPrecio = {
        precioCentavos: 800,
        precioMinimoCentavos: 300,
        validoDesde: INICIO,
        validoHasta: INICIO,
      };
      expect(precioVigente(r, INICIO)).toBe(800);
    });

    it('una ventana invertida no produce precios absurdos', () => {
      const r: RescateConPrecio = {
        precioCentavos: 800,
        precioMinimoCentavos: 300,
        validoDesde: FIN,
        validoHasta: INICIO,
      };
      expect(precioVigente(r, INICIO)).toBe(800);
    });

    it('después de vencer se queda en el suelo, no sigue bajando', () => {
      const r = rescate(1000, 400);
      expect(precioVigente(r, enHoras(50))).toBe(400);
    });

    it('antes de empezar cobra el precio completo', () => {
      const r = rescate(1000, 400);
      expect(precioVigente(r, enHoras(-5))).toBe(1000);
    });
  });

  describe('el redondeo nunca juega contra el comercio', () => {
    // 501 y 400 dan 450,5. Redondear hacia abajo le quitaría medio centavo al
    // comercio en cada venta del tramo intermedio.
    it('redondea hacia arriba en el tramo intermedio', () => {
      const r = rescate(501, 400);
      expect(precioVigente(r, enHoras(6))).toBe(451);
    });

    it('siempre devuelve un entero de centavos', () => {
      for (const [precio, suelo] of [
        [333, 111],
        [1001, 7],
        [99, 98],
      ]) {
        const p = precioVigente(rescate(precio, suelo), enHoras(6));
        expect(Number.isInteger(p)).toBe(true);
      }
    });
  });

  describe('el ahorro que se comunica', () => {
    it('coincide con la diferencia real', () => {
      const r = rescate(1000, 400);
      expect(descuentoDinamicoCentavos(r, enHoras(6))).toBe(300);
      expect(descuentoDinamicoCentavos(r, enHoras(9))).toBe(600);
      expect(descuentoDinamicoCentavos(r, enHoras(1))).toBe(0);
    });
  });
});
