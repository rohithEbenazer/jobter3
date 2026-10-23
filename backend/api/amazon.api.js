// amazon.api.js - Dedicated API module for Amazon Careers (via search.json API)
const axios = require("axios");

const AMAZON_SEARCH_API = "https://www.amazon.jobs/en/search.json";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "referer": "https://www.amazon.jobs/en/search",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

/**
 * Step 1: Fetch a page of jobs from Amazon Careers API
 * @param {number} offset Result offset (0, 100, 200...)
 * @param {string} query Search query string
 * @param {string} location Search location string
 * @returns {Promise<object|null>} Response data containing jobs array and hits count
 */
async function fetchAmazonPage(offset = 0, query = "", location = "") {
  const url = `${AMAZON_SEARCH_API}?base_query=${encodeURIComponent(query)}&loc_query=${encodeURIComponent(location)}&offset=${offset}&result_limit=100&sort=recent`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(url, { headers: DEFAULT_HEADERS });
        if (res.status === 429) {
          const waitTime = Math.round(1500 * attempt + Math.random() * 500);
          await delay(waitTime);
          continue;
        }
        if (!res.ok) return null;
        const data = await res.json();
        return data;
      } else {
        const response = await axios.get(url, {
          headers: DEFAULT_HEADERS,
          timeout: 15000
        });
        return response.data;
      }
    } catch (error) {
      if (attempt < 3) await delay(800 * attempt);
      else console.warn(`[Amazon API] Error fetching page at offset=${offset}:`, error.message);
    }
  }
  return null;
}

