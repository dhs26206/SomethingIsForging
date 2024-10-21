const redis = require('redis');
const client = redis.createClient();

(async () => {
  try {
    await client.connect();
    console.log('Connected to Redis');
  } catch (error) {
    console.error('Redis connection error:', error);
  }
})();

const setProgress = async (userId, status) => {
  try {
    await client.set(userId, status);
  } catch (error) {
    console.error('Error setting progress:', error);
  }
};

const getProgress = async (userId, callback) => {
  try {
    const result = await client.get(userId);
    callback(result || "No progress yet");
  } catch (error) {
    console.error('Error getting progress:', error);
    callback("Error Getting Progress");
  }
};

// Consider adding a function to close the client when done
const closeConnection = async () => {
  try {
    await client.quit();
    console.log('Redis client closed');
  } catch (error) {
    console.error('Error closing Redis client:', error);
  }
};

module.exports = {
  setProgress,
  getProgress,
  closeConnection, // export the close function if needed
};
