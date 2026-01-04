// api/createJob.js (CORRIGIDO: Aponta para user_profiles)
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
    
    // CORREÇÃO: Busca em user_profiles
    const { data: userData } = await supabaseAdmin
        .from('user_profiles')
        .select('tenantId')
        .eq('id', user.id)
        .single();
        
    if (!userData) return response.status(404).json({ error: 'Perfil não encontrado.' });
    const tenantId = userData.tenantId;

    // Busca dados do plano e contagem atual
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('plan:plans(id, job_limit)')
      .eq('id', tenantId)
      .single();
    
    if (tenantError) throw tenantError;

    // REGRA: Limite de Vagas Ativas
    const job_limit = tenant.plan.job_limit;
    
    if (job_limit !== -1) {
      const { count, error: countError } = await supabaseAdmin
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('tenantId', tenantId)
        .eq('status', 'active'); 

      if (countError) throw countError;
      
      if (count >= job_limit) {
        return response.status(403).json({ 
            error: `Limite de ${job_limit} vagas ativas atingido para o plano ${tenant.plan.id}.` 
        });
      }
    }

    const { 
        title, description, requirements, type, 
        location_type, company_department_id 
    } = request.body;

    if (!title) return response.status(400).json({ error: 'O título da vaga é obrigatório.' });
    
    const insertData = {
        title,
        tenantId,
        status: 'active',
        description: description || '',
        requirements: requirements || '',
        type: type || 'CLT',
        location_type: location_type || 'Híbrido',
        parameters: { 
            triagem: [], cultura: [], tecnico: [], 
            notas: [
                {id: '1', nome: 'Abaixo', valor: 0},
                {id: '2', nome: 'Atende', valor: 50},
                {id: '3', nome: 'Supera', valor: 100}
            ] 
        }
    };

    if (company_department_id) {
        insertData.company_department_id = company_department_id;
    }
    
    const { data: newJob, error: insertError } = await supabaseAdmin
      .from('jobs')
      .insert(insertData)
      .select()
      .single();
      
    if (insertError) throw insertError;
    
    return response.status(201).json({ newJob });

  } catch (error) {
    console.error("Erro createJob:", error);
    return response.status(500).json({ error: 'Erro interno do servidor.', details: error.message });
  }
}