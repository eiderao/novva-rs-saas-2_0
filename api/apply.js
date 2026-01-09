import { createClient } from '@supabase/supabase-js';
import { formidable } from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: `Método ${request.method} não permitido.` });
  }

  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const form = formidable({});
    const [fields, files] = await form.parse(request);
    
    const getField = (f) => (Array.isArray(f) ? f[0] : f);

    const jobId = getField(fields.jobId);
    if (!jobId) return response.status(400).json({ error: 'ID da vaga obrigatório.' });

    // --- 1. Validações de Vaga e Limites ---
    // SELECT robusto para tenantId (com aspas para case sensitivity)
    const { data: job } = await supabaseAdmin
        .from('jobs')
        .select('"tenantId", status')
        .eq('id', jobId)
        .single();

    if (!job || job.status !== 'active') return response.status(400).json({ error: 'Vaga não disponível.' });
    
    // Fallback seguro para o ID do tenant
    const tenantId = job.tenantId || job.tenantid || job['"tenantId"'];

    // --- 2. Coleta de Dados do GRUPO A (Perfil - Candidates) ---
    const name = getField(fields.name);
    const email = getField(fields.email);
    const phone = getField(fields.phone);
    const city = getField(fields.city);
    const state = getField(fields.state);
    const linkedin = getField(fields.linkedin_profile);
    const github = getField(fields.github_profile);
    let resumeUrl = getField(fields.resume_url);

    if (!name || !email) return response.status(400).json({ error: 'Dados obrigatórios faltando.' });

    // --- 3. UPSERT no Candidato ---
    const { data: candidate, error: candidateError } = await supabaseAdmin
        .from('candidates')
        .upsert({ 
            email, 
            name, 
            phone,
            city,
            state,
            linkedin_profile: linkedin,
            github_profile: github,
            resume_url: resumeUrl,
            updated_at: new Date()
        }, { onConflict: 'email' })
        .select('id')
        .single();

    if (candidateError) throw candidateError;

    // --- 4. Coleta de Dados do GRUPO B (Aplicação Completa) ---
    // Incluindo campos que estavam faltando antes
    const applicationFields = {
        motivation: getField(fields.motivation),
        education_level: getField(fields.education_level),
        education_status: getField(fields.education_status),
        course_name: getField(fields.course_name),
        institution: getField(fields.institution),
        conclusion_date: getField(fields.conclusion_date),
        current_period: getField(fields.current_period),
        birthDate: getField(fields.birthDate),       // Novo
        englishLevel: getField(fields.englishLevel), // Novo
        spanishLevel: getField(fields.spanishLevel), // Novo
        source: getField(fields.source),             // Novo
        applied_at_date: new Date().toISOString()
    };

    // --- 5. Criação da Aplicação (CORREÇÃO DE SCHEMA DUPLICADO) ---
    const insertPayload = {
        // Versão CamelCase (se existir no banco)
        "jobId": jobId, 
        "candidateId": candidate.id, 
        "tenantId": tenantId, 
        "resumeUrl": resumeUrl,
        "formData": applicationFields,
        
        // Versão SnakeCase (se existir no banco)
        jobId: jobId,
        candidateId: candidate.id,
        tenantId: tenantId,
        resume_url: resumeUrl,
        form_data: applicationFields
    };

    const { error: appError } = await supabaseAdmin
        .from('applications')
        .insert(insertPayload);

    if (appError) {
        if (appError.code === '23505') return response.status(409).json({ error: "Você já se candidatou." });
        console.error("Erro ao inserir aplicação:", appError);
        throw appError;
    }
    
    return response.status(201).json({ message: 'Sucesso!' });

  } catch (error) {
    console.error("Erro Apply:", error);
    return response.status(500).json({ error: error.message });
  }
}