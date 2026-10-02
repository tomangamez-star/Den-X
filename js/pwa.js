(function () {
  const isNative = window.Capacitor?.isNativePlatform?.() === true;
  if (isNative) return;

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(error => {
        console.warn("DenX service worker registration failed:", error);
      });
    });
  }
})();
