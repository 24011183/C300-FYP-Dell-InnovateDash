// backend server setup - Alicia
const mysql = require("mysql2");
const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const app = express();
const PORT = 3000;

// Gemini AI Setup - WT
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

//Database Connection & Table Initialization -Alicia
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "Password123!",
  database: process.env.DB_NAME || "dell_nfc_system",
  connectTimeout: 10000
};

let db;

const handleDisconnect = () => {
  db = mysql.createConnection(dbConfig);

  db.connect((err) => {
    if (err) {
      console.error("❌ Database connection failed:", err.message);
    } else {
      console.log("✅ Connected to MySQL successfully (Target: attendees table).");
      // Auto-create table if it doesn't exist
      const createTable = `
        CREATE TABLE IF NOT EXISTS attendees (
          id INT AUTO_INCREMENT PRIMARY KEY,
          token VARCHAR(255) NOT NULL UNIQUE,
          name VARCHAR(255) NOT NULL,
          company VARCHAR(255) NOT NULL,
          companySize INT NOT NULL,
          jobTitle VARCHAR(255) NOT NULL,
          email VARCHAR(255) DEFAULT '',
          phone VARCHAR(50) DEFAULT '',
          interest TEXT NOT NULL,
          currentChallenge TEXT,
          pdpaConsent TINYINT(1) DEFAULT 0,
          assigned_team VARCHAR(100) DEFAULT 'Client Solutions Group (CSG)',
          action_recommendation TEXT,
          routing_status VARCHAR(50) DEFAULT 'ROUTED_AUTOMATICALLY',
          followup_note TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_assigned_team (assigned_team),
          INDEX idx_token (token)
        )
      `;
      db.query(createTable, (err) => {
        if (err) console.error("❌ Table creation error:", err.message);
        else console.log("✅ Attendees table ready.");
      });
    }
  });

  db.on("error", (err) => {
    console.log("⚠️ Database error occurred:", err.code);
    if (err.code === "PROTOCOL_CONNECTION_LOST") {
      console.log("🔄 Connection lost — reconnecting...");
      handleDisconnect();
    } else {
      console.error("⚠️ Database error:", err.code);
    }
  });
};

handleDisconnect();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ── TEAM ROUTING — maps interest area to Dell team ─ Alicia
const getTeamRoute = (interest) => {
  const teamRoutes = {
    "AI PCs": "Client Solutions Group (CSG)",
    "Storage": "Infrastructure Solutions Group (ISG)",
    "Cloud": "APEX & Cloud Services",
    "Consultancy": "Professional Services"
  };
  return teamRoutes[interest] || "Client Solutions Group (CSG)";
};

