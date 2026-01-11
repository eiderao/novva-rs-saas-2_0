import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  // Configuração para aceitar JSON (padrão em serverless)
  if (request.method !== 'POST') {
    return response.status(405).json({ error: `Método ${request.method} não permitido.` });
  }

  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // 1. Recebe os dados via JSON (Body Parser padrão)
    const { 
        jobId, name, email, phone, city, state, linkedin_profile, github_profile, resume_url,
        // Novos campos obrigatórios
        birthDate, englishLevel, spanishLevel, source,
        // Campos de educação/motivação
        motivation, education_level, education_status, course_name, institution, conclusion_date, current_period
    } = request.body;

    // 2. Validações
    if (!jobId) return response.status(400).json({ error: 'ID da vaga obrigatório.' });
    if (!name || !email) return response.status(400).json({ error: 'Dados obrigatórios faltando.' });

    // 3. Busca Vaga e Tenant (com tratamento para case sensitivity do banco)
    const { data: job } = await supabaseAdmin
        .from('jobs')
        .select('"tenantId", status')
        .eq('id', jobId)
        .single();

    if (!job || job.status !== 'active') {
        return response.status(400).json({ error: 'Vaga não disponível.' });
    }
    
    // Fallback para pegar o ID do tenant independente da capitalização
    const tenantId = job.tenantId || job.tenantid || job['"tenantId"'];

    // 4. UPSERT no Candidato (Atualiza ou Cria)
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
            resume_url, 
            updated_at: new Date()
        }, { onConflict: 'email' })
        .select('id')
        .single();

    if (candidateError) throw candidateError;

    // 5. Prepara o JSON de dados da aplicação
    const applicationData = {
        birthDate, 
        englishLevel, 
        spanishLevel, 
        source,
        motivation,
        education_level,
        education_status,
        course_name,
        institution,
        conclusion_date,
        current_period,
        applied_at_date: new Date().toISOString()
    };

    // 6. Inserção na Tabela Applications (Dual-Write)
    // Escreve tanto nas colunas snake_case quanto camelCase para compatibilidade total com seu banco
    const insertPayload = {
        // Colunas CamelCase (baseado no seu SQL)
        "jobId": jobId, 
        "candidateId": candidate.id, 
        "tenantId": tenantId, 
        "resumeUrl": resume_url,
        "formData": applicationData,
        "isHired": false,
        
        // Colunas SnakeCase (baseado no seu SQL)
        jobId: jobId,
        candidateId: candidate.id,
        tenantId: tenantId,
        resume_url: resume_url,
        form_data: applicationData,
        is_hired: false
    };

    const { error: appError } = await supabaseAdmin
        .from('applications')
        .insert(insertPayload);

    if (appError) {
        if (appError.code === '23505') return response.status(409).json({ error: "Você já se candidatou." });
        console.error("Erro SQL Aplicação:", appError);
        throw appError;
    }
    
    return response.status(201).json({ message: 'Sucesso!' });

  } catch (error) {
    console.error("Erro Geral API Apply:", error);
    return response.status(500).json({ error: error.message || 'Erro interno.' });
  }
}