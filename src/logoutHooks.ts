/**
 * Things to tidy up while still signed in, just before logging out (e.g. this device stops getting the
 * account's push alerts). Each hook gets a couple of seconds; a failure never blocks logging out.
 */
const hooks = new Set<() => Promise<unknown> | unknown>();

export function beforeLogout(hook: () => Promise<unknown> | unknown) {
  hooks.add(hook);
  return () => void hooks.delete(hook);
}

export async function runLogoutHooks() {
  const timeout = new Promise((resolve) => setTimeout(resolve, 2500));
  await Promise.race([Promise.allSettled([...hooks].map((hook) => Promise.resolve().then(hook))), timeout]);
}