// ── AI-POWERED RECOMMENDATION ENGINE ── - WT
const analyzeLead = async (attendee) => {

  // Step 1: Rule-based routing — assign Dell team based on interest
  const assigned_team = getTeamRoute(attendee.interest);

  // Step 2: Determine company size tier for smarter recommendations
  let companyTier = "small business";
  if (attendee.companySize >= 1000) companyTier = "large enterprise";
  else if (attendee.companySize >= 200) companyTier = "mid-market company";

  // Step 3: Build Gemini prompt
  const challengeLine = attendee.currentChallenge
    ? `- Current Challenge: ${attendee.currentChallenge}`
    : "";

  const prompt = `
You are a Dell Technologies sales assistant helping route event leads at the Dell Technologies Forum Singapore.

A potential customer just registered at a Dell booth.

Their profile:
- Name: ${attendee.name}
- Company: ${attendee.company} (${companyTier}, ${attendee.companySize} employees)
- Job Title: ${attendee.jobTitle}
- Interest Area: ${attendee.interest}
- Assigned Dell Team: ${assigned_team}
${challengeLine}

Dell product context by interest area:
- AI PCs: Dell Latitude series with Intel Core Ultra, Dell Optimizer AI software, Dell Precision workstations
- Storage: Dell PowerStore, Dell PowerFlex, Dell ObjectScale for unstructured data
- Cloud: Dell APEX as-a-service portfolio, Dell APEX Cloud Platforms, multicloud solutions
- Consultancy: Dell ProDeploy Plus, Dell ProSupport Enterprise Suite, Dell Residency Services

Based on this profile, give ONE specific and actionable follow-up recommendation
that the ${assigned_team} team should take within 48 hours after the event.

Rules:
- Reference specific Dell products or services relevant to their interest area
- Be specific to their job title and company size
- If a current challenge is provided, address it directly in the recommendation
- Recommend a real action (e.g. book a call, send a specific resource, invite to a specific event)
- Consider that a ${companyTier} with a ${attendee.jobTitle} has different priorities than others
- Do NOT use vague responses like "send newsletter" or "track email"
- Do NOT include scores or labels like hot/warm/cold
- Return only the recommendation as a single sentence. No extra explanation.
`;

  try {
    // Step 4: Call Gemini 2.5 Flash
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const recommendation = result.response.text().trim();

    console.log(`🤖 Gemini recommendation for ${attendee.name}: ${recommendation}`);
    console.log(`📨 Lead routed to: ${assigned_team}`);

    return {
      ...attendee,
      assigned_team,
      action_recommendation: recommendation,
      processed_at: new Date().toLocaleString()
    };

  } catch (err) {
    console.error("❌ Gemini API error:", err.message);

    // Fallback if Gemini fails
    const fallbackActions = {
      "AI PCs": `Schedule a Dell Latitude AI PC demo session for ${attendee.name} from ${attendee.company}, showcasing Dell Optimizer and Intel Core Ultra capabilities for their ${companyTier} workforce.`,
      "Storage": `Arrange a Dell PowerStore technical briefing for ${attendee.name} from ${attendee.company} to assess their current storage infrastructure and present a migration roadmap.`,
      "Cloud": `Invite ${attendee.name} from ${attendee.company} to a Dell APEX as-a-service workshop to explore multicloud deployment options suited for a ${companyTier}.`,
      "Consultancy": `Schedule a Dell ProDeploy Plus scoping call with ${attendee.name} from ${attendee.company} to outline a deployment and ProSupport Enterprise Suite plan.`
    };

    return {
      ...attendee,
      assigned_team,
      action_recommendation: fallbackActions[attendee.interest] || `Follow up with ${attendee.name} regarding ${attendee.interest} solutions.`,
      processed_at: new Date().toLocaleString()
    };
  }
};

// ── ROUTES ──

// Home — Attendee registration page
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/attendee.html");
});

// Rep dashboard — all leads
app.get("/dashboard", (req, res) => {
  res.sendFile(__dirname + "/dashboard.html");
});

// Dell team view — each team sees only their own leads


