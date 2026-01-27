const mysql = require('mysql2/promise');
const crypto = require('crypto');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'reservation_bus',

});

function chiffrerMotDePasse(motDePasse) {
  return crypto.createHash('sha256').update(motDePasse).digest('hex');
}

module.exports = {
  pool,
  chiffrerMotDePasse
};