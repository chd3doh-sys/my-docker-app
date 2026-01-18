const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'r00t',
    database: process.env.DB_NAME || 'anti_gravity_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function initializeDatabase() {
    try {
        console.log('Connecting to database...');
        const connection = await pool.getConnection();

        // 1. Initialize uploaded_documents table
        console.log('Initializing uploaded_documents table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS uploaded_documents (
                id INT AUTO_INCREMENT PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                original_filename VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                file_size BIGINT NOT NULL,
                ocr_enabled BOOLEAN DEFAULT TRUE,
                upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                uploaded_by VARCHAR(100) DEFAULT 'admin',
                rpo_number VARCHAR(255),
                content_summary TEXT,
                doc_year INT,
                subject TEXT,
                filetype VARCHAR(50)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Ensure index for searching
        try {
            await connection.query("ALTER TABLE uploaded_documents ADD INDEX (upload_date)");
            await connection.query("ALTER TABLE uploaded_documents ADD INDEX (doc_year)");
        } catch (idxErr) {
            // Index might already exist
        }

        // 2. Initialize users table
        console.log('Initializing users table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                doh_id VARCHAR(50) NOT NULL,
                role ENUM('admin', 'uploader') DEFAULT 'uploader',
                status ENUM('active', 'pending') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Check if admin user exists
        const [existingAdmin] = await connection.query('SELECT id FROM users WHERE username = ?', ['admin']);
        if (existingAdmin.length === 0) {
            const hashedPassword = await bcrypt.hash('admin', 10);
            await connection.query(
                "INSERT INTO users (username, password, doh_id, role, status) VALUES (?, ?, ?, ?, ?)",
                ['admin', hashedPassword, 'ADMIN-001', 'admin', 'active']
            );
            console.log('✅ Admin user created (username: admin, password: admin)');
        }

        connection.release();
        console.log('✅ Database tables and users initialized successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Database initialization error:', error.message);
        if (error.code === 'ER_BAD_DB_ERROR') {
            console.error('TIP: The database "anti_gravity_db" does not exist. Please create it first using:');
            console.error('CREATE DATABASE anti_gravity_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
        }
        process.exit(1);
    }
}

initializeDatabase();