// Registration & Database Processing - Alicia
app.post("/register", async (req, res) => {
  // ── INPUT VALIDATION ──
  const name    = (req.body.name    || "").trim();
  const company = (req.body.company || "").trim();
  const interest = (req.body.interest || "").trim();
  const email   = (req.body.email   || "").trim();

  if (!name || !company || !interest) {
    return res.status(400).json({ message: "Name, company and interest area are required." });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "Please enter a valid email address." });
  }
  const pdpaConsent = req.body.pdpaConsent === "true" || req.body.pdpaConsent === true;
  if (!pdpaConsent) {
    return res.status(400).json({ message: "PDPA consent is required before registration can proceed." });
  }

  // ── DUPLICATE PREVENTION (MySQL) ─ Alicia
  // Duplicate = same person expressing the same interest at the same booth.
  // Same person at two different booths = two valid leads (different Dell teams).
  if (email) {
    const dupCheck = await new Promise((resolve) => {
      db.query(
        "SELECT token, name FROM attendees WHERE email = ? AND interest = ? LIMIT 1",
        [email, interest],
        (err, rows) => { resolve(err ? null : rows); }
      );
    });
    if (dupCheck && dupCheck.length > 0) {
      const existing = dupCheck[0];
      console.log(`🔁 Duplicate lead skipped for ${email} + ${interest}`);
      return res.json({
        message: `${existing.name} has already been registered for ${interest}. Skipped duplicate.`,
        duplicate: true,
        lead: existing
      });
    }
  }

  const rawAttendee = {
    id: "USR" + Date.now(),
    name,
    company,
    companySize: parseInt(req.body.companySize) || 0,
    jobTitle: (req.body.jobTitle || "").trim(),
    email,
    phone: (req.body.phone || "").trim(),
    interest,
    currentChallenge: (req.body.currentChallenge || "").trim(),
    pdpaConsent: true,
    assigned_team: getTeamRoute(interest),
    action_recommendation: "Processing...",
    processed_at: new Date().toLocaleString()
  };

  // ── INSERT TO MySQL ─ Alicia
  const query = `
    INSERT INTO attendees
    (token, name, company, companySize, jobTitle, email, phone, interest, currentChallenge, pdpaConsent, assigned_team, action_recommendation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    rawAttendee.id, rawAttendee.name, rawAttendee.company,
    rawAttendee.companySize, rawAttendee.jobTitle, rawAttendee.email,
    rawAttendee.phone, rawAttendee.interest, rawAttendee.currentChallenge,
    1, rawAttendee.assigned_team, rawAttendee.action_recommendation
  ];

  db.query(query, values, (err) => {
    if (err) {
      console.error("❌ MySQL Insert Failed:", err.message);
      // If DB is down, tell the client — their localStorage queue will retry
      return res.status(503).json({ message: "Database unavailable — please retry when connectivity is restored." });
    }
    console.log(`✅ Lead saved to MySQL: ${rawAttendee.name}`);
    // Respond immediately — don't wait for Gemini
    res.json({ message: "Registration successful!", lead: rawAttendee });
    // Enrich in background after response is sent
    enrichLeadWithAI(rawAttendee);
  });
});



// ── BACKGROUND AI ENRICHMENT ─ WT
const enrichLeadWithAI = async (attendee) => {
  try {
    const enriched = await analyzeLead(attendee);
    db.query(
      "UPDATE attendees SET action_recommendation = ? WHERE token = ?",
      [enriched.action_recommendation, attendee.id],
      (err) => {
        if (err) console.error("❌ AI enrichment MySQL update failed:", err.message);
        else console.log(`✅ AI recommendation updated for ${attendee.name}`);
      }
    );
  } catch (err) {
    console.error("❌ Background AI enrichment failed:", err.message);
  }
};

// ── LIGHTWEIGHT API GATE ── WT
// If API_KEY is set in the environment, the /api/leads* endpoints
// endpoints require a matching x-api-key header (or ?key=). If API_KEY is NOT
// set, the gate is open so nothing breaks by default.
// Note: this is demonstration-grade. Production would use proper auth
// (JWT/OAuth) with secrets kept server-side, not a shared key.
const requireApiKey = (req, res, next) => {
  const configured = process.env.API_KEY;
  if (!configured) return next(); // gate disabled
  const provided = req.header("x-api-key") || req.query.key;
  if (provided && provided === configured) return next();
  return res.status(401).json({ message: "Unauthorized: missing or invalid API key." });
};

// ── DASHBOARD API — all leads ── WT
app.get("/api/leads", requireApiKey, (req, res) => {
  db.query("SELECT * FROM attendees ORDER BY created_at DESC", (err, results) => {
    if (err) {
      console.error("❌ /api/leads MySQL error:", err.message);
      return res.status(503).json({ error: "Database unavailable. Please try again shortly." });
    }
    console.log(`📊 Dashboard loaded ${results.length} leads from MySQL.`);
    res.json(results);
  });
});

// ── TEAM API — filtered leads by assigned team ── WT
app.get("/api/leads/team/:teamName", requireApiKey, (req, res) => {
  const teamName = decodeURIComponent(req.params.teamName);
  db.query(
    "SELECT * FROM attendees WHERE assigned_team = ? ORDER BY created_at DESC",
    [teamName],
    (err, results) => {
      if (err) {
        console.error("❌ /api/leads/team MySQL error:", err.message);
        return res.status(503).json({ error: "Database unavailable. Please try again shortly." });
      }
      console.log(`📨 Team '${teamName}' loaded ${results.length} leads.`);
      res.json(results);
    }
  );
});

// ── LEAD PRIORITISATION (transparent, rule-based — no AI in the maths) ── WT
// Every point here is auditable. We keep AI for language (recommendations),
// and keep scoring deterministic so it can be defended in Q&A.
const computeLeadScore = (attendee) => {
  let score = 0;
  const breakdown = {};

  // ── FACTOR 1: Company size (50 pts max) ──
  // Larger organisations represent larger potential deal value for Dell.
  // Thresholds align with Dell's own SMB / mid-market / enterprise segmentation.
  const size = parseInt(attendee.companySize) || 0;
  let sizePts = 0;
  if      (size >= 1000) sizePts = 50;  // Enterprise
  else if (size >= 200)  sizePts = 30;  // Mid-market
  else if (size >= 50)   sizePts = 15;  // Small business
  else                   sizePts = 5;   // Micro / startup
  breakdown.companySize = sizePts;
  score += sizePts;

  // ── FACTOR 2: Job title seniority (30 pts max) ──
  // Decision-maker titles mean the lead can approve a purchase directly.
  // Uses keyword matching on free-text field — no enumeration needed.
  const title = (attendee.jobTitle || "").toLowerCase();
  let titlePts = 0;
  if (/ceo|cto|cio|cfo|president|owner|founder|managing director|md/.test(title)) {
    titlePts = 30;   // C-suite / owner — final decision maker
  } else if (/vp|vice president|director|head of|chief/.test(title)) {
    titlePts = 20;   // Senior influencer — strong input on purchase
  } else if (/manager|lead|senior|principal|architect/.test(title)) {
    titlePts = 10;   // Mid-level — evaluator, not final approver
  }
  breakdown.jobTitle = titlePts;
  score += titlePts;

  // ── FACTOR 3: Current challenge captured (20 pts) ──
  // If a rep took the time to note the attendee's challenge, it means a real
  // conversation happened — that is a warmer lead than a badge scan alone.
  const challengePts = (attendee.currentChallenge && attendee.currentChallenge.trim()) ? 20 : 0;
  breakdown.currentChallenge = challengePts;
  score += challengePts;

  score = Math.min(score, 100);

  // Priority thresholds — calibrated so a mid-market Director with a challenge
  // recorded hits HOT, while a micro-business with no context stays COLD.
  let priority = "COLD";
  if      (score >= 60) priority = "HOT";
  else if (score >= 35) priority = "WARM";

  return { lead_score: score, priority, score_breakdown: breakdown };
};





// ── CSV EXPORT — replaces the agency's post-event consolidated list ──
// Converts rows to safe CSV (quotes, commas, newlines escaped) and serves
// it as a download. Optional ?team= query param filters to one team.
// and API gate as the other data routes.
const toCsv = (rows) => {
  const cols = ["name", "company", "companySize", "jobTitle", "email",
                "phone", "interest", "currentChallenge", "pdpaConsent",
                "assigned_team", "lead_score", "priority",
                "routing_status", "followup_note",
                "action_recommendation", "processed_at"];
  const esc = (v) => {
    const s = String(v == null ? "" : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const header = cols.join(",");
  const body = rows.map(r => {
    const scored = { ...r, ...computeLeadScore(r) };
    return cols.map(c => esc(scored[c])).join(",");
  }).join("\n");
  return header + "\n" + body;
};

app.get("/api/export", requireApiKey, (req, res) => {
  const team = req.query.team ? decodeURIComponent(req.query.team) : null;
  db.query("SELECT * FROM attendees ORDER BY created_at DESC", (err, results) => {
    if (err) {
      console.error("❌ Export MySQL error:", err.message);
      return res.status(503).json({ error: "Database unavailable." });
    }
    const rows = team ? results.filter(r => r.assigned_team === team) : results;
    const csv = toCsv(rows);
    const stamp = new Date().toISOString().slice(0, 10);
    const fname = team
      ? `dell-leads-${team.replace(/[^a-z0-9]/gi, "_")}-${stamp}.csv`
      : `dell-leads-all-${stamp}.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    console.log(`⬇️  Exported ${rows.length} leads as CSV.`);
    res.send(csv);
  });
});

