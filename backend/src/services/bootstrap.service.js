const User = require('../models/User');
const env = require('../config/env');

const ensureAdminAccount = async () => {
  const existingAdmin = await User.findOne({ role: 'admin' }).select('+password');
  if (existingAdmin) return existingAdmin;

  const admin = await User.create({
    firstName: 'System',
    lastName: 'Admin',
    email: env.adminEmail.toLowerCase(),
    password: env.adminPassword,
    role: 'admin',
  });

  console.log('[BOOTSTRAP] Admin account created:', admin.email);
  return admin;
};

module.exports = {
  ensureAdminAccount,
};
