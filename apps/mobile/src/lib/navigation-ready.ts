type NavigationReadiness = {
  isReady: () => boolean;
  addListener: (event: "ready", listener: () => void) => () => void;
};

/** Root state can exist before its navigator mounts, so wait for actual readiness. */
export function whenNavigationReady(navigation: NavigationReadiness, onReady: () => void) {
  let cancelled = false;
  let notified = false;
  const check = () => {
    if (!cancelled && !notified && navigation.isReady()) {
      notified = true;
      onReady();
    }
  };
  const unsubscribe = navigation.addListener("ready", check);
  check();
  return () => {
    cancelled = true;
    unsubscribe();
  };
}
