// Routes for checkout and viewing order history.
// Checkout uses a database TRANSACTION: several queries run together, and if
// any of them fail, everything is rolled back so the database never ends up
// half-updated (e.g. stock reduced but no order actually created).

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticate = require('../middleware/auth');

router.use(authenticate);

// POST /api/orders
// Body: { full_name, phone, shipping_address, city, payment_method, item_ids? }
// Turns the user's cart (or just the selected subset of it, via item_ids)
// into a real order. When item_ids is provided, only those cart rows are
// ordered and removed — anything else stays sitting in the cart, so a user
// with 5 things in their cart can check out with just 1 of them, the same
// way Amazon lets you select individual items at checkout.
// No real payment is processed here — "card" just records the customer's
// chosen method, since wiring up a real payment gateway needs a merchant
// account/API keys that are outside the scope of a student project.
router.post('/', async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const { full_name, phone, shipping_address, city, payment_method, item_ids } = req.body;

        if (!full_name || !phone || !shipping_address || !city) {
            await connection.rollback();
            return res.status(400).json({ error: 'Full name, phone, address and city are all required.' });
        }

        const finalPaymentMethod = payment_method === 'card' ? 'card' : 'cod';

        // Normalize item_ids to a clean array of positive integers, if given.
        let selectedIds = null;
        if (Array.isArray(item_ids) && item_ids.length > 0) {
            selectedIds = item_ids.map(id => parseInt(id)).filter(id => Number.isInteger(id) && id > 0);
            if (selectedIds.length === 0) {
                await connection.rollback();
                return res.status(400).json({ error: 'No valid items selected.' });
            }
        }

        await connection.beginTransaction();

        // 1. Get the cart rows we're actually ordering: either the whole cart,
        // or — when the customer picked specific items on the cart page —
        // just those rows (still scoped to ci.user_id so no one can order
        // someone else's cart row by guessing an id).
        const cartQuery = selectedIds
            ? `SELECT ci.id AS cart_item_id, ci.quantity, p.id AS product_id, p.name, p.price, p.stock
               FROM cart_items ci
               JOIN products p ON ci.product_id = p.id
               WHERE ci.user_id = ? AND ci.id IN (?)`
            : `SELECT ci.id AS cart_item_id, ci.quantity, p.id AS product_id, p.name, p.price, p.stock
               FROM cart_items ci
               JOIN products p ON ci.product_id = p.id
               WHERE ci.user_id = ?`;
        const cartParams = selectedIds ? [req.user.id, selectedIds] : [req.user.id];
        const [cartItems] = await connection.query(cartQuery, cartParams);

        if (cartItems.length === 0) {
            await connection.rollback();
            return res.status(400).json({ error: selectedIds ? 'Selected items were not found in your cart.' : 'Your cart is empty.' });
        }

        // 2. Make sure every item still has enough stock before we commit to anything
        for (const item of cartItems) {
            if (item.stock < item.quantity) {
                await connection.rollback();
                return res.status(400).json({ error: `Not enough stock for "${item.name}".` });
            }
        }

        // 3. Create the order
        const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

        const [orderResult] = await connection.query(
            `INSERT INTO orders (user_id, total_amount, status, payment_method, full_name, phone, shipping_address, city)
             VALUES (?, ?, 'pending', ?, ?, ?, ?, ?)`,
            [req.user.id, total, finalPaymentMethod, full_name, phone, shipping_address, city]
        );
        const orderId = orderResult.insertId;

        // 4. Save each cart item as an order item, and reduce product stock
        for (const item of cartItems) {
            await connection.query(
                `INSERT INTO order_items (order_id, product_id, product_name, quantity, price)
                 VALUES (?, ?, ?, ?, ?)`,
                [orderId, item.product_id, item.name, item.quantity, item.price]
            );
            await connection.query(
                'UPDATE products SET stock = stock - ? WHERE id = ?',
                [item.quantity, item.product_id]
            );
        }

        // 5. Remove just the cart rows that became this order. If specific
        // items were selected, everything else stays in the cart for later;
        // otherwise (no selection sent) this clears the whole cart as before.
        const orderedCartItemIds = cartItems.map(item => item.cart_item_id);
        await connection.query('DELETE FROM cart_items WHERE user_id = ? AND id IN (?)', [req.user.id, orderedCartItemIds]);

        await connection.commit();

        res.status(201).json({
            message: 'Order placed successfully.',
            order_id: orderId,
            total: total.toFixed(2)
        });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: 'Failed to place order.' });
    } finally {
        connection.release();
    }
});

// GET /api/orders
// Returns all past orders for the logged-in user, each with its line items
// (including each product's current image, so the order history can show pictures).
router.get('/', async (req, res) => {
    try {
        const [orders] = await pool.query(
            'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );

        for (const order of orders) {
            const [items] = await pool.query(
                `SELECT oi.*, p.image_url
                 FROM order_items oi
                 LEFT JOIN products p ON oi.product_id = p.id
                 WHERE oi.order_id = ?`,
                [order.id]
            );
            order.items = items;
        }

        res.json(orders);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch orders.' });
    }
});

// GET /api/orders/:id
// Returns a single order (only if it belongs to the logged-in user)
router.get('/:id', async (req, res) => {
    try {
        const [orders] = await pool.query(
            'SELECT * FROM orders WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found.' });
        }

        const [items] = await pool.query(
            `SELECT oi.*, p.image_url
             FROM order_items oi
             LEFT JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = ?`,
            [req.params.id]
        );
        orders[0].items = items;

        res.json(orders[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch order.' });
    }
});

// PUT /api/orders/:id/cancel
// Lets a customer cancel their own order, but only while it's still "pending".
// Restores stock for every item in the order.
router.put('/:id/cancel', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [orders] = await connection.query(
            'SELECT * FROM orders WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        if (orders.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Order not found.' });
        }
        if (orders[0].status !== 'pending') {
            await connection.rollback();
            return res.status(400).json({ error: 'Only pending orders can be cancelled.' });
        }

        const [items] = await connection.query('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
        for (const item of items) {
            await connection.query('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
        }

        await connection.query('UPDATE orders SET status = ? WHERE id = ?', ['cancelled', req.params.id]);
        await connection.commit();

        res.json({ message: 'Order cancelled.' });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: 'Failed to cancel order.' });
    } finally {
        connection.release();
    }
});

module.exports = router;