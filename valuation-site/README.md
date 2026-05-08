# valuation-site

Static product site for the Dark Blue MLB Valuation API.

## Start Here

- `index.html` loads the static shell.
- `js/router.js` switches between product pages.
- `js/pages/license.js` explains the licensed valuation product.
- `js/pages/endpoints.js` documents endpoint usage and includes the live try-it panel.
- `js/pages/account.js` renders the buyer account/key management dashboard.
- `js/auth-modal.js` handles API-backed login, signup, forgot-password, and reset-password flows.
- `css/` contains the site styling by concern.

## Local Preview

Run the Valuation API on `localhost:3001`, then serve this folder from an
origin allowed by `valuation-api/.env.example`:

```powershell
python -m http.server 5173
```

Then open `http://localhost:5173`. Buyer auth calls use cookies, so the API
must allow the static site's origin and credentials.
