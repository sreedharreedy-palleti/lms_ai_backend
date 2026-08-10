const mongoose = require('mongoose');

const ResumeSchema = new mongoose.Schema({
    fileName: {
        type: String,
        required: true
    },
    fileSize: {
        type: String,
        required: true
    },
    pageCount: {
        type: String,
        required: true
    },
    rawText: {
        type: String,
        required: true
    },
    parsedData: {
        name: { type: String },
        email: { type: String },
        phone: { type: String },
        linkedin: { type: String },
        github: { type: String },
        portfolio: { type: String },
        skills: {
            languages: [{ type: String }],
            frameworks: [{ type: String }],
            tools: [{ type: String }],
            concepts: [{ type: String }]
        },
        sections: {
            experience: { type: Boolean },
            education: { type: Boolean },
            skills: { type: Boolean },
            projects: { type: Boolean }
        },
        score: { type: Number },
        rating: { type: String },
        tips: [{
            type: { type: String }, // literal 'type' field using nested mongoose type syntax
            message: { type: String }
        }],
        summary: { type: String }
    },
    interviewQuestions: [{
        question: { type: String },
        type: { type: String }, // 'type' field
        expectedAnswer: { type: String }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Resume', ResumeSchema);
