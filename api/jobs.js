import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    // 1. Autenticação
    const authHeader = request.headers['authorization'];
    if (!authHeader) throw new Error('Token ausente.');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) throw new Error('Token inválido.');

    // 2. Busca Dados do Usuário e Perfil (JOIN correto)
    // A tabela 'users' do Auth não tem relação direta FK com public.tenants em alguns setups,
    // mas 'user_profiles' (public) costuma ter. Vamos garantir os dados daqui.
    const { data: profile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('name, tenantId, is_admin_system, tenants(companyName, planId)')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
        console.error("Erro Perfil:", profileError);
        throw new Error('Perfil de usuário não encontrado.');
    }

    const tenantId = profile.tenantId;
    const companyName = profile.tenants?.companyName || 'Empresa';
    const planId = profile.tenants?.planId || 'free';

    // --- GET: Dashboard & Vagas ---
    if (request.method === 'GET') {
        const { id } = request.query;

        // Detalhe Único (Com JOIN limpo)
        if (id) {
            const { data: job, error } = await supabaseAdmin
                .from('jobs')
                .select(`
                    *,
                    company_departments ( id, name )
                `)
                .eq('id', Number(id))
                .eq('tenantId', tenantId)
                .single();
            
            if (error) throw error;
            return response.status(200).json({ job });
        }

        // Lista Completa (Com JOIN limpo e Contagem)
        const { data: jobs, error: jobsError } = await supabaseAdmin
            .from('jobs')
            .select(`
                id, title, status, created_at,
                description, requirements, type, location_type,
                company_department_id,
                company_departments ( name ),
                applications ( count )
            `)
            .eq('tenantId', tenantId);

        if (jobsError) throw jobsError;

        // Formatação (Flattening para facilitar o front)
        const formattedJobs = jobs.map(job => ({
            ...job,
            candidateCount: job.applications?.[0]?.count || 0,
            deptName: job.company_departments?.name || 'Geral'
        })).sort((a, b) => {
            // Ordenação: Departamento (A-Z) -> Data (Desc)
            const deptCompare = a.deptName.localeCompare(b.deptName);
            if (deptCompare !== 0) return deptCompare;
            return new Date(b.created_at) - new Date(a.created_at);
        });

        return response.status(200).json({
            jobs: formattedJobs,
            meta: {
                companyName: companyName,
                userName: profile.name,
                planId: planId,
                isAdmin: profile.is_admin_system
            }
        });
    }

    // --- POST: Manter Lógica de Escrita ---
    if (request.method === 'POST') {
         const { action, jobId, newStatus } = request.body;
         
         if (action === 'updateJobStatus') {
            await supabaseAdmin.from('jobs').update({ status: newStatus }).eq('id', jobId).eq('tenantId', tenantId);
            return response.status(200).json({ message: 'Atualizado' });
         }
         if (action === 'deleteJob') {
            await supabaseAdmin.from('applications').delete().eq('jobId', jobId);
            await supabaseAdmin.from('jobs').delete().eq('id', jobId).eq('tenantId', tenantId);
            return response.status(200).json({ message: 'Deletado' });
         }
    }

    return response.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('API Error:', error.message);
    return response.status(500).json({ error: error.message });
  }
}