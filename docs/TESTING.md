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
