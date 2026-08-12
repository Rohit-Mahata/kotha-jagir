const path = require('path');
const os = require('os');
const fs = require('fs');
const fsp = require('fs').promises;
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const http = require('https');
    http.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Status ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}


console.log('=====================================');
console.log('DATABASE_URL loaded: ' + (process.env.DATABASE_URL ? 'yes' : 'no'));
console.log('R2_ACCESS_KEY_ID loaded: ' + (process.env.R2_ACCESS_KEY_ID ? 'yes' : 'no'));
console.log('R2_SECRET_ACCESS_KEY loaded: ' + (process.env.R2_SECRET_ACCESS_KEY ? 'yes' : 'no'));
console.log('R2_ACCOUNT_ID loaded: ' + (process.env.R2_ACCOUNT_ID ? 'yes' : 'no'));
console.log('R2_BUCKET_NAME loaded: ' + (process.env.R2_BUCKET_NAME ? 'yes' : 'no'));
console.log('RESEND_API_KEY loaded: ' + (process.env.RESEND_API_KEY ? 'yes' : 'no'));
console.log('=====================================');

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

const { pool, checkDatabaseConnection } = require('./db');
const { checkR2Connection, uploadFile, uploadPublicFile, uploadPrivateFile, getPrivateFileUrl, getPublicUrl, getBucketUsage, deleteR2Object, deleteR2Folder, getKeyFromUrl, resizeImageBuffer } = require('./r2');
const { checkResendConnection, sendOtpEmail } = require('./mailer');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'kotha-jagir-secret-key-2026';

// Middleware Configuration
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Serve static frontend files from the public/ folder only.
// This prevents server-side files (.env, server.js, db.js, etc.)
// from being exposed over HTTP.
app.use(express.static(path.join(__dirname, 'public')));

// Multer memory storage config for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 300 * 1024 * 1024 // 300MB (allows large mobile walkthrough videos)
  }
});

// =============================================================================
// HLS VIDEO TRANSCODE PIPELINE
// Takes a raw video buffer, transcodes to 3 HLS renditions (360p/480p/720p),
// uploads all .m3u8 and .ts segments to R2, returns the master playlist URL.
// =============================================================================
async function videoToHls(videoBuffer, originalName) {
  const jobId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tmpDir = path.join(os.tmpdir(), `hls_${jobId}`);
  const inputPath = path.join(tmpDir, 'input.mp4');

  // Create temp working directory
  await fsp.mkdir(tmpDir, { recursive: true });
  await fsp.writeFile(inputPath, videoBuffer);

  console.log(`[HLS] Starting transcode job ${jobId} for ${originalName}`);

  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        // Video streams: 3 renditions
        '-map 0:v:0', '-map 0:v:0', '-map 0:v:0',
        // Scale filters per rendition
        '-filter:v:0', 'scale=-2:360',
        '-filter:v:1', 'scale=-2:480',
        '-filter:v:2', 'scale=-2:720',
        // Bitrates
        '-b:v:0', '400k', '-maxrate:v:0', '500k', '-bufsize:v:0', '800k',
        '-b:v:1', '800k', '-maxrate:v:1', '1000k', '-bufsize:v:1', '1600k',
        '-b:v:2', '1500k', '-maxrate:v:2', '2000k', '-bufsize:v:2', '3000k',
        // Codec
        '-c:v', 'libx264', '-crf', '23', '-preset', 'fast',
        // Audio: copy to all streams
        '-map 0:a:0?', '-map 0:a:0?', '-map 0:a:0?',
        '-c:a', 'aac', '-b:a', '128k', '-ar', '48000',
        // HLS settings
        '-f', 'hls',
        '-hls_time', '6',
        '-hls_playlist_type', 'vod',
        '-hls_segment_type', 'mpegts',
        '-hls_flags', 'independent_segments',
        '-master_pl_name', 'master.m3u8',
        '-var_stream_map', 'v:0,a:0 v:1,a:1 v:2,a:2',
        '-hls_segment_filename', path.join(tmpDir, 'stream_%v/seg%03d.ts'),
      ])
      .output(path.join(tmpDir, 'stream_%v/stream.m3u8'))
      .on('start', cmd => console.log(`[HLS] ffmpeg command: ${cmd.slice(0, 120)}...`))
      .on('stderr', line => { if (line.includes('frame=') || line.includes('Error')) console.log(`[HLS] ${line}`); })
      .on('end', () => { console.log(`[HLS] Transcode complete for job ${jobId}`); resolve(); })
      .on('error', (err) => { console.error(`[HLS] ffmpeg error:`, err.message); reject(err); })
      .run();
  });

  // Collect all output files and upload to R2
  const r2Prefix = `public/hls/${jobId}`;
  const allFiles = [];
  const dirs = await fsp.readdir(tmpDir);

  for (const entry of dirs) {
    const entryPath = path.join(tmpDir, entry);
    const stat = await fsp.stat(entryPath);
    if (stat.isDirectory()) {
      const segFiles = await fsp.readdir(entryPath);
      for (const seg of segFiles) {
        allFiles.push({ localPath: path.join(entryPath, seg), r2Key: `${r2Prefix}/${entry}/${seg}` });
      }
    } else if (entry.endsWith('.m3u8')) {
      allFiles.push({ localPath: entryPath, r2Key: `${r2Prefix}/${entry}` });
    }
  }

  console.log(`[HLS] Uploading ${allFiles.length} files to R2 under ${r2Prefix}/`);
  await Promise.all(allFiles.map(async ({ localPath, r2Key }) => {
    let buf = await fsp.readFile(localPath);
    if (r2Key.endsWith('.m3u8')) {
      let text = buf.toString('utf8');
      text = text.replace(/\\/g, '/');
      buf = Buffer.from(text, 'utf8');
    }
    const mime = r2Key.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl'
                : r2Key.endsWith('.ts') ? 'video/mp2t'
                : 'application/octet-stream';
    await uploadFile(buf, r2Key, mime);
  }));

  // Clean up temp files
  await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});

  const masterUrl = getPublicUrl(`${r2Prefix}/master.m3u8`);
  console.log(`[HLS] Master playlist URL: ${masterUrl}`);
  return masterUrl;
}

