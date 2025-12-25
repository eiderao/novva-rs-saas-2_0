// src/utils/evaluationLogic.js

// Calcula a nota de UM pilar (0 a 10)
// Retorna null se não houver respostas (para não contar como zero na média)
export const calculatePillarScore = (sectionName, criteriaList, answers, ratingScale) => {
    if (!criteriaList || !Array.isArray(criteriaList) || criteriaList.length === 0) return null;
    
    let totalScore = 0;
    let totalWeightAnswered = 0;
    let hasAnswers = false;

    criteriaList.forEach(criterion => {
        // Tenta pegar a resposta (suporta estrutura aninhada ou plana)
        const noteId = answers?.[sectionName]?.[criterion.name] || answers?.[criterion.name];
        
        // Verifica se existe nota e se não é "NA"
        if (noteId && noteId !== 'NA') {
            const noteObj = ratingScale.find(n => n.id === noteId);
            if (noteObj) {
                hasAnswers = true;
                // Peso do critério (se não tiver, assume 1)
                const weight = Number(criterion.weight) || 1; 
                
                // Soma Ponderada: Valor da Nota * Peso
                totalScore += (Number(noteObj.valor) * weight);
                totalWeightAnswered += weight;
            }
        }
    });

    // Se não respondeu nada neste pilar, retorna null (neutro)
    if (!hasAnswers || totalWeightAnswered === 0) return null;

    // Normaliza para a escala 0-10 (Regra de três com os pesos respondidos)
    return (totalScore / totalWeightAnswered);
};

// Processa a avaliação completa
export const processEvaluation = (evaluationObj, parameters) => {
    // Proteção contra nulos
    if (!evaluationObj || !parameters) {
        return { triagem: 0, cultura: 0, tecnico: 0, total: 0, pillarsCount: 0 };
    }

    const answers = evaluationObj.scores || evaluationObj; 
    const ratingScale = parameters.notas || [];

    // Normaliza nome do parâmetro técnico
    const tecnicoParams = parameters.tecnico || parameters['técnico'] || parameters['tÃ©cnico'] || [];

    // Calcula parciais (pode retornar número ou null)
    const triagem = calculatePillarScore('triagem', parameters.triagem, answers, ratingScale);
    const cultura = calculatePillarScore('cultura', parameters.cultura, answers, ratingScale);
    const tecnico = calculatePillarScore('tecnico', tecnicoParams, answers, ratingScale);

    // Lógica da Média Dinâmica (Ignora nulos)
    let sum = 0;
    let count = 0;

    if (triagem !== null) { sum += triagem; count++; }
    if (cultura !== null) { sum += cultura; count++; }
    if (tecnico !== null) { sum += tecnico; count++; }

    // Se não avaliou nenhum pilar, nota é 0. Senão, é a média dos pilares avaliados.
    const total = count > 0 ? (sum / count) : 0;

    return {
        triagem: triagem !== null ? Number(triagem.toFixed(2)) : null,
        cultura: cultura !== null ? Number(cultura.toFixed(2)) : null,
        tecnico: tecnico !== null ? Number(tecnico.toFixed(2)) : null,
        total: Number(total.toFixed(2)),
        pillarsEvaluated: count // Útil para debug
    };
};