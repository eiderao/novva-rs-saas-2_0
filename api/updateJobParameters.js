// api/updateJobParameters.js (CORRIGIDO: Aponta para user_profiles)
import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', ['POST']);
    return response.status(405).json({ error: `Método ${request.method} não permitido.` });
  }

  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const authHeader = request.headers['authorization'];
    if (!authHeader) return response.status(401).json({ error: 'Não autorizado.' });
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) return response.status(401).json({ error: 'Token inválido.' });

    // CORREÇÃO: Busca em user_profiles
    const { data: userData } = await supabaseAdmin
        .from('user_profiles')
        .select('tenantId')
        .eq('id', user.id)
        .single();
        
    if (!userData) return response.status(404).json({ error: 'Perfil não encontrado.' });
    const tenantId = userData.tenantId;

    const { jobId, parameters } = request.body;
    if (!jobId || !parameters) {
      return response.status(400).json({ error: 'jobId e parameters são obrigatórios.' });
    }

    const { data, error: updateError } = await supabaseAdmin
      .from('jobs')
      .update({ parameters: parameters })
      .eq('id', jobId)
      .eq('tenantId', tenantId) // Segurança: Garante que pertence ao tenant
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return response.status(404).json({ error: 'Vaga não encontrada ou sem permissão.' });
      }
      throw updateError;
    }

    return response.status(200).json({ message: 'Parâmetros salvos!', updatedJob: data });

  } catch (error) {
    console.error("Erro updateJobParameters:", error);
    return response.status(500).json({ error: 'Erro interno.', details: error.message });
  }
}