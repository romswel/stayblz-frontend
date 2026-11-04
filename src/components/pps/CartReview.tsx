import { Link } from "react-router-dom";
import { ppProducts } from "./catalog";
import { cartKey, useCart } from "./CartContext";
export default function CartReview({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { items, remove, clear, storageError } = useCart();
  return (
    <div className="pp-cart-review">
      <span className="pp-kicker">CART PREVIEW</span>
      <h2>Your cart</h2>
      <p>
        Racing products and checkout are not available yet. These selections are
        saved in this browser tab for your account. They are not orders or
        purchases.
      </p>
      {storageError && (
        <p role="alert">
          Selections are kept on this screen, but could not be saved for a
          reload.
        </p>
      )}
      {items.length ? (
        <>
          <ul className="pp-cart-items">
            {items.map((item) => (
              <li key={cartKey(item)}>
                <div>
                  <Link to={`/pps/${item.productId}`} onClick={onNavigate}>
                    {ppProducts.find((p) => p.id === item.productId)?.name}
                  </Link>
                  <p>
                    {item.kind === "lifetime"
                      ? item.horseName
                      : [
                          item.date,
                          item.kind === "card"
                            ? item.track
                            : item.kind === "day-pass"
                              ? "Day pass"
                              : "Subscription enquiry",
                        ].join(" / ")}
                  </p>
                  <small>Price pending / No file access</small>
                </div>
                <button
                  className="ws-button"
                  onClick={() => remove(cartKey(item))}
                  aria-label={`Remove ${item.track || item.horseName || item.kind}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button className="ws-button" onClick={clear}>
            Clear cart
          </button>
        </>
      ) : (
        <div className="pp-empty">
          <h3>Your cart is empty.</h3>
          <p>Choose a report, then select a date and tracks.</p>
        </div>
      )}
      <div className="pp-cart-total">
        <span>Total</span>
        <strong>Not available</strong>
      </div>
      <button className="ws-button" disabled>
        Checkout unavailable
      </button>
      <p className="pp-footnote">
        Prices, secure payment and licensed file delivery must be connected
        before checkout opens. No payment details are collected.
      </p>
      <Link className="ws-button" to="/pps" onClick={onNavigate}>
        Continue browsing PPs
      </Link>
    </div>
  );
}
