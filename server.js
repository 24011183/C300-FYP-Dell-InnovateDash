// server.js - alicia
const mysql = require("mysql2");
const express = require("express");

const app = express();
const PORT = 3000;

// Database Connection - alicia
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Password123!",
  database: "dell_nfc_system"
});

db.connect((err) => {
  if (err) {
    console.log("Database connection failed");
  } else {
    console.log("Connected to MySQL");
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ── MEMBER 4: SMART ROUTING, RICH SCORING & RECOMMENDATION ENGINE ──
const analyzeLead = (attendee) => {
  const teamRoutes = {
    'AI PCs': 'Client Solutions Group (CSG)',
    'Storage': 'Infrastructure Solutions Group (ISG)',
    'Cloud': 'APEX & Cloud Services',
    'Consultancy': 'Professional Services'
  };

  let score = 0;

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

});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
