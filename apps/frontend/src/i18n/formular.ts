import type { Lang } from "./ui";

const de = {
  sicherheitspruefung: "Sicherheitsprüfung",
  pruefungNeuLaden: "Erneut prüfen",
  pruefungOhneJs: "Für dieses geschützte Formular ist JavaScript erforderlich.",
  pruefungLadefehler: "Die Sicherheitsprüfung ist nicht verfügbar. Bitte versuchen Sie es erneut.",
  pruefungLaedt: "Sicherheitsprüfung wird geladen …",
  pruefungAbgelaufen: "Die Sicherheitsprüfung ist abgelaufen. Sie wird erneuert.",
  pruefungFehlt: "Bitte schließen Sie zuerst die Sicherheitsprüfung ab.",
  senden: "Formular prüfen",
  sendet: "Wird geprüft …",
  erfolgreich:
    "Formular erfolgreich geprüft. Es wurden keine Daten gespeichert und keine E-Mails versendet.",
  fehlgeschlagen: "Das Formular konnte nicht geprüft werden. Bitte versuchen Sie es erneut.",
  rateLimit: "Zu viele Versuche. Bitte warten Sie eine Minute.",
  eingabenPruefen: "Bitte prüfen Sie Ihre Angaben.",
  titel: "Formular und Bot-Schutz testen",
  hinweis:
    "Diese Demo prüft die Eingaben über die Hono-API. Sie legt kein Benutzerkonto an und versendet keine E-Mail. Verwenden Sie Testdaten.",
  name: "Name",
  email: "E-Mail",
  javascript: "Bitte aktivieren Sie JavaScript, um das Formular zu testen.",
  cookies: "Cookie-Einstellungen",
};
const texte = {
  de,
  en: {
    sicherheitspruefung: "Security check",
    pruefungNeuLaden: "Try again",
    pruefungOhneJs: "JavaScript is required for this protected form.",
    pruefungLadefehler: "The security check is unavailable. Please try again.",
    pruefungLaedt: "Loading security check …",
    pruefungAbgelaufen: "The security check expired and is being renewed.",
    pruefungFehlt: "Please complete the security check first.",
    senden: "Validate form",
    sendet: "Validating …",
    erfolgreich: "Form validated successfully. No data was stored and no emails were sent.",
    fehlgeschlagen: "The form could not be validated. Please try again.",
    rateLimit: "Too many attempts. Please wait a minute.",
    eingabenPruefen: "Please check your details.",
    titel: "Test the form and bot protection",
    hinweis:
      "This demo validates input through the Hono API. It does not create an account or send email. Please use test data.",
    name: "Name",
    email: "Email",
    javascript: "Please enable JavaScript to test the form.",
    cookies: "Cookie settings",
  },
} satisfies Record<Lang, Record<keyof typeof de, string>>;

export function formularUebersetzung(sprache: Lang) {
  return (key: keyof typeof de): string => texte[sprache][key];
}
