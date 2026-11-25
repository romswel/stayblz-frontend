// What each message on Stayblz means and what to do about it (the /status page). Keep the titles the same as the
// words people actually see (ConnectionNotice, api.ts `friendly`, StatusPage), so they can find them here.

export interface GuideEntry {
  id: string;
  title: string;
  meaning: string;
  todo: string;
}

export const ERROR_GUIDE: GuideEntry[] = [
  {
    id: "offline",
    title: "You're offline",
    meaning: "Your phone or computer has no internet connection right now.",
    todo: "Check your Wi-Fi or mobile data. Stayblz carries on by itself when you're back online.",
  },
  {
    id: "down",
    title: "Can't reach Stayblz",
    meaning:
      "Your device is online, but Stayblz's server didn't answer. It may be restarting after an update, or be down for a short while.",
    todo: "Wait a minute. The notice keeps checking and says \"Back online\" when the server answers. You don't need to reload.",
  },
  {
    id: "slow",
    title: "Still working…",
    meaning: "Something has been loading for more than 8 seconds. The server is busy or just waking up.",
    todo: "Give it up to a minute. If it happens all the time, check the live status at the top of this page.",
  },
  {
    id: "timeout",
    title: "Stayblz is taking too long to answer",
    meaning: "We waited 45 seconds without an answer, so we stopped waiting.",
    todo: "Try again. If you were saving something, check whether it saved before you try again.",
  },
  {
    id: "busy",
    title: "Too many requests in a short time",
    meaning: "A lot of requests came from your device or network in a short time, so Stayblz paused them to keep the site safe.",
    todo: "Wait for the time shown in the message, then try again.",
  },
  {
    id: "signed-out",
    title: "Your session has ended",
    meaning: "You were logged out: the session ran out, your password changed, or someone chose \"Log out everywhere\".",
    todo: "Log in again, then open the page you were on.",
  },
  {
    id: "forbidden",
    title: "You don't have access to this",
    meaning: "The page belongs to a different role, stable or plan than the one you're using.",
    todo: "Check which stable is selected. If you should have access, ask the stable's owner to invite you.",
  },
  {
    id: "not-found",
    title: "This page isn't on the card",
    meaning: "The link is old or mistyped, or the item was removed.",
    todo: "Go back, or use the menu to find what you were looking for.",
  },
  {
    id: "conflict",
    title: "This changed while you were working",
    meaning: "Someone else, or you in another tab, changed the same thing first.",
    todo: "Reload to see the latest version, then make your change again.",
  },
  {
    id: "too-large",
    title: "That's too large to send",
    meaning: "The file or text is over the size limit.",
    todo: "Try a smaller file or a shorter text. Chat settings show the file limits for chat.",
  },
  {
    id: "server",
    title: "Something went wrong on our side",
    meaning: "The server hit an unexpected problem with that request. It isn't something you did.",
    todo: "Try again in a moment. If it keeps happening on the same page, try again later.",
  },
  {
    id: "outdated",
    title: "A newer version of Stayblz is ready",
    meaning: "Stayblz was updated while your page was open, so part of the old page couldn't load.",
    todo: "Reload. Stayblz usually does this for you.",
  },
];
