// Entry point for the backend. Sets up Express, connects the routes,
// and serves the frontend files so the whole app runs from one server.

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const wishlistRoutes = require('./routes/wishlist');
const reviewRoutes = require('./routes/reviews');

const app = express();

app.use(cors());
app.use(express.json()); // lets us read JSON request bodies (req.body)

// Serve the frontend (html/css/js) as static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve uploaded product images/videos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/reviews', reviewRoutes);

// Simple health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Catch-all for unknown API routes
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Route not found.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});