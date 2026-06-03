# TODO — Improvement Backlog

## Security
- [ ] Fix off-by-one in `getHTMLPart`: `x <= arr.length` → `x < arr.length`
- [ ] Change `prompt: 'consent'` to `prompt: ''` in `handleAuthClick` — stop forcing the consent screen on every sign-in

## Bugs
- [ ] Guard "Load More" button behind a `nextPageToken` check — don't render it on the last page
- [ ] Handle `null` messages in `func2` (empty folder crash)
- [ ] Handle plain-text-only emails in `getBody` — `getHTMLPart` returning `''` makes `atob` throw
- [ ] Replace deprecated `.execute()` with `.then()` in `sendMessage`
- [ ] Replace deprecated `decodeURIComponent(escape(...))` with `new TextDecoder().decode(...)`
- [ ] Replace 150ms iframe height timeout with `ResizeObserver` or `onload`

## Missing Core Features
- [ ] Add Compose button and wire up the `sendEmail` modal in `index.html`
- [ ] Add Reply / Reply-All / Forward actions in the reading pane
- [ ] Add Delete / Archive / Mark as Spam actions on individual emails
- [ ] Add search bar using the Gmail API `q` parameter
- [ ] Make attachment filenames into download links
- [ ] Add thread view — group related messages together
- [ ] Add CC / BCC fields to the compose form
- [ ] Highlight active sidebar label and selected message in the list

## UX / UI
- [ ] Add loading spinners for message list and reading pane
- [ ] Show an empty-state message when a folder has no emails
- [ ] Remove unread badge from Sent / Trash / Spam (or show total count instead)
- [ ] Add keyboard navigation (j/k to move, r to reply, etc.)
- [ ] Make layout mobile-responsive (collapsible sidebar and message list)
- [ ] Change date format from `DD/MM` to `MMM D` (e.g. "Jun 2") for clarity

## Code Quality / Architecture
- [ ] Delete dead functions: `decodeEmailId`, `listUserInfo`, `listMessages`, `getMessageInfo`
- [ ] Rename `func1` → `updateLabelBadge`, `func2` → `renderMessageList`
- [ ] Wrap all JS in an IIFE or module to avoid polluting global scope
- [ ] Upgrade jQuery from 1.12.4 to 3.x (or remove it entirely)
- [ ] Add `.catch()` / error handling to all Gmail API calls, not just the INBOX label fetch
- [ ] Reduce `listLabels` from 4 separate calls to a single `labels.list` batch, and only re-fetch on change
