# Droply — full-stack dropshipping store

A production-minded starter store with a customer storefront, cart, account/order flow, and a small admin API. It uses Express + SQLite on the backend and a dependency-free responsive frontend so it can run immediately.

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Open <http://localhost:3000>. The database is created and seeded on first start.

### Demo accounts

- Customer: `demo@droply.test` / `password123`
- Admin: `admin@droply.test` / `password123`

Set `JWT_SECRET` and `ADMIN_EMAIL` before deploying. Connect a real payment provider and supplier API in `server.js` before accepting production orders.
