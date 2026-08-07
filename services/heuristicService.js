// Backend Fallback Heuristic Parser (runs if Gemini API is offline/not configured)
const parseResumeTextHeuristic = (fileName, rawText) => {
    const textLower = rawText.toLowerCase();

    // 1. Email Extraction
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = rawText.match(emailRegex) || [];
    const email = emails[0] || '';

    // 2. Phone Extraction
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const phones = rawText.match(phoneRegex) || [];
    const phone = phones[0] || '';

    // 3. Links Extraction
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = rawText.match(urlRegex) || [];
    const linkedin = urls.find(url => url.toLowerCase().includes('linkedin.com/')) || '';
    const github = urls.find(url => url.toLowerCase().includes('github.com/')) || '';
    const portfolio = urls.find(url =>
        !url.toLowerCase().includes('linkedin.com/') &&
        !url.toLowerCase().includes('github.com/') &&
        !url.toLowerCase().includes('react') &&
        !url.toLowerCase().includes('vite')
    ) || '';

    // 4. Name Heuristic
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let name = '';
    const commonResumeWords = [
        'resume', 'curriculum', 'vitae', 'cv', 'contact', 'email', 'phone', 'skills',
        'experience', 'education', 'summary', 'profile', 'address', 'page', 'objective'
    ];
    for (let i = 0; i < Math.min(lines.length, 8); i++) {
        const line = lines[i];
        if (
            line.length >= 4 &&
            line.length <= 35 &&
            !/\d/.test(line) &&
            !line.includes('@') &&
            !line.includes('/') &&
            !line.includes('|') &&
            !commonResumeWords.some(w => line.toLowerCase().includes(w))
        ) {
            name = line;
            break;
        }
    }
    if (!name) name = fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");

    // 5. Tech Skills Classifier (Predefined Static Categories)
    const skillCategories = {
        languages: ['javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust', 'ruby', 'php', 'sql', 'html5', 'html', 'css3', 'css', 'swift', 'kotlin', 'bash'],
        frameworks: ['react', 'next.js', 'nextjs', 'vite', 'vue', 'angular', 'node.js', 'nodejs', 'express', 'nestjs', 'django', 'flask', 'spring boot', 'redux', 'graphql', 'tailwind', 'sass', 'bootstrap'],
        tools: ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'git', 'github', 'ci/cd', 'jenkins', 'firebase', 'supabase', 'postgresql', 'mysql', 'mongodb', 'redis', 'linux', 'jest'],
        concepts: ['agile', 'scrum', 'system design', 'rest api', 'unit testing', 'project management', 'communication', 'team leadership', 'microservices']
    };

    const extractedSkills = { languages: [], frameworks: [], tools: [], concepts: [] };
    let totalSkillsCount = 0;

    // Check predefined list first
    Object.entries(skillCategories).forEach(([category, list]) => {
        list.forEach(skill => {
            let matched = false;
            if (skill.includes('.') || skill.includes('/') || skill.includes('-') || skill.includes('+') || skill.includes('#')) {
                matched = textLower.includes(skill);
            } else {
                const regex = new RegExp(`\\b${skill}\\b`, 'i');
                matched = regex.test(textLower);
            }

            if (matched) {
                const displayName = skill === 'javascript' ? 'JavaScript'
                    : skill === 'typescript' ? 'TypeScript'
                        : skill === 'nodejs' || skill === 'node.js' ? 'Node.js'
                            : skill === 'nextjs' || skill === 'next.js' ? 'Next.js'
                                : skill === 'react' ? 'React'
                                    : skill === 'vue' ? 'Vue'
                                        : skill === 'angular' ? 'Angular'
                                            : skill === 'html' || skill === 'html5' ? 'HTML5'
                                                : skill === 'css' || skill === 'css3' ? 'CSS3'
                                                    : skill === 'sql' ? 'SQL'
                                                        : skill === 'aws' ? 'AWS'
                                                            : skill === 'gcp' ? 'GCP'
                                                                : skill === 'github' ? 'GitHub'
                                                                    : skill === 'postgresql' ? 'PostgreSQL'
                                                                        : skill === 'mongodb' ? 'MongoDB'
                                                                            : skill === 'mysql' ? 'MySQL'
                                                                                : skill === 'redis' ? 'Redis'
                                                                                    : skill === 'firebase' ? 'Firebase'
                                                                                        : skill === 'supabase' ? 'Supabase'
                                                                                            : skill === 'jest' ? 'Jest'
                                                                                                : skill === 'vite' ? 'Vite'
                                                                                                    : skill === 'express' ? 'Express'
                                                                                                        : skill === 'rest api' ? 'REST API'
                                                                                                            : skill === 'ci/cd' ? 'CI/CD'
                                                                                                                : skill.charAt(0).toUpperCase() + skill.slice(1);

                if (!extractedSkills[category].includes(displayName)) {
                    extractedSkills[category].push(displayName);
                    totalSkillsCount++;
                }
            }
        });
    });

    // 6. Dynamic Skills Extraction from "Skills" section
    let skillsStartIndex = -1;
    let skillsEndIndex = -1;
    const sectionHeadersRegex = /^(technical\s+)?(skills|technologies|expertise|tools|key\s+skills)/i;
    const nextHeadersRegex = /^(experience|employment|work\s+experience|history|education|academic|projects|summary|about\s+me|objective)/i;

    for (let i = 0; i < lines.length; i++) {
        const lineClean = lines[i].trim();
        if (sectionHeadersRegex.test(lineClean)) {
            skillsStartIndex = i;
            break;
        }
    }

    if (skillsStartIndex !== -1) {
        for (let i = skillsStartIndex + 1; i < lines.length; i++) {
            const lineClean = lines[i].trim();
            if (nextHeadersRegex.test(lineClean)) {
                skillsEndIndex = i;
                break;
            }
        }
        if (skillsEndIndex === -1) {
            skillsEndIndex = Math.min(skillsStartIndex + 15, lines.length);
        }
    }

    const categoriseSkill = (skillWord) => {
        const sLower = skillWord.toLowerCase();

        const langKeywords = ['javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust', 'ruby', 'php', 'sql', 'html', 'css', 'swift', 'kotlin', 'bash', 'haskell', 'scala', 'clojure', 'r', 'perl', 'assembly'];
        const frameworkKeywords = ['react', 'next.js', 'nextjs', 'vue', 'angular', 'express', 'django', 'flask', 'spring', 'laravel', 'redux', 'graphql', 'tailwind', 'sass', 'bootstrap', 'flutter', 'svelte', 'gatsby', 'ember', 'nestjs', 'rails'];
        const toolKeywords = ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'git', 'github', 'gitlab', 'jenkins', 'firebase', 'supabase', 'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'sqlite', 'linux', 'jest', 'cypress', 'figma', 'jira', 'postman', 'nginx'];

        if (langKeywords.some(k => sLower.includes(k)) || sLower.endsWith('script') || sLower.endsWith('lang')) {
            return 'languages';
        }
        if (frameworkKeywords.some(k => sLower.includes(k)) || sLower.includes('native') || sLower.endsWith('js')) {
            return 'frameworks';
        }
        if (toolKeywords.some(k => sLower.includes(k)) || sLower.includes('cloud') || sLower.includes('db') || sLower.includes('database')) {
            return 'tools';
        }
        return 'concepts';
    };

    if (skillsStartIndex !== -1) {
        const skillsLines = lines.slice(skillsStartIndex + 1, skillsEndIndex);
        skillsLines.forEach(line => {
            let lineClean = line.replace(/^[•\-\*]\s*/, '').trim();
            const colonIdx = lineClean.indexOf(':');
            if (colonIdx !== -1 && colonIdx < 30) {
                lineClean = lineClean.slice(colonIdx + 1).trim();
            }

            const parts = lineClean.split(/[,;|•]|\s{2,}/);
            parts.forEach(part => {
                const skillWord = part.trim();
                if (
                    skillWord.length >= 2 &&
                    skillWord.length <= 30 &&
                    !/^\d+$/.test(skillWord) &&
                    !['and', 'with', 'for', 'the', 'etc', 'using', 'from', 'both', 'various'].includes(skillWord.toLowerCase())
                ) {
                    const formatted = skillWord.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                    const cat = categoriseSkill(skillWord);
                    if (!extractedSkills[cat].includes(formatted)) {
                        extractedSkills[cat].push(formatted);
                        totalSkillsCount++;
                    }
                }
            });
        });
    }

    // 7. Section Detection
    const sections = {
        experience: textLower.includes('experience') || textLower.includes('history') || textLower.includes('employment') || textLower.includes('work'),
        education: textLower.includes('education') || textLower.includes('university') || textLower.includes('college') || textLower.includes('degree') || textLower.includes('academic'),
        skills: textLower.includes('skills') || textLower.includes('expertise') || textLower.includes('technologies'),
        projects: textLower.includes('projects') || textLower.includes('portfolio') || textLower.includes('achievements')
    };

    const words = rawText.trim().split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    // 8. Dynamic ATS Scoring System
    let score = 15; // Base score
    if (email) score += 15;
    if (phone) score += 10;
    if (linkedin || github) score += 15;
    if (wordCount >= 250 && wordCount <= 1200) score += 15;
    else if (wordCount > 1200) score += 8;

    if (sections.experience) score += 10;
    if (sections.education) score += 10;
    if (sections.skills) score += 5;
    if (sections.projects) score += 10; // Extra score for projects!

    if (totalSkillsCount >= 5 && totalSkillsCount <= 15) score += 10;
    else if (totalSkillsCount > 15) score += 5;

    score = Math.min(score, 100);

    // 9. Heuristic tips & Explication
    const tips = [];
    if (!email) tips.push({ type: 'danger', message: 'Add an email address so recruiters can contact you.' });
    if (!phone) tips.push({ type: 'warning', message: 'Include a phone number for direct contact.' });
    if (!linkedin) tips.push({ type: 'info', message: 'Add a LinkedIn profile URL to build digital credibility.' });
    if (!github && totalSkillsCount > 0) tips.push({ type: 'info', message: 'Include a GitHub profile link to showcase your coding projects.' });

    if (!sections.experience) tips.push({ type: 'danger', message: 'Missing a clear "Work Experience" section header.' });
    if (!sections.education) tips.push({ type: 'danger', message: 'Missing an "Education" section to list academic details.' });
    if (!sections.skills) tips.push({ type: 'warning', message: 'Include a dedicated "Skills" section for better ATS parser matching.' });
    if (!sections.projects) tips.push({ type: 'warning', message: 'Missing a "Projects" section to highlight hands-on execution.' });

    if (wordCount < 200) tips.push({ type: 'warning', message: 'Resume text is short (under 200 words). Add details about your accomplishments.' });
    if (wordCount > 1500) tips.push({ type: 'warning', message: 'Resume text is long (over 1500 words). Condense descriptions into a cleaner layout.' });

    if (totalSkillsCount < 4) {
        tips.push({ type: 'warning', message: `Only detected ${totalSkillsCount} skills. List more technical keywords.` });
    } else {
        tips.push({ type: 'success', message: `Successfully extracted and categorized ${totalSkillsCount} technical keywords from your CV.` });
    }

    const sectionsFound = Object.entries(sections).filter(([_, found]) => found).map(([name]) => name.charAt(0).toUpperCase() + name.slice(1));
    if (sectionsFound.length > 0) {
        tips.push({ type: 'success', message: `Detected major formatting zones: ${sectionsFound.join(', ')}.` });
    }

    if (tips.length === 0) {
        tips.push({ type: 'success', message: 'Your resume meets all core formatting standards!' });
    }

    let rating = 'Weak';
    if (score >= 90) rating = 'Excellent';
    else if (score >= 70) rating = 'Good';
    else if (score >= 50) rating = 'Fair';

    return {
        name,
        email,
        phone,
        linkedin,
        github,
        portfolio,
        skills: extractedSkills,
        sections,
        score,
        rating,
        tips
    };
};

