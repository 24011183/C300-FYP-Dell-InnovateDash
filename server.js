// server.js - alicia
const mysql = require("mysql2");
const express = require("express");

const app = express();
const PORT = 3000;

// Database Connection - alicia
const db = mysql.createConnection({
// Database Connection Definition with a explicit timeout configuration
const dbConfig = {
  host: "localhost",
  user: "root",
  password: "Password123!",
  database: "dell_nfc_system",
  connectTimeout: 3000 // 3 seconds timeout limit so it never hangs forever
};

let db = mysql.createConnection(dbConfig);

// Helper function to establish connection cleanly
const handleDisconnect = () => {
  db.connect((err) => {
    if (err) {
      console.log("❌ Database connection failed. Running on JSON fallback mode.");
    } else {
      console.log("✅ Connected to MySQL successfully.");
    }
  });

  // If the database connection drops unexpectedly mid-event, catch it here so the server doesn't crash
  db.on('error', (err) => {
    console.log('⚠️ Database error occurred:', err.code);
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNREFUSED') {
      console.log('🔄 Re-instantiating fallback connection settings...');
      db = mysql.createConnection(dbConfig); // Reset connection instance
    }
  });
};

handleDisconnect();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Read attendees helper (JSON Backup)
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

// Save attendees helper (JSON Backup)
const saveAttendees = (data) => {
  fs.writeFileSync(
    "attendees.json",
    JSON.stringify(data, null, 2)
  );
};

// ── MEMBER 4: SMART ROUTING, RICH SCORING & RECOMMENDATION ENGINE ──
const analyzeLead = (attendee) => {
  const teamRoutes = {
    'AI PCs': 'Client Solutions Group (CSG)',
    'Storage': 'Infrastructure Solutions Group (ISG)',
    'Cloud': 'APEX & Cloud Services',
    'Consultancy': 'Professional Services'
  };

  let score = 0;
    // Signal C: Strategic Product Match (Fuzzy Text Matching)
    const customerInterest = attendee.interest ? attendee.interest.toLowerCase() : '';
    if (customerInterest.includes('ai') || customerInterest.includes('cloud')) {
        score += 30;
    } else {
        score += 15;
    }

  // Signal A: Company Size Calculation
  if (attendee.companySize > 500) score += 40;
  else if (attendee.companySize > 100) score += 25;
  else score += 10;

  // Signal B: Job Role / Title Calculation (Fuzzy Text Matching)
  const role = attendee.jobTitle ? attendee.jobTitle.toLowerCase() : '';
  if (role.includes('director') || role.includes('manager') || role.includes('lead')) {
    score += 30;
  } else {
    score += 15;
  }

  // Signal C: Strategic Product Match (UPDATED: Fuzzy Text Matching)
  const customerInterest = attendee.interest ? attendee.interest.toLowerCase() : '';
  if (customerInterest.includes('ai') || customerInterest.includes('cloud')) {
    score += 30;
  } else {
    score += 15;
  }

  let priorityLabel = 'Cold';
  let priorityColor = '#4a5568';
  let tier = 'cold';

  if (score >= 80) {
    priorityLabel = 'Hot Lead (VIP)';
    priorityColor = '#e63946';
    tier = 'hot';
  } else if (score >= 50) {
    priorityLabel = 'Warm Lead';
    priorityColor = '#f4a261';
    tier = 'warm';
  }

  let recommendation = 'Assign to general nurturing newsletter.';
  if (score >= 80) {
    recommendation = `Schedule 1-on-1 discovery call for ${attendee.interest} within 24 hours. Send Enterprise Catalog.`;
  } else if (score >= 50) {
    recommendation = `Invite to upcoming Dell ${attendee.interest} tech webinar and track email open rate.`;
  }

  return {
    ...attendee,
    lead_score: score,
    tier,
    assigned_team: teamRoutes[attendee.interest] || 'General Sales',
    priority_level: priorityLabel,
    priority_color: priorityColor,
    action_recommendation: recommendation,
    processed_at: new Date().toLocaleString()
  };
};

// Home route - alicia
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/attendee.html");
});

// Registration route SQL - alicia
// Dashboard route html serving (if needed)
app.get("/dashboard", (req, res) => {
  res.sendFile(__dirname + "/dashboard.html");
});

