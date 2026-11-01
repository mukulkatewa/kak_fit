import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { whenNavigationReady } from "./navigation-ready";

function createNavigator(initiallyReady = false) {
  let ready = initiallyReady;
  const listeners = new Set<() => void>();
  return {
    isReady: () => ready,
    addListener: (_event: "ready", listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    mount: () => {
      ready = true;
      listeners.forEach((listener) => listener());
    },
  };
}

describe("startup navigation readiness", () => {
  it("waits for a cold-start navigator and notifies once", () => {
    const navigation = createNavigator();
    let redirects = 0;
    const cancel = whenNavigationReady(navigation, () => redirects++);
    assert.equal(redirects, 0);
    navigation.mount();
    navigation.mount();
    assert.equal(redirects, 1);
    cancel();
  });

  it("handles an already mounted navigator without missing its ready event", () => {
    let redirects = 0;
    const cancel = whenNavigationReady(createNavigator(true), () => redirects++);
    assert.equal(redirects, 1);
    cancel();
  });

  it("does not redirect after the subscriber unmounts", () => {
    const navigation = createNavigator();
    let redirects = 0;
    const cancel = whenNavigationReady(navigation, () => redirects++);
    cancel();
    navigation.mount();
    assert.equal(redirects, 0);
  });
});
