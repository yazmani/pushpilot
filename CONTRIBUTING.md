# Contributing

Thanks for helping make Pushpilot better. Bug reports, testing on real devices, and pull requests are all welcome.

## Before you start

- For anything bigger than a small fix, open an issue first so we can agree on the approach.
- Pushpilot is an unofficial client. Please don't add features that impersonate Pushbullet or work around its terms.

## Setup

```bash
git clone https://github.com/yazmani/pushpilot.git
cd pushpilot
npm install
npm run dev
```

`npm run dev` opens a Chrome window with the extension loaded and hot reload. Node 20 or newer is required.

## Before you open a pull request

```bash
npm run compile   # type-check
npm test          # unit tests
npm run format    # Prettier
npm run build
```

If you have a Pushbullet account, also run the live checks (see the README): `npm run test:api` and `npm run test:e2e`. Say in the PR which ones you ran.

## Code style

- Match the surrounding code: naming, comment density, file layout.
- Keep the worker as the only place that talks to the network (except file uploads); the UI reads from storage and calls the worker through `src/core/messaging/rpc.ts`.
- New settings go in `src/core/storage/store.ts` with a default, and must be wired to real behaviour. No placeholder options.
- UI copy is plain, sentence case, and describes what happens ("Send to Pixel", not "Submit").

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/): `feat(send): …`, `fix(stream): …`, `docs: …`, `test: …`, `chore: …`.

## Screenshots

Never commit screenshots of a real account. Use `npm run screenshots`, which renders the UI with the fictional account in `scripts/demo/data.js`.

## License

By contributing you agree that your contributions are licensed under the [AGPL-3.0](LICENSE).
