const mysql = require("mysql2");
const express = require("express");
const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const app = express();
const PORT = 3000;

// Gemini AI Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Database Connection
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "Password123!",
  database: process.env.DB_NAME || "dell_nfc_system",
  connectTimeout: 1000,
  timeout: 800
};

let db = mysql.createConnection(dbConfig);

const handleDisconnect = () => {
  db.connect((err) => {
    if (err) {
      console.log("❌ Database connection failed. Running on JSON fallback mode.");
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
          assigned_team VARCHAR(100) DEFAULT 'General Sales Hub',
          action_recommendation TEXT,
          routing_status VARCHAR(50) DEFAULT 'ROUTED_AUTOMATICALLY',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_assigned_team (assigned_team)
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
    if (err.code === "PROTOCOL_CONNECTION_LOST" || err.code === "ECONNREFUSED") {
      console.log("🔄 Re-instantiating fallback connection settings...");
      db = mysql.createConnection(dbConfig);
    }
  });
};

handleDisconnect();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ── JSON FALLBACK HELPERS ──
const getAttendees = () => {
  try {
    if (!fs.existsSync("attendees.json")) {
      fs.writeFileSync("attendees.json", JSON.stringify([], null, 2));
      return [];
    }
    const data = fs.readFileSync("attendees.json");
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
};

const saveAttendees = (data) => {
  fs.writeFileSync("attendees.json", JSON.stringify(data, null, 2));
};

// ── MEMBER 4: AI-POWERED ROUTING & RECOMMENDATION ENGINE ──
const analyzeLead = async (attendee) => {

  // Step 1: Rule-based routing — assign Dell team based on interest
  const teamRoutes = {
    "AI PCs": "Client Solutions Group (CSG)",
    "Storage": "Infrastructure Solutions Group (ISG)",
    "Cloud": "APEX & Cloud Services",
    "Consultancy": "Professional Services"
  };

  const assigned_team = teamRoutes[attendee.interest] || "General Sales";

  // Step 2: Determine company size tier for smarter recommendations
  let companyTier = "small business";
  if (attendee.companySize >= 1000) companyTier = "large enterprise";
  else if (attendee.companySize >= 200) companyTier = "mid-market company";

  // Step 3: Build Gemini prompt
  const prompt = `
You are a Dell Technologies sales assistant helping route event leads at the Dell Technologies Forum Singapore.

A potential customer just registered at a Dell booth.

Their profile:
- Name: ${attendee.name}
- Company: ${attendee.company} (${companyTier}, ${attendee.companySize} employees)
- Job Title: ${attendee.jobTitle}
- Interest Area: ${attendee.interest}
- Assigned Dell Team: ${assigned_team}

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
- Recommend a real action (e.g. book a call, send a specific resource, invite to a specific event)
- Consider that a ${companyTier} with a ${attendee.jobTitle} has different priorities than others
- Do NOT use vague responses like "send newsletter" or "track email"
- Do NOT include scores or labels like hot/warm/cold
- Return only the recommendation as a single sentence. No extra explanation.
`;

  try {
    // Step 4: Call Gemini 3.5 Flash
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
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

// Fiona's rep dashboard
app.get("/dashboard", (req, res) => {
  res.sendFile(__dirname + "/dashboard.html");
});

// Dell team view — each team sees only their own leads
app.get("/team", (req, res) => {
  res.sendFile(__dirname + "/team-dashboard.html");
});

// ── REGISTRATION ENDPOINT ──
app.post("/register", async (req, res) => {
  const attendees = getAttendees();

  const rawAttendee = {
    id: "USR" + Date.now(),
    name: req.body.name,
    company: req.body.company,
    companySize: parseInt(req.body.companySize) || 0,
    jobTitle: req.body.jobTitle || "",
    email: req.body.email || "",
    phone: req.body.phone || "",
    interest: req.body.interest,
    assigned_team: getTeamRoute(req.body.interest),
    action_recommendation: "Processing...",
    processed_at: new Date().toLocaleString()
  };

  // Save to JSON immediately
  attendees.push(rawAttendee);
  saveAttendees(attendees);
  console.log(`💾 Saved ${rawAttendee.name} to local JSON file.`);

  // Insert to MySQL immediately
  const query = `
    INSERT INTO attendees 
    (token, name, company, companySize, jobTitle, email, phone, interest, assigned_team, action_recommendation) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    rawAttendee.id,
    rawAttendee.name,
    rawAttendee.company,
    rawAttendee.companySize,
    rawAttendee.jobTitle,
    rawAttendee.email,
    rawAttendee.phone,
    rawAttendee.interest,
    rawAttendee.assigned_team,
    rawAttendee.action_recommendation
  ];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error("❌ MySQL Insert Failed:", err.message);
    } else {
      console.log("✅ Successfully synced lead to MySQL table!");
    }
  });

  // Respond immediately — don't wait for Gemini
  res.json({ message: "Registration successful!", lead: rawAttendee });

  // Call Gemini in background and update the recommendation after
  enrichLeadWithAI(rawAttendee);
});

// ── HELPER: Get team route without Gemini ──
const getTeamRoute = (interest) => {
  const teamRoutes = {
    "AI PCs": "Client Solutions Group (CSG)",
    "Storage": "Infrastructure Solutions Group (ISG)",
    "Cloud": "APEX & Cloud Services",
    "Consultancy": "Professional Services"
  };
  return teamRoutes[interest] || "General Sales";
};

// ── BACKGROUND AI ENRICHMENT ──
const enrichLeadWithAI = async (attendee) => {
  try {
    const enriched = await analyzeLead(attendee);

    // Update JSON
    const attendees = getAttendees();
    const idx = attendees.findIndex(a => a.id === attendee.id);
    if (idx !== -1) {
      attendees[idx].action_recommendation = enriched.action_recommendation;
      saveAttendees(attendees);
    }

    // Update MySQL
    const updateQuery = `
      UPDATE attendees 
      SET action_recommendation = ? 
      WHERE token = ?
    `;
    db.query(updateQuery, [enriched.action_recommendation, attendee.id], (err) => {
      if (err) {
        console.error("❌ MySQL Update Failed:", err.message);
      } else {
        console.log(`✅ AI recommendation updated for ${attendee.name}`);
      }
    });

  } catch (err) {
    console.error("❌ Background AI enrichment failed:", err.message);
  }
};

// ── FIONA'S DASHBOARD API — all leads ──
app.get("/api/leads", (req, res) => {
  let hasResponded = false;

  const fallbackTimeout = setTimeout(() => {
    if (!hasResponded) {
      hasResponded = true;
      console.log("⏱️ MySQL timed out. Loading from JSON fallback.");
      const attendees = getAttendees();
      res.json(attendees);
    }
  }, 800);

  const query = "SELECT * FROM attendees ORDER BY created_at DESC";

  db.query(query, (err, results) => {
    if (hasResponded) return;
    hasResponded = true;
    clearTimeout(fallbackTimeout);

    if (err) {
      console.log("⚠️ MySQL error. Fetching from JSON instead:", err.message);
      const attendees = getAttendees();
      return res.json(attendees);
    }

    console.log(`📊 Dashboard loaded ${results.length} leads from MySQL.`);
    res.json(results);
  });
});

// ── TEAM API — filtered leads by assigned team ──
app.get("/api/leads/team/:teamName", (req, res) => {
  const teamName = decodeURIComponent(req.params.teamName);
  let hasResponded = false;

  const fallbackTimeout = setTimeout(() => {
    if (!hasResponded) {
      hasResponded = true;
      console.log("⏱️ MySQL timed out. Loading from JSON fallback.");
      const attendees = getAttendees();
      const filtered = attendees.filter(a => a.assigned_team === teamName);
      res.json(filtered);
    }
  }, 800);

  const query = "SELECT * FROM attendees WHERE assigned_team = ? ORDER BY created_at DESC";

  db.query(query, [teamName], (err, results) => {
    if (hasResponded) return;
    hasResponded = true;
    clearTimeout(fallbackTimeout);

    if (err) {
      console.log("⚠️ MySQL error. Fetching from JSON instead:", err.message);
      const attendees = getAttendees();
      const filtered = attendees.filter(a => a.assigned_team === teamName);
      return res.json(filtered);
    }

    console.log(`📨 Team '${teamName}' loaded ${results.length} leads.`);
    res.json(results);
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📋 Attendee registration: http://localhost:${PORT}/`);
  console.log(`📊 Rep dashboard:         http://localhost:${PORT}/dashboard`);
  console.log(`👥 Team view:             http://localhost:${PORT}/team`);
});