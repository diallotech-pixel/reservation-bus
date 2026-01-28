require('dotenv').config();
const { Pool } = require('pg');
const express = require('express');

async function initializeDatabase() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'reservation_bus',
    port: process.env.DB_PORT || 5432,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('Initialisation de la base de données...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS utilisateurs (
        id SERIAL PRIMARY KEY,
        telephone VARCHAR(20) UNIQUE NOT NULL,
        mot_de_passe VARCHAR(255) NOT NULL,
        nom_complet VARCHAR(100) NOT NULL,
        date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS bus (
        id SERIAL PRIMARY KEY,
        numero VARCHAR(50) NOT NULL,
        capacite INT NOT NULL,
        prix DECIMAL(10, 2) NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS trajets (
        id SERIAL PRIMARY KEY,
        bus_id INT NOT NULL REFERENCES bus(id),
        depart VARCHAR(100) NOT NULL,
        arrivee VARCHAR(100) NOT NULL,
        date DATE NOT NULL,
        heure TIME NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id SERIAL PRIMARY KEY,
        utilisateur_id INT NOT NULL REFERENCES utilisateurs(id),
        trajet_id INT NOT NULL REFERENCES trajets(id),
        nombre_places INT NOT NULL,
        status VARCHAR(20) DEFAULT 'confirmée',
        date_reservation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const busCheck = await pool.query('SELECT COUNT(*) FROM bus');
    if (busCheck.rows[0].count === 0) {
      await pool.query(`
        INSERT INTO bus (numero, capacite, prix) VALUES
        ('BUS-001', 50, 5000),
        ('BUS-002', 50, 5000),
        ('BUS-003', 45, 5000)
      `);
      console.log('Bus insérés');
    }

    const trajetsCheck = await pool.query('SELECT COUNT(*) FROM trajets');
    if (trajetsCheck.rows[0].count === 0) {
      await pool.query(`
        INSERT INTO trajets (bus_id, depart, arrivee, date, heure) VALUES
        (1, 'Kaolack', 'Dakar', '2025-02-01', '08:00:00'),
        (1, 'Dakar', 'Kaolack', '2025-02-01', '18:00:00'),
        (2, 'Kaolack', 'Dakar', '2025-02-02', '10:00:00'),
        (2, 'Dakar', 'Kaolack', '2025-02-02', '20:00:00'),
        (3, 'Kaolack', 'Dakar', '2025-02-03', '09:00:00'),
        (3, 'Dakar', 'Kaolack', '2025-02-03', '19:00:00')
      `);
      console.log('Trajets insérés');
    }

    const userCheck = await pool.query('SELECT COUNT(*) FROM utilisateurs');
    if (userCheck.rows[0].count === 0) {
      await pool.query(`
        INSERT INTO utilisateurs (telephone, mot_de_passe, nom_complet) VALUES
        ('77123456', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', 'Souleymana Diallo')
      `);
      console.log('Utilisateur de test inséré');
    }

    console.log('Base de données initialisée avec succès !');
    await pool.end();

  } catch (error) {
    console.error('Erreur lors de l\'initialisation :', error.message);
    await pool.end();
  }
}

initializeDatabase().then(() => {
  require('./server');
});
