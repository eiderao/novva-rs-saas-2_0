import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { Save, Plus, Trash2, Copy } from 'lucide-react';

export default function JobCriteria({ job, onUpdate }) {
  // Estrutura padrão segura
  const defaultParams = {
    triagem: [],
    cultura: [],
    tecnico: [],
    notas: [
      { id: '1', nome: 'Abaixo', valor: 0 },
      { id: '2', nome: 'Atende', valor: 50 },
      { id: '3', nome: 'Supera', valor: 100 }
    ]
  };

  const [params, setParams] = useState(job.parameters || defaultParams);
  const [loading, setLoading] = useState(false);
  const [importJobId, setImportJobId] = useState('');
  const [allJobs, setAllJobs] = useState([]);

  useEffect(() => {
    // Carrega outras vagas para a função de "Copiar de..."
    const fetchJobs = async () => {
      const { data } = await supabase
        .from('jobs')
        .select('id, title')
        .neq('id', job.id) // Não trazer a própria vaga
        .order('created_at', { ascending: false });
      setAllJobs(data || []);
    };
    fetchJobs();
  }, [job.id]);

  const handleSave = async () => {
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
      alert("Critérios importados! Clique em salvar para confirmar.");
    }
  };

  // Funções de Manipulação do State
  const addItem = (section) => {
    const newItem = { name: '', weight: 1 };
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

  const renderSection = (title, key, color) => (
    <div className="bg-gray-50 p-4 rounded border mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className={`font-bold uppercase text-sm ${color}`}>{title}</h3>
        <button onClick={() => addItem(key)} className="text-xs flex items-center gap-1 text-blue-600 font-bold hover:underline">
          <Plus size={14}/> Adicionar Critério
        </button>
      </div>
      
      {(!params[key] || params[key].length === 0) && <p className="text-sm text-gray-400 italic">Nenhum critério definido.</p>}

      <div className="space-y-2">
        {(params[key] || []).map((item, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <input 
              className="flex-1 border p-1 rounded text-sm"
              placeholder="Nome do Critério (Ex: Comunicação)"
              value={item.name}
              onChange={e => updateItem(key, idx, 'name', e.target.value)}
            />
            <div className="w-20">
              <input 
                type="number"
                className="w-full border p-1 rounded text-sm text-center"
                placeholder="Peso"
                value={item.weight}
                onChange={e => updateItem(key, idx, 'weight', e.target.value)}
                title="Peso do critério"
              />
            </div>
            <button onClick={() => removeItem(key, idx)} className="text-red-500 hover:bg-red-100 p-1 rounded">
              <Trash2 size={14}/>
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b pb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Configuração da Avaliação</h2>
          <p className="text-sm text-gray-500">Defina o que será avaliado nesta vaga.</p>
        </div>
        
        {/* Importador Rápido */}
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
          
          {/* Configuração de Notas */}
          <div className="bg-gray-50 p-4 rounded border">
            <h3 className="font-bold uppercase text-sm text-gray-600 mb-3">Régua de Notas</h3>
            <p className="text-xs text-gray-500 mb-3">Defina os valores que compõem a média.</p>
            {params.notas.map((nota, idx) => (
              <div key={idx} className="flex gap-2 items-center mb-2">
                <input 
                  className="flex-1 border p-1 rounded text-sm"
                  value={nota.nome}
                  onChange={e => {
                    const newNotas = [...params.notas];
                    newNotas[idx].nome = e.target.value;
                    setParams({...params, notas: newNotas});
                  }}
                />
                <input 
                  type="number"
                  className="w-20 border p-1 rounded text-sm text-center"
                  value={nota.valor}
                  onChange={e => {
                    const newNotas = [...params.notas];
                    newNotas[idx].valor = e.target.value;
                    setParams({...params, notas: newNotas});
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t">
        <button 
          onClick={handleSave} 
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded flex items-center gap-2 hover:bg-blue-700"
        >
          <Save size={18}/> {loading ? 'Salvando...' : 'Salvar Configuração'}
        </button>
      </div>
    </div>
  );
}