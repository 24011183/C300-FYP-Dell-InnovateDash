const mysql = require("mysql2");
const express = require("express");
const fs = require("fs");

const app = express();
const PORT = 3000;

// Database Connection
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

// Read attendees helper
const getAttendees = () => {
  const data = fs.readFileSync("attendees.json");
  return JSON.parse(data);
};

// Save attendees helper
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

// Home route
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/attendee.html");
});

// Intercepted Registration Endpoint
app.post("/register", (req, res) => {
  const attendees = getAttendees();

  // Parse raw inputs including Member 4 signals
  const rawAttendee = {
    id: "USR" + Date.now(),
    name: req.body.name,
    company: req.body.company,
    companySize: parseInt(req.body.companySize) || 0,
    jobTitle: req.body.jobTitle || "",
    interest: req.body.interest
  };

  // Run data packet through the Intelligence Layer
  const enrichedLead = analyzeLead(rawAttendee);

  // Commit enriched data to local JSON stack
  attendees.push(enrichedLead);
  saveAttendees(attendees);

  // Send back full object to client payload
  res.json({ message: "Registration successful!", lead: enrichedLead });
});

// Endpoint for your Member 4 Dashboard to fetch up-to-date lead metrics
app.get("/api/leads", (req, res) => {
  const attendees = getAttendees(); // Reads your current attendees.json file
  res.json(attendees); // Sends the data array straight to your dashboard UI
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});