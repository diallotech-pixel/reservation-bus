require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const { pool, chiffrerMotDePasse } = require('./config');

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

app.use(session({
  secret: 'votre_secret_key_123',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

function verifierConnexion(req, res, next) {
  if (!req.session.utilisateur_id) {
    return res.redirect('/login');
  }
  next();
}

app.get('/', async (req, res) => {
  try {
    if (!req.session.utilisateur_id) {
      return res.redirect('/login');
    }

    const result = await pool.query(`
      SELECT t.id, b.numero, b.capacite, b.prix, t.depart, t.arrivee, t.date, t.heure
      FROM trajets t
      JOIN bus b ON t.bus_id = b.id
      ORDER BY t.date, t.heure
    `);
    
    res.render('index', { 
      trajets: result.rows,
      utilisateur: req.session
    });
  } catch (error) {
    console.error('Erreur :', error);
    res.send('Erreur serveur');
  }
});

app.get('/reserver/:trajet_id', verifierConnexion, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.id, b.id as bus_id, b.numero, b.capacite, b.prix, t.depart, t.arrivee, t.date, t.heure
      FROM trajets t
      JOIN bus b ON t.bus_id = b.id
      WHERE t.id = $1
    `, [req.params.trajet_id]);
    
    if (result.rows.length === 0) {
      return res.send('Trajet non trouvé');
    }

    const trajet = result.rows[0];

    const reservResult = await pool.query(`
      SELECT SUM(nombre_places) as places_reservees 
      FROM reservations 
      WHERE trajet_id = $1
    `, [req.params.trajet_id]);

    const placesReservees = reservResult.rows[0].places_reservees || 0;
    const placesDisponibles = trajet.capacite - placesReservees;

    res.render('reserver', { 
      trajet,
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
    
    const trajetResult = await pool.query(`
      SELECT t.id, t.bus_id, b.capacite
      FROM trajets t
      JOIN bus b ON t.bus_id = b.id
      WHERE t.id = $1
    `, [trajet_id]);

    if (trajetResult.rows.length === 0) {
      return res.send('Trajet non trouvé');
    }

    const bus_id = trajetResult.rows[0].bus_id;
    const capacite = trajetResult.rows[0].capacite;

    const reservResult = await pool.query(`
      SELECT SUM(nombre_places) as places_reservees 
      FROM reservations 
      WHERE trajet_id = $1
    `, [trajet_id]);
    
    const placesReservees = reservResult.rows[0].places_reservees || 0;
    const placesDisponibles = capacite - placesReservees;
    
    if (parseInt(nombre_places) > placesDisponibles) {
      return res.send('Pas assez de places disponibles. Places disponibles : ' + placesDisponibles);
    }
    
    await pool.query(`
      INSERT INTO reservations (utilisateur_id, trajet_id, nombre_places, status)
      VALUES ($1, $2, $3, 'confirmée')
    `, [utilisateur_id, trajet_id, nombre_places]);
    
    res.redirect('/mes-reservations');
  } catch (error) {
    console.error('Erreur :', error);
    res.send('Erreur serveur');
  }
});

app.get('/mes-reservations', verifierConnexion, async (req, res) => {
  try {
    const utilisateur_id = req.session.utilisateur_id;
    
    const result = await pool.query(`
      SELECT r.id, r.nombre_places, r.status, r.date_reservation,
             b.numero, b.prix, t.id as trajet_id, t.depart, t.arrivee, t.date, t.heure
      FROM reservations r
      JOIN trajets t ON r.trajet_id = t.id
      JOIN bus b ON t.bus_id = b.id
      WHERE r.utilisateur_id = $1
      ORDER BY r.date_reservation DESC
    `, [utilisateur_id]);
    
    res.render('mes-reservations', { 
      reservations: result.rows,
      utilisateur: req.session
    });
  } catch (error) {
    console.error('Erreur :', error);
    res.send('Erreur serveur');
  }
});

app.get('/annuler/:reservation_id', verifierConnexion, async (req, res) => {
  try {
    await pool.query('DELETE FROM reservations WHERE id = $1', [req.params.reservation_id]);
    res.redirect('/mes-reservations');
  } catch (error) {
    console.error('Erreur :', error);
    res.send('Erreur serveur');
  }
});

app.get('/inscription', (req, res) => {
  res.render('inscription');
});

app.post('/inscription', async (req, res) => {
  try {
    const { telephone, mot_de_passe, nom_complet } = req.body;
    
    if (!telephone || !mot_de_passe || !nom_complet) {
      return res.send('Tous les champs sont obligatoires');
    }

    const utilisateur_existe = await pool.query(
      'SELECT id FROM utilisateurs WHERE telephone = $1',
      [telephone]
    );

    if (utilisateur_existe.rows.length > 0) {
      return res.send('Ce numéro de téléphone est déjà utilisé');
    }

    const motDePasseChiffre = chiffrerMotDePasse(mot_de_passe);

    await pool.query(
      'INSERT INTO utilisateurs (telephone, mot_de_passe, nom_complet) VALUES ($1, $2, $3)',
      [telephone, motDePasseChiffre, nom_complet]
    );

    res.redirect('/login');
  } catch (error) {
    console.error('Erreur :', error);
    res.send('Erreur serveur');
  }
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  try {
    const { telephone, mot_de_passe } = req.body;

    const result = await pool.query(
      'SELECT id, nom_complet, mot_de_passe FROM utilisateurs WHERE telephone = $1',
      [telephone]
    );

    if (result.rows.length === 0) {
      return res.send('Téléphone ou mot de passe incorrect');
    }

    const utilisateur = result.rows[0];

    const motDePasseChiffre = chiffrerMotDePasse(mot_de_passe);
    if (utilisateur.mot_de_passe !== motDePasseChiffre) {
      return res.send('Téléphone ou mot de passe incorrect');
    }

    req.session.utilisateur_id = utilisateur.id;
    req.session.nom_complet = utilisateur.nom_complet;
    req.session.telephone = telephone;

    res.redirect('/');
  } catch (error) {
    console.error('Erreur :', error);
    res.send('Erreur serveur');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});