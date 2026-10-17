# FabricNow Admin Dashboard — Update Notes

## Changes
- Added a route-level admin gate to every dashboard HTML page. A missing token redirects to `signin.html`; a token must also pass both `/auth/me` and `/admin/overview` before page content is revealed.
- Login verifies admin access before redirecting into the dashboard.
- Removed the public sign-up page, navigation links, and frontend signup API method.
- Updated shared sidebar, navbar, cards, forms, tables, and responsive styling.
- Removed the dashboard's generic placeholder sentence and retained live-stat API loading.
- Kept the existing backend API base URL and endpoint contracts unchanged.

## Configuration
`FABRICNOW_API_BASE` is set to `https://stream-sell.de.r.appspot.com/api` in `.env`. Update it only if your backend base URL changes.

## Important security note
The browser-side guard improves the user experience but is not a replacement for backend authorization. Every `/admin/*` endpoint and any data-changing endpoint must enforce admin permissions server-side. Never rely on hidden links or frontend redirects as the security boundary.

## Build
Run `npm ci`, then `npm run build`. The build could not be verified in this environment because Vite returned a local executable permission error.
