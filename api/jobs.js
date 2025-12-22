// api/jobs.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    const authHeader = request.headers['authorization'];
    if (!authHeader) throw new Error('Token ausente.');
    const token = authHeader.replace('Bearer ', '');
    
    // 1. Valida Usuário
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) throw new Error('Token inválido.');

    // 2. Busca Perfil Correto (CORREÇÃO: Usando user_profiles para pegar o nome)
    // Seus metadados mostram que 'users' não tem 'name', mas 'user_profiles' tem.
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('tenantId, name, is_admin_system') // Ajustado conforme metadados
      .eq('id', user.id)
      .single();

    // Fallback: Se não achar perfil, tenta pegar tenantId direto de users (se existir lá conforme alguns esquemas legados)
    // Mas vamos confiar no user_profiles conforme sua estrutura V2.
    if (profileError || !userProfile) {
        console.error("Erro perfil:", profileError);
        throw new Error('Perfil de usuário não encontrado.');
    }
    
    const tenantId = userProfile.tenantId;

    if (request.method === 'GET') {
        const { id } = request.query;

        // Detalhes da Vaga
        if (id) {
            const { data: job, error } = await supabaseAdmin
                .from('jobs')
                .select(`*, company_departments ( id, name )`)
                .eq('id', Number(id))
                .eq('tenantId', tenantId) // Garantia de segurança
                .single();
            
            if (error) throw error;
            return response.status(200).json({ job });
        }

        // Dashboard (Lista Completa)
        // 1. Busca Tenant
        const { data: tenant } = await supabaseAdmin
            .from('tenants')
            .select('companyName, planId')
            .eq('id', tenantId)
            .single();

        // 2. Busca Vagas
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

        // 3. Formatação
        const formattedJobs = jobs.map(job => ({
            ...job,
            candidateCount: job.applications?.[0]?.count || 0,
            deptName: job.company_departments?.name || 'Geral'
        })).sort((a, b) => {
            // Ordenação: Departamento -> Data
            const deptCompare = a.deptName.localeCompare(b.deptName);
            if (deptCompare !== 0) return deptCompare;
            return new Date(b.created_at) - new Date(a.created_at);
        });

        return response.status(200).json({
            jobs: formattedJobs,
            meta: {
                companyName: tenant?.companyName || 'Empresa',
                userName: userProfile.name || user.email, // Usa o nome do user_profiles
                planId: tenant?.planId || 'free',
                isAdmin: userProfile.is_admin_system
            }
        });
    }

    // POST mantido (sem alterações)
    return response.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('API Error:', error);
    return response.status(500).json({ error: error.message });
  }
}