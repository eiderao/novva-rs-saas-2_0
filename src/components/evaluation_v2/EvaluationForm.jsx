import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Loader2, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../../supabase/client';

export default function EvaluationForm({ applicationId, jobParameters, initialData, onSaved }) {
  const [scores, setScores] = useState(initialData?.scores || {});
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', msg: '' });

  const sections = [
    { id: 'triagem', label: 'Triagem', color: 'text-purple-700' },
    { id: 'cultura', label: 'Fit Cultural', color: 'text-green-700' },
    { id: 'tecnico', label: 'Técnico', color: 'text-blue-700' }
  ];

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback({ type: '', msg: '' });
    
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Sessão perdida.");

        const response = await fetch('/api/saveEvaluation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ applicationId, scores, notes })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Erro ao salvar.");

        setFeedback({ type: 'success', msg: `Salvo! Sua nota: ${data.score}` });
        if (onSaved) onSaved(); 

    } catch (err) {
        setFeedback({ type: 'error', msg: err.message });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 bg-white p-6 rounded-lg border shadow-sm">
        {sections.map(section => {
            const criteriaList = jobParameters[section.id] || [];
            if (criteriaList.length === 0) return null;

            return (
                <div key={section.id} className="p-4 bg-gray-50 rounded-md border">
                    <h3 className={`font-bold mb-3 ${section.color}`}>{section.label}</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                        {criteriaList.map((crit, idx) => (
                            <div key={idx}>
                                <Label className="text-xs uppercase text-gray-500">{crit.name}</Label>
                                <select 
                                    className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:ring-2 focus:ring-blue-600"
                                    value={scores[section.id]?.[crit.name] || ''}
                                    onChange={(e) => setScores({
                                        ...scores, 
                                        [section.id]: { ...scores[section.id], [crit.name]: e.target.value }
                                    })}
                                >
                                    <option value="">Selecione...</option>
                                    <option value="NA" className="font-bold text-gray-500">N/A (Não Avaliar)</option>
                                    <hr/>
                                    {jobParameters.notas.map(n => (
                                        <option key={n.id} value={n.id}>{n.nome} ({n.valor})</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                </div>
            );
        })}

        <div>
            <Label>Observações</Label>
            <Textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder="Comentários sobre o candidato..." 
                rows={4}
            />
        </div>

        {feedback.msg && (
            <div className={`p-3 rounded text-sm flex items-center gap-2 ${feedback.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {feedback.type === 'error' ? <AlertCircle className="w-4 h-4"/> : <Save className="w-4 h-4"/>}
                {feedback.msg}
            </div>
        )}

        <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Salvar Avaliação'}
            </Button>
        </div>
    </div>
  );
}