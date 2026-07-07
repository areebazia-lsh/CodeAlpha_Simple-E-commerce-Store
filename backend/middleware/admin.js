// This middleware protects admin-only routes.
// It must run AFTER the authenticate middleware (so req.user already exists),
// and it simply checks that the logged-in user's role is "admin".

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access only.' });
    }
    next();
}

module.exports = requireAdmin;