function cleanHtml(html = "") {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract experience requirements from text snippet
 */
function extractExperienceFromText(text = "") {
  if (!text) return { minYears: null, maxYears: null, experienceRequired: "Not specified" };

  const zeroYears = /\b(?:0\s*\+?\s*years?|no\s+(?:prior\s+)?experience\s+required|freshers?|intern(?:ship)?)\b/i;
  if (zeroYears.test(text)) {
    return { minYears: 0, maxYears: 1, experienceRequired: "0-1 years" };
  }

  const rangeMatch = /(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i.exec(text);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    return { minYears: min, maxYears: max, experienceRequired: `${min}-${max} years` };
  }

  const plusMatch = /(\d+(?:\.\d+)?)\s*\+\s*(?:years?|yrs?)/i.exec(text);
  if (plusMatch) {
    const min = parseFloat(plusMatch[1]);
    return { minYears: min, maxYears: null, experienceRequired: `${min}+ years` };
  }

  const singleMatch = /(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|relevant)/i.exec(text);
  if (singleMatch) {
    const min = parseFloat(singleMatch[1]);
    return { minYears: min, maxYears: min, experienceRequired: `${min} year${min === 1 ? '' : 's'}` };
  }

  return { minYears: 0, maxYears: null, experienceRequired: "Not specified" };
}

/**
 * Step 3: Map Amazon API item into standardized Job format
 * @param {object} rawItem Raw job item from Amazon Search API
 * @returns {object|null} Standardized JSON format of job
 */
function mapAmazonJobs(rawItem) {
  if (!rawItem) return null;

  const jobId = String(rawItem.id_icims || rawItem.id || '');
  if (!jobId) return null;
  console.log(jobId);

  const title = rawItem.title || "Amazon Opening";
  const jobPath = rawItem.job_path || `/en/jobs/${jobId}`;
  const fullUrl = jobPath.startsWith('http') ? jobPath : `https://www.amazon.jobs${jobPath}`;

  // Parse rich rawItem.locations array if available
  const citySet = new Set();
  const stateSet = new Set();
  const countrySet = new Set();
  const locationStrings = [];
  let rawLocationType = "";

  if (rawItem.city) citySet.add(rawItem.city);
  if (rawItem.state) stateSet.add(rawItem.state);
  if (rawItem.country_code) countrySet.add(rawItem.country_code);

  if (Array.isArray(rawItem.locations) && rawItem.locations.length > 0) {
    for (const locItem of rawItem.locations) {
      try {
        const parsed = typeof locItem === 'string' ? JSON.parse(locItem) : locItem;
        if (parsed) {
          const c = parsed.city || parsed.normalizedCityName;
          if (c) citySet.add(c);

          const s = parsed.normalizedStateName || parsed.region;
          if (s) stateSet.add(s);

          const cntr = parsed.normalizedCountryName || parsed.normalizedCountryCode || parsed.countryIso3a;
          if (cntr) countrySet.add(cntr);

          const fullLoc = parsed.normalizedLocation || parsed.location || parsed.locationNonStemming;
          if (fullLoc) locationStrings.push(fullLoc);

          if (parsed.type && !rawLocationType) {
            rawLocationType = parsed.type;
          }
        }
      } catch (e) {
        // Fallback for non-JSON strings
      }
    }
  }

  let city = Array.from(citySet);
  let state = Array.from(stateSet);
  let country = Array.from(countrySet);
  let location = locationStrings.length > 0 ? locationStrings.join(' | ') : (rawItem.normalized_location || rawItem.location || 'Not specified');

  if (city.length === 0 && country.length === 0) {
    const locParts = location.split(',').map(s => s.trim()).filter(Boolean);
    if (locParts.length === 1) {
      city = [locParts[0]];
    } else if (locParts.length === 2) {
      city = [locParts[0]];
      country = [locParts[1]];
    } else if (locParts.length >= 3) {
      city = [locParts[0]];
      state = [locParts[1]];
      country = [locParts[locParts.length - 1]];
    }
  }

  // Work Mode detection
  const textBlob = `${title} ${location} ${rawItem.description_short || ''} ${rawItem.basic_qualifications || ''} ${rawItem.preferred_qualifications || ''}`.toLowerCase();

  const remoteKeywords = [
    "remote",
    "fully remote",
    "100% remote",
    "remote work",
    "remote position",
    "remote eligible",
    "virtual",
    "virtual location",
    "virtual role",
    "work from home",
    "work-from-home",
    "wfh",
    "home based",
    "home-based",
    "distributed team",
    "anywhere",
    "location independent",
    "telecommute",
    "teleworking",
    "off-site",
    "offsite"
  ];

  const hybridKeywords = [
    "hybrid",
    "hybrid role",
    "hybrid model",
    "hybrid work",
    "hybrid position",
    "flexible work",
    "flexible working",
    "flexible location",
    "partially remote",
    "part-time remote",
    "split schedule",
    "in-office & remote",
    "in office / remote",
    "flexible hybrid",
    "hybrid workplace",
    "hybrid arrangement",
    "hybrid option"
  ];

  let workmode = "On-site";
  if (rawLocationType.toUpperCase() === 'VIRTUAL' || rawLocationType.toUpperCase() === 'REMOTE') {
    workmode = "Remote";
  } else if (rawLocationType.toUpperCase() === 'HYBRID') {
    workmode = "Hybrid";
  } else if (remoteKeywords.some(kw => textBlob.includes(kw))) {
    workmode = "Remote";
  } else if (hybridKeywords.some(kw => textBlob.includes(kw))) {
    workmode = "Hybrid";
  }

  // Posted Date parsing
  let postedDate = new Date().toISOString();
  if (rawItem.posted_date) {
    const d = new Date(rawItem.posted_date);
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  }

  const basicQuals = cleanHtml(rawItem.basic_qualifications || '');
  const prefQuals = cleanHtml(rawItem.preferred_qualifications || '');
  const plainDescription = cleanHtml(rawItem.description_short || rawItem.description || `${basicQuals} ${prefQuals}`);
  const fullTextToSearch = `${plainDescription} ${basicQuals} ${prefQuals}`;

  const rawHtml = `<p><strong>${title}</strong></p><p>Location: ${location}</p><div><strong>Basic Qualifications:</strong><p>${rawItem.basic_qualifications || 'N/A'}</p></div><div><strong>Preferred Qualifications:</strong><p>${rawItem.preferred_qualifications || 'N/A'}</p></div>`;

  const expResult = extractExperienceFromText(`${basicQuals} ${prefQuals}`);

  // Skills & Category
  const category = rawItem.job_category || 'Software & Technology';
  const skillsSet = new Set();
  if (category) skillsSet.add(category);
  if (rawItem.job_family) skillsSet.add(rawItem.job_family);

  
const techKeywords = [
  // Programming languages
  "C", "C++", "C#", "Java", "Python", "JavaScript", "TypeScript",
  "Go", "Golang", "Rust", "Ruby", "Kotlin", "Scala", "Swift",
  "PHP", "Perl", "R", "Bash", "Shell", "PowerShell", "SQL",
  "PL/SQL", "Haskell", "Erlang", "Elixir", "Lua", "Dart",

  // Web and application development
  "HTML", "CSS", "React", "React.js", "Angular", "Vue.js",
  "Node.js", "Express.js", "Next.js", "jQuery", "Bootstrap",
  "Tailwind CSS", "Redux", "Webpack", "Vite", "Spring",
  "Spring Boot", "J2EE", "JEE", "Jakarta EE", "Maven", "Gradle",
  "Django", "Flask", "FastAPI", "ASP.NET", ".NET", "WPF",
  "WinForms", "Ruby on Rails", "Laravel", "Symfony", "NestJS",
  "REST", "REST API", "REST APIs", "GraphQL", "gRPC",
  "SOAP", "WebSockets", "API Development", "API Integration",
  "Full Stack Development", "Frontend Development",
  "Backend Development", "Web Services", "Microservices",
  "Service-Oriented Architecture", "Event-Driven Architecture",

  // AWS and Amazon cloud
  "AWS Cloud",
  "Amazon EC2", "EC2", "Amazon S3", "S3",
  "Amazon S3 Glacier", "S3 Glacier",
  "Amazon EBS", "EBS", "Amazon EFS", "EFS",
  "Amazon FSx", "Amazon RDS", "RDS",
  "Amazon Aurora", "Aurora", "Amazon DynamoDB", "DynamoDB",
  "Amazon Redshift", "Redshift", "Amazon Neptune", "Neptune",
  "Amazon DocumentDB", "DocumentDB", "Amazon Keyspaces",
  "Amazon ElastiCache", "ElastiCache",
  "Amazon MemoryDB", "Amazon OpenSearch Service", "OpenSearch",
  "Amazon Kinesis", "Kinesis", "Amazon MSK", "MSK",
  "Amazon SQS", "SQS", "Amazon SNS", "SNS",
  "Amazon EventBridge", "EventBridge",
  "Amazon MQ", "Amazon API Gateway", "API Gateway",
  "AWS Lambda", "Lambda", "AWS Step Functions", "Step Functions",
  "AWS Batch", "AWS Fargate", "Fargate",
  "Amazon ECS", "ECS", "Amazon EKS", "EKS",
  "Amazon ECR", "ECR", "Amazon Lightsail", "AWS App Runner",
  "AWS Elastic Beanstalk", "Elastic Beanstalk",
  "AWS Glue", "AWS Lake Formation", "AWS DataSync",
  "AWS Transfer Family", "AWS Storage Gateway",
  "AWS Data Exchange", "AWS AppSync",
  "Amazon Bedrock", "AWS Bedrock", "Amazon SageMaker",
  "SageMaker", "Amazon Q", "Amazon Q Developer",
  "Amazon Q Business", "Amazon Textract", "Amazon Rekognition",
  "Amazon Comprehend", "Amazon Transcribe", "Amazon Polly",
  "Amazon Lex", "Amazon Translate", "Amazon Personalize",
  "Amazon Forecast", "Amazon Fraud Detector",
  "Amazon Connect", "Amazon Pinpoint",
  "AWS CloudFormation", "AWS CDK", "AWS SAM",
  "AWS Organizations", "AWS Control Tower",
  "AWS Systems Manager", "AWS Service Catalog",
  "AWS Trusted Advisor", "AWS Well-Architected Framework",
  "AWS Outposts", "AWS Local Zones", "AWS Wavelength",
  "AWS Direct Connect", "AWS Site-to-Site VPN",
  "AWS Transit Gateway", "AWS PrivateLink",
  "AWS Global Accelerator", "Amazon CloudFront",
  "Amazon Route 53", "Route 53",
  "Amazon VPC", "VPC", "AWS IAM", "IAM",
  "AWS KMS", "KMS", "AWS Secrets Manager",
  "AWS Certificate Manager", "AWS WAF", "AWS Shield",
  "Amazon GuardDuty", "Amazon Inspector",
  "Amazon Macie", "AWS Security Hub",
  "AWS Config", "AWS CloudTrail", "Amazon CloudWatch",
  "CloudWatch", "AWS X-Ray", "AWS Distro for OpenTelemetry",
  "AWS Cost Explorer", "AWS Budgets",
  "AWS Backup", "AWS Elastic Disaster Recovery",
  "AWS Network Firewall", "AWS Firewall Manager",
  "AWS CodeBuild", "AWS CodeDeploy", "AWS CodePipeline",
  "AWS CodeArtifact", "AWS CodeCommit",

  // Other cloud platforms
  "Microsoft Azure", "Azure", "Google Cloud", "GCP",
  "Google Kubernetes Engine", "Azure Kubernetes Service",
  "Azure Functions", "Azure DevOps", "Cloud Computing",
  "Cloud Architecture", "Hybrid Cloud", "Multi-Cloud",
  "Cloud Migration", "Cloud Infrastructure",

  // Operating systems and infrastructure
  "Linux", "Unix", "Ubuntu", "Debian", "Red Hat",
  "Red Hat Enterprise Linux", "Amazon Linux", "Amazon Linux 2",
  "Amazon Linux 2023", "Windows Server", "macOS",
  "Operating Systems", "Kernel", "Device Drivers",
  "Computer Architecture", "Virtualization", "VMware",
  "Hyper-V", "KVM", "Xen", "Containers",
  "Docker", "Kubernetes", "Helm", "containerd",
  "Podman", "OpenShift", "Terraform", "OpenTofu",
  "Ansible", "Chef", "Puppet", "Vagrant",
  "Infrastructure as Code", "IaC", "Packer",
  "Cloud-init", "systemd", "NFS", "iSCSI",

  // DevOps and reliability
  "DevOps", "DevSecOps", "SRE", "Site Reliability Engineering",
  "CI/CD", "Continuous Integration", "Continuous Delivery",
  "Continuous Deployment", "Jenkins", "GitHub Actions",
  "GitLab CI", "CircleCI", "Buildkite", "Argo CD",
  "Flux CD", "Spinnaker", "Prometheus", "Grafana",
  "Datadog", "Splunk", "New Relic", "OpenTelemetry",
  "ELK Stack", "Logstash", "Kibana", "Fluent Bit",
  "Fluentd", "Distributed Tracing", "Logging", "Monitoring",
  "Observability", "Incident Management", "On-Call",
  "Production Support", "Root Cause Analysis",
  "Capacity Planning", "Performance Tuning",
  "High Availability", "Fault Tolerance", "Disaster Recovery",
  "Business Continuity", "Chaos Engineering",
  "Load Balancing", "Auto Scaling", "Infrastructure Operations",

  // Databases and caching
  "MySQL", "PostgreSQL", "Oracle Database", "Oracle",
  "Microsoft SQL Server", "SQL Server", "SQLite", "MariaDB",
  "MongoDB", "Cassandra", "Apache Cassandra", "Redis",
  "Memcached", "Couchbase", "Neo4j", "Firebase",
  "Firestore", "HBase", "CockroachDB", "TiDB",
  "Elasticsearch", "OpenSearch", "Solr", "Aerospike",
  "ScyllaDB", "InfluxDB", "TimescaleDB", "Druid",
  "Database Design", "Database Administration",
  "Database Migration", "Database Optimization",
  "Query Optimization", "Data Modeling", "Indexing",
  "Transactions", "Replication", "Sharding",
  "Partitioning", "ACID", "CAP Theorem",
  "Relational Databases", "NoSQL", "NewSQL",
  "Key-Value Store", "Graph Database", "Vector Database",

  // AI, ML, and generative AI
  "Artificial Intelligence", "AI", "Machine Learning", "ML",
  "Deep Learning", "Generative AI", "GenAI", "LLM",
  "Large Language Models", "NLP",
  "Natural Language Processing", "Computer Vision",
  "Speech Recognition", "Speech Synthesis",
  "Neural Networks", "Transformers", "Reinforcement Learning",
  "Supervised Learning", "Unsupervised Learning",
  "Scikit-learn", "TensorFlow", "PyTorch", "Keras",
  "XGBoost", "LightGBM", "Hugging Face",
  "LangChain", "LlamaIndex", "RAG",
  "Retrieval-Augmented Generation", "Prompt Engineering",
  "AI Agents", "Agentic AI", "Embeddings", "Vector Search",
  "Fine-Tuning", "Model Training", "Model Evaluation",
  "Model Inference", "MLOps", "Feature Engineering",
  "Feature Store", "Model Deployment", "Model Monitoring",
  "Amazon Bedrock", "SageMaker", "Amazon Nova",
  "Amazon Titan", "Amazon Q", "Amazon Rekognition",
  "Amazon Textract", "Amazon Comprehend", "Amazon Lex",
  "Amazon Transcribe", "Amazon Polly", "ONNX",
  "CUDA", "GPU Computing", "Distributed Training",
  "Recommendation Systems", "Ranking Algorithms",
  "Information Retrieval", "Search Relevance",
  "Personalization", "Anomaly Detection", "Forecasting",

  // Data engineering and analytics
  "Data Engineering", "Data Science", "Data Analytics",
  "Big Data", "Data Warehousing", "Data Lakes",
  "Data Lakehouse", "ETL", "ELT", "Data Pipelines",
  "Apache Spark", "PySpark", "Hadoop", "HDFS",
  "Apache Kafka", "Apache Flink", "Apache Airflow",
  "Apache Beam", "Apache Hive", "Presto", "Trino",
  "Databricks", "Snowflake", "dbt", "Fivetran",
  "Apache NiFi", "Apache Iceberg", "Delta Lake",
  "Apache Hudi", "Parquet", "Avro", "ORC",
  "AWS EMR", "Amazon EMR", "Amazon Athena", "Athena",
  "Amazon Kinesis Data Streams", "Amazon Data Firehose",
  "Amazon Managed Service for Apache Flink",
  "Amazon QuickSight", "QuickSight",
  "Pandas", "NumPy", "Matplotlib", "Seaborn",
  "Tableau", "Power BI", "Business Intelligence",
  "Statistical Analysis", "Exploratory Data Analysis",
  "Data Visualization", "Data Governance",
  "Data Quality", "Data Catalog", "Data Lineage",

  // Algorithms and software engineering
  "Data Structures", "Algorithms", "DSA",
  "Object-Oriented Programming", "OOP", "OOPs",
  "Functional Programming", "Design Patterns",
  "SOLID Principles", "System Design", "Low-Level Design",
  "High-Level Design", "Software Architecture",
  "Distributed Systems", "Concurrent Programming",
  "Concurrency", "Multithreading", "Parallel Computing",
  "Asynchronous Programming", "Memory Management",
  "Garbage Collection", "Compiler Design", "Compilers",
  "Networking", "Computer Networks", "TCP/IP",
  "HTTP", "HTTPS", "DNS", "TLS", "SSL",
  "Sockets", "Network Protocols", "BGP", "Routing",
  "Algorithms Optimization", "Complexity Analysis",
  "Time Complexity", "Space Complexity",
  "Code Review", "Debugging", "Refactoring",
  "Technical Design", "Technical Documentation",
  "Agile", "Scrum", "Kanban", "SDLC", "Software Development Life Cycle", "Software Development Lifecycle",
  "Version Control", "Git", "GitHub", "GitLab",
  "Bitbucket", "Open Source", "Code Quality",

  // Security
  "Cybersecurity", "Information Security",
  "Application Security", "Cloud Security",
  "Network Security", "Product Security",
  "Identity and Access Management",
  "OAuth", "OAuth 2.0", "OpenID Connect", "OIDC",
  "JWT", "SAML", "Kerberos", "LDAP",
  "Encryption", "Cryptography", "PKI",
  "TLS", "mTLS", "Secrets Management",
  "Zero Trust", "Threat Modeling", "Threat Detection",
  "Penetration Testing", "Vulnerability Management",
  "OWASP", "SAST", "DAST", "SCA",
  "SIEM", "WAF", "DDoS Protection",
  "Security Incident Response", "Compliance",
  "Secure Coding", "IAM Policies", "Least Privilege",

  // Testing and quality
  "Software Testing", "Quality Assurance", "QA",
  "Unit Testing", "Integration Testing", "System Testing",
  "End-to-End Testing", "Regression Testing",
  "Automation Testing", "Test Automation",
  "Performance Testing", "Load Testing", "Stress Testing",
  "Chaos Testing", "Security Testing", "API Testing",
  "Selenium", "Playwright", "Cypress", "WebdriverIO",
  "JUnit", "TestNG", "Mockito", "PyTest",
  "Jest", "Mocha", "Chai", "Vitest",
  "Postman", "REST Assured", "Cucumber",
  "Robot Framework", "JMeter", "Gatling",
  "Test-Driven Development", "TDD",
  "Behavior-Driven Development", "BDD",
  "Test Strategy", "Test Planning",

  // Messaging and streaming
  "Apache Kafka", "Amazon MSK", "RabbitMQ",
  "ActiveMQ", "Amazon SQS", "Amazon SNS",
  "Amazon EventBridge", "NATS", "Pulsar",
  "Message Queues", "Message Brokers",
  "Event Streaming", "Stream Processing",
  "Publish-Subscribe", "Pub/Sub", "Event-Driven Systems",

  // Mobile, embedded, and devices
  "Android", "iOS", "React Native", "Flutter",
  "Android SDK", "Android NDK", "SwiftUI", "UIKit",
  "Xcode", "Jetpack Compose", "Mobile Development",
  "Embedded Systems", "Firmware", "RTOS",
  "FreeRTOS", "Zephyr", "Embedded Linux",
  "CMake", "Make", "GCC", "LLVM", "Clang",
  "ARM", "ARM64", "x86", "RISC-V",
  "FPGA", "Verilog", "VHDL", "SystemVerilog",
  "Digital Signal Processing", "DSP",
  "Electronics", "PCB Design", "IoT",
  "Robotics", "ROS", "ROS 2",
  "Computer Vision", "Sensor Integration",

  // Search and information retrieval
  "Search Engines", "Information Retrieval",
  "Search Indexing", "Search Ranking", "Search Relevance",
  "Elasticsearch", "OpenSearch", "Apache Lucene",
  "Solr", "Vector Search", "Semantic Search",
  "Full-Text Search", "Query Understanding",
  "Natural Language Search", "Recommendation Engine",

  // Hardware and high-performance computing
  "Computer Architecture", "CPU", "GPU", "TPU",
  "FPGA", "ASIC", "SoC", "Cache Coherence",
  "Distributed Computing", "High-Performance Computing",
  "HPC", "MPI", "OpenMP", "CUDA", "SIMD",
  "Memory Architecture", "Storage Systems",
  "Networking Hardware", "Performance Benchmarking",

  // Business and operational technology
  "Supply Chain Technology", "Warehouse Management Systems",
  "Inventory Management Systems", "Order Management Systems",
  "Fulfillment Technology", "Logistics Technology",
  "Robotics Automation", "Operations Research",
  "Optimization Algorithms", "Forecasting Models",
  "Route Optimization", "Scheduling Algorithms",
  "Computerized Maintenance Management",
  "Enterprise Resource Planning", "ERP",
  "Customer Relationship Management", "CRM",
  "Contact Center Technology", "Amazon Connect",
  "Workforce Management Systems"
];


  techKeywords.forEach(kw => {
    const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<![a-zA-Z0-9#+])${escapedKw}(?![a-zA-Z0-9#+])`, 'i');
    if (regex.test(fullTextToSearch)) {
      skillsSet.add(kw);
    }
  });

  const skills = Array.from(skillsSet);

  return {
    source: "Amazon",
    company: "Amazon",
    id: jobId,
    jobId: jobId,
    title: title,
    category: category,
    location: location,
    city: city,
    state: state,
    country: country,
    minYears: expResult.minYears,
    maxYears: expResult.maxYears,
    yrsOfExperience: expResult.experienceRequired,
    experienceRequired: expResult.experienceRequired,
    workmode: workmode,
    jobUrl: fullUrl,
    url: fullUrl,
    skills: skills,
    salary: "Competitive Package",
    shift: "Day Shift",
    description: plainDescription,
    descriptionHtml: rawHtml,
    basicQualifications: basicQuals,
    preferredQualifications: prefQuals,
    postedDate: postedDate,
    postingDate: postedDate,
    role: category,
    mandateSkills: skills.length > 0 ? skills.join(', ') : null
  };
}

/**
 * Step 4: Fetch ALL Amazon jobs (or up to maxLimit)
 * @param {number|object|null} [optionsOrLimit=null] Maximum number of jobs to fetch or options object
 * @returns {Promise<Array>} Array of JSON job objects
 */
async function fetchAllAmazonJobs(optionsOrLimit = null) {
  let maxLimit = null;
  if (optionsOrLimit && typeof optionsOrLimit === 'object') {
    maxLimit = optionsOrLimit.maxJobs || optionsOrLimit.limit || optionsOrLimit.maxLimit || null;
  } else if (typeof optionsOrLimit === 'number') {
    maxLimit = optionsOrLimit;
  }

  try {
    const firstPage = await fetchAmazonPage(0);
    if (!firstPage || !Array.isArray(firstPage.jobs)) {
      return [];
    }

    const totalAvailable = firstPage.hits || firstPage.jobs.length;
    const fetchLimit = maxLimit ? Math.min(totalAvailable, maxLimit) : Math.min(totalAvailable, 1000);

    let allRawJobs = [...firstPage.jobs];

    // Page through search results in chunks of 100
    for (let offset = 100; offset < fetchLimit; offset += 100) {
      const pageRes = await fetchAmazonPage(offset);
      if (pageRes && Array.isArray(pageRes.jobs) && pageRes.jobs.length > 0) {
        allRawJobs.push(...pageRes.jobs);
      } else {
        break;
      }
      await delay(100);
    }

    const mappedJobs = [];
    const seenIds = new Set();
    for (const raw of allRawJobs) {
      const mapped = mapAmazonJobs(raw);
      if (mapped && mapped.jobId && !seenIds.has(mapped.jobId)) {
        seenIds.add(mapped.jobId);
        mappedJobs.push(mapped);
        if (mappedJobs.length >= fetchLimit) break;
      }
    }

    return mappedJobs;
  } catch (error) {
    console.error("Amazon API Error:", error.message);
    return [];
  }
}

/**
 * Step 5: Sync Amazon jobs with MongoDB collection
 * @param {object} AmazonJobModel Mongoose model for AmazonJob
 * @param {number|object|null} [optionsOrLimit=null] Optional limit or options
 * @returns {Promise<object>} Sync operation result summary
 */
async function syncAmazonJobsWithDb(AmazonJobModel, optionsOrLimit = null) {
  if (!AmazonJobModel) {
    throw new Error("AmazonJob model is required for database sync.");
  }

  console.log("[Amazon Sync] Starting Amazon jobs DB sync...");
  const fetchedJobs = await fetchAllAmazonJobs(optionsOrLimit);
  console.log(`[Amazon Sync] Fetched ${fetchedJobs.length} live jobs from Amazon API.`);

  if (!Array.isArray(fetchedJobs) || fetchedJobs.length === 0) {
    return {
      success: true,
      message: "No live jobs retrieved from Amazon API.",
      stats: { fetched: 0, inserted: 0, updated: 0, deleted: 0 }
    };
  }

  const apiJobIdsSet = new Set(fetchedJobs.map(j => String(j.jobId)));
  const existingDbJobs = await AmazonJobModel.find({ source: "Amazon" }, { jobId: 1, _id: 1 });
  const existingDbIdsSet = new Set(existingDbJobs.map(j => String(j.jobId)));

  const obsoleteIds = Array.from(existingDbIdsSet).filter(id => !apiJobIdsSet.has(id));
  let deletedCount = 0;
  if (obsoleteIds.length > 0) {
    const delRes = await AmazonJobModel.deleteMany({ source: "Amazon", jobId: { $in: obsoleteIds } });
    deletedCount = delRes.deletedCount || 0;
  }

  let insertedCount = 0;
  let updatedCount = 0;
  const bulkOps = [];

  for (const job of fetchedJobs) {
    if (existingDbIdsSet.has(job.jobId)) {
      updatedCount++;
    } else {
      insertedCount++;
    }

    bulkOps.push({
      updateOne: {
        filter: { source: "Amazon", jobId: job.jobId },
        update: { $set: job },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await AmazonJobModel.bulkWrite(bulkOps);
  }

  const finalDbCount = await AmazonJobModel.countDocuments({ source: "Amazon" });

  return {
    success: true,
    message: "Amazon DB sync completed successfully.",
    stats: {
      totalFetchedRaw: fetchedJobs.length,
      previousDbCount: existingDbJobs.length,
      deletedFromDb: deletedCount,
      insertedToDb: insertedCount,
      updatedOrKeptInDb: updatedCount,
      finalDbCount: finalDbCount
    },
    jobs: fetchedJobs
  };
}

module.exports = {
  fetchAmazonPage,
  mapAmazonJobs,
  fetchAllAmazonJobs,
  syncAmazonJobsWithDb,
  cleanHtml
};
