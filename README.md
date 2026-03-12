# Secure Steganography System - Project Structure

## 📁 Folder Structure & Purpose

### Root Directory (`/home/z/my-project/` or your `2323/` folder)

This is the **main project folder**. Here's what each folder/file does:

---

## 📂 Folders Explained:

### ✅ **NEEDED Folders:**

#### 1. **`mini-services/stego-server/`** ⭐ **MAIN PROJECT**
- **Purpose**: This IS your steganography application
- **Contains**:
  - `index.js` - Express server (Node.js backend)
  - `modules/encryption.js` - DES + AES encryption
  - `modules/steganography.js` - LSB steganography
  - `public/` - Frontend files (HTML, CSS, JS)
  - `package.json` - Dependencies

#### 2. **`public/`**
- **Purpose**: Root web server files
- **Contains**:
  - `index.html` - Redirects to stego-server (port 3030)
  - `logo.svg` - Red shield logo
  - `robots.txt` - SEO file

#### 3. **`node_modules/`**
- **Purpose**: Installed JavaScript packages
- **Auto-generated**: Created by `bun install`
- **Contains**: All npm packages (express, sharp, multer, etc.)

#### 4. **`.git/`**
- **Purpose**: Git version control
- **Auto-generated**: Created by git init
- **Contains**: Project history and versions

#### 5. **`.zscripts/`**
- **Purpose**: Build and start scripts
- **Auto-generated**: Platform scripts
- **Used by**: Deployment system

---

### ❌ **INFRASTRUCTURE FILES (Don't Delete):**

- **`Caddyfile`** - Gateway configuration (routes port 3030)
- **`bun.lock`** - Dependency lock file
- **`package.json`** - Main project dependencies
- **`.gitignore`** - Git ignore rules
- **`.dockerignore`** - Docker ignore rules
- **`dev.log`** - Development server logs

---

## 🚀 How to Run:

### **IMPORTANT: Always work in `mini-services/stego-server/` folder!**

```bash
# Navigate to the stego-server folder
cd mini-services/stego-server

# Install dependencies (only first time)
bun install

# Start the server
bun run dev

# Open browser
http://localhost:3030/
```

---

## 📁 Simplified Structure (What You Should Focus On):

```
2323/ (your main folder)
├── mini-services/
│   └── stego-server/    ⭐ THIS IS YOUR APP
│       ├── index.js      (Backend server)
│       ├── modules/
│       │   ├── encryption.js
│       │   └── steganography.js
│       └── public/         (Frontend)
│           ├── index.html
│           ├── styles.css
│           ├── app.js
│           └── logo.svg
├── public/                (Root web redirect)
│   └── index.html
└── package.json
```

---

## 🎯 What Each Part Does:

### **`mini-services/stego-server/`** - Your Complete App

| File/Folder | Purpose | Frontend/Backend |
|------------|---------|----------------|
| `index.js` | Express server (Node.js) | Backend |
| `modules/encryption.js` | DES + AES encryption | Backend |
| `modules/steganography.js` | LSB hide/extract data | Backend |
| `public/index.html` | Main UI page | Frontend |
| `public/styles.css` | CSS styling | Frontend |
| `public/app.js` | JavaScript logic | Frontend |
| `public/logo.svg` | Red shield logo | Frontend |

### **`public/`** - Root Web Files

| File | Purpose |
|------|---------|
| `index.html` | Redirects to stego-server (port 3030) |
| `logo.svg` | Logo for root page |
| `robots.txt` | Search engine file |

---

## ❌ Files/Folders You Can Ignore (Infrastructure):

- `.git/` - Version control
- `.zscripts/` - Build scripts
- `node_modules/` - Dependencies (don't touch)
- `dev.log` - Server logs
- `Caddyfile` - Gateway config
- `bun.lock` - Dependency lock
- `package.json` - Root dependencies (not used directly)

---

## 📝 Summary:

**Your "total folder" (2323 or whatever you named it) is the project root.**

**The ONLY folder you need to work in is:**
```
mini-services/stego-server/
```

**Everything else is infrastructure that keeps the system running.**

---

## 🔑 Key Points:

1. **Navigate to**: `cd mini-services/stego-server`
2. **Your app is**: Express server + HTML/CSS/JS frontend
3. **Runs on**: Port 3030
4. **Access at**: `http://localhost:3030/`
5. **No Next.js** - We're using pure Node.js + HTML/CSS/JS
6. **MySQL for logs** - Set `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`

---

## 🚫 Don't Delete These:

- ❌ `mini-services/` - Your whole app!
- ❌ `node_modules/` - Dependencies
- ❌ `.git/` - Version control
- ❌ `package.json` - Dependencies
- ❌ `Caddyfile` - Gateway

---

## ✅ Clean Project Structure (After Cleanup):

```
✅ mini-services/stego-server/  (YOUR APP)
✅ public/                       (Redirect page)
✅ node_modules/                  (Dependencies)
✅ .git/                         (Version control)
✅ .zscripts/                    (Build scripts)
✅ Infrastructure files          (Caddyfile, bun.lock, etc.)
```

---

**Bottom Line: Work in `mini-services/stego-server/` - that's your complete steganography application!** 🎯
