// Starts an in-memory MongoDB and sets required env BEFORE Jest spawns workers,
// so ConfigModule's eager validation (validateEnv) passes at module import time.
const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  const mongo = await MongoMemoryServer.create();
  globalThis.__MONGOINSTANCE = mongo;
  process.env.MONGODB_URI = mongo.getUri();
  process.env.JWT_SECRET = 'test-secret-value-please-change';
  process.env.MAIL_FROM_ADDRESS = 'no-reply@famifinances.test';
};
