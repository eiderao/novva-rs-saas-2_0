const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.getJobsByTenant = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Você precisa estar autenticado."
    );
  }

  const uid = context.auth.uid;
  const db = admin.firestore();

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Usuário não encontrado."
      );
    }
    const tenantId = userDoc.data().tenantId;
    if (!tenantId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Usuário sem tenantId."
      );
    }

    const jobsSnapshot = await db.collection("jobs").where("tenantId", "==", tenantId).get();
    const jobs = [];
    jobsSnapshot.forEach((doc) => {
      jobs.push({ id: doc.id, ...doc.data() });
    });

    return { jobs };

  } catch (error) {
    console.error("Erro ao buscar vagas:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Ocorreu um erro ao buscar as vagas."
    );
  }
});