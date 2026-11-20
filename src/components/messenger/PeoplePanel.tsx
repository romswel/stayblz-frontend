import { useCallback, useEffect, useRef, useState } from "react";
import { peopleApi, notifyChatsChanged } from "./chatApi";
import { useConfirm } from "../ui/Confirm";
import { presenceLabel, presenceOf } from "./format";
import { Avatar, ChatsIcon, SearchIcon, UserMinusIcon, UserPlusIcon } from "./icons";
import type { FriendStatus, Person, ThreadResponse } from "./types";

const ROLE: Record<string, string> = { owner: "Owner", trainer: "Trainer", jockey: "Jockey", staff: "Stable staff", fan: "Racing fan", other: "" };
const message = (reason: unknown, fallback: string) => (reason instanceof Error ? reason.message : fallback);
/** Presence changes slowly enough that a refresh every half minute keeps the dots honest. */
const REFRESH_MS = 30_000;

interface Lists {
  friends: Person[];
  incoming: Person[];
  outgoing: Person[];
  /** Everyone else you share a chat with (newer servers). */
  others: Person[];
  /** False on an older server without the contacts list: only friends are shown. */
  contacts: boolean;
}

/**
 * People: everyone you're connected with in Stayblz Chat — friends first, then the people in your chats (one-to-one
 * and groups) — each with Online / Away / Offline when they share it. Find more people by name with "Add people";
 * friend requests sit on top. Friends' messages go straight to your chats; everyone else's arrive as requests.
 */
export default function PeoplePanel({ onOpen }: { onOpen: (data: ThreadResponse) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [lists, setLists] = useState<Lists | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  const load = useCallback((signal?: AbortSignal) => {
    Promise.all([peopleApi.friends(signal), peopleApi.contacts(signal).catch(() => null)])
      .then(([friends, contacts]) => {
        if (signal?.aborted) return;
        const known = contacts?.people;
        const friendIds = new Set((friends?.friends ?? []).map((p) => p.id));
        setLists({
          // The contacts list carries presence and is sorted (online first); fall back to the plain friends list.
          friends: known ? known.filter((p) => p.status === "friends") : (friends?.friends ?? []),
          incoming: friends?.incoming ?? [],
          outgoing: friends?.outgoing ?? [],
          others: known ? known.filter((p) => p.status !== "friends" && !friendIds.has(p.id)) : [],
          contacts: !!known,
        });
        setError("");
      })
      .catch((e) => !signal?.aborted && setError(message(e, "People could not be loaded.")));
  }, []);
  useEffect(() => {
    const c = new AbortController();
    load(c.signal);
    const timer = window.setInterval(() => !document.hidden && load(c.signal), REFRESH_MS);
    return () => {
      c.abort();
      window.clearInterval(timer);
    };
  }, [load]);

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
      load();
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
  function startAdding() {
    setAdding(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  const sub = (p: Person) => {
    const state = presenceLabel(p);
    const role = ROLE[p.role ?? ""] || "";
    const shared = p.sharedChats ? `${p.sharedChats} ${p.sharedChats === 1 ? "chat" : "chats"} together` : "";
    return [state, role || (p.status === "friends" ? "Friend" : shared || "Member")].filter(Boolean).join(" · ");
  };

  const row = (p: Person, actions: "search" | "friend" | "other" | "incoming" | "outgoing") => (
    <li key={p.id} className="mx-person">
      <Avatar name={p.name} id={p.id} size="sm" presence={presenceOf(p)} />
      <span className="mx-person-text">
        <span className="mx-person-name">{p.name}</span>
        <span className="mx-person-sub">{sub(p)}</span>
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
            {(actions === "search" || actions === "other") && (p.status ?? "none") === "none" && (
              <button type="button" className="mx-icon-btn" aria-label={`Add ${p.name} as a friend`} title="Add friend" disabled={busy === p.id} onClick={() => void act(p, "request")}>
                <UserPlusIcon size={18} />
              </button>
            )}
            {(actions === "search" || actions === "other") && p.status === "outgoing" && <span className="mx-tag">Requested</span>}
            {(actions === "search" || actions === "other") && p.status === "incoming" && (
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

  const online = lists ? [...lists.friends, ...lists.others].filter((p) => presenceOf(p) === "online").length : 0;
  const outgoingOnly = lists ? lists.outgoing.filter((p) => !lists.others.some((o) => o.id === p.id)) : [];

  return (
    <div className="mx-people">
      <div className="mx-list-tools mx-people-tools">
        <label className="mx-search">
          <SearchIcon />
          <input
            ref={searchRef}
            type="search"
            placeholder={adding ? "Type a name to find people" : "Find people by name"}
            aria-label="Find people by name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button type="button" className="mx-pill is-primary mx-add-people" onClick={startAdding} title="Find people by name to add or message">
          <UserPlusIcon size={16} /> Add people
        </button>
      </div>
      {adding && results === null && !searching && (
        <p className="mx-hint mx-pad">
          Search for someone by name, then tap <UserPlusIcon size={13} /> to send a friend request or <ChatsIcon size={13} /> to message them. People who
          aren't findable can be reached by their account email from New chat.
        </p>
      )}
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
          {lists && lists.contacts && (
            <p className="mx-people-summary" aria-live="polite">
              {online ? `${online} online now` : "No one is online right now"}
            </p>
          )}
          {lists && (
            <section aria-label="Friends">
              <p className="mx-list-label">Friends ({lists.friends.length})</p>
              {!lists.friends.length && (
                <p className="mx-hint mx-pad">
                  No friends yet. Tap <strong>Add people</strong> to find someone, then <UserPlusIcon size={13} /> to add them. Friends' messages skip
                  Requests.
                </p>
              )}
              <ul className="mx-items">{lists.friends.map((p) => row(p, "friend"))}</ul>
            </section>
          )}
          {lists && lists.others.length > 0 && (
            <section aria-label="People in your chats">
              <p className="mx-list-label">People in your chats ({lists.others.length})</p>
              <ul className="mx-items">{lists.others.map((p) => row(p, "other"))}</ul>
            </section>
          )}
          {lists && outgoingOnly.length > 0 && (
            <section aria-label="Sent requests">
              <p className="mx-list-label">Sent requests</p>
              <ul className="mx-items">{outgoingOnly.map((p) => row(p, "outgoing"))}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
