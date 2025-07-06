// middleware/auth.js
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set in environment variables');
}

/**
 * Middleware to authenticate a user via JWT or session.
 */
export function authenticateToken(req, res, next) {
  // Passport session (e.g. Google OAuth)
  if (req.isAuthenticated?.() && req.user) {
    return next();
  }

  let token;
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } 

  else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('JWT verification failed:', err.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware factory to restrict access based on role.
 * @param {string} role - Role required (e.g. 'admin')
 */
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: `Access denied: requires ${role} role` });
    }
    next();
  };
}

/**
 * Shortcut middleware for requiring 'admin' role.
 */
export const requireAdmin = requireRole('admin');
