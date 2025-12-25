export const calculatePillarScore = (sectionName, criteriaList, answers, ratingScale) => {
    if (!criteriaList || !Array.isArray(criteriaList) || criteriaList.length === 0) return null;
    
    let totalScore = 0;
    let totalWeightAnswered = 0;
    let hasAnswers = false;

    criteriaList.forEach(criterion => {
        const noteId = answers?.[sectionName]?.[criterion.name] || answers?.[criterion.name];
        
        if (noteId && noteId !== 'NA') {
            const noteObj = ratingScale.find(n => n.id === noteId);
            if (noteObj) {
                hasAnswers = true;
                const weight = Number(criterion.weight) || 1;
                totalScore += (Number(noteObj.valor) * weight);
                totalWeightAnswered += weight;
            }
        }
    });

    if (!hasAnswers || totalWeightAnswered === 0) return null;
    return (totalScore / totalWeightAnswered);
};

export const processEvaluation = (evaluationObj, parameters) => {
    if (!evaluationObj || !parameters) {
        return { triagem: 0, cultura: 0, tecnico: 0, total: 0 };
    }

    const answers = evaluationObj.scores || evaluationObj; 
    const ratingScale = parameters.notas || [];
    
    // Normalização de nomes
    const pTriagem = parameters.triagem || [];
    const pCultura = parameters.cultura || [];
    const pTecnico = parameters.tecnico || parameters['técnico'] || parameters['tÃ©cnico'] || [];

    const triagem = calculatePillarScore('triagem', pTriagem, answers, ratingScale);
    const cultura = calculatePillarScore('cultura', pCultura, answers, ratingScale);
    const tecnico = calculatePillarScore('tecnico', pTecnico, answers, ratingScale);

    // Média dos pilares válidos
    let sum = 0;
    let count = 0;
    if (triagem !== null) { sum += triagem; count++; }
    if (cultura !== null) { sum += cultura; count++; }
    if (tecnico !== null) { sum += tecnico; count++; }

    const total = count > 0 ? (sum / count) : 0;

    return {
        triagem: triagem !== null ? Number(triagem) : 0,
        cultura: cultura !== null ? Number(cultura) : 0,
        tecnico: tecnico !== null ? Number(tecnico) : 0,
        total: Number(total)
    };
};