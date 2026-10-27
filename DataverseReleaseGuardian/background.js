chrome.runtime.onInstalled.addListener(() => {
    console.log("Dataverse Release Guardian installed.");
});

chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true
});