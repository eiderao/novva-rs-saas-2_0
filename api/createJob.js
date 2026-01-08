import { createClient } from '@supabase/supabase-js';

// Função auxiliar para gerar gabarito central (Regra: Item central da régua de notas)
const generateBenchmarkScores = (parameters) => {
    const notes = parameters.notas || [];
    if (notes.length === 0) return { triagem: {}, cultura: {}, tecnico: {} };
    
    // Ordena as notas por valor para encontrar o centro corretamente
    const sortedNotes = [...notes].sort((a, b) => Number(a.valor) - Number(b.valor));
    
    // Pega o índice central. 
    // Se a lista for par (ex: 4 itens), pega o índice 2 (o 3º item, levemente acima do meio).
    // Se ímpar (ex: 3 itens), pega o índice 1 (o 2º item, exatamente o meio).
    const centerIndex = Math.floor(sortedNotes.length / 2);
    const centerNoteId = sortedNotes[centerIndex]?.id;

    const benchmark = { triagem: {}, cultura: {}, tecnico: {} };

    // Preenche todos os critérios com a nota central
    ['triagem', 'cultura', 'tecnico'].forEach(sec => {
        (parameters[sec] || []).forEach(c => {
            // Garante que a seção existe no objeto
            if (!benchmark[sec]) benchmark[sec] = {};
            benchmark[sec][c.name] = centerNoteId;
        });
    });

    return benchmark;
};

export default async function handler(request, response) {
  // 1. Verificação do Método
  if (request.method !== 'POST') {
    response.setHeader('Allow', ['POST']);
    return response.status(405).json({ error: `Método ${request.method} não permitido.` });
  }

  try {
    // Inicializa o cliente Supabase com permissões de Admin (Service Key)
    const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    
    // 2. Autenticação e Recuperação do Usuário
    const authHeader = request.headers['authorization'];
    if (!authHeader) {
      return response.status(401).json({ error: 'Token de autorização não fornecido.' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return response.status(401).json({ error: 'Token inválido ou usuário não autenticado.' });
    }

    // 3. Recuperação do Perfil para obter o Tenant ID (Segurança Multi-tenant)
    const { data: userData, error: profileError } = await supabaseAdmin
      .from('users') // ou 'user_profiles' dependendo da sua versão, mas o original usava users ou user_profiles
      .select('tenantId')
      .eq('id', user.id)
      .single();

    if (profileError || !userData) {
      return response.status(404).json({ error: 'Perfil de usuário não encontrado.' });
    }
    const tenantId = userData.tenantId;

    // 4. Verificação de Limites do Plano (Lógica Original Mantida)
    // Busca o plano da empresa para verificar o limite de vagas
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('plan:plans(id, job_limit)')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      return response.status(500).json({ error: 'Erro ao verificar plano da empresa.' });
    }

    const job_limit = tenant.plan?.job_limit;

    // Se job_limit for -1, é ilimitado. Se não, verifica a contagem atual.
    if (job_limit !== -1) {
      const { count, error: countError } = await supabaseAdmin
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('tenantId', tenantId)
        .eq('status', 'active'); // Conta apenas vagas ativas

      if (countError) {
        return response.status(500).json({ error: 'Erro ao contar vagas existentes.' });
      }

      if (count >= job_limit) {
        return response.status(403).json({ error: `Limite de vagas do plano atingido (${job_limit}). Faça upgrade para criar mais.` });
      }
    }

    // 5. Preparação dos Dados da Nova Vaga
    const { title, description, requirements, type, location_type, company_department_id } = request.body;

    if (!title) {
      return response.status(400).json({ error: 'O título da vaga é obrigatório.' });
    }

    // Estrutura padrão de parâmetros (Critérios e Régua)
    const defaultParameters = { 
        triagem: [], 
        cultura: [], 
        tecnico: [], 
        notas: [
            { id: '1', nome: 'Abaixo', valor: 0 }, 
            { id: '2', nome: 'Atende', valor: 5 }, 
            { id: '3', nome: 'Supera', valor: 10 }
        ] 
    };

    // 6. Inserção da Vaga no Banco de Dados
    const { data: newJob, error: insertError } = await supabaseAdmin
      .from('jobs')
      .insert({
        title, 
        tenantId, 
        status: 'active', 
        description: description || '', 
        requirements: requirements || '',
        type: type || 'CLT', 
        location_type: location_type || 'Híbrido',
        company_department_id: company_department_id ? parseInt(company_department_id) : null,
        parameters: defaultParameters
      })
      .select()
      .single();
      
    if (insertError) {
      throw insertError;
    }

    // -------------------------------------------------------------------------
    // 7. CRIAÇÃO AUTOMÁTICA DO CANDIDATO IDEAL (BENCHMARK) - NOVO REQUISITO
    // -------------------------------------------------------------------------
    
    // Define um email único para o benchmark desta vaga específica
    const idealEmail = `benchmark_${newJob.id}@novva.app`;
    
    // 7a. Cria ou recupera o Candidato na tabela 'candidates'
    // Usamos upsert para evitar erro caso, por algum motivo bizarro, já exista.
    const { data: cand, error: candError } = await supabaseAdmin
        .from('candidates')
        .upsert(
            { 
                name: 'Candidato Ideal (Referência)', 
                email: idealEmail, 
                city: 'N/A', 
                state: 'N/A',
                phone: '0000000000'
            }, 
            { onConflict: 'email' }
        )
        .select()
        .single();

    if (candError) {
        console.error("Erro ao criar candidato ideal:", candError);
        // Não vamos travar a criação da vaga se isso falhar, mas logamos o erro.
    } else {
        // 7b. Cria a Aplicação na tabela 'applications'
        // Status 'benchmark' serve como flag extra, além do email e isHired false
        const { data: app, error: appError } = await supabaseAdmin
            .from('applications')
            .insert({
                jobId: newJob.id,
                candidateId: cand.id,
                status: 'benchmark', 
                isHired: false
            })
            .select()
            .single();

        if (appError) {
             console.error("Erro ao criar aplicação ideal:", appError);
        } else {
            // 7c. Cria a Avaliação Inicial na tabela 'evaluations'
            // Gera as notas padrão (todas no centro da régua)
            const defaultScores = generateBenchmarkScores(defaultParameters);
            
            const { error: evalError } = await supabaseAdmin
                .from('evaluations')
                .insert({
                    application_id: app.id,
                    evaluator_id: user.id, // Vincula ao criador da vaga inicialmente
                    scores: defaultScores,
                    final_score: 5, // Nota média padrão (centro da régua 0-10)
                    notes: 'Gabarito inicial gerado automaticamente pelo sistema.'
                });
                
            if (evalError) console.error("Erro ao criar avaliação ideal:", evalError);
        }
    }

    // 8. Retorno de Sucesso
    return response.status(201).json({ newJob });

  } catch (error) {
    console.error("Erro em createJob:", error);
    return response.status(500).json({ error: 'Erro interno ao criar vaga.', details: error.message });
  }
}