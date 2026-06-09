'use client';

export const DEMO_KEYS = {
  LEADS: 'automarket-leads',
  CAMPAIGNS: 'automarket-campaigns',
  SEGMENTS: 'automarket-segments',
  WORKFLOWS: 'automarket-workflows',
  RECIPIENTS: 'automarket-recipients',
  LOGS: 'automarket-activity-logs',
  NOTIFICATIONS: 'automarket-notifications',
  DASHBOARD: 'automarket-dashboard-stats'
};

export function loadDemoDataset() {
  // 1. Realistic Leads (20 entries)
  const leads = [
    { id: 'L-101', name: 'Rahul Sharma', email: 'rahul.sharma@gmail.com', phone: '9876543210', city: 'Indore', source: 'Facebook Ads', budget: '50 Lakh', status: 'New', createdAt: new Date().toISOString() },
    { id: 'L-102', name: 'Amit Verma', email: 'amit.verma@gmail.com', phone: '9876543211', city: 'Bhopal', source: 'Google Ads', budget: '75 Lakh', status: 'Qualified', createdAt: new Date().toISOString() },
    { id: 'L-103', name: 'Priya Singh', email: 'priya.singh@outlook.com', phone: '9876543212', city: 'Mumbai', source: 'Website', budget: '1.2 Cr', status: 'Contacted', createdAt: new Date().toISOString() },
    { id: 'L-104', name: 'Rohan Gupta', email: 'rohan.g@yahoo.com', phone: '9876543213', city: 'Pune', source: 'WhatsApp', budget: '60 Lakh', status: 'Proposal Sent', createdAt: new Date().toISOString() },
    { id: 'L-105', name: 'Meera Iyer', email: 'meera.iyer@gmail.com', phone: '9876543214', city: 'Delhi', source: 'Referral', budget: '90 Lakh', status: 'Converted', createdAt: new Date().toISOString() },
    { id: 'L-106', name: 'Saanvi Patel', email: 'saanvi.p@gmail.com', phone: '9876543215', city: 'Indore', source: 'Landing Page', budget: '45 Lakh', status: 'New', createdAt: new Date().toISOString() },
    { id: 'L-107', name: 'Arjun Mehta', email: 'arjun.mehta@gmail.com', phone: '9876543216', city: 'Mumbai', source: 'Facebook Ads', budget: '2 Cr', status: 'Qualified', createdAt: new Date().toISOString() },
    { id: 'L-108', name: 'Ananya Rao', email: 'ananya.rao@gmail.com', phone: '9876543217', city: 'Bangalore', source: 'Google Ads', budget: '85 Lakh', status: 'Contacted', createdAt: new Date().toISOString() },
    { id: 'L-109', name: 'Kabir Malik', email: 'kabir.m@gmail.com', phone: '9876543218', city: 'Pune', source: 'Website', budget: '55 Lakh', status: 'Lost', createdAt: new Date().toISOString() },
    { id: 'L-110', name: 'Isha Reddy', email: 'isha.r@gmail.com', phone: '9876543219', city: 'Hyderabad', source: 'WhatsApp', budget: '1.1 Cr', status: 'Converted', createdAt: new Date().toISOString() },
    // ... Adding 10 more internally for the full 20
  ].concat(Array.from({ length: 10 }).map((_, i) => ({
    id: `L-1${11 + i}`,
    name: `User ${i + 11}`,
    email: `user${i + 11}@example.com`,
    phone: `98765432${20 + i}`,
    city: 'Mumbai',
    source: i % 2 === 0 ? 'Facebook Ads' : 'Google Ads',
    budget: '70 Lakh',
    status: 'New',
    createdAt: new Date().toISOString()
  })));

  // 2. Campaigns (5 entries)
  const campaigns = [
    {
      id: 'CMP-001',
      name: 'Property Launch Campaign',
      status: 'Running',
      channel: 'Email + WhatsApp',
      metrics: { audience: 500, sent: 450, delivered: 430, opened: 300, clicked: 120, converted: 25 }
    },
    {
      id: 'CMP-002',
      name: 'Luxury Villa Campaign',
      status: 'Completed',
      channel: 'Email',
      metrics: { audience: 300, sent: 290, delivered: 280, opened: 180, clicked: 70, converted: 15 }
    },
    {
      id: 'CMP-003',
      name: 'Site Visit Push',
      status: 'Running',
      channel: 'WhatsApp',
      metrics: { audience: 200, sent: 200, delivered: 195, opened: 190, clicked: 85, converted: 10 }
    },
    {
      id: 'CMP-004',
      name: 'Weekend Open House',
      status: 'Draft',
      channel: 'SMS',
      metrics: { audience: 150, sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0 }
    },
    {
      id: 'CMP-005',
      name: 'Investor Outreach',
      status: 'Running',
      channel: 'Email',
      metrics: { audience: 100, sent: 98, delivered: 98, opened: 75, clicked: 40, converted: 5 }
    }
  ];

  // 3. Segments
  const segments = [
    { id: 'SEG-1', name: 'Hot Leads', count: 12 },
    { id: 'SEG-2', name: 'Cold Leads', count: 8 },
    { id: 'SEG-3', name: 'Facebook Leads', count: 7 },
    { id: 'SEG-4', name: 'Google Leads', count: 6 },
    { id: 'SEG-5', name: 'Luxury Buyers', count: 4 },
    { id: 'SEG-6', name: 'High Intent Leads', count: 5 }
  ];

  // 4. Workflows
  const workflows = [
    {
      id: 'WF-1',
      name: 'New Lead Follow Up',
      steps: ['Lead Created', 'Send Email', 'Wait 1 Day', 'Send WhatsApp', 'Assign Sales Agent'],
      status: 'Active'
    },
    {
      id: 'WF-2',
      name: 'Site Visit Reminder',
      steps: ['Visit Scheduled', 'Wait 1 Day', 'Send Reminder', 'Send SMS'],
      status: 'Active'
    }
  ];

  // 5. Activity Logs (50 entries)
  const activities = Array.from({ length: 50 }).map((_, i) => ({
    id: `ACT-${i}`,
    type: ['Lead Created', 'Campaign Created', 'Campaign Launched', 'Workflow Published', 'Lead Converted', 'Campaign Completed'][i % 6],
    description: `System processed ${['lead', 'campaign', 'workflow'][i % 3]} update for demo account.`,
    timestamp: new Date(Date.now() - i * 3600000).toISOString()
  }));

  // 6. Notifications
  const notifications = [
    { id: 'NTF-1', title: 'Campaign Completed', message: 'Luxury Villa Campaign metrics are ready.', type: 'success' },
    { id: 'NTF-2', title: 'Campaign Failed', message: 'Weekend Open House SMS gateway error.', type: 'error' },
    { id: 'NTF-3', title: 'Workflow Published', message: 'New Lead Follow Up is now live.', type: 'info' },
    { id: 'NTF-4', title: 'New Leads Imported', message: '20 realistic leads added to your workspace.', type: 'info' }
  ];

  // 7. Dashboard Stats
  const dashboard = {
    totalLeads: 20,
    campaigns: 5,
    segments: 6,
    workflows: 2,
    messagesSent: 1200,
    conversions: 40,
    coverage: 65
  };

  // Save all to localStorage
  localStorage.setItem(DEMO_KEYS.LEADS, JSON.stringify(leads));
  localStorage.setItem(DEMO_KEYS.CAMPAIGNS, JSON.stringify(campaigns));
  localStorage.setItem(DEMO_KEYS.SEGMENTS, JSON.stringify(segments));
  localStorage.setItem(DEMO_KEYS.WORKFLOWS, JSON.stringify(workflows));
  localStorage.setItem(DEMO_KEYS.LOGS, JSON.stringify(activities));
  localStorage.setItem(DEMO_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  localStorage.setItem(DEMO_KEYS.DASHBOARD, JSON.stringify(dashboard));

  window.dispatchEvent(new Event('automarket-demo-loaded'));
}

export function clearDemoDataset() {
  Object.values(DEMO_KEYS).forEach(key => localStorage.removeItem(key));
  window.dispatchEvent(new Event('automarket-demo-cleared'));
}