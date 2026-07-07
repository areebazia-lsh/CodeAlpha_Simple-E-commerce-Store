-- ============================================================
-- Database schema for the Arexon e-commerce app.
-- Run this once to create the database and tables:
--   mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS ecommerce_db;
USE ecommerce_db;

-- Registered users. "role" separates normal shoppers from admins.
CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,   -- password is hashed, never stored as plain text
    role          VARCHAR(20) NOT NULL DEFAULT 'customer', -- 'customer' or 'admin'
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products available in the store
CREATE TABLE IF NOT EXISTS products (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    description TEXT,
    price       DECIMAL(10,2) NOT NULL,
    image_url   VARCHAR(1000),
    category    VARCHAR(100),
    stock       INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Items sitting in a user's cart (one row per product per user)
CREATE TABLE IF NOT EXISTS cart_items (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    product_id INT NOT NULL,
    quantity   INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_product (user_id, product_id)
);

-- A placed order (created when a user checks out)
CREATE TABLE IF NOT EXISTS orders (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    user_id          INT NOT NULL,
    total_amount     DECIMAL(10,2) NOT NULL,
    status           VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending / shipped / delivered / cancelled
    payment_method   VARCHAR(30) NOT NULL DEFAULT 'cod',      -- 'cod' or 'card'
    full_name        VARCHAR(150),
    phone            VARCHAR(30),
    shipping_address VARCHAR(500),
    city             VARCHAR(100),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Individual products inside an order (price/name snapshot at order time)
CREATE TABLE IF NOT EXISTS order_items (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    order_id     INT NOT NULL,
    product_id   INT NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    quantity     INT NOT NULL,
    price        DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Multiple images/videos per product. The admin can add as many as they want;
-- products.image_url still holds the "cover" image shown on cards for a quick thumbnail.
CREATE TABLE IF NOT EXISTS product_media (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    media_type ENUM('image', 'video') NOT NULL DEFAULT 'image',
    url        VARCHAR(1000) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Items a customer has saved for later (not in the cart, just bookmarked)
CREATE TABLE IF NOT EXISTS wishlist_items (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    product_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_wishlist_product (user_id, product_id)
);

-- Star ratings + written reviews left by customers on products
CREATE TABLE IF NOT EXISTS reviews (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    product_id INT NOT NULL,
    rating     TINYINT NOT NULL,   -- 1 to 5
    comment    TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_product_review (user_id, product_id),
    CHECK (rating BETWEEN 1 AND 5)
);

-- ---------- Seed data ----------

-- Ready-to-use test accounts (passwords below, already hashed with bcrypt):
--   Admin account:    admin@arexon.com    / Admin@123
--   Customer account: customer@arexon.com / Customer@123
INSERT INTO users (name, email, password_hash, role) VALUES
('Store Admin', 'admin@arexon.com', '$2b$10$756Myd7/nO3QujxXQZBd2.DAJcFyz5R3oHnKz7R3e2anx9m6XSUoC', 'admin'),
('Test Customer', 'customer@arexon.com', '$2b$10$ZvCXfOaj2F8nzv1Ul08.c.JuThp2EIyQcw5xfX/DM5X30QLzqx4pa', 'customer');

-- Sample products so the store isn't empty on first run
INSERT INTO products (name, description, price, image_url, category, stock) VALUES
('Wireless Headphones', 'Over-ear Bluetooth headphones with noise cancellation and 30-hour battery life.', 4999.00, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500', 'Electronics', 25),
('Smart Watch', 'Fitness tracking smart watch with heart rate monitor and AMOLED display.', 7999.00, 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500', 'Electronics', 15),
('Running Shoes', 'Lightweight breathable running shoes for daily training.', 3499.00, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500', 'Footwear', 40),
('Backpack', 'Water-resistant laptop backpack with 20L capacity.', 2199.00, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500', 'Accessories', 30),
('Coffee Maker', 'Automatic drip coffee maker, 12-cup capacity.', 5499.00, 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500', 'Home', 12),
('Desk Lamp', 'LED desk lamp with adjustable brightness and USB charging port.', 1899.00, 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500', 'Home', 20),
('Sunglasses', 'UV-protection polarized sunglasses, unisex design.', 1499.00, 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500', 'Accessories', 35),
('Yoga Mat', 'Non-slip eco-friendly yoga mat, 6mm thick.', 1299.00, 'https://images.unsplash.com/photo-1592432678016-e910b452f9a2?w=500', 'Fitness', 50);

-- A few sample reviews so ratings aren't empty on first run
INSERT INTO reviews (user_id, product_id, rating, comment) VALUES
(2, 1, 5, 'Sound quality is excellent and the battery really does last all day.'),
(2, 3, 4, 'Comfortable for daily runs, true to size.'),
(2, 5, 4, 'Makes great coffee, a bit loud when grinding.');