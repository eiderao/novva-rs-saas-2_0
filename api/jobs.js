import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  // Usa a chave de serviço para ter acesso TOTAL (ignora RLS e permissões)
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    // 1. Autenticação Básica
    const authHeader = request.headers['authorization'];
    if (!authHeader) throw new Error('Token ausente.');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) throw new Error('Token inválido.');

    // 2. Busca o Perfil para pegar o Tenant ID correto
    const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('tenantId, name, is_admin_system')
        .eq('id', user.id)
        .single();

    if (!profile || !profile.tenantId) {
        throw new Error('Perfil de usuário não encontrado ou sem empresa.');
    }

    const tenantId = profile.tenantId;

    if (request.method === 'GET') {
        const { id } = request.query;

        // --- BUSCAS SEPARADAS (BLINDAGEM CONTRA ERRO DE TIPOS) ---

        // A. Busca Dados da Empresa
        const { data: tenant } = await supabaseAdmin
            .from('tenants')
            .select('companyName, planId')
            .eq('id', tenantId)
            .single();

        // B. Busca TODAS as Vagas deste Tenant
        const { data: jobs, error: jobsError } = await supabaseAdmin
            .from('jobs')
            .select('*') // Pega tudo, sem tentar join quebrado
            .eq('tenantId', tenantId);

        if (jobsError) throw jobsError;

        // C. Busca TODOS os Departamentos deste Tenant
        // (Aqui resolvemos o problema: O banco pode ter salvo como texto ou uuid, pegamos por string)
        const { data: departments } = await supabaseAdmin
            .from('company_departments')
            .select('id, name, tenantId'); 
            // Filtramos no código abaixo para garantir, caso o tipo no banco impeça o .eq()

        // D. Busca Contagem de Candidatos
        // Fazemos uma query raw ou agrupada para evitar join complexo
        const { data: applications } = await supabaseAdmin
            .from('applications')
            .select('jobId');

        // --- MONTAGEM DOS DADOS (MANUAL JOIN) ---
        
        // 1. Mapa de Contagem de Candidatos
        const candidateCounts = {};
        applications.forEach(app => {
            candidateCounts[app.jobId] = (candidateCounts[app.jobId] || 0) + 1;
        });

        // 2. Mapa de Departamentos (ID -> Nome)
        const deptMap = {};
        if (departments) {
            departments.forEach(d => {
                // Normaliza para string para garantir o match
                if (String(d.tenantId) === String(tenantId)) {
                    deptMap[d.id] = d.name;
                }
            });
        }

        // 3. Monta o Objeto Final para o Dashboard
        let formattedJobs = jobs.map(job => ({
            id: job.id,
            title: job.title,
            status: job.status,
            created_at: job.created_at,
            type: job.type,
            location_type: job.location_type,
            candidateCount: candidateCounts[job.id] || 0,
            // Aqui fazemos o vínculo manual que o banco estava recusando
            deptName: deptMap[job.company_department_id] || 'Geral'
        }));

        // 4. Ordenação
        formattedJobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Se for detalhe de uma vaga específica
        if (id) {
            const specificJob = formattedJobs.find(j => j.id == id); // == para aceitar string/number
            if (!specificJob) return response.status(404).json({ error: 'Vaga não encontrada.' });
            
            // Adiciona campos extras necessários para a tela de detalhes
            const rawJob = jobs.find(j => j.id == id);
            specificJob.description = rawJob.description;
            specificJob.requirements = rawJob.requirements;
            specificJob.parameters = rawJob.parameters;
            
            return response.status(200).json({ job: specificJob });
        }

        return response.status(200).json({
            jobs: formattedJobs,
            meta: {
                companyName: tenant?.companyName || 'Minha Empresa',
                userName: profile.name || user.email,
                planId: tenant?.planId || 'free',
                isAdmin: profile.is_admin_system
            }
        });
    }

    // POST (Escrita) - Mantido simples e direto
    if (request.method === 'POST') {
         const { action, jobId, newStatus } = request.body;
         
         if (action === 'updateJobStatus') {
            await supabaseAdmin.from('jobs').update({ status: newStatus }).eq('id', jobId);
            return response.status(200).json({ message: 'Atualizado' });
         }
         if (action === 'deleteJob') {
            await supabaseAdmin.from('applications').delete().eq('jobId', jobId);
            await supabaseAdmin.from('jobs').delete().eq('id', jobId);
            return response.status(200).json({ message: 'Deletado' });
         }
    }

    return response.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('API Error:', error.message);
    return response.status(500).json({ error: error.message });
  }
}