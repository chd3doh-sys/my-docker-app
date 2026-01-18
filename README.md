# Department of Health - Document Upload System

## Backend Setup Instructions

### Prerequisites
1. **Node.js** (v14 or higher) - [Download here](https://nodejs.org/)
2. **MySQL 8.0** - Make sure it's installed and running

### Database Setup

1. **Create the database** (if it doesn't exist):
```sql
CREATE DATABASE IF NOT EXISTS anti_gravity_db 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;
```

2. **Update MySQL credentials** in `server.js`:
```javascript
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'YOUR_MYSQL_PASSWORD', // Update this!
    database: 'anti_gravity_db',
    // ...
});
```

### Installation Steps

1. **Install dependencies**:
```bash
npm install
```

2. **Start the server**:
```bash
npm start
```

Or for development with auto-restart:
```bash
npm run dev
```

3. **Verify the server is running**:
   - Open browser to: http://localhost:3000/api/test-db
   - You should see: `{"success":true,"message":"Database connection successful"}`

### Using the Application

1. **Start the backend server** (as shown above)
2. **Open the frontend**: Open `index.html` in your browser
3. **Login** with username: `admin`, password: `admin`
4. **Upload PDFs**: Select a PDF file, confirm it's OCR-enabled, and click Upload

### Database Table Structure

The server automatically creates this table:

```sql
CREATE TABLE uploaded_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    is_ocr_enabled BOOLEAN DEFAULT TRUE,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by VARCHAR(100) DEFAULT 'admin',
    INDEX idx_upload_date (upload_date),
    INDEX idx_filename (filename)
);
```

### API Endpoints

- `POST /api/login` - User authentication
- `POST /api/upload` - Upload PDF document
- `GET /api/documents` - Get all uploaded documents
- `GET /api/test-db` - Test database connection

### Uploaded Files

Files are stored in the `./uploads` directory with unique filenames.

### Troubleshooting

**Error: "Cannot connect to database"**
- Make sure MySQL is running
- Check your MySQL credentials in `server.js`
- Verify the database `anti_gravity_db` exists

**Error: "Port 3000 already in use"**
- Change the PORT in `server.js` to another number (e.g., 3001)
- Update the fetch URL in `script.js` accordingly

**Error: "CORS policy"**
- The server has CORS enabled by default
- If issues persist, check your browser console for specific errors
