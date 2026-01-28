require('dotenv').config();
const { Pool } = require('pg');

async function setupDatabase() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'reservation_bus',
    port: process.env.DB_PORT || 5432
  });

  try {
    console.log('Connexion à la base de données...');

    // Table utilisateurs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS utilisateurs (
        id SERIAL PRIMARY KEY,
        telephone VARCHAR(20) UNIQUE NOT NULL,
        mot_de_passe VARCHAR(255) NOT NULL,
        nom_complet VARCHAR(100) NOT NULL,
        date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Table utilisateurs créée');

    // Table bus
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bus (
        id SERIAL PRIMARY KEY,
        numero VARCHAR(50) NOT NULL,
        capacite INT NOT NULL,
        prix DECIMAL(10, 2) NOT NULL
      )
    `);
    console.log('Table bus créée');

    // Table trajets
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
    console.log('Table trajets créée');

    // Table réservations
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
    console.log('Table réservations créée');

    // Vérifier si les données existent déjà
    const busResult = await pool.query('SELECT COUNT(*) FROM bus');
    if (busResult.rows[0].count === 0) {
      await pool.query(`
        INSERT INTO bus (numero, capacite, prix) VALUES
        ('BUS-001', 50, 5000),
        ('BUS-002', 50, 5000),
        ('BUS-003', 45, 5000)
      `);
      console.log('Données de bus insérées');
    }

    const trajetsResult = await pool.query('SELECT COUNT(*) FROM trajets');
    if (trajetsResult.rows[0].count === 0) {
      await pool.query(`
        INSERT INTO trajets (bus_id, depart, arrivee, date, heure) VALUES
        (1, 'Kaolack', 'Dakar', '2025-02-01', '08:00:00'),
        (1, 'Dakar', 'Kaolack', '2025-02-01', '18:00:00'),
        (2, 'Kaolack', 'Dakar', '2025-02-02', '10:00:00'),
        (2, 'Dakar', 'Kaolack', '2025-02-02', '20:00:00'),
        (3, 'Kaolack', 'Dakar', '2025-02-03', '09:00:00'),
        (3, 'Dakar', 'Kaolack', '2025-02-03', '19:00:00')
      `);
      console.log('Données de trajets insérées');
    }

    const userResult = await pool.query('SELECT COUNT(*) FROM utilisateurs');
    if (userResult.rows[0].count === 0) {
      await pool.query(`
        INSERT INTO utilisateurs (telephone, mot_de_passe, nom_complet) VALUES
        ('77123456', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', 'Souleymana Diallo')
      `);
      console.log('Utilisateur de test inséré');
    }

    console.log('Base de données configurée avec succès !');
    await pool.end();

  } catch (error) {
    console.error('Erreur :', error.message);
    await pool.end();
  }
}

setupDatabase();
