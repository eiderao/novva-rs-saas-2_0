// src/services/evaluationService.js
import { supabase } from '../supabase/client';

// 1. Prepara o banco (Cria critérios se não existirem)
export const prepareEvaluationV2 = async (jobId) => {
  const { data, error } = await supabase
    .rpc('initialize_job_criteria_v2', { target_job_id: jobId });
  if (error) throw error;
  return data;
};

// 2. Busca o resumo consolidado (Médias)
export const getEvaluationSummaryV2 = async (applicationId) => {
  const { data, error } = await supabase
    .rpc('get_candidate_summary_v2', { target_app_id: applicationId });
  if (error) throw error;
  return data;
};

// 3. Busca/Cria a sessão do usuário atual
export const getMyEvaluationSession = async (applicationId, userId) => {
  // Tenta buscar existente
  let { data: session, error } = await supabase
    .from('evaluation_assignments_v2')
    .select('id, status')
    .eq('application_id', applicationId)
    .eq('evaluator_id', userId)
    .maybeSingle();

  // Se não existir, cria
  if (!session) {
    const { data: newSession, error: createError } = await supabase
      .from('evaluation_assignments_v2')
      .insert({ application_id: applicationId, evaluator_id: userId })
      .select()
      .single();
    
    if (createError) throw createError;
    session = newSession;
  }
  
  return session;
};