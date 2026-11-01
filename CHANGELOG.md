# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- "Sign in with Pushbullet" now uses your pushbullet.com sign-in, like the original extension (Pushpilot asks once to read it). A pushbullet.com tab you already have open is used as is; otherwise a small sign-in window opens and closes once you're in. Pushes you send then show in the Pushbullet apps under **Me** again. Signing in through Pushbullet's OAuth page made them land under Following › Pushpilot; that stays available as an option you pick, never a silent fallback. If pushbullet.com still holds a key from before you signed out there, Pushpilot waits for you to sign in again instead of using it.

### Added

- Already signed in? Settings › Account (and a one-time note in the popup) offers "Show them under Me", which switches over without losing anything.
- The sign-in page keeps Pushbullet's approval page as a second option, for anyone who'd rather not give Pushpilot pushbullet.com access, and says what it changes.

## [1.6.0] - 2026-11-01

### Added

- Pushpilot for Firefox (140 or newer), from the same code, with its own "Sign in with Pushbullet": the same popup, full page, side panel (as Firefox's sidebar), notifications with sound, and clipboard. Firefox has no favicon service and no global shortcuts, so site icons fall back to a globe and the push-what-you-copied shortcut works while Firefox is focused.

## [1.5.1] - 2026-10-31

### Added

- Pushpilot is on Microsoft Edge Add-ons, with its own "Sign in with Pushbullet" and rating link.

### Changed

- The store description no longer names browsers (Edge's review asks for that).
- The rating link in Settings reads "Rate Pushpilot" and goes to the store you installed from.

### Fixed

- The Overview's image count says "1 image", not "1 images".

## [1.5.0] - 2026-10-29

### Added

- Pushpilot as a full page: the new button next to your picture in the popup, or account menu › Open as a full page. On a laptop-sized window it's a dashboard with a sidebar and a New push button that slides the composer in from the side:
  - Overview: a greeting, this week's pushes, files shared, devices receiving and what's on your phone, with recent pushes, phone notifications, latest texts, recent files and your devices.
  - Files: every file you pushed as a gallery or a list, filtered by type, with the full-screen viewer for images.
  - Devices: a card per device with whether it gets pushes, what it can do, and Send to it.
  - Feed: a compact list beside the selected push in full (large picture or link preview, the whole note, video and audio players, file details) with Open, Copy, Mark as done and Delete; ↑/↓ or j/k move through it.
  - Phone: notifications as cards, filtered by app.
  - SMS: the conversation list beside the open conversation.
  In a narrow window it keeps the popup's layout.

### Fixed

- A phone notification without action buttons no longer shows a stray "0" under its text.
- The "Night" button in Pause notifications no longer runs out of its box, and the account menu stands out in dark mode.

## [1.4.0] - 2026-10-29

### Added

- Jump to any month in the feed or the image gallery: click a day's (or month's) heading for a small year-and-month picker that shows how many pushes each month has. Older months load in while it's open.

### Changed

- Days in earlier years show the year ("Saturday, Sep 21, 2024").

## [1.3.1] - 2026-10-29

### Added

- After a few pushes, Pushpilot asks once for a rating in the store it was installed from. It doesn't ask again, and skips people who already saw the support prompt.
- Phone numbers in the SMS tab read like they do on the phone: "+33 6 12 34 56 78", or "06 12 34 56 78" for numbers from your own country. Names and short codes stay as they are.

### Changed

- The store description now says what Pushpilot is up front: an unofficial Pushbullet extension for Chrome, Brave and Edge.
- Sign-in through Pushbullet is chosen per store, ready for an Edge Add-ons listing; a build without its own sign-in client asks for an access token instead.

### Fixed

- A push held back because Pushbullet is rate-limiting the account no longer says "No connection".
- The device warning in the popup is no longer announced by screen readers every time the popup opens.

## [1.3.0] - 2026-10-27

### Added

- Files split into Images, Videos, PDFs, Documents, Audio and Other, and images open as a gallery with a full-screen viewer (arrow keys, open original, download). File rows show their type and extension.
- A notice when Pushbullet rate-limits your account, with the time Pushpilot catches up.
- Sign-in codes in texts get a copy button: in the SMS list (while fresh), in the conversation, and on the desktop notification. "Copy one-time codes automatically" now covers texts too.
- Pushes that can't go out because you're offline, Pushbullet is down or the account is rate-limited wait in the feed under "Waiting to send" and go out on their own when the connection is back, with Retry and Cancel. They used to be lost.
- Select many pushes in the feed to mark them done or delete them at once.
- Settings › Devices warns when a phone has stopped taking pushes, has been silent for two months, or two devices share a name; the popup shows the warning once.
- A setup checklist for new installs: connect a phone, pin Pushpilot, notification mirroring, texts and the push-clipboard shortcut. It ticks itself off as you go.
- Settings › Support › Copy diagnostics puts versions, settings and counts on the clipboard for a bug report, without names, devices or push contents.

### Changed

- The feed's filters are a single bar with icons (All, Links, Notes, Files); "My devices" is gone.
- Pushpilot asks Pushbullet less often: SMS conversations and device lists are reused for a few seconds to minutes and refreshed the moment something changes, which spares the request allowance your account shares with the phone app.
- The Phone tab names the phone only when notifications come from more than one, and the SMS tab shows the phone's name instead of a menu when there's only one.

### Fixed

- The feed shows your whole history: about 100 pushes at sign-in, then older ones as you scroll, like the phone app. It used to show only the last few days.
- The outlines of cards and chips are no longer cut off along the top, most visible in dark mode.
- Sending texts from the SMS tab works again. Pushbullet retired the endpoint Pushpilot used, so texts failed with "Insufficient authorization"; Pushpilot now uses the current one.

## [1.2.0] - 2026-10-27

### Added

- Pushpilot speaks 17 languages: English, Arabic, German, Spanish, French, Indonesian, Italian, Japanese, Korean, Dutch, Polish, Portuguese (Brazil), Russian, Turkish, Vietnamese and Chinese (Simplified and Traditional). It follows the browser's language, and Arabic gets a mirrored right-to-left layout.
- Rename any of your devices from Settings › Devices.
- A Clear button empties a note you started writing.

### Fixed

- Text you write or receive in a right-to-left language (Arabic, Hebrew…) now reads right to left in the composer, feed, chats, phone notifications and texts, whatever language Pushpilot is in.
- The Clipboard button no longer fails with "Pushbullet Pro is required". It now pastes what you copied into the composer, ready to send: an image as a file, an address as a link, anything else as a note. Universal copy and paste (Pushbullet Pro) keeps its keyboard shortcut, and explains that it needs Pro instead of failing.

## [1.1.1] - 2026-10-26

### Added

- After an update, the popup shows what's new in that version once, with a link to the full list of changes.

## [1.1.0] - 2026-10-26

### Added

- Push from any app: copy something and press ⌘⇧9 (Ctrl+Shift+9) to push it to your default device, or ⌘⇧8 to open Pushpilot in a window. Both work while the browser is in the background.
- The Pushpilot shortcut for Apple Shortcuts, from the website: push links, text, photos and files from the Share sheet on iPhone, iPad and Mac, to any device or friend, without the browser.
- Settings › Receiving › Pushes sent to another browser, for phones that still send to the old Pushbullet extension's "Chrome".
- Toolbar badge option to keep counting phone notifications until they're dismissed.
- Pushbullet.com in the account menu, and a link to rate Pushpilot in Settings.

### Changed

- Images, PDFs and other files open in a new tab as they arrive, like links (on by default).
- Light theme by default.
- The popup uses the full 600px height, and an empty note stays one line until you start writing.
- Universal copy and paste keeps its keyboard command but no longer suggests a key (Chrome allows four).

### Fixed

- A note that's just an address now opens like a link.
- The first push on an account with no pushes yet is notified and opened.
- If this browser's Pushbullet device is removed, Pushpilot registers a new one, and the device list refreshes when it reconnects.

## [1.0.0] - 2026-10-25

First public release.

### Added

- Send the current page as a rich card (picture, title, site, kind), with video timestamps for YouTube, Vimeo and Twitch and "send the image itself" on image tabs.
- Notes, links and files with paste and drag-and-drop; send to one, several or all devices, friends, or this browser.
- Right-click menu and keyboard shortcuts for pushing pages, links, images, selections and the clipboard.
- Realtime receiving with desktop notifications, four built-in sounds or your own, and auto-open for links.
- Receive filters (to all devices, to other devices, from this browser, channels) and per-browser device registration.
- Feed with search, filters, chat view, link previews and video thumbnails.
- Android notification mirroring with code copy, quick reply, actions and dismissal.
- SMS conversations and sending for Android phones.
- End-to-end encryption compatible with Pushbullet apps; universal copy and paste.
- Popup, side panel and pop-out window; light and dark themes; snooze; unread badge.
- One-click sign-in through pushbullet.com, or an access token.

[1.6.0]: https://github.com/yazmani/pushpilot/releases/tag/v1.6.0
[1.5.1]: https://github.com/yazmani/pushpilot/releases/tag/v1.5.1
[1.5.0]: https://github.com/yazmani/pushpilot/releases/tag/v1.5.0
[1.4.0]: https://github.com/yazmani/pushpilot/releases/tag/v1.4.0
[1.3.1]: https://github.com/yazmani/pushpilot/releases/tag/v1.3.1
[1.3.0]: https://github.com/yazmani/pushpilot/releases/tag/v1.3.0
[1.2.0]: https://github.com/yazmani/pushpilot/releases/tag/v1.2.0
[1.1.1]: https://github.com/yazmani/pushpilot/releases/tag/v1.1.1
[1.1.0]: https://github.com/yazmani/pushpilot/releases/tag/v1.1.0
[1.0.0]: https://github.com/yazmani/pushpilot/releases/tag/v1.0.0
