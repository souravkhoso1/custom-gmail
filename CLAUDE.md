# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

Serve the project with Python's built-in HTTP server from the repo root:

```bash
python -m http.server 8000   # Python 3
# or
python -m SimpleHTTPServer 8000  # Python 2
```

Then open `http://localhost:8000`.

There is no build step, no package manager, and no test suite. All dependencies are loaded from CDNs at runtime.

## Architecture

This is a single-page Gmail client. The entire app is one HTML page (`index.html`) with vanilla JS (`js/script.js`) and custom CSS (`css/style.css`). There is no bundler or framework.

**Authentication**: `gapi.client.init` (Google API client library, loaded asynchronously from `apis.google.com`) handles OAuth2. The hardcoded `CLIENT_ID` in `js/script.js` belongs to the original developer's Google Cloud project — you'll need to replace it with your own if setting up a fresh OAuth app in Google Cloud Console.

**Three-panel layout**:
- Left sidebar (15%): mailbox labels (Inbox, Sent, Trash, Spam) with unread badge counts fetched via `gmail.users.labels.get`
- Middle panel (25%): message list loaded 10 at a time via `gmail.users.messages.list`, with "Load More Emails" pagination
- Right panel (60%): full message body rendered as HTML via `gmail.users.messages.get`

**Gmail API scopes**: `gmail.readonly` + `gmail.send`. Message bodies are base64url-encoded by Gmail and decoded client-side with `atob` + `decodeURIComponent(escape(...))`.

**jQuery** is used for all DOM manipulation (`$`). W3.CSS and Font Awesome 5 provide layout/icons.

The `index_bkp.html`, `index_bkp2.html`, `js/script_bkp.js`, and `css/style_bkp.css` files are old snapshots kept as reference — the active files are `index.html`, `js/script.js`, and `css/style.css`.
