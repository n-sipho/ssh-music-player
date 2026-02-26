# 🎵 HomeMusic

**HomeMusic** is a sleek, vibe-coded music player that turns your home network into a personal streaming service. It lets you stream your downloaded music directly from remote devices (like an old laptop or home server) using SSH (SFTP) and SMB protocols, all within a modern, aesthetic web interface.

No need to move gigabytes of files—just connect, scan, and vibe.

---

## ✨ Features

- **Vibe-Coded UI:** A dark, modern, Spotify-inspired interface for the ultimate listening experience.
- **Remote Streaming:** Stream directly from remote folders via SSH/SFTP or SMB/Samba.
- **Smart Indexing:** Automatically extracts metadata (title, artist, album) and album art from your remote files.
- **Unified Library:** Browse your collection by Artists, Albums, or Folders.
- **Dynamic Playlists:** Create and manage your own music vibes.
- **Zero Migration:** Keep your music where it is; HomeMusic handles the rest.

---

## 🛠️ Requirements

- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher
- **SQLite:** (Included, no separate database server needed)
- **Remote Access:** 
  - For **SSH**: An SSH server running on the remote device with SFTP enabled.
  - For **SMB**: A shared folder on a Windows machine or a Linux machine running Samba.

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/homemusic.git
cd homemusic
```

### 2. Install Dependencies
This project uses npm workspaces. You can install all dependencies from the root:
```bash
npm install
```

### 3. Database Setup
Initialize the SQLite database using Prisma:
```bash
npm run build -w server
cd server
npx prisma generate
npx prisma db push
cd ..
```

### 4. Running the App

#### Development Mode
Runs both the client (Vite) and the server (Fastify) concurrently with hot-reloading:
```bash
npm run dev
```
- **Client:** `http://localhost:5173`
- **Server:** `http://localhost:3000`

#### Production Build
Build the optimized frontend and start the backend:
```bash
npm run build
npm start
```
The app will be accessible at `http://localhost:3000`.

---

## 📡 Adding Your Music

1. Open HomeMusic in your browser.
2. Navigate to **⚙️ Settings**.
3. Click **Add Source**.
4. Choose your protocol (**SSH** or **SMB**).
5. Enter your remote device's IP, credentials, and the path to your music folder.
6. Click **Test** to verify the connection.
7. Click **Save Source** and then **Scan for Music** to start building your library.

---

## 🏗️ Architecture

- **Frontend:** React, TypeScript, Tailwind CSS, Zustand (state management).
- **Backend:** Node.js, Fastify, Prisma (ORM).
- **Database:** SQLite.
- **Protocols:** `ssh2` for SFTP and `smb2` for Samba.

---

## 📝 License
This project is for personal use and educational purposes. Feel free to fork and customize your vibe!
