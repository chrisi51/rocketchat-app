# Ritzbitz Link

This repository contains the **Ritzbitz Link** Rocket.Chat App which restores the automatic linking of the `ritzbitz://` URL scheme.

## Building

Install the dependencies and package the app into a `.zip` file:

```bash
npm install
(cd ritzbitz-link && npm install)
(cd ritzbitz-link && npx rc-apps package)
```

The resulting archive will appear in the `dist/` folder and can be uploaded to a Rocket.Chat server.