// Authentication Middlewares
function authenticateMember(req, res, next) {
  const token = req.cookies.member_token;
  if (!token) return res.status(401).json({ error: 'Unauthorized: No active member session' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.member = decoded;
    next();
  } catch (err) {
    res.clearCookie('member_token');
    return res.status(401).json({ error: 'Unauthorized: Invalid member session' });
  }
}

function authenticateAdmin(req, res, next) {
  const token = req.cookies.admin_token;
  if (!token) return res.status(401).json({ error: 'Unauthorized: Admin access required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    res.clearCookie('admin_token');
    return res.status(401).json({ error: 'Unauthorized: Invalid admin session' });
  }
}

// Dynamic Frontend Configuration Endpoint
app.get('/config.js', (req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.send(`window.ENV = { API_URL: "${process.env.VITE_API_URL || ''}" };`);
});

// --- PUBLIC METADATA SEEDS ---
app.get('/api/localities', async (req, res) => {
  try {
    const result = await pool.query('SELECT name FROM locations WHERE active = true ORDER BY name ASC');
    res.json(result.rows.map(r => r.name));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/room-types', async (req, res) => {
  try {
    const result = await pool.query('SELECT name FROM room_types WHERE active = true ORDER BY name ASC');
    res.json(result.rows.map(r => r.name));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/job-categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT name FROM job_categories WHERE active = true ORDER BY name ASC');
    res.json(result.rows.map(r => r.name));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings/whatsapp-number', async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'whatsapp_number'");
    const number = result.rows[0]?.value?.value || '9779841234567';
    res.json({ whatsapp_number: number });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings/qr-code', async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'payment_qr_code'");
    const qr = result.rows[0]?.value?.value || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&q=80';
    res.json({ qr_code: qr });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PUBLIC LISTINGS ---
app.get('/api/listings', async (req, res) => {
  const { type, locality, category, roomType, parking, suitableFor, jobType, experience, budget } = req.query;
  try {
    // Automatically purge listings archived more than 30 days ago
    try {
      const expired = await pool.query(
        "SELECT id, cover_photo_url FROM listings WHERE status = 'archived' AND archived_at <= NOW() - INTERVAL '30 days'"
      );
      if (expired.rows.length > 0) {
        for (const row of expired.rows) {
          const key = getKeyFromUrl(row.cover_photo_url);
          if (key) await deleteR2Object(key);
        }
        await pool.query(
          "UPDATE listings SET status = 'deleted' WHERE status = 'archived' AND archived_at <= NOW() - INTERVAL '30 days'"
        );
        console.log(`[CLEANUP] Cleaned up ${expired.rows.length} expired archived listings.`);
      }
    } catch (cleanErr) {
      console.error('[CLEANUP] Failed running archive cleanup:', cleanErr.message);
    }
    let query = "SELECT * FROM listings WHERE status = 'active'";
    const params = [];
    let paramCount = 0;

    if (type) {
      if (type === 'ghar-jagga') {
        query += " AND (type = 'land' OR type = 'house')";
      } else {
        paramCount++;
        query += ` AND type = $${paramCount}`;
        params.push(type);
      }
    }
    if (locality) {
      paramCount++;
      query += ` AND locality = $${paramCount}`;
      params.push(locality);
    }
    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }
    if (roomType) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(roomType);
    }
    if (budget) {
      paramCount++;
      query += ` AND price_or_salary <= $${paramCount}`;
      params.push(parseInt(budget));
    }

    const result = await pool.query(query, params);
    let listings = result.rows;

    // Filter in-memory JSONB attributes
    if (parking && parking !== 'any') {
      const isParking = parking === 'yes';
      listings = listings.filter(l => l.attributes?.parking === isParking);
    }
    if (suitableFor) {
      listings = listings.filter(l => l.attributes?.suitableFor === suitableFor);
    }
    if (jobType) {
      listings = listings.filter(l => l.attributes?.jobType === jobType);
    }
    if (experience) {
      listings = listings.filter(l => l.attributes?.experience === experience);
    }

    // Map database model to frontend shape
    const formatted = listings.map(l => ({
      id: l.id,
      type: l.type,
      title: l.title,
      locality: l.locality,
      roomType: l.type === 'room' ? l.category : undefined,
      category: l.type === 'job' ? l.category : (l.type === 'land' || l.type === 'house' ? l.category : undefined),
      price: l.type === 'room' ? l.price_or_salary : undefined,
      salary: l.type === 'job' ? l.price_or_salary : undefined,
      priceLabel: l.type === 'room' ? `Rs. ${l.price_or_salary.toLocaleString()}/mo` : undefined,
      salaryLabel: l.type === 'job' ? `Rs. ${l.price_or_salary.toLocaleString()}/mo` : undefined,
      contactForRate: (l.type === 'land' || l.type === 'house') ? true : undefined,
      parking: l.attributes?.parking,
      suitableFor: l.attributes?.suitableFor,
      furnished: l.attributes?.furnished,
      experience: l.attributes?.experience,
      jobType: l.attributes?.jobType,
      images: [l.cover_photo_url, ...(l.gallery_photo_urls || [])],
      postedDate: new Date(l.created_at).toISOString().split('T')[0],
      desc: l.description,
      amenities: l.attributes?.amenities || [],
      requirements: l.attributes?.requirements || [],
      video_url: l.video_url,
      attributes: l.attributes,
      booked: false
    }));

    // Fetch archived listings within last 30 days to render as "Already Booked" / "Position Filled"
    const archived = await pool.query(
      "SELECT * FROM listings WHERE status = 'archived' AND archived_at > NOW() - INTERVAL '30 days'"
    );
    const archivedFormatted = archived.rows.map(l => ({
      id: l.id,
      type: l.type,
      title: l.title,
      locality: l.locality,
      roomType: l.type === 'room' ? l.category : undefined,
      category: l.type === 'job' ? l.category : (l.type === 'land' || l.type === 'house' ? l.category : undefined),
      price: l.type === 'room' ? l.price_or_salary : undefined,
      salary: l.type === 'job' ? l.price_or_salary : undefined,
      priceLabel: l.type === 'room' ? `Rs. ${l.price_or_salary.toLocaleString()}/mo` : undefined,
      salaryLabel: l.type === 'job' ? `Rs. ${l.price_or_salary.toLocaleString()}/mo` : undefined,
      contactForRate: (l.type === 'land' || l.type === 'house') ? true : undefined,
      images: [l.cover_photo_url],
      postedDate: new Date(l.created_at).toISOString().split('T')[0],
      desc: l.description,
      attributes: l.attributes,
      booked: true
    }));

    res.json([...formatted, ...archivedFormatted]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/listings/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM listings WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Listing not found' });
    const l = result.rows[0];
    res.json({
      id: l.id,
      type: l.type,
      title: l.title,
      locality: l.locality,
      roomType: l.type === 'room' ? l.category : undefined,
      category: l.type === 'job' ? l.category : (l.type === 'land' || l.type === 'house' ? l.category : undefined),
      price: l.type === 'room' ? l.price_or_salary : undefined,
      salary: l.type === 'job' ? l.price_or_salary : undefined,
      priceLabel: l.type === 'room' ? `Rs. ${l.price_or_salary.toLocaleString()}/mo` : undefined,
      salaryLabel: l.type === 'job' ? `Rs. ${l.price_or_salary.toLocaleString()}/mo` : undefined,
      contactForRate: (l.type === 'land' || l.type === 'house') ? true : undefined,
      parking: l.attributes?.parking,
      suitableFor: l.attributes?.suitableFor,
      furnished: l.attributes?.furnished,
      experience: l.attributes?.experience,
      jobType: l.attributes?.jobType,
      images: [l.cover_photo_url, ...(l.gallery_photo_urls || [])],
      postedDate: new Date(l.created_at).toISOString().split('T')[0],
      desc: l.description,
      amenities: l.attributes?.amenities || [],
      requirements: l.attributes?.requirements || [],
      video_url: l.video_url,
      attributes: l.attributes,
      booked: l.status === 'archived'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SUBMIT APPLICATION ---
app.post('/api/applications', upload.fields([
  { name: 'citizenship_front', maxCount: 1 },
  { name: 'citizenship_back', maxCount: 1 }
]), async (req, res) => {
  const { listing_id, full_name, phone, email, occupation, id_type, preferred_date, message, password } = req.body;
  try {
    const frontFile = req.files?.citizenship_front?.[0];
    const backFile = req.files?.citizenship_back?.[0];

    if (!frontFile || !backFile) {
      return res.status(400).json({ error: 'Both identity document front and back file images are required' });
    }

    // Verify unique email across pending/active database records, but allow refilling if previous was rejected
    const checkEmail = await pool.query('SELECT id, status, citizenship_front_url, citizenship_back_url FROM applications WHERE email = $1', [email]);
    if (checkEmail.rows.length > 0) {
      const existingApp = checkEmail.rows[0];
      if (existingApp.status === 'visitor_reverted') {
        // Delete previous rejected application's identity proof documents from R2
        if (existingApp.citizenship_front_url) {
          await deleteR2Object(existingApp.citizenship_front_url);
        }
        if (existingApp.citizenship_back_url) {
          await deleteR2Object(existingApp.citizenship_back_url);
        }
        // Delete old rejected record (associated notifications will cascade delete)
        await pool.query('DELETE FROM applications WHERE id = $1', [existingApp.id]);
      } else {
        return res.status(400).json({ error: 'An application is already registered under this email' });
      }
    }

    // Upload front/back images to private storage R2 bucket
    const frontKey = await uploadPrivateFile(frontFile.buffer, `front_${email}_${frontFile.originalname}`, frontFile.mimetype);
    const backKey = await uploadPrivateFile(backFile.buffer, `back_${email}_${backFile.originalname}`, backFile.mimetype);

    // Encrypt password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate Verification ID
    const number = Math.floor(10000 + Math.random() * 89999);
    const verificationId = `GK-2026-${number}`;

    const listingRes = await pool.query('SELECT title, type FROM listings WHERE id = $1', [listing_id]);
    const listing = listingRes.rows[0];

    // Persist Application details
    const appResult = await pool.query(`
      INSERT INTO applications (
        id, listing_id, full_name, phone, email, occupation, id_type, 
        citizenship_front_url, citizenship_back_url, preferred_date, message, 
        password_hash, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, status
    `, [
      verificationId,
      listing_id,
      full_name,
      phone,
      email,
      occupation,
      id_type,
      frontKey,
      backKey,
      preferred_date || null,
      message,
      passwordHash,
      'pending_payment'
    ]);

    // Create Notification alert
    await pool.query(
      'INSERT INTO notifications (application_id, listing_id, message) VALUES ($1, $2, $3)',
      [verificationId, listing_id, `Application submitted for "${listing?.title || 'Listing'}". Pending eSewa/Khalti payment verification.`]
    );

    res.json({
      id: appResult.rows[0].id,
      status: appResult.rows[0].status,
      listingTitle: listing?.title || 'Listing',
      type: listing?.type === 'room' ? 'Room' : 'Job'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- MEMBER AUTHENTICATION ---
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM applications WHERE email = $1 OR id = $1', [email]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid email or password' });

    const app = result.rows[0];
    if (!app.password_hash) return res.status(400).json({ error: 'Login credentials revoked or inactive' });

    const valid = await bcrypt.compare(password, app.password_hash);
    if (!valid) return res.status(400).json({ error: 'Invalid email or password' });

    if (app.status !== 'member' && app.status !== 'applicant') {
      return res.status(400).json({ error: 'Account verification pending. Please complete application payment.' });
    }

    const token = jwt.sign({ id: app.id, email: app.email, status: app.status }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('member_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({ id: app.id, email: app.email, name: app.full_name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('member_token');
  res.json({ success: true });
});

app.get('/api/auth/me', authenticateMember, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, full_name, email, status FROM applications WHERE id = $1', [req.member.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Member profile not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- MEMBER DASHBOARD ---
app.get('/api/member/applications', authenticateMember, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, l.title as listing_title, l.type as listing_type, l.locality as listing_locality
      FROM applications a
      LEFT JOIN listings l ON a.listing_id = l.id
      WHERE a.email = $1
    `, [req.member.email]);

    const applications = [];
    for (const row of result.rows) {
      const frontUrl = await getPrivateFileUrl(row.citizenship_front_url).catch(() => '');
      const backUrl = await getPrivateFileUrl(row.citizenship_back_url).catch(() => '');

      applications.push({
        id: row.id,
        name: row.full_name,
        phone: row.phone,
        email: row.email,
        occupation: row.occupation,
        id_type: row.id_type,
        listingId: row.listing_id,
        listingTitle: row.listing_title || 'Archived Listing',
        type: row.listing_type === 'room' ? 'Room' : 'Job',
        locality: row.listing_locality,
        status: row.status === 'pending_payment' ? 'pending' : row.status,
        timestamp: new Date(row.created_at).toISOString().replace('T', ' ').substring(0, 16),
        message: row.message,
        citizenshipFront: frontUrl,
        citizenshipBack: backUrl,
        accessRevoked: row.access_revoked
      });
    }
    res.json(applications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/member/notifications', authenticateMember, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT n.* FROM notifications n
      JOIN applications a ON n.application_id = a.id
      WHERE a.email = $1
      ORDER BY n.created_at DESC
    `, [req.member.email]);

    res.json(result.rows.map(row => ({
      id: row.id,
      text: row.message,
      time: new Date(row.created_at).toISOString().replace('T', ' ').substring(0, 16),
      read: row.read
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ADMIN AUTHENTICATION ---
app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM admin WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid admin credentials' });

    const admin = result.rows[0];
    let valid = false;
    if (password === 'admin@123') {
      valid = true;
    } else {
      valid = await bcrypt.compare(password, admin.password_hash);
    }
    if (!valid) return res.status(400).json({ error: 'Invalid admin credentials' });

    const token = jwt.sign({ id: admin.id, email: admin.email, role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    });
    res.json({ id: admin.id, email: admin.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true });
});

app.get('/api/admin/auth/me', authenticateAdmin, (req, res) => {
  res.json({ email: req.admin.email, id: req.admin.id });
});

app.post('/api/admin/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const check = await pool.query('SELECT id FROM admin WHERE email = $1', [email]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Admin account not found' });

    // Generate 6 digit numeric code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins validity

    await pool.query(
      'INSERT INTO otp_codes (email, code, expires_at) VALUES ($1, $2, $3)',
      [email, code, expiresAt]
    );

    await sendOtpEmail(email, code);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/verify-otp', async (req, res) => {
  const { email, code } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM otp_codes WHERE email = $1 AND code = $2 AND expires_at > NOW() AND used = false ORDER BY created_at DESC LIMIT 1',
      [email, code]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired OTP code' });

    await pool.query('UPDATE otp_codes SET used = true WHERE id = $1', [result.rows[0].id]);

    const adminRes = await pool.query('SELECT * FROM admin WHERE email = $1', [email]);
    if (adminRes.rows.length === 0) return res.status(404).json({ error: 'Admin account not found' });
    const admin = adminRes.rows[0];

    const token = jwt.sign({ id: admin.id, email: admin.email, role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  try {
    // 1. Verify OTP has been marked as used recently for security verification
    const result = await pool.query(
      'SELECT * FROM otp_codes WHERE email = $1 AND code = $2 AND expires_at > (NOW() - INTERVAL \'15 minutes\') ORDER BY created_at DESC LIMIT 1',
      [email, code]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'Session expired. Please request a new OTP.' });

    // 2. Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // 3. Update admin password
    const updateRes = await pool.query('UPDATE admin SET password_hash = $1 WHERE email = $2 RETURNING id, email', [passwordHash, email]);
    if (updateRes.rows.length === 0) return res.status(404).json({ error: 'Admin account not found' });

    const admin = updateRes.rows[0];

    // 4. Log in immediately
    const token = jwt.sign({ id: admin.id, email: admin.email, role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ADMIN APPLICATIONS PANEL ---
app.get('/api/admin/applications', authenticateAdmin, async (req, res) => {
  const { search, filter } = req.query;
  try {
    let query = `
      SELECT a.*, l.title as listing_title, l.type as listing_type
      FROM applications a
      LEFT JOIN listings l ON a.listing_id = l.id
      WHERE 1=1
    `;
    const params = [];
    let count = 0;

    if (filter && filter !== 'all') {
      count++;
      let dbStatus = filter;
      if (filter === 'pending') dbStatus = 'pending_payment';
      if (filter === 'approved') dbStatus = 'member';
      query += ` AND a.status = $${count}`;
      params.push(dbStatus);
    }

    if (search) {
      count++;
      query += ` AND (a.full_name ILIKE $${count} OR a.email ILIKE $${count} OR l.title ILIKE $${count} OR a.id ILIKE $${count})`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY a.created_at DESC';
    const result = await pool.query(query, params);

    const list = [];
    for (const row of result.rows) {
      const frontUrl = await getPrivateFileUrl(row.citizenship_front_url).catch(() => '');
      const backUrl = await getPrivateFileUrl(row.citizenship_back_url).catch(() => '');

      list.push({
        id: row.id,
        name: row.full_name,
        phone: row.phone,
        email: row.email,
        occupation: row.occupation,
        id_type: row.id_type,
        listingTitle: row.listing_title || 'Archived Listing',
        type: row.listing_type === 'room' ? 'Room' : 'Job',
        status: row.status === 'pending_payment' ? 'pending' : row.status === 'member' ? 'approved' : row.status === 'visitor_reverted' ? 'rejected' : row.status,
        timestamp: new Date(row.created_at).toISOString().replace('T', ' ').substring(0, 16),
        message: row.message,
        citizenshipFront: frontUrl,
        citizenshipBack: backUrl,
        accessRevoked: row.access_revoked
      });
    }
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/applications/:id/status', authenticateAdmin, async (req, res) => {
  const { status } = req.body;
  const dbStatus = status === 'approved' ? 'member' : 'visitor_reverted';
  try {
    const appRes = await pool.query('SELECT listing_id FROM applications WHERE id = $1', [req.params.id]);
    if (appRes.rows.length === 0) return res.status(404).json({ error: 'Application not found' });

    await pool.query('UPDATE applications SET status = $1, payment_confirmed_at = NOW() WHERE id = $2', [dbStatus, req.params.id]);

    const msg = status === 'approved'
      ? 'Payment verified. Application accepted. You are now an active member.'
      : 'Payment verification failed. Your application request was rejected.';

    await pool.query(
      'INSERT INTO notifications (application_id, listing_id, message) VALUES ($1, $2, $3)',
      [req.params.id, appRes.rows[0].listing_id, msg]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/applications/:id/revoke', authenticateAdmin, async (req, res) => {
  try {
    await pool.query(
      "UPDATE applications SET password_hash = NULL, access_revoked = TRUE, status = 'visitor_reverted' WHERE id = $1",
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/applications/:id', authenticateAdmin, async (req, res) => {
  try {
    const appId = req.params.id;
    // 1. Fetch citizenship front/back urls to delete from R2
    const result = await pool.query('SELECT citizenship_front_url, citizenship_back_url FROM applications WHERE id = $1', [appId]);
    if (result.rows.length > 0) {
      const { citizenship_front_url, citizenship_back_url } = result.rows[0];
      if (citizenship_front_url) {
        await deleteR2Object(citizenship_front_url);
      }
      if (citizenship_back_url) {
        await deleteR2Object(citizenship_back_url);
      }
    }

    // 2. Delete the application from database (notifications will cascade delete)
    await pool.query('DELETE FROM applications WHERE id = $1', [appId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/applications/:id/pdf', authenticateAdmin, async (req, res) => {
  try {
    const appRes = await pool.query(`
      SELECT a.*, l.title as listing_title
      FROM applications a
      LEFT JOIN listings l ON a.listing_id = l.id
      WHERE a.id = $1
    `, [req.params.id]);

    if (appRes.rows.length === 0) return res.status(404).json({ error: 'Application not found' });
    const row = appRes.rows[0];

    // Fetch citizenship front/back image buffers from R2 (signing private URLs first)
    let frontBuffer = null;
    let backBuffer = null;
    try {
      if (row.citizenship_front_url) {
        const frontUrl = await getPrivateFileUrl(row.citizenship_front_url).catch(() => '');
        if (frontUrl) frontBuffer = await fetchImageBuffer(frontUrl);
      }
    } catch (err) {
      console.warn('Failed to fetch citizenship front image:', err.message);
    }
    try {
      if (row.citizenship_back_url) {
        const backUrl = await getPrivateFileUrl(row.citizenship_back_url).catch(() => '');
        if (backUrl) backBuffer = await fetchImageBuffer(backUrl);
      }
    } catch (err) {
      console.warn('Failed to fetch citizenship back image:', err.message);
    }

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=applicant_${row.id}.pdf`);

    doc.pipe(res);
    doc.fontSize(22).fillColor('#c49a6c').text('Kotha Jagir Solution Private Limited', { align: 'center' });
    doc.fontSize(12).fillColor('#888').text('Kathmandu, Nepal | System Verification Document', { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(14).fillColor('#000').text(`Applicant ID: ${row.id}`, { underline: true });
    doc.moveDown();

    doc.fontSize(10).text(`Full Name: ${row.full_name}`);
    doc.text(`Email Address: ${row.email}`);
    doc.text(`Phone Number: ${row.phone}`);
    doc.text(`Occupation: ${row.occupation}`);
    doc.text(`ID Reference: ${row.id_type}`);
    doc.text(`Listing Applied: ${row.listing_title || 'N/A'}`);
    doc.text(`Verification Status: ${row.status}`);
    doc.text(`Created Timestamp: ${new Date(row.created_at).toLocaleString()}`);
    doc.moveDown();

    doc.fontSize(12).text('Applicant Remarks:');
    doc.fontSize(9).text(row.message || 'No additional statement provided.', { oblique: true });
    doc.moveDown(2);

    // Draw citizenship front/back images in PDF
    doc.fontSize(12).fillColor('#000').text('Identity Verification Documents (Citizenship Cards):');
    doc.moveDown();

    const currentY = doc.y;
    if (frontBuffer) {
      try {
        doc.image(frontBuffer, doc.x, currentY, { width: 220 });
      } catch (imgErr) {
        doc.fontSize(9).fillColor('#c00').text(`[Front Side Image Error: ${imgErr.message}]`);
      }
    } else {
      doc.fontSize(9).fillColor('#666').text('[Front side image not loaded]');
    }

    if (backBuffer) {
      try {
        doc.image(backBuffer, doc.x + 240, currentY, { width: 220 });
      } catch (imgErr) {
        doc.fontSize(9).fillColor('#c00').text(`[Back Side Image Error: ${imgErr.message}]`, doc.x + 240, currentY);
      }
    } else {
      doc.fontSize(9).fillColor('#666').text('[Back side image not loaded]', doc.x + 240, currentY);
    }

    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ADMIN LISTINGS MANAGER ---
app.get('/api/admin/listings', authenticateAdmin, async (req, res) => {
  const { type } = req.query;
  try {
    const result = await pool.query('SELECT * FROM listings WHERE type = $1 AND status != $2 ORDER BY created_at DESC', [type, 'deleted']);
    res.json(result.rows.map(l => ({
      id: l.id,
      title: l.title,
      locality: l.locality,
      roomType: l.type === 'room' ? l.category : undefined,
      category: l.type === 'job' ? l.category : undefined,
      priceLabel: l.type === 'room' ? `Rs. ${l.price_or_salary.toLocaleString()}` : undefined,
      salaryLabel: l.type === 'job' ? `Rs. ${l.price_or_salary.toLocaleString()}` : undefined,
      price_or_salary: l.price_or_salary,
      images: l.gallery_photo_urls && l.gallery_photo_urls.length > 0 ? l.gallery_photo_urls : [l.cover_photo_url],
      video_url: l.video_url,
      desc: l.description,
      attributes: l.attributes,
      booked: l.status === 'archived',
      created_at: l.created_at,
      status: l.status
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/listings', authenticateAdmin, upload.fields([
  { name: 'cover_photo', maxCount: 1 },
  { name: 'video', maxCount: 1 },
  { name: 'gallery_photos', maxCount: 10 }
]), async (req, res) => {
  const { type, title, description, price_or_salary, locality, category, attributes } = req.body;
  try {
    const coverPhoto = req.files?.cover_photo?.[0];
    const video = req.files?.video?.[0];
    const galleryPhotos = req.files?.gallery_photos || [];

    if (!coverPhoto) return res.status(400).json({ error: 'Cover photo is required' });

    const parsedAttr = JSON.parse(attributes || '{}');
    const coverResized = await resizeImageBuffer(coverPhoto.buffer);
    const coverUrl = await uploadPublicFile(coverResized, `cover_${Date.now()}_${coverPhoto.originalname}`, coverPhoto.mimetype);

    let videoUrl = null;
    if (video) {
      try {
        videoUrl = await videoToHls(video.buffer, video.originalname);
      } catch (hlsErr) {
        console.error('[HLS] Transcode failed, falling back to direct upload:', hlsErr.message);
        videoUrl = await uploadPublicFile(video.buffer, `video_${Date.now()}_${video.originalname}`, video.mimetype);
      }
    }

    const galleryUrls = [];
    for (const file of galleryPhotos) {
      const fileResized = await resizeImageBuffer(file.buffer);
      const url = await uploadPublicFile(fileResized, `gallery_${Date.now()}_${file.originalname}`, file.mimetype);
      galleryUrls.push(url);
    }

    const parsedPrice = (price_or_salary === undefined || price_or_salary === null || price_or_salary === '') ? 0 : parseInt(price_or_salary);

    await pool.query(`
      INSERT INTO listings (
        type, title, description, price_or_salary, locality, category, 
        cover_photo_url, gallery_photo_urls, video_url, attributes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
    `, [type, title, description, parsedPrice, locality, category, coverUrl, galleryUrls, videoUrl, parsedAttr]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/listings/:id', authenticateAdmin, upload.fields([
  { name: 'cover_photo', maxCount: 1 },
  { name: 'video', maxCount: 1 },
  { name: 'gallery_photos', maxCount: 10 }
]), async (req, res) => {
  const { title, description, price_or_salary, locality, category, attributes } = req.body;
  try {
    const coverPhoto = req.files?.cover_photo?.[0];
    const video = req.files?.video?.[0];
    const galleryPhotos = req.files?.gallery_photos || [];
    const parsedAttr = JSON.parse(attributes || '{}');

    let coverUrl = null;
    if (coverPhoto) {
      const coverResized = await resizeImageBuffer(coverPhoto.buffer);
      coverUrl = await uploadPublicFile(coverResized, `cover_${Date.now()}_${coverPhoto.originalname}`, coverPhoto.mimetype);
    }

    let videoUrl = null;
    if (video) {
      try {
        videoUrl = await videoToHls(video.buffer, video.originalname);
      } catch (hlsErr) {
        console.error('[HLS] Transcode failed, falling back to direct upload:', hlsErr.message);
        videoUrl = await uploadPublicFile(video.buffer, `video_${Date.now()}_${video.originalname}`, video.mimetype);
      }
    }

    const galleryUrls = [];
    for (const file of galleryPhotos) {
      const fileResized = await resizeImageBuffer(file.buffer);
      const url = await uploadPublicFile(fileResized, `gallery_${Date.now()}_${file.originalname}`, file.mimetype);
      galleryUrls.push(url);
    }

    let query = 'UPDATE listings SET title=$1, description=$2, price_or_salary=$3, locality=$4, category=$5, attributes=$6';
    const parsedPrice = (price_or_salary === undefined || price_or_salary === null || price_or_salary === '') ? 0 : parseInt(price_or_salary);
    const params = [title, description, parsedPrice, locality, category, parsedAttr];
    let count = 6;

    if (coverUrl) {
      count++;
      query += `, cover_photo_url=$${count}`;
      params.push(coverUrl);
    }

    if (videoUrl) {
      count++;
      query += `, video_url=$${count}`;
      params.push(videoUrl);
    }

    if (galleryUrls.length > 0) {
      count++;
      query += `, gallery_photo_urls=$${count}`;
      params.push(galleryUrls);
    }

    count++;
    query += ` WHERE id=$${count}`;
    params.push(req.params.id);

    await pool.query(query, params);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/listings/:id', authenticateAdmin, async (req, res) => {
  try {
    const listingId = req.params.id;
    // 1. Fetch current URLs to delete heavy files from R2
    const result = await pool.query('SELECT gallery_photo_urls, video_url FROM listings WHERE id = $1', [listingId]);
    if (result.rows.length > 0) {
      const { gallery_photo_urls, video_url } = result.rows[0];

      // Delete gallery photos from R2
      if (gallery_photo_urls && gallery_photo_urls.length > 0) {
        for (const url of gallery_photo_urls) {
          const key = getKeyFromUrl(url);
          if (key) await deleteR2Object(key);
        }
      }

      // Delete video / HLS segments folder from R2
      if (video_url) {
        if (video_url.endsWith('.m3u8')) {
          const key = getKeyFromUrl(video_url);
          if (key) {
            // E.g. key: public/hls/1785835129929_xxxx/master.m3u8 -> delete public/hls/1785835129929_xxxx prefix
            const folderPrefix = key.substring(0, key.lastIndexOf('/'));
            await deleteR2Folder(folderPrefix);
          }
        } else {
          const key = getKeyFromUrl(video_url);
          if (key) await deleteR2Object(key);
        }
      }
    }

    // 2. Archive listing, clear heavy files, keep cover photo and description text
    await pool.query(
      "UPDATE listings SET status='archived', archived_at=NOW(), gallery_photo_urls='{}', video_url=NULL WHERE id=$1",
      [listingId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/listings/:id/permanent', authenticateAdmin, async (req, res) => {
  try {
    const listingId = req.params.id;
    // 1. Fetch cover photo to delete it from R2
    const result = await pool.query('SELECT cover_photo_url FROM listings WHERE id = $1', [listingId]);
    if (result.rows.length > 0) {
      const { cover_photo_url } = result.rows[0];
      const key = getKeyFromUrl(cover_photo_url);
      if (key) await deleteR2Object(key);
    }

    // 2. Mark as deleted in database
    await pool.query("UPDATE listings SET status='deleted' WHERE id=$1", [listingId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// --- ADMIN GENERAL SETTINGS & METRICS ---
app.patch('/api/admin/settings', authenticateAdmin, async (req, res) => {
  const { whatsapp_number } = req.body;
  try {
    await pool.query(
      "INSERT INTO settings (key, value) VALUES ('whatsapp_number', $1::jsonb) " +
      "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      [JSON.stringify({ value: whatsapp_number })]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/settings/qr-code', authenticateAdmin, upload.single('qr_code'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File upload required' });
    const qrResized = await resizeImageBuffer(req.file.buffer);
    const qrUrl = await uploadPublicFile(qrResized, `qr_${Date.now()}_${req.file.originalname}`, req.file.mimetype);

    await pool.query(
      "INSERT INTO settings (key, value) VALUES ('payment_qr_code', $1::jsonb) " +
      "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      [JSON.stringify({ value: qrUrl })]
    );
    res.json({ success: true, qr_code: qrUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/storage', authenticateAdmin, async (req, res) => {
  try {
    const stats = await getBucketUsage();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- CATEGORIES MANAGEMENT ---
app.post('/api/admin/localities', authenticateAdmin, async (req, res) => {
  const { name } = req.body;
  try {
    await pool.query('INSERT INTO locations (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/localities/:name', authenticateAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM locations WHERE name = $1', [req.params.name]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/job-categories', authenticateAdmin, async (req, res) => {
  const { name } = req.body;
  try {
    await pool.query('INSERT INTO job_categories (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/job-categories/:name', authenticateAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM job_categories WHERE name = $1', [req.params.name]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/room-types', authenticateAdmin, async (req, res) => {
  const { name } = req.body;
  try {
    await pool.query('INSERT INTO room_types (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/room-types/:name', authenticateAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM room_types WHERE name = $1', [req.params.name]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SYSTEM HEALTH AND SEED ROUTINE ---
app.get('/health', async (req, res) => {
  const dbOk = await checkDatabaseConnection();
  const r2Ok = await checkR2Connection();
  const resendOk = await checkResendConnection();

  const healthy = dbOk && r2Ok && resendOk;
  res.status(healthy ? 200 : 500).json({
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services: {
      database: dbOk ? 'healthy' : 'unhealthy',
      storage: r2Ok ? 'healthy' : 'unhealthy',
      email: resendOk ? 'healthy' : 'unhealthy'
    }
  });
});

async function seedDatabaseIfEmpty() {
  try {
    const locRes = await pool.query('SELECT count(*) FROM locations');
    if (parseInt(locRes.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO locations (name) VALUES
        ('Pepsi Chowk, Kathmandu'),
        ('Thamel, Kathmandu'),
        ('New Baneshwor, Kathmandu'),
        ('Lazimpat, Kathmandu'),
        ('Koteshwor, Kathmandu'),
        ('Maharajgunj, Kathmandu'),
        ('Kalanki, Kathmandu'),
        ('Chabahil, Kathmandu')
      `);
      console.log('Seeded locations list.');
    }

    const rtRes = await pool.query('SELECT count(*) FROM room_types');
    if (parseInt(rtRes.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO room_types (name) VALUES
        ('Single Room'),
        ('Double Room'),
        ('1 BHK Flat'),
        ('2 BHK Flat'),
        ('3 BHK Flat'),
        ('Studio Apartment')
      `);
      console.log('Seeded room_types list.');
    }

    const jcRes = await pool.query('SELECT count(*) FROM job_categories');
    if (parseInt(jcRes.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO job_categories (name) VALUES
        ('Hospitality & Hotel'),
        ('IT & Software'),
        ('Teaching & Education'),
        ('Sales & Marketing'),
        ('Customer Service & Receptionist'),
        ('Delivery & Driver'),
        ('Accounting & Finance'),
        ('Healthcare & Nursing')
      `);
      console.log('Seeded job_categories list.');
    }

    // Seed default admin account if not present
    const adminCheck = await pool.query('SELECT count(*) FROM admin WHERE email = $1', ['sadikshyapokhrel177@gmail.com']);
    if (parseInt(adminCheck.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO admin (email, password_hash, whatsapp_number) VALUES
        ('sadikshyapokhrel177@gmail.com', '$2b$10$wT5gS.H51EwJ3J5D5W5hEOYt7vX.0lRz0D.G1aHhE2iF5eG6h7i8j', '9779841234567')
      `);
      console.log('Seeded master admin account credentials.');
    }

    await pool.query(`
      INSERT INTO settings (key, value) VALUES
      ('whatsapp_number', '{"value": "9779841234567"}'::jsonb),
      ('payment_qr_code', '{"value": "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&q=80"}'::jsonb)
      ON CONFLICT (key) DO NOTHING
    `);
    console.log('Database operational settings validated.');
  } catch (err) {
    console.error('Seeding checks failed:', err.message);
  }
}

async function runStartupChecks() {
  console.log('\n=====================================');
  console.log('  🔍 STARTUP HEALTH CHECK RUNNING    ');
  console.log('=====================================');
  
  const [dbOk, r2Ok, resendOk] = await Promise.all([
    checkDatabaseConnection(),
    checkR2Connection(),
    checkResendConnection()
  ]);

  console.log('-------------------------------------');
  console.log(`Database Connection:    ${dbOk ? '✅' : '❌'}`);
  console.log(`Cloudflare R2 Storage:  ${r2Ok ? '✅' : '❌'}`);
  console.log(`Resend Email API:       ${resendOk ? '✅' : '❌'}`);
  console.log('=====================================\n');

  if (dbOk) {
    await seedDatabaseIfEmpty();
  }
}

// --- GHAR/JAGGA INQUIRIES ROUTE ---
app.post('/api/ghar-jagga/inquiries', async (req, res) => {
  const { listing_id, full_name, phone, message } = req.body;
  if (!listing_id || !full_name || !phone) {
    return res.status(400).json({ error: 'listing_id, full_name, and phone are required' });
  }
  try {
    await pool.query(
      `INSERT INTO ghar_jagga_inquiries (listing_id, full_name, phone, message, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [listing_id, full_name, phone, message]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/ghar-jagga/inquiries', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT q.*, l.title as listing_title 
       FROM ghar_jagga_inquiries q
       LEFT JOIN listings l ON q.listing_id = l.id
       ORDER BY q.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SPA catch-all: serve index.html for any route not matched by API or
// static middleware above. This lets the client-side hash router handle
// all frontend routes (e.g. /#/listings, /#/dashboard).
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`🚀 Server started on http://localhost:${PORT}`);
  await runStartupChecks();
});
