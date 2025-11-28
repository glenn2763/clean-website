# Deployment Guide: Fantasy Football Backend

This guide walks you through deploying your backend server to Render (free tier).

## Step 1: Create a Render Account

1. Go to [render.com](https://render.com)
2. Sign up with your GitHub account (easiest option)
3. Verify your email if prompted

## Step 2: Prepare Your Code

Your code is already set up! The server will use environment variables for ESPN cookies in production.

## Step 3: Deploy to Render

### Option A: Deploy via Render Dashboard (Easiest)

1. **Create a New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the `clean-website` repository

2. **Configure the Service**
   - **Name**: `fantasy-football-backend` (or any name you like)
   - **Environment**: `Node`
   - **Region**: Choose closest to you (e.g., `Oregon (US West)`)
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: Leave blank (or `.` if needed)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

3. **Set Environment Variables**
   - Click "Advanced" → "Add Environment Variable"
   - Add these two variables:
     - **Key**: `ESPN_S2`
       **Value**: (paste your espnS2 value from espn-config.json)
     - **Key**: `ESPN_SWID`
       **Value**: (paste your SWID value from espn-config.json)
   - Click "Add Environment Variable" for each

4. **Deploy**
   - Click "Create Web Service"
   - Render will start building and deploying
   - Wait 2-3 minutes for deployment to complete

5. **Get Your Backend URL**
   - Once deployed, you'll see a URL like: `https://fantasy-football-backend-xxxx.onrender.com`
   - Copy this URL - you'll need it for the frontend!

## Step 4: Update Frontend to Use Backend

1. Open `fantasy-football-stats.html`
2. Find this line (around line 180):
   ```javascript
   window.BACKEND_URL = null;
   ```
3. Replace `null` with your Render backend URL + `/api/espn`:
   ```javascript
   window.BACKEND_URL = 'https://fantasy-football-backend-xxxx.onrender.com/api/espn';
   ```
4. Commit and push to GitHub

## Step 5: Deploy Frontend to GitHub Pages

1. Go to your GitHub repository
2. Settings → Pages
3. Source: Deploy from a branch
4. Branch: `main` (or your default branch)
5. Folder: `/ (root)`
6. Click Save

Your site will be available at: `https://yourusername.github.io/clean-website/fantasy-football-stats.html`

## Troubleshooting

### Backend not working?
- Check Render logs: Dashboard → Your Service → Logs
- Verify environment variables are set correctly
- Make sure `npm start` works locally first

### Frontend can't connect to backend?
- Check browser console for CORS errors
- Verify `BACKEND_URL` in `fantasy-football-stats.html` is correct
- Make sure backend URL includes `/api/espn` at the end

### ESPN cookies expired?
- Get fresh cookies from DevTools → Application → Cookies → espn.com
- Update environment variables in Render dashboard
- Redeploy (or wait for auto-redeploy)

## Cost

Render free tier includes:
- 750 hours/month (enough for 24/7 uptime)
- Automatic SSL certificates
- Auto-deploy from GitHub
- Perfect for personal projects!

## Alternative: Railway (Similar Process)

If you prefer Railway:
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. New Project → Deploy from GitHub repo
4. Add environment variables: `ESPN_S2` and `ESPN_SWID`
5. Get your Railway URL and update frontend

