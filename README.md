# Droply — design-preview storefront

This repository now contains a niche storefront for gadgets, small electronics, adult-friendly toys, and funny shirts.

## Preview mode

The current checkout is deliberately a **safe design preview**:

- No card details are requested or stored.
- No payment provider is connected.
- Shipping is displayed as a placeholder.
- Tax is displayed as an 8% estimate placeholder.
- Orders are saved as `pending` preview orders in SQLite.
- The admin order desk is available after signing in with the demo admin account.
- No supplier API or fulfillment order is sent.

Run it with:

```bash
npm install
cp .env.example .env
npm run dev
```

Visit <http://localhost:3000>.

Demo accounts:

- Customer: `demo@droply.test` / `password123`
- Admin: `admin@droply.test` / `password123`

## Later production integrations

When the design is approved, replace the preview checkout with Stripe Checkout or Payment Intents, calculate shipping/tax with a real provider, and connect the order service to your selected supplier. Use HTTPS, a strong `JWT_SECRET`, managed database storage, real email delivery, and remove the demo credentials before launch.
