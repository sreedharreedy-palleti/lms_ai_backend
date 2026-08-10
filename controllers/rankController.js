const Resume = require('../models/Resume');

const getCandidates = async (req, res) => {
    try {
        const candidates = await Resume.find().sort({ 'parsedData.score': -1 });
        return res.status(200).json({
            success: true,
            candidates: candidates.map(c => ({
                id: c._id,
                name: c.parsedData.name || 'Unknown Candidate',
                email: c.parsedData.email || '',
                phone: c.parsedData.phone || '',
                fileName: c.fileName,
                score: c.parsedData.score || 0,
                rating: c.parsedData.rating || 'Weak',
                createdAt: c.createdAt
            }))
        });
    } catch (error) {
        console.error('Error fetching candidates:', error);
        return res.status(500).json({ success: false, error: 'Failed to retrieve and rank candidates.' });
    }
};

module.exports = {
    getCandidates
};
