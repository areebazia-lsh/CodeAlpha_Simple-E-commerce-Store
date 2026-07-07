// This middleware protects routes that require a logged-in user.
// It checks for a valid JWT token in the "Authorization" header,
// and if valid, attaches the user info to req.user for later use.

const jwt = require('jsonwebtoken');
require('dotenv').config();

function authenticate(req, res, next) {
    // Expected header format: "Authorization: Bearer <token>"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided. Please log in.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token. Please log in again.' });
        }
        req.user = decoded; // { id, email }
        next(); // token is valid, continue to the actual route
    });
}

module.exports = authenticate;