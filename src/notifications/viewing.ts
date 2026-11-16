/** Which chat is on screen right now ("personal:<id>" / "team:<id>"), so its own messages don't raise alerts. */
let viewing: string | null = null;
export const setViewingChat = (key: string | null) => {
  viewing = key;
};
export const viewingChat = () => viewing;
