// api/jobs.js (VERSÃO FINAL - CENTRALIZADA)
import { createClient } from '@supabase/supabase-js';

async function validateUser(request) {
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  
  const authHeader = request.headers['authorization'];
  if (!authHeader) throw new Error('Token de autorização ausente.');
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  
  if (userError || !user) throw new Error('Token inválido ou expirado.');
  
  // Busca dados completos do usuário, incluindo tenantId
  const { data: userData, error: profileError } = await supabaseAdmin
    .from('users')
    .select('id, tenantId, name, isAdmin')
    .eq('id', user.id)
    .single();
    
  if (profileError || !userData) throw new Error('Perfil de usuário não encontrado.');
  
  return { supabaseAdmin, user, userData };
}

export default async function handler(request, response) {
  try {
    const { supabaseAdmin, userData } = await validateUser(request);
    const tenantId = userData.tenantId;

    // --- GET: Dashboard e Detalhes ---
    if (request.method === 'GET') {
      const { id } = request.query;

      // CENÁRIO 1: Detalhes de UMA vaga
      if (id) {
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
      
      // CENÁRIO 2: Dashboard Completo (Vagas + Metadados do Header)
      else {
        // 1. Busca Dados da Empresa e Plano
        const { data: tenant, error: tenantError } = await supabaseAdmin
            .from('tenants')
            .select('companyName, planId')
            .eq('id', tenantId)
            .single();
            
        if (tenantError) throw tenantError;

        // 2. Busca Vagas com Departamentos e Contagem
        // Nota: Ajuste o select se "company_departments" for o nome exato da relação
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
        
        // 3. Processamento e Ordenação
        const formattedJobs = (jobs || []).map(job => ({ 
            ...job, 
            candidateCount: job.applications && job.applications[0] ? job.applications[0].count : 0,
            deptName: job.company_departments?.name || 'Geral'
        })).sort((a, b) => {
            // Ordena por Departamento (A-Z) depois por Data (Recente)
            const deptCompare = a.deptName.localeCompare(b.deptName);
            if (deptCompare !== 0) return deptCompare;
            return new Date(b.created_at) - new Date(a.created_at);
        });

        // RETORNO UNIFICADO (Payload completo para o Dashboard)
        return response.status(200).json({ 
          jobs: formattedJobs,
          meta: {
              planId: tenant.planId,
              companyName: tenant.companyName,
              userName: userData.name || userData.email || 'Usuário',
              isAdmin: userData.isAdmin
          }
        });
      }
    }

    // --- POST: Ações de Escrita ---
    if (request.method === 'POST') {
        const { action, jobId, newStatus } = request.body;

        if (action === 'updateJobStatus') {
            const { data, error } = await supabaseAdmin
                .from('jobs')
                .update({ status: newStatus })
                .eq('id', jobId)
                .eq('tenantId', tenantId) // Segurança extra
                .select()
                .single();
            if (error) throw error;
            return response.status(200).json({ message: 'Status atualizado!', updatedJob: data });
        }

        if (action === 'deleteJob') {
            await supabaseAdmin.from('applications').delete().eq('jobId', jobId);
            const { error } = await supabaseAdmin.from('jobs').delete().eq('id', jobId).eq('tenantId', tenantId);
            if (error) throw error;
            return response.status(200).json({ message: 'Vaga excluída.' });
        }
    }

    return response.status(405).json({ error: 'Método não permitido.' });

  } catch (error) {
    console.error("Erro na API Jobs:", error.message);
    // Retorna 500 mas com mensagem clara para o frontend
    return response.status(500).json({ 
        error: 'Erro ao carregar dados.', 
        details: error.message 
    });
  }
}