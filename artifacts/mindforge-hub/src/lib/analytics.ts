// Automatic visitor counts use Firebase only; Google Analytics is not loaded.
// Preserve existing opt-outs without displaying a consent banner.
export function visitorCountingAllowed() {
  try { return localStorage.getItem("analytics-consent") !== "denied"; }
  catch { return false; }
}
