import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import usePublicMotion from "../components/usePublicMotion";
import PublicHeader from "../components/PublicHeader";
import PublicFooter from "../components/PublicFooter";
import BackButton from "../components/ui/BackButton";
import LegalDocs, { legalDocs, type LegalKind } from "../components/legal/LegalDocs";
import { TERMS_UPDATED } from "../content/legal";
import "./landing.css";
import "./faq.css";
import "./legal.css";

const titles: Record<LegalKind, string> = {
  terms: "Terms of Use",
  privacy: "Privacy Notice",
  all: "Terms of Use & Privacy Notice",
};

/** Terms of Use, Privacy Notice, or both on one page (/legal). Public, readable without an account. */
export default function Legal({ kind }: { kind: LegalKind }) {
  const pageRef = usePublicMotion();
  const { user } = useAuth();
  const docs = legalDocs(kind);
  const title = titles[kind];
  return (
    <div className="landing" id="top" ref={pageRef}>
      <a className="ld-skip" href="#legal-main">
        Skip to {title.toLowerCase()}
      </a>
      <PublicHeader />
      <main className="faq-main legal-main" id="legal-main">
        <BackButton className="legal-back" signedIn={!!user} />
        <div className="faq-intro">
          <div>
            <span className="ld-kicker">STAYBLZ / {kind === "all" ? "TERMS & PRIVACY" : kind === "terms" ? "TERMS" : "PRIVACY"}</span>
            <h1>{title}</h1>
            <p>
              Last updated {TERMS_UPDATED}. Written in plain English for the Stayblz development preview.
            </p>
          </div>
        </div>
        <div className="faq-layout">
          <aside className="faq-index" aria-label="Sections">
            {docs.map((doc) => (
              <div key={doc.key} className="legal-index-group">
                <span className="ld-kicker">{kind === "all" ? doc.title.toUpperCase() : "ON THIS PAGE"}</span>
                {doc.sections.map((section, i) => (
                  <a href={`#${section.id}`} key={section.id}>
                    <span>0{i + 1}</span>
                    {section.heading}
                  </a>
                ))}
              </div>
            ))}
            {kind !== "all" && (
              <div className="faq-account">
                <h2>{kind === "terms" ? "Privacy Notice" : "Terms of Use"}</h2>
                <p>{kind === "terms" ? "How we handle your information." : "The rules for using Stayblz."}</p>
                <Link to="/legal">
                  Read both on one page <span aria-hidden="true">↗</span>
                </Link>
              </div>
            )}
          </aside>
          <div className="legal-body">
            <LegalDocs kind={kind} />
            <p className="legal-note">
              Questions about these pages? Start with <Link to="/faq">Help & FAQ</Link>.
            </p>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
