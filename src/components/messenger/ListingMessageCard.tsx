import { useState } from "react";
import { Link } from "react-router-dom";
import { pictureUrl } from "../marketplace/media";
import { stallionPicture } from "../stallions/api";
import { formatPrice } from "../marketplace/options";
import type { ChatListing } from "./types";

/**
 * The Marketplace listing a message is about ("Message seller"), shown under the buyer's message.
 * Details are a snapshot from when the message was sent; opening it shows the listing as it is now.
 */
export default function ListingMessageCard({ listing: l }: { listing: ChatListing }) {
  const [broken, setBroken] = useState(false);
  const stallion = l.kind === "stallion";
  const picture =
    l.cover && !broken
      ? stallion
        ? stallionPicture(l.cover)
        : pictureUrl({ id: l.cover.id, kind: l.cover.kind, poster: l.cover.poster })
      : null;
  const price = stallion ? (l.fee ?? "") : formatPrice(l.price);
  return (
    <Link
      to={stallion ? `/stallions/${encodeURIComponent(l.id)}` : `/marketplace?listing=${encodeURIComponent(l.id)}`}
      className="mx-listingcard"
      aria-label={`${stallion ? "Stayblz Stallions" : "Marketplace listing"}: ${l.name}, ${price}, ${l.location}. Open ${stallion ? "his page" : "listing"}`}
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
        <small>{stallion ? "Breeding request · Stayblz Stallions" : "Marketplace"}</small>
        <strong>{l.name}</strong>
        <span className="mx-listingcard-price">{price}</span>
        <span className="mx-listingcard-loc">{l.location}</span>
      </span>
      <span className="mx-listingcard-go">{stallion ? "View stallion" : "View listing"}</span>
    </Link>
  );
}
