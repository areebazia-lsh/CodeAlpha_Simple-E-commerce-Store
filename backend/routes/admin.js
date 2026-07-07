// Admin-only routes: manage products (create/update/delete), upload media
// files, and view + update all customer orders. Every route here requires
// the user to be logged in AND have role "admin" (see the two middlewares below).

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const requireAdmin = require('../middleware/admin');

router.use(authenticate, requireAdmin);

// ---------- File uploads (images & videos from the admin's own device) ----------

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        // Unique name so two uploads with the same original filename never collide
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB — enough for a short product video
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image or video files are allowed.'));
        }
    }
});

// POST /api/admin/upload - upload one file, returns its URL for use in a product's media list
router.post('/upload', (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ error: err.message || 'Upload failed.' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file was uploaded.' });
        }
        const type = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
        res.status(201).json({ url: `/uploads/${req.file.filename}`, type });
    });
});

// ---------- Product management ----------

// POST /api/admin/products - create a new product
// Body: { name, description, price, category, stock, media: [{ type: 'image'|'video', url }, ...] }
// "media" can hold as many entries as the admin wants to add. The first
// image in the list becomes the product's cover thumbnail automatically.
router.post('/products', async (req, res) => {
    try {
        const { name, description, price, category, stock, media } = req.body;

        if (!name || price === undefined) {
            return res.status(400).json({ error: 'Name and price are required.' });
        }

        const mediaList = Array.isArray(media) ? media.filter(m => m && m.url && m.url.trim()) : [];
        const coverImage = (mediaList.find(m => m.type !== 'video') || mediaList[0] || {}).url || '';

        const [result] = await pool.query(
            `INSERT INTO products (name, description, price, image_url, category, stock)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, description || '', price, coverImage, category || '', stock || 0]
        );
        const productId = result.insertId;

        for (let i = 0; i < mediaList.length; i++) {
            await pool.query(
                'INSERT INTO product_media (product_id, media_type, url, sort_order) VALUES (?, ?, ?, ?)',
                [productId, mediaList[i].type === 'video' ? 'video' : 'image', mediaList[i].url.trim(), i]
            );
        }

        res.status(201).json({ message: 'Product created.', id: productId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create product.' });
    }
});

// PUT /api/admin/products/:id - update an existing product
// Replaces the entire media list with whatever was submitted (simplest way to
// keep it in sync with an "add/remove rows" form on the frontend).
router.put('/products/:id', async (req, res) => {
    try {
        const { name, description, price, category, stock, media } = req.body;

        const mediaList = Array.isArray(media) ? media.filter(m => m && m.url && m.url.trim()) : [];
        const coverImage = (mediaList.find(m => m.type !== 'video') || mediaList[0] || {}).url || '';

        const [result] = await pool.query(
            `UPDATE products
             SET name = ?, description = ?, price = ?, image_url = ?, category = ?, stock = ?
             WHERE id = ?`,
            [name, description || '', price, coverImage, category || '', stock || 0, req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Product not found.' });
        }

        await pool.query('DELETE FROM product_media WHERE product_id = ?', [req.params.id]);
        for (let i = 0; i < mediaList.length; i++) {
            await pool.query(
                'INSERT INTO product_media (product_id, media_type, url, sort_order) VALUES (?, ?, ?, ?)',
                [req.params.id, mediaList[i].type === 'video' ? 'video' : 'image', mediaList[i].url.trim(), i]
            );
        }

        res.json({ message: 'Product updated.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update product.' });
    }
});

// DELETE /api/admin/products/:id
router.delete('/products/:id', async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Product not found.' });
        }
        res.json({ message: 'Product deleted.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete product.' });
    }
});

// ---------- Order management ----------

// GET /api/admin/orders - every order from every customer, newest first
router.get('/orders', async (req, res) => {
    try {
        const [orders] = await pool.query(
            `SELECT o.*, u.name AS customer_name, u.email AS customer_email
             FROM orders o
             JOIN users u ON o.user_id = u.id
             ORDER BY o.created_at DESC`
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

// PUT /api/admin/orders/:id/status - move an order to its next stage
// Body: { status: "pending" | "shipped" | "delivered" | "cancelled" }
router.put('/orders/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['pending', 'shipped', 'delivered', 'cancelled'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
        }

        const [result] = await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Order not found.' });
        }
        res.json({ message: 'Order status updated.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update order status.' });
    }
});

// ---------- Analytics ----------

// GET /api/admin/analytics
// Everything the dashboard's Analytics tab needs in one call: totals,
// a simple revenue-by-day series, best sellers, and which products are
// running low so the admin can reorder before they sell out.
router.get('/analytics', async (req, res) => {
    try {
        const [[totals]] = await pool.query(
            `SELECT
                COALESCE(SUM(total_amount), 0) AS total_revenue,
                COUNT(*) AS order_count
             FROM orders
             WHERE status != 'cancelled'`
        );

        const [[customerCount]] = await pool.query(
            `SELECT COUNT(*) AS customer_count FROM users WHERE role = 'customer'`
        );

        // Revenue for each of the last 7 days (including days with no orders, shown as 0)
        const [dailyRevenueRows] = await pool.query(
            `SELECT DATE(created_at) AS day, SUM(total_amount) AS revenue
             FROM orders
             WHERE status != 'cancelled' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
             GROUP BY DATE(created_at)
             ORDER BY day ASC`
        );
        const dailyRevenueMap = {};
        dailyRevenueRows.forEach(row => { dailyRevenueMap[row.day.toISOString().slice(0, 10)] = parseFloat(row.revenue); });
        const dailyRevenue = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            dailyRevenue.push({ date: key, revenue: dailyRevenueMap[key] || 0 });
        }

        // Best-selling products by total quantity sold
        const [topProducts] = await pool.query(
            `SELECT oi.product_name, SUM(oi.quantity) AS units_sold, SUM(oi.quantity * oi.price) AS revenue
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             WHERE o.status != 'cancelled'
             GROUP BY oi.product_name
             ORDER BY units_sold DESC
             LIMIT 5`
        );

        // Products running low on stock (10 or fewer left)
        const [lowStock] = await pool.query(
            `SELECT id, name, stock, image_url FROM products WHERE stock <= 10 ORDER BY stock ASC`
        );

        res.json({
            total_revenue: parseFloat(totals.total_revenue),
            order_count: totals.order_count,
            customer_count: customerCount.customer_count,
            daily_revenue: dailyRevenue,
            top_products: topProducts,
            low_stock: lowStock
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch analytics.' });
    }
});

module.exports = router;