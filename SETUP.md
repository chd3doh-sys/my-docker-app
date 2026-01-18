# FULL SETUP GUIDE - DOH Document Upload System

Follow these steps to set up the environment for production or development.

## 🐳 Option 1: Docker (Recommended)

1. **Install Docker Desktop** from [docker.com](https://www.docker.com/).
2. **Run the following command** in the project root:
   ```bash
   docker-compose up -d
   ```
3. Done! The database and backend are now running at `http://localhost:3000`.

---

## 💻 Option 2: Local Windows Setup

### Step 1: Install Node.js
Download and install Node.js (v18+) from [nodejs.org](https://nodejs.org/).

### Step 2: Install Dependencies
Open a terminal in the `App-Search` folder and run:
```bash
npm install
```

### Step 3: Setup MySQL
1. Ensure MySQL 8.0 is installed and running.
2. Create the database:
   ```sql
   CREATE DATABASE IF NOT EXISTS anti_gravity_db;
   ```

### Step 4: Configure Environment Variables
1. Copy `.env.example` to `.env`.
2. Open `.env` and update your MySQL credentials:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   ```

### Step 5: Initialize Tables
Run the initialization script to create tables and the default admin user:
```bash
node init_db.js
```

### Step 6: Start Application
```bash
npm start
```

---

## 🧪 Verification

1. **API Check**: Open [http://localhost:3000/api/test-db](http://localhost:3000/api/test-db).
   - Expected: `{"success":true,"message":"Database connection successful"}`
2. **Frontend Check**: Open `public/index.html` via a local server or start the backend and access it at `http://localhost:3000`.
3. **Login**: Use `admin`/`admin`.

## 📁 File Management
- Documents are saved in the `uploaded files` directory.
- Database records are stored in the `uploaded_documents` table.

## 🛠️ Common Issues
- **PowerShell Permissions**: If scripts fail, run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` in Admin PowerShell.
- **Port Conflict**: Change `PORT` in `.env` if 3000 is occupied.
- **MySQL Auth**: If you get "Access denied", verify the password in `.env`.
