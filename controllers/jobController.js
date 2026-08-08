
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

const Resume = require('../models/Resume');

// Helper to generate suggested titles from resume skills (identical to frontend logic)
const generateSuggestedTitles = (skills) => {
    if (!skills) return ["Full Stack Engineer", "Frontend Developer", "Backend Engineer", "Software Developer"];
    
    const titles = new Set();
    const allSkills = [
        ...(skills.languages || []),
        ...(skills.frameworks || []),
        ...(skills.tools || []),
        ...(skills.concepts || [])
    ].map(s => s.toLowerCase());

    const hasFrontend = allSkills.some(s => ['react', 'vue', 'angular', 'next.js', 'nextjs', 'css', 'tailwind', 'javascript', 'typescript', 'html5', 'html'].includes(s));
    const hasBackend = allSkills.some(s => ['node.js', 'nodejs', 'express', 'python', 'django', 'flask', 'java', 'postgresql', 'postgres', 'sql', 'mongodb', 'redis', 'go', 'ruby'].includes(s));
    const hasDevops = allSkills.some(s => ['aws', 'docker', 'kubernetes', 'jenkins', 'ci/cd', 'gcp', 'azure'].includes(s));
    
    if (hasFrontend && hasBackend) {
        titles.add("Full Stack Engineer");
    }
    if (hasFrontend) {
        titles.add("Frontend Developer");
        titles.add("UI Engineer");
    }
    if (hasBackend) {
        titles.add("Backend Engineer");
        titles.add("Software Engineer");
    }
    if (hasDevops) {
        titles.add("DevOps Engineer");
        titles.add("Cloud Architect");
    }
    
    if (titles.size === 0) {
        titles.add("Software Developer");
        titles.add("Full Stack Engineer");
        titles.add("Frontend Developer");
        titles.add("Backend Engineer");
    }
    
    return Array.from(titles);
};

const getSkillOverlapCount = (job, resumeSkills) => {
    let overlapCount = 0;
    const jobTitleLower = (job.title || '').toLowerCase();
    const jobDescriptionLower = (job.description || '').toLowerCase();
    const jobSkills = (job.skills || []).map(s => s.toLowerCase());

    resumeSkills.forEach(skill => {
        const skillClean = skill.toLowerCase();
        if (skillClean.length <= 3) {
            const regex = new RegExp(`\\b${skillClean.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
            if (regex.test(jobTitleLower) || regex.test(jobDescriptionLower) || jobSkills.includes(skillClean)) {
                overlapCount++;
            }
        } else {
            if (jobTitleLower.includes(skillClean) || jobDescriptionLower.includes(skillClean) || jobSkills.includes(skillClean)) {
                overlapCount++;
            }
        }
    });

    return overlapCount;
};

const getJobs = async (req, res) => {
    const fs = require('fs');
    const { what = '', experience = '' } = req.query;
    try {
        const logMsg = `[${new Date().toISOString()}] getJobs details: what="${what}", API="Arbeitnow"\n`;
        fs.appendFileSync('debug.log', logMsg);

        console.log("getJobs request details (Arbeitnow API):", { what, experience });

        // If the 'what' query parameter is empty, it means the resume has been cleared or not uploaded yet
        if (!what) {
            return res.status(200).json({ success: true, source: 'arbeitnow', jobs: [] });
        }

        // Fetch the latest uploaded resume from database to determine jobs matching resume only
        const latestResume = await Resume.findOne().sort({ createdAt: -1 });
        if (!latestResume) {
            return res.status(200).json({ success: true, source: 'arbeitnow', jobs: [] });
        }

        // Generate recommended role based on resume skills
        const titles = generateSuggestedTitles(latestResume.parsedData.skills);
        const resumeRoleQuery = titles.length > 0 ? titles[0] : "Software Developer";

        const url = `https://www.arbeitnow.com/api/job-board-api?search=${encodeURIComponent(resumeRoleQuery)}`;
        
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

            // Extract candidate resume skills
            const resumeSkills = [
                ...(latestResume.parsedData.skills.languages || []),
                ...(latestResume.parsedData.skills.frameworks || []),
                ...(latestResume.parsedData.skills.tools || []),
                ...(latestResume.parsedData.skills.concepts || [])
            ].map(s => s.toLowerCase());

            // Filter jobs strictly based on resume's recommended title AND require at least 1 overlapping skill
            const finalJobs = jobs
                .map(job => {
                    const overlapCount = getSkillOverlapCount(job, resumeSkills);
                    return { ...job, overlapCount };
                })
                .filter(job => {
                    return matchesQuery(job, resumeRoleQuery) && job.overlapCount >= 1;
                })
                .sort((a, b) => b.overlapCount - a.overlapCount); // Sort by highest matching skills count

            fs.appendFileSync('debug.log', `[${new Date().toISOString()}] Arbeitnow API success: fetched ${jobs.length} jobs, returned ${finalJobs.length}.\n`);
            console.log(`Successfully fetched ${jobs.length} jobs, returned ${finalJobs.length} jobs matching resume role "${resumeRoleQuery}".`);
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
