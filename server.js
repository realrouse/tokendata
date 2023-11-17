const mysql = require('mysql2/promise');
const config = require('./config');

const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

// Require your routes here
const burnRoutes = require('./routes/burnRoutes');

// Use your routes here
app.use(`${config.APIURL}`, burnRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});





     // Run fetch_balances.js and burncalc.js every minute

const runBurnCalc = require('./burncalc.js');
const runFetchBalances = require('./fetch_balances.js');

// You can now call runBurnCalc() to execute the script's main functionality


async function runTasksSequentially() {
    console.log("Fetching and calculating....");
 
   // Save the original console.log function
    const originalConsoleLog = console.log;

    // Override console.log with a dummy function
    console.log = function() {};

    try {
	await runFetchBalances();
        await runBurnCalc();
        
    } catch (error) {
        console.error('Error running tasks:', error);
    } finally {
        // Restore the original console.log function
        console.log = originalConsoleLog;
    }

    // Optional: Log a message after the tasks are completed
    console.log("Done!");
}

// Schedule to run both tasks every minute
setInterval(runTasksSequentially, 60000);

