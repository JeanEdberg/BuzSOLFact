// Marca FacBuzMoa: sobre minimalista cuya solapa dibuja una "F" y, al mismo
// tiempo, un check (comprobante aceptado / aviso al día).
// `tono` permite usarla sobre fondo claro u oscuro sin duplicar el SVG.

const AZUL = '#0e4f6b';      // azul petróleo
const AZUL_CLARO = '#1a7fa8';
const ESMERALDA = '#10b981';
const CIAN = '#22d3ee';

export function IconoFacBuzMoa({ tamano = 40, tono = 'oscuro', className = '' }) {
  const cuerpo = tono === 'claro' ? AZUL : '#e8f4f8';
  const solapa = tono === 'claro' ? AZUL_CLARO : '#7fd4ea';
  const acento = tono === 'claro' ? ESMERALDA : CIAN;

  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="FacBuzMoa"
      className={className}
    >
      {/* Sobre: cuerpo redondeado con la boca abierta arriba */}
      <rect x="4" y="10" width="40" height="29" rx="4.5" stroke={cuerpo} strokeWidth="2.6" />
      {/* Solapa que baja desde las esquinas hacia el centro: forma la "F" */}
      <path d="M4 12.5 L24 27 L44 12.5" stroke={solapa} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      {/* Trazo vertical de la F y su brazo superior, integrados en la solapa */}
      <path d="M18 16.5 V23 M18 19.5 H23" stroke={acento} strokeWidth="2.6" strokeLinecap="round" />
      {/* Check de aceptado, saliendo del sobre */}
      <path d="M26 31.5 L30 35.5 L38 26" stroke={acento} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LogotipoFacBuzMoa({ tono = 'oscuro', compacto = false }) {
  const texto = tono === 'claro' ? 'text-slate-900' : 'text-white';
  const subtitulo = tono === 'claro' ? 'text-slate-600' : 'text-slate-300';

  return (
    <div className="flex items-center gap-3">
      <IconoFacBuzMoa tamano={compacto ? 32 : 44} tono={tono} />
      <div className="leading-tight">
        <p className={`font-bold tracking-tight ${texto} ${compacto ? 'text-lg' : 'text-2xl'}`}>
          FacBuzMoa
        </p>
        {!compacto && (
          <p className={`text-xs ${subtitulo}`}>Tu facturador y buzón tributario en un solo lugar</p>
        )}
      </div>
    </div>
  );
}
