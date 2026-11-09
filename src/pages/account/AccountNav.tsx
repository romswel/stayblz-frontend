import SectionNav from "../../components/SectionNav";
import { useAuth } from "../../auth";
import { roleLabel } from "../../components/account/roles";
import "../../components/account/account.css";

const links = [
  { to: "/account", label: "Profile" },
  { to: "/account/security", label: "Security" },
  { to: "/account/preferences", label: "Preferences" },
];

/** Shared heading and section bar for the three account pages. */
export default function AccountHeader({ title, intro }: { title: string; intro: string }) {
  const { user } = useAuth();
  return (
    <>
      <header className="page-head">
        <div className="eyebrow">Your account</div>
        <h1>{title}</h1>
        <p className="sub">
          {user?.email} {user?.emailVerified ? "· Email verified" : ""}{" "}
          <span className="acct-badge">{roleLabel(user?.platformRole ?? user?.role)} account</span>
        </p>
        <p className="sub">{intro}</p>
      </header>
      <SectionNav label="Account sections" links={links} />
    </>
  );
}
