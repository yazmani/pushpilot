# What's tested

Pushpilot has three layers of checks. This page is an honest map of what each covers, so you know which features are proven and where real-device testing still helps.

## Unit tests (`npm test`)

Pure logic, no browser or network. Runs in CI on every push.

- Link handling: kind detection, YouTube IDs, video timestamps, previews from URLs, Open Graph parsing, title clean-up.
- One-time code extraction from notification text.
- URL helpers and device reachability.
- **End-to-end encryption**, checked against an independent implementation with Node's `crypto`: key derivation, decrypting what other Pushbullet clients encrypt, encrypting so they can decrypt, rejecting a wrong password.

## Live API check (`npm run test:api`)

Calls every Pushbullet endpoint Pushpilot uses with your token: account, devices, people, channels, pushes, SMS threads (for each SMS-capable phone), and with `--send` also creating, dismissing and deleting a push and requesting an upload slot.

## End-to-end suite (`npm run test:e2e`)

Loads the real built extension in Chrome for Testing (or Brave with `BROWSER_PATH`) and drives it with your account:

| Step | What it proves |
| --- | --- |
| Sign in with token | Account loads, a device is registered for this browser |
| Stream goes live | Realtime WebSocket connects |
| History synced | Pushes and people load |
| Send via RPC and via the popup UI | The full send path, including the popup button |
| Popup prefills the current page | "Send this page" picks up the tab you're on |
| Send a file | Upload to Pushbullet's storage, file push, and the uploaded content matches |
| Notification and sound | Desktop notification appears; the offscreen document for audio starts |
| Encryption password | Key is derived, stored, and cleared |
| Receive a push from another device | A notification appears and the link auto-opens |
| Receive an image, and an address sent as a note | Both open in a new tab |
| Render Feed, Phone, SMS | Each view renders with real data, light and dark |

Everything it creates is deleted afterwards, including the test device.

## Phone suite (`npm run test:phone`)