// Helper: Local Heuristic Role Matching
/**
 * Local heuristic scoring fallback for custom target roles.
 * Runs if Gemini API is disabled, rate-limited, or throws an error.
 * 
 * @param {string} resumeText - Full text layer parsed from the PDF resume.
 * @param {string} role - The target title or query (e.g., 'Full Stack Developer').
 * @param {string|number} experience - Required experience in years.
 * @returns {object} Calculated ATS report containing score, rating, skills lists, and tips.
 */
const calculateHeuristicRoleScore = (resumeText, role, experience) => {
    const textLower = resumeText.toLowerCase();
    const roleLower = role.toLowerCase();
    
    // Comprehensive dictionary of technical skills and their display names
    const techSkillKeywords = {
        react: 'React',
        nextjs: 'Next.js',
        'next.js': 'Next.js',
        typescript: 'TypeScript',
        javascript: 'JavaScript',
        nodejs: 'Node.js',
        'node.js': 'Node.js',
        python: 'Python',
        aws: 'AWS',
        docker: 'Docker',
        kubernetes: 'Kubernetes',
        postgresql: 'PostgreSQL',
        postgres: 'PostgreSQL',
        sql: 'SQL',
        mongodb: 'MongoDB',
        git: 'Git',
        github: 'GitHub',
        express: 'Express',
        redux: 'Redux',
        tailwind: 'Tailwind CSS',
        css: 'CSS',
        html: 'HTML5',
        agile: 'Agile',
        scrum: 'Scrum',
        'rest api': 'REST API',
        'system design': 'System Design',
        jenkins: 'Jenkins',
        'ci/cd': 'CI/CD'
    };

    // Step 1: Detect which technology keywords from our dictionary are mentioned in the target role title
    const targetKeywords = [];
    Object.entries(techSkillKeywords).forEach(([key, name]) => {
        if (roleLower.includes(key) || key === 'javascript' || key === 'git') {
            targetKeywords.push(name);
        }
    });

    // Step 2: If the role description was brief and didn't mention specific tech, fall back to template-based profiles
    if (targetKeywords.length < 5) {
        if (roleLower.includes('front') || roleLower.includes('ui') || roleLower.includes('web')) {
            // Frontend Dev Template
            targetKeywords.push('React', 'TypeScript', 'JavaScript', 'CSS', 'Tailwind CSS', 'Git', 'Redux');
        } else if (roleLower.includes('back') || roleLower.includes('api') || roleLower.includes('server')) {
            // Backend Dev Template
            targetKeywords.push('Node.js', 'Express', 'Python', 'SQL', 'PostgreSQL', 'MongoDB', 'REST API', 'System Design', 'Git');
        } else if (roleLower.includes('devops') || roleLower.includes('cloud') || roleLower.includes('infra')) {
            // Infrastructure Dev Template
            targetKeywords.push('AWS', 'Docker', 'Kubernetes', 'Jenkins', 'CI/CD', 'Git', 'Linux');
        } else {
            // General Full Stack/Software Engineer Template
            targetKeywords.push('React', 'Node.js', 'TypeScript', 'JavaScript', 'PostgreSQL', 'Git', 'REST API', 'System Design');
        }
    }

    const matchedSkills = [];
    const missingSkills = [];

    // Step 3: Scan the resume text layer for each required tech keyword
    targetKeywords.forEach(skill => {
        const sLower = skill.toLowerCase();
        let matched = false;
        
        // Exact matching logic supporting special characters like .js or C++
        if (sLower.includes('.') || sLower.includes('/') || sLower.includes('-') || sLower.includes('+') || sLower.includes('#')) {
            matched = textLower.includes(sLower);
        } else {
            const regex = new RegExp(`\\b${sLower}\\b`, 'i');
            matched = regex.test(textLower);
        }

        if (matched) {
            matchedSkills.push(skill);
        } else {
            missingSkills.push(skill);
        }
    });

    // Step 4: Calculate overall match metrics
    let score = 40; // Base score (formatting, structure, basic metadata compliance)
    const matchPercentage = targetKeywords.length > 0 ? (matchedSkills.length / targetKeywords.length) : 1;
    score += Math.round(matchPercentage * 40); // Keyword overlap contribution (up to 40%)

    // Step 5: Adjust score for target experience and section checks
    const parsedExp = parseInt(experience) || 0;
    if (parsedExp > 0) {
        // Look for common work history section headers in the resume text layer
        const hasExpSection = textLower.includes('experience') || textLower.includes('history') || textLower.includes('work');
        if (hasExpSection) {
            score += 15; // Experience bonus if history section is present
        } else {
            score -= 10; // Experience penalty if applying for mid-senior role without work history
        }
    } else {
        score += 10; // Extra points for entry-level compatibility
    }

    // Keep score bounded strictly within [10, 100]
    score = Math.max(10, Math.min(100, score));

    // Determine descriptive rating label based on the score
    let rating = 'Weak';
    if (score >= 90) rating = 'Excellent';
    else if (score >= 70) rating = 'Good';
    else if (score >= 50) rating = 'Fair';

    // Step 6: Generate contextual feedback tips and recommendations paragraphs
    const recommendations = missingSkills.length > 0
        ? `To improve your compatibility for a ${role} role, try to gain experience or list keywords related to: ${missingSkills.join(', ')}. Ensure your profile reflects years of hands-on application of these core structures.`
        : `Your resume is highly optimized for a ${role} position! Keep building hands-on projects and prepare for backend and frontend system design interviews.`;

    const tips = [];
    if (missingSkills.length > 0) {
        tips.push({ type: 'warning', message: `Add missing key technologies: ${missingSkills.slice(0, 3).join(', ')}.` });
    }
    if (parsedExp > 0 && !textLower.includes('experience')) {
        tips.push({ type: 'danger', message: `You are applying for a role requiring ${parsedExp} years experience, but no work history section header was found.` });
    }
    if (matchedSkills.length > 3) {
        tips.push({ type: 'success', message: `Strong overlap in core technologies: ${matchedSkills.slice(0, 4).join(', ')}.` });
    }

    return {
        score,
        rating,
        matchedSkills,
        missingSkills,
        recommendations,
        tips
    };
};

module.exports = {
    parseResumeTextHeuristic,
    calculateHeuristicRoleScore
};
