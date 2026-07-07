# Arexon — Full-Stack E-Commerce App

Stack: **HTML/CSS/JS** frontend (cherry/purple/blue animated UI), **Express.js** backend, **MySQL** database.

## What's in this version
- Landing page with a guest "Explore Products" link (no login needed to browse)
- Separate Customer and Administrator portals (login/signup/dashboard)
- Real checkout flow: shipping details form + payment method choice (Cash on
  Delivery or Card — see note below), not a one-click "place order" button
- Customers can cancel their own orders while still "pending"
- Order history and the admin dashboard both show orders as animated cards
  with product thumbnails, not plain tables
- Admin accounts are blocked from adding to cart / checking out (they manage
  the store, they don't shop from the same account)
- Contact info (email, phone, address) in the footer of every page and on the landing page
- Login/register/admin pages are now clean split-screen auth screens (no
  shop nav, no Cart link, no Login/Sign Up links showing on the login page
  itself) — matching how real platforms separate "browsing" from "signing in"
- Password show/hide (eye icon) on every password field
- **Wishlist** — save products for later from the product page, view/manage them on `wishlist.html`
- **Star ratings & reviews** — customers rate and review products; average rating shows on product cards and the product page
- **Low-stock alerts** — a banner on the admin Products tab flags anything with 10 or fewer left in stock
- **Sales analytics** — a new Analytics tab on the admin dashboard: total revenue, order count, customer count, a 7-day revenue chart, and best-selling products
- **Multiple images & videos per product** — the admin can add as many media
  items as they want per product (not just one URL); the product page shows
  a gallery with a thumbnail strip, and videos play inline
- **Lighter theme** — switched from a fully dark UI to a light background with the cherry/purple/blue gradient kept for the header, buttons, and accents (the landing page and login/signup side panels stay vividly dark on purpose, as a visual contrast)
- Cherry/purple/blue gradient theme with visible animations (gradient hero,
  floating shapes, card entrance/hover motion)

### A note on payment
There's no real payment processor wired in — that needs a merchant account
and API keys (e.g. Stripe) that are outside the scope of a student project,
and genuinely shouldn't be faked with fake keys either. The checkout page
still gives you the full **flow**: shipping form, a Cash on Delivery vs Card
choice, and (if Card is picked) card number/expiry/CVV fields for realism —
but nothing about the card is sent to the server or stored. Only which
method was chosen (`cod` or `card`) is saved with the order.

## Fixing errors you've hit so far
- **"Table doesn't exist"** → `schema.sql` was never run. See Setup below.
- **"Access denied ... using password: NO"** → `.env` is missing or MySQL isn't
  picking up `DB_PASSWORD`. Make sure `backend/.env` exists (not just
  `.env.example`) and isn't saved as `.env.txt`.
- **"secretOrPrivateKey must have a value"** → `JWT_SECRET` in `.env` is empty
  or the file has hidden formatting issues from Notepad. Recreate `.env`
  cleanly (see below) if this happens again.
- **"Data too long for column 'image_url'"** → fixed in this version:
  `image_url` is now `VARCHAR(1000)`. If you built your database with an
  older version of `schema.sql`, run `migrate.sql` (see below) instead of
  starting over.

## Ready-to-use test accounts
`schema.sql` seeds two accounts so you can log in immediately without registering:

| Role     | Email                | Password      |
|----------|------------------------|-----------------|
| Admin    | admin@arexon.com       | Admin@123       |
| Customer | customer@arexon.com    | Customer@123    |

## Folder structure
```
ecommerce-app/
├── README.md
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── schema.sql      run this for a brand-new database
│   ├── migrate.sql      run this instead if you already have data
│   ├── server.js
│   ├── config/db.js
│   ├── middleware/
│   │   ├── auth.js       verifies the login token
│   │   └── admin.js      verifies the logged-in user is an admin
│   └── routes/
│       ├── auth.js       register + login (customer & admin)
│       ├── products.js   public product browsing
│       ├── cart.js       cart (customer only)
│       ├── orders.js     checkout, order history, cancel (customer only)
│       ├── wishlist.js   save/view/remove wishlist items (customer only)
│       ├── reviews.js    view + post product reviews
│       └── admin.js      product CRUD, all-orders view, analytics (admin only)
└── frontend/
    ├── index.html            landing page (site name + portal choice + contact)
    ├── shop.html              product listing
    ├── product.html           product detail + add to cart
    ├── cart.html              shopping cart
    ├── checkout.html          shipping + payment method + place order
    ├── login.html / register.html                customer auth
    ├── admin-login.html / admin-register.html    admin auth
    ├── admin-dashboard.html                       admin panel (card-based)
    ├── orders.html                                 order history (card-based)
    ├── wishlist.html                                saved products
    ├── css/style.css
    └── js/
        ├── api.js            shared helpers (fetch wrapper, login state, nav, password toggle)
        ├── products.js       shop page
        ├── product-detail.js product page
        ├── cart.js           cart page
        ├── checkout.js       checkout page
        ├── auth.js           all 4 login/signup forms
        ├── orders.js         order history page
        └── admin.js          admin dashboard
```

## Setup

### 1. Create the database

**Brand new setup:**
```bash
mysql -u root -p < backend/schema.sql
```
This creates `ecommerce_db`, all 5 tables, 8 sample products, and the two test accounts above.

**Already have a database from an earlier version?** Don't re-run `schema.sql`
(it would try to recreate everything). Instead run the migration, which only
adds/widens what's missing and keeps your existing data:
```bash
mysql -u root -p ecommerce_db < backend/migrate.sql
```
If you see `Duplicate column name` errors for one or two lines, that's fine —
it just means that particular change was already applied; the rest still runs.

To double check it worked:
```bash
mysql -u root -p -e "USE ecommerce_db; DESCRIBE orders;"
```
You should see `payment_method`, `full_name`, `phone`, and `city` in the list.

### 2. Configure and run the backend
```bash
cd backend
npm install
cp .env.example .env
```
Open `.env` and set:
- `DB_PASSWORD` — your real MySQL password
- `JWT_SECRET` — any long random string
- `ADMIN_SIGNUP_CODE` — the code someone must type to create a new admin account

```bash
npm start
```

Open `http://localhost:5000` — that's the landing page.

## API Reference

| Method | Endpoint                     | Auth  | Description                            |
|--------|--------------------------------|-------|-------------------------------------------|
| POST   | /api/auth/register              | No    | Create account (`role` optional, defaults to customer) |
| POST   | /api/auth/login                  | No    | Log in, returns a JWT token             |
| GET    | /api/products                     | No    | List products (`?category=&search=`)   |
| GET    | /api/products/categories          | No    | Distinct category list                  |
| GET    | /api/products/:id                 | No    | Single product                          |
| GET    | /api/cart                          | Yes   | Get current user's cart                 |
| POST   | /api/cart                          | Yes   | Add item `{ product_id, quantity }`    |
| PUT    | /api/cart/:itemId                  | Yes   | Update quantity `{ quantity }`         |
| DELETE | /api/cart/:itemId                  | Yes   | Remove item                             |
| POST   | /api/orders                         | Yes   | Checkout `{ full_name, phone, shipping_address, city, payment_method }` |
| GET    | /api/orders                         | Yes   | Order history (with product images)    |
| GET    | /api/orders/:id                     | Yes   | Single order detail                     |
| PUT    | /api/orders/:id/cancel               | Yes   | Cancel a pending order, restores stock |
| GET    | /api/wishlist                        | Yes   | List saved products                     |
| POST   | /api/wishlist                         | Yes   | Save a product `{ product_id }`        |
| DELETE | /api/wishlist/:productId              | Yes   | Remove a saved product                  |
| GET    | /api/reviews/:productId               | No    | List reviews for a product              |
| POST   | /api/reviews/:productId               | Yes   | Post/update your review `{ rating, comment }` |
| POST   | /api/admin/products                  | Admin | Create product `{ name, price, category, stock, description, media: [{type, url}] }` |
| PUT    | /api/admin/products/:id              | Admin | Update product                          |
| DELETE | /api/admin/products/:id              | Admin | Delete product                          |
| GET    | /api/admin/orders                    | Admin | View every customer's orders            |
| PUT    | /api/admin/orders/:id/status         | Admin | Update order status                     |
| GET    | /api/admin/analytics                  | Admin | Revenue, orders, top products, low stock |

## Notes for your viva
- **Passwords**: hashed with `bcryptjs` — never stored as plain text.
- **Checkout transaction** (`routes/orders.js`): stock check → create order →
  create order_items → reduce stock → clear cart, all inside one MySQL
  transaction, rolled back automatically on any failure.
- **Order cancellation**: reverses the transaction's effect — restores stock
  for every item, only allowed while status is still `pending`.
- **No duplicate cart rows**: `cart_items` has `UNIQUE (user_id, product_id)`,
  so re-adding a product just bumps its quantity.
- **Order snapshots**: `order_items` stores its own `product_name` and `price`,
  so old orders stay accurate even if a product changes later; the current
  product image is joined in separately for display.
- **Role-gated admin signup**: prevents random users from granting themselves
  admin access.
- **Admin/customer separation is enforced on both ends**: the frontend hides
  cart/checkout UI for admin accounts, and the backend's `requireAdmin`
  middleware independently blocks non-admins from every `/api/admin/*` route
  — so it's not just a UI restriction that could be bypassed.#   C o d e A l p h a _ S i m p l e - E - c o m m e r c e - S t o r e  
 