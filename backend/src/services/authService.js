// Smart-Fleet IoT — Auth Service
// TanQHoang © 2026

const { SignJWT, jwtVerify } = require('jose');
const { supabase, supabaseAdmin } = require('../utils/supabaseClient');
const userModel = require('../models/userModel');
const logger = require('../utils/logger');

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const REFRESH_SECRET = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET);
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

const authService = {
  async register(email, password, name) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      const err = new Error(error.message);
      err.status = error.status === 422 ? 409 : 400;
      err.code = error.message.includes('already') ? 'DUPLICATE_EMAIL' : 'REGISTRATION_FAILED';
      throw err;
    }

    const user = await userModel.create({
      supabaseUid: data.user.id,
      email,
      name,
    });

    return user;
  },

  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const err = new Error('Invalid email or password.');
      err.status = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    const user = await userModel.findBySupabaseUid(data.user.id);
    if (!user) {
      const err = new Error('User profile not found.');
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const tokens = await authService.signTokens(user.id, user.email);
    return { user: { id: user.id, email: user.email, name: user.name }, tokens };
  },

  async signTokens(userId, email) {
    const accessToken = await new SignJWT({ email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(ACCESS_EXPIRES)
      .sign(ACCESS_SECRET);

    const refreshToken = await new SignJWT({ email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(REFRESH_EXPIRES)
      .sign(REFRESH_SECRET);

    return { accessToken, refreshToken };
  },

  async verifyRefreshToken(token) {
    try {
      const { payload } = await jwtVerify(token, REFRESH_SECRET);
      return { userId: payload.sub, email: payload.email };
    } catch {
      const err = new Error('Refresh token is invalid or expired.');
      err.status = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }
  },

  setCookies(res, { accessToken, refreshToken }) {
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
    };

    res.cookie('access_token', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
  },

  clearCookies(res) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
  },
};

module.exports = authService;
