import { useState } from "react";
import { Link } from "react-router-dom";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { PostMeta, UpdateItems } from "./UpdateParts";
import { useUpdates } from "./UpdatesContext";
import "./updates.css";

/**
 * After sign-in, shows the newest unread post once (only inside the signed-in layout, so
 * never on the landing or login pages). People can turn the pop-up off for good.
 */
export default function UpdatesPopup() {
  const { unread, popupOn, markSeen, setPopup } = useUpdates();
  const [closed, setClosed] = useState(false);
  const post = unread.find((candidate) => candidate.popup);
  if (!post || !popupOn || closed) return null;
  const more = unread.length - 1;
  const dismiss = () => {
    setClosed(true);
    void markSeen();
  };
  return (
    <Modal label="Stayblz Updates" onClose={dismiss} className="modal-up">
      <div className={`up-pop kind-${post.kind}`}>
        <DialogHead
          kicker={
            <>
              <span className="up-pop-spark" aria-hidden="true">
                ✦
              </span>{" "}
              New on Stayblz
            </>
          }
          title={post.title}
          onClose={dismiss}
        />
        <div className="dlg up-pop-body">
          <PostMeta post={post} />
          {post.summary && <p className="up-pop-summary">{post.summary}</p>}
          <UpdateItems post={post} limit={4} />
          {more > 0 && (
            <p className="up-pop-more">
              {more === 1 ? "1 more new post" : `${more} more new posts`} on the Updates page.
            </p>
          )}
          <div className="dlg-actions">
            <button type="button" className="btn btn-quiet" onClick={dismiss} data-autofocus>
              Got it
            </button>
            <Link className="btn btn-primary" to={`/updates/${post.slug}`} onClick={dismiss}>
              Read the full post
            </Link>
          </div>
          <p className="up-pop-note">
            Every post stays on <strong>Updates</strong> in the menu.{" "}
            <button
              type="button"
              className="up-link-button"
              onClick={() => {
                setClosed(true);
                void setPopup(false);
              }}
            >
              Don't show pop-ups again
            </button>
          </p>
        </div>
      </div>
    </Modal>
  );
}
