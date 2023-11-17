const express = require('express');
const router = express.Router();
const burnController = require('../controllers/burnController');
const config = require('../config'); // Adjust the path as needed


// Define the route for fetching burn data
router.get('/', burnController.getBurnData);

module.exports = router;

