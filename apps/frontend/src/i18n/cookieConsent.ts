import type { CookieConsentConfig } from "vanilla-cookieconsent";

export const cookieConsentTranslations: NonNullable<CookieConsentConfig["language"]>["translations"] = {
  de: {
    consentModal: {
      title: "Wir verwenden Cookies",
      description:
        "Wir nutzen Cookies, um die Funktionalität der Website zu gewährleisten und – mit Ihrer Einwilligung – um unsere Angebote zu verbessern. Technisch notwendige Cookies werden immer gesetzt. Weitere Cookies setzen wir nur mit Ihrer Zustimmung.",
      acceptAllBtn: "Alle akzeptieren",
      acceptNecessaryBtn: "Nur notwendige",
      showPreferencesBtn: "Einstellungen",
    },
    preferencesModal: {
      title: "Cookie-Einstellungen",
      acceptAllBtn: "Alle akzeptieren",
      acceptNecessaryBtn: "Nur notwendige",
      savePreferencesBtn: "Auswahl speichern",
      closeIconLabel: "Schließen",
      sections: [
        {
          title: "Cookie-Nutzung",
          description:
            "Wir verwenden Cookies, um die Grundfunktionen der Website zu gewährleisten und Ihr Erlebnis zu verbessern.",
        },
        {
          title: "Technisch notwendige Cookies",
          description:
            "Diese Cookies sind für den Betrieb der Website unerlässlich und können nicht deaktiviert werden. Dazu gehören z. B. Session-Cookies und Ihre Cookie-Einstellungen.",
          linkedCategory: "necessary",
        },
        {
          title: "Analyse-Cookies",
          description:
            "Diese Cookies helfen uns zu verstehen, wie Besucher unsere Website nutzen. Die Daten werden anonymisiert ausgewertet.",
          linkedCategory: "analytics",
        },
        {
          title: "Marketing-Cookies",
          description:
            "Diese Cookies werden für personalisierte Werbung und Remarketing verwendet.",
          linkedCategory: "marketing",
        },
        {
          title: "Weitere Informationen",
          description:
            'Ausführliche Informationen finden Sie in unserer <a href="/de/cookie">Cookie-Richtlinie</a> und der <a href="/de/datenschutz">Datenschutzerklärung</a>. Bei Fragen: <a href="mailto:hello@example.com">hello@example.com</a>',
        },
      ],
    },
  },
  en: {
    consentModal: {
      title: "We use cookies",
      description:
        "We use cookies to ensure the functionality of the website and – with your consent – to improve our services. Technically necessary cookies are always set. We only set additional cookies with your consent.",
      acceptAllBtn: "Accept all",
      acceptNecessaryBtn: "Necessary only",
      showPreferencesBtn: "Settings",
    },
    preferencesModal: {
      title: "Cookie settings",
      acceptAllBtn: "Accept all",
      acceptNecessaryBtn: "Necessary only",
      savePreferencesBtn: "Save selection",
      closeIconLabel: "Close",
      sections: [
        {
          title: "Cookie usage",
          description:
            "We use cookies to ensure the basic functionality of the website and to improve your experience.",
        },
        {
          title: "Strictly necessary cookies",
          description:
            "These cookies are essential for the operation of the website and cannot be disabled. They include e.g. session cookies and your cookie settings.",
          linkedCategory: "necessary",
        },
        {
          title: "Analytics cookies",
          description:
            "These cookies help us understand how visitors use our website. The data is anonymized.",
          linkedCategory: "analytics",
        },
        {
          title: "Marketing cookies",
          description:
            "These cookies are used for personalized advertising and remarketing.",
          linkedCategory: "marketing",
        },
        {
          title: "More information",
          description:
            'For detailed information, see our <a href="/en/cookie">Cookie Policy</a> and <a href="/en/datenschutz">Privacy Policy</a>. Questions: <a href="mailto:hello@example.com">hello@example.com</a>',
        },
      ],
    },
  },
};
