import os

# Configurações - Adicione ou remova extensões/pastas conforme necessário
EXTENSOES_PERMITIDAS = {
    '.js', '.jsx', '.ts', '.tsx',  # Web / React / Node
    '.html', '.css', '.scss',      # Front-end
    '.py', '.java', '.cs', '.php', # Back-end
    '.sql', '.prisma',             # Banco de Dados
    '.json', '.xml', '.yml',       # Configurações
    '.dart', '.swift', '.kt'       # Mobile
}

PASTAS_IGNORADAS = {
    'node_modules', '.git', '.idea', '.vscode', 
    'dist', 'build', 'coverage', 'venv', '__pycache__',
    'bin', 'obj', 'android', 'ios' # Ignorando pastas nativas pesadas se for React Native/Flutter (pode remover se precisar de configs nativas)
}

ARQUIVOS_IGNORADOS = {
    'package-lock.json', 'yarn.lock', 'gerar_contexto.py'
}

def deve_processar(caminho_arquivo):
    _, ext = os.path.splitext(caminho_arquivo)
    nome_arquivo = os.path.basename(caminho_arquivo)
    
    if nome_arquivo in ARQUIVOS_IGNORADOS:
        return False
    return ext in EXTENSOES_PERMITIDAS

def gerar_txt_projeto():
    saida = "projeto_completo.txt"
    
    with open(saida, 'w', encoding='utf-8') as f_out:
        # Adiciona a estrutura de pastas primeiro (TREE)
        f_out.write("--- ESTRUTURA DE DIRETÓRIOS ---\n")
        for root, dirs, files in os.walk('.'):
            # Filtra pastas ignoradas para não descer nelas
            dirs[:] = [d for d in dirs if d not in PASTAS_IGNORADAS]
            level = root.replace('.', '', 1).count(os.sep)
            indent = ' ' * 4 * (level)
            f_out.write(f"{indent}{os.path.basename(root)}/\n")
            subindent = ' ' * 4 * (level + 1)
            for f in files:
                f_out.write(f"{subindent}{f}\n")
        
        f_out.write("\n\n--- CONTEÚDO DOS ARQUIVOS ---\n\n")

        # Adiciona o conteúdo dos arquivos
        for root, dirs, files in os.walk('.'):
            dirs[:] = [d for d in dirs if d not in PASTAS_IGNORADAS]
            
            for file in files:
                caminho_completo = os.path.join(root, file)
                
                if deve_processar(caminho_completo):
                    f_out.write(f"\n{'='*50}\n")
                    f_out.write(f"CAMINHO: {caminho_completo}\n")
                    f_out.write(f"{'='*50}\n")
                    
                    try:
                        with open(caminho_completo, 'r', encoding='utf-8') as f_in:
                            f_out.write(f_in.read())
                    except Exception as e:
                        f_out.write(f"[Erro ao ler arquivo: {e}]\n")

    print(f"Sucesso! Arquivo '{saida}' gerado. Basta enviá-lo para a IA.")

if __name__ == "__main__":
    gerar_txt_projeto()