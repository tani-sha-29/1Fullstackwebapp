
const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',          
    password: '3200m1@sql54*y', 
    database: 'counselling_portal'
});

db.connect((err) => {
    if (err) {
        console.error('DB connection failed:', err);
    } else {
        console.log('✅ Connected to MySQL Database');
    }
});

module.exports = db;
