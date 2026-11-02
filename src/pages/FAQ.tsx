import { useState } from "react";
import { Link } from "react-router-dom";
import usePublicMotion from "../components/usePublicMotion";
import PublicHeader from "../components/PublicHeader";
import PublicFooter from "../components/PublicFooter";
import "./landing.css";
import "./faq.css";

const topics = [
  {
    id: "getting-started",
    name: "Getting started",
    questions: [
      {
        question: "What can I find on Stayblz?",
        answer:
          "The racing overview brings together published racecards, results, workouts, standings, stakes, and news. Open a section to browse its available records.",
      },
      {
        question: "Do I need an account to browse?",
        answer:
          "You can browse the public overview without logging in. To open a full section, log in or create an account. Having an account does not grant access to a private stable.",
      },
      {
        question: "How do I open the full records?",
        answer:
          "Choose View all in the section you want to explore. If you are logged out, Stayblz takes you to the account form and remembers that section for after login.",
      },
    ],
  },
  {
    id: "your-account",
    name: "Your account",
    questions: [
      {
        question: "How do I create an account?",
        answer:
          "Choose Sign up, enter your name, country, racing role, and email address, then set a password. Open the confirmation email before logging in. Your racing role describes you; it does not assign account permissions.",
      },
      {
        question: "Why hasn’t my confirmation email arrived?",
        answer:
          "Check your spam folder and the address you entered. You can request another email from the login form. Email delivery is currently limited to authorized test addresses. If a sending limit is reached, wait before trying again.",
      },
      {
        question: "What if my email link has expired?",
        answer:
          "Return to the login page and request a new confirmation or password reset email. Use the most recent link. Each link can be used only once.",
      },
      {
        question: "How do I reset my password?",
        answer:
          "Choose Forgot password on the login form and enter your account email. Follow the emailed link to set a new password, then log in again. Use 12–128 characters with uppercase and lowercase letters and a number.",
      },
      {
        question: "Where can I update my profile?",
        answer:
          "After logging in, open your account to update your name, country, and racing role. Profile changes do not change your permissions.",
      },
    ],
  },
  {
    id: "racing-records",
    name: "Racing records",
    questions: [
      {
        question: "Why is a section empty?",
        answer:
          "A section stays empty until records have been published. Stayblz does not fill empty sections with sample races, horses, or results.",
      },
      {
        question: "Do I need to refresh the overview?",
        answer:
          "The overview checks for updates automatically while this tab is active. It also tries again when your connection returns. You can still use Refresh for an immediate check.",
      },
      {
        question: "What happens if records can’t be loaded?",
        answer:
          "Stayblz retries automatically. If records were already loaded, they stay on screen while an update is attempted. An error message means the latest update could not be checked.",
      },
    ],
  },
  {
    id: "using-stayblz",
    name: "Using Stayblz",
    questions: [
      {
        question: "Can I use Stayblz on my phone?",
        answer:
          "The pages adjust to smaller screens. Wide racing tables scroll sideways within their panels so the rest of the page stays in place.",
      },
      {
        question: "How do I change the theme?",
        answer:
          "Click or tap the Stayblz logo in the public header to switch between themes. Your choice is saved in this browser.",
      },
      {
        question: "Why can’t I open a private stable?",
        answer:
          "Email verification confirms ownership of your email address. Private stable access requires separate permission; signing up does not grant access to another stable’s information.",
      },
    ],
  },
];

export default function FAQ() {
  const pageRef = usePublicMotion();
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const filtered = topics
    .map((topic) => ({
      ...topic,
      questions: topic.questions.filter((item) =>
        `${item.question} ${item.answer}`.toLowerCase().includes(query),
      ),
    }))
    .filter((topic) => topic.questions.length);
  const count = filtered.reduce(
    (total, topic) => total + topic.questions.length,
    0,
  );
  return (
    <div className="landing" id="top" ref={pageRef}>
      <a className="ld-skip" href="#faq-main">
        Skip to questions
      </a>
      <PublicHeader />
      <main className="faq-main" id="faq-main">
        <div className="faq-intro">
          <div>
            <span className="ld-kicker">THE HELP DESK / STAYBLZ</span>
            <h1>
              Frequently asked
              <br />
              <em>questions.</em>
            </h1>
            <p>Accounts, racing records, and finding your way around.</p>
          </div>
          <span className="faq-monogram" aria-hidden="true">
            ?
          </span>
        </div>
        <div className="faq-layout">
          <aside className="faq-index" aria-label="Question topics">
            <span className="ld-kicker">IN THIS GUIDE</span>
            {topics.map((topic, i) => (
              <a
                href={`#${topic.id}`}
                key={topic.id}
                onClick={() => setSearch("")}
              >
                <span>0{i + 1}</span>
                {topic.name}
                <span aria-hidden="true">↗</span>
              </a>
            ))}
            <div className="faq-account">
              <h2>Ready to get started?</h2>
              <p>Return to the racing overview or open your account.</p>
              <Link to="/login">
                Go to Stayblz <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </aside>
          <div className="faq-answers">
            <label className="faq-search">
              Find a question
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Try ‘password’ or ‘results’"
              />
            </label>
            <p className="faq-count" role="status" aria-live="polite">
              {query
                ? `${count} ${count === 1 ? "answer" : "answers"} found`
                : "Frequently asked questions"}
            </p>
            {filtered.length ? (
              filtered.map((topic) => (
                <section
                  id={topic.id}
                  key={topic.id}
                  className="faq-topic ld-reveal"
                  aria-labelledby={`${topic.id}-heading`}
                >
                  <h2 id={`${topic.id}-heading`}>{topic.name}</h2>
                  {topic.questions.map((item) => (
                    <details
                      key={`${query}:${item.question}`}
                      open={query ? true : undefined}
                    >
                      <summary>
                        {item.question}
                        <span aria-hidden="true">+</span>
                      </summary>
                      <div className="faq-answer">
                        <p>{item.answer}</p>
                      </div>
                    </details>
                  ))}
                </section>
              ))
            ) : (
              <div className="faq-empty">
                <h2>No matching questions</h2>
                <p>Try a shorter search or choose a topic.</p>
                <button
                  className="ld-button ld-button-gold"
                  onClick={() => setSearch("")}
                >
                  Clear search
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
