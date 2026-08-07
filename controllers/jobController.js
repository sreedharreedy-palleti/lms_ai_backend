
// Controller: Fetch Job Listings
/**
 * GET `/api/jobs` Route Handler.
 * Returns a list of active job postings matching search keywords.
 * 
 * Logic flow:
 * 1. Extracts search parameters `what` (query) and `experience` (years) from request query variables.
 * 2. Checks for `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` credentials in the process environment.
 * 3. Appends credentials and query details to a local synchronous log file (`debug.log`).
 * 4. If credentials exist, attempts to fetch job listings from the **Adzuna REST API** (UK region search).
 * 5. If the request succeeds: parses results, sanitizes fields, and responds with `"source": "adzuna"`.
 * 6. If the request fails (e.g. 401 Unauthorized for invalid keys) or credentials are empty:
 *    - Appends the error response status to `debug.log`.
 *    - Falls back to our dynamic, high-quality Mock Job Engine and responds with `"source": "mock"`.
 * 
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
const cleanHtmlDescription = (html) => {
    if (!html) return 'No description provided.';
    let text = html
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]*>/g, '') // remove all tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');
    return text.replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
};

// Helper to match a keyword against title and tags with proper word boundary logic for short abbreviations
const matchesKeyword = (title, skills, kw) => {
    const cleanTitle = title.toLowerCase();
    const cleanSkills = skills.map(s => s.toLowerCase());
    const cleanKw = kw.toLowerCase();

    // Exact match in skills/tags is always safe
    if (cleanSkills.includes(cleanKw)) return true;

    // For short keywords (<= 3 chars like js, ts, ui, ux, go), enforce word boundaries in the title
    if (cleanKw.length <= 3) {
        const regex = new RegExp(`\\b${cleanKw}\\b`, 'i');
        return regex.test(cleanTitle);
    }

    // Substring match in title for longer keywords
    return cleanTitle.includes(cleanKw);
};

// Smart Query Matcher to filter jobs based on keywords
const matchesQuery = (job, query) => {
    if (!query) return true;
    const cleanQuery = query.toLowerCase().trim();
    const cleanTitle = (job.title || '').toLowerCase();

    // Exclude 'backend' when searching for 'frontend'
    if (cleanQuery.includes('frontend') && cleanTitle.includes('backend') && !cleanTitle.includes('fullstack') && !cleanTitle.includes('full stack')) {
        return false;
    }
    // Exclude 'frontend' when searching for 'backend'
    if (cleanQuery.includes('backend') && cleanTitle.includes('frontend') && !cleanTitle.includes('fullstack') && !cleanTitle.includes('full stack')) {
        return false;
    }

    // If query contains frontend keywords
    const isFrontendQuery = cleanQuery.includes('frontend') || cleanQuery.includes('front-end') || cleanQuery.includes('front end') || cleanQuery.includes('ui') || cleanQuery.includes('ux') || cleanQuery.includes('react');
    if (isFrontendQuery) {
        const frontendKeywords = ['frontend', 'front-end', 'front end', 'react', 'vue', 'angular', 'javascript', 'typescript', 'js', 'ts', 'css', 'html', 'ui', 'ux', 'web', 'designer', 'fullstack', 'full stack'];
        return frontendKeywords.some(kw => matchesKeyword(job.title, job.skills, kw));
    }

    // If query contains backend keywords
    const isBackendQuery = cleanQuery.includes('backend') || cleanQuery.includes('back-end') || cleanQuery.includes('back end');
    if (isBackendQuery) {
        const backendKeywords = ['backend', 'back-end', 'back end', 'node', 'express', 'python', 'django', 'flask', 'java', 'spring', 'go', 'golang', 'ruby', 'rails', 'c#', 'dotnet', 'sql', 'database', 'postgres', 'mongodb', 'aws', 'docker', 'kubernetes', 'sre', 'devops', 'fullstack', 'full stack', 'engineer', 'developer'];
        return backendKeywords.some(kw => matchesKeyword(job.title, job.skills, kw));
    }

    // If query contains devops / cloud / sre / infrastructure / automation
    const isDevOpsQuery = cleanQuery.includes('devops') || cleanQuery.includes('cloud') || cleanQuery.includes('sre') || cleanQuery.includes('infrastructure') || cleanQuery.includes('automation') || cleanQuery.includes('network') || cleanQuery.includes('system');
    if (isDevOpsQuery) {
        const isPureFrontendOrNonTech = (cleanTitle.includes('frontend') || cleanTitle.includes('front-end') || cleanTitle.includes('ui') || cleanTitle.includes('ux') || cleanTitle.includes('recruiter') || cleanTitle.includes('personal') || cleanTitle.includes('finance')) && !cleanTitle.includes('engineer') && !cleanTitle.includes('developer');
        if (isPureFrontendOrNonTech) return false;

        const devopsKeywords = ['devops', 'cloud', 'aws', 'docker', 'kubernetes', 'sre', 'site reliability', 'infrastructure', 'automation', 'terraform', 'jenkins', 'ci/cd', 'system', 'network', 'linux', 'security', 'platform'];
        return devopsKeywords.some(kw => matchesKeyword(job.title, job.skills, kw));
    }

    // If query contains data / database / sql / analytics
    const isDataQuery = cleanQuery.includes('data') || cleanQuery.includes('database') || cleanQuery.includes('analytics') || cleanQuery.includes('sql');
    if (isDataQuery) {
        const dataKeywords = ['data', 'database', 'sql', 'analytics', 'postgres', 'mongodb', 'mysql', 'oracle', 'bi', 'business intelligence', 'warehouse'];
        return dataKeywords.some(kw => matchesKeyword(job.title, job.skills, kw));
    }

    // If query contains sap / erp
    const isSapQuery = cleanQuery.includes('sap') || cleanQuery.includes('erp');
    if (isSapQuery) {
        return matchesKeyword(job.title, job.skills, 'sap') || matchesKeyword(job.title, job.skills, 'erp');
    }

    // Default matching: check if the title or tags contain any of the search query words
    const queryWords = cleanQuery.split(/\s+/).filter(w => w.length >= 2);
    if (queryWords.length === 0) return true;
    return queryWords.some(word => matchesKeyword(job.title, job.skills, word));
};

const getJobs = async (req, res) => {
    const fs = require('fs');
    const { what = '', experience = '' } = req.query;
    try {
        const logMsg = `[${new Date().toISOString()}] getJobs details: what="${what}", API="Arbeitnow"\n`;
        fs.appendFileSync('debug.log', logMsg);

        console.log("getJobs request details (Arbeitnow API):", { what, experience });

        const searchQuery = what || "";
        const url = `https://www.arbeitnow.com/api/job-board-api?search=${encodeURIComponent(searchQuery)}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Resume-Checker-App/1.0'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            const rawJobs = data.data || [];
            
            const jobs = rawJobs.map((job, idx) => {
                const title = job.title || 'Software Developer';
                const company = job.company_name || 'Tech Company';
                let location = job.location || 'Remote';
                if (job.remote) {
                    location = `${location} (Remote)`;
                }
                const description = cleanHtmlDescription(job.description);
                const jobUrl = job.url || '#';

                return {
                    id: job.slug || `arbeitnow_job_${idx}_${Date.now()}`,
                    title,
                    company,
                    location,
                    description,
                    url: jobUrl,
                    salary: 'Competitive',
                    skills: job.tags || []
                };
            });

            let finalJobs = [];
            if (what) {
                // If query is specified, strictly filter jobs
                finalJobs = jobs.filter(job => matchesQuery(job, what));
            } else {
                // If query is empty, return empty list (no default jobs on load)
                finalJobs = [];
            }

            fs.appendFileSync('debug.log', `[${new Date().toISOString()}] Arbeitnow API success: fetched ${jobs.length} jobs, returned ${finalJobs.length}.\n`);
            console.log(`Successfully fetched ${jobs.length} jobs, returned ${finalJobs.length} jobs.`);
            return res.status(200).json({ success: true, source: 'arbeitnow', jobs: finalJobs });
        } else {
            const errorText = await response.text().catch(() => '');
            const errLog = `[${new Date().toISOString()}] Arbeitnow API failed status ${response.status}: ${errorText}\n`;
            fs.appendFileSync('debug.log', errLog);
            console.error(`Arbeitnow API returned error status ${response.status}:`, errorText);
            return res.status(200).json({ success: true, source: 'arbeitnow', jobs: [] });
        }
    } catch (error) {
        fs.appendFileSync('debug.log', `[${new Date().toISOString()}] Error in getJobs: ${error.message}\n`);
        console.error("Error in getJobs:", error);
        return res.status(200).json({ success: true, source: 'arbeitnow', jobs: [] });
    }
};

module.exports = {
    getJobs
};
