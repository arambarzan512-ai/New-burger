# New Burger audit and repair record

## Architecture found

- Customer pages are static HTML, CSS, and browser JavaScript served by one Express application. The owner, cashier, kitchen, and driver interfaces are separate pages.
- The backend stores menu, account, staff, order, and settings records in `.data/store.json`; uploaded images are local files. There is no relational database, migration framework, or multi-instance storage layer.
- Delivery addresses use Leaflet, OpenStreetMap tiles, and Nominatim search. GPS is optional. Checkout currently accepts cash only; payment confirmation is a staff action.
- `npm test` runs Node's built-in test runner against an isolated temporary store. There is no browser end-to-end, lint, or build script in `package.json`.

## Confirmed findings and priority

| Priority | Finding | Evidence and disposition |
|---|---|---|
| P1 | A fresh store previously advertised a hard-coded sample menu and prices, including starter-template branding, as if they were real. | `server.js` seeded those products when `.data/store.json` did not exist. Fresh stores now start with no products; test fixtures supply menu data only to automated tests. Existing saved catalog records are deliberately not removed. |
| P1 | New Burger's saved default appearance was the starter's dark theme, and the static page metadata and staff headers still named Dar Restaurant. | The configured store identified New Burger while shipped defaults and several page titles did not. Defaults and page branding now match New Burger; only stores whose full palette matches the old untouched starter default are automatically switched to the bright palette. |
| P2 | Customer sign-in did not reject malformed or empty credentials with a validation response, and the form had no password visibility control. | The customer login route now validates email/password shape and returns clear 400 responses; the account form has an accessible show/hide control. Valid, invalid, unknown-account, session, and logout API paths have test coverage. |
| P1 | File-backed persistence is not safe for concurrent writers or multiple server instances. | `writeStore` replaces a JSON file atomically, but reads and updates are in-memory and have no transaction or cross-process lock. Use a transactional database before horizontal scaling or relying on concurrent production writes. No database migration was performed. |
| P1 | The persisted catalog contains pre-existing starter-like products and prices. Their real-world accuracy cannot be established from code. | Existing menu, order, account, and settings data were not edited or deleted. The owner must verify the catalog and prices before accepting live orders; do not treat the preserved catalog as independently verified business data. |
| P2 | A saved delivery address requires a map pin; a text-only address cannot currently be saved for delivery. | GPS is optional and users can place a pin manually, but a map/provider failure can still block saving an address. This was not changed because delivery-area enforcement depends on coordinates when a service area is configured. |
| P2 | Several requested business capabilities are not implemented in this application. | No online payment provider/refunds, opening-hours/temporary-closure controls, manager role, standalone customer-management page, production email/SMS, or live courier tracking was found. No fake versions were added. |
| P2 | Responsive behavior and customer interactions are not covered by a browser automation suite. | The repository has backend integration tests but no configured browser runner. Visual checks at the requested viewport sizes and real-browser geolocation/map tests were not executable here. |

## Existing behavior confirmed in source and tests

- Customer and staff passwords are salted scrypt hashes; authentication cookies are HttpOnly and SameSite=Strict. Admin, staff, customer login, and customer registration endpoints have bounded per-IP attempt throttles.
- Owner-only, staff-role, customer-account, assigned-driver, and private order-tracking access are enforced in API middleware/routes rather than by hiding links alone.
- Checkout revalidates item prices/options and delivery rules server-side, snapshots order details, and uses an idempotency key. No online payment success is claimed.
- Menu, order, coupon, analytics, status-transition, and persistence behavior has integration coverage. The project test runner passed after the changes recorded below.

## Changes made

- Replaced fresh-store sample products with an empty catalog and aligned new-store defaults with New Burger.
- Added a conservative migration for only the unchanged legacy default color palette and its bundled Erbil hero copy. It retains customized palettes and does not replace menu, order, customer, staff, or address data.
- Updated the customer and staff page branding, bright red/white/yellow palette, desktop customer navigation, and responsive admin section navigation.
- Added customer sign-in input validation, bounded account-creation throttling, a password visibility control, and regression tests for sign-in/session/logout, throttling, and safe theme migration.

## Verification and outstanding setup

- Run `cd restaurant-system/restaurant-system-starter && npm test`: all three integration tests pass.
- Run `node --check` on the server and browser scripts, and `git diff --check`: pass.
- A real owner login was not attempted; it requires private `ADMIN_EMAIL` and `ADMIN_PASSWORD` values. Configure those and a stable private `SESSION_SECRET` outside source control.
- The theme migration runs when the server reads the existing store on startup. This audit did not start the app against or modify the working `.data/store.json`.
- The map uses public OpenStreetMap/Nominatim services and needs internet access; no paid map API key is configured or required. Interactive map failure behavior and GPS permissions were not browser-tested.
- Before launch, verify every saved product/price, set actual delivery settings and service area, replace the stock Unsplash hero with approved restaurant photography, and back up `.data/store.json` together with uploaded images.
- Production deployment still requires persistent storage and HTTPS. The JSON store should be replaced by a transactional database before multi-process deployment; this project contains no DB credentials, configured external payment provider, or paid map API requirement.
