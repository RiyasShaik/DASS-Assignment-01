const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../services/token.service');

const auth = async (req, _res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.substring(7) : null;

    if (!token) {
      throw new ApiError(401, 'Authentication token missing');
    }

    const payload = verifyToken(token);
    const user = await User.findById(payload.id).lean();

    if (!user) {
      throw new ApiError(401, 'Invalid authentication token');
    }

    if (user.role === 'organizer' && user.isDisabled) {
      throw new ApiError(403, 'Organizer account is disabled');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.statusCode) {
      next(error);
    } else if (error.name === 'TokenExpiredError') {
      next(new ApiError(401, 'Token expired, please log in again'));
    } else {
      next(new ApiError(401, 'Authentication failed'));
    }
  }
};

const authorize = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new ApiError(403, 'Forbidden: insufficient role privileges'));
  }
  return next();
};

module.exports = {
  auth,
  authorize,
};
