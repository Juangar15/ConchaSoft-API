const mysql = require('mysql2/promise');
require('dotenv').config();

const db = mysql.createPool(process.env.DATABASE_URL);

db.getConnection()
    .then(() => console.log('Conectado a la base de datos'))
    .catch(err => ('Error de conexión:', err));

module.exports = db;