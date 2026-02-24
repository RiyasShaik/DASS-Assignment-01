const mongoose = require('mongoose');
const env = require('./env');

const connectDB = async () => {
  await mongoose.connect(env.mongodbUri, {
    serverSelectionTimeoutMS: 10000,
  });
};

module.exports = connectDB;
