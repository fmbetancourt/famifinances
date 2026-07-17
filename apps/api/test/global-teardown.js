module.exports = async () => {
  const mongo = globalThis.__MONGOINSTANCE;
  if (mongo) {
    await mongo.stop();
  }
};
