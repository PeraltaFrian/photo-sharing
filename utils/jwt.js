import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refreshSuperSecret';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const JWT_ALGORITHM = 'HS256'; 

/**
 * Generate a short-lived access token (JWT)
 */
export function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role || 'user',
    },
    JWT_SECRET,
    {
      expiresIn: ACCESS_TOKEN_EXPIRY,
      algorithm: JWT_ALGORITHM,
    }
  );
}

/**
 * Generate a long-lived refresh token
 * includes tokenVersion to help with invalidation
 */
export function generateRefreshToken(user) {
  return jwt.sign(
    {
      id: user._id,
      tokenVersion: user.tokenVersion || 0,
    },
    JWT_REFRESH_SECRET,
    {
      expiresIn: REFRESH_TOKEN_EXPIRY,
      algorithm: JWT_ALGORITHM,
    }
  );
}

/**
 * Safely verify and decode a refresh token
 */
export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET, {
      algorithms: [JWT_ALGORITHM],
    });
  } catch (err) {
    console.warn('Invalid refresh token:', err.message);
    return null;
  }
}
