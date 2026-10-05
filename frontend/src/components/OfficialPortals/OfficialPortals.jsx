import React, { useState } from 'react';
import './OfficialPortals.css';

const PORTAL_LIST = [
  {
    id: 'docusign',
    name: 'DocuSign',
    code: 'DOCUSIGN',
    category: 'Software, e-Signature & Agreement Cloud',
    system: 'DocuSign Careers API',
    icon: '✍️',
    badgeColor: 'linear-gradient(135deg, #ff1a40, #99001a)',
    officialUrl: 'https://careers.docusign.com/careers-home/jobs',
    apiUrl: 'https://careers.docusign.com/api/jobs',
    description: 'Official global software engineering, product, sales, and AI agreement cloud career opportunities at DocuSign.'
  },
  {
    id: 'americanexpress',
    name: 'American Express',
    code: 'AMEX',
    category: 'Financial Services & Banking',
    system: 'Oracle HCM Cloud Recruiting',
    icon: '💳',
    badgeColor: 'linear-gradient(135deg, #006fcf, #002663)',
    officialUrl: 'https://careers.americanexpress.com/jobs',
    apiUrl: 'https://egug.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
    description: 'Official global job search portal for American Express Engineering, Product, and Finance careers.'
  },
  {
    id: 'persistent',
    name: 'Persistent Systems',
    code: 'PERSISTENT',
    category: 'Digital Engineering & Cloud Solutions',
    system: 'Zwayam ATS API',
    icon: '🌐',
    badgeColor: 'linear-gradient(135deg, #e05206, #7a2600)',
    officialUrl: 'https://careers.persistent.com/',
    apiUrl: 'https://public.zwayam.com/jobs/search',
    description: 'Official global digital engineering, cloud, data engineering, and software careers at Persistent Systems.'
  },
  {
    id: 'flextronics',
    name: 'Flextronics (Flex)',
    code: 'FLEX',
    category: 'Electronics Manufacturing & Supply Chain',
    system: 'Workday Recruiting API',
    icon: '⚡',
    badgeColor: 'linear-gradient(135deg, #00843d, #004d25)',
    officialUrl: 'https://flextronics.wd1.myworkdayjobs.com/Careers?source=Flex_Career_Site',
    apiUrl: 'https://flextronics.wd1.myworkdayjobs.com/wday/cxs/flextronics/Careers/jobs',
    description: 'Official global electronics manufacturing, supply chain solutions, and engineering careers at Flex (Flextronics).'
  },
  {
    id: 'honeywell',
    name: 'Honeywell',
    code: 'HONEYWELL',
    category: 'Industrial Automation & Aerospace',
    system: 'Oracle HCM Cloud Recruiting',
    icon: '🚀',
    badgeColor: 'linear-gradient(135deg, #e31837, #800d1e)',
    officialUrl: 'https://careers.honeywell.com/',
    apiUrl: 'https://ibqbjb.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
    description: 'Official global industrial automation, aerospace, building technologies, and software careers at Honeywell.'
  },
  {
    id: 'walmart',
    name: 'Walmart Global Tech',
    code: 'WALMART',
    category: 'eCommerce, Retail Tech & Software',
    system: 'Walmart GraphQL Careers API',
    icon: '🛒',
    badgeColor: 'linear-gradient(135deg, #0071dc, #004c91)',
    officialUrl: 'https://careers.walmart.com/us/en/results?searchQuery=All&careerareas=Technology',
    apiUrl: 'https://careers.walmart.com/api/graphql',
    description: 'Official global technology, software engineering, AI/ML, cloud, and data careers at Walmart Global Tech.'
  },
  {
    id: 'unisys',
    name: 'Unisys',
    code: 'UNISYS',
    category: 'IT Services & Cloud Infrastructure',
    system: 'Workday Recruiting API',
    icon: '🖥️',
    badgeColor: 'linear-gradient(135deg, #005c97, #363795)',
    officialUrl: 'https://unisys.wd5.myworkdayjobs.com/en-US/External',
    apiUrl: 'https://unisys.wd5.myworkdayjobs.com/wday/cxs/unisys/External/jobs',
    description: 'Official global IT services, cloud infrastructure, cybersecurity, and digital workplace careers at Unisys.'
  },
  {
    id: 'virtusa',
    name: 'Virtusa',
    code: 'VIRTUSA',
    category: 'Digital Engineering & IT Consulting',
    system: 'Virtusa Global Careers',
    icon: '🌐',
    badgeColor: 'linear-gradient(135deg, #f37023, #a83800)',
    officialUrl: 'https://www.virtusa.com/careers/job-search/global/en',
    apiUrl: 'https://www.virtusa.com/careers/job-search/global/en',
    description: 'Official global digital engineering, IT consulting, and cloud transformation career opportunities at Virtusa.'
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    code: 'MSFT',
    category: 'Software & Cloud Technology',
    system: 'Microsoft Careers API',
    icon: '🟦',
    badgeColor: 'linear-gradient(135deg, #0078d4, #002050)',
    officialUrl: 'https://jobs.careers.microsoft.com/global/en/search',
    apiUrl: 'https://services.bingapis.com/jobs/search',
    description: 'Official global software engineering, AI, and cloud opportunities at Microsoft.'
  },
  {
    id: 'amazon',
    name: 'Amazon',
    code: 'AMZN',
    category: 'E-Commerce & AWS Cloud',
    system: 'Amazon Jobs REST API',
    icon: '🟠',
    badgeColor: 'linear-gradient(135deg, #ff9900, #ff6600)',
    officialUrl: 'https://www.amazon.jobs/en/search',
    apiUrl: 'https://www.amazon.jobs/en/search.json',
    description: 'Official software, AWS infrastructure, and logistics careers portal.'
  },
  {
    id: 'netflix',
    name: 'Netflix',
    code: 'NFLX',
    category: 'Media & Streaming Tech',
    system: 'Eightfold AI Platform',
    icon: '🔴',
    badgeColor: 'linear-gradient(135deg, #e50914, #831010)',
    officialUrl: 'https://jobs.netflix.com/search',
    apiUrl: 'https://jobs.netflix.com/api/search',
    description: 'Official engineering and content technology job portal for Netflix.'
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    code: 'CRM',
    category: 'Enterprise SaaS & CRM',
    system: 'Workday Recruiting API',
    icon: '☁️',
    badgeColor: 'linear-gradient(135deg, #00a1e0, #005691)',
    officialUrl: 'https://salesforce.wd1.myworkdayjobs.com/External_Career_Site',
    apiUrl: 'https://salesforce.wd1.myworkdayjobs.com/wday/cxs/salesforce/External_Career_Site/jobs',
    description: 'Official cloud software, CRM engineering, and AI positions at Salesforce.'
  },
  {
    id: 'zoho',
    name: 'Zoho',
    code: 'ZOHO',
    category: 'SaaS & Productivity Suites',
    system: 'Zoho Recruit Portal',
    icon: '🟢',
    badgeColor: 'linear-gradient(135deg, #22b573, #13633e)',
    officialUrl: 'https://www.zoho.com/careers/',
    apiUrl: 'https://www.zoho.com/careers/',
    description: 'Official product development, UI/UX, and cloud platform careers at Zoho.'
  },
  {
    id: 'intel',
    name: 'Intel',
    code: 'INTC',
    category: 'Semiconductor & Hardware',
    system: 'Workday Recruiting API',
    icon: '🔷',
    badgeColor: 'linear-gradient(135deg, #0068b5, #003260)',
    officialUrl: 'https://jobs.intel.com/en/search/searchjobs',
    apiUrl: 'https://intel.wd1.myworkdayjobs.com/wday/cxs/intel/External/jobs',
    description: 'Official semiconductor, silicon engineering, and software careers at Intel.'
  },
  {
    id: 'nvidia',
    name: 'NVIDIA',
    code: 'NVDA',
    category: 'AI & GPU Computing',
    system: 'Workday Recruiting API',
    icon: '💚',
    badgeColor: 'linear-gradient(135deg, #76b900, #385900)',
    officialUrl: 'https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite',
    apiUrl: 'https://nvidia.wd5.myworkdayjobs.com/wday/cxs/nvidia/NVIDIAExternalCareerSite/jobs',
    description: 'Official AI research, CUDA graphics software, and hardware engineering openings.'
  },
  {
    id: 'oracle',
    name: 'Oracle',
    code: 'ORCL',
    category: 'Enterprise Cloud & Database',
    system: 'Oracle HCM Cloud Recruiting',
    icon: '🔴',
    badgeColor: 'linear-gradient(135deg, #c7254e, #7a0016)',
    officialUrl: 'https://careers.oracle.com/jobs/',
    apiUrl: 'https://eeho.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
    description: 'Official Oracle Cloud Infrastructure (OCI) and database engineering careers.'
  },
  {
    id: 'amd',
    name: 'AMD',
    code: 'AMD',
    category: 'Semiconductor & Processors',
    system: 'Phenom People Careers',
    icon: '🟥',
    badgeColor: 'linear-gradient(135deg, #ed1c24, #80090e)',
    officialUrl: 'https://careers.amd.com/careers-home/jobs',
    apiUrl: 'https://careers.amd.com/api/jobs',
    description: 'Official processor design, GPU software, and firmware careers at AMD.'
  },
  {
    id: 'wipro',
    name: 'Wipro',
    code: 'WIT',
    category: 'IT Services & Consulting',
    system: 'iCIMS / SuccessFactors',
    icon: '🟣',
    badgeColor: 'linear-gradient(135deg, #9b51e0, #541d87)',
    officialUrl: 'https://careers.wipro.com/careers-home/jobs',
    apiUrl: 'https://careers.wipro.com/',
    description: 'Official enterprise IT consulting, cloud transformation, and software jobs at Wipro.'
  },
  {
    id: 'meesho',
    name: 'Meesho',
    code: 'MEESHO',
    category: 'E-Commerce & Social Commerce',
    system: 'Greenhouse API',
    icon: '🛍️',
    badgeColor: 'linear-gradient(135deg, #f43397, #8e1051)',
    officialUrl: 'https://www.meesho.io/careers',
    apiUrl: 'https://api.greenhouse.io/v1/boards/meesho/jobs',
    description: 'Official mobile app development, backend scale, and analytics careers at Meesho.'
  },
  {
    id: 'capgemini',
    name: 'Capgemini',
    code: 'CAP',
    category: 'IT Consulting & Digital Services',
    system: 'Capgemini Global Careers API',
    icon: '🔷',
    badgeColor: 'linear-gradient(135deg, #0070ad, #003654)',
    officialUrl: 'https://www.capgemini.com/careers/job-search/',
    apiUrl: 'https://www.capgemini.com/wp-json/capgemini/v1/jobs',
    description: 'Official global technology, digital transformation, and software engineering careers.'
  },
  {
    id: 'goldmansachs',
    name: 'Goldman Sachs',
    code: 'GS',
    category: 'Investment Banking & FinTech',
    system: 'Goldman Sachs HCM Portal',
    icon: '🏛️',
    badgeColor: 'linear-gradient(135deg, #739ec9, #2c4c6e)',
    officialUrl: 'https://www.goldmansachs.com/careers/',
    apiUrl: 'https://www.goldmansachs.com/careers/api/jobs',
    description: 'Official financial software, quantitative engineering, and platform development positions.'
  },
  {
    id: 'qualcomm',
    name: 'Qualcomm',
    code: 'QCOM',
    category: 'Wireless Tech & Semiconductors',
    system: 'Workday Recruiting API',
    icon: '📱',
    badgeColor: 'linear-gradient(135deg, #3253dc, #12226e)',
    officialUrl: 'https://qualcomm.wd5.myworkdayjobs.com/External',
    apiUrl: 'https://qualcomm.wd5.myworkdayjobs.com/wday/cxs/qualcomm/External/jobs',
    description: 'Official 5G wireless systems, Snapdragon chipsets, and mobile tech careers.'
  },
  {
    id: 'tcs',
    name: 'TCS iBegin',
    code: 'TCS',
    category: 'IT & Enterprise Software',
    system: 'TCS iBegin Portal',
    icon: '🏢',
    badgeColor: 'linear-gradient(135deg, #1e88e5, #0d47a1)',
    officialUrl: 'https://ibegin.tcs.com/iBegin/jobs/search',
    apiUrl: 'https://ibegin.tcs.com/iBegin/api/jobs',
    description: 'Official Tata Consultancy Services iBegin experienced career search engine.'
  },
  {
    id: 'genpact',
    name: 'Genpact',
    code: 'G',
    category: 'AI & Business Process Tech',
    system: 'Workday Recruiting API',
    icon: '💼',
    badgeColor: 'linear-gradient(135deg, #ff4081, #9c003a)',
    officialUrl: 'https://genpact.wd3.myworkdayjobs.com/sft_external_career_site',
    apiUrl: 'https://genpact.wd3.myworkdayjobs.com/wday/cxs/genpact/sft_external_career_site/jobs',
    description: 'Official digital transformation, data analytics, and software careers at Genpact.'
  },
  {
    id: 'jpmc',
    name: 'JPMorgan Chase',
    code: 'JPMC',
    category: 'Global Financial Services',
    system: 'Oracle HCM Cloud Recruiting',
    icon: '🏦',
    badgeColor: 'linear-gradient(135deg, #111111, #333333)',
    officialUrl: 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001',
    apiUrl: 'https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
    description: 'Official software engineering, cybersecurity, and financial tech careers at Chase.'
  },
  {
    id: 'swiggy',
    name: 'Swiggy',
    code: 'SWIGGY',
    category: 'Food Delivery & Hyperlocal Tech',
    system: 'Lever / Custom Portal',
    icon: '🛵',
    badgeColor: 'linear-gradient(135deg, #fc8019, #a84700)',
    officialUrl: 'https://careers.swiggy.com/#/',
    apiUrl: 'https://careers.swiggy.com/api/jobs',
    description: 'Official backend engineering, data science, and mobile app careers at Swiggy.'
  },
  {
    id: 'browserstack',
    name: 'BrowserStack',
    code: 'BS',
    category: 'DevOps & Testing Cloud',
    system: 'Workday Recruiting API',
    icon: '💻',
    badgeColor: 'linear-gradient(135deg, #0288d1, #004ba0)',
    officialUrl: 'https://browserstack.wd1.myworkdayjobs.com/External',
    apiUrl: 'https://browserstack.wd1.myworkdayjobs.com/wday/cxs/browserstack/External/jobs',
    description: 'Official cloud infrastructure, browser testing tools, and developer product careers.'
  },
  {
    id: 'broadcom',
    name: 'Broadcom',
    code: 'AVGO',
    category: 'Semiconductor & Enterprise Software',
    system: 'Workday Recruiting API',
    icon: '🔴',
    badgeColor: 'linear-gradient(135deg, #cc0000, #660000)',
    officialUrl: 'https://broadcom.wd1.myworkdayjobs.com/External_Careers',
    apiUrl: 'https://broadcom.wd1.myworkdayjobs.com/wday/cxs/broadcom/External_Careers/jobs',
    description: 'Official custom silicon, networking, and VMware enterprise software positions.'
  },
  {
    id: 'datadog',
    name: 'DataDog',
    code: 'DDOG',
    category: 'Cloud Observability & Security',
    system: 'Greenhouse / Custom API',
    icon: '🐶',
    badgeColor: 'linear-gradient(135deg, #632ca6, #361463)',
    officialUrl: 'https://www.datadoghq.com/careers/',
    apiUrl: 'https://api.greenhouse.io/v1/boards/datadog/jobs',
    description: 'Official distributed systems, telemetry monitoring, and cloud security careers.'
  },
  {
    id: 'coforge',
    name: 'Coforge',
    code: 'COFORGE',
    category: 'Digital Services & Engineering',
    system: 'Coforge Careers Portal',
    icon: '🔶',
    badgeColor: 'linear-gradient(135deg, #ff7300, #994500)',
    officialUrl: 'https://www.coforge.com/careers/job-opportunities',
    apiUrl: 'https://www.coforge.com/careers/api/jobs',
    description: 'Official cloud architecture, microservices, and AI solution careers at Coforge.'
  }
];

