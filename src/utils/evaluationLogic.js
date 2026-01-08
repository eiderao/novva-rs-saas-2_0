// src/utils/evaluationLogic.js

export const calculatePillarScore = (sectionName, criteriaList, answers, ratingScale) => {
    if (!criteriaList || !Array.isArray(criteriaList) || criteriaList.length === 0) return null;
    if (!answers) return null;
    
    let totalScore = 0;
    let totalWeightAnswered = 0;
    let hasAnswers = false;

    criteriaList.forEach(criterion => {
        // Suporta estrutura aninhada (v2) ou plana (v1)
        const noteId = answers?.[sectionName]?.[criterion.name] || answers?.[criterion.name];
        
        if (noteId && noteId !== 'NA') {
            // Garante comparação de string para evitar erros de tipo
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

    // Retorna média ponderada (0 a 10 ou 0 a 100 dependendo da régua)
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

// NOVA FUNÇÃO: Gera respostas padrão baseadas no item central da régua
export const generateDefaultBenchmarkScores = (parameters) => {
    const notes = parameters.notas || [];
    if (notes.length === 0) return { triagem: {}, cultura: {}, tecnico: {} };

    // Ordena notas por valor para achar o centro
    const sortedNotes = [...notes].sort((a, b) => Number(a.valor) - Number(b.valor));
    
    // Pega o índice central. Se par (ex: 4 itens), pega o índice 2 (o terceiro item, acima do meio).
    const centerIndex = Math.floor(sortedNotes.length / 2);
    const centerNoteId = sortedNotes[centerIndex]?.id;

    const benchmark = { triagem: {}, cultura: {}, tecnico: {} };

    // Preenche todos os critérios com a nota central
    ['triagem', 'cultura', 'tecnico'].forEach(section => {
        const criteria = parameters[section] || [];
        criteria.forEach(c => {
            benchmark[section][c.name] = centerNoteId;
        });
    });

    return benchmark;
};