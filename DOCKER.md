# Docker Deployment Guide

## 🐳 Quick Start with Docker

This application is fully containerized and can be run using Docker and Docker Compose.

### Prerequisites

- Docker Desktop installed on Windows
- Docker Compose (included with Docker Desktop)

### Running the Application

1. **Start all services** (MySQL + Node.js app):
   ```bash
   docker-compose up -d
   ```

2. **View logs**:
   ```bash
   docker-compose logs -f
   ```

3. **Stop all services**:
   ```bash
   docker-compose down
   ```

4. **Stop and remove all data** (including database):
   ```bash
   docker-compose down -v
   ```

### Accessing the Application

- **Frontend**: http://localhost:3000
- **MySQL Database**: localhost:3306
  - Username: `root`
  - Password: `r00t`
  - Database: `anti_gravity_db`

### Docker Services

#### 1. MySQL Database (`mysql`)
- Image: `mysql:8.0`
- Port: `3306`
- Persistent storage via Docker volume `mysql_data`
- Auto-initializes with `init_db.js` on first run

#### 2. Node.js Application (`app`)
- Built from local `Dockerfile`
- Port: `3000`
- Mounts `uploaded files` directory for file persistence
- Automatically waits for MySQL to be healthy before starting

### Useful Commands

**Rebuild containers after code changes:**
```bash
docker-compose up -d --build
```

**View running containers:**
```bash
docker-compose ps
```

**Execute commands inside the app container:**
```bash
docker-compose exec app sh
```

**Access MySQL shell:**
```bash
docker-compose exec mysql mysql -uroot -pr00t anti_gravity_db
```

**View app logs only:**
```bash
docker-compose logs -f app
```

**View MySQL logs only:**
```bash
docker-compose logs -f mysql
```

### Troubleshooting

**Port already in use:**
If port 3000 or 3306 is already in use, edit `docker-compose.yml` and change the port mapping:
```yaml
ports:
  - "3001:3000"  # Maps host port 3001 to container port 3000
```

**Database connection issues:**
The app service has a health check dependency on MySQL. If you see connection errors, wait a few seconds for MySQL to fully initialize.

**Reset everything:**
```bash
docker-compose down -v
docker-compose up -d --build
```

### File Persistence

- **Uploaded files**: Stored in `./uploaded files` (mounted as volume)
- **Database data**: Stored in Docker volume `mysql_data`
- **Public files**: Mounted from `./public`

### Environment Variables

The application reads configuration from environment variables defined in `docker-compose.yml`:

- `DB_HOST`: MySQL hostname (set to `mysql` in Docker network)
- `DB_USER`: Database username
- `DB_PASSWORD`: Database password
- `DB_NAME`: Database name
- `PORT`: Application port
- `NODE_ENV`: Environment mode (production/development)

### Production Deployment

For production deployment, consider:

1. **Use secrets** for sensitive data instead of plain environment variables
2. **Add reverse proxy** (nginx) for SSL/TLS
3. **Configure backup** for MySQL volume
4. **Set resource limits** in docker-compose.yml
5. **Use production-grade MySQL configuration**

### Development vs Docker

You can still run the app locally without Docker:
```bash
npm install
node server.js
```

The code automatically detects if it's running in Docker (via environment variables) or locally.
