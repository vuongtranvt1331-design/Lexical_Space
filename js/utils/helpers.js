    function getStudentKey(username) {
      return (username || "").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
    }
    let toastTimeout = null;
    function showToast(msg, type = "success") {
      const toast = document.getElementById("toast");
      const icon = document.getElementById("toast-icon");
      const text = document.getElementById("toast-msg");
      if (!toast || !icon || !text) return;
      clearTimeout(toastTimeout);
      text.textContent = msg;
      if (type === "success") {
        toast.className = "fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-2xl transition-all duration-300 opacity-100 pointer-events-auto translate-y-0 font-bold text-xs bg-slate-900 text-white max-w-[92vw] border border-slate-700";
        icon.className = "ph-bold ph-check-circle text-emerald-400 text-lg flex-shrink-0";
      } else {
        toast.className = "fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-2xl transition-all duration-300 opacity-100 pointer-events-auto translate-y-0 font-bold text-xs bg-rose-950 text-white max-w-[92vw] border border-rose-800";
        icon.className = "ph-bold ph-warning-circle text-rose-400 text-lg flex-shrink-0";
      }
      toastTimeout = setTimeout(() => {
        toast.classList.remove("opacity-100", "translate-y-0", "pointer-events-auto");
        toast.classList.add("opacity-0", "translate-y-[-20px]", "pointer-events-none");
      }, 3000);
    }

    function escapeHtml(str) {
      if (!str) return "";
      return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
      }[tag] || tag));
    }

    function escapeQuotes(str) {
      if (!str) return "";
      return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }
export { getStudentKey, showToast, escapeHtml, escapeQuotes };
