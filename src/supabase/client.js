// src/supabase/client.js (Versão de Depuração)
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// --- NOSSO TESTE DE DEPURAÇÃO ---
// Estas linhas irão imprimir no console do seu navegador as chaves que o app está realmente usando.
console.log("--- INICIANDO VERIFICAÇÃO DE CHAVES SUPABASE ---");
console.log("URL EM USO:", supabaseUrl);
console.log("CHAVE ANON EM USO:", supabaseAnonKey);
console.log("-------------------------------------------");
// --- FIM DO TESTE ---

// Se a URL ou a Chave estiverem vazias, o comando abaixo irá falhar.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)