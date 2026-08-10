const Resume = require('../models/Resume');

const getCandidateAtsAnalysis = async (req, res) => {
    try {
        const { id } = req.params;
        const candidate = await Resume.findById(id);
        if (!candidate) {
            return res.status(404).json({ success: false, error: 'Candidate not found.' });
        }

        return res.status(200).json({
            success: true,
            atsAnalysis: {
                score: candidate.parsedData.score || 0,
                rating: candidate.parsedData.rating || 'Weak',
                sectionsFound: candidate.parsedData.sections || {},
                skillsFound: candidate.parsedData.skills || {},
                tips: candidate.parsedData.tips || [],
                fileName: candidate.fileName,
                fileSize: candidate.fileSize
            }
        });
    } catch (error) {
        console.error('Error retrieving ATS analysis:', error);
        return res.status(500).json({ success: false, error: 'Failed to retrieve ATS analysis.' });
    }
};

module.exports = {
    getCandidateAtsAnalysis
};
