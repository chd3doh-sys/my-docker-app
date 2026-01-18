# Department of Health - Document Upload System

This is a modern, containerized document management system for the Department of Health (DOH) to upload, search, and archive PDF documents (RPO and Advisories) with automated metadata extraction.

## 🚀 Quick Start (Docker)

The fastest way to get started is using **Docker Desktop**.

1. **Clone the repository** (if not already done)
2. **Start the application**:
   ```bash
   docker-compose up -d
   ```
3. **Access the app**: http://localhost:3000

---

## 🛠️ Manual Backend Setup

If you prefer to run it without Docker:

### Prerequisites
1. **Node.js** (v18 or higher)
2. **MySQL 8.0**

### 1. Database Configuration
1. Create the database in MySQL:
   ```sql
   CREATE DATABASE IF NOT EXISTS anti_gravity_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. Create a `.env` file in the root directory (use `.env.example` as a template):
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=anti_gravity_db
   PORT=3000
   ```

### 2. Installation
```bash
npm install
```

### 3. Initialize Database
You can either start the server or run the init script:
```bash
node init_db.js
```

### 4. Start the Server
```bash
npm start
# or for development
npm run dev
```

---

## 📂 Project Structure

```
App-Search/
├── server.js                 # Main Express server (API & UI)
├── init_db.js               # Database initialization script
├── .env                     # Environment variables (ignored by git)
├── .env.example             # Example environment variables
├── docker-compose.yml       # Docker orchestration
├── Dockerfile               # Node.js container config
├── public/                  # Frontend assets
│   ├── index.html           # Main UI
│   ├── script.js            # Frontend logic
│   └── style.css            # Custom CSS
└── uploaded files/          # Storage for PDF uploads (git ignored)
```

## 🔐 Authentication
- **Default Admin**:
  - Username: `admin`
  - Password: `admin`
- New users can register and wait for admin activation via the Admin Dashboard.

## 🔍 Features
- **Auto-Extraction**: Automatically extracts RPO numbers, subjects, and years from PDFs.
- **Smart Search**: Search by filename, subject, or year.
- **Archive**: Download all documents from a specific year as a ZIP file.
- **Admin Dashboard**: Manage documents and user roles/status.

## ⚠️ Troubleshooting
- **Database Connection**: Ensure MySQL is running and credentials in `.env` are correct.
- **Upload Errors**: Check the console logs for OCR or file system permission errors.
- **Network**: The backend runs on port 3000 by default. Ensure it's not blocked.

## 📝 License
ISC
