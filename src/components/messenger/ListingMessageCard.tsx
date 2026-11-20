import { useState } from "react";
import { Link } from "react-router-dom";
import { pictureUrl } from "../marketplace/media";
import { formatPrice } from "../marketplace/options";
import type { ChatListing } from "./types";

/**
 * The Marketplace listing a message is about ("Message seller"), shown under the buyer's message.
 * Details are a snapshot from when the message was sent; opening it shows the listing as it is now.
 */
export default function ListingMessageCard({ listing: l }: { listing: ChatListing }) {
  const [broken, setBroken] = useState(false);
  const picture = l.cover && !broken ? pictureUrl({ id: l.cover.id, kind: l.cover.kind, poster: l.cover.poster }) : null;
  return (
    <Link
      to={`/marketplace?listing=${encodeURIComponent(l.id)}`}
      className="mx-listingcard"
      aria-label={`Marketplace listing: ${l.name}, ${formatPrice(l.price)}, ${l.location}. Open listing`}
    >
      <span className="mx-listingcard-media">
        {picture ? (
          <img src={picture} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
        ) : (
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 20c1-6 4-7 6-11l-5 2-1.5-2.5L11 3.5l1-3 4 4c5 3 6.5 9 6 15.5z" />
          </svg>
        )}
      </span>
      <span className="mx-listingcard-text">
        <small>Marketplace</small>
        <strong>{l.name}</strong>
        <span className="mx-listingcard-price">{formatPrice(l.price)}</span>
        <span className="mx-listingcard-loc">{l.location}</span>
      </span>
      <span className="mx-listingcard-go">View listing</span>
    </Link>
  );
}
