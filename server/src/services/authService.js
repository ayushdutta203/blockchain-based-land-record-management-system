const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { AppError } = require('../errors');

const publicUser = (user) => ({ id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt });

async function login(store, email, password, secret) {
  if (!email || !password) throw new AppError('Email and password are required.', 400);
  const user = await store.findUserByEmail(email.trim());
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  const token = jwt.sign({ sub: user.id, role: user.role, name: user.name }, secret, { expiresIn: '8h' });
  return { token, user: publicUser(user) };
}

function authenticate(secret) {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      if (!header.startsWith('Bearer ')) throw new AppError('Sign in is required.', 401, 'UNAUTHENTICATED');
      req.auth = jwt.verify(header.slice(7), secret);
      next();
    } catch (error) { next(error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' ? new AppError('Your session is invalid or expired.', 401, 'UNAUTHENTICATED') : error); }
  };
}

function allow(...roles) {
  return (req, _res, next) => roles.includes(req.auth.role) ? next() : next(new AppError('Your role is not authorized for this action.', 403, 'FORBIDDEN'));
}

module.exports = { login, authenticate, allow, publicUser };
