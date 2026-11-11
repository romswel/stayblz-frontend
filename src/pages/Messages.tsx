import Messenger from "../components/messenger/Messenger";

/** Personal messages (/messages) and team messages (/team-messages). See components/messenger/. */
export default function Messages({ mode = "personal" }: { mode?: "personal" | "team" }) {
  return <Messenger mode={mode} />;
}
