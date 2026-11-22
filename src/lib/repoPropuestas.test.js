import { describe, it, expect, beforeEach } from 'vitest';
import { buildRvie } from './sire.js';
import {
  guardarPropuesta, obtenerPropuesta, listarPropuestas, eliminarPropuesta,
} from './repoPropuestas.js';

const ctx = { ruc: '20614684772', razon_social: 'INMOA ERP & FACTURACIÓN S.A.C.' };

const fila = (numero, ruc = '20512345678') => ({
  tipo_documento: '01', serie: 'F001', numero, fecha_emision: '2026-11-10',
  periodo: '2026-11', moneda: 'PEN', tipo_cambio: 1,
  cliente: { tipo_doc: '6', num_doc: ruc, razon_social: 'Cliente X S.A.C.' },
  bi_gravada: 1000, igv: 180, total: 1180,
});

function contenidoRvie(numeros) {
  return buildRvie(numeros.map((n) => fila(n)), ctx).content;
}

describe('repositorio de propuestas SIRE', () => {
  beforeEach(() => {
    // Aísla cada prueba borrando lo que hubiera quedado del mes usado.
    for (const p of listarPropuestas({ companyId: 7 })) {
      eliminarPropuesta({ companyId: 7, libro: p.libro, periodo: p.periodo });
    }
  });

  it('guarda una propuesta y la recupera con sus filas parseadas', () => {
    guardarPropuesta({
      companyId: 7, libro: 'ventas', periodo: '2026-11',
      contenido: contenidoRvie(['00000142']), origen: 'servidor',
    });
    const guardada = obtenerPropuesta({ companyId: 7, libro: 'ventas', periodo: '2026-11' });
    expect(guardada).not.toBeNull();
    expect(guardada.registros).toBe(1);
    expect(guardada.origen).toBe('servidor');
    expect(guardada.filas).toHaveLength(1);
    expect(guardada.filas[0].serie).toBe('F001');
  });

  it('no duplica: volver a guardar el mismo periodo reemplaza la versión previa', () => {
    guardarPropuesta({ companyId: 7, libro: 'ventas', periodo: '2026-11', contenido: contenidoRvie(['00000142']) });
    guardarPropuesta({ companyId: 7, libro: 'ventas', periodo: '2026-11', contenido: contenidoRvie(['00000142', '00000143']) });

    const delMes = listarPropuestas({ companyId: 7, libro: 'ventas' }).filter((p) => p.periodo === '2026-11');
    expect(delMes).toHaveLength(1);
    expect(obtenerPropuesta({ companyId: 7, libro: 'ventas', periodo: '2026-11' }).filas).toHaveLength(2);
  });

  it('separa las propuestas por libro y por empresa', () => {
    guardarPropuesta({ companyId: 7, libro: 'ventas', periodo: '2026-11', contenido: contenidoRvie(['00000142']) });
    guardarPropuesta({ companyId: 8, libro: 'ventas', periodo: '2026-11', contenido: contenidoRvie(['00000999']) });

    expect(obtenerPropuesta({ companyId: 7, libro: 'ventas', periodo: '2026-11' }).filas[0].numero).toBe('00000142');
    expect(obtenerPropuesta({ companyId: 8, libro: 'ventas', periodo: '2026-11' }).filas[0].numero).toBe('00000999');
    expect(obtenerPropuesta({ companyId: 7, libro: 'compras', periodo: '2026-11' })).toBeNull();
  });

  it('lista los periodos archivados en orden cronológico', () => {
    guardarPropuesta({ companyId: 7, libro: 'ventas', periodo: '2026-11', contenido: contenidoRvie(['00000142']) });
    guardarPropuesta({ companyId: 7, libro: 'ventas', periodo: '2026-09', contenido: contenidoRvie(['00000100']) });
    const periodos = listarPropuestas({ companyId: 7, libro: 'ventas' }).map((p) => p.periodo);
    expect(periodos).toEqual(['2026-09', '2026-11']);
  });
});
