// api/jobs.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    // 1. Autenticação Admin (Bypassa RLS)
    const authHeader = request.headers['authorization'];
    if (!authHeader) throw new Error('Token ausente.');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) throw new Error('Token inválido.');

    // 2. Busca Tenant do Usuário
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('tenantId, name, isAdmin')
      .eq('id', user.id)
      .single();
      
    if (!userData?.tenantId) throw new Error('Usuário sem empresa vinculada.');
    const tenantId = userData.tenantId;

    if (request.method === 'GET') {
        const { id } = request.query;

        // Detalhes da Vaga
        if (id) {
            const { data: job, error } = await supabaseAdmin
                .from('jobs')
                .select(`*, company_departments ( id, name )`) // Join com Dept
                .eq('id', Number(id))
                .eq('tenantId', tenantId)
                .single();
            
            if (error) throw error;
            return response.status(200).json({ job });
        }

        // Dashboard (Lista)
        const { data: tenant } = await supabaseAdmin
            .from('tenants')
            .select('companyName, planId')
            .eq('id', tenantId)
            .single();

        const { data: jobs, error: jobsError } = await supabaseAdmin
            .from('jobs')
            .select(`
                id, title, status, created_at,
                description, requirements, type, location_type,
                applications ( count ),
                company_departments ( name )
            `)
            .eq('tenantId', tenantId);

        if (jobsError) throw jobsError;

        // Processamento (Flattening)
        const formattedJobs = jobs.map(job => ({
            ...job,
            candidateCount: job.applications?.[0]?.count || 0,
            // Garante que deptName exista mesmo que seja null
            deptName: job.company_departments?.name || 'Geral' 
        })).sort((a, b) => {
            // Regra 5: Ordem Alfabética de Área -> Data de Criação
            const deptCompare = a.deptName.localeCompare(b.deptName);
            if (deptCompare !== 0) return deptCompare;
            return new Date(b.created_at) - new Date(a.created_at);
        });

        return response.status(200).json({
            jobs: formattedJobs,
            meta: {
                companyName: tenant.companyName,
                userName: userData.name || user.email,
                planId: tenant.planId,
                isAdmin: userData.isAdmin
            }
        });
    }

    // POST (Criar/Atualizar/Deletar) - Mantido simplificado para brevidade
    // ... (Seu código de POST anterior estava correto, mantenha-o ou me peça se precisar)
    
    return response.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('API Error:', error);
    return response.status(500).json({ error: error.message });
  }
}