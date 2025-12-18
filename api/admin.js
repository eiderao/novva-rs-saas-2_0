// api/admin.js (VERSÃO FINAL E CORRIGIDA)
import { createClient } from '@supabase/supabase-js';

async function validateAdmin(request) {
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const authHeader = request.headers['authorization'];
  if (!authHeader) throw new Error('Não autorizado.');
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError) throw new Error('Token inválido.');

  const { data: userData, error: userCheckError } = await supabaseAdmin
    .from('users')
    .select('isAdmin')
    .eq('id', user.id)
    .single();

  if (userCheckError) throw userCheckError;
  if (!userData || !userData.isAdmin) {
    throw new Error('Acesso negado. Você não é um administrador.');
  }
  
  return { supabaseAdmin };
}

export default async function handler(request, response) {
  try {
    const { supabaseAdmin } = await validateAdmin(request);
    
    const action = request.method === 'GET' ? request.query.action : request.body.action;

    switch (action) {
      case 'getTenantsAndPlans': {
        const { data: tenants, error: tenantsError } = await supabaseAdmin
          .from('tenants')
          .select(`id, companyName, planId, cnpj, plans ( name )`);
        if (tenantsError) throw tenantsError;

        const { data: plans, error: plansError } = await supabaseAdmin
          .from('plans')
          .select('*');
        if (plansError) throw plansError;

        return response.status(200).json({ tenants, plans });
      }
        
      case 'updateTenantPlan': {
        if (request.method !== 'POST') { return response.status(405).json({ error: 'Use POST.' }); }
        const { tenantId, newPlanId } = request.body;
        const { data, error } = await supabaseAdmin.from('tenants').update({ planId: newPlanId }).eq('id', tenantId).select('id, companyName, planId, plans ( name )').single();
        if (error) throw error;
        return response.status(200).json({ message: 'Plano atualizado!', updatedTenant: data });
      }
      
      case 'getTenantDetails': {
        if (request.method !== 'GET') { return response.status(405).json({ error: 'Use GET.' }); }
        const { tenantId } = request.query;
        if (!tenantId) { return response.status(400).json({ error: 'tenantId é obrigatório.' }); }
        
        const { data: tenant, error: tenantError } = await supabaseAdmin.from('tenants').select('id, companyName').eq('id', tenantId).single();
        if (tenantError || !tenant) { return response.status(404).json({ error: 'Empresa não encontrada.' }); }

        // AQUI ESTAVA O ERRO DE SINTAXE. ESTA É A VERSÃO CORRETA.
        const { data: users, error: usersError } = await supabaseAdmin
          .from('users')
          .select('id, name, role, isAdmin') 
          .eq('tenantId', Number(tenantId));
        if (usersError) throw usersError;
        
        return response.status(200).json({ tenant, users });
      }

      case 'createTenant': {
        if (request.method !== 'POST') { return response.status(405).json({ error: 'Use POST.' }); }
        const { companyName, planId, cnpj } = request.body;
        if (!companyName || !planId) { return response.status(400).json({ error: 'Nome da empresa e Plano são obrigatórios.' }); }

        const { data: newTenant, error } = await supabaseAdmin
          .from('tenants')
          .insert({ companyName, planId, cnpj: cnpj || null })
          .select('id, companyName, planId, cnpj, plans ( name )')
          .single();
        if (error) throw error;
        return response.status(201).json({ message: 'Empresa criada com sucesso!', newTenant });
      }
      
      case 'updateTenant': {
        if (request.method !== 'POST') { return response.status(405).json({ error: 'Use POST.' }); }
        const { id, companyName, planId, cnpj } = request.body;
        if (!id || !companyName || !planId) { return response.status(400).json({ error: 'ID, Nome e Plano são obrigatórios.' }); }

        const { data: updatedTenant, error } = await supabaseAdmin
          .from('tenants')
          .update({ companyName, planId, cnpj: cnpj || null })
          .eq('id', id)
          .select('id, companyName, planId, cnpj, plans ( name )')
          .single();
        if (error) throw error;
        return response.status(200).json({ message: 'Empresa atualizada!', updatedTenant });
      }

      case 'deleteTenant': {
        if (request.method !== 'POST') { return response.status(405).json({ error: 'Use POST.' }); }
        const { tenantId } = request.body;
        if (!tenantId) { return response.status(400).json({ error: 'tenantId é obrigatório.' }); }
        
        const { error } = await supabaseAdmin.from('tenants').delete().eq('id', tenantId);
        if (error) throw error;
        return response.status(200).json({ message: 'Empresa excluída com sucesso!' });
      }
      
      case 'createPlan': {
        if (request.method !== 'POST') { return response.status(405).json({ error: 'Use POST.' }); }
        const { planData } = request.body;
        if (!planData) { return response.status(400).json({ error: 'Dados do plano são obrigatórios.' }); }
        const { data: newPlan, error } = await supabaseAdmin.from('plans').insert(planData).select().single();
        if (error) throw error;
        return response.status(201).json({ message: 'Plano criado com sucesso!', newPlan });
      }

      case 'updatePlan': {
        if (request.method !== 'POST') { return response.status(405).json({ error: 'Use POST.' }); }
        const { planId, planData } = request.body;
        if (!planId || !planData) { return response.status(400).json({ error: 'planId e planData são obrigatórios.' }); }
        const { data: updatedPlan, error } = await supabaseAdmin.from('plans').update(planData).eq('id', planId).select().single();
        if (error) throw error;
        return response.status(200).json({ message: 'Plano atualizado!', updatedPlan });
      }

      case 'deletePlan': {
        if (request.method !== 'POST') { return response.status(405).json({ error: 'Use POST.' }); }
        const { planId } = request.body;
        if (!planId) { return response.status(400).json({ error: 'planId é obrigatório.' }); }
        const { count, error: checkError } = await supabaseAdmin.from('tenants').select('*', { count: 'exact', head: true }).eq('planId', planId);
        if (checkError) throw checkError;
        if (count > 0) { return response.status(400).json({ error: `Não é possível excluir este plano. Ele está sendo usado por ${count} empresa(s).` }); }
        const { error } = await supabaseAdmin.from('plans').delete().eq('id', planId);
        if (error) throw error;
        return response.status(200).json({ message: 'Plano excluído com sucesso!' });
      }

      case 'createUser': {
        if (request.method !== 'POST') { return response.status(405).json({ error: 'Use POST.' }); }
        const { email, password, name, role, isAdmin, tenantId } = request.body;
        if (!email || !password || !name || !role || !tenantId) {
          return response.status(400).json({ error: 'Campos obrigatórios faltando.' });
        }

        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true,
        });
        if (authError) throw authError;

        const { data: newUser, error: userError } = await supabaseAdmin
          .from('users')
          .insert({
            id: authUser.user.id,
            name: name,
            role: role,
            isAdmin: isAdmin || false,
            tenantId: tenantId
          })
          .select()
          .single();
        
        if (userError) {
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
          throw userError;
        }
        
        return response.status(201).json({ message: 'Usuário criado com sucesso!', newUser });
      }

      case 'updateUser': {
        if (request.method !== 'POST') { return response.status(405).json({ error: 'Use POST.' }); }
        const { userId, name, role, isAdmin } = request.body;
        if (!userId || !name || !role) {
          return response.status(400).json({ error: 'Campos obrigatórios faltando.' });
        }
        
        const { data: updatedUser, error } = await supabaseAdmin
          .from('users')
          .update({ name, role, isAdmin })
          .eq('id', userId)
          .select()
          .single();
        
        if (error) throw error;
        return response.status(200).json({ message: 'Usuário atualizado!', updatedUser });
      }

      case 'deleteUser': {
        if (request.method !== 'POST') { return response.status(405).json({ error: 'Use POST.' }); }
        const { userId } = request.body;
        if (!userId) { return response.status(400).json({ error: 'userId é obrigatório.' }); }

        const { error: userError } = await supabaseAdmin
          .from('users')
          .delete()
          .eq('id', userId);
        if (userError) throw userError;
        
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authError) throw authError;
        
        return response.status(200).json({ message: 'Usuário excluído com sucesso!' });
      }
      
      default:
        return response.status(400).json({ error: 'Ação de admin desconhecida.' });
    }

  } catch (error) {
    console.error("Erro na API de Admin:", error.message);
    if (error.message.includes('Não autorizado') || error.message.includes('Token inválido')) {
      return response.status(401).json({ error: error.message });
    }
    if (error.message.includes('Acesso negado')) {
      return response.status(403).json({ error: error.message });
    }
    return response.status(500).json({ error: 'Erro interno do servidor.', details: error.message });
  }
}