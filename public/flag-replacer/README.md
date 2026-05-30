# Twitter SVG Flag Replacer

A Chrome extension that replaces remote Twitter flag emoji SVGs with local versions. Specifically, it replaces `https://abs-0.twimg.com/emoji/v2/svg/1f1f8-1f1fe.svg` with a local SVG file.

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by toggling the switch in the top right corner
4. Click "Load unpacked" and select the directory containing this extension
5. The extension should now be installed and active

## Features

- Automatically replaces remote SVG URLs with local versions
- Works on Twitter and X domains
- Uses MutationObserver to handle dynamically loaded content

## Notes

- You need to add icon files to the `images` directory before using this extension
- This is a basic implementation that only replaces one specific SVG file
- To expand functionality, add more SVG files and update the content script accordingly
