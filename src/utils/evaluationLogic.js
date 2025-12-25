// src/utils/evaluationLogic.js

/**
 * Calcula a nota de um pilar específico (Triagem, Cultura, Técnico)
 * Regra: Soma (Nota * Peso) / Soma dos Pesos Respondidos
 * Retorna: 0 a 10 (ou null se não houve avaliação)
 */
export const calculatePillarScore = (sectionName, criteriaList, answers, ratingScale) => {
    if (!criteriaList || !Array.isArray(criteriaList) || criteriaList.length === 0) return null;
    
    let totalScore = 0;
    let totalWeightAnswered = 0;
    let hasAnswers = false;

    criteriaList.forEach(criterion => {
        // Busca resposta suportando estrutura aninhada (v2) ou plana (v1)
        const noteId = answers?.[sectionName]?.[criterion.name] || answers?.[criterion.name];
        
        // Ignora 'NA' ou não respondidos
        if (noteId && noteId !== 'NA') {
            const noteObj = ratingScale.find(n => n.id === noteId);
            if (noteObj) {
                hasAnswers = true;
                const weight = Number(criterion.weight) || 0; // Se peso for 0, não soma
                
                // Ex: Nota 10 * Peso 20 = 200
                totalScore += (Number(noteObj.valor) * weight);
                totalWeightAnswered += weight;
            }
        }
    });

    if (!hasAnswers || totalWeightAnswered === 0) return null;

    // Normalização: (200 / 20) = 10. Mantém a escala 0-10.
    return (totalScore / totalWeightAnswered);
};

/**
 * Processa a avaliação completa de um usuário
 * Regra: Média Aritmética dos 3 Pilares (se avaliados)
 */
export const processEvaluation = (evaluationObj, parameters) => {
    // Proteção contra dados vazios
    if (!evaluationObj || !parameters) {
        return { triagem: 0, cultura: 0, tecnico: 0, total: 0 };
    }

    const answers = evaluationObj.scores || evaluationObj; 
    const ratingScale = parameters.notas || [];
    
    // Normalização dos nomes dos parâmetros (para evitar erro de acentuação)
    const pTriagem = parameters.triagem || [];
    const pCultura = parameters.cultura || [];
    const pTecnico = parameters.tecnico || parameters['técnico'] || parameters['tÃ©cnico'] || [];

    const triagem = calculatePillarScore('triagem', pTriagem, answers, ratingScale);
    const cultura = calculatePillarScore('cultura', pCultura, answers, ratingScale);
    const tecnico = calculatePillarScore('tecnico', pTecnico, answers, ratingScale);

    // Média dos pilares (Regra 2.2.2: Média entre os 3 pilares)
    // Se um pilar for null (não avaliado), não entra na conta da média
    let sum = 0;
    let count = 0;

    if (triagem !== null) { sum += triagem; count++; }
    if (cultura !== null) { sum += cultura; count++; }
    if (tecnico !== null) { sum += tecnico; count++; }

    // Se count for 0, nota é 0.
    const total = count > 0 ? (sum / count) : 0;

    return {
        triagem: triagem !== null ? Number(triagem) : 0,
        cultura: cultura !== null ? Number(cultura) : 0,
        tecnico: tecnico !== null ? Number(tecnico) : 0,
        total: Number(total)
    };
};