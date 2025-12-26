// src/utils/evaluationLogic.js

export const calculatePillarScore = (sectionName, criteriaList, answers, ratingScale) => {
    // Se não houver critérios ou respostas, retorna null (neutro)
    if (!criteriaList || !Array.isArray(criteriaList) || criteriaList.length === 0) return null;
    if (!answers) return null;
    
    let totalScore = 0;
    let totalWeightAnswered = 0;
    let hasAnswers = false;

    criteriaList.forEach(criterion => {
        // Tenta achar a resposta (suporta estrutura v2 aninhada ou v1 plana)
        const noteId = answers?.[sectionName]?.[criterion.name] || answers?.[criterion.name];
        
        // Ignora 'NA', null ou undefined
        if (noteId && noteId !== 'NA') {
            // CORREÇÃO CRÍTICA: Converte ambos para String para garantir o match (1 vs "1")
            const noteObj = ratingScale.find(n => String(n.id) === String(noteId));
            
            if (noteObj) {
                hasAnswers = true;
                const weight = Number(criterion.weight) || 0;
                
                // Cálculo: Valor da Nota * Peso
                totalScore += (Number(noteObj.valor) * weight);
                totalWeightAnswered += weight;
            }
        }
    });

    if (!hasAnswers || totalWeightAnswered === 0) return null;

    // Normaliza para escala 0-10
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
    const pTecnico = parameters.tecnico || parameters['técnico'] || parameters['tÃ©cnico'] || [];

    // Calcula parciais
    const triagem = calculatePillarScore('triagem', pTriagem, answers, ratingScale);
    const cultura = calculatePillarScore('cultura', pCultura, answers, ratingScale);
    const tecnico = calculatePillarScore('tecnico', pTecnico, answers, ratingScale);

    // Média Aritmética Simples dos pilares respondidos
    let sum = 0;
    let count = 0;

    if (triagem !== null) { sum += triagem; count++; }
    if (cultura !== null) { sum += cultura; count++; }
    if (tecnico !== null) { sum += tecnico; count++; }

    // Se count for 0 (nenhum pilar avaliado), nota é 0.
    const total = count > 0 ? (sum / count) : 0;

    return {
        triagem: triagem !== null ? Number(triagem) : 0,
        cultura: cultura !== null ? Number(cultura) : 0,
        tecnico: tecnico !== null ? Number(tecnico) : 0,
        total: Number(total)
    };
};