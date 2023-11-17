const mysql = require('mysql2/promise');
const config = require('./config');

const pool = mysql.createPool({
    host: config.DB_CONFIG.host,
    user: config.DB_CONFIG.user,
    password: config.DB_CONFIG.password,
    database: config.DB_CONFIG.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;

