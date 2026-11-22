import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { writeCompare, stallionsApi } from "./api";
import {
  AVAILABILITY,
  FEE_TERMS,
  GENETIC_TESTS,
  METHODS,
  ageOf,
  breedLabel,
  feeText,
  furlongs,
  geneticResult,
  hands,
  labelOf,
  money,
  pct,
  regionLabel,
  sireLine,
} from "./options";
import { StallionPhoto } from "./StallionCard";
import StallionsNav, { StallionsDisclaimer, useCompare } from "./StallionsNav";
import type { StallionProfile } from "./types";

type Row = { label: string; group?: string; value: (s: StallionProfile) => ReactNode };

const ROWS: Row[] = [
  { group: "Booking", label: "Fee", value: (s) => <strong>{feeText(s)}</strong> },
  { label: "Season", value: (s) => s.seasonYear },
  { label: "Terms", value: (s) => (s.fee === null ? "Ask the owner" : labelOf(FEE_TERMS, s.feeTerms)) },
  { label: "Bookings", value: (s) => labelOf(AVAILABILITY, s.availability) },
  { label: "Breeding", value: (s) => s.methods.map((m) => labelOf(METHODS, m)).join(", ") },
  { label: "Stands at", value: (s) => [s.farm, s.location].filter(Boolean).join(", ") },
  { label: "Region", value: (s) => regionLabel(s.region) },
  { group: "The horse", label: "Breed", value: (s) => breedLabel(s.breed) },
  { label: "Foaled", value: (s) => (s.foaled ? `${s.foaled} (${ageOf(s.foaled)} yrs)` : "–") },
  { label: "Colour · height", value: (s) => [s.color, hands(s.heightIn)].filter(Boolean).join(" · ") || "–" },
  { label: "At stud since", value: (s) => s.firstSeason ?? "–" },
  { group: "Pedigree", label: "Sire", value: (s) => s.pedigree.s || "–" },
  { label: "Dam", value: (s) => s.pedigree.d || "–" },
  { label: "Dam's sire", value: (s) => s.pedigree.ds || "–" },
  { label: "Sire line", value: (s) => sireLine(s.pedigree).slice(1).join(" › ") || "–" },
  {
    group: "Racing (owner's figures)",
    label: "Record",
    value: (s) => (s.raceRecord.starts !== undefined ? `${s.raceRecord.starts} starts: ${s.raceRecord.wins ?? 0}-${s.raceRecord.places ?? 0}-${s.raceRecord.shows ?? 0}` : "–"),
  },
  { label: "Earnings", value: (s) => (s.raceRecord.earnings ? money(s.raceRecord.earnings, s.raceRecord.currency ?? "USD") : "–") },
  { label: "Highlights", value: (s) => (s.highlights.length ? s.highlights.slice(0, 3).join("; ") : "–") },
  { group: "Offspring in Stayblz racing data", label: "Runners", value: (s) => s.offspring?.runners ?? 0 },
  { label: "Winners", value: (s) => (s.offspring?.runners ? `${s.offspring.winners} (${pct(s.offspring.winners ?? 0, s.offspring.runners)})` : "–") },
  { label: "Stakes winners", value: (s) => s.offspring?.stakesWinners ?? "–" },
  { label: "Wins / starts", value: (s) => (s.offspring?.starts ? `${s.offspring.wins} / ${s.offspring.starts}` : "–") },
  {
    label: "Winning distances",
    value: (s) => (s.offspring?.winDistance ? `${furlongs(s.offspring.winDistance.shortest)} – ${furlongs(s.offspring.winDistance.longest)}` : "–"),
  },
  {
    group: "Owner's details",
    label: "Genetic tests",
    value: (s) => {
      const t = GENETIC_TESTS.filter((x) => s.genetics[x.key] !== undefined);
      return t.length ? t.map((x) => `${x.label} ${geneticResult(x.key, s.genetics[x.key])}`).join(", ") : "–";
    },
  },
  { label: "Live foal rate", value: (s) => (s.fertilityRate !== null ? `${s.fertilityRate}%` : "–") },
  { label: "Saved by", value: (s) => s.saves },
];

export default function ComparePage({ signedIn }: { signedIn: boolean }) {
  const [params, setParams] = useSearchParams();
  const tray = useCompare();
  const fromUrl = (params.get("ids") ?? "").split(",").filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 3);
  const ids = fromUrl.length ? fromUrl : tray.ids;
  const key = ids.join(",");
  const [state, setState] = useState<{ loading: boolean; error: string; list: StallionProfile[] }>({ loading: true, error: "", list: [] });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!ids.length) {
      setState({ loading: false, error: "", list: [] });
      return;
    }
    const c = new AbortController();
    setState((s) => ({ ...s, loading: true, error: "" }));
    stallionsApi
      .compare(ids, c.signal)
      .then((list) => !c.signal.aborted && setState({ loading: false, error: "", list }))
      .catch((e) => !c.signal.aborted && setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : "These stallions couldn't be loaded." })));
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  const drop = (id: string) => {
    const next = ids.filter((x) => x !== id);
    writeCompare(next);
    setParams(next.length ? { ids: next.join(",") } : {}, { replace: true });
  };

  return (
    <div className="st-page">
      <StallionsNav signedIn={signedIn} title="Compare stallions" lead="Up to three side by side. Pick them with Compare on any card or stallion page." />
      {state.loading && !state.list.length ? (
        <p className="st-count-line" role="status">
          Loading…
        </p>
      ) : state.error ? (
        <div className="st-empty gx-glass" role="alert">
          <h2>These stallions couldn't be loaded.</h2>
          <p>{state.error}</p>
          <button type="button" className="btn btn-quiet" onClick={() => setVersion((v) => v + 1)}>
            Try again
          </button>
        </div>
      ) : state.list.length < 1 ? (
        <div className="st-empty gx-glass">
          <h2>Nothing to compare yet.</h2>
          <p>Tick Compare on two or three stallions in the directory.</p>
          <Link to="/stallions" className="btn btn-primary">
            Browse stallions
          </Link>
        </div>
      ) : (
        <section className="st-panel gx-glass">
          <div className="st-table-wrap">
            <table className="st-table st-compare">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="st-sr">Detail</span>
                  </th>
                  {state.list.map((s) => (
                    <th key={s.id} scope="col">
                      <Link to={`/stallions/${s.id}`} className="st-compare-head">
                        <StallionPhoto stallion={s} className="st-compare-photo" />
                        <strong>{s.name}</strong>
                      </Link>
                      <button type="button" className="st-link" onClick={() => drop(s.id)}>
                        Remove
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.label} className={r.group ? "st-group-start" : undefined}>
                    <th scope="row">
                      {r.group && <span className="st-group">{r.group}</span>}
                      {r.label}
                    </th>
                    {state.list.map((s) => (
                      <td key={s.id}>{r.value(s)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {state.list.length < 3 && (
            <p className="st-muted">
              <Link to="/stallions">Add another stallion</Link> to compare up to three.
            </p>
          )}
        </section>
      )}
      <StallionsDisclaimer />
    </div>
  );
}
