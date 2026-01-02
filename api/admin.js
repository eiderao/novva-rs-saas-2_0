import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  // --- ÁREA DE DIAGNÓSTICO (DEBUG) ---
  const debugReport = {};
  
  try {
    debugReport.step1 = "Iniciando API";
    
    // 1. Verificando Variáveis de Ambiente (Sem mostrar a chave inteira por segurança)
    const serviceKey = process.env.SUPABASE_SERVICE_KEY || "";
    const url = process.env.SUPABASE_URL || "";
    
    debugReport.env = {
      hasUrl: !!url,
      urlPrefix: url.substring(0, 15),
      hasServiceKey: !!serviceKey,
      keyLength: serviceKey.length,
      // Verifica se a chave service é igual a anon (Erro comum)
      isSameAsAnon: serviceKey === process.env.VITE_SUPABASE_ANON_KEY ? "SIM (ERRO CRÍTICO)" : "Não (Correto)",
      // Chaves Service geralmente começam com eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
      keyStart: serviceKey.substring(0, 10) + "..."
    };

    if (!serviceKey || !url) {
      throw new Error("Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_KEY faltando na Vercel.");
    }

    // 2. Criando Cliente Admin
    const supabaseAdmin = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 3. Verificando Token de Autorização
    const authHeader = request.headers['authorization'];
    if (!authHeader) throw new Error("Header Authorization ausente.");
    
    const token = authHeader.replace('Bearer ', '');
    debugReport.tokenReceived = "Sim (Comprimento: " + token.length + ")";

    // 4. Validando Usuário no Auth
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError) {
      debugReport.authError = authError;
      throw new Error("Falha ao validar token no Supabase Auth: " + authError.message);
    }
    
    if (!user) throw new Error("Token válido, mas usuário retornou NULL.");
    
    debugReport.authUserFound = {
      id: user.id,
      email: user.email
    };

    // 5. Buscando Perfil no Banco (Onde estava falhando)
    // Vamos tentar buscar SEM filtro primeiro para ver se a conexão funciona
    const { count, error: countError } = await supabaseAdmin.from('user_profiles').select('*', { count: 'exact', head: true });
    debugReport.dbConnectionTest = {
      success: !countError,
      totalProfilesInDb: count,
      error: countError
    };

    // Agora busca o perfil específico
    const { data: userData, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    debugReport.profileQuery = {
      targetId: user.id,
      foundData: userData,
      error: profileError
    };

    if (!userData) {
       // Se não achou, vamos retornar o relatório de erro AGORA
       return response.status(404).json({
         error: "Perfil não encontrado (Debug Mode)",
         diagnosis: debugReport
       });
    }

    // === SE CHEGOU AQUI, O USUÁRIO EXISTE ===
    // Vamos executar a ação solicitada
    
    const action = request.method === 'GET' ? request.query.action : request.body.action;
    debugReport.action = action;

    if (action === 'getTenantsAndPlans') {
        // Busca simplificada para teste
        const { data: plans, error: planError } = await supabaseAdmin.from('plans').select('*');
        const { data: tenants, error: tenantError } = await supabaseAdmin.from('tenants').select('*');
        
        return response.status(200).json({
            tenants: tenants || [],
            plans: plans || [],
            debug: debugReport // Envia o relatório junto com o sucesso
        });
    }

    // (Outras ações simplificadas para o teste...)
    if (action === 'provisionTenant' || action === 'createTenant') {
        return response.status(200).json({ message: "Teste de conexão OK. Ação simulada.", debug: debugReport });
    }

    return response.status(200).json({ 
        message: "Conexão Backend <-> Banco estabelecida com sucesso!",
        user: userData,
        debug: debugReport
    });

  } catch (error) {
    return response.status(500).json({
      error: "Erro Fatal no Backend",
      message: error.message,
      fullDebug: debugReport
    });
  }
}