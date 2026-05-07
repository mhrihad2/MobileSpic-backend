const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@mobilespic.com";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

const allowedOrigins = (
  process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:3000"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "5mb" }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("supabase")
    ? { rejectUnauthorized: false }
    : undefined,
});

// ================= DATABASE INIT =================
async function initTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT DEFAULT '',
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'USER',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS brands (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      logo_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS phones (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
      price INTEGER NOT NULL DEFAULT 0,
      original_price INTEGER,
      image_url TEXT,
      images JSONB DEFAULT '[]'::jsonb,
      status TEXT DEFAULT 'official',
      type TEXT DEFAULT 'smartphone',
      specs JSONB DEFAULT '{}'::jsonb,
      rating NUMERIC DEFAULT 0,
      hits INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS articles (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'News',
      description TEXT DEFAULT '',
      content TEXT DEFAULT '',
      image_url TEXT,
      status TEXT DEFAULT 'published',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pages (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      content TEXT DEFAULT '',
      status TEXT DEFAULT 'published',
      show_in_footer BOOLEAN DEFAULT true,
      show_in_header BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS page_visits (
      page_id INTEGER PRIMARY KEY REFERENCES pages(id) ON DELETE CASCADE,
      visits INTEGER DEFAULT 0,
      last_visited TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ads (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      image_url TEXT,
      ad_code TEXT,
      link TEXT,
      position TEXT NOT NULL DEFAULT 'content',
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS filter_groups (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'tags',
      enabled BOOLEAN DEFAULT true,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS filter_options (
      id SERIAL PRIMARY KEY,
      filter_group_id INTEGER REFERENCES filter_groups(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT NOT NULL DEFAULT '#',
      location TEXT DEFAULT 'header',
      enabled BOOLEAN DEFAULT true,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS submenu_items (
      id SERIAL PRIMARY KEY,
      menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      url TEXT NOT NULL DEFAULT '#',
      enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS carousel_slides (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT DEFAULT '',
      image_url TEXT,
      link TEXT DEFAULT '#',
      color TEXT DEFAULT 'from-blue-600 to-blue-800',
      active BOOLEAN DEFAULT true,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ================= EXISTING TABLE COLUMN FIXES =================

  await pool.query(`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS username TEXT DEFAULT '';
  `);

  await pool.query(`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'USER';
  `);

  await pool.query(`
    ALTER TABLE brands 
    ADD COLUMN IF NOT EXISTS logo_url TEXT;
  `);

  await pool.query(`
    ALTER TABLE brands 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  `);

  await pool.query(`
    ALTER TABLE phones 
    ADD COLUMN IF NOT EXISTS original_price INTEGER;
  `);

  await pool.query(`
    ALTER TABLE phones 
    ADD COLUMN IF NOT EXISTS image_url TEXT;
  `);

  await pool.query(`
    ALTER TABLE phones 
    ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
  `);

  await pool.query(`
    ALTER TABLE phones 
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'official';
  `);

  await pool.query(`
    ALTER TABLE phones 
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'smartphone';
  `);

  await pool.query(`
    ALTER TABLE phones 
    ADD COLUMN IF NOT EXISTS specs JSONB DEFAULT '{}'::jsonb;
  `);

  await pool.query(`
    ALTER TABLE phones 
    ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 0;
  `);

  await pool.query(`
    ALTER TABLE phones 
    ADD COLUMN IF NOT EXISTS hits INTEGER DEFAULT 0;
  `);

  await pool.query(`
    ALTER TABLE phones 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  `);

  await pool.query(`
    ALTER TABLE articles 
    ADD COLUMN IF NOT EXISTS image_url TEXT;
  `);

  await pool.query(`
    ALTER TABLE articles 
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published';
  `);

  await pool.query(`
    ALTER TABLE articles 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  `);

  await pool.query(`
    ALTER TABLE pages 
    ADD COLUMN IF NOT EXISTS show_in_footer BOOLEAN DEFAULT true;
  `);

  await pool.query(`
    ALTER TABLE pages 
    ADD COLUMN IF NOT EXISTS show_in_header BOOLEAN DEFAULT false;
  `);

  await pool.query(`
    ALTER TABLE pages 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  `);

  await pool.query(`
    ALTER TABLE ads 
    ADD COLUMN IF NOT EXISTS image_url TEXT;
  `);

  await pool.query(`
    ALTER TABLE ads 
    ADD COLUMN IF NOT EXISTS ad_code TEXT;
  `);

  await pool.query(`
    ALTER TABLE ads 
    ADD COLUMN IF NOT EXISTS link TEXT;
  `);

  await pool.query(`
    ALTER TABLE ads 
    ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
  `);

  await pool.query(`
    ALTER TABLE ads 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  `);

  await pool.query(`
    ALTER TABLE filter_groups 
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'tags';
  `);

  await pool.query(`
    ALTER TABLE filter_groups 
    ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true;
  `);

  await pool.query(`
    ALTER TABLE filter_groups 
    ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
  `);

  await pool.query(`
    ALTER TABLE filter_groups 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  `);

  await pool.query(`
    ALTER TABLE menu_items 
    ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'header';
  `);

  await pool.query(`
    ALTER TABLE menu_items 
    ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true;
  `);

  await pool.query(`
    ALTER TABLE menu_items 
    ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
  `);

  await pool.query(`
    ALTER TABLE menu_items 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  `);

  await pool.query(`
    ALTER TABLE submenu_items 
    ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true;
  `);

  await pool.query(`
    ALTER TABLE carousel_slides 
    ADD COLUMN IF NOT EXISTS image_url TEXT;
  `);

  await pool.query(`
    ALTER TABLE carousel_slides 
    ADD COLUMN IF NOT EXISTS link TEXT DEFAULT '#';
  `);

  await pool.query(`
    ALTER TABLE carousel_slides 
    ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'from-blue-600 to-blue-800';
  `);

  await pool.query(`
    ALTER TABLE carousel_slides 
    ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
  `);

  await pool.query(`
    ALTER TABLE carousel_slides 
    ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
  `);

  await pool.query(`
    ALTER TABLE carousel_slides 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  `);

  // ================= ADMIN FIX (FIXED!) =================

  const admin = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [ADMIN_EMAIL]
  );

  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12);

  if (admin.rows.length === 0) {
    await pool.query(
      "INSERT INTO users (email, username, password, role) VALUES ($1, $2, $3, $4)",
      [ADMIN_EMAIL, ADMIN_USERNAME, hashed, "ADMIN"]
    );
    console.log(`Created admin user: ${ADMIN_EMAIL}`);
  } else {
    await pool.query(
      "UPDATE users SET password = $1, role = 'ADMIN', username = $2 WHERE email = $3",
      [hashed, ADMIN_USERNAME, ADMIN_EMAIL]
    );
    console.log(`Admin password reset done ✅`);
  }

  console.log("Database tables checked successfully ✅");
}

// ================= HELPERS =================

function toCamel(row) {
  if (!row) return row;
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      value,
    ])
  );
}

function mapId(row) {
  const item = toCamel(row);
  if (item.id !== undefined) item.id = String(item.id);
  return item;
}

function mapPhone(row) {
  const phone = toCamel(row);
  return {
    ...phone,
    id: String(phone.id),
    brandId: phone.brandId ? String(phone.brandId) : null,
    brand: row.brand_name
      ? {
          id: String(row.brand_id),
          name: row.brand_name,
          slug: row.brand_slug,
          logoUrl: row.brand_logo_url,
        }
      : undefined,
    imageUrl: phone.imageUrl || "",
    images: phone.images || [],
    originalPrice: phone.originalPrice || null,
    specs: phone.specs || {},
  };
}

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username || "",
      role: user.role,
      isAdmin: user.role === "ADMIN",
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "No token" });
  }
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function verifyAdmin(req, res, next) {
  if (!req.user?.isAdmin && req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Access denied. Not admin." });
  }
  next();
}

// ================= BASIC ROUTES =================

app.get("/", (req, res) => {
  res.send("Server OK 🚀");
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/test", async (req, res) => {
  const data = await pool.query("SELECT NOW()");
  res.json(data.rows);
});

// ================= AUTH =================

app.post("/register", async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    await pool.query(
      "INSERT INTO users (email, username, password, role) VALUES ($1, $2, $3, $4)",
      [email, username || "", hashedPassword, "USER"]
    );
    res.json({ message: "User registered securely ✅" });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "User already exists" });
    }
    console.error(err.message);
    res.status(500).json({ error: "Error saving user" });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }
  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1 OR username = $1",
      [email]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Wrong password" });
    }
    res.json({
      message: "Login successful ✅",
      token: signToken(user),
      isAdmin: user.role === "ADMIN",
      user: {
        id: user.id,
        email: user.email,
        username: user.username || "",
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Login error" });
  }
});

