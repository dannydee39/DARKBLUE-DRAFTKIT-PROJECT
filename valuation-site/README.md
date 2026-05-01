# valuation-site

Static product site for the Dark Blue MLB Valuation API.

## Start Here

- `index.html` loads the static shell.
- `js/router.js` switches between product pages.
- `js/pages/license.js` explains the licensed valuation product.
- `js/pages/endpoints.js` documents endpoint usage and includes the live try-it panel.
- `js/pages/account.js` renders the buyer account/key management preview.
- `css/` contains the site styling by concern.

## Local Preview

Any static file server works:

```powershell
python -m http.server 4000
```

Then open `http://localhost:4000`.
