import { useState } from "react";
import { Link } from "react-router-dom";
import Modal from "../Modal";
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
    <Modal label="Stayblz Updates" onClose={dismiss}>
      <div className={`up-pop kind-${post.kind}`}>
        <div className="up-pop-ribbon" aria-hidden="true">
          <span>✦</span> What's happening on Stayblz
        </div>
        <PostMeta post={post} />
        <h2>{post.title}</h2>
        {post.summary && <p>{post.summary}</p>}
        <UpdateItems post={post} limit={4} />
        {more > 0 && (
          <p className="up-pop-more">
            {more === 1 ? "1 more new post" : `${more} more new posts`} on the Updates page.
          </p>
        )}
        <div className="up-pop-actions">
          <Link className="btn btn-primary" to={`/updates/${post.slug}`} onClick={dismiss}>
            Read the full post
          </Link>
          <button type="button" className="btn btn-quiet" onClick={dismiss}>
            Got it
          </button>
          <button
            type="button"
            className="btn btn-quiet up-pop-off"
            onClick={() => {
              setClosed(true);
              void setPopup(false);
            }}
          >
            Don't show pop-ups again
          </button>
        </div>
        <p className="up-pop-note">
          Every post stays on <strong>Updates</strong> in the menu. You can switch pop-ups back on there or in
          Preferences.
        </p>
      </div>
    </Modal>
  );
}
