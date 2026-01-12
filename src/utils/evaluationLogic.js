// src/utils/evaluationLogic.js

export const calculatePillarScore = (sectionName, criteriaList, answers, ratingScale) => {
    // Validações básicas de entrada
    if (!criteriaList || !Array.isArray(criteriaList) || criteriaList.length === 0) return null;
    if (!answers) return null;
    
    let totalScore = 0;
    let totalWeightAnswered = 0;
    let hasAnswers = false;

    criteriaList.forEach(criterion => {
        // CORREÇÃO CRÍTICA (Restaurada da versão funcional):
        // Tenta acessar o valor de duas formas para suportar estruturas V1 (Plana) e V2 (Aninhada por seção)
        // 1. Tenta answers.secao.criterio (Estrutura V2 ideal)
        // 2. Tenta answers.criterio (Estrutura V1 antiga ou erro de migração)
        const noteId = answers?.[sectionName]?.[criterion.name] || answers?.[criterion.name];
        
        // Ignora 'NA', null ou undefined
        if (noteId && noteId !== 'NA') {
            // Conversão para String garante comparação segura entre UUIDs e IDs numéricos
            const noteObj = ratingScale.find(n => String(n.id) === String(noteId));
            
            if (noteObj) {
                hasAnswers = true;
                const weight = Number(criterion.weight) || 0;
                
                // Cálculo Ponderado: Valor da Nota * Peso do Critério
                totalScore += (Number(noteObj.valor) * weight);
                totalWeightAnswered += weight;
            }
        }
    });

    // Se nenhum critério foi respondido (ou peso total é 0), retorna null para não afetar a média geral
    if (!hasAnswers || totalWeightAnswered === 0) return null;

    // Retorna a média ponderada simples
    return (totalScore / totalWeightAnswered);
};

export const processEvaluation = (evaluationObj, parameters) => {
    if (!evaluationObj || !parameters) {
        return { triagem: 0, cultura: 0, tecnico: 0, total: 0 };
    }

    // Suporte para quando evaluationObj já é o objeto de respostas (legado) ou tem chave 'scores' (novo)
    const answers = evaluationObj.scores || evaluationObj; 
    const ratingScale = parameters.notas || [];
    
    // Definição das seções com fallback para variações de nome (ex: acentos)
    const pTriagem = parameters.triagem || [];
    const pCultura = parameters.cultura || [];
    // Normalização agressiva para 'tecnico'
    const pTecnico = parameters.tecnico || parameters['técnico'] || parameters['tÃ©cnico'] || [];

    // Calcula nota de cada pilar
    const triagem = calculatePillarScore('triagem', pTriagem, answers, ratingScale);
    const cultura = calculatePillarScore('cultura', pCultura, answers, ratingScale);
    const tecnico = calculatePillarScore('tecnico', pTecnico, answers, ratingScale);

    // Média Aritmética Simples dos pilares que tiveram resposta (não nulos)
    let sum = 0;
    let count = 0;

    if (triagem !== null) { sum += triagem; count++; }
    if (cultura !== null) { sum += cultura; count++; }
    if (tecnico !== null) { sum += tecnico; count++; }

    // Se nenhum pilar foi avaliado, a nota geral é 0
    const total = count > 0 ? (sum / count) : 0;

    return {
        triagem: triagem !== null ? Number(triagem) : 0,
        cultura: cultura !== null ? Number(cultura) : 0,
        tecnico: tecnico !== null ? Number(tecnico) : 0,
        total: Number(total)
    };
};

// Gera gabarito padrão (para uso futuro ou testes)
export const generateDefaultBenchmarkScores = (parameters) => {
    const notes = parameters.notas || [];
    if (notes.length === 0) return { triagem: {}, cultura: {}, tecnico: {} };

    const sortedNotes = [...notes].sort((a, b) => Number(a.valor) - Number(b.valor));
    
    // Pega a nota central (mediana)
    const centerIndex = Math.floor(sortedNotes.length / 2);
    const defaultNoteId = sortedNotes[centerIndex]?.id;

    const benchmarkScores = { triagem: {}, cultura: {}, tecnico: {} };

    ['triagem', 'cultura', 'tecnico'].forEach(section => {
        const criteria = parameters[section] || [];
        criteria.forEach(c => {
            benchmarkScores[section] = benchmarkScores[section] || {};
            benchmarkScores[section][c.name] = defaultNoteId;
        });
    });

    return benchmarkScores;
};