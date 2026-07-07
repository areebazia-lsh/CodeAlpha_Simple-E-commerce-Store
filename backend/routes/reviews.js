// Routes for star ratings + written reviews on products.
// Reading reviews is public; posting one requires login.

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticate = require('../middleware/auth');

// GET /api/reviews/:productId - all reviews for one product, newest first
router.get('/:productId', async (req, res) => {
    try {
        const [reviews] = await pool.query(
            `SELECT r.id, r.rating, r.comment, r.created_at, u.name AS reviewer_name
             FROM reviews r
             JOIN users u ON r.user_id = u.id
             WHERE r.product_id = ?
             ORDER BY r.created_at DESC`,
            [req.params.productId]
        );
        res.json(reviews);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch reviews.' });
    }
});

// POST /api/reviews/:productId - leave a review. Body: { rating, comment }
// One review per customer per product — posting again updates the existing one.
router.post('/:productId', authenticate, async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const ratingNum = parseInt(rating);

        if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
        }

        await pool.query(
            `INSERT INTO reviews (user_id, product_id, rating, comment)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE rating = ?, comment = ?, created_at = CURRENT_TIMESTAMP`,
            [req.user.id, req.params.productId, ratingNum, comment || '', ratingNum, comment || '']
        );

        res.status(201).json({ message: 'Review saved.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save review.' });
    }
});

module.exports = router;