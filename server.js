require('dotenv').config();
const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const connectDB = require('./config/db');
const resumeRoutes = require('./routes/resumeRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Enable Middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload()); // Enables parsing of uploaded files

// Mount API Routes
app.use('/api', resumeRoutes);

// Start the server
app.listen(PORT, () => {
    console.log(`ATS Backend running on port ${PORT}`);
});