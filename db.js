const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

/**
 * Safely masks the password in a connection string to prevent logging credentials.
 * @param {string} url - The database connection URL
 * @returns {string} The masked URL
 */
function maskConnectionString(url) {
  if (!url) return 'undefined';
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '****';
    }
    return parsed.toString();
  } catch (e) {
    return url.replace(/([^:]+:\/\/[^:]+:)[^@]+(@.+)/, '$1****$2');
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Standard for Supabase connections
  }
});

/**
 * Tests connection to the database
 * @returns {Promise<boolean>} True if connection succeeded, false otherwise
 */
async function checkDatabaseConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    return true;
  } catch (err) {
    const maskedUrl = maskConnectionString(process.env.DATABASE_URL);
    console.error(`❌ Database connection error (URL: ${maskedUrl}):`, err.message);
    return false;
  }
}

module.exports = {
  pool,
  checkDatabaseConnection,
  maskConnectionString
};
