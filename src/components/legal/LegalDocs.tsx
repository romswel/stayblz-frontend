import { privacy, terms, type LegalSection } from "../../content/legal";

export type LegalKind = "terms" | "privacy" | "all";

export const legalDocs = (kind: LegalKind): { key: "terms" | "privacy"; title: string; sections: LegalSection[] }[] =>
  [
    { key: "terms" as const, title: "Terms of Use", sections: terms },
    { key: "privacy" as const, title: "Privacy Notice", sections: privacy },
  ].filter((doc) => kind === "all" || doc.key === kind);

/**
 * The Terms of Use and Privacy Notice text. Used by /terms, /privacy, the combined /legal page
 * and the sign-up dialog, so people read both in one place.
 * `idPrefix` keeps heading ids unique when it's shown inside a dialog on another page.
 */
export default function LegalDocs({ kind, idPrefix = "" }: { kind: LegalKind; idPrefix?: string }) {
  const docs = legalDocs(kind);
  return (
    <>
      {docs.map((doc) => (
        <div key={doc.key} className="legal-doc" id={`${idPrefix}${doc.key}`}>
          {kind === "all" && <h2 className="legal-doc-title">{doc.title}</h2>}
          {doc.sections.map((section) => (
            <section
              key={section.id}
              id={`${idPrefix}${section.id}`}
              aria-labelledby={`${idPrefix}${section.id}-h`}
              className="legal-section"
            >
              {kind === "all" ? (
                <h3 id={`${idPrefix}${section.id}-h`}>{section.heading}</h3>
              ) : (
                <h2 id={`${idPrefix}${section.id}-h`}>{section.heading}</h2>
              )}
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      ))}
    </>
  );
}
