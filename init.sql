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
    INDEX idx_assigned_team (assigned_team),
    INDEX idx_token (token)
);