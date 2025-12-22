import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    // 1. Auth
    const authHeader = request.headers['authorization'];
    if (!authHeader) throw new Error('Token ausente.');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) throw new Error('Token inválido.');

    // 2. Busca Dados do Usuário (SEM buscar 'name' que não existe em users)
    const { data: userData, error: dbError } = await supabaseAdmin
      .from('users')
      .select('tenantId, isAdmin, email') // Removido 'name' para evitar erro
      .eq('id', user.id)
      .single();

    if (dbError || !userData?.tenantId) throw new Error('Usuário sem empresa vinculada.');
    
    const tenantId = userData.tenantId;

    // 3. Tenta buscar o nome em user_profiles (Opcional)
    let userName = userData.email;
    try {
        const { data: profile } = await supabaseAdmin
            .from('user_profiles')
            .select('name')
            .eq('id', user.id)
            .single();
        if (profile?.name) userName = profile.name;
    } catch (e) { /* Ignora se não tiver perfil */ }

    if (request.method === 'GET') {
        const { id } = request.query;

        // Detalhe da Vaga
        if (id) {
            const { data: job, error } = await supabaseAdmin
                .from('jobs')
                .select(`*, company_departments ( id, name )`)
                .eq('id', Number(id))
                .eq('tenantId', tenantId)
                .single();
            
            if (error) throw error;
            return response.status(200).json({ job });
        }

        // Dashboard Lista
        // A. Busca Empresa e Plano
        const { data: tenant } = await supabaseAdmin
            .from('tenants')
            .select('companyName, planId')
            .eq('id', tenantId)
            .single();

        // B. Busca Vagas
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

        // C. Formatação
        const formattedJobs = (jobs || []).map(job => ({
            ...job,
            candidateCount: job.applications?.[0]?.count || 0,
            deptName: job.company_departments?.name || 'Geral'
        })).sort((a, b) => {
            // Regra 5: Depto (A-Z) -> Data (Desc)
            const deptCompare = a.deptName.localeCompare(b.deptName);
            if (deptCompare !== 0) return deptCompare;
            return new Date(b.created_at) - new Date(a.created_at);
        });

        return response.status(200).json({
            jobs: formattedJobs,
            meta: {
                companyName: tenant?.companyName || 'Empresa',
                userName: userName,
                planId: tenant?.planId || 'free',
                isAdmin: userData.isAdmin
            }
        });
    }

    // MÉTODOS POST (Manter lógica existente de update/delete)
    // ... (Seu código POST anterior estava correto para update/delete)
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
    console.error('API Error:', error);
    // Retorna erro JSON válido para o front não ficar "loading" pra sempre
    return response.status(500).json({ error: error.message });
  }
}