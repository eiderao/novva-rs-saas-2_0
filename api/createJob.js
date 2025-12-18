// api/createJob.js (Versão Final "Plan-Aware")
import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', ['POST']);
    return response.status(405).json({ error: `Método ${request.method} não permitido.` });
  }
  try {
    const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    const authHeader = request.headers['authorization'];
    if (!authHeader) return response.status(401).json({ error: 'Não autorizado.' });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) return response.status(401).json({ error: 'Token inválido.' });
    
    const { data: userData } = await supabaseAdmin.from('users').select('tenantId').eq('id', user.id).single();
    if (!userData) return response.status(404).json({ error: 'Perfil de usuário não encontrado.' });
    const tenantId = userData.tenantId;

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('plan:plans(job_limit)')
      .eq('id', tenantId)
      .single();
    if (tenantError) throw tenantError;

    const job_limit = tenant.plan.job_limit;

    // Lógica de limite dinâmica (job_limit === -1 é ilimitado)
    if (job_limit !== -1) {
      const { count, error: countError } = await supabaseAdmin
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('tenantId', tenantId);
      if (countError) throw countError;
      if (count >= job_limit) {
        return response.status(403).json({ error: `Limite de ${job_limit} vagas atingido para o seu plano.` });
      }
    }

    const { title } = request.body;
    if (!title) { return response.status(400).json({ error: 'O título da vaga é obrigatório.' }); }
    
    const { data: newJob, error: insertError } = await supabaseAdmin
      .from('jobs')
      .insert({ title: title, tenantId: tenantId, status: 'active' })
      .select()
      .single();
    if (insertError) throw insertError;
    
    return response.status(201).json({ newJob });
  } catch (error) {
    console.error("Erro na função createJob:", error);
    return response.status(500).json({ error: 'Erro interno do servidor.', details: error.message });
  }
}