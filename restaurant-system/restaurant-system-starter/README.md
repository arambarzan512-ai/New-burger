# New Burger

A responsive restaurant ordering site and staff tools backed by one Express server. The customer website, owner dashboard, cashier page, kitchen page, and driver page share menu, customer, address, order, and delivery data in `.data/store.json`. Fresh installs start with an empty menu rather than sample products or prices; add the restaurant's verified catalog in the owner dashboard before accepting orders.

## Run in GitHub Codespaces

1. In a terminal, enter the app folder:

   ```sh
   cd restaurant-system/restaurant-system-starter
   ```

2. Configure private owner credentials and a stable random session secret:

   ```sh
   cp -n .env.example .env
   export ADMIN_EMAIL='owner@example.com'
   export ADMIN_PASSWORD='replace-with-a-long-unique-password'
   export SESSION_SECRET='replace-with-a-long-random-secret'
   ```

   `.env.example` contains placeholders only; replace them before using the app. In Codespaces, keep real values in Codespaces secrets rather than source control. Admin sign-in is disabled unless both owner credentials are set. A random session secret is generated when omitted, but sessions will not survive a restart with a different secret.
   For local development, you can instead put these values in a private `.env` file in this folder; it is ignored by Git and loaded by `npm start`.

3. Install and start the app:

   ```sh
   npm install
   npm start
   ```

4. Open port `3000` from the Codespaces Ports panel. The customer home page is `/`, the standalone menu page is `/menu`, and staff pages are `/admin.html`, `/cashier.html`, `/kitchen.html`, and `/driver.html`.

5. Run the automated backend integration scenario:

   ```sh
   npm test
   ```

## Customer ordering and delivery

- Customers register or sign in from the customer account entry point. Passwords are stored as salted scrypt hashes; signed session cookies are HttpOnly and SameSite=Strict.
- An authenticated customer can update their profile, save up to 25 private Home/Work/Other addresses, set a default, edit/delete locations, and view their own order history. Saved orders include live progress updates and a one-tap reorder action; unavailable menu items are skipped. Backend ownership checks prevent access to another customer's account or addresses.
- Address entry requires a pin, street/city/building information, and supports apartment/floor and delivery notes. Customers can search using OpenStreetMap, manually move a map pin, or tap “Use my location” to request GPS once. GPS is not requested automatically.
- The customer checkout supports Delivery (signed in with a saved address) and Pickup/Takeaway only; dine-in is not available through the customer checkout. Pickup can be placed as a guest order without an address. At checkout, customers review a server-generated quote and explicitly place the order. The server revalidates current product and extras prices/availability, delivery area, minimum order, delivery fee, and payment method. A unique idempotency key prevents accidental duplicate submissions. Delivery orders store an address snapshot so editing a saved address does not change old orders.
- My Orders shows account-owned orders and locally tracked guest orders with clear received/preparing/fulfillment steps; an open tracking view refreshes every 15 seconds. A separate private tracking token is also issued at checkout for secure lookup from another device; the token is shown once and must be kept private. The confirmation screen links to WhatsApp support when the public contact phone is configured in international format in the owner website settings.
- Customer checkout accepts cash only, for both delivery and pickup. Payments remain Pending until a cashier manually confirms cash received. No online payment provider is integrated, so the site does not claim card payments succeed.
- The cashier's New Walk-In Order form creates pickup or dine-in orders in the same store and sends them to the kitchen queue. It accepts optional customer details and requires an available table for dine-in.

## Staff roles and workflow

- **Owner/Admin** signs in at `/admin.html` with both `ADMIN_EMAIL` and `ADMIN_PASSWORD`. The owner manages menu items, restaurant details, offers/reviews, delivery settings, staff, order assignments, and the delivery map. Incoming orders refresh every 15 seconds and can be accepted/rejected, filtered by delivery/takeaway and cash payment type, or moved through valid statuses. The dashboard reports today's order count and collected revenue alongside its detailed reports.
- From **Staff accounts** in the owner dashboard, create cashier, kitchen, and driver accounts. Staff passwords must be at least 12 characters. Give staff the role-appropriate page and credentials.
- **Cashier** signs in at `/cashier.html`. Cashiers can create walk-in pickup/dine-in orders, view incoming orders, confirm orders and cash payments, manage collection/table service status, and print receipts. They cannot access owner management endpoints.
- **Kitchen** signs in at `/kitchen.html`. Kitchen staff see the shared preparation queue and can move confirmed orders to Preparing and Ready. They cannot access owner or cashier management endpoints.
- **Driver** signs in at `/driver.html`. Drivers see only orders assigned to their account, the destination snapshot, necessary contact/delivery notes, and a map-navigation link. They can mark a delivery Picked Up, Out for delivery, Delivered, or report a delivery problem.
- Assign a delivery to an active driver from the owner dashboard's order card. Assignment is required before a delivery can be completed. Customer tracking reads the same saved order status.
- Order status actions are type-specific and must follow the workflow: Delivery ends Delivered, Pickup ends Collected, and Dine-In ends Completed after Served. Invalid or out-of-order status changes are rejected by the server.
- The admin delivery settings form configures the delivery fee, minimum subtotal, pickup and dine-in availability, and an optional circular delivery service area (center coordinates plus radius). No delivery-area restriction is applied until configured. Dine-in tables can be created and reserved in the owner dashboard; table occupancy is derived from active dine-in orders.
- Website appearance is managed in the owner dashboard. The customer website uses a Premium Dark theme and the owner can change its supported palette, hero photo, logo, section visibility, and localized hero/About copy in English, Kurdish Sorani, and Arabic. Draft changes remain private until published; the customer site polls published menu/design data and updates without a code deployment.
- Logo, background, hero, About Us, menu-product, and offer images can be selected directly from a phone gallery or file browser. JPG/JPEG, PNG, and WebP uploads are validated by content signature and capped at 5 MB, stored with generated names, and served from `/uploads/`. Upload, replacement, and deletion API operations require an owner session. Image URL fields remain available as an advanced alternative.
- Owners can create and edit percentage or fixed-amount coupons with active dates, minimum subtotals, total and per-customer use limits, and eligible order types. The server recalculates the discount for both checkout quotes and order creation; cancelled orders release coupon capacity. Promotions remain informational offers and never silently alter checkout prices.
- The owner dashboard includes a bounded audit history for important order, payment, product, table, staff, review, promotion, coupon, and settings actions. Report filters apply to server-calculated sales summaries by date, order type, order status, payment status, product, and staff member.

