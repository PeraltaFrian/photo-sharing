import 'dotenv/config';
import fs from 'fs';
import https from 'https';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import './config/passport.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import csurf from 'csurf';
import cookieParser from 'cookie-parser';
import { createClient } from 'contentful';
import contentfulManagement from 'contentful-management';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import photoRoutes from './routes/photos.js';
import User from './models/user.js';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

const app = express();

// Middlewares
app.use(cookieParser());
app.use(express.json());

// Login rate limiter
app.use('/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many login attempts.' }
}));

// Sessions (for passport + CSRF on cookie routes)
app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: 'Strict',
    maxAge: 60 * 60 * 1000, // 1 hour
  },
}));

// Helmet security headers
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com"],
      frameSrc: ["'self'", "https://accounts.google.com"],
      imgSrc: [
        "'self'",
        "https://images.ctfassets.net",
        "data:",
        "https://developers.google.com"
      ],
    },
  })
);

// Static files with caching
app.use(express.static('public', {
  setHeaders: (res, path) => {
    if (/\.(html|css|js)$/.test(path)) {
      res.setHeader('Cache-Control', 'public, max-age=600');
    }
  }
}));

// JWT helper
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
function generateAccessToken(user) {
  return jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '15m' });
}

// Passport Google OAuth strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ email: profile.emails[0].value });
    if (!user) {
      user = await new User({ email: profile.emails[0].value, password: 'google_oauth', role: 'user' }).save();
    }
    done(null, user);
  } catch (err) {
    done(err, null);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

app.use(passport.initialize());
app.use(passport.session());

// CSRF protection setup
const csrfProtection = csurf({ cookie: true });

const csrfSafePaths = [
  /^\/auth\//,
  /^\/photos\/.*$/,  
  /^\/api\//,
  /^\/upload$/,
];

// Conditionally apply CSRF except on safe paths
app.use((req, res, next) => {
  if (csrfSafePaths.some(rx => rx.test(req.path))) return next();
  csrfProtection(req, res, next);
});

// CSRF token endpoint for frontend to get token
app.get('/csrf-token', csrfProtection, (req, res) => {
  const token = req.csrfToken();
  res.cookie('csrfToken', token, {  
    httpOnly: false,
    sameSite: 'Lax',
    secure: true,
  });
  res.json({ csrfToken: token });
});


// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/photoapp')
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

// Contentful clients setup
const {
  CONTENTFUL_SPACE_ID, CONTENTFUL_ENVIRONMENT_ID,
  CONTENTFUL_DELIVERY_TOKEN, CONTENTFUL_MANAGEMENT_TOKEN,
  SSL_KEY_PATH, SSL_CERT_PATH, PORT = 3000
} = process.env;

const deliveryClient = createClient({ space: CONTENTFUL_SPACE_ID, accessToken: CONTENTFUL_DELIVERY_TOKEN });
const managementClient = contentfulManagement.createClient({ accessToken: CONTENTFUL_MANAGEMENT_TOKEN });

// Routes
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/photos', photoRoutes);

// Health check
app.get('/health', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ status: 'OK', ts: new Date().toISOString() });
});

// Error handler middleware
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') return res.status(403).json({ error: 'Invalid CSRF token' });
  console.error(err.stack);
  res.status(500).json({ error: 'Server error' });
});

// Start HTTPS server
https.createServer({
  key: fs.readFileSync(SSL_KEY_PATH),
  cert: fs.readFileSync(SSL_CERT_PATH)
}, app).listen(PORT, () => {
  console.log(`Running at https://localhost:${PORT}`);
});
