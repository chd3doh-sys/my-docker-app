# SETUP INSTRUCTIONS - Department of Health Document Upload System

## ⚠️ IMPORTANT: Complete Setup Guide

### Step 1: Enable PowerShell Script Execution (One-time setup)

Open PowerShell as Administrator and run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Step 2: Install Node.js Dependencies

Open a terminal in the App-Search folder and run:
```bash
npm install
```

This will install:
- express (web server)
- mysql2 (MySQL database driver)
- multer (file upload handling)
- cors (cross-origin resource sharing)

### Step 3: Setup MySQL Database

1. **Make sure MySQL 8.0 is running**

2. **Create the database** - Open MySQL command line or MySQL Workbench:
```sql
CREATE DATABASE IF NOT EXISTS anti_gravity_db 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;
```

3. **Update MySQL password in server.js**:
   - Open `server.js`
   - Find line ~44: `password: ''`
   - Replace with your MySQL root password: `password: 'your_password_here'`

### Step 4: Start the Backend Server

```bash
npm start
```

You should see:
```
✅ Database table initialized successfully
🚀 Server running on http://localhost:3000
📁 Upload directory: ./uploads
💾 Database: anti_gravity_db
```

### Step 5: Test the Connection

Open your browser to: http://localhost:3000/api/test-db

You should see:
```json
{"success":true,"message":"Database connection successful"}
```

### Step 6: Use the Application

1. Open `index.html` in your browser
2. Click "Login" button
3. Enter username: `admin`, password: `admin`
4. Upload a PDF file (make sure to check the OCR confirmation)
5. The file will be uploaded to the database!

## 📊 Database Table Structure

The system automatically creates this table:

```sql
CREATE TABLE uploaded_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    is_ocr_enabled BOOLEAN DEFAULT TRUE,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by VARCHAR(100) DEFAULT 'admin'
);
```

## 🔍 View Uploaded Documents

To see all uploaded documents in MySQL:
```sql
USE anti_gravity_db;
SELECT * FROM uploaded_documents ORDER BY upload_date DESC;
```

## 🛠️ Troubleshooting

### "Cannot connect to database"
- Verify MySQL is running
- Check MySQL credentials in `server.js`
- Ensure database `anti_gravity_db` exists

### "Port 3000 already in use"
- Change PORT in `server.js` (line 8)
- Update fetch URL in `script.js` (line 338)

### "npm command not found"
- Install Node.js from https://nodejs.org/
- Restart your terminal after installation

### "Upload failed"
- Make sure the server is running (`npm start`)
- Check browser console for errors (F12)
- Verify the server URL is correct

## 📁 File Storage

Uploaded files are stored in: `./uploads/`
- Files are renamed with timestamps for uniqueness
- Original filenames are stored in the database

## 🔐 Security Notes (For Production)

This is a development setup. For production:
1. Use environment variables for database credentials
2. Implement proper password hashing (bcrypt)
3. Add JWT authentication
4. Use HTTPS
5. Implement file virus scanning
6. Add rate limiting
7. Validate file content (not just extension)

## 📞 Need Help?

Check the server console for error messages when uploads fail.
