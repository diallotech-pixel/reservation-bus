require('dotenv').config();
const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DB_HOST || 'postgresql://postgres:password@localhost/reservation_bus',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

function chiffrerMotDePasse(motDePasse) {
  return crypto.createHash('sha256').update(motDePasse).digest('hex');
}

module.exports = {
  pool,
  chiffrerMotDePasse
};