export const calculatePillarScore = (sectionName, criteriaList, answers, ratingScale) => {
    // Se não houver critérios configurados, não há nota (retorna null para não afetar média)
    if (!criteriaList || !Array.isArray(criteriaList) || criteriaList.length === 0) return null;
    
    let totalScore = 0;
    let totalWeightAnswered = 0;
    let hasAnswers = false;

    criteriaList.forEach(criterion => {
        // Tenta buscar a resposta de todas as formas possíveis (aninhada ou plana)
        const noteId = answers?.[sectionName]?.[criterion.name] || answers?.[criterion.name];
        
        // Verifica se tem nota e se não é 'NA'
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

    // Se não respondeu nada, retorna null
    if (!hasAnswers || totalWeightAnswered === 0) return null;

    // Retorna nota normalizada (0 a 10)
    return (totalScore / totalWeightAnswered);
};

export const processEvaluation = (evaluationObj, parameters) => {
    // Retorna zerado se faltar dados críticos
    if (!evaluationObj || !parameters) {
        return { triagem: 0, cultura: 0, tecnico: 0, total: 0 };
    }

    // Suporta tanto o objeto salvo em 'scores' quanto o objeto raiz direto
    const answers = evaluationObj.scores || evaluationObj; 
    const ratingScale = parameters.notas || [];
    
    const pTriagem = parameters.triagem || [];
    const pCultura = parameters.cultura || [];
    // Tratamento para variações de escrita no banco
    const pTecnico = parameters.tecnico || parameters['técnico'] || parameters['tÃ©cnico'] || [];

    const triagem = calculatePillarScore('triagem', pTriagem, answers, ratingScale);
    const cultura = calculatePillarScore('cultura', pCultura, answers, ratingScale);
    const tecnico = calculatePillarScore('tecnico', pTecnico, answers, ratingScale);

    // Média Aritmética dos pilares que foram avaliados (Ignora null)
    let sum = 0;
    let count = 0;

    if (triagem !== null) { sum += triagem; count++; }
    if (cultura !== null) { sum += cultura; count++; }
    if (tecnico !== null) { sum += tecnico; count++; }

    // Se count for 0, nota é 0. Senão, é a média.
    const total = count > 0 ? (sum / count) : 0;

    return {
        triagem: triagem !== null ? Number(triagem) : 0,
        cultura: cultura !== null ? Number(cultura) : 0,
        tecnico: tecnico !== null ? Number(tecnico) : 0,
        total: Number(total)
    };
};