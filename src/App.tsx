import React, { useState, useEffect } from 'react';
import { Upload, ChevronRight, Scale, Info, CheckCircle2, AlertTriangle, Play } from 'lucide-react';

interface Product {
  id: number;
  tenantId: number;
  name: string;
  isCompetitor: boolean;
  features: string; // JSON string
}

interface Comparison {
  advantages: string;
  disadvantages: string;
}

export default function App() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<number | null>(null);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [clientProdId, setClientProdId] = useState<number | null>(null);
  const [compProdId, setCompProdId] = useState<number | null>(null);

  const [comparisonDetails, setComparisonDetails] = useState<Comparison | null>(null);
  const [loading, setLoading] = useState(false);

  // Estados para Upload (MVP Administrador)
  const [file, setFile] = useState<File | null>(null);
  const [uploadTenant, setUploadTenant] = useState('');

  const fetchTenants = async () => {
    try {
      const res = await fetch('/api/tenants');
      const data = await res.json();
      setTenants(data);
      if (data.length > 0 && !selectedTenant) setSelectedTenant(data[0].id);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    if (selectedTenant) {
      fetch(`/api/products/${selectedTenant}`)
        .then(res => res.json())
        .then(data => {
          setProducts(data);
          setClientProdId(null);
          setCompProdId(null);
          setComparisonDetails(null);
        });
    }
  }, [selectedTenant]);

  useEffect(() => {
    if (clientProdId && compProdId) {
      setLoading(true);
      fetch(`/api/comparison/${clientProdId}/${compProdId}`)
        .then(res => res.json())
        .then(data => {
          setComparisonDetails(data);
          setLoading(false);
        });
    } else {
      setComparisonDetails(null);
    }
  }, [clientProdId, compProdId]);

  // Handler de Upload (Etapa 2 - Admin)
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !uploadTenant) return alert('Preencha o Nome do Tenant e selecione um arquivo.');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tenantName', uploadTenant);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      alert(data.message);
      fetchTenants();
    } catch (error) {
      alert('Erro no upload.');
    }
  };

  const seedDatabase = async () => {
    await fetch('/api/seed', { method: 'POST' });
    alert('Dados populados para demonstração!');
    fetchTenants();
  };

  // Auxiliar para parse das features que estão em string JSON do SQLite
  const parseFeatures = (featuresString: string) => {
    try {
      return JSON.parse(featuresString);
    } catch {
      return {};
    }
  };

  // Filtragem dos Drop-downs (Etapa 3 - Front-end Read-Only)
  const clientProducts = products.filter(p => !p.isCompetitor);
  const selectedClientProd = products.find(p => p.id === clientProdId);
  const selectedCompProd = products.find(p => p.id === compProdId);

  // Filtragem Inteligente de Concorrentes baseada na Categoria do Produto Cliente
  const competitorProducts = products.filter(p => {
    if (!p.isCompetitor) return false;
    
    if (selectedClientProd) {
      const clientFeatures = parseFeatures(selectedClientProd.features);
      // Busca case-insensitive por 'Categoria' ou 'Tipo'
      const categoryKey = Object.keys(clientFeatures).find(k => 
        k.toLowerCase() === 'categoria' || k.toLowerCase() === 'tipo'
      );
      
      if (categoryKey) {
        const clientCategory = String(clientFeatures[categoryKey]).toLowerCase();
        const compFeatures = parseFeatures(p.features);
        
        // Procura a mesma chave no concorrente
        const compCatKey = Object.keys(compFeatures).find(k => 
          k.toLowerCase() === 'categoria' || k.toLowerCase() === 'tipo'
        );

        if (compCatKey) {
           const compCategory = String(compFeatures[compCatKey]).toLowerCase();
           return clientCategory === compCategory;
        }
        return false; // Se o cliente tem categoria, e o concorrente não tem, esconde o concorrente
      }
    }
    return true; // Mostra tudo se não tiver categoria definida
  });

  // Efeito para limpar a seleção do concorrente se ele sumir da lista filtrada
  useEffect(() => {
    if (compProdId && !competitorProducts.find(p => p.id === compProdId)) {
      setCompProdId(null);
    }
  }, [competitorProducts, compProdId]);

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Top Navigation / SaaS Header */}
      <nav className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none text-slate-800">CompareEngine <span className="text-indigo-600">B2B</span></h1>
            <p className="text-xs text-slate-400 font-medium tracking-wide uppercase mt-1">Portal do Consultor</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold text-slate-400">TENANT ATIVO</span>
            {tenants.length === 0 ? (
              <button onClick={seedDatabase} className="text-sm font-bold text-indigo-600 flex items-center gap-1 hover:underline">
                <Play className="w-4 h-4" /> Gerar Dados de Teste
              </button>
            ) : (
              <select
                className="text-sm font-bold text-slate-700 bg-transparent border-none focus:ring-0 cursor-pointer outline-none text-right"
                value={selectedTenant || ''}
                onChange={(e) => setSelectedTenant(Number(e.target.value))}
              >
                <option value="" disabled>Selecione...</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center">
            <Info className="w-5 h-5 text-slate-500" />
          </div>
        </div>
      </nav>

      {/* Selection Bar */}
      {selectedTenant !== null && (
        <div className="bg-indigo-900 text-white px-8 py-6 shadow-inner shrink-0 z-10 relative">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center md:items-end gap-6">
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-indigo-300 uppercase mb-2 tracking-widest">1. Nosso Produto</label>
              <div className="relative">
                <select
                  className="w-full bg-indigo-800 border border-indigo-700 rounded-lg py-3 px-4 text-white appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={clientProdId || ''}
                  onChange={e => setClientProdId(Number(e.target.value))}
                >
                  <option value="" disabled>Selecione nosso produto...</option>
                  {clientProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-indigo-400">
                  <ChevronRight className="w-5 h-5 rotate-90 md:rotate-0 hidden md:block" />
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center justify-center pb-3">
              <div className="bg-indigo-700 p-2 rounded-full">
                <Scale className="w-6 h-6 text-indigo-200" />
              </div>
            </div>

            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-indigo-300 uppercase mb-2 tracking-widest">2. Produto Concorrente</label>
              <div className="relative">
                <select
                  className="w-full bg-indigo-800 border border-indigo-700 rounded-lg py-3 px-4 text-white appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                  value={compProdId || ''}
                  onChange={e => setCompProdId(Number(e.target.value))}
                  disabled={!clientProdId}
                >
                  <option value="" disabled>Selecione o concorrente...</option>
                  {competitorProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Grid OR Empty States */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto h-full flex flex-col">
          {!selectedTenant ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center max-w-lg mx-auto w-full">
              {/* Render Upload Box here if no tenant */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 w-full">
                  <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-8 h-8 text-indigo-600" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800 mb-2">Bem-vindo ao CompareEngine</h2>
                  <p className="text-sm text-slate-500 mb-8">Nenhum tenant selecionado. Escolha um tenant na barra superior ou importe planilhas para criar um novo.</p>
                  
                  <form onSubmit={handleUpload} className="space-y-4">
                    <div className="text-left">
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nome do Cliente (Tenant)</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Empresa Silva"
                        className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500 text-sm"
                        value={uploadTenant}
                        onChange={e => setUploadTenant(e.target.value)}
                      />
                    </div>
                    <div className="text-left">
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Planilha (.xlsx, .csv)</label>
                      <input
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        required
                        className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        onChange={e => setFile(e.target.files?.[0] || null)}
                      />
                    </div>
                    <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition uppercase text-xs tracking-wider mt-4">
                      Importar Dados
                    </button>
                  </form>
              </div>
            </div>
          ) : !selectedClientProd || !selectedCompProd ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-70">
              <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-6">
                <Scale className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-700 mb-2">Aguardando Seleção</h3>
              <p className="text-sm text-slate-500 max-w-sm mb-12">Selecione o nosso produto e o concorrente na barra superior para gerar a matriz de comparação.</p>
              
              {/* Painel de upload inferior compacto */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 w-full max-w-2xl text-left border-t-4 border-t-indigo-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center">
                  <Upload className="w-4 h-4 mr-2" /> Importador Administrativo
                </h4>
                <form onSubmit={handleUpload} className="flex flex-col md:flex-row items-center gap-4">
                  <input
                    type="text" required placeholder="Novo Tenant"
                    className="w-full md:w-1/3 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                    value={uploadTenant} onChange={e => setUploadTenant(e.target.value)}
                  />
                  <input
                    type="file" accept=".xlsx, .xls, .csv" required
                    className="w-full md:w-1/3 text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:font-semibold file:bg-indigo-50 file:text-indigo-700"
                    onChange={e => setFile(e.target.files?.[0] || null)}
                  />
                  <button type="submit" className="w-full md:w-auto bg-slate-800 text-white px-5 py-2 rounded-lg text-xs font-bold hover:bg-slate-700 whitespace-nowrap">PROCESSAR CSV</button>
                </form>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Main Product Card (Tenant) */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-6 bg-slate-50 border-b border-slate-100">
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded uppercase tracking-tighter">Seu Produto</span>
                  <h2 className="text-2xl font-bold mt-2 text-slate-800">{selectedClientProd.name}</h2>
                </div>
                <div className="p-6 flex-1 space-y-6">
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Ficha Técnica do Produto</p>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(parseFeatures(selectedClientProd.features)).map(([key, value]) => (
                        <div key={key} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <p className="text-[10px] text-slate-400 font-bold uppercase truncate" title={key}>{key}</p>
                          <p className="text-lg font-bold text-indigo-600 truncate" title={String(value)}>{String(value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Comparison Summary (Bento Center) */}
              <div className="flex flex-col gap-6">
                {/* Advantages */}
                <div className="bg-indigo-600 rounded-2xl p-6 text-white flex-1 flex flex-col justify-center text-center shadow-sm relative overflow-hidden min-h-[220px]">
                  <div className="absolute -top-12 -right-12 opacity-10">
                    <CheckCircle2 className="w-48 h-48" />
                  </div>
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle2 className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">Argumentos a Favor</h3>
                    <p className="text-sm text-indigo-100 mb-6 leading-relaxed">
                      {loading ? 'Processando dados...' : comparisonDetails?.advantages || 'Nenhuma vantagem específica documentada para este comparativo.'}
                    </p>
                  </div>
                </div>
                
                {/* Disadvantages / Objections */}
                <div className="bg-slate-800 rounded-2xl p-6 text-white text-center shadow-sm border border-slate-700">
                    <div className="flex justify-center mb-3 text-red-400">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-bold uppercase tracking-widest text-slate-300 mb-3">Pontos de Objeção</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {loading ? 'Processando dados...' : comparisonDetails?.disadvantages || 'Nenhuma objeção ou desvantagem documentada.'}
                    </p>
                </div>

                {/* Upload Admin Block Box */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 shrink-0">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Painel Admin / Upload</h4>
                  <form onSubmit={handleUpload} className="flex flex-col gap-3">
                    <input
                      type="text" required placeholder="Novo Tenant"
                      className="w-full border-b border-slate-200 py-1 text-xs focus:border-indigo-500 outline-none transition-colors"
                      value={uploadTenant} onChange={e => setUploadTenant(e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="file" accept=".xlsx, .xls, .csv" required
                        className="flex-1 text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:font-semibold file:bg-indigo-50 file:text-indigo-700 cursor-pointer"
                        onChange={e => setFile(e.target.files?.[0] || null)}
                      />
                      <button type="submit" className="bg-slate-800 text-white px-3 py-1.5 rounded text-[10px] font-bold hover:bg-slate-700 uppercase">Processar</button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Competitor Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col opacity-90 grayscale-[0.3] hover:grayscale-0 transition-all duration-300">
                <div className="p-6 bg-slate-50 border-b border-slate-100">
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded uppercase tracking-tighter">Concorrente</span>
                  <h2 className="text-2xl font-bold mt-2 text-slate-800">{selectedCompProd.name}</h2>
                </div>
                <div className="p-6 flex-1 space-y-6">
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Ficha Técnica do Produto</p>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(parseFeatures(selectedCompProd.features)).map(([key, value]) => (
                        <div key={key} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <p className="text-[10px] text-slate-400 font-bold uppercase truncate" title={key}>{key}</p>
                          <p className="text-lg font-bold text-slate-700 truncate" title={String(value)}>{String(value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </main>

      {/* Bottom Status Bar */}
      <footer className="bg-white border-t border-slate-200 px-8 py-3 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            DATABASE CONNECTED (SQLITE)
          </div>
          <span className="hidden sm:inline">SISTEMA MULTI-TENANT v1.0.4-MVP</span>
        </div>
        <div className="hidden md:flex gap-6">
          <span>DOCUMENTAÇÃO API</span>
          <span>SUPORTE ARQUITETURA</span>
        </div>
      </footer>
    </div>
  );
}
