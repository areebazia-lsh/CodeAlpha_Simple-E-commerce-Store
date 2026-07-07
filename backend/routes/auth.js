// Routes for creating an account and logging in.
// Two kinds of accounts exist: "customer" (default) and "admin".
// To stop anyone from registering themselves as an admin, admin signups
// must also provide the correct ADMIN_SIGNUP_CODE (set in .env).

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

// Helper: creates a signed JWT for a given user (role is embedded in the token)
function createToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
}

// POST /api/auth/register
// Body: { name, email, password, role, adminCode }
// "role" and "adminCode" are optional — omitting them creates a normal customer account.
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role, adminCode } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email and password are required.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }

        // Only allow role "admin" if the correct signup code was provided
        let finalRole = 'customer';
        if (role === 'admin') {
            if (!adminCode || adminCode !== process.env.ADMIN_SIGNUP_CODE) {
                return res.status(403).json({ error: 'Invalid admin signup code.' });
            }
            finalRole = 'admin';
        }

        const [existingUsers] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ error: 'An account with this email already exists.' });
        }

        // Never store plain-text passwords — always hash them first
        const passwordHash = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [name, email, passwordHash, finalRole]
        );

        const newUser = { id: result.insertId, name, email, role: finalRole };
        const token = createToken(newUser);

        res.status(201).json({ message: 'Registered successfully.', token, user: newUser });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during registration.' });
    }
});

// POST /api/auth/login
// Body: { email, password, role }
// "role" is optional, but if the frontend sends it (admin login page always does),
// we check that the account actually has that role — this stops a customer
// account from logging in through the admin page and vice versa.
router.post('/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const user = users[0];

        const passwordMatches = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatches) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        if (role && user.role !== role) {
            const message = role === 'admin'
                ? 'This account is not an administrator account.'
                : 'Please use the admin login page for this account.';
            return res.status(403).json({ error: message });
        }

        const token = createToken(user);

        res.json({
            message: 'Logged in successfully.',
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

module.exports = router;