const http = require('http');
const { Server } = require('socket.io');
const env = require('./config/env');
const connectDB = require('./config/db');
const buildApp = require('./app');
const initDiscussionSocket = require('./sockets/discussion.socket');
const { ensureAdminAccount } = require('./services/bootstrap.service');

const start = async () => {
  await connectDB();
  await ensureAdminAccount();

  const httpServer = http.createServer();
  const io = new Server(httpServer, {
    cors: {
      origin: env.frontendUrl,
      credentials: true,
    },
  });

  const app = buildApp(io);
  httpServer.removeAllListeners('request');
  httpServer.on('request', app);

  initDiscussionSocket(io);

  httpServer.listen(env.port, () => {
    console.log(`Backend server running on port ${env.port}`);
  });
};

start().catch((err) => {
  console.error('Failed to start backend', err);
  process.exit(1);
});
