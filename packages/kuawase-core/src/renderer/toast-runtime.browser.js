(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (typeof window.showToast === "function" && typeof window.showToastAndReload === "function") {
    return;
  }

  function getOrCreateToast() {
    let toast = document.getElementById("toast");
    if (!toast && document.body) {
      toast = document.createElement("div");
      toast.id = "toast";
      toast.style.display = "none";
      toast.style.position = "fixed";
      toast.style.top = "30px";
      toast.style.left = "50%";
      toast.style.transform = "translateX(-50%)";
      toast.style.background = "#222";
      toast.style.color = "#fff";
      toast.style.padding = "12px 32px";
      toast.style.borderRadius = "8px";
      toast.style.zIndex = "9999";
      toast.style.fontSize = "1.1em";
      toast.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
      document.body.appendChild(toast);
    }
    return toast;
  }

  function showToast(message, isError) {
    const toast = getOrCreateToast();
    if (!toast) return;
    toast.textContent = message;
    toast.style.background = isError ? "#b22" : "#222";
    toast.style.display = "block";
    setTimeout(() => {
      toast.style.display = "none";
    }, 1500);
  }

  function showToastAndReload(message, isError) {
    const toast = getOrCreateToast();
    if (!toast) return;
    toast.textContent = message;
    toast.style.background = isError ? "#b22" : "#222";
    toast.style.display = "block";
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  }

  if (typeof window.showToast !== "function") {
    window.showToast = showToast;
  }
  if (typeof window.showToastAndReload !== "function") {
    window.showToastAndReload = showToastAndReload;
  }
})();

