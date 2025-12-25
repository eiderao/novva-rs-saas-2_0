// src/utils/evaluationLogic.js

// Calcula a nota de UM pilar (0 a 10)
export const calculatePillarScore = (sectionName, criteriaList, answers, ratingScale) => {
    if (!criteriaList || !Array.isArray(criteriaList) || criteriaList.length === 0) return 0;
    if (!answers) return 0;

    let totalScore = 0;
    let totalWeightAnswered = 0;
    let hasAnswers = false;

    criteriaList.forEach(criterion => {
        // Tenta encontrar a resposta em vários lugares possíveis da estrutura
        // 1. Estrutura aninhada (padrão v2): answers.triagem.Criterio
        // 2. Estrutura plana (padrão v1): answers.Criterio
        let noteId = answers?.[sectionName]?.[criterion.name];
        
        if (!noteId) {
            noteId = answers?.[criterion.name];
        }

        // Ignora se for 'NA' ou nulo
        if (noteId && noteId !== 'NA') {
            const noteObj = ratingScale.find(n => n.id === noteId);
            if (noteObj) {
                hasAnswers = true;
                const weight = Number(criterion.weight) || 0;
                totalScore += (Number(noteObj.valor) * weight);
                totalWeightAnswered += weight;
            }
        }
    });

    if (!hasAnswers || totalWeightAnswered === 0) return 0;

    // Normaliza para 0-10
    return (totalScore / totalWeightAnswered);
};

export const processEvaluation = (evaluationRow, parameters) => {
    // Proteção contra dados nulos
    if (!evaluationRow || !parameters) {
        return { triagem: 0, cultura: 0, tecnico: 0, total: 0 };
    }

    // O objeto de respostas pode estar em 'scores' ou na raiz (dependendo de como foi salvo)
    const answers = evaluationRow.scores || evaluationRow; 
    const ratingScale = parameters.notas || [];

    // Garante array de critérios mesmo se estiver nulo no banco
    const pTriagem = parameters.triagem || [];
    const pCultura = parameters.cultura || [];
    const pTecnico = parameters.tecnico || parameters['técnico'] || parameters['tÃ©cnico'] || [];

    const triagem = calculatePillarScore('triagem', pTriagem, answers, ratingScale);
    const cultura = calculatePillarScore('cultura', pCultura, answers, ratingScale);
    const tecnico = calculatePillarScore('tecnico', pTecnico, answers, ratingScale);

    // Média Simples dos 3 pilares
    const total = (triagem + cultura + tecnico) / 3;

    return {
        triagem: Number(triagem.toFixed(2)),
        cultura: Number(cultura.toFixed(2)),
        tecnico: Number(tecnico.toFixed(2)),
        total: Number(total.toFixed(2))
    };
};