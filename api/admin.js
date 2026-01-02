import { createClient } from '@supabase/supabase-js';

// Função auxiliar de segurança e validação
async function validateAdmin(request) {
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  
  const authHeader = request.headers['authorization'];
  if (!authHeader) throw new Error('Token de autorização ausente.');
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  
  if (userError || !user) throw new Error('Token inválido ou expirado.');

  // Busca o perfil do usuário para checar permissões
  const { data: userData, error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .select('id, is_admin_system, tenantId, role') 
    .eq('id', user.id)
    .single();

  if (profileError || !userData) {
      if (user.email === 'eider@novvaempresa.com.br') { 
          return { supabaseAdmin, requesterProfile: { is_admin_system: true, id: user.id }, requesterId: user.id };
      }
      throw new Error('Perfil de usuário não encontrado.');
  }
  
  return { supabaseAdmin, requesterProfile: userData, requesterId: user.id };
}

export default async function handler(request, response) {
  try {
    const { supabaseAdmin, requesterProfile } = await validateAdmin(request);
    
    const action = request.method === 'GET' ? request.query.action : request.body.action;
    const isSuperAdmin = requesterProfile.is_admin_system === true;

    switch (action) {
      // ======================================================================
      // 1. GESTÃO DE EMPRESAS E DASHBOARD
      // ======================================================================

      case 'getTenantsAndPlans': {
        if (!isSuperAdmin) return response.status(403).json({ error: 'Acesso negado.' });
        
        const { data: tenants, error: tErr } = await supabaseAdmin
          .from('tenants')
          .select(`id, companyName, planId, cnpj, plans ( name )`)
          .order('created_at', { ascending: false });
        if (tErr) throw tErr;

        const { data: plans, error: pErr } = await supabaseAdmin
          .from('plans')
          .select('*')
          .order('price', { ascending: true });
        if (pErr) throw pErr;

        return response.status(200).json({ tenants, plans });
      }

      case 'provisionTenant': {
        if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST.' });
        if (!isSuperAdmin) return response.status(403).json({ error: 'Apenas Super Admin.' });

        const { companyName, planId, cnpj, adminName, adminEmail, adminPassword } = request.body;
        if (!companyName || !adminEmail || !adminPassword) return response.status(400).json({ error: 'Dados incompletos.' });

        // A. Criar Tenant
        const { data: newTenant, error: tErr } = await supabaseAdmin
          .from('tenants')
          .insert({ companyName, planId, cnpj: cnpj || null })
          .select().single();
        if (tErr) throw tErr;

        // B. Criar Auth User
        const { data: authUser, error: aErr } = await supabaseAdmin.auth.admin.createUser({
            email: adminEmail,
            password: adminPassword,
            email_confirm: true,
            user_metadata: { name: adminName }
        });

        if (aErr) {
            await supabaseAdmin.from('tenants').delete().eq('id', newTenant.id);
            throw aErr;
        }

        // C. Criar Perfil
        const { error: pErr } = await supabaseAdmin.from('user_profiles').insert({
            id: authUser.user.id,
            name: adminName,
            email: adminEmail,
            role: 'admin',
            tenantId: newTenant.id,
            is_admin_system: false,
            active: true
        });
        if (pErr) throw pErr;

        return response.status(201).json({ message: 'Cliente provisionado com sucesso!', tenant: newTenant });
      }

      case 'updateTenant': {
        if (!isSuperAdmin) return response.status(403).json({ error: 'Acesso negado.' });
        const { id, companyName, planId, cnpj } = request.body;
        
        const { data, error } = await supabaseAdmin
            .from('tenants')
            .update({ companyName, planId, cnpj })
            .eq('id', id)
            .select().single();
        if (error) throw error;
        
        return response.status(200).json({ message: 'Atualizado.' });
      }

      case 'deleteTenant': {
        if (!isSuperAdmin) return response.status(403).json({ error: 'Acesso negado.' });
        const { tenantId } = request.body;
        
        await supabaseAdmin.from('user_profiles').delete().eq('tenantId', tenantId);
        const { error } = await supabaseAdmin.from('tenants').delete().eq('id', tenantId);
        if (error) throw error;
        
        return response.status(200).json({ message: 'Empresa excluída.' });
      }

      // ======================================================================
      // 2. GESTÃO DE PLANOS
      // ======================================================================

      case 'createPlan': {
        if (!isSuperAdmin) return response.status(403).json({ error: 'Apenas Super Admin.' });
        const { planData } = request.body;
        const { data: newPlan, error } = await supabaseAdmin.from('plans').insert(planData).select().single();
        if (error) throw error;
        return response.status(201).json({ message: 'Plano criado!', newPlan });
      }

      case 'updatePlan': {
        if (!isSuperAdmin) return response.status(403).json({ error: 'Apenas Super Admin.' });
        const { planId, planData } = request.body;
        const { data: updatedPlan, error } = await supabaseAdmin.from('plans').update(planData).eq('id', planId).select().single();
        if (error) throw error;
        return response.status(200).json({ message: 'Plano atualizado!', updatedPlan });
      }

      case 'deletePlan': {
        if (!isSuperAdmin) return response.status(403).json({ error: 'Apenas Super Admin.' });
        const { planId } = request.body;
        const { count, error: checkError } = await supabaseAdmin.from('tenants').select('*', { count: 'exact', head: true }).eq('planId', planId);
        if (checkError) throw checkError;
        if (count > 0) return response.status(400).json({ error: `Plano em uso por ${count} empresa(s).` });
        const { error } = await supabaseAdmin.from('plans').delete().eq('id', planId);
        if (error) throw error;
        return response.status(200).json({ message: 'Plano excluído!' });
      }

      // ======================================================================
      // 3. GESTÃO DE USUÁRIOS E EQUIPE
      // ======================================================================

      case 'getTenantDetails': {
        const { tenantId } = request.query;
        if (!tenantId) return response.status(400).json({ error: 'ID obrigatório.' });
        
        if (!isSuperAdmin && requesterProfile.tenantId !== tenantId) {
            return response.status(403).json({ error: 'Não autorizado.' });
        }

        const { data: tenant } = await supabaseAdmin.from('tenants').select('id, companyName, planId').eq('id', tenantId).single();
        const { data: users } = await supabaseAdmin.from('user_profiles').select('id, name, email, role, is_admin_system').eq('tenantId', tenantId);
        
        return response.status(200).json({ tenant, users });
      }

      // --- NOVO: GESTÃO COMPLETA DE USUÁRIO (Update Auth + Profile) ---
      case 'updateUserAuth': {
        if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST.' });
        if (!isSuperAdmin) return response.status(403).json({ error: 'Apenas Super Admin pode alterar credenciais de terceiros.' });

        const { userId, email, password, name } = request.body;
        if (!userId) return response.status(400).json({ error: 'ID do usuário necessário.' });

        // 1. Atualiza Auth (Login, Senha, Metadados)
        const updateData = { email_confirm: true };
        if (email) updateData.email = email;
        if (password) updateData.password = password;
        if (name) updateData.user_metadata = { name };

        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData);
        if (authError) throw authError;

        // 2. Atualiza Profile (Dados visuais)
        const profileUpdate = {};
        if (email) profileUpdate.email = email;
        if (name) profileUpdate.name = name;

        if (Object.keys(profileUpdate).length > 0) {
            const { error: profileError } = await supabaseAdmin
                .from('user_profiles')
                .update(profileUpdate)
                .eq('id', userId);
            if (profileError) throw profileError;
        }

        return response.status(200).json({ message: 'Dados do usuário atualizados com sucesso!' });
      }
      // ---------------------------------------------------------------

      case 'createUser': {
        const { email, password, name, isAdmin, tenantId } = request.body;
        
        if (!isSuperAdmin && requesterProfile.tenantId !== tenantId) {
            return response.status(403).json({ error: 'Não autorizado para esta empresa.' });
        }

        const { data: authUser, error: aErr } = await supabaseAdmin.auth.admin.createUser({
            email, password, email_confirm: true, user_metadata: { name }
        });
        if (aErr) throw aErr;

        const userRole = isAdmin ? 'admin' : 'recruiter';

        const { error: pErr } = await supabaseAdmin.from('user_profiles').insert({
            id: authUser.user.id, 
            name, 
            email, 
            role: userRole, 
            tenantId, 
            active: true, 
            is_admin_system: false
        });
        if (pErr) {
            await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
            throw pErr;
        }

        return response.status(201).json({ message: 'Usuário criado.' });
      }

      case 'deleteUser': {
        const { userId } = request.body;
        
        if (!isSuperAdmin) {
            const { data: target } = await supabaseAdmin.from('user_profiles').select('tenantId').eq('id', userId).single();
            if (!target || target.tenantId !== requesterProfile.tenantId) {
                return response.status(403).json({ error: 'Não autorizado.' });
            }
        }

        await supabaseAdmin.from('user_profiles').delete().eq('id', userId);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return response.status(200).json({ message: 'Usuário removido.' });
      }

      default:
        return response.status(400).json({ error: 'Ação desconhecida.' });
    }

  } catch (error) {
    console.error("API Error:", error);
    return response.status(500).json({ error: error.message || 'Erro interno.' });
  }
}