// ── LEAD LIFECYCLE UPDATE — rep can update status/notes after the event ──
app.patch("/api/leads/:id", requireApiKey, (req, res) => {
  const token = req.params.id;
  const allowed = ["routing_status", "action_recommendation", "followup_note"];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: "No valid fields to update." });
  }

  // Update MySQL
  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(", ");
  const vals = [...Object.values(updates), token];
  db.query(`UPDATE attendees SET ${setClauses} WHERE token = ?`, vals, (err) => {
    if (err) {
      console.error("❌ MySQL lifecycle update failed:", err.message);
      return res.status(503).json({ message: "Database update failed." });
    }
    console.log(`✅ Lead ${token} updated: ${JSON.stringify(updates)}`);
    res.json({ message: "Lead updated.", token, updates });
  });
});

// ── FOLLOW-UP LOG — record that a follow-up action was taken ──
app.post("/api/leads/:id/followup", requireApiKey, (req, res) => {
  const token = req.params.id;
  const { action_taken, notes, rep_name } = req.body;

  if (!action_taken) {
    return res.status(400).json({ message: "action_taken is required." });
  }

  const logEntry = {
    token,
    action_taken,
    notes: notes || "",
    rep_name: rep_name || "Unknown",
    logged_at: new Date().toLocaleString()
  };

  console.log(`📝 Follow-up logged for lead ${token}:`, logEntry);

  // Update MySQL
  const note = `[${logEntry.logged_at}] ${action_taken} by ${rep_name || "Unknown"}. ${notes || ""}`;
  db.query(
    "UPDATE attendees SET followup_note = ?, routing_status = 'FOLLOWED_UP' WHERE token = ?",
    [note, token],
    (err) => {
      if (err) {
        console.error("❌ MySQL follow-up update failed:", err.message);
        return res.status(503).json({ message: "Database update failed." });
      }
      res.json({ message: "Follow-up logged successfully.", log: logEntry });
    }
  );
});

