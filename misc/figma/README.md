# Figma Handoff Assets

This folder contains the files used for screenshot generation and validation.

## Included
- `capture-screens.mjs`: Playwright automation for 10 app states at 1440x900.
- `verify-screenshots.mjs`: Checks that all expected image files exist.
- `screenshots/`: Generated PNG files for design import.

## Client Product Sketch
- Imported sketch PDF: `../docs/client-input/product_sketch.pdf`

## Usage
1. Start the app from `draftkit/`:
   `npm run dev -- --host 127.0.0.1 --port 5173`
2. Capture screens from `draftkit/`:
   `node ../figma/capture-screens.mjs`
3. Validate from `figma/`:
   `node verify-screenshots.mjs`
