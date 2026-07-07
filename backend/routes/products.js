// Routes for browsing products. All of these are public (no login required).

const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/products
// Optional query params: ?category=Electronics&search=phone
router.get('/', async (req, res) => {
    try {
        const { category, search } = req.query;

        let query = `
            SELECT p.*,
                   ROUND(AVG(r.rating), 1) AS avg_rating,
                   COUNT(r.id) AS review_count
            FROM products p
            LEFT JOIN reviews r ON r.product_id = p.id
            WHERE 1=1
        `;
        const params = [];

        if (category) {
            query += ' AND p.category = ?';
            params.push(category);
        }
        if (search) {
            query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        query += ' GROUP BY p.id ORDER BY p.created_at DESC';

        const [products] = await pool.query(query, params);
        res.json(products);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch products.' });
    }
});

// GET /api/products/categories
// Returns the list of distinct categories, used to build the filter dropdown
router.get('/categories', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT DISTINCT category FROM products ORDER BY category');
        res.json(rows.map(row => row.category));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch categories.' });
    }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
    try {
        const [products] = await pool.query(
            `SELECT p.*,
                    ROUND(AVG(r.rating), 1) AS avg_rating,
                    COUNT(r.id) AS review_count
             FROM products p
             LEFT JOIN reviews r ON r.product_id = p.id
             WHERE p.id = ?
             GROUP BY p.id`,
            [req.params.id]
        );
        if (products.length === 0) {
            return res.status(404).json({ error: 'Product not found.' });
        }

        const [media] = await pool.query(
            'SELECT id, media_type, url FROM product_media WHERE product_id = ? ORDER BY sort_order ASC, id ASC',
            [req.params.id]
        );

        const product = products[0];
        product.media = media; // [] if the product was created before this feature, or has none added
        res.json(product);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch product.' });
    }
});

module.exports = router;