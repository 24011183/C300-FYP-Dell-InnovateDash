// server.js - alicia

const mysql = require("mysql2");
const express = require("express");
const fs = require("fs");

const app = express();
const PORT = 3000;

// Database Connection - alicia
const dbConfig = {
  host: "localhost",
  user: "root",
  password: "Password123!",
  database: "dell_nfc_system",
  connectTimeout: 3000
};

const db = mysql.createConnection(dbConfig);

db.connect((err) => {
  if (err) {
    console.log("❌ Database connection failed");
  } else {
    console.log("✅ Connected to MySQL");
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// MEMBER 4 LEAD SCORING
const analyzeLead = (attendee) => {

  let score = 0;

  // Company size scoring
  if (attendee.companySize > 500) {
    score += 40;
  } else if (attendee.companySize > 100) {
    score += 25;
  } else {
    score += 10;
  }

  // Job title scoring
  const role = attendee.jobTitle
    ? attendee.jobTitle.toLowerCase()
    : "";

  if (
    role.includes("director") ||
    role.includes("manager") ||
    role.includes("lead")
  ) {
    score += 30;
  } else {
    score += 15;
  }

  // Interest scoring
  const customerInterest = attendee.interest
    ? attendee.interest.toLowerCase()
    : "";

  if (
    customerInterest.includes("ai") ||
    customerInterest.includes("cloud")
  ) {
    score += 30;
  } else {
    score += 15;
  }

  let tier = "cold";

  if (score >= 80) {
    tier = "hot";
  } else if (score >= 50) {
    tier = "warm";
  }

  return {
    ...attendee,
    lead_score: score,
    tier
  };
};

// Home route
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/attendee.html");
});

// Registration Route - Alicia
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
    (token, name, company, companySize, jobTitle, interest)
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

// Dashboard API
app.get("/api/leads", (req, res) => {

  const sql = `
    SELECT * FROM attendees
    ORDER BY created_at DESC
  `;

  db.query(sql, (err, results) => {

    if (err) {
      return res.json({
        message: "Failed to fetch leads"
      });
    }

    res.json(results);

  });

});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});