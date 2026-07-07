// Routes for a customer's wishlist — products saved for later, separate
// from the cart. Every route here requires login.

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticate = require('../middleware/auth');

router.use(authenticate);

// GET /api/wishlist - all products the current user has saved
router.get('/', async (req, res) => {
    try {
        const [items] = await pool.query(
            `SELECT w.id AS wishlist_id, p.*
             FROM wishlist_items w
             JOIN products p ON w.product_id = p.id
             WHERE w.user_id = ?
             ORDER BY w.created_at DESC`,
            [req.user.id]
        );
        res.json(items);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch wishlist.' });
    }
});

// POST /api/wishlist - save a product. Body: { product_id }
router.post('/', async (req, res) => {
    try {
        const { product_id } = req.body;
        if (!product_id) {
            return res.status(400).json({ error: 'product_id is required.' });
        }

        // INSERT IGNORE so saving the same product twice doesn't error out —
        // the UNIQUE key on (user_id, product_id) just silently skips the duplicate.
        await pool.query(
            'INSERT IGNORE INTO wishlist_items (user_id, product_id) VALUES (?, ?)',
            [req.user.id, product_id]
        );
        res.status(201).json({ message: 'Added to wishlist.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add to wishlist.' });
    }
});

// DELETE /api/wishlist/:productId - remove a product from the wishlist
router.delete('/:productId', async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?',
            [req.user.id, req.params.productId]
        );
        res.json({ message: 'Removed from wishlist.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to remove from wishlist.' });
    }
});

module.exports = router;