app.get("/profile", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, username, role, created_at FROM users WHERE id = $1",
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const user = result.rows[0];
    res.json({
      message: "Protected data accessed",
      user: {
        id: user.id,
        email: user.email,
        username: user.username || "",
        role: user.role,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Profile fetch error" });
  }
});

// ================= PROFILE UPDATE =================

app.put("/api/profile/update", verifyToken, async (req, res) => {
  const { email, username, newPassword, currentPassword } = req.body;

  try {
    const userResult = await pool.query(
      "SELECT * FROM users WHERE id = $1",
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const currentUser = userResult.rows[0];

    if (!currentPassword) {
      return res.status(400).json({ error: "Current password is required" });
    }

    const isMatch = await bcrypt.compare(currentPassword, currentUser.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is wrong" });
    }

    if (email && email !== currentUser.email) {
      const emailExists = await pool.query(
        "SELECT id FROM users WHERE email = $1 AND id != $2",
        [email, req.user.id]
      );
      if (emailExists.rows.length > 0) {
        return res.status(409).json({ error: "This email is already taken" });
      }
    }

    if (username && username !== currentUser.username) {
      const usernameExists = await pool.query(
        "SELECT id FROM users WHERE username = $1 AND id != $2",
        [username, req.user.id]
      );
      if (usernameExists.rows.length > 0) {
        return res.status(409).json({ error: "This username is already taken" });
      }
    }

    const updatedEmail = email || currentUser.email;
    const updatedUsername = username !== undefined ? username : currentUser.username || "";

    let updatedPassword = currentUser.password;
    if (newPassword && newPassword.trim() !== "") {
      updatedPassword = await bcrypt.hash(newPassword, 12);
    }

    const updated = await pool.query(
      `UPDATE users 
       SET email = $1, username = $2, password = $3 
       WHERE id = $4 
       RETURNING id, email, username, role, created_at`,
      [updatedEmail, updatedUsername, updatedPassword, req.user.id]
    );

    const updatedUser = updated.rows[0];
    const newToken = signToken(updatedUser);

    res.json({
      message: "Profile updated successfully ✅",
      token: newToken,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username || "",
        role: updatedUser.role,
      },
    });
  } catch (err) {
    console.error("Profile update error:", err.message);
    res.status(500).json({ error: "Profile update failed" });
  }
});

// ================= ADMIN PASSWORD RESET =================

app.put(
  "/api/admin/reset-password/:userId",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ error: "New password required" });
    }
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await pool.query("UPDATE users SET password = $1 WHERE id = $2", [
        hashedPassword,
        req.params.userId,
      ]);
      res.json({ message: "Password reset successfully ✅" });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ error: "Password reset failed" });
    }
  }
);

