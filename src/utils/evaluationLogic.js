// src/utils/evaluationLogic.js

export const calculatePillarScore = (sectionName, criteriaList, answers, ratingScale) => {
    if (!criteriaList || !Array.isArray(criteriaList) || criteriaList.length === 0) return null;
    if (!answers) return null;
    
    let totalScore = 0;
    let totalWeightAnswered = 0;
    let hasAnswers = false;

    criteriaList.forEach(criterion => {
        const noteId = answers?.[sectionName]?.[criterion.name] || answers?.[criterion.name];
        
        if (noteId && noteId !== 'NA') {
            const noteObj = ratingScale.find(n => String(n.id) === String(noteId));
            
            if (noteObj) {
                hasAnswers = true;
                const weight = Number(criterion.weight) || 0;
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
    
    const pTriagem = parameters.triagem || [];
    const pCultura = parameters.cultura || [];
    const pTecnico = parameters.tecnico || parameters['técnico'] || parameters['tƒ©cnico'] || [];

    const triagem = calculatePillarScore('triagem', pTriagem, answers, ratingScale);
    const cultura = calculatePillarScore('cultura', pCultura, answers, ratingScale);
    const tecnico = calculatePillarScore('tecnico', pTecnico, answers, ratingScale);

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

// GERA O GABARITO PADRÃO (CENTRO DA RÉGUA)
export const generateDefaultBenchmarkScores = (parameters) => {
    const notes = parameters.notas || [];
    if (notes.length === 0) return { triagem: {}, cultura: {}, tecnico: {} };

    // Ordena por valor
    const sortedNotes = [...notes].sort((a, b) => Number(a.valor) - Number(b.valor));
    
    // Regra: Centro ou primeiro acima do centro se par
    // Ex: [0, 5, 10] (len 3) -> index 1 (5)
    // Ex: [0, 5, 8, 10] (len 4) -> index 2 (8)
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