## Maps, privacy, and external services

- Maps use Leaflet from unpkg and OpenStreetMap tiles; address search uses the public Nominatim service. No mapping API key is required. Internet access is required, and OpenStreetMap/Nominatim usage limits and service policies apply. Attribute OpenStreetMap when using map data.
- Map tiles disclose the visible map region to OpenStreetMap. A search sends the entered query to Nominatim. Location permission is requested only after a customer taps the location button. If permission is denied or unavailable, address search and manual pin placement remain available.
- Driver navigation opens the saved order destination in Google Maps; it does not track a customer's live location or a driver's live location.
- Delivery coordinates and customer contact details are returned only through authenticated customer-own-order/account routes or staff routes authorized for the relevant role. Drivers receive only their assigned delivery data.

## Persistence and production setup

- The app creates `.data/store.json` and `.data/uploads/` on first use. Back up the JSON file and the entire upload directory together so saved image references remain valid. Both must be on persistent storage: default Codespaces/ephemeral container files can disappear when the environment is rebuilt. For production, mount a persistent disk at the app's `.data` directory (which keeps both by default). If `UPLOAD_DIR` points elsewhere, persist that media directory as well as `.data/store.json`; the app does not include a cloud object-storage integration. A separate object-storage service requires provider credentials and integration before it can be used.
- This JSON store and local file uploads are intended for one server instance on a persistent filesystem; they are not a substitute for a managed database, transactional locking, multi-instance file sharing, or production backup/restore. Keep backups of `.data/store.json` and the configured upload directory synchronized and test restoring both.
- For a manual smoke test, place guest Pickup and (after enabling dine-in and creating a table) Dine-In orders on `/`, create a cashier walk-in order, and confirm all appear in `/cashier.html` and `/kitchen.html`. Use the owner dashboard to assign a Ready delivery to a driver, then verify only that driver sees it in `/driver.html`. Run `npm test` for the API integration scenario.
- Use HTTPS in deployment, keep `SESSION_SECRET` stable and private, use strong unique passwords, and protect the Codespaces/workspace secrets. Owner active sessions are invalidated when the server restarts; staff/customer sessions rely on the signed cookie expiry and configured secret.
- Configure the real delivery fee, minimum, pickup policy, and service area with the restaurant before accepting live orders. Enter only genuine menu items, restaurant details, promotions, coupons, and reward terms. Rewards are disabled until an owner configures an earn rate and redemption instructions.
- Reviews require a completed order and its private tracking token. Promotions are displayed only when enabled and within their configured dates; coupons are separate server-validated checkout discounts.
- The starter hero image uses Unsplash and requires network access. Replace it and configure real menu photography and restaurant details before launch.
- The default website design is the light New Burger Bright palette. On startup, stores using the unchanged original Premium Dark default palette are updated to the new palette while retaining the restaurant name, logo, menu, customers, orders, and other configured data. Custom palettes are left unchanged.
- Website customization currently edits the supported appearance settings and hero/About copy; it does not yet provide a general page builder, arbitrary homepage section ordering, category imagery, all navigation/footer/legal text, opening-hours management, or translations for every existing menu/product string. Product/catalog price and availability updates use the existing owner API; historical order lines remain snapshots.
- Current limitations: no online payment provider or refunds; staff roles are Owner, Cashier, Kitchen, and Driver (no Manager or Packer/Server); no opening-hours/temporary-closure configuration or production email/SMS; no managed database or transactional concurrency control; no live driver tracking. Coupons are currently applied at checkout rather than stacked with informational promotions. JSON persistence is suitable only for a single application process on a persistent filesystem; it is not a relational database or safe multi-instance production store.
- No payment-provider keys or Google Maps key are required for the current features. OpenStreetMap mapping/search is subject to provider availability, usage policies, and internet access.
