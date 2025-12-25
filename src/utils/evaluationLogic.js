// src/utils/evaluationLogic.js

// Calcula a nota de UM pilar (0 a 10)
export const calculatePillarScore = (sectionName, criteriaList, answers, ratingScale) => {
    if (!criteriaList || !Array.isArray(criteriaList) || criteriaList.length === 0) return 0;
    
    let totalScore = 0;
    let totalWeightAnswered = 0;
    let hasAnswers = false;

    criteriaList.forEach(criterion => {
        // Tenta pegar a resposta (suporta estrutura aninhada ou plana)
        const noteId = answers?.[sectionName]?.[criterion.name] || answers?.[criterion.name];
        
        if (noteId && noteId !== 'NA') {
            const noteObj = ratingScale.find(n => n.id === noteId);
            if (noteObj) {
                hasAnswers = true;
                const weight = Number(criterion.weight) || 0;
                // Soma: Valor da Nota * Peso
                totalScore += (Number(noteObj.valor) * weight);
                totalWeightAnswered += weight;
            }
        }
    });

    // Se não respondeu nada ou pesos somam 0, retorna 0
    if (!hasAnswers || totalWeightAnswered === 0) return 0;

    // Normaliza para a escala 0-10
    // Ex: Se respondeu itens que somam peso 50 e tirou total 500, resultado = 500/50 = 10.
    return (totalScore / totalWeightAnswered);
};

// Processa TODA a avaliação e retorna os totais
export const processEvaluation = (evaluationObj, parameters) => {
    if (!evaluationObj || !parameters) return { triagem: 0, cultura: 0, tecnico: 0, total: 0 };

    const answers = evaluationObj.scores || evaluationObj; 
    const ratingScale = parameters.notas || [];

    // Tratamento de variação de nomes (técnico com/sem acento)
    const tecnicoParams = parameters.tecnico || parameters['técnico'] || parameters['tÃ©cnico'] || [];

    const triagem = calculatePillarScore('triagem', parameters.triagem, answers, ratingScale);
    const cultura = calculatePillarScore('cultura', parameters.cultura, answers, ratingScale);
    const tecnico = calculatePillarScore('tecnico', tecnicoParams, answers, ratingScale);

    // Média aritmética dos 3 pilares
    const total = (triagem + cultura + tecnico) / 3;

    return {
        triagem: Number(triagem.toFixed(2)),
        cultura: Number(cultura.toFixed(2)),
        tecnico: Number(tecnico.toFixed(2)),
        total: Number(total.toFixed(2))
    };
};