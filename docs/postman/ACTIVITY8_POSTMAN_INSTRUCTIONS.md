# Activity 8 Postman Requests

Use this Postman collection to send the five required valuation checkpoints to the Player API.

## Import

1. Open Postman.
2. Click **Import**.
3. Select this file:
   `docs/postman/darkblue-activity8-valuation.postman_collection.json`
4. Open the imported collection named **Dark Blue Activity 8 Valuation Checkpoints**.

## Variables

The collection already includes these variables:

| Variable | Value |
| --- | --- |
| `base_url` | `https://darkblueapi.anythingavenue.com` |
| `license_key` | `DB-2026-DEMO-0001` |

If you are testing another environment, change `base_url`. If the evaluator gives you a different license, change `license_key`.

## Requests Included

| Request | JSON Payload |
| --- | --- |
| Activity 8 - 1 Before Draft Starts | `valuation-site/data/activity8/before_draft.json` |
| Activity 8 - 2 After 10 Players Taken | `valuation-site/data/activity8/10_picks.json` |
| Activity 8 - 3 After 50 Players Taken | `valuation-site/data/activity8/50_picks.json` |
| Activity 8 - 4 After 100 Players Taken | `valuation-site/data/activity8/100_picks.json` |
| Activity 8 - 5 After 130 Players Taken | `valuation-site/data/activity8/130_picks.json` |

## Send

Click each request and press **Send**. A passing request returns HTTP `200` and a JSON response with a non-empty `valuations` object.

You can also right-click the collection and choose **Run collection** to send all five requests in order.
