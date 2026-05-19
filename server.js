const express = require("express");
const fs = require("fs");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Read attendees
const getAttendees = () => {
  const data = fs.readFileSync("attendees.json");
  return JSON.parse(data);
};

// Save attendees
const saveAttendees = (data) => {
  fs.writeFileSync(
    "attendees.json",
    JSON.stringify(data, null, 2)
  );
};

// Home route
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/attendee.html");
});

// Register attendee
app.post("/register", (req, res) => {

  const attendees = getAttendees();

  const newAttendee = {
    id: "USR" + Date.now(),
    name: req.body.name,
    company: req.body.company,
    interest: req.body.interest
  };

  attendees.push(newAttendee);

  saveAttendees(attendees);

  res.json({
    message: "Registration successful",
    attendee: newAttendee
  });

});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`http://localhost:${PORT}`);
});