Runs the built extension against an Android phone or the emulator (see the recipe below) with Pushbullet's SMS sync and notification mirroring on. Set `PHONE` to the phone's device iden (and `ADB` if `adb` isn't on your path).

| Step | What it proves |
| --- | --- |
| SMS threads load | The phone's conversations come through |
| Incoming text | A text arriving on the phone raises a desktop notification |
| Send a text | A text sent from Pushpilot reaches the phone's sent box |
| Phone notification | A notification posted on the phone is mirrored, with its sign-in code detected |
| Dismiss | Dismissing it in Pushpilot clears it on the phone |

## Not yet covered by automated tests

These are implemented against Pushbullet's protocol (the same calls the official apps and web app make), but the maintainer's test account couldn't exercise them end to end. Reports from people with the right setup are very welcome.

| Feature | Why it isn't automated | How to help |
| --- | --- | --- |
| Sign in with Pushbullet (OAuth) | Needs an interactive Pushbullet login; the suite checks the redirect URL matches the store ID | Sign out, then sign in with the button, and report |
| Notification mirroring: actions, quick reply | Needs an app that offers them on a real phone (receive, code copy and dismiss are covered by `npm run test:phone`) | Try them on a phone and report |
| SMS with end-to-end encryption on | Needs a phone with encryption enabled | Same as above with encryption on |
| Universal copy and paste | Needs Pushbullet Pro | Copy on one device, check the other |
| Right-click menu and keyboard shortcuts | Browser automation can't trigger them (the suite does run what ⌘⇧9 runs) | Use them, including ⌘⇧9 / ⌘⇧8 from another app, and report |
| Pushpilot shortcut for Apple Shortcuts | Import needs a click in the Shortcuts app; `TEST_DEVICE=<iden> node --env-file=.env scripts/shortcut.mjs --test <dir>` builds a copy for `shortcuts run` that reports its progress as notes to that device | Add it, share a link, a photo and a PDF to it, and report |
| Side panel and pop-out window | Same | Open each from the account menu |
| Snooze, sticky notifications, "closing dismisses" | Timing and OS notification behaviour | Use for a day |
| Link previews for all sites | Needs the optional permission prompt | Turn it on in Settings › Feed |
| Firefox | Not supported yet (uses Chrome-only APIs: offscreen, side panel) | Port welcome |

## Manual checklists

For a release, or when you have the setup the automated suite can't cover. Tick what works and open an issue for anything that doesn't, with the browser, OS and Pushpilot version.

### Windows (Chrome and Brave)

Install from the Chrome Web Store, or load `pushpilot-*-chrome.zip` unpacked.

- [ ] Sign in with Pushbullet. The device shows as "Chrome on Windows" / "Brave on Windows" in Settings › Devices, marked "this browser".
- [ ] Open the popup on a web page: the page card shows its picture and title. Send it to your phone; it arrives.
- [ ] From the phone, push a link to "All devices": a Windows notification appears with the sound, and the link opens in a new tab.
- [ ] Push a photo and a PDF from the phone: both open in new tabs.
- [ ] Right-click a page, a link, an image and selected text: each "Push this …" submenu lists your devices and sends.
- [ ] Shortcuts show Ctrl, not ⌘, in the popup (Ctrl ↵) and in Settings › Shortcuts.
- [ ] Copy text in Notepad, then press Ctrl+Shift+9: it's pushed to the default device. Ctrl+Shift+8 opens Pushpilot in a window. (If not, set their scope to Global in `chrome://extensions/shortcuts`.)
- [ ] Clipboard button: copy a link, text, then a screenshot (Win+Shift+S); each lands in the composer.
- [ ] Side panel and pop-out window open from the account menu.
- [ ] Close the browser, push a link from the phone, reopen the browser with "Open links that arrived while offline" on: it opens.

### Android phone (notification mirroring; Wi-Fi is enough)

In the Pushbullet app: Notification mirroring on, and allow the apps you'll test.

- [ ] A notification from any app (Gmail, Telegram, a calendar reminder) appears in the Phone tab and as a desktop notification, with the app name and icon.
- [ ] A notification with a code ("Your code is 482913") shows a Copy button; with Settings › Phone › "Copy one-time codes automatically" on, it's copied by itself.
- [ ] Dismiss it in Pushpilot: it disappears on the phone. Swipe one away on the phone: it moves to "Earlier" in Pushpilot.
- [ ] Reply to a chat notification (Telegram, WhatsApp, Messages) from Pushpilot: the reply arrives in the chat.
- [ ] A notification with action buttons (e.g. "Mark as read"): the buttons work from Pushpilot.
- [ ] Turn on end-to-end encryption on the phone and in Settings › Encryption with the same password: notifications still arrive.

### Android phone (SMS; needs a SIM, or the emulator below)

In the Pushbullet app: SMS sync on.

- [ ] The SMS tab lists the phone and its recent conversations, with names and photos.
- [ ] Open a conversation: messages and photos show, newest at the bottom.
- [ ] Send a text from Pushpilot: it's delivered and appears in the thread.
- [ ] Receive a text: a desktop notification appears; its Reply opens the thread.
- [ ] New text to a number with no conversation yet (the pencil button).
- [ ] With end-to-end encryption on, the same still works.

### Android emulator (SMS without a SIM)

The emulator has a fake modem, so texts can be sent to it from the Mac:

```sh
sdkmanager "platform-tools" "emulator" "system-images;android-34;google_apis_playstore;arm64-v8a"
avdmanager create avd -n pushpilot -k "system-images;android-34;google_apis_playstore;arm64-v8a"
emulator -avd pushpilot &
# Sign in to Google Play in the emulator, install Pushbullet, sign in, turn on SMS sync and mirroring.
adb emu sms send 5551234 "Hello from the emulator"   # an incoming text
```

Texts sent from Pushpilot appear in the emulator's Messages app (they go nowhere else).
