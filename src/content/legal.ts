// Plain-language Terms of Use and Privacy Notice for the development preview.
// When these change in a way people must agree to again, bump TERMS_VERSION here AND in
// stayblz-backend/src/lib/profileInput.ts, and post an Update.
export const TERMS_VERSION = "2026-11-10";
export const TERMS_UPDATED = "10 November 2026";

export interface LegalSection {
  id: string;
  heading: string;
  paragraphs: string[];
}

export const terms: LegalSection[] = [
  {
    id: "about",
    heading: "About these terms",
    paragraphs: [
      "These terms apply when you use Stayblz: the website, your account, and any stable workspace you create or join. By creating an account you agree to them.",
      "Stayblz is a development preview. Features can change, break or be removed, and some information may be missing or wrong while we build. Please don't rely on Stayblz for decisions that involve money, horse welfare or safety.",
    ],
  },
  {
    id: "account",
    heading: "Your account",
    paragraphs: [
      "You must be 18 or older to create an account. Give accurate details, keep your password private, and turn on 2-step login if you can.",
      "You're responsible for what happens under your account. Tell us straight away if you think someone else has used it.",
      "Your role in racing (owner, trainer, fan and so on) describes you to other members. It does not give you any special access or permissions.",
    ],
  },
  {
    id: "conduct",
    heading: "Using Stayblz fairly",
    paragraphs: [
      "Be respectful in messages, team feeds and notes. Don't harass people, share someone else's private information, impersonate anyone or post anything illegal.",
      "Only add horses, records and documents you have the right to share. Don't try to access stables, conversations or data that aren't yours, overload the service, or get around its security.",
      "We may suspend accounts that break these rules or put other members at risk.",
    ],
  },
  {
    id: "racing-information",
    heading: "Racing information",
    paragraphs: [
      "Racing records on Stayblz are provided for information only. Always check official sources before acting on them.",
      "Stayblz does not take bets, hold money or offer wagering. Any prices, carts or reports shown during the preview are not live purchases unless a page clearly says so.",
    ],
  },
  {
    id: "content",
    heading: "Your content",
    paragraphs: [
      "You keep ownership of what you add. You let Stayblz store and show it to the people you share it with, so the service can work.",
      "Private stable records and conversations are only shown to their members. Stayblz staff roles do not open them.",
    ],
  },
  {
    id: "changes",
    heading: "Changes and ending your account",
    paragraphs: [
      "We'll post important changes to these terms on Updates and may ask you to accept them again.",
      "You can stop using Stayblz at any time. To close your account, contact us and we'll remove it.",
      "Stayblz is provided as it is during the preview. As far as the law allows, we aren't responsible for losses caused by outages, errors or missing information.",
    ],
  },
];

export const privacy: LegalSection[] = [
  {
    id: "what-we-collect",
    heading: "What we collect",
    paragraphs: [
      "Account details: your name, email, country, and optionally your city, organisation, short bio and roles in racing.",
      "What you add: follows, notes, messages, stable and horse records, and settings such as your theme or update pop-ups.",
      "Security records: when you sign in, change your password or 2-step login, and similar account events. We keep these to protect your account.",
    ],
  },
  {
    id: "how-we-use-it",
    heading: "How we use it",
    paragraphs: [
      "To run your account and show your information to the people you choose to share it with.",
      "To keep Stayblz secure: spotting misuse, limiting repeated sign-in attempts and investigating problems.",
      "We only send you news or offers if you opted in. Emails about your account (confirmation, password reset) are always sent.",
    ],
  },
  {
    id: "sharing",
    heading: "Who can see it",
    paragraphs: [
      "Other members see what you share with them, such as your name in a conversation or stable team.",
      "Service providers that run Stayblz for us (hosting, database and sign-in, email delivery) process data on our behalf. We don't sell your personal information.",
    ],
  },
  {
    id: "security",
    heading: "Keeping it safe",
    paragraphs: [
      "Passwords are handled by our sign-in provider and never stored by Stayblz in readable form. Sessions use secure, HttpOnly cookies, and you can turn on 2-step login.",
      "No online service is perfectly secure. If we learn of a problem that affects your data, we'll tell you.",
    ],
  },
  {
    id: "your-choices",
    heading: "Your choices",
    paragraphs: [
      "You can view and edit your profile and settings on your Account page, and turn update emails on or off.",
      "Contact us to get a copy of your data or to have your account and data removed.",
    ],
  },
];
