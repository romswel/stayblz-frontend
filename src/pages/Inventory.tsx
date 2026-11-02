import { useEffect, useMemo, useRef, useState } from "react";
import { useStableApi, useWorkspace } from "../workspace";
import type { InventoryItem, TrackedHorse } from "../types";
import HorsePhoto, { HORSE_PHOTOS } from "../components/HorsePhoto";
import HorsePortrait from "../components/HorsePortrait";
import Modal from "../components/Modal";
import HorseEditor from "../components/HorseEditor";

function statusChip(status: string): string {
  switch (status) {
    case "Active":
    case "In training":
      return "chip green";
    case "Resting":
    case "For sale":
      return "chip amber";
    default:
      return "chip grey";
  }
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default function Inventory() {
  const api = useStableApi();
  const { active: stable } = useWorkspace();
  const [editing, setEditing] = useState<InventoryItem | "new" | null>(null);
  const [version, setVersion] = useState(0);
  const canManage = stable?.role === "owner" || stable?.role === "manager";
  const trackerRequest = useRef(0);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [tracker, setTracker] = useState<TrackedHorse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api
      .get<{ items: InventoryItem[] }>("/api/inventory", { signal: controller.signal })
      .then((d) => {
        if (!Array.isArray(d.items)) throw Error("Inventory response was invalid.");
        if (!controller.signal.aborted) setItems(d.items);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Could not load inventory.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, version]);

  function openHorse(item: InventoryItem) {
    const request = ++trackerRequest.current;
    setSelected(item);
    setTracker(null);
    // Enrich with tracker data when this horse is being tracked.
    api
      .get<{ horse: TrackedHorse }>(`/api/horses/${item.id}`)
      .then((d) => {
        if (request === trackerRequest.current) setTracker(d.horse);
      })
      .catch(() => {
        if (request === trackerRequest.current) setTracker(null);
      });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      [i.horseName, i.breed, i.status, i.stable, i.sex].some((v) =>
        v.toLowerCase().includes(q),
      ),
    );
  }, [items, query]);

  return (
    <>
      <header className="page-head">
        <div className="eyebrow">stable // registry</div>
        <h1>Inventory</h1>
        <p className="sub">
          Every horse registered to your operation — select a horse for full
          details
        </p>
      </header>

      {canManage && (
        <button
          className="ws-button inventory-add"
          onClick={() => setEditing("new")}
        >
          Add horse
        </button>
      )}
      {editing && (
        <HorseEditor
          item={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => setVersion((v) => v + 1)}
        />
      )}
      <div className="toolbar">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, breed, status…"
          aria-label="Search inventory"
        />
        <span className="count">
          {filtered.length} of {items.length} records
        </span>
      </div>

      <div className="panel table-wrap">
        {loading && <div className="loading">Loading inventory…</div>}
        {error && !loading && <div className="empty" role="alert">{error} <button className="ws-button" onClick={() => setVersion(v => v + 1)}>Retry inventory</button></div>}
        {!loading && !error && (
          <table className="data">
            <thead>
              <tr>
                <th>Horse</th>
                <th>Sex</th>
                <th className="num">Age</th>
                <th>Status</th>
                <th>Stable</th>
                <th className="num">Value</th>
                <th>Acquired</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr
                  key={i.id}
                  className="clickable"
                  tabIndex={0}
                  onClick={() => openHorse(i)}
                  onKeyDown={(e) => e.key === "Enter" && openHorse(i)}
                  aria-label={`View details for ${i.horseName}`}
                >
                  <td>
                    <div className="horse-cell">
                      <HorsePhoto
                        horseId={i.id}
                        name={i.horseName}
                        size={46}
                        coat={i.coatColor}
                        mane={i.maneColor}
                        blaze={i.blaze}
                      />
                      <span
                        className="saddlecloth sm"
                        style={{ background: i.silksColor }}
                      >
                        {i.saddlecloth}
                      </span>
                      <span>
                        <div className="n">{i.horseName}</div>
                        <div className="b">{i.breed}</div>
                      </span>
                    </div>
                  </td>
                  <td>{i.sex}</td>
                  <td className="num">{i.age}</td>
                  <td>
                    <span className={statusChip(i.status)}>{i.status}</span>
                  </td>
                  <td>{i.stable}</td>
                  <td className="num gold">{usd.format(i.valueUsd)}</td>
                  <td>
                    {new Date(i.acquiredAt).toLocaleDateString([], {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty">
                      {items.length ? `No records match “${query}”. Clear the search to see everything.` : "No horses registered yet."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <Modal
          onClose={() => setSelected(null)}
          label={`Details for ${selected.horseName}`}
        >
          <div className="modal-hero">
            {HORSE_PHOTOS[selected.id] ? (
              <img
                src={HORSE_PHOTOS[selected.id]}
                alt={`Photo of ${selected.horseName}`}
              />
            ) : (
              <HorsePortrait
                coat={selected.coatColor}
                mane={selected.maneColor}
                blaze={selected.blaze}
                size={210}
                title={selected.horseName}
              />
            )}
            <div className="modal-title">
              <span
                className="saddlecloth"
                style={{ background: selected.silksColor }}
              >
                {selected.saddlecloth}
              </span>
              <h2>{selected.horseName}</h2>
            </div>
            <button
              className="modal-close"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="modal-body">
            {canManage && (
              <button
                className="ws-button"
                onClick={() => {
                  setSelected(null);
                  setEditing(selected);
                }}
              >
                Edit horse
              </button>
            )}
            <div className="modal-tags">
              <span className={statusChip(selected.status)}>
                {selected.status}
              </span>
              <span className="chip grey">{selected.breed}</span>
              <span className="chip grey">
                {selected.sex}, {selected.age} yo
              </span>
            </div>

            <div className="detail-grid">
              <div className="detail">
                <div className="l">Stable</div>
                <div className="v">{selected.stable}</div>
              </div>
              <div className="detail">
                <div className="l">Estimated value</div>
                <div className="v gold">{usd.format(selected.valueUsd)}</div>
              </div>
              <div className="detail wide">
                <div className="l">Acquired</div>
                <div className="v">
                  {new Date(selected.acquiredAt).toLocaleDateString([], {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </div>
            </div>

            {tracker && (
              <div className="modal-section">
                <div className="h">Training &amp; racing</div>
                <div className="cond" style={{ marginBottom: 12 }}>
                  <span>Condition</span>
                  <span className="bar">
                    <span style={{ width: `${tracker.condition}%` }} />
                  </span>
                  <span className="v">{tracker.condition}</span>
                </div>
                <div className="detail-grid">
                  <div className="detail">
                    <div className="l">Trainer</div>
                    <div className="v">{tracker.trainer}</div>
                  </div>
                  <div className="detail">
                    <div className="l">Jockey</div>
                    <div className="v">{tracker.jockey}</div>
                  </div>
                  <div className="detail">
                    <div className="l">Recent form</div>
                    <div className="v form-string">{tracker.form}</div>
                  </div>
                  <div className="detail">
                    <div className="l">Status</div>
                    <div className="v">{tracker.status}</div>
                  </div>
                  <div className="detail wide">
                    <div className="l">Last workout</div>
                    <div className="v">{tracker.lastWorkout}</div>
                  </div>
                  <div className="detail wide">
                    <div className="l">Next race</div>
                    <div className="v">
                      {tracker.nextRace ?? "Not yet entered"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
