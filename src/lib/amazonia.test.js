import { describe, it, expect } from 'vitest';
import {
  LEYENDAS_AMAZONIA,
  TIPOS_AMAZONIA,
  perteneceAmazonia,
  esContribuyenteAmazonia,
  tipoAmazoniaDe,
} from './amazonia.js';

describe('ámbito territorial de la Amazonía (Ley 27037, art. 3.1)', () => {
  it('reconoce los departamentos íntegros', () => {
    expect(perteneceAmazonia('160101')).toBe(true); // Loreto
    expect(perteneceAmazonia('010101')).toBe(true); // Amazonas
    expect(perteneceAmazonia('220101')).toBe(true); // San Martín
    expect(perteneceAmazonia('250101')).toBe(true); // Ucayali
    expect(perteneceAmazonia('170101')).toBe(true); // Madre de Dios (Tambopata)
  });

  it('reconoce las provincias completas', () => {
    expect(perteneceAmazonia('060801')).toBe(true); // Jaén
    expect(perteneceAmazonia('080901')).toBe(true); // La Convención
    expect(perteneceAmazonia('120601')).toBe(true); // Satipo
    expect(perteneceAmazonia('190301')).toBe(true); // Oxapampa
  });

  it('reconoce los distritos nombrados uno por uno', () => {
    expect(perteneceAmazonia('050402')).toBe(true); // Sivia
    expect(perteneceAmazonia('080408')).toBe(true); // Yanatile
    expect(perteneceAmazonia('100208')).toBe(true); // Tomayquichua
    expect(perteneceAmazonia('210304')).toBe(true); // Coaza
    expect(perteneceAmazonia('130807')).toBe(true); // Ongón
    expect(perteneceAmazonia('200303')).toBe(true); // El Carmen de la Frontera
  });

  it('excluye ubigeos fuera del ámbito', () => {
    expect(perteneceAmazonia('150101')).toBe(false); // Lima
    expect(perteneceAmazonia('040101')).toBe(false); // Arequipa
    expect(perteneceAmazonia('080101')).toBe(false); // Cusco capital
    expect(perteneceAmazonia('')).toBe(false);
    expect(perteneceAmazonia(null)).toBe(false);
  });

  it('acepta prefijos de departamento y provincia', () => {
    expect(perteneceAmazonia('16')).toBe(true);
    expect(perteneceAmazonia('1206')).toBe(true);
    expect(perteneceAmazonia('15')).toBe(false);
  });
});

describe('condición de contribuyente de la Amazonía', () => {
  it('respeta la marca manual aunque el ubigeo esté fuera', () => {
    expect(esContribuyenteAmazonia({ ubigeo: '150101', contribuyente_amazonia: true })).toBe(true);
  });

  it('detecta por ubigeo sin marca manual', () => {
    expect(esContribuyenteAmazonia({ ubigeo: '170101', contribuyente_amazonia: false })).toBe(true);
  });

  it('usa el campo es_amazonia que calcula el backend', () => {
    expect(esContribuyenteAmazonia({ ubigeo: '150101', es_amazonia: true })).toBe(true);
  });

  it('es falso sin empresa o sin coincidencia', () => {
    expect(esContribuyenteAmazonia(null)).toBe(false);
    expect(esContribuyenteAmazonia({ ubigeo: '150101' })).toBe(false);
  });
});

describe('tipo de leyenda de Amazonía', () => {
  it('respeta el tipo guardado en la empresa', () => {
    expect(tipoAmazoniaDe({ tipo_amazonia: '2002' })).toBe('2002');
    expect(tipoAmazoniaDe({ tipo_amazonia: '2003' })).toBe('2003');
  });

  it('cae a bienes por defecto', () => {
    expect(tipoAmazoniaDe({})).toBe('2001');
    expect(tipoAmazoniaDe({ tipo_amazonia: '9999' })).toBe('2001');
  });

  it('expone los textos y etiquetas del catálogo de leyendas', () => {
    expect(LEYENDAS_AMAZONIA['2001']).toMatch(/BIENES TRANSFERIDOS EN LA AMAZONIA/);
    expect(LEYENDAS_AMAZONIA['2002']).toMatch(/SERVICIOS PRESTADOS EN LA AMAZONIA/);
    expect(TIPOS_AMAZONIA).toHaveLength(3);
  });
});
