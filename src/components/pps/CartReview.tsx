import { Link } from "react-router-dom";
import { ppProducts } from "./catalog";
import { cartKey, useCart } from "./CartContext";
import { useConfirm } from "../ui/Confirm";
export default function CartReview({
  onNavigate,
  inDialog = false,
}: {
  onNavigate?: () => void;
  /** In the cart pop-up the dialog header already shows the title. */
  inDialog?: boolean;
}) {
  const confirm = useConfirm();
  const { items, remove, clear, storageError, catalogueChanged } = useCart();
  return (
    <div className="pp-cart-review">
      {!inDialog && (
        <>
          <span className="pp-kicker">CART PREVIEW</span>
          <h2>Your cart</h2>
        </>
      )}
      <p>
        Racing products and checkout are not available yet. These selections are
        saved in this browser tab for your account. They are not orders or
        purchases.
      </p>
      {catalogueChanged && (
        <p role="status">
          The report catalogue has changed. Please choose your report selections
          again; previous selections were not turned into new products.
        </p>
      )}
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
                    {item.kind === "history"
                      ? item.horseName
                      : [
                          item.date,
                          item.kind === "card"
                            ? item.track
                            : item.kind === "day-pass"
                              ? "Day pass"
                              : "Report selection",
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
          <button
            className="ws-button"
            onClick={async () => {
              if (await confirm({ title: "Clear your cart?", message: "All selections are removed from this preview.", confirmLabel: "Clear cart" }))
                clear();
            }}
          >
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
