// backend server setup - Alicia
const mysql = require("mysql2");
const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const app = express();
const PORT = 3000;

// Gemini AI Setup - WT - WT
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

//Database Connection & Table Initialization -Alicia
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "Password123!",
  database: process.env.DB_NAME || "dell_nfc_system",
  connectTimeout: 10000,
  charset: "utf8mb4",
};

let db;

const handleDisconnect = () => {
  db = mysql.createConnection(dbConfig);

  db.connect((err) => {
    if (err) {
      console.error("❌ Database connection failed:", err.message);
    } else {
      console.log("✅ Connected to MySQL successfully (Target: attendees table).");


      // Auto-create table if it doesn't exist[cite: 2] -Alicia
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
          visitCount INT DEFAULT 1,
          buying_intent VARCHAR(255) DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_assigned_team (assigned_team),
          INDEX idx_token (token)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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

// ── PURE AI SCORING & MULTI-FEATURE ENRICHMENT ENGINE ──
const analyzeLead = async (attendee) => {
  const assigned_team = getTeamRoute(attendee.interest);

  let companyTier = "small business";
  if (attendee.companySize >= 1000) companyTier = "large enterprise";
  else if (attendee.companySize >= 200) companyTier = "mid-market company";

  const challengeLine = attendee.currentChallenge
    ? `- Stated Challenge/Interest Details: ${attendee.currentChallenge}`
    : "";

  const visitLine = attendee.visitCount && attendee.visitCount > 1
    ? `- Total Booth Visits: ${attendee.visitCount} (This is a repeat visitor interacting with multiple items across our showcase)`
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
${visitLine}

Dell product context by interest area:
- AI PCs: Dell Latitude series with Intel Core Ultra, Dell Optimizer AI software, Dell Precision workstations
- Storage: Dell PowerStore, Dell PowerFlex, Dell ObjectScale for unstructured data
- Cloud: Dell APEX as-a-service portfolio, Dell APEX Cloud Platforms, multicloud solutions
- Consultancy: Dell ProDeploy Plus, Dell ProSupport Enterprise Suite, Dell Residency Services

Based on this profile, generate exactly FIVE components separated verbatim by the strict delimiters shown below.

Component 1: Give ONE specific, actionable internal follow-up recommendation that the ${assigned_team} team should take within 48 hours after the event. Keep it as a single sentence.
|||EMAIL_SPLIT|||
Component 2: Write a highly authentic, professional B2B client outreach follow-up email from Dell Technologies addressed to ${attendee.name}. 
Follow this strict structure:
- Opening: Thank them for stopping by the Dell booth at the Dell Technologies Forum Singapore.
- Contextual Value: Directly reference their interest in ${attendee.interest} solutions. Weave in specific relevant Dell infrastructure phrasing (e.g., if AI PCs, mention leveraging Latitude or Precision workstations powered by Intel Core Ultra processors; if Storage, mention optimizing data workloads with Dell PowerStore; if Cloud, mention scaling multi-cloud flexibility via the Dell APEX ecosystem).
- Stated Pain Point: If a challenge/interest detail is present, add a consultative sentence addressing it directly (e.g., "You mentioned that you are currently ${attendee.currentChallenge}, which is a core focus area for our engineering teams right now").
- Call to Action: Invite them to a brief 10-minute introductory discovery sync or a virtual workshop session to explore alignment.
- Formatting: Maintain clean, spaced professional paragraphs. Do not use generic brackets or placeholders. Conclude with a corporate signature placeholder like "Best regards,\n\n[Your Name]\nAccount Executive\nDell Technologies".
|||INDUSTRY_SPLIT|||
Component 3: Infer the single most accurate Industry Vertical for this company (e.g., Financial Services, Healthcare, E-commerce, Government, Manufacturing, Logistics). 
CRITICAL RULE: If the company name is a keyboard smash (e.g., "asdfghjkl", "qwerty", "g"), unrecognizable text, random letters, or lacks semantic context to confidently infer a real sector, you MUST output exactly "NIL (Unclassified)". Do not default to Technology.
|||SEGMENT_SPLIT|||
Component 4: Map the company to one of Dell's account structures based on employee size: If size >= 1000 output "Enterprise Division", if size >= 200 output "Corporate Mid-Market", else output "Commercial Small & Medium Business". Output only the segment name.
|||INTENT_SPLIT|||
Component 5: Evaluate the semantic intent of the "Stated Challenge/Interest Details" text field and output exactly one of these labels based on urgency:
- If a serious infrastructure issue, bottleneck, or urgent operational problem is written, output: "Critical (Active Project)"
- If the text shows active procurement, comparison of hardware, shortlisting vendors, or reviewing concrete specifications, output: "Evaluation (Exploring Solutions)"
- If the text is empty, generic, or represents passive, casual, early-stage brainstorming (e.g., "thinking of getting", "just looking around", "maybe looking in future"), output: "Information Gathering"
|||SCORE_SPLIT|||
Component 6: Calculate a final mathematical lead prioritization score as a whole integer from 0 to 100 based on these criteria:
- Sizing Fit: Award 50 points if enterprise scale (>=1000 employees), 30 points if mid-market (200-999), 15 points if SMB (50-199), else 5 points.
- Persona Fit: Professionally evaluate their Job Title authority. High-level corporate decision makers (C-Suite, VPs, Directors, Business Owners) get 30 points. Operational managers or technical leads get 15 points. General staff or individual contributors get 0 points.
- Intent Fit: If their intent urgency context maps to Critical or Evaluation, award an extra 20 points. If they are just information gathering, award 0 points.
Output ONLY the raw integer value.

Rules:
- Do NOT use markdown code blocks or formatting labels.
- Output only the requested components separated strictly by the specified strings: "|||EMAIL_SPLIT|||", "|||INDUSTRY_SPLIT|||", "|||SEGMENT_SPLIT|||", "|||INTENT_SPLIT|||", and "|||SCORE_SPLIT|||".
`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const recommendation = result.response.text().trim();

    console.log(`🤖 Gemini Multi-Feature Engine completed for ${attendee.name}`);
    console.log(`📨 Lead routed to: ${assigned_team}`);

    return {
      ...attendee,
      assigned_team,
      action_recommendation: recommendation,
      processed_at: new Date().toLocaleString()
    };

  } catch (err) {
    console.error("❌ Gemini API error:", err.message);

    const determinedSegment = attendee.companySize >= 1000 ? "Enterprise Division" : attendee.companySize >= 200 ? "Corporate Mid-Market" : "Commercial Small & Medium Business";
    const defaultIntent = attendee.currentChallenge ? "Evaluation (Exploring Solutions)" : "Information Gathering";
    const baselineScore = attendee.companySize >= 1000 ? 50 : attendee.companySize >= 200 ? 30 : 15;

    return {
      ...attendee,
      assigned_team,
      action_recommendation: `Follow up regarding ${attendee.interest} solutions. |||EMAIL_SPLIT|||Dear ${attendee.name},\n\nThank you for connecting with us at the Dell Technologies Forum. We look forward to discussing our ${attendee.interest} solutions with you soon. |||INDUSTRY_SPLIT|||NIL (Unclassified) |||SEGMENT_SPLIT|||${determinedSegment} |||INTENT_SPLIT|||${defaultIntent} |||SCORE_SPLIT|||${baselineScore}`,
      processed_at: new Date().toLocaleString()
    };
  }
};

// ── ENDPOINTS ──
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/attendee.html");
});

app.get("/dashboard", (req, res) => {
  res.sendFile(__dirname + "/dashboard.html");
});

// Registration & Database Processing (main part) - Alicia
app.post("/register", async (req, res) => {
  console.log("🔥 /register endpoint reached");
  // ── INPUT VALIDATION ──
  const name = (req.body.name || "").trim();
  const company = (req.body.company || "").trim();
  const interest = (req.body.interest || "").trim();
  const email = (req.body.email || "").trim();

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

  // ── DUPLICATE LEAD CONSOLIDATION (MySQL) ─ Alicia
  // If the same attendee registers again for the same interest,
  // update their existing record and increment the visit count.
  // Registrations for different interests are treated as separate valid leads.
  console.log("Checking duplicate...");

  if (email) {
    const dupCheck = await new Promise((resolve) => {
      db.query(
        "SELECT token, name, visitCount FROM attendees WHERE email = ? AND interest = ? LIMIT 1",
        [email, interest],
        (err, rows) => resolve(err ? null : rows)
      );
    });


    if (dupCheck && dupCheck.length > 0) {
      const existing = dupCheck[0];

      db.query(
        `UPDATE attendees
       SET
         company = ?,
         companySize = ?,
         jobTitle = ?,
         phone = ?,
         currentChallenge = ?,
         visitCount = visitCount + 1
       WHERE token = ?`,
        [
          company,
          parseInt(req.body.companySize) || 0,
          (req.body.jobTitle || "").trim(),
          (req.body.phone || "").trim(),
          (req.body.currentChallenge || "").trim(),
          existing.token
        ],
        (err) => {
          if (err) {
            console.error("❌ Duplicate update failed:", err.message);
            return res.status(500).json({
              message: "Failed to update existing attendee."
            });
          }

          console.log(`🔄 Existing attendee updated: ${existing.name}`);

          return res.json({
            duplicate: true,
            message: `Welcome back ${existing.name}! Your previous registration has been updated.`,
            visitCount: (existing.visitCount || 1) + 1
          });
        }
      );

      return;
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
  console.log("About to INSERT");
  const query = `
    INSERT INTO attendees
    (token, name, company, companySize, jobTitle,
 email, phone, interest, currentChallenge,
 pdpaConsent, assigned_team,
 action_recommendation, visitCount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const values = 
  [
  rawAttendee.id,
  rawAttendee.name,
  rawAttendee.company,
  rawAttendee.companySize,
  rawAttendee.jobTitle,
  rawAttendee.email,
  rawAttendee.phone,
  rawAttendee.interest,
  rawAttendee.currentChallenge,
  1,
  rawAttendee.assigned_team,
  rawAttendee.action_recommendation,
  1
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


// ── BACKGROUND AI ENRICHMENT ──WT
const enrichLeadWithAI = async (attendee) => {
  try {
    const enriched = await analyzeLead(attendee);
    // ----- Buying Intent Prediction (Alicia) -----
    const buyingIntentPrompt = `
You are a Dell B2B sales specialist.

Based ONLY on the attendee's current IT challenge, classify their buying intent.

Current IT Challenge:
${attendee.currentChallenge || "Not provided"}

Return ONLY ONE of these words:
High
Medium
Low
`;

    const buyingIntentResult = await genAI
      .getGenerativeModel({ model: "gemini-2.5-flash" })
      .generateContent(buyingIntentPrompt);

    const buyingIntent = buyingIntentResult.response.text().trim();
    db.query(
      `UPDATE attendees
   SET action_recommendation = ?,
       buying_intent = ?
   WHERE token = ?`,
      [
        enriched.action_recommendation,
        buyingIntent,
        attendee.id
      ],
      (err) => {
        if (err) console.error("❌ AI enrichment MySQL update failed:", err.message);
        else console.log(
          `✅ AI updates synced for ${attendee.name} | Buying Intent: ${buyingIntent}`
        );
      }
    );
  } catch (err) {
    console.error("❌ Background AI enrichment failed:", err.message);
  }
};

// ── LIGHTWEIGHT API GATE ──[cite: 2]
const requireApiKey = (req, res, next) => {
  const configured = process.env.API_KEY;
  if (!configured) return next();
  const provided = req.header("x-api-key") || req.query.key;
  if (provided && provided === configured) return next();
  return res.status(401).json({ message: "Unauthorized: missing or invalid API key." });
};

// ── DASHBOARD API — all leads ──[cite: 2]
app.get("/api/leads", requireApiKey, (req, res) => {
  db.query("SELECT * FROM attendees ORDER BY created_at DESC", (err, results) => {
    if (err) {
      console.error("❌ /api/leads MySQL error:", err.message);
      return res.status(503).json({ error: "Database unavailable." });
    }
    res.json(results);
  });
});

// ── TEAM API — filtered leads by assigned team ──[cite: 2]
app.get("/api/leads/team/:teamName", requireApiKey, (req, res) => {
  const teamName = decodeURIComponent(req.params.teamName);
  db.query(
    "SELECT * FROM attendees WHERE assigned_team = ? ORDER BY created_at DESC",
    [teamName],
    (err, results) => {
      if (err) return res.status(503).json({ error: "Database error" });
      res.json(results);
    }
  );
});

// Extract Score Directly From AI Structure for Clean CSV Generation
const computeLeadScore = (attendee) => {
  const rawText = attendee.action_recommendation || "";
  let finalScore = 0;

  if (rawText.includes("|||SCORE_SPLIT|||")) {
    const parts = rawText.split("|||SCORE_SPLIT|||");
    finalScore = parseInt(parts[1].trim()) || 0;
  } else {
    finalScore = attendee.companySize >= 1000 ? 50 : attendee.companySize >= 200 ? 30 : 15;
  }

  return {
    lead_score: finalScore,
    priority: finalScore >= 60 ? "HOT" : finalScore >= 35 ? "WARM" : "COLD"
  };
};

const toCsv = (rows) => {
  const cols = ["name", "company", "companySize", "jobTitle", "email",
    "phone", "interest", "currentChallenge", "pdpaConsent",
                "assigned_team", "lead_score", "priority", "visitCount",
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
    if (err) return res.status(503).json({ error: "Database unavailable." });
    const rows = team ? results.filter(r => r.assigned_team === team) : results;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="dell-leads.csv"`);
    res.send(toCsv(rows));
  });
});

app.patch("/api/leads/:id", requireApiKey, (req, res) => {
  const token = req.params.id;
  const allowed = ["routing_status", "action_recommendation", "followup_note"];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  if (Object.keys(updates).length === 0) return res.status(400).json({ message: "No fields to update." });

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(", ");
  const vals = [...Object.values(updates), token];
  db.query(`UPDATE attendees SET ${setClauses} WHERE token = ?`, vals, (err) => {
    if (err) return res.status(503).json({ message: "Database update failed." });
    res.json({ message: "Lead updated.", token, updates });
  });
});

app.post("/api/leads/:id/followup", requireApiKey, (req, res) => {
  const token = req.params.id;
  const { action_taken, notes, rep_name } = req.body;

  if (!action_taken) return res.status(400).json({ message: "action_taken is required." });

  const logEntry = {
    token,
    action_taken,
    notes: notes || "",
    rep_name: rep_name || "Unknown",
    logged_at: new Date().toLocaleString()
  };

  const note = `[${logEntry.logged_at}] ${action_taken} by ${rep_name}. ${notes}`;
  db.query(
    "UPDATE attendees SET followup_note = ?, routing_status = 'FOLLOWED_UP' WHERE token = ?",
    [note, token],
    (err) => {
      if (err) return res.status(503).json({ message: "Database update failed." });
      res.json({ message: "Follow-up logged successfully.", log: logEntry });
    }
  );
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