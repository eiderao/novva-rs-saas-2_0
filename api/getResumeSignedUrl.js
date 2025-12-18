// api/getResumeSignedUrl.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Validação de segurança (só usuários logados podem pedir links)
    const authHeader = request.headers['authorization'];
    if (!authHeader) return response.status(401).json({ error: 'Não autorizado.' });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) return response.status(401).json({ error: 'Token inválido.' });

    // Pega o caminho do arquivo que o frontend quer acessar
    const { filePath } = request.query;
    if (!filePath) {
      return response.status(400).json({ error: 'O caminho do arquivo é obrigatório.' });
    }

    // Gera uma URL assinada e segura, com validade de 60 segundos
    const { data, error: urlError } = await supabaseAdmin
      .storage
      .from('resumes')
      .createSignedUrl(filePath, 60); // 60 segundos de validade

    if (urlError) throw urlError;

    return response.status(200).json({ signedUrl: data.signedUrl });

  } catch (error) {
    console.error("Erro ao gerar URL assinada:", error);
    return response.status(500).json({ error: 'Erro interno do servidor.' });
  }
}