// ================= ADMIN USERS =================

app.get("/admin/users", verifyToken, verifyAdmin, async (req, res) => {
  const users = await pool.query(
    "SELECT id, email, username, role, created_at FROM users ORDER BY id DESC"
  );
  res.json(users.rows);
});

app.delete("/admin/user/:id", verifyToken, verifyAdmin, async (req, res) => {
  await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
  res.json({ message: "User deleted" });
});

// ================= PUBLIC BOOTSTRAP =================

app.get("/api/public/bootstrap", async (req, res) => {
  const [
    brands,
    phones,
    articles,
    pages,
    ads,
    filterGroups,
    filterOptions,
    menuItems,
    submenus,
    carouselSlides,
    visits,
  ] = await Promise.all([
    pool.query("SELECT * FROM brands ORDER BY name ASC"),
    pool.query(`
      SELECT phones.*, 
             brands.name AS brand_name, 
             brands.slug AS brand_slug, 
             brands.logo_url AS brand_logo_url
      FROM phones 
      LEFT JOIN brands ON brands.id = phones.brand_id
      ORDER BY phones.created_at DESC
    `),
    pool.query("SELECT * FROM articles WHERE status = 'published' ORDER BY created_at DESC"),
    pool.query("SELECT * FROM pages WHERE status = 'published' ORDER BY created_at DESC"),
    pool.query("SELECT * FROM ads WHERE active = true ORDER BY created_at DESC"),
    pool.query("SELECT * FROM filter_groups ORDER BY sort_order ASC, id ASC"),
    pool.query("SELECT * FROM filter_options ORDER BY id ASC"),
    pool.query("SELECT * FROM menu_items ORDER BY sort_order ASC, id ASC"),
    pool.query("SELECT * FROM submenu_items ORDER BY id ASC"),
    pool.query("SELECT * FROM carousel_slides WHERE active = true ORDER BY sort_order ASC, id ASC"),
    pool.query("SELECT * FROM page_visits"),
  ]);

  const optionsByGroup = filterOptions.rows.reduce((acc, row) => {
    const groupId = String(row.filter_group_id);
    acc[groupId] ||= [];
    acc[groupId].push({ id: String(row.id), label: row.label });
    return acc;
  }, {});

  const submenusByMenu = submenus.rows.reduce((acc, row) => {
    const menuId = String(row.menu_item_id);
    acc[menuId] ||= [];
    acc[menuId].push({ id: String(row.id), title: row.title, url: row.url, enabled: row.enabled });
    return acc;
  }, {});

  res.json({
    brands: brands.rows.map((row) => ({ id: String(row.id), name: row.name, slug: row.slug, logoUrl: row.logo_url || "" })),
    phones: phones.rows.map(mapPhone),
    articles: articles.rows.map((row) => ({ ...mapId(row), imageUrl: row.image_url || "" })),
    pages: pages.rows.map((row) => ({ ...mapId(row), showInFooter: row.show_in_footer, showInHeader: row.show_in_header })),
    ads: ads.rows.map((row) => ({ ...mapId(row), imageUrl: row.image_url || "", adCode: row.ad_code || "" })),
    filters: filterGroups.rows.map((row) => ({ id: String(row.id), name: row.name, type: row.type, enabled: row.enabled, order: row.sort_order, options: optionsByGroup[String(row.id)] || [] })),
    menuItems: menuItems.rows.map((row) => ({ id: String(row.id), title: row.title, url: row.url, location: row.location, enabled: row.enabled, order: row.sort_order, submenus: submenusByMenu[String(row.id)] || [] })),
    carouselSlides: carouselSlides.rows.map((row) => ({ id: String(row.id), title: row.title, subtitle: row.subtitle, imageUrl: row.image_url || "", link: row.link, color: row.color, active: row.active, order: row.sort_order })),
    pageVisits: visits.rows.map((row) => ({ pageId: String(row.page_id), visits: row.visits, lastVisited: row.last_visited })),
  });
});

