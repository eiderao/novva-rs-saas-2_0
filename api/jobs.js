// api/jobs.js (VERSÃO FINAL com Join de Áreas)
import { createClient } from '@supabase/supabase-js';

// Função de middleware de segurança (reutilizada)
async function validateUser(request) {
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const authHeader = request.headers['authorization'];
  if (!authHeader) throw new Error('Não autorizado.');
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError) throw new Error('Token inválido.');

  const { data: userData } = await supabaseAdmin.from('users').select('tenantId, isAdmin').eq('id', user.id).single();
  if (!userData) throw new Error('Perfil de usuário não encontrado.');
  
  return { supabaseAdmin, user, userData };
}

// Handler principal
export default async function handler(request, response) {
  try {
    const { supabaseAdmin, userData } = await validateUser(request);
    const tenantId = userData.tenantId;

    // --- LÓGICA DE REQUISIÇÃO GET (LEITURA) ---
    if (request.method === 'GET') {
      const { id } = request.query;

      if (id) {
        // Busca UMA vaga (Detalhes)
        // Incluindo o nome do departamento aqui também
        const { data: job, error: jobError } = await supabaseAdmin
            .from('jobs')
            .select(`
                *,
                company_departments ( name )
            `)
            .eq('id', Number(id))
            .eq('tenantId', tenantId)
            .single();

        if (jobError || !job) return response.status(404).json({ error: 'Vaga não encontrada.' });
        return response.status(200).json({ job });
      } 
      else {
        // Busca TODAS as vagas (Dashboard)
        const { data: tenant, error: tenantError } = await supabaseAdmin.from('tenants').select('planId').eq('id', tenantId).single();
        if (tenantError) throw tenantError;

        // --- MUDANÇA AQUI: Trazendo o nome do departamento ---
        const { data: jobs, error: jobsError } = await supabaseAdmin
            .from('jobs')
            .select(`
                id, title, status, tenantId, created_at,
                applications ( count ),
                company_departments ( name )
            `)
            .eq('tenantId', tenantId);

        if (jobsError) throw jobsError;
        
        const formattedJobs = jobs.map(job => ({ 
            ...job, 
            candidateCount: job.applications[0] ? job.applications[0].count : 0 
        }));
        
        return response.status(200).json({ 
          jobs: formattedJobs,
          planId: tenant.planId,
          isAdmin: userData.isAdmin
        });
      }
    }

    // --- LÓGICA DE REQUISIÇÃO POST (ATUALIZAR/DELETAR) ---
    if (request.method === 'POST') {
      const { action, jobId, newStatus } = request.body;

      switch (action) {
        case 'updateJobStatus':
          if (!jobId || !newStatus) { return response.status(400).json({ error: 'jobId e newStatus são obrigatórios.' }); }
          
          const { data: updatedJob, error: updateError } = await supabaseAdmin
            .from('jobs')
            .update({ status: newStatus })
            .eq('id', jobId)
            .eq('tenantId', tenantId) // Segurança
            .select()
            .single();
          
          if (updateError) throw updateError;
          return response.status(200).json({ message: 'Status atualizado!', updatedJob });

        case 'deleteJob':
          if (!jobId) { return response.status(400).json({ error: 'jobId é obrigatório.' }); }

          // 1. (Segurança) Deleta as candidaturas
          await supabaseAdmin.from('applications').delete().eq('jobId', jobId);

          // 2. Deleta a vaga
          const { error: deleteError } = await supabaseAdmin
            .from('jobs')
            .delete()
            .eq('id', jobId)
            .eq('tenantId', tenantId); // Segurança
            
          if (deleteError) throw deleteError;
          return response.status(200).json({ message: 'Vaga excluída com sucesso!' });

        default:
          return response.status(400).json({ error: 'Ação POST desconhecida.' });
      }
    }

    response.setHeader('Allow', ['GET', 'POST']);
    return response.status(405).json({ error: `Método ${request.method} não permitido.` });

  } catch (error) {
    console.error("Erro na API de Vagas:", error.message);
    if (error.message.includes('Não autorizado') || error.message.includes('Token inválido')) {
      return response.status(401).json({ error: error.message });
    }
    return response.status(500).json({ error: 'Erro interno do servidor.', details: error.message });
  }
}