// ── DELIVERY WEBHOOK — future CRM/Salesforce integration endpoint ──
// Receives outbound delivery confirmations from downstream systems.
// Verifies HMAC signature (if WEBHOOK_SECRET is set) for security.
app.post("/api/webhook/delivery", (req, res) => {
  const secret = process.env.WEBHOOK_SECRET;

  if (secret) {
    const crypto = require("crypto");
    const sig = req.header("x-webhook-signature") || "";
    const expected = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(req.body))
      .digest("hex");
    if (sig !== expected) {
      console.warn("⚠️ Webhook signature mismatch — rejected.");
      return res.status(401).json({ message: "Invalid webhook signature." });
    }
  }

  const { event, lead_id, crm_id, status, timestamp } = req.body;
  console.log(`🔔 Webhook received: event=${event}, lead=${lead_id}, status=${status}`);

  if (lead_id && status) {
    const note = `CRM delivery: ${event || "update"} → ${status} at ${timestamp || new Date().toISOString()}`;
    if (crm_id) {
      db.query(
        "UPDATE attendees SET routing_status = ?, followup_note = ? WHERE token = ?",
        [status, note, lead_id],
        (err) => {
          if (err) console.error("❌ Webhook MySQL update failed:", err.message);
          else console.log(`✅ Webhook updated lead ${lead_id} to status ${status}`);
        }
      );

    }
  }

  res.json({ message: "Webhook received.", received: req.body });
});

// ── HEALTH CHECK — for Docker healthcheck and cloud-native monitoring ── Alicia
app.get("/api/health", (req, res) => {
  db.query("SELECT 1", (err) => {
    if (err) {
      return res.status(503).json({
        status: "degraded",
        db: "unreachable",
        message: err.message
      });
    }
    res.json({ status: "ok", db: "connected", timestamp: new Date().toISOString() });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📋 Attendee registration: http://localhost:${PORT}/`);
  console.log(`📊 Rep dashboard:         http://localhost:${PORT}/dashboard`);

});