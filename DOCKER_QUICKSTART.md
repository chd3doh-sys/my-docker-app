# 🚀 Docker Quick Reference

## Start Application
```bash
docker-compose up -d
```
or double-click: **`docker-start.bat`**

## Stop Application
```bash
docker-compose down
```
or double-click: **`docker-stop.bat`**

## View Logs
```bash
docker-compose logs -f
```

## Rebuild After Code Changes
```bash
docker-compose up -d --build
```

## Access Points
- **App**: http://localhost:3000
- **MySQL**: localhost:3306 (root/r00t)

## Reset Everything
```bash
docker-compose down -v
docker-compose up -d --build
```

## Check Status
```bash
docker-compose ps
```

---
📖 **Full Guide**: See `DOCKER.md` or `DOCKER_SETUP_COMPLETE.md`
