# Testing & Deployment Guide

Complete guide for testing locally and deploying to production.

## 🧪 Local Testing

### Prerequisites
1. **Node.js** installed (v14+)
2. **ESPN cookies** in `espn-config.json` (see setup below)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Set Up ESPN Config (if not already done)
1. Log into ESPN.com in your browser
2. Open DevTools (F12) → Application tab → Cookies → espn.com
3. Copy the `espn_s2` cookie value
4. Copy the `SWID` cookie value
5. Create `espn-config.json`:
```json
{
  "espnS2": "YOUR_ESPN_S2_VALUE_HERE",
  "SWID": "YOUR_SWID_VALUE_HERE",
  "defaultLeagueId": 37892
}
```

### Step 3: Configure Frontend for Local Testing
Open `fantasy-football-stats.html` and set the backend URL to `null`:

```javascript
// Line ~181 - For local testing
window.BACKEND_URL = null; // Uses relative path /api/espn
```

### Step 4: Start the Backend Server
```bash
npm start
```

The server will start on `http://localhost:3000`

### Step 5: Open the Frontend
Open `fantasy-football-stats.html` in your browser:
- **Option A**: Double-click the file (works but may have CORS issues)
- **Option B**: Use a local server:
  ```bash
  # Using Python 3
  python3 -m http.server 8000
  
  # Or using Node.js http-server (install: npm install -g http-server)
  http-server -p 8000
  ```
  Then visit: `http://localhost:8000/fantasy-football-stats.html`

### Step 6: Test the Application
1. Enter a league ID (e.g., `37892`)
2. Select a season
3. Click "Fetch League Data"
4. Verify all visualizations load correctly
5. Check browser console for any errors

### Troubleshooting Local Testing
- **CORS errors**: Make sure you're using a local server (not file://)
- **Backend not responding**: Check that `npm start` is running
- **ESPN API errors**: Verify your cookies in `espn-config.json` are valid
- **Module errors**: Make sure you're using a modern browser (ES6 modules support)

---

## 🚀 Production Deployment

### Backend Deployment (Render)

#### Step 1: Deploy Backend to Render

1. **Go to Render Dashboard**
   - Visit [dashboard.render.com](https://dashboard.render.com)
   - Sign in with GitHub

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository (`clean-website`)
   - Select the repository

3. **Configure Service**
   - **Name**: `fantasy-football-backend` (or your preferred name)
   - **Environment**: `Node`
   - **Region**: Choose closest to you
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: Leave blank
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

4. **Set Environment Variables**
   - Click "Advanced" → "Add Environment Variable"
   - Add `ESPN_S2` = (your espnS2 cookie value)
   - Add `ESPN_SWID` = (your SWID cookie value)
   - Add `NODE_ENV` = `production` (optional)

5. **Deploy**
   - Click "Create Web Service"
   - Wait 2-3 minutes for deployment
   - Copy your backend URL (e.g., `https://clean-website.onrender.com`)

#### Step 2: Update Frontend to Use Production Backend

1. **Update Backend URL**
   Open `fantasy-football-stats.html` and update line ~181:
   ```javascript
   // For production
   window.BACKEND_URL = 'https://your-backend-name.onrender.com/api/espn';
   ```

2. **Commit and Push**
   ```bash
   git add fantasy-football-stats.html
   git commit -m "Update backend URL for production"
   git push
   ```

### Frontend Deployment (GitHub Pages)

#### Step 1: Enable GitHub Pages

1. Go to your GitHub repository
2. Click **Settings** → **Pages**
3. Under **Source**:
   - Select **Deploy from a branch**
   - **Branch**: `main` (or your default branch)
   - **Folder**: `/ (root)`
4. Click **Save**

#### Step 2: Access Your Site

Your site will be available at:
```
https://yourusername.github.io/clean-website/fantasy-football-stats.html
```

Or if you have a custom domain:
```
https://glennwysen.com/fantasy-football-stats.html
```

### Step 3: Verify Deployment

1. Visit your GitHub Pages URL
2. Test fetching league data
3. Verify all visualizations work
4. Check browser console for errors

---

## 🔄 Updating After Changes

### Backend Updates
- Push changes to GitHub
- Render will auto-deploy (if auto-deploy is enabled)
- Or manually trigger deploy in Render dashboard

### Frontend Updates
- Push changes to GitHub
- GitHub Pages auto-deploys (usually within 1-2 minutes)
- Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R) to see changes

---

## 📋 Deployment Checklist

### Before Deploying
- [ ] Backend works locally (`npm start`)
- [ ] Frontend works locally (tested in browser)
- [ ] ESPN cookies are valid
- [ ] Backend URL is correct in HTML
- [ ] All changes committed and pushed

### After Deploying
- [ ] Backend is running (check Render logs)
- [ ] Frontend loads (check GitHub Pages)
- [ ] Can fetch league data
- [ ] All visualizations render
- [ ] No console errors

---

## 🐛 Common Issues

### Backend Issues

**Backend not starting**
- Check Render logs for errors
- Verify `package.json` has correct start script
- Ensure Node.js version is compatible

**ESPN API errors**
- Cookies may be expired - get fresh ones
- Update environment variables in Render
- Redeploy service

**CORS errors**
- Backend already handles CORS
- If issues persist, check Render URL is correct

### Frontend Issues

**Can't connect to backend**
- Verify `BACKEND_URL` is correct
- Check backend is running (visit backend URL directly)
- Check browser console for specific errors

**Module loading errors**
- Ensure using HTTPS (GitHub Pages provides this)
- Check browser supports ES6 modules
- Verify file paths are correct

**Charts not rendering**
- Check Chart.js CDN is loading
- Verify canvas elements exist in HTML
- Check browser console for Chart.js errors

---

## 💡 Tips

1. **Keep local and production configs separate**
   - Local: `window.BACKEND_URL = null`
   - Production: `window.BACKEND_URL = 'https://...'`

2. **Test locally before deploying**
   - Always test changes locally first
   - Use browser DevTools to debug

3. **Monitor Render logs**
   - Check logs if backend isn't working
   - Look for API errors or startup issues

4. **Update cookies periodically**
   - ESPN cookies expire
   - Update environment variables when needed

---

## 📞 Quick Reference

**Local Testing:**
```bash
npm install          # Install dependencies
npm start            # Start backend (port 3000)
# Open fantasy-football-stats.html in browser
```

**Production URLs:**
- Backend: `https://your-backend.onrender.com`
- Frontend: `https://yourusername.github.io/clean-website/fantasy-football-stats.html`

**Key Files:**
- `server.js` - Backend server
- `fantasy-football-stats.html` - Frontend page
- `fantasy-football/main.js` - Frontend entry point
- `espn-config.json` - Local ESPN config (gitignored)

