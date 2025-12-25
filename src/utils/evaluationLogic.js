// src/utils/evaluationLogic.js

/**
 * Calculates the score for a specific pillar (0 to 10)
 * Rule: Sum (Score * Weight) / Sum of Answered Weights
 * Returns: 0 to 10 (or null if no evaluation)
 */
export const calculatePillarScore = (sectionName, criteriaList, answers, ratingScale) => {
    if (!criteriaList || !Array.isArray(criteriaList) || criteriaList.length === 0) return null;
    
    let totalScore = 0;
    let totalWeightAnswered = 0;
    let hasAnswers = false;

    criteriaList.forEach(criterion => {
        // Try to find the answer (supports nested structure v2 or flat v1)
        const noteId = answers?.[sectionName]?.[criterion.name] || answers?.[criterion.name];
        
        // Ignore 'NA' or unanswered
        if (noteId && noteId !== 'NA') {
            // CRITICAL FIX: Convert to String to ensure match (1 vs "1")
            const noteObj = ratingScale.find(n => String(n.id) === String(noteId));
            
            if (noteObj) {
                hasAnswers = true;
                const weight = Number(criterion.weight) || 0; // If weight is 0, don't sum
                
                // Ex: Score 10 * Weight 20 = 200
                totalScore += (Number(noteObj.valor) * weight);
                totalWeightAnswered += weight;
            }
        }
    });

    if (!hasAnswers || totalWeightAnswered === 0) return null;

    // Normalization: (200 / 20) = 10. Keeps 0-10 scale.
    return (totalScore / totalWeightAnswered);
};

/**
 * Processes a user's full evaluation
 * Rule: Arithmetic Mean of the 3 Pillars (if evaluated)
 */
export const processEvaluation = (evaluationObj, parameters) => {
    // Protection against empty data
    if (!evaluationObj || !parameters) {
        return { triagem: 0, cultura: 0, tecnico: 0, total: 0 };
    }

    const answers = evaluationObj.scores || evaluationObj; 
    const ratingScale = parameters.notas || [];
    
    // Normalization of parameter names (to avoid accentuation errors)
    const pTriagem = parameters.triagem || [];
    const pCultura = parameters.cultura || [];
    const pTecnico = parameters.tecnico || parameters['técnico'] || parameters['tÃ©cnico'] || [];

    const triagem = calculatePillarScore('triagem', pTriagem, answers, ratingScale);
    const cultura = calculatePillarScore('cultura', pCultura, answers, ratingScale);
    const tecnico = calculatePillarScore('tecnico', pTecnico, answers, ratingScale);

    // Mean of pillars (Rule 2.2.2: Mean between the 3 pillars)
    // If a pillar is null (not evaluated), it does not enter the mean calculation
    let sum = 0;
    let count = 0;

    if (triagem !== null) { sum += triagem; count++; }
    if (cultura !== null) { sum += cultura; count++; }
    if (tecnico !== null) { sum += tecnico; count++; }

    // If count is 0, score is 0.
    const total = count > 0 ? (sum / count) : 0;

    return {
        triagem: triagem !== null ? Number(triagem) : 0,
        cultura: cultura !== null ? Number(cultura) : 0,
        tecnico: tecnico !== null ? Number(tecnico) : 0,
        total: Number(total)
    };
};