// api/getHiredApplicants.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Validação do usuário de RH
    const authHeader = request.headers['authorization'];
    if (!authHeader) return response.status(401).json({ error: 'Não autorizado.' });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) return response.status(401).json({ error: 'Token inválido.' });
    
    const { data: userData } = await supabaseAdmin.from('users').select('tenantId').eq('id', user.id).single();
    if (!userData) return response.status(404).json({ error: 'Perfil de usuário não encontrado.' });
    const tenantId = userData.tenantId;

    // Busca todas as candidaturas marcadas como 'isHired = true'
    const { data: hiredApplications, error: fetchError } = await supabaseAdmin
      .from('applications')
      .select(`
        id,
        hiredAt,
        formData,
        candidate:candidates ( name, email ),
        job:jobs ( id, title, tenantId )
      `)
      .eq('isHired', true);

    if (fetchError) throw fetchError;

    // Filtra no servidor para garantir que o usuário só veja os aprovados do seu próprio tenant
    const tenantHired = hiredApplications.filter(app => app.job.tenantId === tenantId);

    return response.status(200).json({ hired: tenantHired });

  } catch (error) {
    console.error("Erro ao buscar candidatos contratados:", error);
    return response.status(500).json({ error: 'Erro interno do servidor.', details: error.message });
  }
}