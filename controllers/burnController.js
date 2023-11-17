const db = require('../db'); // Adjust this to your DB connection logic
const config = require('../config'); // Adjust the path as needed


exports.getBurnData = async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM ${config.BURNCALCTABLE}`); // Adjust SQL query as needed

    // Send the results back to the client
res.json(result[0]);
 
 } catch (err) {
    console.error('Error fetching burn data:', err);
    res.status(500).send('Server Error');
  }
};

