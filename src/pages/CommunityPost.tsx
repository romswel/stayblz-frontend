import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { errorText, type Post } from "../components/community/api";
import { Empty, Icon, PostCard, Skeletons } from "../components/community/ui";

/** /community/posts/:id — one post, for shared links. */
export default function CommunityPost() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    api
      .get<{ post: Post }>(`/api/community/posts/${id}`)
      .then((r) => live && setPost(r.post))
      .catch((e) => live && setError(errorText(e, "This post isn't available.")));
    return () => {
      live = false;
    };
  }, [id]);
  return (
    <div className="cm cm-narrow">
      {error ? (
        <Empty icon={<Icon.Lock />} title="This post isn't available">
          <p>It may have been removed, or shared only with the author's followers.</p>
          <Link className="cm-btn" to="/community">Go to Feeds</Link>
        </Empty>
      ) : post ? (
        <PostCard post={post} onRemoved={() => navigate("/community", { replace: true })} />
      ) : (
        <Skeletons count={1} />
      )}
    </div>
  );
}
