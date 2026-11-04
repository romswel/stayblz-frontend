import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import useRacingOverview from "../landing/useRacingOverview";
import { useCart, type CartItem } from "./CartContext";
import type { PPProduct } from "./catalog";
export default function PPOrder({ product }: { product: PPProduct }) {
  const { data, error, refreshing, refresh } = useRacingOverview();
  const [params, setParams] = useSearchParams();
  const cart = useCart();
  const { pathname, search } = useLocation();
  const dates = [
    ...new Set(
      (data?.sections.racecards ?? []).flatMap((row) =>
        row.date ? [row.date] : [],
      ),
    ),
  ].sort();
  const date = params.get("date") ?? dates[0] ?? "";
  const query = params.get("tracks") ?? "";
  const [selected, setSelected] = useState<string[]>(() =>
    params.get("track") ? [params.get("track")!] : [],
  );
  const [kind, setKind] = useState<"card" | "day-pass">("card");
  const [notice, setNotice] = useState("");
  const tracks = [
    ...new Set(
      (data?.sections.racecards ?? [])
        .filter((row) => row.date === date)
        .flatMap((row) => (row.track ? [row.track] : [])),
    ),
  ].sort();
  const visible = tracks.filter((track) =>
    track.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const choices = selected.filter((track) => tracks.includes(track));
  function change(key: string, value: string) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
    if (key === "date") setSelected([]);
    setNotice("");
  }
  function add() {
    const base = {
      productId: product.id,
      kind,
      date,
      horseId: "",
      horseName: "",
    };
    const items: CartItem[] =
      kind === "day-pass"
        ? [{ ...base, track: "" }]
        : choices.map((track) => ({ ...base, track }));
    cart.add(items);
    setNotice("Cart updated. Review your selections before continuing.");
  }
  return (
    <section className="pp-order">
      <div className="pp-section-heading">
        <div>
          <span className="pp-kicker">01 / CHOOSE YOUR REPORT</span>
          <h2>Pricing & tracks</h2>
        </div>
        <span>Prices not set</span>
      </div>
      <p>
        Choose what you would like to buy. Published race entries help you find
        a track; they do not confirm that a PP file is available.
      </p>
      <div
        className="pp-buy-types"
        role="group"
        aria-label="Report purchase type"
      >
        <button
          aria-pressed={kind === "card"}
          onClick={() => {
            setKind("card");
            setNotice("");
          }}
        >
          <strong>Single cards</strong>
          <span>Choose one or more tracks</span>
        </button>
        {product.id !== "daily-racing-form" && (
          <button
            aria-pressed={kind === "day-pass"}
            onClick={() => {
              setKind("day-pass");
              setNotice("");
            }}
          >
            <strong>Day pass</strong>
            <span>Access plan for one race date</span>
          </button>
        )}
      </div>
      <div className="pp-order-filters">
        <label>
          Race date
          <input
            type="date"
            value={date}
            onChange={(e) => change("date", e.target.value)}
          />
        </label>
        <label>
          Find a track
          <input
            type="search"
            value={query}
            onChange={(e) => change("tracks", e.target.value)}
            placeholder="Track name"
          />
        </label>
        <button className="ws-button" onClick={refresh} disabled={refreshing}>
          Refresh tracks
        </button>
      </div>
      {error && (
        <p role="alert">
          {error} {data && "Showing the last loaded entries."}
        </p>
      )}
      {!data ? (
        <p role="status">
          {error
            ? "Tracks could not be loaded. Try Refresh tracks."
            : "Loading tracks..."}
        </p>
      ) : !tracks.length ? (
        <div className="pp-empty" role="status">
          <h3>No tracks available for this date.</h3>
          <p>Tracks will appear here when dated race entries are published.</p>
        </div>
      ) : kind === "card" ? (
        <fieldset className="pp-track-options">
          <legend>Select tracks ({choices.length} selected)</legend>
          {visible.length ? (
            visible.map((track) => (
              <label key={track}>
                <input
                  type="checkbox"
                  checked={choices.includes(track)}
                  onChange={(e) => {
                    setSelected((previous) =>
                      e.target.checked
                        ? [...previous, track]
                        : previous.filter((t) => t !== track),
                    );
                    setNotice("");
                  }}
                />
                <span>{track}</span>
              </label>
            ))
          ) : (
            <p>No tracks match your search.</p>
          )}
        </fieldset>
      ) : (
        <div className="pp-plan-note">
          <strong>Day pass selection</strong>
          <p>
            Selected date: {date}. Track coverage and access limits are not set
            yet.
          </p>
        </div>
      )}
      <div className="pp-order-summary">
        <span>
          {kind === "card"
            ? `${choices.length} track selections`
            : "1 day pass selection"}
          <small>Price pending / No file access</small>
        </span>
        <button
          className="ws-button pp-primary"
          disabled={
            !data ||
            !!error ||
            !tracks.length ||
            (kind === "card" && !choices.length) ||
            cart.items.length + (kind === "card" ? choices.length : 1) > 40
          }
          onClick={add}
        >
          Add to cart
        </button>
      </div>
      {cart.items.length + (kind === "card" ? choices.length : 1) > 40 && (
        <p role="status">
          The preview cart holds up to 40 selections. Remove an item before
          adding more.
        </p>
      )}
      {notice && (
        <p className="pp-save-notice" role="status">
          {notice}{" "}
          <Link to="/pps/cart" state={{ ppFrom: pathname + search }}>
            View cart
          </Link>
        </p>
      )}
      <p className="pp-footnote">
        Cart preview only. Nothing is charged or ordered. Duplicate selections
        are kept once.
      </p>
    </section>
  );
}