const OfficialPortals = ({ onSelectCompanyForSync }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSystem, setSelectedSystem] = useState('All');

  const systemsList = ['All', 'Oracle HCM Cloud', 'Workday Recruiting API', 'Greenhouse', 'Custom API'];

  const filteredPortals = PORTAL_LIST.filter((p) => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
    const matchesSystem = selectedSystem === 'All' || p.system.toLowerCase().includes(selectedSystem.toLowerCase());
    return matchesSearch && matchesSystem;
  });

  return (
    <div className="official-portals-view">
      <div className="portals-header-banner">
        <div className="banner-badge">🌐 Super Admin Directory</div>
        <h1>Official Company Job Search Portals</h1>
        <p>Direct links to official career portals, recruiting endpoints, and ATS systems for all integrated corporate partners.</p>

        {/* Search & System Filter Bar */}
        <div className="portals-filter-bar">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search company (e.g. American Express, Microsoft, Workday)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="clear-search-btn" onClick={() => setSearchTerm('')}>✕</button>
            )}
          </div>

          <div className="system-pill-group">
            <span className="filter-label">Filter Engine:</span>
            {systemsList.map((sys) => (
              <button
                key={sys}
                className={`system-pill ${selectedSystem === sys ? 'active' : ''}`}
                onClick={() => setSelectedSystem(sys)}
              >
                {sys}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Directory Grid */}
      <div className="portals-grid">
        {filteredPortals.map((portal) => (
          <div key={portal.id} className="portal-card">
            <div className="card-top">
              <div className="portal-badge" style={{ background: portal.badgeColor }}>
                <span className="badge-icon">{portal.icon}</span>
                <span className="badge-code">{portal.code}</span>
              </div>
              <span className="system-tag">{portal.system}</span>
            </div>

            <div className="card-body">
              <h3 className="company-title">{portal.name}</h3>
              <span className="category-tag">{portal.category}</span>
              <p className="description">{portal.description}</p>
            </div>

            <div className="card-footer">
              <a
                href={portal.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-official-link"
              >
                <span>🌐 Visit Official Portal</span>
                <span className="external-arrow">↗</span>
              </a>

              {onSelectCompanyForSync && (
                <button
                  className="btn-sync-trigger"
                  onClick={() => onSelectCompanyForSync(portal.name)}
                >
                  ⚡ Trigger Live Sync
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredPortals.length === 0 && (
        <div className="no-portals-found">
          <h3>No matching official portals found</h3>
          <p>Try refining your search term or selecting "All" in the system filter.</p>
        </div>
      )}
    </div>
  );
};

export default OfficialPortals;
