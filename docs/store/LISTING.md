# Chrome Web Store listing

Copy for the Chrome Web Store developer dashboard. Images are in this folder (regenerate with `npm run screenshots`).

## Store listing

**Name** (from the manifest, 75 max): `Pushpilot for Pushbullet`

**Summary** (from the manifest, 132 max):
Send tabs, notes and files to your phone, see Android notifications and text from your browser. Unofficial Pushbullet client.

**Category:** Productivity → Tools
**Language:** English

**Description:**

```
Pushpilot is a fast, modern client for Pushbullet, rebuilt from the ground up for Manifest V3. The original Pushbullet extension no longer installs on current Chrome, Brave and Edge. Pushpilot brings everything back, and makes sending the page you're on a one-click job.

SEND
• Open Pushpilot on any page and it's ready to send, with a preview of the page.
• Watching a video? "Start at 12:34" sends it at the exact minute, so you can keep watching on your phone.
• Notes, links, files and images, with paste and drag-and-drop.
• Send to one device, several, all of them, or a friend.
• Right-click any page, link, image or selected text to push it.
• Keyboard shortcuts for opening Pushpilot, pushing the current page and sending your clipboard.

RECEIVE
• Instant desktop notifications with a choice of sounds, or your own.
• Links open automatically in a new tab, like the original extension. Fully configurable.
• Choose which pushes count: to this browser, to all devices, or to your other devices.

YOUR PHONE ON YOUR DESKTOP (Android)
• See your phone's notifications. Copy sign-in codes in one click, or automatically.
• Reply to messages, trigger notification actions, and dismiss them on your phone.
• Read and send SMS from your browser.

ALSO
• Feed of everything you've pushed, with search and rich link previews.
• End-to-end encryption compatible with the Pushbullet apps.
• Universal copy and paste (Pushbullet Pro).
• Side panel, pop-out window, light and dark themes, snooze.

PRIVATE BY DESIGN
No servers, no analytics, no tracking. Pushpilot talks only to Pushbullet. Your history stays in your browser. Open source under AGPL-3.0: https://github.com/yazmani/pushpilot

Pushpilot is an independent project and is not affiliated with, endorsed by, or sponsored by Pushbullet. A Pushbullet account is required.
```

**Graphic assets:**
- Store icon 128×128: `src/public/icon/128.png`
- Screenshots 1280×800: `screenshot-1.png` … `screenshot-5.png`
- Small promo tile 440×280: `promo-small.png`
- Marquee promo tile 1400×560: `promo-marquee.png`

**Official URL / homepage:** `https://github.com/yazmani/pushpilot`
**Support URL:** `https://github.com/yazmani/pushpilot/issues`

## Privacy practices tab

**Single purpose:**
Pushpilot is a client for the Pushbullet service. It sends content from the browser (pages, links, notes, files) to the user's own devices and friends through their Pushbullet account, and shows what those devices send back (pushes, phone notifications, text messages).

**Permission justifications:**

| Permission | Justification |
| --- | --- |
| storage | Saves the user's settings and a local history of their pushes, notifications and texts. |
| unlimitedStorage | Lets the local history of pushes, notification icons and link previews grow past the default storage quota. |
| notifications | Shows desktop notifications for incoming pushes, mirrored phone notifications and text messages. |
| contextMenus | Adds "Push this page / link / image / selected text" to the right-click menu. |
| tabs | Reads the active tab's title and address so the user can send the page they're on, and lets the side panel follow the active tab. |
| activeTab | Grants access to the current page when the user opens Pushpilot, to read its title, preview image and selected text for the push. |
| scripting | Reads the current page's Open Graph metadata, selection and video position (only when the user opens Pushpilot), and the pushbullet.com session during sign-in. |
| alarms | Periodically checks the realtime connection to Pushbullet and reconnects if it dropped. |
| offscreen | Plays the notification sound and writes received text to the clipboard; service workers have no DOM. |
| cookies | One-click sign-in: reads the session cookie pushbullet.com sets after the user signs in there. Only pushbullet.com, only during a sign-in the user started. |
| sidePanel | Lets the user open Pushpilot in the browser's side panel. |
| favicon | Shows the site icon next to links in the composer and feed. |
| clipboardRead | Sends the clipboard to the user's devices when they click "Clipboard" or use the shortcut (universal copy and paste). |
| clipboardWrite | Copies one-time codes from phone notifications and text received from the user's other devices. |
| Host: api.pushbullet.com, www.pushbullet.com | The Pushbullet API and sign-in. |
| Host: *.pushbulletusercontent.com, *.pushbulletusercontent2.com, *.googleusercontent.com | Shows images and files people pushed (in notifications and the feed). |
| Host: i.ytimg.com, www.youtube.com/oembed*, opengraph.githubassets.com | Thumbnails and titles for YouTube links, and GitHub link cards. |
| Optional host: <all_urls> | Requested only if the user turns on link previews; reads the title and image of links in their feed. |

**Remote code:** No, Pushpilot does not use remote code. All code is in the package.

**Data usage** (tick these):
- Personally identifiable information: the account's name and email (shown in the extension).
- Authentication information: the Pushbullet access token.
- Personal communications: pushes, mirrored notifications and text messages.
- Website content: the current page's title, address and preview when the user sends it.

Certify that data is not sold, not used for anything other than the extension's single purpose, and not used for creditworthiness or lending.

**Privacy policy URL:** `https://github.com/yazmani/pushpilot/blob/main/PRIVACY.md`

## Reviewer notes

Reviewers need a Pushbullet account. They can sign in with the "Use an access token instead" link, using a token created at https://www.pushbullet.com/#settings/account.
