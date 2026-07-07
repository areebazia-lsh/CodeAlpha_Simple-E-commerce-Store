// Routes for managing the logged-in user's shopping cart.
// Every route here requires a valid login (see authenticate middleware below).

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticate = require('../middleware/auth');

// Apply the login check to every route in this file
router.use(authenticate);

// GET /api/cart
// Returns the current user's cart items (joined with product info) and the total price
router.get('/', async (req, res) => {
    try {
        const [items] = await pool.query(
            `SELECT ci.id, ci.quantity, p.id AS product_id, p.name, p.price, p.image_url, p.stock
             FROM cart_items ci
             JOIN products p ON ci.product_id = p.id
             WHERE ci.user_id = ?
             ORDER BY ci.created_at DESC`,
            [req.user.id]
        );

        const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        res.json({ items, total: total.toFixed(2) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch cart.' });
    }
});

// POST /api/cart
// Body: { product_id, quantity }
// Adds a product to the cart. If it's already there, increases the quantity instead
// of creating a duplicate row (handled by the UNIQUE key + ON DUPLICATE KEY UPDATE).
router.post('/', async (req, res) => {
    try {
        const { product_id, quantity } = req.body;
        const qty = parseInt(quantity) || 1;

        if (!product_id) {
            return res.status(400).json({ error: 'product_id is required.' });
        }

        const [products] = await pool.query('SELECT * FROM products WHERE id = ?', [product_id]);
        if (products.length === 0) {
            return res.status(404).json({ error: 'Product not found.' });
        }

        // Important: check stock against what the cart quantity would become
        // (already-in-cart + newly requested), not just the new amount on its own —
        // otherwise adding a product in multiple small batches could sail past
        // the actual stock level.
        const [existing] = await pool.query(
            'SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?',
            [req.user.id, product_id]
        );
        const currentQtyInCart = existing.length > 0 ? existing[0].quantity : 0;
        const newTotalQty = currentQtyInCart + qty;

        if (products[0].stock < newTotalQty) {
            const remaining = products[0].stock - currentQtyInCart;
            return res.status(400).json({
                error: remaining > 0
                    ? `Only ${remaining} more unit(s) available (you already have ${currentQtyInCart} in your cart).`
                    : `You already have the maximum available stock (${products[0].stock}) in your cart.`
            });
        }

        await pool.query(
            `INSERT INTO cart_items (user_id, product_id, quantity)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
            [req.user.id, product_id, qty, qty]
        );

        res.status(201).json({ message: 'Added to cart.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add to cart.' });
    }
});

// PUT /api/cart/:itemId
// Body: { quantity }
// Updates the quantity of one cart item — now validated against real stock,
// so typing a number larger than what's available gets rejected instead of silently saved.
router.put('/:itemId', async (req, res) => {
    try {
        const qty = parseInt(req.body.quantity);

        if (!qty || qty < 1) {
            return res.status(400).json({ error: 'Quantity must be at least 1.' });
        }

        const [items] = await pool.query(
            `SELECT ci.id, p.stock, p.name
             FROM cart_items ci
             JOIN products p ON ci.product_id = p.id
             WHERE ci.id = ? AND ci.user_id = ?`,
            [req.params.itemId, req.user.id]
        );

        if (items.length === 0) {
            return res.status(404).json({ error: 'Cart item not found.' });
        }

        if (qty > items[0].stock) {
            return res.status(400).json({ error: `Only ${items[0].stock} unit(s) of "${items[0].name}" in stock.` });
        }

        await pool.query(
            'UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?',
            [qty, req.params.itemId, req.user.id]
        );

        res.json({ message: 'Cart updated.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update cart.' });
    }
});

// DELETE /api/cart/:itemId
// Removes one item from the cart
router.delete('/:itemId', async (req, res) => {
    try {
        const [result] = await pool.query(
            'DELETE FROM cart_items WHERE id = ? AND user_id = ?',
            [req.params.itemId, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Cart item not found.' });
        }
        res.json({ message: 'Item removed from cart.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to remove item.' });
    }
});

module.exports = router;