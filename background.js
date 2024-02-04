function togglePage() {
  const url = new URL(document.location.href);
  const hostname = url.hostname;
  if (document.body.classList.contains("darkviewer-active")) {
    undarkenPage(hostname);
  } else {
    darkenPage(hostname);
  }
}

function applyFilter(node) {
  if (node.style)
    node.style.filter =
      "invert(100%) hue-rotate(180deg) contrast(80%) saturate(80%)";
}

function removeFilter(node) {
  if (node.style) node.style.filter = "none";
}

function searchIFrames(doc) {
  let imgList = [];
  doc.querySelectorAll("iframe").forEach((iframe) => {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      imgList = imgList.concat(searchImages(iframeDoc) || []);
      imgList = imgList.concat(searchBackgroundImages(iframeDoc) || []);
      imgList = imgList.concat(searchVideo(iframeDoc) || []);
      imgList = imgList.concat(searchIframes(iframeDoc) || []);
    } catch (e) {
      // no-op
    }
  });
  return imgList;
}

function searchImages(doc) {
  return Array.from(doc.images);
}

function searchBackgroundImages(doc) {
  const srcChecker = /url\(\s*?['"]?\s*?(\S+?)\s*?["']?\s*?\)/i;
  return Array.from(
    Array.from(doc.querySelectorAll("*")).reduce((collection, node) => {
      let prop = window
        .getComputedStyle(node, null)
        .getPropertyValue("background-image");
      let match = srcChecker.exec(prop);
      if (match) {
        collection.add(match[1]);
      }
      return collection;
    }, new Set())
  );
}

function searchVideo(doc) {
  return Array.from(doc.querySelectorAll("video"));
}

function darkenPage(hostname) {
  applyFilter(window.document.querySelector("html"));
  searchImages(window.document).forEach(applyFilter);
  searchBackgroundImages(window.document).forEach(applyFilter);
  searchIFrames(window.document).forEach(applyFilter);
  searchVideo(window.document).forEach(applyFilter);
  window.document.body.classList.add("darkviewer-active");
  chrome.storage.sync.set({ [hostname]: true });
}

function undarkenPage(hostname) {
  removeFilter(window.document.querySelector("html"));
  searchImages(window.document).forEach(removeFilter);
  searchBackgroundImages(window.document).forEach(removeFilter);
  searchIFrames(window.document).forEach(removeFilter);
  searchVideo(window.document).forEach(removeFilter);
  window.document.body.classList.remove("darkviewer-active");
  chrome.storage.sync.set({ [hostname]: false });
}

function addStyle() {
  const style = document.createElement("style");
  style.textContent = `
    .darkviewer-active {
      background: #fff;
      color: #000;
    }
  `;

  document.head.appendChild(style);
}

chrome.action.onClicked.addListener((tab) => {
  const url = new URL(tab.url);
  const hostname = url.hostname;
  if (!tab.url.includes("chrome://")) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: togglePage,
    });
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: addStyle,
    });
    chrome.storage.sync.get([hostname]).then((obj) => {
      if (obj[hostname]) {
        chrome.action.setIcon({ path: "dark.png" });
      } else {
        chrome.action.setIcon({ path: "light.png" });
      }
      chrome.storage.sync.set({ [hostname]: !obj[hostname] });
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  chrome.scripting.executeScript({
    target: { tabId: sender.tab.id },
    function: addStyle,
  });
  if (request.action === "darken") {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      function: darkenPage,
    });
    chrome.action.setIcon({ path: "light.png" });
  } else if (request.action === "undarken") {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      function: undarkenPage,
    });
    chrome.action.setIcon({ path: "dark.png" });
  }
});
