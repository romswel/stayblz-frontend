import { Link } from "react-router-dom";
import usePublicMotion from "../components/usePublicMotion";
import PublicHeader from "../components/PublicHeader";
import PublicFooter from "../components/PublicFooter";
import { privacy, terms, TERMS_UPDATED } from "../content/legal";
import "./landing.css";
import "./faq.css";
import "./legal.css";

/** Terms of Use and Privacy Notice. Public pages, readable without an account. */
export default function Legal({ kind }: { kind: "terms" | "privacy" }) {
  const pageRef = usePublicMotion();
  const sections = kind === "terms" ? terms : privacy;
  const title = kind === "terms" ? "Terms of Use" : "Privacy Notice";
  return (
    <div className="landing" id="top" ref={pageRef}>
      <a className="ld-skip" href="#legal-main">
        Skip to {title.toLowerCase()}
      </a>
      <PublicHeader />
      <main className="faq-main legal-main" id="legal-main">
        <div className="faq-intro">
          <div>
            <span className="ld-kicker">STAYBLZ / {kind === "terms" ? "TERMS" : "PRIVACY"}</span>
            <h1>{title}</h1>
            <p>
              Last updated {TERMS_UPDATED}. Written in plain English for the Stayblz development preview.
            </p>
          </div>
        </div>
        <div className="faq-layout">
          <aside className="faq-index" aria-label="Sections">
            <span className="ld-kicker">ON THIS PAGE</span>
            {sections.map((section, i) => (
              <a href={`#${section.id}`} key={section.id}>
                <span>0{i + 1}</span>
                {section.heading}
              </a>
            ))}
            <div className="faq-account">
              <h2>{kind === "terms" ? "Privacy Notice" : "Terms of Use"}</h2>
              <p>{kind === "terms" ? "How we handle your information." : "The rules for using Stayblz."}</p>
              <Link to={kind === "terms" ? "/privacy" : "/terms"}>
                Read it <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </aside>
          <div className="legal-body">
            {sections.map((section) => (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-h`} className="legal-section">
                <h2 id={`${section.id}-h`}>{section.heading}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </section>
            ))}
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
