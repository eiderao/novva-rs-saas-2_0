// api/admin.js (VERSÃO FINAL INTEGRADA)
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

  // Bypass para Super Admin hardcoded (Segurança de Emergência)
  if (profileError || !userData) {
      if (user.email === 'eider@novvaempresa.com.br') { 
          return { 
              supabaseAdmin, 
              requesterProfile: { is_admin_system: true, id: user.id }, 
              requesterId: user.id 
          };
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
      // 1. GESTÃO DE EMPRESAS (TENANTS)
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

        // B. Criar Auth User (A Trigger do banco criará o perfil e o vínculo automaticamente baseada nos metadados)
        const { error: aErr } = await supabaseAdmin.auth.admin.createUser({
            email: adminEmail,
            password: adminPassword,
            email_confirm: true,
            user_metadata: { 
                name: adminName,
                tenant_id: newTenant.id, // Trigger usa isso para vincular
                role: 'admin'            // Trigger usa isso para definir permissão
            }
        });

        if (aErr) {
            // Se falhar (ex: email já existe), tentamos vincular manualmente
            if (aErr.message.includes('already been registered')) {
                 const { data: existing } = await supabaseAdmin.rpc('get_user_id_by_email', { email: adminEmail });
                 if (existing && existing[0]) {
                     // Vincula usuário existente ao novo tenant como admin
                     await supabaseAdmin.from('user_tenants').insert({
                         user_id: existing[0].id,
                         tenant_id: newTenant.id,
                         role: 'admin'
                     });
                     // Não retornamos erro, pois o provisionamento "funcionou" (empresa criada e usuário vinculado)
                 }
            } else {
                 // Se for outro erro, faz rollback do tenant
                 await supabaseAdmin.from('tenants').delete().eq('id', newTenant.id);
                 throw aErr;
            }
        }

        return response.status(201).json({ message: 'Cliente provisionado com sucesso!', tenant: newTenant });
      }

      case 'updateTenant': {
        if (!isSuperAdmin) return response.status(403).json({ error: 'Acesso negado.' });
        const { id, companyName, planId, cnpj } = request.body;
        
        const { error } = await supabaseAdmin
            .from('tenants')
            .update({ companyName, planId, cnpj })
            .eq('id', id);
        if (error) throw error;
        
        return response.status(200).json({ message: 'Atualizado.' });
      }

      case 'deleteTenant': {
        if (!isSuperAdmin) return response.status(403).json({ error: 'Acesso negado.' });
        const { tenantId } = request.body;
        
        // Remove vínculos e dados
        await supabaseAdmin.from('user_tenants').delete().eq('tenant_id', tenantId);
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
        
        // Busca usuários vinculados a este tenant na tabela user_tenants
        const { data: tenantUsers, error: usersError } = await supabaseAdmin
            .from('user_tenants')
            .select(`
                role,
                user:user_profiles (id, name, email, is_admin_system)
            `)
            .eq('tenant_id', tenantId);

        if (usersError) throw usersError;

        // Formata resposta
        const users = tenantUsers.map(tu => ({
            id: tu.user?.id,
            name: tu.user?.name,
            email: tu.user?.email,
            is_admin_system: tu.user?.is_admin_system,
            role: tu.role 
        })).filter(u => u.id);
        
        return response.status(200).json({ tenant, users });
      }

      case 'createUser': {
        const { email, password, name, role, isAdmin, tenantId } = request.body;
        
        if (!isSuperAdmin && requesterProfile.tenantId !== tenantId) {
            return response.status(403).json({ error: 'Não autorizado para esta empresa.' });
        }

        const finalRole = role || (isAdmin ? 'Administrador' : 'Recrutador');
        
        // 1. Verifica se usuário já existe no AUTH (Via RPC segura)
        const { data: existingUserIDs } = await supabaseAdmin.rpc('get_user_id_by_email', { email });
        
        if (existingUserIDs && existingUserIDs.length > 0) {
            // --- CENÁRIO: Usuário JÁ EXISTE no Auth -> APENAS VINCULA ---
            const userId = existingUserIDs[0].id;
            
            // Verifica se já está nesta empresa
            const { data: existingLink } = await supabaseAdmin.from('user_tenants')
                .select('id').eq('user_id', userId).eq('tenant_id', tenantId).maybeSingle();
            
            if (existingLink) return response.status(409).json({ error: 'Usuário já está nesta equipe.' });

            // Cria o vínculo novo
            const { error: linkErr } = await supabaseAdmin.from('user_tenants').insert({
                user_id: userId, tenant_id: tenantId, role: finalRole
            });
            if (linkErr) throw linkErr;

            return response.status(200).json({ message: 'Usuário existente convidado com sucesso!' });

        } else {
            // --- CENÁRIO: Usuário NOVO -> CRIA AUTH (Trigger cria o resto) ---
            const { error: aErr } = await supabaseAdmin.auth.admin.createUser({
                email, password, email_confirm: true, 
                user_metadata: { name, tenant_id: tenantId, role: finalRole } 
            });
            
            if (aErr) throw aErr;
            
            return response.status(201).json({ message: 'Usuário criado e vinculado.' });
        }
      }

      case 'updateUserAuth': {
         // Atualização de credenciais pelo Super Admin
         const { userId, email, password, name } = request.body;
         const updateData = { email_confirm: true };
         if (email) updateData.email = email;
         if (password) updateData.password = password;
         if (name) updateData.user_metadata = { name };

         const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData);
         if (error) throw error;
         
         // Atualiza profile visual também
         if (name || email) {
             const profileUpdate = {};
             if(name) profileUpdate.name = name;
             if(email) profileUpdate.email = email;
             await supabaseAdmin.from('user_profiles').update(profileUpdate).eq('id', userId);
         }
         return response.status(200).json({ message: 'Credenciais atualizadas.' });
      }

      case 'updateUser': {
        // Atualiza cargo/função DENTRO DO CONTEXTO da empresa atual
        const { userId, name, role, isAdmin, tenantId } = request.body;
        const targetTenant = tenantId || requesterProfile.tenantId;

        // Atualiza Perfil (Nome é global)
        if (name) await supabaseAdmin.from('user_profiles').update({ name }).eq('id', userId);

        // Atualiza Vínculo (Role é específico do tenant)
        const finalRole = role || (isAdmin ? 'Administrador' : 'Membro');
        const { error } = await supabaseAdmin.from('user_tenants').update({ role: finalRole })
            .eq('user_id', userId).eq('tenant_id', targetTenant);
        
        if (error) throw error;
        return response.status(200).json({ message: 'Membro atualizado!' });
      }

      case 'deleteUser': {
        const { userId, tenantId } = request.body;
        const targetTenant = tenantId || requesterProfile.tenantId;

        if (!isSuperAdmin) {
            // Verifica se quem pede tem acesso ao tenant do alvo
             if (requesterProfile.tenantId !== targetTenant) return response.status(403).json({ error: 'Não autorizado.' });
        }

        // Remove APENAS o vínculo com este tenant
        const { error } = await supabaseAdmin.from('user_tenants').delete().eq('user_id', userId).eq('tenant_id', targetTenant);
        if (error) throw error;

        // Se for Super Admin e quiser deletar conta globalmente, teria que ser outra action ou verificar se não há mais vínculos.
        // Por padrão no escopo multi-tenant, "Remover Usuário" na tela de equipe significa remover daquela equipe.

        return response.status(200).json({ message: 'Acesso revogado.' });
      }

      default:
        return response.status(400).json({ error: 'Ação desconhecida.' });
    }

  } catch (error) {
    console.error("API Error:", error);
    return response.status(500).json({ error: error.message || 'Erro interno.' });
  }
}