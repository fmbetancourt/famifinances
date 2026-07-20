// Starts an in-memory MongoDB and sets required env BEFORE Jest spawns workers,
// so ConfigModule's eager validation (validateEnv) passes at module import time.
const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  const mongo = await MongoMemoryServer.create();
  globalThis.__MONGOINSTANCE = mongo;
  process.env.MONGODB_URI = mongo.getUri();
  process.env.JWT_SECRET = 'test-secret-value-please-change';
  process.env.MAIL_FROM_ADDRESS = 'no-reply@famifinances.test';
  // SEC-01: relax the credential rate limit for the auth-heavy e2e suites (many
  // register/login per suite). The dedicated throttle spec lowers it for its file only.
  process.env.AUTH_RATE_LIMIT = process.env.AUTH_RATE_LIMIT || '1000';
};
