# Privacy policy

_Last updated: October 25, 2026_

Pushpilot for Pushbullet ("Pushpilot") is an open-source browser extension that works with your Pushbullet account. It is not affiliated with Pushbullet. This policy explains what Pushpilot does with your data.

## The short version

- Pushpilot has **no servers of its own**. Nothing you do in Pushpilot is sent to its developers.
- No analytics, no tracking, no ads, no data sales.
- Pushpilot sends data only to **Pushbullet** (to deliver your pushes) and, if you turn on link previews, to **the websites your links point to** (to read their title and image).

## What Pushpilot stores, and where

Everything is stored locally in your browser's extension storage (`chrome.storage`) on your computer:

- Your Pushbullet access token and basic account details (name, email, profile picture link).
- Your devices, friends and channel subscriptions, as returned by Pushbullet.
- A local history of recent pushes, mirrored notifications, SMS thread previews and link previews.
- Your settings, including an optional end-to-end encryption key derived from your password. Your password itself is never stored.

Signing out removes your account data from the extension. Uninstalling Pushpilot removes all of it.

## What Pushpilot sends, and to whom

| Data | Sent to | Why |
| --- | --- | --- |
| Pushes you create (links, notes, files, the current page's title and address when you send it) | Pushbullet | To deliver them to your devices and friends |
| Notification dismissals, replies and texts you send | Pushbullet | To act on your phone |
| Your access token | Pushbullet | To authenticate API requests |
| Requests for a link's page header | The website the link points to | Only if you turn on **Show previews for links** |
| Video and repository identifiers | YouTube (thumbnails, oEmbed titles) and GitHub (link cards) | To show previews of those links |

Pushbullet's handling of your data is covered by [Pushbullet's privacy policy](https://www.pushbullet.com/privacy).

## Page access

When you open Pushpilot from the toolbar or with its keyboard shortcut, Chrome lets it read the page you're on. Pushpilot uses that only to fill in the link, title, preview image, selected text and video position for the push you're composing. Nothing is read in the background, and nothing is sent anywhere unless you press **Send**.

## Sign-in

"Sign in with Pushbullet" reads the session cookie that pushbullet.com sets after you sign in there, and only while a sign-in you started is in progress. Pushpilot does not read cookies from any other site.

## Children

Pushpilot is not directed at children under 13.

## Changes

Changes to this policy are published in this file in the [project repository](https://github.com/yazmani/pushpilot), with the date above updated.

## Contact

Open an issue at <https://github.com/yazmani/pushpilot/issues>.
