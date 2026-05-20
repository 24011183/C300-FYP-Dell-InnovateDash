/**
 * MEMBER 4: SMART ROUTING, RICH SCORING & RECOMMENDATION ENGINE
 */
const analyzeLead = (attendee) => {
    const teamRoutes = {
        'AI PCs': 'Client Solutions Group (CSG)',
        'Storage': 'Infrastructure Solutions Group (ISG)',
        'Cloud': 'APEX & Cloud Services',
        'Consultancy': 'Professional Services'
    };

    let score = 0;

    if (attendee.companySize > 500) score += 40;
    else if (attendee.companySize > 100) score += 25;
    else score += 10;

    const role = attendee.jobTitle ? attendee.jobTitle.toLowerCase() : '';
    if (role.includes('director') || role.includes('manager') || role.includes('lead')) {
        score += 30;
    } else {
        score += 15;
    }

    if (attendee.interest === 'AI PCs' || attendee.interest === 'Cloud') {
        score += 30;
    } else {
        score += 15;
    }

    let priorityLabel = 'Cold';
    let priorityColor = '#6c757d';

    if (score >= 80) {
        priorityLabel = 'Hot Lead (VIP)';
        priorityColor = '#e63946';
    } else if (score >= 50) {
        priorityLabel = 'Warm Lead';
        priorityColor = '#f4a261';
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
        assigned_team: teamRoutes[attendee.interest] || 'General Sales',
        priority_level: priorityLabel,
        priority_color: priorityColor,
        action_recommendation: recommendation,
        processed_at: new Date().toLocaleString()
    };
};

const generateEventAnalytics = (allLeads) => {
    return {
        total_leads: allLeads.length,
        hot_count: allLeads.filter(l => l.lead_score >= 80).length,
        warm_count: allLeads.filter(l => l.lead_score >= 50 && l.lead_score < 80).length,
        cold_count: allLeads.filter(l => l.lead_score < 50).length,
        team_distribution: allLeads.reduce((acc, lead) => {
            acc[lead.assigned_team] = (acc[lead.assigned_team] || 0) + 1;
            return acc;
        }, {}),
        avg_score: Math.round(allLeads.reduce((sum, l) => sum + l.lead_score, 0) / allLeads.length)
    };
};

// Mock leads — replace with real NFC data from Member 3 in full integration
const mockLeads = [
    { name: "Lim Wee Teck", company: "Dell Technologies", companySize: 650, jobTitle: "IT Director", interest: "AI PCs" },
    { name: "John Tan", company: "SME Pte Ltd", companySize: 50, jobTitle: "Engineer", interest: "Storage" },
    { name: "Sarah Cheng", company: "MidCorp", companySize: 250, jobTitle: "Tech Lead", interest: "Cloud" },
    { name: "Ravi Kumar", company: "FinServe Asia", companySize: 820, jobTitle: "IT Manager", interest: "Cloud" },
    { name: "Jessica Wong", company: "StartupX", companySize: 30, jobTitle: "Developer", interest: "AI PCs" }
];