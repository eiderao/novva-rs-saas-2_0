// api/getApplicationDetails.js (CORRIGIDO: Aponta para user_profiles)
import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
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

    const { applicationId } = request.query;
    if (!applicationId) {
      return response.status(400).json({ error: 'ID da candidatura obrigatório.' });
    }

    const { data: application, error: applicationError } = await supabaseAdmin
      .from('applications')
      .select(`
        id,
        created_at,
        formData,
        resumeUrl,
        evaluation, 
        candidate:candidates ( * ),
        job:jobs ( title, parameters, tenantId )
      `)
      .eq('id', Number(applicationId))
      .single();

    if (applicationError) {
      if (applicationError.code === 'PGRST116') {
         return response.status(404).json({ error: 'Candidatura não encontrada.' });
      }
      throw applicationError;
    }

    if (application.job.tenantId !== tenantId) {
      return response.status(403).json({ error: 'Sem permissão para esta candidatura.' });
    }

    return response.status(200).json({ application });

  } catch (error) {
    console.error("Erro getApplicationDetails:", error);
    return response.status(500).json({ error: 'Erro interno.', details: error.message });
  }
}