// src/utils/evaluationLogic.js

export const calculatePillarScore = (sectionName, criteriaList, answers, ratingScale) => {
    if (!criteriaList || !Array.isArray(criteriaList) || criteriaList.length === 0) return null;
    if (!answers) return null;
    
    let totalScore = 0;
    let totalWeightAnswered = 0;
    let hasAnswers = false;

    // Respostas podem estar aninhadas (v2) ou planas (legado/erro)
    const sectionAnswers = answers[sectionName] || answers; 

    criteriaList.forEach(criterion => {
        const noteId = sectionAnswers[criterion.name];
        
        if (noteId && noteId !== 'NA') {
            // CORREÇÃO CRÍTICA: Força conversão para String para comparar UUIDs ou IDs numéricos
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
    
    // Normaliza para base 100 se necessário, mas o cálculo ponderado direto é mais seguro
    return (totalScore / totalWeightAnswered); 
};

export const processEvaluation = (evaluationObj, parameters) => {
    if (!evaluationObj || !parameters) {
        return { triagem: 0, cultura: 0, tecnico: 0, total: 0 };
    }

    // Garante que estamos lendo o objeto de respostas, seja ele o 'scores' ou o próprio objeto
    const answers = evaluationObj.scores || evaluationObj; 
    const ratingScale = parameters.notas || [];
    
    const pTriagem = parameters.triagem || [];
    const pCultura = parameters.cultura || [];
    const pTecnico = parameters.tecnico || parameters['técnico'] || [];

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

export const generateDefaultBenchmarkScores = (parameters) => {
    const notes = parameters.notas || [];
    if (notes.length === 0) return { triagem: {}, cultura: {}, tecnico: {} };

    const sortedNotes = [...notes].sort((a, b) => Number(a.valor) - Number(b.valor));
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