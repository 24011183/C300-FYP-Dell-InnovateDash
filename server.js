const mysql = require("mysql2");
const express = require("express");

const app = express();
const PORT = 3000;
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

// Home route
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/attendee.html");
});

// Registration route SQL
app.post("/register", (req, res) => {

  const token = "USR" + Date.now();

  const { name, company, interest } = req.body;

  const sql = `
    INSERT INTO attendees
    (token, name, company, interest)
    VALUES (?, ?, ?, ?)
  `;

  db.query(
    sql,
    [token, name, company, interest],
    (err, result) => {

      if (err) {
        console.log(err);

        return res.json({
          message: "Registration failed"
        });
      }

      res.json({
        message: "Registration successful",
        token: token
      });

    }
  );

});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`http://localhost:${PORT}`);
});