# Credential console basics

Step-by-step tutorial that builds a minimal **Credential Console** with [ArcGIS REST JS](https://developers.arcgis.com/arcgis-rest-js/): sign in with OAuth 2.0, manage projects as **groups**, and create, update, rotate and share **API keys**.

Find the full reference app at: [hhkaos/arcgis-credential-console](https://github.com/hhkaos/arcgis-credential-console).

## Run it locally

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS) and npm.
- An ArcGIS account (ArcGIS Online or ArcGIS Enterprise) with privileges to create content and groups.
- An **OAuth 2.0 client ID** ([create OAuth credentials](https://developers.arcgis.com/documentation/security-and-authentication/user-authentication/tutorials/create-oauth-credentials-user-authentication/)).

### Steps

```sh
npm install
npm run dev      # live preview with hot reload
```

1. Open the URL printed by `npm run dev`.
2. Paste your client ID in the `clientId` field of the tutorial.
3. Add the app's redirect URI (`…/callback.html`) to your OAuth credentials. The exact value is logged in the browser console as `redirectUri`.
4. Sign in from the Preview. Every button sends real requests to your account: check the results in *My content* and *Groups*.

Other scripts:

```sh
npm run build    # static site in dist/
npm run serve    # serve the built site locally
```

### Project layout

- `tutorial/tutorial.mdx` — the explanations, one `<Step>` per step.
- `tutorial/code/` — the app the tutorial walks through (`index.html`, `main.js`, `config.js`, `callback.html`, `style.css`).

## Questions and feedback

Found a bug or have a question? [Open an issue](https://github.com/EsriDevEvents/working-with-arcgis-rest-js-dtseu-2026/issues) in this repository.

For general ArcGIS REST JS questions, use the [Esri Community](https://community.esri.com/t5/arcgis-rest-js/ct-p/arcgis-rest-js) or the [ArcGIS REST JS repository](https://github.com/Esri/arcgis-rest-js/issues).

## How it was built

- [ArcGIS REST JS](https://github.com/Esri/arcgis-rest-js) 4.11 and [Calcite Design System](https://developers.arcgis.com/calcite-design-system/) 5.1, loaded from a CDN via an import map. Plain HTML, no bundler.
- [InteractiveCodeScroll](https://github.com/hhkaos/interactive-code-scroll) — turns `tutorial.mdx` + `tutorial/code/` into a scroll-driven tutorial with a live Preview. See the [authoring reference](https://github.com/hhkaos/interactive-code-scroll/blob/main/docs/authoring.md).
