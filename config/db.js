const mongoose = require('mongoose');
const dns = require('dns');

// Connect to MongoDB Database
const connectDB = async () => {
    try {
        // Configure DNS resolvers explicitly to bypass local network DNS failures on SRV queries
        try {
            dns.setServers(['1.1.1.1', '8.8.8.8']);
        } catch (dnsErr) {
            // Keep fail warning silent unless requested
        }

        const connString = process.env.MONGODB_URI || 'mongodb://localhost:27017/resume-checker';
        
        const conn = await mongoose.connect(connString);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB Connection Warning: ${error.message}`);
        console.warn('Backend is running, but database features will be disabled until connection is restored.');
    }
};

module.exports = connectDB;
