require('dotenv').config();
const mysql = require('mysql2/promise');

async function testConnexion() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });
    
    console.log('Connexion réussie !');
    await connection.end();
  } catch (error) {
    console.error('Erreur de connexion :', error.message);
  }
}

testConnexion();
