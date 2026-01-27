require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const { pool, chiffrerMotDePasse } = require('./config');

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Configuration des sessions
app.use(session({
  secret: 'votre_secret_key_123',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// Middleware pour vérifier si l'utilisateur est connecté
function verifierConnexion(req, res, next) {
  if (!req.session.utilisateur_id) {
    return res.redirect('/login');
  }
  next();
}

// Page d'inscription
app.get('/inscription', (req, res) => {
  res.render('inscription');
});

// Traiter l'inscription
app.post('/inscription', async (req, res) => {
  try {
    const { telephone, mot_de_passe, nom_complet } = req.body;
    
    // Vérifier que tous les champs sont remplis
    if (!telephone || !mot_de_passe || !nom_complet) {
      return res.send('Tous les champs sont obligatoires');
    }

    const connection = await pool.getConnection();

    // Vérifier si le téléphone existe déjà
    const [utilisateur_existe] = await connection.query(
      'SELECT id FROM utilisateurs WHERE telephone = ?',
      [telephone]
    );

    if (utilisateur_existe.length > 0) {
      connection.release();
      return res.send('Ce numéro de téléphone est déjà utilisé');
    }

    // Chiffrer le mot de passe
    const motDePasseChiffre = chiffrerMotDePasse(mot_de_passe);

    // Insérer le nouvel utilisateur
    await connection.query(
      'INSERT INTO utilisateurs (telephone, mot_de_passe, nom_complet) VALUES (?, ?, ?)',
      [telephone, motDePasseChiffre, nom_complet]
    );

    connection.release();
    res.redirect('/login');
  } catch (error) {
    console.error('Erreur :', error);
    res.send('Erreur serveur');
  }
});

// Page de connexion
app.get('/login', (req, res) => {
  res.render('login');
});

// Traiter la connexion
app.post('/login', async (req, res) => {
  try {
    const { telephone, mot_de_passe } = req.body;

    const connection = await pool.getConnection();

    // Chercher l'utilisateur par téléphone
    const [utilisateurs] = await connection.query(
      'SELECT id, nom_complet, mot_de_passe FROM utilisateurs WHERE telephone = ?',
      [telephone]
    );

    connection.release();

    // Vérifier si l'utilisateur existe
    if (utilisateurs.length === 0) {
      return res.send('Téléphone ou mot de passe incorrect');
    }

    const utilisateur = utilisateurs[0];

    // Vérifier le mot de passe
    const motDePasseChiffre = chiffrerMotDePasse(mot_de_passe);
    if (utilisateur.mot_de_passe !== motDePasseChiffre) {
      return res.send('Téléphone ou mot de passe incorrect');
    }

    // Créer la session
    req.session.utilisateur_id = utilisateur.id;
    req.session.nom_complet = utilisateur.nom_complet;
    req.session.telephone = telephone;

    res.redirect('/');
  } catch (error) {
    console.error('Erreur :', error);
    res.send('Erreur serveur');
  }
});

// Déconnexion
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

app.get('/', async (req, res) => {
  try {
    // Vérifier si l'utilisateur est connecté
    if (!req.session.utilisateur_id) {
      return res.redirect('/login');
    }

    const connection = await pool.getConnection();
    const [trajets] = await connection.query(`
      SELECT t.id, b.numero, b.capacite, b.prix, t.depart, t.arrivee, t.date, t.heure
      FROM trajets t
      JOIN bus b ON t.bus_id = b.id
      ORDER BY t.date, t.heure
    `);
    connection.release();
    
    res.render('index', { 
      trajets,
      utilisateur: req.session
    });
  } catch (error) {
    console.error('Erreur :', error);
    res.send('Erreur serveur');
  }
});

app.get('/reserver/:trajet_id', verifierConnexion, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [trajet] = await connection.query(`
      SELECT t.id, b.id as bus_id, b.numero, b.capacite, b.prix, t.depart, t.arrivee, t.date, t.heure
      FROM trajets t
      JOIN bus b ON t.bus_id = b.id
      WHERE t.id = ?
    `, [req.params.trajet_id]);
    
    if (trajet.length === 0) {
      connection.release();
      return res.send('Trajet non trouvé');
    }

    // Calculer les places restantes
    const [reservations] = await connection.query(`
      SELECT SUM(nombre_places) as places_reservees 
      FROM reservations 
      WHERE trajet_id = ?
    `, [req.params.trajet_id]);

    const placesReservees = reservations[0].places_reservees || 0;
    const placesDisponibles = trajet[0].capacite - placesReservees;

    connection.release();
    
    res.render('reserver', { 
      trajet: trajet[0],
      placesDisponibles,
      utilisateur: req.session
    });
  } catch (error) {
    console.error('Erreur :', error);
    res.send('Erreur serveur');
  }
});

app.post('/confirmer-reservation', verifierConnexion, async (req, res) => {
  try {
    const { trajet_id, nombre_places } = req.body;
    const utilisateur_id = req.session.utilisateur_id;
    
    const connection = await pool.getConnection();
    
    // Récupérer les informations du trajet et du bus
    const [trajet_info] = await connection.query(`
      SELECT t.id, t.bus_id, b.capacite
      FROM trajets t
      JOIN bus b ON t.bus_id = b.id
      WHERE t.id = ?
    `, [trajet_id]);

    if (trajet_info.length === 0) {
      connection.release();
      return res.send('Trajet non trouvé');
    }

    const bus_id = trajet_info[0].bus_id;
    const capacite = trajet_info[0].capacite;

    // Compter les places déjà réservées pour CE TRAJET SPÉCIFIQUE
    const [reservations] = await connection.query(`
      SELECT SUM(nombre_places) as places_reservees 
      FROM reservations 
      WHERE trajet_id = ?
    `, [trajet_id]);
    
    const placesReservees = reservations[0].places_reservees || 0;
    const placesDisponibles = capacite - placesReservees;
    
    // Vérifier s'il y a assez de places
    if (parseInt(nombre_places) > placesDisponibles) {
      connection.release();
      return res.send('Pas assez de places disponibles. Places disponibles : ' + placesDisponibles);
    }
    
    // Insérer la réservation avec trajet_id
    await connection.query(`
      INSERT INTO reservations (utilisateur_id, trajet_id, nombre_places, status)
      VALUES (?, ?, ?, 'confirmée')
    `, [utilisateur_id, trajet_id, nombre_places]);
    
    connection.release();
    res.redirect('/mes-reservations');
  } catch (error) {
    console.error('Erreur :', error);
    res.send('Erreur serveur');
  }
});

app.get('/mes-reservations', verifierConnexion, async (req, res) => {
  try {
    const utilisateur_id = req.session.utilisateur_id;
    
    const connection = await pool.getConnection();
    const [reservations] = await connection.query(`
      SELECT r.id, r.nombre_places, r.status, r.date_reservation,
             b.numero, b.prix, t.id as trajet_id, t.depart, t.arrivee, t.date, t.heure
      FROM reservations r
      JOIN trajets t ON r.trajet_id = t.id
      JOIN bus b ON t.bus_id = b.id
      WHERE r.utilisateur_id = ?
      ORDER BY r.date_reservation DESC
    `, [utilisateur_id]);
    connection.release();
    
    res.render('mes-reservations', { 
      reservations,
      utilisateur: req.session
    });
  } catch (error) {
    console.error('Erreur :', error);
    res.send('Erreur serveur');
  }
});

app.get('/annuler/:reservation_id', verifierConnexion, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query('DELETE FROM reservations WHERE id = ?', [req.params.reservation_id]);
    connection.release();
    res.redirect('/mes-reservations');
  } catch (error) {
    console.error('Erreur :', error);
    res.send('Erreur serveur');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});