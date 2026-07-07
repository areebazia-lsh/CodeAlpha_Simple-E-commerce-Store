-- ============================================================
-- Run this ONLY if you already created your database with an
-- older version of schema.sql and don't want to lose your data.
-- Brand-new setups should just use schema.sql instead.
--
--   mysql -u root -p ecommerce_db < migrate.sql
--
-- If a column already exists, MySQL will show an error for that one
-- line ("Duplicate column name") — that's fine, it just means that
-- particular change was already applied. Ignore it and move on.
-- ============================================================

USE ecommerce_db;

ALTER TABLE products MODIFY image_url VARCHAR(1000);

ALTER TABLE orders ADD COLUMN payment_method VARCHAR(30) NOT NULL DEFAULT 'cod' AFTER status;
ALTER TABLE orders ADD COLUMN full_name VARCHAR(150) AFTER payment_method;
ALTER TABLE orders ADD COLUMN phone VARCHAR(30) AFTER full_name;
ALTER TABLE orders ADD COLUMN city VARCHAR(100) AFTER shipping_address;

CREATE TABLE IF NOT EXISTS product_media (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    media_type ENUM('image', 'video') NOT NULL DEFAULT 'image',
    url        VARCHAR(1000) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wishlist_items (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    product_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_wishlist_product (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS reviews (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    product_id INT NOT NULL,
    rating     TINYINT NOT NULL,
    comment    TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_product_review (user_id, product_id),
    CHECK (rating BETWEEN 1 AND 5)
);