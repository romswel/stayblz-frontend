import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import useRacingOverview from "../landing/useRacingOverview";
import { isHarnessRecord } from "./racingDiscipline";
export default function HarnessWorkspace() {
  const { data, error, refreshing, refresh } = useRacingOverview();
  const [params, setParams] = useSearchParams();
  const list = params.get("list") === "horses" ? "horses" : "racecards";
  const query = params.get("q") ?? "";
  const sort = ["name", "starts", "wins"].includes(params.get("sort") ?? "")
    ? params.get("sort")!
    : "name";
  const [selected, setSelected] = useState<string | null>(null);
  const rows = (data?.sections[list] ?? [])
    .filter(isHarnessRecord)
    .filter((row) =>
      (row.name + " " + (row.track ?? ""))
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : (b[sort as "starts" | "wins"] ?? -1) -
            (a[sort as "starts" | "wins"] ?? -1) ||
          a.name.localeCompare(b.name),
    );
  function change(key: string, value: string) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set(key, value);
        return next;
      },
      { replace: true },
    );
    setSelected(null);
  }
  const detail = rows.find((row) => row.id === selected);
  return (
    <section className="pp-order pp-harness-workspace">
      <span className="pp-kicker">HARNESS / YOUR WORKSPACE</span>
      <h2>Read the form. Keep your notes.</h2>
      <p>
        Search the harness records published in Stayblz. These lists are
        separate from a full race program and contain only the records loaded
        here.
      </p>
      <div className="pp-inline-actions">
        <Link className="ws-button" to="/my-racing?tab=notes">
          Open my notes
        </Link>
        <button className="ws-button" onClick={refresh} disabled={refreshing}>
          Refresh records
        </button>
      </div>
      <div className="pp-workspace-filters">
        <label>
          Show
          <select value={list} onChange={(e) => change("list", e.target.value)}>
            <option value="racecards">Race entries</option>
            <option value="horses">Horse records</option>
          </select>
        </label>
        <label>
          Search harness records
          <input
            type="search"
            value={query}
            onChange={(e) => change("q", e.target.value)}
            placeholder="Horse, entry or track"
          />
        </label>
        <label>
          Sort by
          <select value={sort} onChange={(e) => change("sort", e.target.value)}>
            <option value="name">Name</option>
            <option value="starts">Recorded starts</option>
            <option value="wins">Recorded wins</option>
          </select>
        </label>
      </div>
      {error && (
        <p role="alert">
          {error} {data && "Showing the last loaded records."}
        </p>
      )}
      {!data ? (
        <p role="status">
          {error
            ? "Records could not be loaded. Try Refresh records."
            : "Loading harness records..."}
        </p>
      ) : rows.length ? (
        <div
          className="pp-table-scroll"
          role="region"
          aria-label="Harness records"
          tabIndex={0}
        >
          <table className="pp-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Track</th>
                <th>Date</th>
                <th>Starts</th>
                <th>Wins</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row">
                    <button
                      className="pp-record-button"
                      onClick={() => setSelected(row.id)}
                      aria-expanded={selected === row.id}
                    >
                      {row.name}
                    </button>
                  </th>
                  <td>{row.track ?? "Not listed"}</td>
                  <td>{row.date ?? "Not listed"}</td>
                  <td>{row.starts ?? "Not listed"}</td>
                  <td>{row.wins ?? "Not listed"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="pp-empty" role="status">
          <h3>
            {query
              ? "No matching harness records."
              : "No harness records published yet."}
          </h3>
          <p>Only records marked as harness racing appear here.</p>
        </div>
      )}
      {detail && (
        <section
          className="pp-record-detail"
          aria-label="Selected harness record"
        >
          <button className="ws-button" onClick={() => setSelected(null)}>
            Close details
          </button>
          <h3>{detail.name}</h3>
          <p>
            {detail.detail ??
              detail.summary ??
              "No further details have been published."}
          </p>
          <Link to="/my-racing?tab=notes">Write a private note</Link>
        </section>
      )}
    </section>
  );
}
