const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');
const pdf = require('pdf-parse');
const archiver = require('archiver');
const fsSync = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_PATH || 'uploaded files';

// Test-db endpoint
app.get('/api/test-db', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        connection.release();
        res.json({ success: true, message: 'Database connection successful' });
    } catch (error) {
        console.error('Database connection test failed:', error);
        res.status(500).json({ success: false, message: 'Database connection failed', error: error.message });
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/files', express.static(path.resolve(UPLOAD_DIR)));

// Configure multer for basic file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.resolve(UPLOAD_DIR);
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// MySQL connection pool (supports both Docker and local development)
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'r00t',
    database: process.env.DB_NAME || 'chd3',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Initialize simplified database
async function initializeDatabase() {
    try {
        const connection = await pool.getConnection();

        // 1. Initialize uploaded_documents table
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
        } catch (idxErr) { }

        // 2. Initialize users table
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
            console.log('✅ Admin user created');
        }

        connection.release();
        console.log('✅ Database tables and users initialized');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
    }
}

// Basic Upload Endpoint
app.post('/api/upload', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const { originalname, filename, path: filePath, size } = req.file;
        const uploadedBy = req.body.uploadedBy || 'Anonymous';

        // Extract text from PDF
        const dataBuffer = await fs.readFile(filePath);
        let extractedText = '';
        let rpoNumber = null;
        let subject = originalname.split('.')[0];
        let contentSummary = null;
        let docYear = new Date().getFullYear();

        try {
            console.log(`--- UPLOAD START: ${originalname} ---`);
            const pdfData = await pdf(dataBuffer);
            const rawText = pdfData.text || '';
            console.log(`Extracted raw text length: ${rawText.length}`);

            // 1. RPO Detection (PREFER FILENAME for accuracy)
            const rpoPatterns = [
                /(?:RPO|ORDER)[- ]?NO\.?[- ]?(\d{4}-\d+)/i, // Matches "RPO NO 2025-0996"
                /RPO[- ]?(\d{4}-\d+)/i,                      // Matches "RPO 2025-0996"
                /(\d{4}-\d+)/i                               // Matches raw "2025-0996"
            ];

            // PASS A: Check filename
            for (const pattern of rpoPatterns) {
                const match = originalname.match(pattern);
                if (match) {
                    const digitPart = match[1].trim();
                    const isOrder = originalname.toUpperCase().includes('ORDER');
                    rpoNumber = isOrder ? `ORDER-NO-${digitPart}` : `RPO-NO-${digitPart}`;
                    console.log(`[PASS A] Detected RPO: ${rpoNumber}`);
                    break;
                }
            }

            // PASS B: Check text if filename failed
            if (!rpoNumber && rawText.length > 20) {
                const cleanText = rawText.replace(/\s+/g, ' ');
                for (const pattern of rpoPatterns) {
                    const match = cleanText.match(pattern);
                    if (match) {
                        const digitPart = match[1] || match[0].match(/\d{4}-\d+/)[0];
                        const isOrder = originalname.toUpperCase().includes('ORDER') || rawText.toUpperCase().includes('PERSONNEL ORDER');
                        rpoNumber = isOrder ? `ORDER-NO-${digitPart}` : `RPO-NO-${digitPart}`;
                        console.log(`[PASS B] Detected RPO from Text: ${rpoNumber}`);
                        break;
                    }
                }
            }

            // 2. Metadata Extraction (TEXT-BASED)
            if (rawText.length > 50) {
                // Normalize text but keep enough structure for splitting
                const docText = rawText.replace(/\s+/g, ' ').trim();
                const upperName = originalname.toUpperCase();
                const isAdvisory = upperName.includes('ADVISORY');

                // Find where the Subject starts
                const subjectStartMatch = docText.match(/SUBJECT\s*[:.-]*\s+/i);
                if (subjectStartMatch) {
                    const fromSubject = docText.substring(subjectStartMatch.index + subjectStartMatch[0].length);

                    // Find where the Directive starts
                    // Added advisory-specific body starters: "To ensure", "This is to", "Please be", "In line"
                    const directiveMatch = fromSubject.match(/(?:The following\s+[\w\s]+?\s+(?:are|is)\s+(?:authorized|hereby|directed|ordered|directed to attend|scheduled)|To ensure|This is to|Please be|In line with|In view of|Pursuant to)/i);

                    if (directiveMatch) {
                        // Subject is everything between "SUBJECT:" and the start of the directive
                        subject = fromSubject.substring(0, directiveMatch.index).trim();

                        // Summary is everything starting from the directive until the table headers
                        const fromDirective = fromSubject.substring(directiveMatch.index);
                        const tableMatch = fromDirective.match(/(?:NAME\s+DESIGNATION|NAME\s+OFFICE|NAME\s+POSITION|NAME\s*\r?\n)/i);

                        if (tableMatch) {
                            contentSummary = fromDirective.substring(0, tableMatch.index).trim();
                        } else {
                            contentSummary = fromDirective.substring(0, 800).trim();
                        }
                    } else {
                        // Fallback: If no directive found, limit subject length significantly for advisories
                        const limit = isAdvisory ? 100 : 300;
                        subject = fromSubject.substring(0, limit).trim();

                        // If it's an advisory and we still have a lot of text, try to split at the first sentence
                        if (isAdvisory && subject.includes('. ')) {
                            subject = subject.split('. ')[0].trim();
                        }
                    }
                }

                // If summary wasn't found via directive, use the sentence-based fallback
                if (!contentSummary) {
                    const parts = docText.split(/\. |\n/).map(l => l.trim()).filter(l => l.length > 30);
                    // Skip parts that look like header boilerplate
                    const filteredParts = parts.filter(p => !p.toUpperCase().includes('REPUBLIC OF') && !p.toUpperCase().includes('HEALTH'));
                    contentSummary = filteredParts.slice(0, 3).join('. ');
                }

                // Year priority
                // 1. For Advisories: Always use current year (per user request)
                if (isAdvisory) {
                    docYear = new Date().getFullYear();
                    console.log(`[YEAR] Advisory Detected: Using current year -> ${docYear}`);
                }
                // 2. For RPOs/Others: Try RPO Number
                else if (rpoNumber) {
                    const rpoYearMatch = rpoNumber.match(/20\d{2}/);
                    if (rpoYearMatch) {
                        docYear = parseInt(rpoYearMatch[0]);
                        console.log(`[YEAR] Priority 1: RPO derived year -> ${docYear}`);
                    }
                }

                // 3. Fallbacks for non-advisories
                if (!isAdvisory) {
                    if (!docYear || docYear === new Date().getFullYear()) {
                        const textYearMatch = rawText.match(/20[1-3]\d/);
                        if (textYearMatch) docYear = parseInt(textYearMatch[0]);
                    }

                    if (!docYear || docYear === new Date().getFullYear()) {
                        const fileYearMatch = originalname.match(/\d{4}/);
                        if (fileYearMatch) docYear = parseInt(fileYearMatch[0]);
                    }
                }
            }
        } catch (pdfErr) {
            console.error('PDF Reading Error:', pdfErr.message);
        }

        // --- STEP 3: FINAL SANITIZATION & FILETYPE DETECTION ---

        // Ensure subject is clean
        if (!subject || subject === originalname.split('.')[0]) {
            subject = originalname.split('.')[0].replace(/[-_]/g, ' ').replace(/\b(OCR|PDF)\b/gi, '').replace(/\s+/g, ' ').trim();
        }

        // Ensure summary is clean
        if (!contentSummary) contentSummary = 'No administrative summary extracted for this document.';

        // Detect FileType
        let fileType = 'unsorted';
        const upperName = originalname.toUpperCase();
        if (upperName.includes('RPO')) {
            fileType = 'rpo';
        } else if (upperName.includes('ADVISORY')) {
            fileType = 'advisory';
        }

        console.log(`[FINAL] INSERTING DB -> RPO: ${rpoNumber}, Year: ${docYear}, Subject: ${subject}, Type: ${fileType}`);

        try {
            const [result] = await pool.query(
                `INSERT INTO uploaded_documents 
                (filename, original_filename, file_path, file_size, ocr_enabled, uploaded_by, rpo_number, content_summary, doc_year, subject, filetype) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [filename, originalname, filePath, size, true, uploadedBy, rpoNumber, contentSummary, docYear, subject, fileType]
            );

            res.json({ success: true, message: 'File uploaded and processed successfully', documentId: result.insertId });
        } catch (dbErr) {
            console.error('DATABASE INSERT ERROR:', dbErr);
            res.status(500).json({ success: false, message: 'Database error occurred' });
        }
    } catch (err) {
        console.error('CRITICAL UPLOAD ERROR:', err);
        res.status(500).json({ success: false, message: 'Server upload error' });
    }
});

// GET: Archive a specific year folder
app.get('/api/archive/year/:year', async (req, res) => {
    const { year } = req.params;
    try {
        const [docs] = await pool.query('SELECT filename, original_filename FROM uploaded_documents WHERE doc_year = ?', [year]);

        if (docs.length === 0) {
            return res.status(404).json({ success: false, message: 'No documents found for this year' });
        }

        // Create archive
        const archive = archiver('zip', { zlib: { level: 9 } });
        const archiveName = `DOH_Archive_${year}.zip`;

        res.attachment(archiveName);
        archive.pipe(res);

        const uploadDir = path.resolve(UPLOAD_DIR);

        for (const doc of docs) {
            const filePath = path.join(uploadDir, doc.filename);
            if (fsSync.existsSync(filePath)) {
                archive.file(filePath, { name: doc.original_filename });
            }
        }

        await archive.finalize();
    } catch (error) {
        console.error('Archiving error:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Failed to create archive' });
        }
    }
});

// Login and other existing management endpoints...
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length > 0) {
            const user = users[0];
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                const { password: _, ...userWithoutPassword } = user;
                return res.json({ success: true, user: userWithoutPassword });
            }
        }
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Login error' });
    }
});

app.post('/api/register', async (req, res) => {
    const { username, password, doh_id } = req.body;
    try {
        const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Username already taken' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO users (username, password, doh_id, role, status) VALUES (?, ?, ?, ?, ?)',
            [username, hashedPassword, doh_id, 'uploader', 'pending']
        );

        res.json({ success: true, message: 'Account created! Please wait for admin activation.' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Failed to create account' });
    }
});

// Repository list
app.get('/api/documents', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM uploaded_documents ORDER BY upload_date DESC');
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch documents' });
    }
});

// Search documents
app.get('/api/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json({ success: true, data: [] });

    try {
        const searchTerm = `%${q}%`;
        const [rows] = await pool.query(
            `SELECT * FROM uploaded_documents 
             WHERE original_filename LIKE ? 
             OR subject LIKE ? 
             OR doc_year LIKE ? 
             ORDER BY upload_date DESC`,
            [searchTerm, searchTerm, searchTerm]
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Search API error:', error);
        res.status(500).json({ success: false, message: 'Search failed' });
    }
});

// Delete a specific document
app.delete('/api/documents/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [docs] = await pool.query('SELECT filename FROM uploaded_documents WHERE id = ?', [id]);
        if (docs.length > 0) {
            const fileName = docs[0].filename;
            const fullPath = path.join(path.resolve(UPLOAD_DIR), fileName);
            await pool.query('DELETE FROM uploaded_documents WHERE id = ?', [id]);
            try { await fs.unlink(fullPath); } catch (err) { }
            res.json({ success: true, message: 'Document deleted successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Document not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete document' });
    }
});

// Delete all documents in a specific year
app.delete('/api/documents/year/:year', async (req, res) => {
    const { year } = req.params;
    try {
        const [docs] = await pool.query('SELECT filename FROM uploaded_documents WHERE doc_year = ?', [year]);
        await pool.query('DELETE FROM uploaded_documents WHERE doc_year = ?', [year]);
        for (const doc of docs) {
            try { await fs.unlink(path.join(path.resolve(UPLOAD_DIR), doc.filename)); } catch (err) { }
        }
        res.json({ success: true, message: `Successfully deleted all documents from ${year}` });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete folder content' });
    }
});

// Bulk delete multiple documents by IDs
app.post('/api/documents/bulk-delete', async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, message: 'No IDs provided' });
    }

    try {
        // Get filenames for deletion
        const [docs] = await pool.query('SELECT filename FROM uploaded_documents WHERE id IN (?)', [ids]);

        // Delete records
        await pool.query('DELETE FROM uploaded_documents WHERE id IN (?)', [ids]);

        // Delete files
        for (const doc of docs) {
            try {
                const fullPath = path.join(path.resolve(UPLOAD_DIR), doc.filename);
                await fs.unlink(fullPath);
            } catch (err) {
                console.error(`Failed to delete file: ${doc.filename}`, err);
            }
        }

        res.json({ success: true, message: `${ids.length} documents deleted successfully` });
    } catch (error) {
        console.error('Bulk delete error:', error);
        res.status(500).json({ success: false, message: 'Failed to perform bulk deletion' });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, username, doh_id, role, status FROM users');
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
});

app.patch('/api/users/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
        res.json({ success: true, message: `User status updated to ${status}` });
    } catch (error) {
        console.error('Failed to update user status:', error);
        res.status(500).json({ success: false, message: 'Failed to update user status' });
    }
});

app.patch('/api/users/:id/role', async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    try {
        await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);
        res.json({ success: true, message: `User role updated to ${role}` });
    } catch (error) {
        console.error('Failed to update user role:', error);
        res.status(500).json({ success: false, message: 'Failed to update user role' });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM users WHERE id = ?', [id]);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
});

app.listen(PORT, async () => {
    await initializeDatabase();
    console.log(`📁 Files will be stored in: ${path.resolve(UPLOAD_DIR)}`);
    console.log(`🚀 Clean server running on http://localhost:${PORT}`);
});
