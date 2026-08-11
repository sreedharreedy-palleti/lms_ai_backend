const Resume = require('../models/Resume');

const getAnalytics = async (req, res) => {
    try {
        const resumes = await Resume.find();
        const totalCandidates = resumes.length;

        if (totalCandidates === 0) {
            return res.status(200).json({
                success: true,
                analytics: {
                    totalCandidates: 0,
                    averageScore: 0,
                    ratingDistribution: { Excellent: 0, Good: 0, Fair: 0, Weak: 0 },
                    topSkills: { languages: [], frameworks: [], tools: [], concepts: [] },
                    recentCandidates: []
                }
            });
        }

        let totalScore = 0;
        const ratingDistribution = { Excellent: 0, Good: 0, Fair: 0, Weak: 0 };
        
        const skillCounts = {
            languages: {},
            frameworks: {},
            tools: {},
            concepts: {}
        };

        resumes.forEach(r => {
            const parsed = r.parsedData || {};
            const score = parsed.score || 0;
            totalScore += score;

            const rating = parsed.rating || 'Weak';
            if (ratingDistribution[rating] !== undefined) {
                ratingDistribution[rating]++;
            } else {
                ratingDistribution['Weak']++;
            }

            const s = parsed.skills || {};
            ['languages', 'frameworks', 'tools', 'concepts'].forEach(category => {
                const list = s[category] || [];
                list.forEach(skill => {
                    const normSkill = skill ? skill.trim() : '';
                    if (normSkill) {
                        skillCounts[category][normSkill] = (skillCounts[category][normSkill] || 0) + 1;
                    }
                });
            });
        });

        const averageScore = Math.round(totalScore / totalCandidates);

        const getTopSkills = (counts) => {
            return Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(entry => ({ name: entry[0], count: entry[1] }));
        };

        const topSkills = {
            languages: getTopSkills(skillCounts.languages),
            frameworks: getTopSkills(skillCounts.frameworks),
            tools: getTopSkills(skillCounts.tools),
            concepts: getTopSkills(skillCounts.concepts)
        };

        const recentCandidates = resumes
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 5)
            .map(c => ({
                id: c._id,
                name: c.parsedData.name || 'Unknown',
                score: c.parsedData.score || 0,
                rating: c.parsedData.rating || 'Weak',
                fileName: c.fileName,
                createdAt: c.createdAt
            }));

        return res.status(200).json({
            success: true,
            analytics: {
                totalCandidates,
                averageScore,
                ratingDistribution,
                topSkills,
                recentCandidates
            }
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        return res.status(500).json({ success: false, error: 'Failed to retrieve analytics data.' });
    }
};

module.exports = {
    getAnalytics
};
