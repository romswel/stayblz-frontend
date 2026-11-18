import { useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import AuthForm from "../components/auth/AuthForm";
import Brand from "../components/Brand";
import { allowedDestination } from "../authDestination";

/**
 * The signed-out front door: log in (/, /login) or sign up (/signup), nothing else (boss + senior dev, 2026-11-19).
 * Signed-in visitors never see it (App.tsx sends them to /dashboard).
 */
export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { destination?: unknown; intent?: unknown } | null;
  const mode = location.pathname === "/signup" ? "signup" : "login";
  const destination = allowedDestination(state?.destination) ? state!.destination as string : "/dashboard";
  const intent = typeof state?.intent === "string" ? state.intent.slice(0, 150) : "";

  return (
    <AuthLayout>
      <div className="au-split gx-glass">
        <aside className="au-visual" aria-hidden="true">
          <img src="/images/racing-editorial.jpg" alt="" fetchPriority="high" />
          <div className="au-visual-copy">
            <Brand />
            <p>
              Know the horse.
              <br />
              Read the race.
            </p>
            <small>THE RACING LEDGER</small>
          </div>
        </aside>
        <div className="au-panel">
          <AuthForm
            mode={mode}
            destination={destination}
            intent={intent}
            onModeChange={(next) =>
              navigate(next === "signup" ? "/signup" : "/login", { replace: true, state: { destination, intent } })
            }
          />
        </div>
      </div>
    </AuthLayout>
  );
}
