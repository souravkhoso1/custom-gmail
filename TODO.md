# TODO — Improvement Backlog

## Security

## Bugs

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
- [ ] Wrap all JS in an IIFE or module to avoid polluting global scope
