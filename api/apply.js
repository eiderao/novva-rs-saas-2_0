import { createClient } from '@supabase/supabase-js';

// Removemos a config de bodyParser: false para que o Vercel processe o JSON nativamente
// Isso corrige o erro 500 de "FUNCTION_INVOCATION_FAILED"

export default async function handler(request, response) {
  // 1. Validação do Método
  if (request.method !== 'POST') {
    return response.status(405).json({ error: `Método ${request.method} não permitido.` });
  }

  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // 2. Recebimento dos Dados (JSON Puro)
    // O frontend agora envia JSON, não FormData. Isso é mais robusto.
    const { 
        jobId, name, email, phone, city, state, linkedin_profile, github_profile, resume_url,
        // Novos Campos Solicitados
        birthDate, englishLevel, spanishLevel, source,
        // Campos de Educação
        motivation, education_level, education_status, course_name, institution, conclusion_date, current_period
    } = request.body;

    // 3. Validações Básicas
    if (!jobId) return response.status(400).json({ error: 'ID da vaga obrigatório.' });
    if (!name || !email) return response.status(400).json({ error: 'Nome e Email são obrigatórios.' });

    // --- Validação da Vaga e Tenant ---
    // Usamos aspas em "tenantId" para garantir match com o banco
    const { data: job } = await supabaseAdmin
        .from('jobs')
        .select('"tenantId", status') 
        .eq('id', jobId)
        .single();

    if (!job || job.status !== 'active') {
        return response.status(400).json({ error: 'Vaga não disponível ou encerrada.' });
    }
    
    // Fallback para garantir o ID do tenant (tenta com e sem aspas)
    const tenantId = job.tenantId || job.tenantid || job['"tenantId"'];

    // --- 4. UPSERT no Candidato (Perfil Único) ---
    // A tabela candidates não tem birth_date nativo (conforme auditoria), 
    // então salvaremos isso no JSON da aplicação, mas mantemos o perfil atualizado.
    const { data: candidate, error: candidateError } = await supabaseAdmin
        .from('candidates')
        .upsert({ 
            email, 
            name, 
            phone,
            city,
            state,
            linkedin_profile,
            github_profile,
            resume_url, // Atualiza o currículo mais recente no perfil
            updated_at: new Date()
        }, { onConflict: 'email' })
        .select('id')
        .single();

    if (candidateError) throw candidateError;

    // --- 5. Montagem do JSON da Aplicação (Dados Específicos desta Vaga) ---
    const applicationFields = {
        birthDate,       // Adicionado
        englishLevel,    // Adicionado
        spanishLevel,    // Adicionado
        source,          // Adicionado
        motivation,
        education_level,
        education_status,
        course_name,
        institution,
        conclusion_date,
        current_period,
        applied_at_date: new Date().toISOString()
    };

    // --- 6. Criação da Aplicação (Compatibilidade com Schema Duplicado) ---
    // Inserimos os dados em AMBAS as versões das colunas para não quebrar nada
    const insertPayload = {
        // Versão CamelCase (presente no backup)
        "jobId": jobId, 
        "candidateId": candidate.id, 
        "tenantId": tenantId, 
        "resumeUrl": resume_url,
        "formData": applicationFields,
        "isHired": false,
        
        // Versão SnakeCase (redundância de segurança)
        jobId: jobId,
        candidateId: candidate.id,
        tenantId: tenantId,
        resume_url: resume_url,
        form_data: applicationFields,
        is_hired: false
    };

    const { error: appError } = await supabaseAdmin
        .from('applications')
        .insert(insertPayload);

    if (appError) {
        // Tratamento específico para evitar erro 500 genérico se for duplicidade
        if (appError.code === '23505') {
            return response.status(409).json({ error: "Você já se candidatou para esta vaga." });
        }
        console.error("Erro ao inserir aplicação:", appError);
        throw appError;
    }
    
    return response.status(201).json({ message: 'Candidatura enviada com sucesso!' });

  } catch (error) {
    console.error("Erro Crítico no Apply:", error);
    return response.status(500).json({ error: error.message || 'Erro interno no servidor.' });
  }
}