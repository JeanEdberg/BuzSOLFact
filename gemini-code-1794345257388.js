import React, { useState } from 'react';
import { Bell, FileText, ShoppingCart, Truck, Download, Search, CheckCircle2, ShieldAlert, RefreshCw } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('buzon');

  // Estados de ejemplo para las pestañas
  const [notifications, setNotifications] = useState([
    { id: 1, entity: 'SUNAT', title: 'Resolución de Intendencia N° 023-2026', date: '2026-11-10', type: 'Alerta', read: false },
    { id: 2, entity: 'SUNAFIL', title: 'Notificación de Inspección Laboral N° 890-2026', date: '2026-11-09', type: 'Urgente', read: false }
  ]);

  const [guias, setGuias] = useState([
    { serie: 'T001-0000142', cliente: 'Inversiones Plumífero E.I.R.L.', fecha: '2026-11-10', estado: 'Aceptado', xml: true, pdf: true, cdr: true }
  ]);

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans">
      {/* Sidebar para Escritorio y Móvil */}
      <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col hidden md:flex">
        <div className="p-5 border-b border-slate-700">
          <h1 className="text-xl font-bold text-blue-400">INMOA ERP PWA</h1>
          <p className="text-xs text-slate-400">RUC: 20614684772</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('buzon')}
            className={`w-flex flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === 'buzon' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>
            <Bell size={18} /> Buzón SUNAT / SUNAFIL
          </button>
          <button 
            onClick={() => setActiveTab('compras')}
            className={`w-flex flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === 'compras' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>
            <ShoppingCart size={18} /> Registro de Compras
          </button>
          <button 
            onClick={() => setActiveTab('facturas')}
            className={`w-flex flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === 'facturas' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>
            <FileText size={18} /> Facturación & Boletas
          </button>
          <button 
            onClick={() => setActiveTab('guias')}
            className={`w-flex flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === 'guias' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>
            <Truck size={18} /> Guías de Remisión
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6">
          <h2 className="text-lg font-semibold capitalize">{activeTab.replace('-', ' ')}</h2>
          <div className="flex items-center gap-4">
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30">Sistema Conectado</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'buzon' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Notificaciones Electrónicas en Tiempo Real</h3>
                <button className="flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-500">
                  <RefreshCw size={16} /> Sincronizar Buzones
                </button>
              </div>
              <div className="grid gap-3">
                {notifications.map(n => (
                  <div key={n.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
                    <div>
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${n.entity === 'SUNAT' ? 'bg-amber-500/20 text-amber-400' : 'bg-purple-500/20 text-purple-400'}`}>{n.entity}</span>
                      <h4 className="font-medium mt-1">{n.title}</h4>
                      <p className="text-xs text-slate-400">Fecha: {n.date}</p>
                    </div>
                    <button className="text-blue-400 hover:underline text-sm">Ver Detalle</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'guias' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Consulta y Descarga de Guías de Remisión</h3>
                <div className="flex gap-2">
                  <input type="text" placeholder="Buscar serie o cliente..." className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                  <button className="bg-blue-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-500 flex items-center gap-2">
                    <Search size={16} /> Buscar
                  </button>
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
                      <th className="p-4">Serie / Número</th>
                      <th className="p-4">Destinatario</th>
                      <th className="p-4">Emisión</th>
                      <th className="p-4">Estado SUNAT</th>
                      <th className="p-4 text-center">Descargas (XML / PDF / CDR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700 text-sm">
                    {guias.map((g, idx) => (
                      <tr key={idx} className="hover:bg-slate-750">
                        <td className="p-4 font-mono font-medium text-blue-400">{g.serie}</td>
                        <td className="p-4">{g.cliente}</td>
                        <td className="p-4">{g.fecha}</td>
                        <td className="p-4"><span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 size={14}/> {g.estado}</span></td>
                        <td className="p-4 flex justify-center gap-3">
                          <button className="p-2 bg-slate-700 hover:bg-slate-600 rounded text-xs" title="Descargar XML">XML</button>
                          <button className="p-2 bg-slate-700 hover:bg-slate-600 rounded text-xs" title="Descargar PDF">PDF</button>
                          <button className="p-2 bg-slate-700 hover:bg-slate-600 rounded text-xs" title="Descargar CDR">CDR</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Resto de pestañas (compras, facturas) operan bajo la misma estructura */}
        </div>
      </main>
    </div>
  );
}