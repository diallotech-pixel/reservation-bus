const mysql = require('mysql2/promise');

async function setupDatabase() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: ''
  });

  try {
    // Supprimer la base de données si elle existe
    await connection.query('DROP DATABASE IF EXISTS reservation_bus');
    console.log('Base de données supprimée');

    // Créer la nouvelle base de données
    await connection.query('CREATE DATABASE IF NOT EXISTS reservation_bus');
    console.log('Base de données créée');

    // Changer vers la nouvelle base de données
    await connection.changeUser({ database: 'reservation_bus' });

    // Table utilisateurs (NOUVELLE)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS utilisateurs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        telephone VARCHAR(20) UNIQUE NOT NULL,
        mot_de_passe VARCHAR(255) NOT NULL,
        nom_complet VARCHAR(100) NOT NULL,
        date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Table utilisateurs créée');

    // Table bus
    await connection.query(`
      CREATE TABLE IF NOT EXISTS bus (
        id INT AUTO_INCREMENT PRIMARY KEY,
        numero VARCHAR(50) NOT NULL,
        capacite INT NOT NULL,
        prix DECIMAL(10, 2) NOT NULL
      )
    `);
    console.log('Table bus créée');

    // Table trajets
    await connection.query(`
      CREATE TABLE IF NOT EXISTS trajets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bus_id INT NOT NULL,
        depart VARCHAR(100) NOT NULL,
        arrivee VARCHAR(100) NOT NULL,
        date DATE NOT NULL,
        heure TIME NOT NULL,
        FOREIGN KEY (bus_id) REFERENCES bus(id)
      )
    `);
    console.log('Table trajets créée');

    // Table réservations 
    await connection.query(`
    CREATE TABLE IF NOT EXISTS reservations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        utilisateur_id INT NOT NULL,
        trajet_id INT NOT NULL,
        nombre_places INT NOT NULL,
        status VARCHAR(20) DEFAULT 'confirmée',
        date_reservation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id),
        FOREIGN KEY (trajet_id) REFERENCES trajets(id)
    )
    `);
    console.log('Table réservations créée');

    // Insérer les données de test pour les bus
    await connection.query(`
      INSERT INTO bus (numero, capacite, prix) VALUES
      ('BUS-001', 50, 5000),
      ('BUS-002', 50, 5000),
      ('BUS-003', 45, 5000)
    `);
    console.log('Données de bus insérées');

    // Insérer les données de test pour les trajets
    await connection.query(`
      INSERT INTO trajets (bus_id, depart, arrivee, date, heure) VALUES
      (1, 'Kaolack', 'Dakar', '2025-02-01', '08:00:00'),
      (1, 'Dakar', 'Kaolack', '2025-02-01', '18:00:00'),
      (2, 'Kaolack', 'Dakar', '2025-02-02', '10:00:00'),
      (2, 'Dakar', 'Kaolack', '2025-02-02', '20:00:00'),
      (3, 'Kaolack', 'Dakar', '2025-02-03', '09:00:00'),
      (3, 'Dakar', 'Kaolack', '2025-02-03', '19:00:00')
    `);
    console.log('Données de trajets insérées');

    // Insérer un utilisateur de test
    await connection.query(`
      INSERT INTO utilisateurs (telephone, mot_de_passe, nom_complet) VALUES
      ('77123456', 'test123', 'Souleymana Diallo')
    `);
    console.log('Utilisateur de test inséré');

    console.log('Base de données configurée avec succès !');
    await connection.end();

  } catch (error) {
    console.error('Erreur :', error);
    await connection.end();
  }
}

setupDatabase();
