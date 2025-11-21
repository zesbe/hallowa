# 🐳 Docker Deployment Guide

## Pre-Built Docker Image dari GitHub Actions

Setiap kali ada push ke `main` branch, GitHub Actions akan otomatis build Docker image dan push ke GitHub Container Registry (GHCR).

### 📦 Cara Deploy Pre-Built Image di VPS

#### 1. Setup GitHub Container Registry Access

```bash
# Login ke GHCR (gunakan GitHub Personal Access Token)
docker login ghcr.io -u YOUR_GITHUB_USERNAME

# Atau buat token dengan scope: read:packages
# https://github.com/settings/tokens/new?scopes=read:packages
```

#### 2. Pull dan Run Image

```bash
# Pull latest image
docker pull ghcr.io/YOUR_USERNAME/YOUR_REPO/railway-service:latest

# Run container
docker run -d \
  --name hallowa-backend \
  --restart unless-stopped \
  -p 3000:3000 \
  -v $(pwd)/auth_sessions:/app/auth_sessions \
  -e SUPABASE_URL="your_supabase_url" \
  -e SUPABASE_KEY="your_supabase_key" \
  -e REDIS_URL="your_redis_url" \
  -e INTERNAL_API_KEY="your_api_key" \
  ghcr.io/YOUR_USERNAME/YOUR_REPO/railway-service:latest
```

#### 3. Menggunakan Docker Compose (Recommended)

Buat file `docker-compose.yml`:

```yaml
version: '3.8'

services:
  hallowa-backend:
    image: ghcr.io/YOUR_USERNAME/YOUR_REPO/railway-service:latest
    container_name: hallowa-backend
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./auth_sessions:/app/auth_sessions
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - REDIS_URL=${REDIS_URL}
      - INTERNAL_API_KEY=${INTERNAL_API_KEY}
      - PORT=3000
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health')"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

Jalankan:
```bash
docker-compose up -d
```

#### 4. Auto-Update dengan Watchtower (Optional)

Install Watchtower untuk auto-pull image terbaru:

```bash
docker run -d \
  --name watchtower \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --interval 300 \
  hallowa-backend
```

Watchtower akan otomatis check setiap 5 menit dan update container jika ada image baru.

### 🔄 Manual Update

```bash
# Pull image terbaru
docker pull ghcr.io/YOUR_USERNAME/YOUR_REPO/railway-service:latest

# Stop dan remove container lama
docker stop hallowa-backend
docker rm hallowa-backend

# Run container baru
docker-compose up -d
# atau
docker run -d ... (perintah run dari atas)
```

### 📊 Monitoring

```bash
# Lihat logs
docker logs -f hallowa-backend

# Lihat resource usage
docker stats hallowa-backend

# Check health
docker inspect --format='{{.State.Health.Status}}' hallowa-backend
```

### 🚀 Deploy di Dokploy VPS

#### Cara 1: Manual Docker Pull

1. SSH ke VPS
2. Login ke GHCR: `docker login ghcr.io`
3. Pull dan run dengan docker-compose

#### Cara 2: Dokploy dengan Docker Image

1. Di Dokploy UI, pilih "Docker Image" (bukan GitHub)
2. Image name: `ghcr.io/YOUR_USERNAME/YOUR_REPO/railway-service:latest`
3. Set environment variables
4. Deploy

**Keuntungan:**
- ✅ Deployment cuma 10-30 detik (vs 5-10 menit build dari source)
- ✅ No build process di VPS
- ✅ Hemat resource VPS
- ✅ Consistent builds (built di GitHub Actions)

### 🔑 GitHub Token Setup

Untuk pull private images, buat Personal Access Token:

1. Go to: https://github.com/settings/tokens/new
2. Select scope: `read:packages`
3. Generate token
4. Login: `docker login ghcr.io -u YOUR_USERNAME -p YOUR_TOKEN`

### 🏷️ Image Tags

GitHub Actions akan create tags:
- `latest` - Latest dari main branch
- `main-{SHA}` - Specific commit
- `main` - Latest main branch

Gunakan specific SHA untuk production stability:
```bash
docker pull ghcr.io/YOUR_USERNAME/YOUR_REPO/railway-service:main-abc1234
```

### 🐛 Troubleshooting

**Error: unauthorized**
```bash
# Re-login dengan token yang benar
docker login ghcr.io -u YOUR_USERNAME
```

**Error: Image not found**
- Check GitHub Actions workflow sudah jalan
- Check repository visibility (public/private)
- Check token permissions

**Container restart terus**
```bash
# Check logs
docker logs hallowa-backend

# Check environment variables
docker inspect hallowa-backend | grep Env -A 20
```

## 🔗 Related Links

- GitHub Actions Workflow: `.github/workflows/build-docker.yml`
- Dockerfile: `railway-service/Dockerfile`
- VPS Deployment: `railway-service/docs/VPS_DEPLOYMENT.md`
