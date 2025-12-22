// api/_utils/calculator.js
export function calculateWeightedScore(userScores, jobParameters) {
    if (!userScores || !jobParameters) return 0;

    // Converte lista de notas do banco em Mapa para acesso rápido
    // Ex: { "uuid-nota-1": 0, "uuid-nota-2": 50, "uuid-nota-3": 100 }
    const notesMap = new Map((jobParameters.notas || []).map(n => [n.id, Number(n.valor)]));

    const sections = ['triagem', 'cultura', 'tecnico']; // Seções padrão
    let totalScore = 0;
    let totalMaxPossible = 0;

    sections.forEach(section => {
        const criteriaList = jobParameters[section] || []; // Ex: [{name: 'React', weight: 2}]
        const userSectionScores = userScores[section] || {}; // Ex: { 'React': 'uuid-nota-3' }

        criteriaList.forEach(criterion => {
            const noteId = userSectionScores[criterion.name];
            
            // LÓGICA DE N/A: Se a notaId for 'NA' ou não existir, ignoramos este critério
            if (!noteId || noteId === 'NA') return;

            const noteValue = notesMap.get(noteId); // Valor (0, 50, 100)
            const weight = Number(criterion.weight) || 1; // Peso (1x, 2x...)

            if (noteValue !== undefined) {
                totalScore += (noteValue * weight);
                totalMaxPossible += (100 * weight); // O máximo seria tirar 100 nesse critério
            }
        });
    });

    // Evita divisão por zero se tudo for N/A
    if (totalMaxPossible === 0) return 0;

    // Normaliza para 0-100 com 1 casa decimal
    return Number(((totalScore / totalMaxPossible) * 100).toFixed(1));
}