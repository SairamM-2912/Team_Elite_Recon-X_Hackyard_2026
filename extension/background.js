// RECON-X Extension Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log("RECON-X Database Security Companion installed.");
});

// Configure side panel behavior if supported
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
}
