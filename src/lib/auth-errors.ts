/** Traduction des erreurs d'authentification en français clair. */
export function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Identifiant ou mot de passe incorrect. Vérifiez vos informations.";
  if (m.includes("email not confirmed")) return "Votre adresse email n'a pas été confirmée.";
  if (m.includes("too many requests") || m.includes("rate limit")) return "Trop de tentatives. Patientez quelques minutes puis réessayez.";
  if (m.includes("user not found")) return "Aucun compte trouvé avec cet identifiant.";
  if (m.includes("password should be at least")) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (m.includes("new password should be different")) return "Le nouveau mot de passe doit être différent de l'ancien.";
  if (m.includes("network") || m.includes("fetch")) return "Problème de connexion au serveur. Vérifiez votre connexion internet.";
  if (m.includes("signups not allowed") || m.includes("signup")) return "Les inscriptions sont désactivées. Les comptes sont créés par l'établissement.";
  return "Une erreur est survenue : " + message;
}