// ================= BRANDS =================

app.get("/api/brands", async (req, res) => {
  const rows = await pool.query("SELECT * FROM brands ORDER BY name ASC");
  res.json(rows.rows.map((row) => ({ id: String(row.id), name: row.name, slug: row.slug, logoUrl: row.logo_url || "" })));
});

app.post("/api/brands", verifyToken, verifyAdmin, async (req, res) => {
  const { name, slug, logoUrl } = req.body;
  const created = await pool.query("INSERT INTO brands (name, slug, logo_url) VALUES ($1, $2, $3) RETURNING *", [name, slug, logoUrl || null]);
  res.json(mapId(created.rows[0]));
});

app.put("/api/brands/:id", verifyToken, verifyAdmin, async (req, res) => {
  const { name, slug, logoUrl } = req.body;
  const updated = await pool.query("UPDATE brands SET name=$1, slug=$2, logo_url=$3, updated_at=NOW() WHERE id=$4 RETURNING *", [name, slug, logoUrl || null, req.params.id]);
  res.json(mapId(updated.rows[0]));
});

app.delete("/api/brands/:id", verifyToken, verifyAdmin, async (req, res) => {
  await pool.query("DELETE FROM brands WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

// ================= PHONES =================

app.get("/api/phones", async (req, res) => {
  const rows = await pool.query(`
    SELECT phones.*, brands.name AS brand_name, brands.slug AS brand_slug, brands.logo_url AS brand_logo_url
    FROM phones LEFT JOIN brands ON brands.id = phones.brand_id
    ORDER BY phones.created_at DESC
  `);
  res.json(rows.rows.map(mapPhone));
});

app.post("/api/phones", verifyToken, verifyAdmin, async (req, res) => {
  const { name, brandId, price, originalPrice, imageUrl, images, status, type, specs, rating } = req.body;
  const created = await pool.query(
    `INSERT INTO phones (name, brand_id, price, original_price, image_url, images, status, type, specs, rating) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [name, brandId || null, price || 0, originalPrice || null, imageUrl || null, images || [], status || "official", type || "smartphone", specs || {}, rating || 0]
  );
  res.json(mapPhone(created.rows[0]));
});

app.put("/api/phones/:id", verifyToken, verifyAdmin, async (req, res) => {
  const { name, brandId, price, originalPrice, imageUrl, images, status, type, specs, rating } = req.body;
  const updated = await pool.query(
    `UPDATE phones SET name=$1, brand_id=$2, price=$3, original_price=$4, image_url=$5, images=$6, status=$7, type=$8, specs=$9, rating=$10, updated_at=NOW() WHERE id=$11 RETURNING *`,
    [name, brandId || null, price || 0, originalPrice || null, imageUrl || null, images || [], status || "official", type || "smartphone", specs || {}, rating || 0, req.params.id]
  );
  res.json(mapPhone(updated.rows[0]));
});

app.delete("/api/phones/:id", verifyToken, verifyAdmin, async (req, res) => {
  await pool.query("DELETE FROM phones WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

// ================= SIMPLE CRUD HELPER =================

function simpleCrud(path, table, columns) {
  app.get(`/api/${path}`, async (req, res) => {
    const rows = await pool.query(`SELECT * FROM ${table} ORDER BY created_at DESC`);
    res.json(rows.rows.map(mapId));
  });

  app.post(`/api/${path}`, verifyToken, verifyAdmin, async (req, res) => {
    const values = columns.map((col) => req.body[col.camel] ?? col.default ?? null);
    const names = columns.map((col) => col.db).join(", ");
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    const created = await pool.query(`INSERT INTO ${table} (${names}) VALUES (${placeholders}) RETURNING *`, values);
    res.json(mapId(created.rows[0]));
  });

  app.put(`/api/${path}/:id`, verifyToken, verifyAdmin, async (req, res) => {
    const values = columns.map((col) => req.body[col.camel] ?? col.default ?? null);
    const setSql = columns.map((col, index) => `${col.db}=$${index + 1}`).join(", ");
    const updated = await pool.query(`UPDATE ${table} SET ${setSql}, updated_at=NOW() WHERE id=$${columns.length + 1} RETURNING *`, [...values, req.params.id]);
    res.json(mapId(updated.rows[0]));
  });

  app.delete(`/api/${path}/:id`, verifyToken, verifyAdmin, async (req, res) => {
    await pool.query(`DELETE FROM ${table} WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  });
}

// ================= ARTICLES =================

simpleCrud("articles", "articles", [
  { camel: "title", db: "title" },
  { camel: "category", db: "category", default: "News" },
  { camel: "description", db: "description", default: "" },
  { camel: "content", db: "content", default: "" },
  { camel: "imageUrl", db: "image_url" },
  { camel: "status", db: "status", default: "published" },
]);

// ================= PAGES =================

simpleCrud("pages", "pages", [
  { camel: "title", db: "title" },
  { camel: "slug", db: "slug" },
  { camel: "content", db: "content", default: "" },
  { camel: "status", db: "status", default: "published" },
  { camel: "showInFooter", db: "show_in_footer", default: true },
  { camel: "showInHeader", db: "show_in_header", default: false },
]);

// ================= ADS =================

simpleCrud("ads", "ads", [
  { camel: "title", db: "title" },
  { camel: "imageUrl", db: "image_url" },
  { camel: "adCode", db: "ad_code" },
  { camel: "link", db: "link" },
  { camel: "position", db: "position", default: "content" },
  { camel: "active", db: "active", default: true },
]);

// ================= CAROUSEL =================

simpleCrud("carousel", "carousel_slides", [
  { camel: "title", db: "title" },
  { camel: "subtitle", db: "subtitle", default: "" },
  { camel: "imageUrl", db: "image_url" },
  { camel: "link", db: "link", default: "#" },
  { camel: "color", db: "color", default: "from-blue-600 to-blue-800" },
  { camel: "active", db: "active", default: true },
  { camel: "order", db: "sort_order", default: 0 },
]);

// ================= FILTERS =================

app.get("/api/filters", async (req, res) => {
  const groups = await pool.query("SELECT * FROM filter_groups ORDER BY sort_order ASC, id ASC");
  const options = await pool.query("SELECT * FROM filter_options ORDER BY id ASC");
  res.json(groups.rows.map((group) => ({
    id: String(group.id), name: group.name, type: group.type, enabled: group.enabled,
    options: options.rows.filter((option) => option.filter_group_id === group.id).map((option) => ({ id: String(option.id), label: option.label })),
  })));
});

app.post("/api/filters", verifyToken, verifyAdmin, async (req, res) => {
  const { name, type = "tags", enabled = true, options = [] } = req.body;
  const group = await pool.query("INSERT INTO filter_groups (name, type, enabled) VALUES ($1,$2,$3) RETURNING *", [name, type, enabled]);
  for (const option of options) {
    await pool.query("INSERT INTO filter_options (filter_group_id, label) VALUES ($1,$2)", [group.rows[0].id, option.label || option]);
  }
  res.json(mapId(group.rows[0]));
});

app.put("/api/filters/:id", verifyToken, verifyAdmin, async (req, res) => {
  const { name, type = "tags", enabled = true, options = [] } = req.body;
  const group = await pool.query("UPDATE filter_groups SET name=$1, type=$2, enabled=$3, updated_at=NOW() WHERE id=$4 RETURNING *", [name, type, enabled, req.params.id]);
  await pool.query("DELETE FROM filter_options WHERE filter_group_id=$1", [req.params.id]);
  for (const option of options) {
    await pool.query("INSERT INTO filter_options (filter_group_id, label) VALUES ($1,$2)", [req.params.id, option.label || option]);
  }
  res.json(mapId(group.rows[0]));
});

app.delete("/api/filters/:id", verifyToken, verifyAdmin, async (req, res) => {
  await pool.query("DELETE FROM filter_groups WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

// ================= VISITS =================

app.post("/api/visits/:pageId", async (req, res) => {
  const visit = await pool.query(
    `INSERT INTO page_visits (page_id, visits, last_visited) VALUES ($1, 1, NOW()) ON CONFLICT (page_id) DO UPDATE SET visits = page_visits.visits + 1, last_visited = NOW() RETURNING *`,
    [req.params.pageId]
  );
  res.json(toCamel(visit.rows[0]));
});

// ================= START SERVER =================

initTables()
  .then(() =>
    app.listen(PORT, () => {
      console.log(`MobileSpic backend running on port ${PORT}`);
    })
  )
  .catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });