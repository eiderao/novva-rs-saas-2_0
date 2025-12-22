import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  // Configuração do cliente
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    // 1. Autenticação e Identificação do Usuário
    const authHeader = request.headers['authorization'];
    if (!authHeader) throw new Error('Token de autorização ausente.');
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) throw new Error('Token inválido ou expirado.');

    // 2. Busca o Tenant ID na tabela 'users' (Conforme seus metadados: id, email, tenantId)
    // ATENÇÃO: NÃO buscamos 'name' aqui pois a coluna não existe.
    const { data: userData, error: dbError } = await supabaseAdmin
      .from('users')
      .select('tenantId, email, isAdmin') 
      .eq('id', user.id)
      .single();

    if (dbError || !userData?.tenantId) {
        console.error("Erro ao buscar usuário:", dbError);
        throw new Error('Usuário sem empresa vinculada.');
    }
    
    const tenantId = userData.tenantId;

    // 3. Busca o Nome do Usuário na tabela 'user_profiles' (Onde ele realmente está)
    let userName = userData.email; // Fallback seguro
    const { data: userProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('name')
        .eq('id', user.id)
        .single();
    
    if (userProfile?.name) {
        userName = userProfile.name;
    }

    // --- LÓGICA DE GET (Leitura) ---
    if (request.method === 'GET') {
        const { id } = request.query;

        // CENÁRIO A: Detalhes de uma Vaga Específica
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

        // CENÁRIO B: Dashboard e Lista de Vagas
        // 1. Busca Dados da Empresa
        const { data: tenant } = await supabaseAdmin
            .from('tenants')
            .select('companyName, planId')
            .eq('id', tenantId)
            .single();

        // 2. Busca Vagas com seus Departamentos
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

        // 3. Processa os dados para o Frontend
        const formattedJobs = (jobs || []).map(job => ({
            ...job,
            candidateCount: job.applications?.[0]?.count || 0,
            // Tratamento seguro para departamento nulo
            deptName: job.company_departments?.name || 'Geral' 
        })).sort((a, b) => {
            // Ordenação: Departamento (A-Z) -> Data (Mais recente primeiro)
            const deptCompare = a.deptName.localeCompare(b.deptName);
            if (deptCompare !== 0) return deptCompare;
            return new Date(b.created_at) - new Date(a.created_at);
        });

        return response.status(200).json({
            jobs: formattedJobs,
            meta: {
                companyName: tenant?.companyName || 'Minha Empresa',
                userName: userName,
                planId: tenant?.planId || 'Plano',
                isAdmin: userData.isAdmin
            }
        });
    }

    // --- LÓGICA DE POST (Escrita) ---
    if (request.method === 'POST') {
         const { action, jobId, newStatus } = request.body;
         
         if (action === 'updateJobStatus') {
            const { error } = await supabaseAdmin
                .from('jobs')
                .update({ status: newStatus })
                .eq('id', jobId)
                .eq('tenantId', tenantId);
            if (error) throw error;
            return response.status(200).json({ message: 'Status atualizado' });
         }
         
         if (action === 'deleteJob') {
            // Remove dependências primeiro
            await supabaseAdmin.from('applications').delete().eq('jobId', jobId);
            const { error } = await supabaseAdmin
                .from('jobs')
                .delete()
                .eq('id', jobId)
                .eq('tenantId', tenantId);
            if (error) throw error;
            return response.status(200).json({ message: 'Vaga excluída' });
         }
    }

    return response.status(405).json({ error: 'Método não permitido' });

  } catch (error) {
    console.error('API Error:', error.message);
    // Retorna erro estruturado para o frontend exibir (ao invés de tela branca)
    return response.status(500).json({ 
        error: 'Erro interno no servidor', 
        details: error.message 
    });
  }
}