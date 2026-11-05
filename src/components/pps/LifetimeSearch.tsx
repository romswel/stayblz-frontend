import { useState } from "react";
import { Link } from "react-router-dom";
import useRacingOverview from "../landing/useRacingOverview";
import { useCart } from "./CartContext";
import { recordsForDiscipline } from "./racingDiscipline";
export default function LifetimeSearch() {
  const { data, error, refreshing, refresh } = useRacingOverview();
  const { add, items } = useCart();
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [dam, setDam] = useState("");
  const [searched, setSearched] = useState(false);
  const [notice, setNotice] = useState("");
  const horses = name.trim()
    ? recordsForDiscipline(data?.sections.horses ?? [], "Thoroughbred").filter(
        (h) => h.name.toLowerCase().includes(name.trim().toLowerCase()),
      )
    : [];
  const providerSearch = !name.trim() && (!!year || !!dam.trim());
  return (
    <section className="pp-order">
      <span className="pp-kicker">HORSE REPORT</span>
      <h2>Find a horse</h2>
      <p>
        Search published horses by name. Birth-year and dam searches will need a
        connected horse-record provider.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearched(true);
          setNotice("");
        }}
        className="pp-horse-search"
      >
        <label>
          Horse name
          <input
            value={name}
            maxLength={150}
            onChange={(e) => {
              setName(e.target.value);
              setSearched(false);
            }}
            placeholder="Registered horse name"
          />
        </label>
        <span>or</span>
        <label>
          Birth year
          <input
            type="number"
            min="1900"
            max="2100"
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              setSearched(false);
            }}
          />
        </label>
        <label>
          Dam's name
          <input
            value={dam}
            maxLength={150}
            onChange={(e) => {
              setDam(e.target.value);
              setSearched(false);
            }}
          />
        </label>
        <button
          className="ws-button pp-primary"
          disabled={!name.trim() && !(year && dam.trim())}
        >
          Search horses
        </button>
      </form>
      {error && (
        <p role="alert">
          {error}{" "}
          <button className="ws-button" onClick={refresh} disabled={refreshing}>
            Retry horse search
          </button>
        </p>
      )}
      {searched && (
        <div role="status">
          {providerSearch ? (
            <p>
              Birth-year and dam searches are not connected yet. Try a horse
              name.
            </p>
          ) : !data ? (
            <p>
              {error
                ? "Horse records could not be loaded."
                : "Loading horse records..."}
            </p>
          ) : horses.length ? (
            <ul className="pp-horse-results">
              {horses.map((horse) => (
                <li key={horse.id}>
                  <div>
                    <strong>{horse.name}</strong>
                    <small>Published horse / Report not connected</small>
                  </div>
                  <button
                    className="ws-button"
                    disabled={!!error || refreshing || items.length >= 40}
                    onClick={() => {
                      add([
                        {
                          productId: "horse-history",
                          kind: "history",
                          date: "",
                          track: "",
                          horseId: horse.id,
                          horseName: horse.name,
                        },
                      ]);
                      setNotice("Horse added to the cart preview.");
                    }}
                  >
                    Add horse to cart
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No published horses match this name. A full provider search is not
              connected.
            </p>
          )}
        </div>
      )}
      {notice && (
        <p role="status">
          {notice} <Link to="/pps/cart">View cart</Link>
        </p>
      )}
      <p className="pp-footnote">
        Searching by name uses the horses published in Stayblz, not a complete
        registry. A cart selection does not request or purchase a horse-history
        report.
      </p>
    </section>
  );
}
