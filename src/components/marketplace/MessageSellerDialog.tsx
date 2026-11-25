import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { MessageSeller } from "./ListingDetails";
import { pictureUrl } from "./media";
import { formatPrice, type Listing } from "./options";
import "./marketplace-media.css";

/**
 * A card's "Message" button: the message box right away. Built only from the card's listing, so
 * nothing has to load first (the full details stay one tap away).
 */
export default function MessageSellerDialog({
  listing,
  onClose,
  onViewDetails,
}: {
  listing: Listing;
  onClose: () => void;
  onViewDetails: () => void;
}) {
  const picture = listing.cover ? pictureUrl(listing.cover) : null;
  return (
    <Modal label={`Message ${listing.sellerName} about ${listing.name}`} className="modal-sm mkm-message-modal" onClose={onClose}>
      <DialogHead kicker="Message the seller" title={listing.name} onClose={onClose} />
      <div className="dlg mkm-message">
        <div className="mkm-message-listing">
          {picture ? <img src={picture} alt="" /> : <span className="mkm-message-thumb" aria-hidden="true" />}
          <span className="mkm-message-text">
            <b>{formatPrice(listing.price)}</b>
            <small>{listing.location}</small>
          </span>
          <button type="button" className="btn btn-quiet mkm-message-details" onClick={onViewDetails}>
            View listing
          </button>
        </div>
        <MessageSeller listing={listing} autoFocus />
      </div>
    </Modal>
  );
}
