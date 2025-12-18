// api/updateJobParameters.js
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

    // 1. Valida o token do usuário para garantir que ele está logado
    const authHeader = request.headers['authorization'];
    if (!authHeader) {
      return response.status(401).json({ error: 'Não autorizado.' });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) {
      return response.status(401).json({ error: 'Token inválido.' });
    }

    // 2. Busca o tenantId do usuário para garantir que ele só edite suas próprias vagas
    const { data: userData } = await supabaseAdmin.from('users').select('tenantId').eq('id', user.id).single();
    if (!userData) {
      return response.status(404).json({ error: 'Perfil de usuário não encontrado.' });
    }
    const tenantId = userData.tenantId;

    // 3. Pega o ID da vaga e os novos parâmetros do corpo da requisição
    const { jobId, parameters } = request.body;
    if (!jobId || !parameters) {
      return response.status(400).json({ error: 'jobId e parameters são obrigatórios.' });
    }

    // 4. Atualiza a vaga no banco de dados
    const { data, error: updateError } = await supabaseAdmin
      .from('jobs')
      .update({ parameters: parameters }) // Atualiza apenas a coluna 'parameters'
      .eq('id', jobId)                   // Onde o ID da vaga bate
      .eq('tenantId', tenantId)          // E ONDE a vaga pertence ao tenant do usuário (SEGURANÇA)
      .select()
      .single();

    if (updateError) {
      // Se o erro for 'PGRST116', significa que a vaga não foi encontrada (ou não pertence ao tenant)
      if (updateError.code === 'PGRST116') {
        return response.status(404).json({ error: 'Vaga não encontrada ou você não tem permissão para editá-la.' });
      }
      throw updateError;
    }

    // 5. Retorna sucesso
    return response.status(200).json({ message: 'Parâmetros salvos com sucesso!', updatedJob: data });

  } catch (error) {
    console.error("Erro na função updateJobParameters:", error);
    return response.status(500).json({ error: 'Erro interno do servidor.', details: error.message });
  }
}