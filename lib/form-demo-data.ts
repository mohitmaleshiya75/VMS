export const generateLeadDemoData = () => ({
  name: 'Rahul Sharma',
  email: 'rahul.sharma@gmail.com',
  phone: '9876543210',
  city: 'Indore',
  state: 'Madhya Pradesh',
  source: 'Facebook Ads',
  budget: 5000000,
  leadScore: 85,
  status: 'New',
  notes: 'Interested in premium residential properties.',
});

export const generateCampaignDemoData = () => ({
  name: 'Property Launch Campaign',
  type: 'Lead Nurturing',
  channel: 'Email + WhatsApp',
  audience: 'Hot Leads',
  subject: 'Exclusive Property Launch Offer',
  message: 'Thank you for your interest. We are excited to share our latest property launch with special early-bird pricing.',
  status: 'Draft',
});

export const generateSegmentDemoData = () => ({
  name: 'Luxury Buyers',
  source: 'Facebook Ads',
  city: 'Indore',
  budget: '10000000+',
  leadScore: '80+',
});

export const generateWorkflowDemoData = () => ({
  name: 'New Lead Follow Up',
  trigger: 'Lead Created',
  condition: 'Lead Score > 70',
  action: 'Send Email',
  delay: '1 Day',
  nextAction: 'Send WhatsApp',
});

export const generateEmailTemplateDemoData = () => ({
  name: 'Property Launch Welcome Email',
  subject: 'Welcome to Our Premium Property Collection',
  body: 'Thank you for your interest. Explore our latest premium property offerings and schedule a site visit today.',
});

export const generateSmsTemplateDemoData = () => ({
  name: 'Lead Follow Up SMS',
  message: 'Thank you for your inquiry. Our property consultant will contact you shortly.',
});

export const generateWhatsappTemplateDemoData = () => ({
  name: 'Property Brochure Share',
  message: 'Hello Rahul, thank you for your interest. Here is the brochure for our latest project.',
});

export type DemoDataType = 
  | 'lead' 
  | 'campaign' 
  | 'segment' 
  | 'workflow' 
  | 'emailTemplate' 
  | 'smsTemplate' 
  | 'whatsappTemplate';

export const getDemoData = (type: DemoDataType) => {
  switch (type) {
    case 'lead': return generateLeadDemoData();
    case 'campaign': return generateCampaignDemoData();
    case 'segment': return generateSegmentDemoData();
    case 'workflow': return generateWorkflowDemoData();
    case 'emailTemplate': return generateEmailTemplateDemoData();
    case 'smsTemplate': return generateSmsTemplateDemoData();
    case 'whatsappTemplate': return generateWhatsappTemplateDemoData();
    default: return {};
  }
};