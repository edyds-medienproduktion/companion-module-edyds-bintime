# companion-module-edyds-bintime

Bitfocus Companion module for **B_inTime** (stage and output timer) by edyds medienproduktion.

B_inTime is a macOS application. This module controls it over the local network through its built-in HTTP interface (default port **8099**). You need B_inTime running on a Mac that Companion can reach.

User documentation (actions, feedbacks, variables, presets) is in [companion/HELP.md](companion/HELP.md).

## Development

```bash
npm install          # or: yarn
npx companion-module-check
npx companion-module-build   # creates the .tgz package
```

- Entry point: `main.js`, manifest: `companion/manifest.json`
- Runtime: Node 22, `@companion-module/base` 1.12

## License

MIT, see [LICENSE](LICENSE).
