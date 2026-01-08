// api/createJob.js (VERSÃO FINAL COM CANDIDATO IDEAL AUTOMÁTICO)
import { createClient } from '@supabase/supabase-js';

// Função auxiliar para gerar gabarito central (mesma lógica do front)
const generateBenchmarkScores = (parameters) => {
    const notes = parameters.notas || [];
    if (notes.length === 0) return { triagem: {}, cultura: {}, tecnico: {} };
    
    // Ordena e pega o centro
    const sortedNotes = [...notes].sort((a, b) => Number(a.valor) - Number(b.valor));
    const centerIndex = Math.floor(sortedNotes.length / 2);
    const centerNoteId = sortedNotes[centerIndex]?.id;

    const benchmark = { triagem: {}, cultura: {}, tecnico: {} };
    ['triagem', 'cultura', 'tecnico'].forEach(sec => {
        (parameters[sec] || []).forEach(c => {
            benchmark[sec][c.name] = centerNoteId;
        });
    });
    return benchmark;
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', ['POST']);
    return response.status(405).json({ error: `Método ${request.method} não permitido.` });
  }

  try {
    const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    
    // 1. Auth e Tenant
    const authHeader = request.headers['authorization'];
    if (!authHeader) return response.status(401).json({ error: 'Não autorizado.' });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) return response.status(401).json({ error: 'Token inválido.' });
    
    const { data: userData } = await supabaseAdmin.from('users').select('tenantId').eq('id', user.id).single();
    if (!userData) return response.status(404).json({ error: 'Perfil não encontrado.' });
    const tenantId = userData.tenantId;

    // 2. Validação de Limite (Lógica Original Mantida)
    const { data: tenant } = await supabaseAdmin.from('tenants').select('plan:plans(id, job_limit)').eq('id', tenantId).single();
    const job_limit = tenant.plan.job_limit;
    if (job_limit !== -1) {
      const { count } = await supabaseAdmin.from('jobs').select('*', { count: 'exact', head: true }).eq('tenantId', tenantId).eq('status', 'active');
      if (count >= job_limit) return response.status(403).json({ error: `Limite de ${job_limit} vagas atingido.` });
    }

    // 3. Criação da Vaga
    const { title, description, requirements, type, location_type, company_department_id } = request.body;
    if (!title) return response.status(400).json({ error: 'Título obrigatório.' });
    
    const parameters = { 
        triagem: [], cultura: [], tecnico: [], 
        notas: [{id:'1',nome:'Abaixo',valor:0}, {id:'2',nome:'Atende',valor:5}, {id:'3',nome:'Supera',valor:10}] 
    };

    const { data: newJob, error: insertError } = await supabaseAdmin
      .from('jobs')
      .insert({
        title, tenantId, status: 'active', description: description || '', requirements: requirements || '',
        type: type || 'CLT', location_type: location_type || 'Híbrido',
        company_department_id: company_department_id ? parseInt(company_department_id) : null,
        parameters
      })
      .select().single();
      
    if (insertError) throw insertError;

    // 4. CRIAÇÃO AUTOMÁTICA DO CANDIDATO IDEAL (BENCHMARK)
    const idealEmail = `benchmark_${newJob.id}@novva.app`;
    
    // 4a. Cria Candidato
    const { data: cand } = await supabaseAdmin.from('candidates').upsert(
        { name: 'Candidato Ideal (Referência)', email: idealEmail, city: 'N/A', state: 'N/A' }, 
        { onConflict: 'email' }
    ).select().single();

    // 4b. Cria Aplicação (Status = benchmark)
    const { data: app } = await supabaseAdmin.from('applications').insert({
        jobId: newJob.id,
        candidateId: cand.id,
        status: 'benchmark', // Flag para identificar
        isHired: false
    }).select().single();

    // 4c. Cria Avaliação Inicial (Centro da Régua)
    const defaultScores = generateBenchmarkScores(parameters);
    await supabaseAdmin.from('evaluations').insert({
        application_id: app.id,
        evaluator_id: user.id,
        scores: defaultScores,
        final_score: 5, // Nota média padrão
        notes: 'Gabarito inicial gerado pelo sistema.'
    });
    
    return response.status(201).json({ newJob });

  } catch (error) {
    console.error("Erro createJob:", error);
    return response.status(500).json({ error: 'Erro interno.', details: error.message });
  }
}