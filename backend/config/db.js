// Creates one shared MySQL connection pool for the whole app.
// A "pool" means we don't open a new connection for every query —
// connections are reused, which is faster and more reliable.

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Win678@',
    database: process.env.DB_NAME || 'ecommerce_db',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;