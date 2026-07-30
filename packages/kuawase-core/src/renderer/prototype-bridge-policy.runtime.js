(() => {
  const root = typeof window !== "undefined" ? window : globalThis;

  function shouldUseLegacyBridge({ params, paramKey, storageKey }) {
    if (params?.get(paramKey) === "1") {
      return true;
    }

    try {
      return root.localStorage?.getItem(storageKey) === "true";
    } catch {
      return false;
    }
  }

  root.KuawasePrototypeBridgePolicy = {
    shouldUseLegacyBridge
  };
})();
