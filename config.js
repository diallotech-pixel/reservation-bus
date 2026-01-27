const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'reservation_bus',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

function chiffrerMotDePasse(motDePasse) {
  return crypto.createHash('sha256').update(motDePasse).digest('hex');
}

module.exports = {
  pool,
  chiffrerMotDePasse
};