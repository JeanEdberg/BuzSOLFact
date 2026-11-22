// Ámbito territorial de la Amazonía (Ley N.° 27037, art. 3.1, con las
// modificaciones de las Leyes N.° 27759, N.° 29525 y N.° 30399).
//
// Espejo de `App\Support\Amazonia` del backend: la PWA decide en pantalla si
// una empresa opera en la zona a partir de su ubigeo, sin depender del flag
// manual `contribuyente_amazonia`. La lista de departamentos, provincias y
// distritos es la que fija la norma.

export const LEYENDAS_AMAZONIA = {
  2001: 'BIENES TRANSFERIDOS EN LA AMAZONIA REGION SELVA PARA SER CONSUMIDOS EN LA MISMA',
  2002: 'SERVICIOS PRESTADOS EN LA AMAZONIA REGION SELVA PARA SER CONSUMIDOS EN LA MISMA',
  2003: 'CONTRATOS DE CONSTRUCCION EJECUTADOS EN LA AMAZONIA REGION SELVA',
};

export const TIPOS_AMAZONIA = [
  { value: '2001', label: '2001 · Bienes transferidos en la Amazonía' },
  { value: '2002', label: '2002 · Servicios prestados en la Amazonía' },
  { value: '2003', label: '2003 · Contratos de construcción en la Amazonía' },
];

// Literal a): departamentos íntegros.
const REGIONES = ['010000', '160000', '170000', '220000', '250000'];

// Literales c) y f): provincias completas.
const PROVINCIAS = [
  '060800', '060900', '080900', '100600', '100700',
  '100800', '100900', '120300', '120600', '190300',
];

// Distritos nombrados uno por uno en los literales b), d), e), h), i), j) y k).
const DISTRITOS = [
  '050402', '050408', '050409', '050407', // Huanta (Ayacucho)
  '050503', '050501', '050507', '050509', // La Mar (Ayacucho)
  '080408', // Yanatile (Calca)
  '081106', // Kosñipata (Paucartambo)
  '081203', '081209', // Camanti, Marcapata (Quispicanchi)
  '100507', // Monzón (Huamalíes)
  '100104', '100109', '100103', '100101', '100102', '100111', // Huánuco
  '100204', '100208', '100201', // Ambo
  '210304', '210303', '210307', '210308', '210309', // Carabaya (Puno)
  '211207', '211203', '211208', '211205', '211209', '211201', '211204', // Sandia (Puno)
  '090707', '090718', // Tayacaja (Huancavelica)
  '130807', // Ongón (Pataz)
  '200303', // El Carmen de la Frontera (Huancabamba)
];

// ¿El ubigeo (6 dígitos) pertenece al ámbito de la Ley 27037? También acepta
// prefijos de 2 o 4 dígitos (departamento o provincia).
export function perteneceAmazonia(ubigeo) {
  const codigo = String(ubigeo ?? '').replace(/\D/g, '');
  if (!codigo) return false;

  const seis = codigo.padEnd(6, '0').slice(0, 6);
  if (REGIONES.includes(`${seis.slice(0, 2)}0000`)) return true;
  if (PROVINCIAS.includes(`${seis.slice(0, 4)}00`)) return true;
  return DISTRITOS.includes(seis);
}

// ¿La empresa opera en la Amazonía? Marca manual o ubigeo.
export function esContribuyenteAmazonia(empresa) {
  if (!empresa) return false;
  if (empresa.contribuyente_amazonia || empresa.es_amazonia) return true;
  return perteneceAmazonia(empresa.ubigeo);
}

// Tipo de leyenda por defecto: la marca de la empresa o bienes.
export function tipoAmazoniaDe(empresa) {
  const tipo = String(empresa?.tipo_amazonia ?? '');
  return LEYENDAS_AMAZONIA[tipo] ? tipo : '2001';
}