// ── DUAL STORAGE REGISTRATION ENDPOINT (JSON + MYSQL) ──
app.post("/register", (req, res) => {

  const token = "USR" + Date.now();

  const {
    name,
    company,
    companySize,
    jobTitle,
    interest
  } = req.body;

  const rawAttendee = {
    token,
    name,
    company,
    companySize,
    jobTitle,
    interest
  };

  const enrichedLead = analyzeLead(rawAttendee);

  const sql = `
    INSERT INTO attendees
(token, name, company, companySize, jobTitle,interest)
VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      enrichedLead.token,
      enrichedLead.name,
      enrichedLead.company,
      enrichedLead.companySize,
      enrichedLead.jobTitle,
      enrichedLead.interest
    ],
    (err, result) => {

      if (err) {
        console.log(err);

        return res.json({
          message: "Registration failed"
        });
      }

      res.json({
        message: "Registration successful",
        lead: enrichedLead
      });

    }
  );

});

// Endpoint for dashboard lead metrics - wee teck
app.get("/api/leads", (req, res) => {

  const sql = "SELECT * FROM attendees";

  db.query(sql, (err, results) => {

    if (err) {
      return res.json({
        message: "Failed to fetch leads"
      });
    }

    res.json(results);

  });

});

// NFC Retrieval Route - Alicia

app.get("/attendee/:token", (req, res) => {

  const token = req.params.token;

  const sql = `
    SELECT * FROM attendees
    WHERE token = ?
  `;

  db.query(sql, [token], (err, results) => {

    if (err) {
      return res.json({
        message: "Database error"
      });
    }

    if (results.length === 0) {
      return res.json({
        message: "Attendee not found"
      });
    }

    res.json(results[0]);

  });

  // 1. SAVE TO JSON IMMEDIATELY (Guaranteed Fallback)
  attendees.push(enrichedLead);
  saveAttendees(attendees);
  console.log(`💾 Saved ${enrichedLead.name} safely to local JSON file.`);

  // 2. ATTEMPT MYSQL INSERT
  const query = `
    INSERT INTO leads 
    (id, name, company, companySize, jobTitle, interest, lead_score, tier, assigned_team, priority_level, priority_color, action_recommendation, processed_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    enrichedLead.id,
    enrichedLead.name,
    enrichedLead.company,
    enrichedLead.companySize,
    enrichedLead.jobTitle,
    enrichedLead.interest,
    enrichedLead.lead_score,
    enrichedLead.tier,
    enrichedLead.assigned_team,
    enrichedLead.priority_level,
    enrichedLead.priority_color,
    enrichedLead.action_recommendation,
    enrichedLead.processed_at
  ];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error("❌ MySQL Insert Failed. Data preserved in JSON:", err.message);
      return res.json({ 
        message: "Registration successful (Saved to JSON Backup)!", 
        lead: enrichedLead 
      });
    }
    
    console.log("✅ Successfully synced lead to MySQL database table!");
    res.json({ message: "Registration successful!", lead: enrichedLead });
  });
});

// ── FIXED DASHBOARD API ENDPOINT (ANTI-HANG PROOF) ──
app.get("/api/leads", (req, res) => {
  let hasResponded = false;

  // Safety net: If MySQL completely hangs and doesn't respond within 1.5 seconds, 
  // auto-trigger the JSON fallback so the dashboard screen never gets stuck pending.
  const fallbackTimeout = setTimeout(() => {
    if (!hasResponded) {
      hasResponded = true;
      console.log("⏱️ MySQL query timed out. Forcing dashboard to run on JSON fallback.");
      const attendees = getAttendees();
      res.json(attendees);
    }
  }, 1500);

  const query = "SELECT * FROM leads ORDER BY processed_at DESC";

  db.query(query, (err, results) => {
    if (hasResponded) return; // Skip if timeout already answered the request
    hasResponded = true;
    clearTimeout(fallbackTimeout); // Cancel the timeout clock

    if (err) {
      console.log("⚠️ MySQL error detected. Fetching data from JSON instead:", err.message);
      const attendees = getAttendees();
      return res.json(attendees);
    }

    console.log(`📊 Loaded dashboard with ${results.length} records straight from MySQL.`);
    res.json(results);
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
