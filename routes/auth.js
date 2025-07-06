// routes/auth.js
import express from 'express';
import argon2 from 'argon2';
import crypto from 'crypto';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import User from '../models/user.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET not set');

// Nodemailer setup
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ----------------------
// Register
// ----------------------
router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required.' });

  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already in use.' });

    const hashed = await argon2.hash(password);
    const user = new User({ email, password: hashed, role: 'user' });
    await user.save();

    res.status(201).json({ message: 'User registered successfully.' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// ----------------------
// Login (with session regen + tokens)
// ----------------------
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required.' });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

    const valid = await argon2.verify(user.password, password);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });

    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regen failed:', err);
        return res.status(500).json({ error: 'Session error' });
      }

      req.session.userId = user._id;

      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,

      });

      res.cookie('token', accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        path: '/',
        maxAge: 15 * 60 * 1000,
  
      });

      res.json({ message: 'Login successful.', token: accessToken });
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// ----------------------
// Refresh Access Token
// ----------------------
router.post('/refresh-token', async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ error: 'Missing refresh token.' });

  const payload = verifyRefreshToken(token);
  if (!payload) return res.status(403).json({ error: 'Invalid refresh token.' });

  try {
    const user = await User.findById(payload.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const accessToken = generateAccessToken(user);
    
    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 min
  
    });
    res.json({ message: 'Access token refreshed.', token: accessToken });
  } catch (err) {
    console.error('Token refresh error:', err);
    res.status(500).json({ error: 'Server error during token refresh.' });
  }
});

// ----------------------
// Logout
// ----------------------

const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'Strict',
  path: '/',
};

router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken', cookieOptions);
  res.clearCookie('token', cookieOptions);

  req.session.destroy(() => {
    res.json({ message: 'Logged out successfully' });
  });
});

// ----------------------
// Google OAuth2
// ----------------------
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/login.html',
    session: true,
  }),
  (req, res) => {
    if (!req.user) {
      return res.status(401).send('Authentication failed');
    }

    const accessToken = generateAccessToken(req.user);
    const refreshToken = generateRefreshToken(req.user);

    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      path: '/',
    };

    // Set refresh token cookie (e.g., 7 days)
    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      
    });

    // Set access token cookie (e.g., 15 minutes)
    res.cookie('token', accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutes
      
    });

    return res.redirect(req.user.role === 'admin' ? '/admin.html' : '/gallery.html');
  }
);

// ----------------------
// CSRF Token Endpoint
// ----------------------
router.get('/csrf-token', (req, res) => {
  const csrfToken = req.csrfToken();
  res.cookie('_csrf', csrfToken, {
    httpOnly: false, // Allow frontend JS access
    secure: true,
    sameSite: 'Lax',
  });
  res.json({ csrfToken });
});

// ----------------------
// Authenticated user info
// ----------------------
router.get('/me', (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'No token found in cookies' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ user: decoded, token });
  } catch (err) {
    console.error('Token verification failed:', err.message);
    res.status(403).json({ error: 'Invalid or expired token' });
  }
});

// ----------------------
// Password Reset Request
// ----------------------
router.post('/password-reset/request', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(200).json({ message: 'Reset email sent if account exists.' });

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/password-reset.html?token=${token}`;

    await transporter.sendMail({
      from: process.env.SMTP_FROM_EMAIL,
      to: user.email,
      subject: 'Password Reset',
      html: `<p>Click below to reset your password:</p><a href="${resetUrl}">${resetUrl}</a>`,
    });

    res.json({ message: 'Reset email sent if account exists.' });
  } catch (err) {
    console.error('Password reset request error:', err);
    res.status(500).json({ error: 'Error sending reset email.' });
  }
});

// ----------------------
// Password Reset Execution
// ----------------------
router.post('/password-reset/reset', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword)
    return res.status(400).json({ error: 'Token and password required.' });

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired token.' });

    user.password = await argon2.hash(newPassword);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful.' });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ error: 'Server error during reset.' });
  }
});

export default router;
