import { createClient } from '@supabase/supabase-js';

// Função auxiliar para validar quem está chamando a API
async function validateAdmin(request) {
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  
  const authHeader = request.headers['authorization'];
  if (!authHeader) throw new Error('Não autorizado.');
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  
  if (userError || !user) throw new Error('Token inválido.');

  // Busca dados completos do perfil de quem está chamando
  const { data: userData } = await supabaseAdmin
    .from('user_profiles')
    .select('is_admin_system, tenantId, role, isAdmin')
    .eq('id', user.id)
    .single();

  if (!userData) throw new Error('Perfil de usuário não encontrado.');
  
  // Retorna o client admin e os dados do usuário que fez a requisição
  return { supabaseAdmin, requesterProfile: userData, requesterId: user.id };
}

export default async function handler(request, response) {
  try {
    const { supabaseAdmin, requesterProfile } = await validateAdmin(request);
    
    // Suporta tanto GET (query) quanto POST (body)
    const action = request.method === 'GET' ? request.query.action : request.body.action;
    
    // Flag para facilitar verificações: É um Super Admin da Novva?
    const isSuperAdmin = requesterProfile.is_admin_system === true;

    switch (action) {
      // ======================================================================
      // AÇÕES GLOBAIS (Super Admin / Novva)
      // ======================================================================

      case 'getTenantsAndPlans': {
        // Apenas Super Admin pode ver todas as empresas
        if (!isSuperAdmin) return response.status(403).json({ error: 'Acesso restrito a administradores do sistema.' });
        
        const { data: tenants, error: tenantsError } = await supabaseAdmin
          .from('tenants')
          .select(`id, companyName, planId, cnpj, plans ( name )`)
          .order('created_at', { ascending: false });
        
        if (tenantsError) throw tenantsError;

        const { data: plans, error: plansError } = await supabaseAdmin
          .from('plans')
          .select('*')
          .order('price', { ascending: true });
          
        if (plansError) throw plansError;

        return response.status(200).json({ tenants, plans });
      }

      // NOVA AÇÃO: Provisionamento Completo (Empresa + Dono)
      case 'provisionTenant': {
        if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST.' });
        if (!isSuperAdmin) return response.status(403).json({ error: 'Apenas Super Admin pode provisionar clientes.' });

        const { companyName, planId, cnpj, adminName, adminEmail, adminPassword } = request.body;

        if (!companyName || !adminEmail || !adminPassword) {
            return response.status(400).json({ error: 'Nome da Empresa, Email do Admin e Senha são obrigatórios.' });
        }

        // 1. Criar Tenant
        const { data: newTenant, error: tenantError } = await supabaseAdmin
          .from('tenants')
          .insert({ companyName, planId, cnpj: cnpj || null })
          .select()
          .single();

        if (tenantError) throw tenantError;

        // 2. Criar Usuário Auth (O Dono)
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: adminEmail,
            password: adminPassword,
            email_confirm: true,
            user_metadata: { name: adminName }
        });

        if (authError) {
            // Rollback: Se falhar ao criar usuário, apaga o tenant para não deixar "lixo" no banco
            await supabaseAdmin.from('tenants').delete().eq('id', newTenant.id);
            throw authError;
        }

        // 3. Criar Perfil do Dono (Admin da Empresa)
        const { error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .insert({
                id: authUser.user.id,
                name: adminName,
                email: adminEmail,
                role: 'admin', // Papel interno na empresa
                isAdmin: true, // Flag de admin legada
                tenantId: newTenant.id,
                is_admin_system: false, // NÃO é admin da Novva
                active: true
            });

        if (profileError) {
             // Rollback total é complexo aqui (deletar user auth), mas lançamos o erro
             throw profileError; 
        }

        return response.status(201).json({ message: 'Empresa e Admin provisionados com sucesso!', tenant: newTenant });
      }

      case 'createTenant': {
        if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST.' });
        if (!isSuperAdmin) return response.status(403).json({ error: 'Proibido.' });

        const { companyName, planId, cnpj } = request.body;
        if (!companyName || !planId) return response.status(400).json({ error: 'Dados incompletos.' });

        const { data: newTenant, error } = await supabaseAdmin
          .from('tenants')
          .insert({ companyName, planId, cnpj: cnpj || null })
          .select('id, companyName, planId, cnpj, plans ( name )')
          .single();
          
        if (error) throw error;
        return response.status(201).json({ message: 'Empresa criada com sucesso!', newTenant });
      }
      
      case 'updateTenant': {
        if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST.' });
        if (!isSuperAdmin) return response.status(403).json({ error: 'Proibido.' });

        const { id, companyName, planId, cnpj } = request.body;
        if (!id || !companyName || !planId) return response.status(400).json({ error: 'ID, Nome e Plano são obrigatórios.' });

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
        if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST.' });
        if (!isSuperAdmin) return response.status(403).json({ error: 'Proibido.' });

        const { tenantId } = request.body;
        if (!tenantId) return response.status(400).json({ error: 'tenantId é obrigatório.' });
        
        // Nota: Isso pode falhar se houver chaves estrangeiras sem CASCADE. 
        // O ideal é limpar filhos antes, mas mantendo simples conforme original.
        const { error } = await supabaseAdmin.from('tenants').delete().eq('id', tenantId);
        if (error) throw error;
        return response.status(200).json({ message: 'Empresa excluída com sucesso!' });
      }

      // ======================================================================
      // AÇÕES DE GESTÃO DE PLANOS (Originais Restauradas)
      // ======================================================================

      case 'createPlan': {
        if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST.' });
        if (!isSuperAdmin) return response.status(403).json({ error: 'Apenas Super Admin gerencia planos.' });
        
        const { planData } = request.body;
        if (!planData) return response.status(400).json({ error: 'Dados do plano ausentes.' });
        
        const { data: newPlan, error } = await supabaseAdmin.from('plans').insert(planData).select().single();
        if (error) throw error;
        return response.status(201).json({ message: 'Plano criado!', newPlan });
      }

      case 'updatePlan': {
        if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST.' });
        if (!isSuperAdmin) return response.status(403).json({ error: 'Proibido.' });

        const { planId, planData } = request.body;
        if (!planId || !planData) return response.status(400).json({ error: 'Dados ausentes.' });
        
        const { data: updatedPlan, error } = await supabaseAdmin.from('plans').update(planData).eq('id', planId).select().single();
        if (error) throw error;
        return response.status(200).json({ message: 'Plano atualizado!', updatedPlan });
      }

      case 'deletePlan': {
        if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST.' });
        if (!isSuperAdmin) return response.status(403).json({ error: 'Proibido.' });

        const { planId } = request.body;
        // Verifica uso antes de deletar
        const { count, error: checkError } = await supabaseAdmin.from('tenants').select('*', { count: 'exact', head: true }).eq('planId', planId);
        if (checkError) throw checkError;
        if (count > 0) return response.status(400).json({ error: `Plano em uso por ${count} empresa(s).` });

        const { error } = await supabaseAdmin.from('plans').delete().eq('id', planId);
        if (error) throw error;
        return response.status(200).json({ message: 'Plano excluído!' });
      }

      // ======================================================================
      // AÇÕES DE USUÁRIOS E TENANT (Usadas pelo Cliente ou Admin)
      // ======================================================================
      
      case 'getTenantDetails': {
        if (request.method !== 'GET') return response.status(405).json({ error: 'Use GET.' });
        
        const { tenantId } = request.query;
        if (!tenantId) return response.status(400).json({ error: 'tenantId obrigatório.' });
        
        // SEGURANÇA: Só pode ver se for Super Admin OU se pertencer ao mesmo Tenant
        if (!isSuperAdmin && requesterProfile.tenantId !== tenantId) {
            return response.status(403).json({ error: 'Você não tem permissão para visualizar dados desta empresa.' });
        }
        
        const { data: tenant, error: tenantError } = await supabaseAdmin.from('tenants').select('id, companyName, planId').eq('id', tenantId).single();
        if (tenantError || !tenant) return response.status(404).json({ error: 'Empresa não encontrada.' });

        const { data: users, error: usersError } = await supabaseAdmin
          .from('user_profiles')
          .select('id, name, email, role, isAdmin, is_admin_system') 
          .eq('tenantId', tenantId);
          
        if (usersError) throw usersError;
        
        return response.status(200).json({ tenant, users });
      }

      case 'createUser': {
        if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST.' });
        
        const { email, password, name, role, isAdmin, tenantId } = request.body;
        if (!email || !password || !name || !tenantId) return response.status(400).json({ error: 'Campos obrigatórios faltando.' });

        // SEGURANÇA: Só pode criar usuário no PRÓPRIO tenant (a menos que seja super admin)
        if (!isSuperAdmin && requesterProfile.tenantId !== tenantId) {
            return response.status(403).json({ error: 'Você não pode criar usuários para outra empresa.' });
        }

        // Cria no Auth
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true,
          user_metadata: { name }
        });
        if (authError) throw authError;

        // Cria no Profile
        const { data: newUser, error: userError } = await supabaseAdmin
          .from('user_profiles')
          .insert({
            id: authUser.user.id,
            name: name,
            email: email,
            role: role || 'recruiter',
            isAdmin: !!isAdmin,
            tenantId: tenantId,
            active: true,
            is_admin_system: false // Usuários criados aqui nunca são super admins
          })
          .select()
          .single();
          
        if (userError) {
          // Tenta limpar o Auth se falhar o Profile
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
          throw userError;
        }
        
        return response.status(201).json({ message: 'Usuário criado com sucesso!', newUser });
      }

      case 'updateUser': {
        if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST.' });
        
        const { userId, name, role, isAdmin } = request.body;
        if (!userId) return response.status(400).json({ error: 'userId obrigatório.' });

        // SEGURANÇA: Verifica se o alvo pertence ao mesmo tenant do solicitante (ou se solicitante é super admin)
        if (!isSuperAdmin) {
             const { data: targetUser } = await supabaseAdmin.from('user_profiles').select('tenantId').eq('id', userId).single();
             if (!targetUser || targetUser.tenantId !== requesterProfile.tenantId) {
                 return response.status(403).json({ error: 'Não autorizado.' });
             }
        }
        
        const { data: updatedUser, error } = await supabaseAdmin
          .from('user_profiles')
          .update({ name, role, isAdmin: !!isAdmin })
          .eq('id', userId)
          .select()
          .single();
          
        if (error) throw error;
        return response.status(200).json({ message: 'Usuário atualizado!', updatedUser });
      }

      case 'deleteUser': {
        if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST.' });
        
        const { userId } = request.body;
        if (!userId) return response.status(400).json({ error: 'userId obrigatório.' });

        // SEGURANÇA: Mesmo check de tenant
        if (!isSuperAdmin) {
             const { data: targetUser } = await supabaseAdmin.from('user_profiles').select('tenantId').eq('id', userId).single();
             if (!targetUser || targetUser.tenantId !== requesterProfile.tenantId) {
                 return response.status(403).json({ error: 'Não autorizado.' });
             }
        }

        // Remove do profile
        const { error: userError } = await supabaseAdmin.from('user_profiles').delete().eq('id', userId);
        if (userError) throw userError;
        
        // Remove do Auth
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authError) throw authError;

        return response.status(200).json({ message: 'Usuário excluído com sucesso!' });
      }
      
      default:
        return response.status(400).json({ error: 'Ação desconhecida.' });
    }

  } catch (error) {
    console.error("Erro na API de Admin:", error.message);
    if (error.message.includes('Não autorizado') || error.message.includes('Token inválido')) {
      return response.status(401).json({ error: error.message });
    }
    if (error.message.includes('permissão') || error.message.includes('Proibido')) {
      return response.status(403).json({ error: error.message });
    }
    return response.status(500).json({ error: 'Erro interno do servidor.', details: error.message });
  }
}