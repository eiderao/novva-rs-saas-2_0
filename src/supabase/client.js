// src/supabase/client.js (Versão Limpa e Segura)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validação de Segurança:
// Impede que a aplicação inicie "pela metade" se as chaves não existirem.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'ERRO CRÍTICO: As chaves de configuração do Supabase não foram encontradas. ' +
    'Verifique se o arquivo .env existe na raiz do projeto e contém as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);