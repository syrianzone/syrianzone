// Function to replace Twitter SVG URLs with local ones
function replaceSvgUrls() {
  // Create a new MutationObserver to watch for DOM changes
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        processDomChanges();
      }
    }
  });

  // Start observing the document body for DOM changes
  observer.observe(document.body, { childList: true, subtree: true });

  // Process current DOM
  processDomChanges();
}

// Process DOM and replace URLs
function processDomChanges() {
  // Find all elements with background-image or src containing the target URL
  const elements = document.querySelectorAll("*");

  elements.forEach((el) => {
    // Check for background-image style
    const style = window.getComputedStyle(el);
    const backgroundImage = style.backgroundImage;

    if (
      backgroundImage &&
      backgroundImage.includes(
        "https://abs-0.twimg.com/emoji/v2/svg/1f1f8-1f1fe.svg"
      )
    ) {
      const localUrl = chrome.runtime.getURL("1f1f8-1f1fe.svg");
      el.style.backgroundImage = backgroundImage.replace(
        "https://abs-0.twimg.com/emoji/v2/svg/1f1f8-1f1fe.svg",
        localUrl
      );
    }

    // Check for image src attributes
    if (
      el.tagName === "IMG" &&
      el.src &&
      el.src.includes("https://abs-0.twimg.com/emoji/v2/svg/1f1f8-1f1fe.svg")
    ) {
      el.src = chrome.runtime.getURL("1f1f8-1f1fe.svg");
    }
  });
}

// Run when the page loads
window.addEventListener("load", replaceSvgUrls);
// Also run immediately in case the page has already loaded
replaceSvgUrls();
