# أكاديمية هدف يونايتد — API Server

## Deploy to Render.com (Free)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Set these environment variables:
   - `NODE_ENV` = `production`
   - `MONGODB_URI` = your MongoDB Atlas connection string
   - `SESSION_SECRET` = any long random string
5. Click **Deploy**
6. Copy your Render URL (e.g. `https://hadaf-united-api.onrender.com`)
7. Paste it in `api/index.php` on Hostinger

## Deploy to Railway.app (Free tier)

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → GitHub repo
3. Add the same environment variables above
4. Deploy → copy URL → paste in Hostinger `api/index.php`

## Environment Variables Required

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Set to `production` |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `SESSION_SECRET` | Any strong random string |
| `PORT` | Auto-set by the hosting platform |
