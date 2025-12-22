// api/jobs.js (VERSÃO V2.0 - Com Filtros de Departamento e Ordenação)
import { createClient } from '@supabase/supabase-js';

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

export default async function handler(request, response) {
  try {
    const { supabaseAdmin, userData } = await validateUser(request);
    const tenantId = userData.tenantId;

    // --- GET: Listar ou Detalhar ---
    if (request.method === 'GET') {
      const { id } = request.query;

      if (id) {
        // Detalhes da Vaga (trazendo todos os campos novos)
        const { data: job, error: jobError } = await supabaseAdmin
            .from('jobs')
            .select(`
                *,
                company_departments ( id, name )
            `)
            .eq('id', Number(id))
            .eq('tenantId', tenantId)
            .single();

        if (jobError || !job) return response.status(404).json({ error: 'Vaga não encontrada.' });
        return response.status(200).json({ job });
      } 
      else {
        // Dashboard: Lista de Vagas
        const { data: tenant, error: tenantError } = await supabaseAdmin.from('tenants').select('planId').eq('id', tenantId).single();
        if (tenantError) throw tenantError;

        // REGRA 5: Buscar vagas com nome do departamento
        let query = supabaseAdmin
            .from('jobs')
            .select(`
                id, title, status, tenantId, created_at,
                description, requirements, type, location_type,
                applications ( count ),
                company_departments ( name )
            `)
            .eq('tenantId', tenantId);

        const { data: jobs, error: jobsError } = await query;
        if (jobsError) throw jobsError;
        
        // Formatação e Ordenação no JS (para garantir a regra composta)
        // Regra: Ordem alfabética de Departamento -> Depois Data de Criação
        const formattedJobs = jobs.map(job => ({ 
            ...job, 
            candidateCount: job.applications[0] ? job.applications[0].count : 0,
            deptName: job.company_departments?.name || 'Geral' // Fallback se null
        })).sort((a, b) => {
            // 1. Por Departamento (A-Z)
            const deptCompare = a.deptName.localeCompare(b.deptName);
            if (deptCompare !== 0) return deptCompare;
            
            // 2. Por Data (Mais recentes primeiro)
            return new Date(b.created_at) - new Date(a.created_at);
        });

        return response.status(200).json({ 
          jobs: formattedJobs,
          planId: tenant.planId,
          isAdmin: userData.isAdmin
        });
      }
    }

    // --- POST: Criar, Atualizar, Deletar ---
    if (request.method === 'POST') {
      const { action, jobId, newStatus } = request.body;

      switch (action) {
        case 'updateJobStatus':
          if (!jobId || !newStatus) return response.status(400).json({ error: 'Dados incompletos.' });
          
          const { data: updatedJob, error: updateError } = await supabaseAdmin
            .from('jobs')
            .update({ status: newStatus })
            .eq('id', jobId)
            .eq('tenantId', tenantId)
            .select()
            .single();
            
          if (updateError) throw updateError;
          return response.status(200).json({ message: 'Status atualizado!', updatedJob });

        case 'deleteJob':
          if (!jobId) return response.status(400).json({ error: 'jobId obrigatório.' });

          // Deleta candidaturas e avaliações em cascata (Via DB ou aqui por segurança)
          await supabaseAdmin.from('applications').delete().eq('jobId', jobId);
          
          const { error: deleteError } = await supabaseAdmin
            .from('jobs')
            .delete()
            .eq('id', jobId)
            .eq('tenantId', tenantId);
            
          if (deleteError) throw deleteError;
          return response.status(200).json({ message: 'Vaga excluída com sucesso!' });

        default:
          return response.status(400).json({ error: 'Ação desconhecida.' });
      }
    }

    response.setHeader('Allow', ['GET', 'POST']);
    return response.status(405).json({ error: `Método ${request.method} não permitido.` });

  } catch (error) {
    console.error("Erro API Jobs:", error.message);
    return response.status(500).json({ error: 'Erro interno do servidor.', details: error.message });
  }
}