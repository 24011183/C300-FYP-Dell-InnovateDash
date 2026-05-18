/**
 * MEMBER 4: SMART ROUTING & PRIORITIZATION ENGINE
 * -----------------------------------------------
 * This logic handles Lead Enrichment for the Dell Forum.
 */

const analyzeLead = (attendee) => {
    // 1. Professional Team Mapping (Painpoint: Manual Sorting)
    const teamRoutes = {
        'AI PCs': 'Client Solutions Group (CSG)',
        'Storage': 'Infrastructure Solutions Group (ISG)',
        'Cloud': 'APEX & Cloud Services',
        'Consultancy': 'Professional Services'
    };

    // 2. VIP Prioritization (Painpoint: Limited Time for Reps)
    let priorityScore = 3; // Default: Standard
    let priorityLabel = 'Standard';

    // Rule: Large Companies or AI interests get VIP status
    if (attendee.companySize > 500 || attendee.interest === 'AI PCs') {
        priorityScore = 1;
        priorityLabel = 'VIP - Immediate Action Required';
    }

    return {
        ...attendee,
        assigned_team: teamRoutes[attendee.interest] || 'General Sales',
        priority_level: priorityLabel,
        priority_score: priorityScore,
        system_notes: `Automated routing complete. Priority ${priorityScore} assigned.`,
        processed_at: new Date().toLocaleString()
    };
};

// --- DEMO TEST CASE ---
const demoLead = {
    name: "Lim Wee Teck",
    company: "Dell Technolgies",
    companySize: 650,
    interest: "AI PCs"
};

console.log("--- Member 4 Logic Result ---");
console.log(analyzeLead(demoLead));

// Member 4: Analytics Aggregator
const generateEventAnalytics = (allLeads) => {
    return {
        total_leads: allLeads.length,
        vip_count: allLeads.filter(l => l.priority_score === 1).length,
        team_distribution: allLeads.reduce((acc, lead) => {
            acc[lead.assigned_team] = (acc[lead.assigned_team] || 0) + 1;
            return acc;
        }, {}),
        conversion_potential: "High - AI PC segment leading interest"
    };
};