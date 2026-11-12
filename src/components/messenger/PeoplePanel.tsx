import { useCallback, useEffect, useState } from "react";
import { peopleApi, notifyChatsChanged } from "./chatApi";
import { useConfirm } from "../ui/Confirm";
import { Avatar, ChatsIcon, SearchIcon, UserMinusIcon, UserPlusIcon } from "./icons";
import type { FriendStatus, Person, ThreadResponse } from "./types";

const ROLE: Record<string, string> = { owner: "Owner", trainer: "Trainer", jockey: "Jockey", staff: "Stable staff", fan: "Racing fan", other: "" };
const message = (reason: unknown, fallback: string) => (reason instanceof Error ? reason.message : fallback);

/**
 * People: find members by name (only those who are findable), friend requests, and your friends.
 * Friends' messages go straight to your chats; everyone else's arrive as requests.
 */
export default function PeoplePanel({ onOpen }: { onOpen: (data: ThreadResponse) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [lists, setLists] = useState<{ friends: Person[]; incoming: Person[]; outgoing: Person[] } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const confirm = useConfirm();

  const loadFriends = useCallback((signal?: AbortSignal) => {
    peopleApi
      .friends(signal)
      .then((d) => !signal?.aborted && setLists({ friends: d?.friends ?? [], incoming: d?.incoming ?? [], outgoing: d?.outgoing ?? [] }))
      .catch((e) => !signal?.aborted && setError(message(e, "People could not be loaded.")));
  }, []);
  useEffect(() => {
    const c = new AbortController();
    loadFriends(c.signal);
    return () => c.abort();
  }, [loadFriends]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const c = new AbortController();
    const timer = window.setTimeout(() => {
      peopleApi
        .search(q, c.signal)
        .then((d) => !c.signal.aborted && setResults(d?.people ?? []))
        .catch((e) => !c.signal.aborted && setError(message(e, "Search isn't working right now.")))
        .finally(() => !c.signal.aborted && setSearching(false));
    }, 300);
    return () => {
      window.clearTimeout(timer);
      c.abort();
    };
  }, [query]);

  const setStatus = (id: string, status: FriendStatus) =>
    setResults((old) => old?.map((p) => (p.id === id ? { ...p, status } : p)) ?? old);

  async function act(person: Person, action: "request" | "accept" | "decline" | "remove") {
    if (busy) return;
    if (action === "remove" && person.status === "friends") {
      const ok = await confirm({
        title: `Remove ${person.name} as a friend?`,
        message: "Your chats stay. New messages from them will arrive as requests until you're friends again.",
        confirmLabel: "Remove friend",
      });
      if (!ok) return;
    }
    setBusy(person.id);
    setError("");
    try {
      const d = await peopleApi.friend(person.id, action);
      setStatus(person.id, d.status);
      loadFriends();
      if (action === "accept") notifyChatsChanged();
    } catch (e) {
      setError(message(e, "That didn't work. Try again."));
    } finally {
      setBusy(null);
    }
  }
  async function chat(person: Person) {
    if (busy) return;
    setBusy(person.id);
    setError("");
    try {
      onOpen(await peopleApi.chatWith(person.id));
    } catch (e) {
      setError(message(e, "The chat could not be opened."));
    } finally {
      setBusy(null);
    }
  }

  const row = (p: Person, actions: "search" | "friend" | "incoming" | "outgoing") => (
    <li key={p.id} className="mx-person">
      <Avatar name={p.name} size="sm" active={!!p.active} />
      <span className="mx-person-text">
        <span className="mx-person-name">{p.name}</span>
        <span className="mx-person-sub">
          {p.active ? "Active now" : ROLE[p.role ?? ""] || (p.status === "friends" ? "Friend" : "Member")}
        </span>
      </span>
      <span className="mx-person-actions">
        {actions === "incoming" ? (
          <>
            <button type="button" className="mx-pill is-primary" disabled={busy === p.id} onClick={() => void act(p, "accept")}>
              Accept
            </button>
            <button type="button" className="mx-pill" disabled={busy === p.id} onClick={() => void act(p, "decline")}>
              Decline
            </button>
          </>
        ) : actions === "outgoing" ? (
          <button type="button" className="mx-pill" disabled={busy === p.id} onClick={() => void act(p, "remove")}>
            Cancel request
          </button>
        ) : (
          <>
            {actions === "friend" && (
              <button type="button" className="mx-icon-btn" aria-label={`Remove ${p.name} as a friend`} title="Remove friend" disabled={busy === p.id} onClick={() => void act({ ...p, status: "friends" }, "remove")}>
                <UserMinusIcon size={18} />
              </button>
            )}
            {actions === "search" && p.status === "none" && (
              <button type="button" className="mx-icon-btn" aria-label={`Add ${p.name} as a friend`} title="Add friend" disabled={busy === p.id} onClick={() => void act(p, "request")}>
                <UserPlusIcon size={18} />
              </button>
            )}
            {actions === "search" && p.status === "outgoing" && <span className="mx-tag">Requested</span>}
            {actions === "search" && p.status === "incoming" && (
              <button type="button" className="mx-pill is-primary" disabled={busy === p.id} onClick={() => void act(p, "accept")}>
                Accept
              </button>
            )}
            <button type="button" className="mx-icon-btn" aria-label={`Message ${p.name}`} title="Message" disabled={busy === p.id} onClick={() => void chat(p)}>
              <ChatsIcon size={18} />
            </button>
          </>
        )}
      </span>
    </li>
  );

  return (
    <div className="mx-people">
      <div className="mx-list-tools">
        <label className="mx-search">
          <SearchIcon />
          <input type="search" placeholder="Find people by name" aria-label="Find people by name" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>
      {error && (
        <p className="form-error mx-people-error" role="alert">
          {error}
        </p>
      )}
      {results !== null || searching ? (
        <section aria-label="Search results">
          <p className="mx-list-label">{searching ? "Searching…" : `Results (${results?.length ?? 0})`}</p>
          {!searching && results && !results.length && (
            <p className="mx-hint mx-pad">No one found. Some people choose not to be findable by name — try their account email from New chat.</p>
          )}
          <ul className="mx-items">{(results ?? []).map((p) => row(p, "search"))}</ul>
        </section>
      ) : (
        <>
          {!lists && !error && <p className="mx-hint mx-pad" role="status">Loading people…</p>}
          {lists && lists.incoming.length > 0 && (
            <section aria-label="Friend requests">
              <p className="mx-list-label">Friend requests ({lists.incoming.length})</p>
              <ul className="mx-items">{lists.incoming.map((p) => row(p, "incoming"))}</ul>
            </section>
          )}
          {lists && (
            <section aria-label="Friends">
              <p className="mx-list-label">Friends ({lists.friends.length})</p>
              {!lists.friends.length && (
                <p className="mx-hint mx-pad">
                  No friends yet. Search for someone above and tap <UserPlusIcon size={13} /> to add them. Friends' messages skip Requests.
                </p>
              )}
              <ul className="mx-items">{lists.friends.map((p) => row(p, "friend"))}</ul>
            </section>
          )}
          {lists && lists.outgoing.length > 0 && (
            <section aria-label="Sent requests">
              <p className="mx-list-label">Sent requests</p>
              <ul className="mx-items">{lists.outgoing.map((p) => row(p, "outgoing"))}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
