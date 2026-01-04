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
        
        // D. Criar Vínculo
        await supabaseAdmin.from('user_tenants').insert({
            user_id: authUser.user.id,
            tenant_id: newTenant.id,
            role: 'admin'
        });

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
        
        // Remove vínculos e perfis associados (se necessário) antes de deletar o tenant
        await supabaseAdmin.from('user_tenants').delete().eq('tenant_id', tenantId);
        // Nota: Perfis podem ficar órfãos ou precisar de lógica para reatribuir tenantId padrão
        // Para simplificar, deletamos o tenant e o banco lida com o resto se houver cascade configurado
        
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
        
        // Agora busca usuários através da tabela de relacionamento user_tenants para suportar multi-tenant
        const { data: tenantUsers, error: usersError } = await supabaseAdmin
            .from('user_tenants')
            .select(`
                role,
                user:user_profiles (id, name, email, is_admin_system)
            `)
            .eq('tenant_id', tenantId);

        if (usersError) throw usersError;

        // Formata para o frontend
        const users = tenantUsers.map(tu => ({
            id: tu.user?.id,
            name: tu.user?.name,
            email: tu.user?.email,
            is_admin_system: tu.user?.is_admin_system,
            role: tu.role // O cargo específico nesta empresa
        })).filter(u => u.id); // Remove nulos caso haja inconsistência
        
        return response.status(200).json({ tenant, users });
      }

      case 'createUser': {
        const { email, password, name, role, isAdmin, tenantId } = request.body;
        
        if (!isSuperAdmin && requesterProfile.tenantId !== tenantId) {
            return response.status(403).json({ error: 'Não autorizado para esta empresa.' });
        }

        const finalRole = role || (isAdmin ? 'Administrador' : 'Recrutador');

        // 1. Tenta buscar usuário existente pelo email (usando user_profiles como índice)
        const { data: existingUser } = await supabaseAdmin
            .from('user_profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (existingUser) {
            // --- CENÁRIO A: Usuário Já Existe ---
            // Verifica se já está vinculado a esta empresa
            const { data: existingLink } = await supabaseAdmin
                .from('user_tenants')
                .select('id')
                .eq('user_id', existingUser.id)
                .eq('tenant_id', tenantId)
                .maybeSingle();

            if (existingLink) {
                return response.status(409).json({ error: 'Este usuário já faz parte desta empresa.' });
            }

            // Cria apenas o vínculo novo
            await supabaseAdmin.from('user_tenants').insert({
                user_id: existingUser.id,
                tenant_id: tenantId,
                role: finalRole
            });

            return response.status(200).json({ message: 'Usuário existente vinculado com sucesso!' });

        } else {
            // --- CENÁRIO B: Usuário Novo ---
            const { data: authUser, error: aErr } = await supabaseAdmin.auth.admin.createUser({
                email, password, email_confirm: true, user_metadata: { name }
            });
            if (aErr) throw aErr;

            // Cria Perfil Base
            const { error: pErr } = await supabaseAdmin.from('user_profiles').insert({
                id: authUser.user.id, 
                name, 
                email, 
                role: finalRole, // Define role padrão no perfil (pode ser sobrescrito pelo contexto)
                tenantId,       // Define tenant inicial
                active: true, 
                is_admin_system: false
            });
            
            if (pErr) {
                await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
                throw pErr;
            }

            // Cria Vínculo user_tenants
            await supabaseAdmin.from('user_tenants').insert({
                user_id: authUser.user.id,
                tenant_id: tenantId,
                role: finalRole
            });

            return response.status(201).json({ message: 'Usuário criado e vinculado.' });
        }
      }

      case 'updateUserAuth': {
        // Atualização de credenciais (Nome/Senha/Email) - Global
        if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST.' });
        if (!isSuperAdmin) return response.status(403).json({ error: 'Apenas Super Admin.' });

        const { userId, email, password, name } = request.body;
        if (!userId) return response.status(400).json({ error: 'ID necessário.' });

        const updateData = { email_confirm: true };
        if (email) updateData.email = email;
        if (password) updateData.password = password;
        if (name) updateData.user_metadata = { name };

        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData);
        if (authError) throw authError;

        const profileUpdate = {};
        if (email) profileUpdate.email = email;
        if (name) profileUpdate.name = name;

        if (Object.keys(profileUpdate).length > 0) {
            await supabaseAdmin.from('user_profiles').update(profileUpdate).eq('id', userId);
        }

        return response.status(200).json({ message: 'Credenciais atualizadas!' });
      }

      case 'updateUser': {
        // Atualiza cargo/função DENTRO DO CONTEXTO da empresa atual (user_tenants)
        // OBS: Isso difere da versão anterior que atualizava user_profiles globalmente
        const { userId, name, role, isAdmin } = request.body;
        // Precisamos do tenantId para saber QUAL vínculo atualizar. 
        // Se a request vier do Settings.jsx, ela deve mandar ou pegamos do contexto do admin logado.
        const targetTenantId = request.body.tenantId || requesterProfile.tenantId;

        if (!userId || !targetTenantId) return response.status(400).json({ error: 'ID e Empresa obrigatórios.' });

        // Atualiza o nome globalmente (user_profiles)
        if (name) {
            await supabaseAdmin.from('user_profiles').update({ name }).eq('id', userId);
        }

        // Atualiza o papel na empresa específica (user_tenants)
        const finalRole = role || (isAdmin ? 'Administrador' : 'Membro');
        const { error } = await supabaseAdmin
            .from('user_tenants')
            .update({ role: finalRole })
            .eq('user_id', userId)
            .eq('tenant_id', targetTenantId);
        
        if (error) throw error;
        return response.status(200).json({ message: 'Membro atualizado!' });
      }

      case 'deleteUser': {
        // Remove APENAS O VÍNCULO com a empresa atual.
        // Se for Super Admin e quiser deletar do sistema todo, precisaria de uma flag extra ou outra action.
        const { userId } = request.body;
        const targetTenantId = request.body.tenantId || requesterProfile.tenantId;
        
        if (!isSuperAdmin) {
             // Garante que quem está pedindo tem acesso a esse tenant
             if (requesterProfile.tenantId !== targetTenantId) {
                 return response.status(403).json({ error: 'Não autorizado.' });
             }
        }

        // Remove vínculo
        const { error } = await supabaseAdmin
            .from('user_tenants')
            .delete()
            .eq('user_id', userId)
            .eq('tenant_id', targetTenantId);

        if (error) throw error;

        // Opcional: Se o usuário não tiver mais nenhum tenant, deletar do Auth?
        // Por segurança, mantemos o usuário no sistema (pode ser re-adicionado depois)
        // A menos que seja uma exclusão explicita de "Deletar Conta"

        return response.status(200).json({ message: 'Acesso revogado para esta empresa.' });
      }

      default:
        return response.status(400).json({ error: 'Ação desconhecida.' });
    }

  } catch (error) {
    console.error("API Error:", error);
    return response.status(500).json({ error: error.message || 'Erro interno.' });
  }
}