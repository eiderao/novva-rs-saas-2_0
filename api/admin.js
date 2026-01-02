import { createClient } from '@supabase/supabase-js';

// Função auxiliar de segurança e validação
async function validateAdmin(request) {
  // Conecta com a chave SERVICE_ROLE (Super Usuário)
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
    .select('id, is_admin_system, tenantId, role, isAdmin')
    .eq('id', user.id)
    .single();

  if (profileError || !userData) {
      // Fallback: Se der erro de busca, tenta validar se é o usuário mestre pelo email (hardcoded security)
      // Isso evita o "lockout" se o perfil sumir do banco
      if (user.email === 'eider@novvaempresa.com.br') { // Opcional: Trava de segurança extra
          return { supabaseAdmin, requesterProfile: { is_admin_system: true, id: user.id }, requesterId: user.id };
      }
      throw new Error('Perfil de usuário não encontrado.');
  }
  
  return { supabaseAdmin, requesterProfile: userData, requesterId: user.id };
}

export default async function handler(request, response) {
  try {
    const { supabaseAdmin, requesterProfile } = await validateAdmin(request);
    
    // Suporta GET e POST
    const action = request.method === 'GET' ? request.query.action : request.body.action;
    const isSuperAdmin = requesterProfile.is_admin_system === true;

    switch (action) {
      // ======================================================================
      // 1. GESTÃO DE EMPRESAS E DASHBOARD (Área Novva)
      // ======================================================================

      case 'getTenantsAndPlans': {
        if (!isSuperAdmin) return response.status(403).json({ error: 'Acesso negado. Apenas Novva.' });
        
        // Busca Tenants
        const { data: tenants, error: tErr } = await supabaseAdmin
          .from('tenants')
          .select(`id, companyName, planId, cnpj, plans ( name )`)
          .order('created_at', { ascending: false });
        if (tErr) throw tErr;

        // Busca Planos
        const { data: plans, error: pErr } = await supabaseAdmin
          .from('plans')
          .select('*')
          .order('price', { ascending: true });
        if (pErr) throw pErr;

        return response.status(200).json({ tenants, plans });
      }

      case 'provisionTenant': {
        // Cria Empresa + Usuário Admin (Fluxo Completo)
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
            // Rollback: Apaga tenant se falhar o user
            await supabaseAdmin.from('tenants').delete().eq('id', newTenant.id);
            throw aErr;
        }

        // C. Criar Perfil Admin vinculado ao Tenant
        const { error: pErr } = await supabaseAdmin.from('user_profiles').insert({
            id: authUser.user.id,
            name: adminName,
            email: adminEmail,
            role: 'admin',
            isAdmin: true,
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
        
        // Limpeza simples (Idealmente teria Cascade no banco)
        await supabaseAdmin.from('user_profiles').delete().eq('tenantId', tenantId);
        const { error } = await supabaseAdmin.from('tenants').delete().eq('id', tenantId);
        if (error) throw error;
        
        return response.status(200).json({ message: 'Empresa excluída.' });
      }

      // ======================================================================
      // 2. GESTÃO DE USUÁRIOS E EQUIPE (Área do Cliente)
      // ======================================================================

      case 'getTenantDetails': {
        // Usado pelo Settings.jsx
        const { tenantId } = request.query;
        if (!tenantId) return response.status(400).json({ error: 'ID obrigatório.' });
        
        // Segurança: Só acessa se for Super Admin OU se pertencer ao tenant
        if (!isSuperAdmin && requesterProfile.tenantId !== tenantId) {
            return response.status(403).json({ error: 'Não autorizado.' });
        }

        const { data: tenant } = await supabaseAdmin.from('tenants').select('id, companyName, planId').eq('id', tenantId).single();
        const { data: users } = await supabaseAdmin.from('user_profiles').select('*').eq('tenantId', tenantId);
        
        return response.status(200).json({ tenant, users });
      }

      case 'createUser': {
        // Cria usuário de equipe (Recrutador/Gerente)
        const { email, password, name, role, isAdmin, tenantId } = request.body;
        
        if (!isSuperAdmin && requesterProfile.tenantId !== tenantId) {
            return response.status(403).json({ error: 'Não autorizado para esta empresa.' });
        }

        const { data: authUser, error: aErr } = await supabaseAdmin.auth.admin.createUser({
            email, password, email_confirm: true, user_metadata: { name }
        });
        if (aErr) throw aErr;

        const { error: pErr } = await supabaseAdmin.from('user_profiles').insert({
            id: authUser.user.id, name, email, role, isAdmin: !!isAdmin, tenantId, active: true, is_admin_system: false
        });
        if (pErr) {
            await supabaseAdmin.auth.admin.deleteUser(authUser.user.id); // Rollback
            throw pErr;
        }

        return response.status(201).json({ message: 'Usuário criado.' });
      }

      case 'deleteUser': {
        const { userId } = request.body;
        
        // Verificação de segurança manual (caso não seja super admin)
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