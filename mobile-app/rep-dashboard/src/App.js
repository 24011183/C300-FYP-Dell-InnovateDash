import React, { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [lead, setLead] = useState(null);
  const [scoreInfo, setScoreInfo] = useState(null);
  const [notes, setNotes] = useState("");

  // ---- Get attendee data from Alicia's backend ----
  const getLead = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/nfc/connect");
      const data = await res.json();
      setLead(data.profile);
    } catch (e) {
      console.error("Error fetching attendee data:", e);
    }
  };

  // ---- Get AI score from WeeTeck's service ----
  const getScore = async () => {
    try {
      const res = await fetch("http://localhost:6000/api/leadscore");
      const data = await res.json();
      setScoreInfo(data);
    } catch (e) {
      console.error("Error fetching score:", e);
    }
  };

  useEffect(() => {
    getLead();
    getScore();
  }, []);

  const handleNotes = (e) => setNotes(e.target.value);
  const saveNotes = () => {
    localStorage.setItem("leadNotes", notes);
    alert("Notes saved locally!");
  };

  const scoreColor =
    scoreInfo && scoreInfo.score >= 80
      ? "green"
      : scoreInfo && scoreInfo.score >= 50
      ? "orange"
      : "gray";

  return (
    <div className="App">
      <h1>Dell Representative Dashboard</h1>

      {lead ? (
        <div className="leadCard">
          <h2>{lead.name}</h2>
          <p>Company: {lead.company}</p>
          <p>Interest: {lead.interests}</p>
          <p>Email: {lead.email}</p>

          <h3 style={{ color: scoreColor }}>
            Lead Priority:{" "}
            {scoreInfo
              ? `${scoreInfo.score} (${scoreInfo.team})`
              : "Calculating..."}
          </h3>

          <textarea
            value={notes}
            onChange={handleNotes}
            placeholder="Type notes about this lead..."
          />
          <br />
          <button onClick={saveNotes}>Save Notes</button>
        </div>
      ) : (
        <p>Waiting for attendee data...</p>
      )}
    </div>
  );
}

export default App;