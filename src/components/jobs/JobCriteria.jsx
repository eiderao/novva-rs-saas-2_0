import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { Save, Plus, Trash2, Copy, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function JobCriteria({ job, onUpdate }) {
  const defaultParams = {
    triagem: [],
    cultura: [],
    tecnico: [],
    notas: [
      { id: '1', nome: 'Abaixo', valor: 0 },
      { id: '2', nome: 'Atende', valor: 5 },
      { id: '3', nome: 'Supera', valor: 10 }
    ]
  };

  const [params, setParams] = useState(job.parameters || defaultParams);
  const [loading, setLoading] = useState(false);
  const [importJobId, setImportJobId] = useState('');
  const [allJobs, setAllJobs] = useState([]);

  useEffect(() => {
    const fetchJobs = async () => {
      const { data } = await supabase
        .from('jobs')
        .select('id, title')
        .neq('id', job.id)
        .order('created_at', { ascending: false });
      setAllJobs(data || []);
    };
    fetchJobs();
  }, [job.id]);

  // --- LÓGICA DE CRITÉRIOS (PESOS) ---
  const getSectionTotal = (sectionKey) => {
    const items = params[sectionKey] || [];
    return items.reduce((acc, item) => acc + (Number(item.weight) || 0), 0);
  };

  const addItem = (section) => {
    const newItem = { name: '', weight: 0 };
    setParams({ ...params, [section]: [...(params[section] || []), newItem] });
  };

  const removeItem = (section, index) => {
    const newList = [...params[section]];
    newList.splice(index, 1);
    setParams({ ...params, [section]: newList });
  };

  const updateItem = (section, index, field, value) => {
    const newList = [...params[section]];
    newList[index][field] = value;
    setParams({ ...params, [section]: newList });
  };

  // --- LÓGICA DA RÉGUA DE NOTAS (NOVA) ---
  const addNoteLevel = () => {
    const newNote = { id: crypto.randomUUID(), nome: '', valor: 0 };
    setParams({ ...params, notas: [...(params.notas || []), newNote] });
  };

  const removeNoteLevel = (index) => {
    const newNotas = [...params.notas];
    newNotas.splice(index, 1);
    setParams({ ...params, notas: newNotas });
  };

  const updateNoteLevel = (index, field, value) => {
    const newNotas = [...params.notas];
    newNotas[index][field] = value;
    setParams({ ...params, notas: newNotas });
  };

  // --- SALVAR E IMPORTAR ---
  const handleSave = async () => {
    // 1. Validação de Pesos
    const sections = ['triagem', 'cultura', 'tecnico'];
    const errors = [];

    sections.forEach(sec => {
      const total = getSectionTotal(sec);
      if ((params[sec] && params[sec].length > 0) && total !== 100) {
        errors.push(`A seção ${sec.toUpperCase()} soma ${total}% (deve ser 100%).`);
      }
    });

    // 2. Validação da Régua de Notas
    if (!params.notas || params.notas.length < 2) {
      errors.push("A Régua de Notas deve ter pelo menos 2 níveis (ex: Min e Max).");
    }

    if (errors.length > 0) {
      alert(`Erro de Validação:\n\n${errors.join('\n')}\n\nAjuste antes de salvar.`);
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('jobs')
      .update({ parameters: params })
      .eq('id', job.id);

    if (error) alert("Erro ao salvar: " + error.message);
    else {
      alert("Critérios atualizados com sucesso!");
      if (onUpdate) onUpdate();
    }
    setLoading(false);
  };

  const importCriteria = async () => {
    if (!importJobId) return;
    const { data } = await supabase.from('jobs').select('parameters').eq('id', importJobId).single();
    if (data?.parameters) {
      setParams(data.parameters);
      alert("Critérios importados! Verifique os pesos e salve.");
    }
  };

  // --- RENDERIZADORES ---
  const renderSection = (title, key, color) => {
    const totalWeight = getSectionTotal(key);
    const isValid = totalWeight === 100;
    const isEmpty = !params[key] || params[key].length === 0;

    let statusColor = "text-gray-400";
    let statusIcon = null;
    let statusText = "Vazio (0%)";

    if (!isEmpty) {
      if (isValid) {
        statusColor = "text-green-600";
        statusIcon = <CheckCircle2 size={16} />;
        statusText = "Total: 100% (OK)";
      } else {
        statusColor = "text-red-600";
        statusIcon = <AlertCircle size={16} />;
        statusText = `Total: ${totalWeight}% (Faltam ${100 - totalWeight}%)`;
      }
    }

    return (
      <div className={`bg-gray-50 p-4 rounded border mb-4 ${!isEmpty && !isValid ? 'border-red-200 bg-red-50' : ''}`}>
        <div className="flex justify-between items-center mb-3">
          <div className="flex flex-col">
            <h3 className={`font-bold uppercase text-sm ${color}`}>{title}</h3>
            <div className={`text-xs font-bold flex items-center gap-1 mt-1 ${statusColor}`}>
              {statusIcon} {statusText}
            </div>
          </div>
          <button onClick={() => addItem(key)} className="text-xs flex items-center gap-1 text-blue-600 font-bold hover:underline">
            <Plus size={14}/> Adicionar Critério
          </button>
        </div>
        
        {isEmpty && <p className="text-sm text-gray-400 italic">Nenhum critério definido.</p>}

        <div className="space-y-2">
          {(params[key] || []).map((item, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input 
                className="flex-1 border p-1 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Nome do Critério (Ex: Comunicação)"
                value={item.name}
                onChange={e => updateItem(key, idx, 'name', e.target.value)}
              />
              <div className="w-24 relative">
                <input 
                  type="number"
                  className="w-full border p-1 rounded text-sm text-center pr-6 outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="%"
                  value={item.weight}
                  onChange={e => updateItem(key, idx, 'weight', e.target.value)}
                />
                <span className="absolute right-2 top-1 text-gray-400 text-xs">%</span>
              </div>
              <button onClick={() => removeItem(key, idx)} className="text-red-500 hover:bg-red-100 p-1 rounded">
                <Trash2 size={14}/>
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b pb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Configuração da Avaliação</h2>
          <p className="text-sm text-gray-500">Defina os critérios e seus pesos (Soma deve ser 100%).</p>
        </div>
        
        <div className="flex gap-2 items-center">
          <select 
            className="border p-2 rounded text-sm max-w-[200px]"
            value={importJobId}
            onChange={e => setImportJobId(e.target.value)}
          >
            <option value="">Copiar de outra vaga...</option>
            {allJobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
          <button onClick={importCriteria} disabled={!importJobId} className="bg-gray-200 p-2 rounded hover:bg-gray-300" title="Copiar">
            <Copy size={16}/>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          {renderSection('Triagem (RH)', 'triagem', 'text-purple-600')}
          {renderSection('Fit Cultural', 'cultura', 'text-green-600')}
        </div>
        
        <div>
          {renderSection('Técnico / Hard Skills', 'tecnico', 'text-blue-600')}
          
          {/* CONFIGURAÇÃO DA RÉGUA DE NOTAS (DINÂMICA) */}
          <div className="bg-white p-4 rounded border shadow-sm border-l-4 border-l-orange-400">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="font-bold uppercase text-sm text-gray-800">Régua de Notas</h3>
                <p className="text-xs text-gray-500">Defina os níveis e valores para o cálculo.</p>
              </div>
              <button onClick={addNoteLevel} className="text-xs flex items-center gap-1 text-orange-600 font-bold hover:underline">
                <Plus size={14}/> Novo Nível
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2 text-xs font-bold text-gray-400 px-1">
                <span className="flex-1">Nome do Nível</span>
                <span className="w-20 text-center">Nota</span>
                <span className="w-6"></span>
              </div>
              
              {(params.notas || []).map((nota, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input 
                    className="flex-1 border p-1 rounded text-sm outline-none focus:ring-1 focus:ring-orange-500"
                    value={nota.nome}
                    placeholder="Ex: Atende"
                    onChange={e => updateNoteLevel(idx, 'nome', e.target.value)}
                  />
                  <input 
                    type="number"
                    className="w-20 border p-1 rounded text-sm text-center outline-none focus:ring-1 focus:ring-orange-500"
                    value={nota.valor}
                    placeholder="0"
                    onChange={e => updateNoteLevel(idx, 'valor', e.target.value)}
                  />
                  <button onClick={() => removeNoteLevel(idx)} className="text-red-400 hover:text-red-600 p-1">
                    <Trash2 size={14}/>
                  </button>
                </div>
              ))}
              
              {(!params.notas || params.notas.length === 0) && (
                <p className="text-sm text-red-500 italic py-2 text-center bg-red-50 rounded">
                  Defina pelo menos 2 níveis de nota.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t">
        <button 
          onClick={handleSave} 
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
        >
          <Save size={18}/> {loading ? 'Salvando...' : 'Salvar Configuração'}
        </button>
      </div>
    </div>
  );
}