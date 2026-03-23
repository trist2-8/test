chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: "vocab.html" });
});