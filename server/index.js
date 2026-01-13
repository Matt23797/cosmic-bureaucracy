import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3030;
const DB_FILE = path.join(__dirname, 'database.json');

// === Rate Limiting ===
const rateLimits = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute

function rateLimiter(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!rateLimits.has(ip)) {
        rateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return next();
    }

    const limit = rateLimits.get(ip);
    if (now > limit.resetAt) {
        limit.count = 1;
        limit.resetAt = now + RATE_LIMIT_WINDOW_MS;
        return next();
    }

    if (limit.count >= RATE_LIMIT_MAX) {
        return res.status(429).json({ error: 'Too many requests. Try again later.' });
    }

    limit.count++;
    next();
}

// Clean up old rate limit entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, limit] of rateLimits) {
        if (now > limit.resetAt + RATE_LIMIT_WINDOW_MS) {
            rateLimits.delete(ip);
        }
    }
}, 5 * 60 * 1000);

// === Save Data Validation ===
function validateSaveData(save) {
    if (!save || typeof save !== 'object') return null;

    // Ensure required structures exist
    if (!save.resources || typeof save.resources !== 'object') return null;
    if (!save.departments || typeof save.departments !== 'object') return null;

    // Clamp numeric values to safe ranges
    const clamp = (val, min, max) => {
        if (typeof val !== 'number' || !isFinite(val)) return min;
        return Math.max(min, Math.min(max, val));
    };

    // Sanitize resources
    save.resources.forms = clamp(save.resources.forms, 0, 1e308);
    save.resources.paradox = clamp(save.resources.paradox, 0, 1e12);
    save.resources.time = clamp(save.resources.time, 0, 1e12);
    save.resources.policyDebt = clamp(save.resources.policyDebt, 0, 1e12);

    // Sanitize stats
    if (save.stats && typeof save.stats === 'object') {
        save.stats.totalClicks = clamp(save.stats.totalClicks, 0, 1e15);
        save.stats.totalForms = clamp(save.stats.totalForms, 0, 1e308);
    }

    // Sanitize meta
    if (save.meta && typeof save.meta === 'object') {
        save.meta.metaAuthority = clamp(save.meta.metaAuthority, 0, 1e9);
        save.meta.resets = clamp(save.meta.resets, 0, 1e6);
    }

    // Sanitize department counts
    for (const [key, val] of Object.entries(save.departments)) {
        save.departments[key] = clamp(val, 0, 1e9);
    }

    // Ensure arrays are arrays
    if (!Array.isArray(save.ownedUpgrades)) save.ownedUpgrades = [];
    if (!Array.isArray(save.ownedThresholdUpgrades)) save.ownedThresholdUpgrades = [];

    return save;
}

app.use(cors());
app.use(express.json({ limit: '100kb' })); // Limit payload size
app.use(rateLimiter);

// Serve Static Files (Game)
app.use(express.static(path.join(__dirname, '../dist')));

// APK Download Route
app.get('/download', (req, res) => {
    const apkPath = path.join(__dirname, '../android/app/build/outputs/apk/debug/app-debug.apk');
    res.download(apkPath, 'cosmic-bureaucracy.apk', (err) => {
        if (err) {
            console.error("Download Error:", err.message);
            if (!res.headersSent) {
                res.status(404).send("APK not found or download error.");
            }
        }
    });
});

// API Routes
// Simple file-based DB helper
async function getDB() {
    try {
        const data = await fs.readFile(DB_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return { users: {} };
    }
}

async function saveDB(data) {
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

// AUTH: Login or Register
app.post('/api/auth', async (req, res) => {
    let { deviceId } = req.body;

    // Validate deviceId format if provided
    if (deviceId && (typeof deviceId !== 'string' || deviceId.length > 100)) {
        return res.status(400).json({ error: 'Invalid device ID format' });
    }

    const db = await getDB();

    if (!deviceId) {
        // Register new user
        deviceId = uuidv4();
        db.users[deviceId] = {
            created: Date.now(),
            lastLogin: Date.now(),
            saveData: null
        };
        await saveDB(db);
        console.log(`[AUTH] New User Created: ${deviceId}`);
        return res.json({ deviceId, saveData: null, isNew: true });
    }

    if (db.users[deviceId]) {
        // Login existing
        db.users[deviceId].lastLogin = Date.now();
        await saveDB(db);
        console.log(`[AUTH] User Logged In: ${deviceId}`);
        return res.json({ deviceId, saveData: db.users[deviceId].saveData });
    } else {
        // Device ID not found (maybe wiped server), re-register
        db.users[deviceId] = {
            created: Date.now(),
            lastLogin: Date.now(),
            saveData: null
        };
        await saveDB(db);
        console.log(`[AUTH] User Re-Registered: ${deviceId}`);
        return res.json({ deviceId, saveData: null, isNew: true });
    }
});

// SYNC: Save Progress
app.post('/api/sync', async (req, res) => {
    const { deviceId, save } = req.body;

    // Validate inputs
    if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 100) {
        return res.status(400).json({ error: 'Invalid device ID' });
    }
    if (!save) {
        return res.status(400).json({ error: 'Missing save data' });
    }

    // Validate and sanitize save data
    const validatedSave = validateSaveData(save);
    if (!validatedSave) {
        return res.status(400).json({ error: 'Invalid save data format' });
    }

    const db = await getDB();
    if (db.users[deviceId]) {
        db.users[deviceId].saveData = validatedSave;
        db.users[deviceId].lastSync = Date.now();
        await saveDB(db);
        console.log(`[SYNC] Save updated for: ${deviceId}`);
        return res.json({ success: true });
    }

    return res.status(404).json({ error: 'User not found' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Live Update URL: http://<YOUR_IP>:${PORT}`);
});
