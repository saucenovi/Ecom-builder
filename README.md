# Droply — full-stack dropshipping store

Droply is a runnable ecommerce starter with a storefront, persistent cart, accounts, inventory-aware orders, and admin APIs. It is intentionally dependency-light: Express serves the frontend and SQLite stores the catalog, users, inventory, and orders.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open <http://localhost:3000>.

Demo accounts:

- Customer: `demo@droply.test` / `password123`
- Admin: `admin@droply.test` / `password123`

## Included

- Seeded catalog of 12 products across Home, Apparel, Accessories, and Kitchen
- Search and category filtering through the products API
- JWT authentication and bcrypt password hashing
- Persistent SQLite database with stock checks and transactional order creation
- Customer order history API
- Admin order list/status APIs and product management APIs
- Responsive storefront, local cart, login/register, and checkout flow
- Health endpoint at `/api/health`

## Production checklist

Set a strong `JWT_SECRET`, use a managed database, configure HTTPS, replace demo credentials, and connect a real payment processor and supplier/fulfillment API before taking live orders. The current checkout creates a pending order; it does not charge a card or automatically submit an order to a supplier.
