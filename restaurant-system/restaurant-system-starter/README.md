# Dar Restaurant — starter prototype

This is a responsive front-end prototype with a customer menu, search/categories, cart, delivery details, local demo orders, FAQ, dark mode, and role-based dashboard previews (Founder, Manager, Kitchen, Cashier, Delivery).

## Run it
- In this folder, run `npm install` once, then `npm start`.
- The Express server serves the static prototype on port 3000. Open the Ports panel in GitHub Codespaces and open port 3000 in the browser.
- The customer website is at `/` (or `/index.html`); the management preview is at `/admin.html`.
- If port forwarding is not visible, use the Command Palette and search for `Ports: Focus on Ports View`.

## Important limitations
This is only Stage 1, a front-end prototype. Orders are saved in the current browser's localStorage and are not shared across devices. The role switcher is a demo preview, NOT secure authentication. Do not deploy this as a live restaurant system or enter real customer data.

## Next production stage
Add a real backend/database and server-side authentication/authorization (e.g. Supabase with row-level security), connect customer accounts to orders, implement secure staff invitations and permissions, store menu and order data in the database, and add an actual map provider for address pins. Add real payment integration only after choosing a supported provider and testing it.

The starter is intentionally separate so it does not overwrite any existing project files.
