// config/passport.js
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/user.js';

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
  try {

    const email = profile.emails?.[0]?.value;
    if (!email) {
      console.warn('Google profile missing email');
      return done(null, false, { message: 'No email from Google' });
    }

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        email,
        password: 'google_oauth', // Placeholder – won't be used for login
        role: 'user',
        googleId: profile.id,
        name: profile.displayName,
        avatar: profile.photos?.[0]?.value || null,
      });
    }

    return done(null, user);
  } catch (err) {
    console.error('Error in GoogleStrategy:', err);
    return done(err);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});
