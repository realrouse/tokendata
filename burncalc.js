


const mysql = require('mysql2/promise');
const moment = require('moment');
const config = require('./config'); // Ensure you have a config.js file with the necessary details
const fetch = require('node-fetch');


async function fetchMintedSupply() {
    try {
        const response = await fetch(config.MAIN_API_URL);
        const data = await response.json();
        config.MINTED_SUPPLY = parseFloat(data[config.MINTED_SUPPLY_KEY]);
    } catch (error) {
        console.error('Error fetching minted supply:', error);
    }
}

async function createCalculationTable() {
    const connection = await mysql.createConnection(config.DB_CONFIG);

    try {
        await connection.beginTransaction();

        // Drop the existing table if it exists
        const dropTableQuery = `DROP TABLE IF EXISTS ${config.BURNCALCTABLE};`;
        await connection.execute(dropTableQuery);

        // Recreate the table with the new schema
        const createTableQuery = `
            CREATE TABLE ${config.BURNCALCTABLE} (
                id INT AUTO_INCREMENT PRIMARY KEY,
                calculation_type VARCHAR(255) NOT NULL,
                result VARCHAR(255) NOT NULL,
                years_to_burn_half VARCHAR(255) NOT NULL,
                estimated_date DATETIME NOT NULL,
                UNIQUE KEY unique_calculation (calculation_type)
            );
        `;
        await connection.execute(createTableQuery);

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        console.error(`Error recreating the ${config.BURNCALCTABLE} table:`, error);
    } finally {
        await connection.end();
    }
}



async function createOrUpdateCalcTable(result, timeToBurnHalf, calculationType) {
    const connection = await mysql.createConnection(config.DB_CONFIG);
    const mysqlFormattedDate = moment().toISOString().replace('T', ' ').replace('Z', '');

    const updateQuery = `
        INSERT INTO ${config.BURNCALCTABLE} (calculation_type, result, years_to_burn_half, estimated_date)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE result = VALUES(result), years_to_burn_half = VALUES(years_to_burn_half), estimated_date = VALUES(estimated_date);
    `;

    await connection.execute(updateQuery, [calculationType, result.toString(), timeToBurnHalf.toString(), mysqlFormattedDate]);
    await connection.end();
}



async function fetchBalances() {
    const connection = await mysql.createConnection(config.DB_CONFIG);
    const [rows] = await connection.execute(`SELECT * FROM ${config.BALANCESTABLE} ORDER BY estimated_date;`);
    await connection.end();
    return rows;
}

/*
async function fetchBalances() {
    const connection = await mysql.createConnection(config.DB_CONFIG);
    const [rows] = await connection.execute(`SELECT * FROM ${config.BALANCESTABLE} ORDER BY estimated_date;`);
    await connection.end();

    return rows.map(row => ({
        ...row,
        balance: parseFloat(row.balance) / Math.pow(10, config.TOKENDECIMALS)
    }));
}
*/


function calculateBurns(balances, days) {
    // Sort balances by date in ascending order
    balances.sort((a, b) => new Date(a.estimated_date) - new Date(b.estimated_date));

    let startBalance = 0;
    let endBalance = 0;

    if (days === Infinity) {
        // If calculating since contract creation, use the very first balance.
        startBalance = balances.length > 0 ? parseFloat(balances[0].balance) : 0;
    } else {
        // Calculate the cutoff date for the specified number of days
        const cutoffDate = moment().subtract(days, 'days').startOf('day');
        for (const balance of balances) {
            const balanceDate = moment(balance.estimated_date);
            if (balanceDate <= cutoffDate) {
                startBalance = parseFloat(balance.balance);
            } else {
                break;
            }
        }
    }

    // End balance is the last entry in the balances array
    endBalance = balances.length > 0 ? parseFloat(balances[balances.length - 1].balance) : 0;

    // Total burns is the difference between the start and end balances
    return Math.max(endBalance - startBalance, 0); // Ensure no negative values
}






function calculateBurnsSinceCreation(balances) {
    // Assuming balances are already sorted by date in ascending order
    let startBalance = parseFloat(balances[0].balance); // First entry balance
    let endBalance = parseFloat(balances[balances.length - 1].balance); // Last entry balance

    // Total burns is the difference between the start and end balances
    return Math.max(endBalance - startBalance, 0); // Ensure no negative values
}






function calculateYearsToBurnHalf(burns, totalDays) {
    if (burns <= 0 || totalDays <= 0) {
        return 'Infinity'; // Avoid division by zero
    }
    const dailyBurnRate = burns / totalDays;
    const daysToBurnHalf = (config.MINTED_SUPPLY / 2) / dailyBurnRate;
    return (daysToBurnHalf / 365).toFixed(2); // Years to burn half the supply
}


function calculateYearsToBurnHalfSinceCreation(balances) {
    // Ensure balances are sorted by date
    balances.sort((a, b) => new Date(a.estimated_date) - new Date(b.estimated_date));

    // Get the first and last balance entries
    let startBalance = parseFloat(balances[0].balance);
    let endBalance = parseFloat(balances[balances.length - 1].balance);

    // Calculate total burns
    let totalBurns = Math.max(endBalance - startBalance, 0);

    // Calculate the total number of days from contract creation to the latest balance entry
    let startDate = moment(balances[0].estimated_date);
    let endDate = moment(balances[balances.length - 1].estimated_date);
    let totalDays = endDate.diff(startDate, 'days');

    if (totalBurns <= 0 || totalDays <= 0) {
        return 'Infinity';
    }

    // Calculate the daily burn rate
    let dailyBurnRate = totalBurns / totalDays;

    // Calculate the number of days to burn half of the minted supply
    let daysToBurnHalf = (config.MINTED_SUPPLY / 2) / dailyBurnRate;

    // Convert days to years
    return (daysToBurnHalf / 365).toFixed(2);
}





function formatNumber(num) {
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 });

}


async function main() {
    await createCalculationTable();

    await fetchMintedSupply();
    if (config.MINTED_SUPPLY === null) {
        console.log('Failed to fetch minted supply. Exiting script.');
        return;
    }

    const balances = await fetchBalances();

    // Output info in the console
    console.log(`Minted Supply: ${formatNumber(config.MINTED_SUPPLY)}`);


    // Last 24 hours
    const burnsLast24h = calculateBurns(balances, 1);
    const yearsToBurnHalf24h = calculateYearsToBurnHalf(burnsLast24h, 1); // Using 1 day for 24h burn rate
    console.log(`Burns in the last 24 hours: ${formatNumber(burnsLast24h)}`);
    console.log(`Time (years) to burn 50% of minted supply using 24-hour burn rate: ${yearsToBurnHalf24h}`);
    await createOrUpdateCalcTable(burnsLast24h, yearsToBurnHalf24h, 'Burns_Last_24h');

    // Last 7 days
    const burnsLast7Days = calculateBurns(balances, 7);
    const yearsToBurnHalf7Days = calculateYearsToBurnHalf(burnsLast7Days, 7); // Using 7 days for weekly burn rate
    console.log(`Burns in the last 7 days: ${formatNumber(burnsLast7Days)}`);
    console.log(`Time (years) to burn 50% of minted supply using 7-day burn rate: ${yearsToBurnHalf7Days}`);
    await createOrUpdateCalcTable(burnsLast7Days, yearsToBurnHalf7Days, 'Burns_Last_7_Days');

    // Last 30 days
    const burnsLast30Days = calculateBurns(balances, 30);
    const yearsToBurnHalf30Days = calculateYearsToBurnHalf(burnsLast30Days, 30); // Using 30 days for monthly burn rate
    console.log(`Burns in the last 30 days: ${formatNumber(burnsLast30Days)}`);
    console.log(`Time (years) to burn 50% of minted supply using 30-day burn rate: ${yearsToBurnHalf30Days}`);
    await createOrUpdateCalcTable(burnsLast30Days, yearsToBurnHalf30Days, 'Burns_Last_30_Days');

    // Last year
    const burnsLastYear = calculateBurns(balances, 365);
    const yearsToBurnHalfYear = calculateYearsToBurnHalf(burnsLastYear, 365); // Using 365 days for yearly burn rate
    console.log(`Burns in the last year: ${formatNumber(burnsLastYear)}`);
    console.log(`Time (years) to burn 50% of minted supply using last year's burn rate: ${yearsToBurnHalfYear}`);
    await createOrUpdateCalcTable(burnsLastYear, yearsToBurnHalfYear, 'Burns_Last_Year');

    // Last 2 years
    const burnsLast2Years = calculateBurns(balances, 730); // 2 * 365
    const yearsToBurnHalf2Years = calculateYearsToBurnHalf(burnsLast2Years, 730); // Using 730 days for 2-year burn rate
    console.log(`Burns in the last 2 years: ${formatNumber(burnsLast2Years)}`);
    console.log(`Time (years) to burn 50% of minted supply using 2-year burn rate: ${yearsToBurnHalf2Years}`);
    await createOrUpdateCalcTable(burnsLast2Years, yearsToBurnHalf2Years, 'Burns_Last_2_Years');

    // Last 3 years
    const burnsLast3Years = calculateBurns(balances, 1095); // 3 * 365
    const yearsToBurnHalf3Years = calculateYearsToBurnHalf(burnsLast3Years, 1095); // Using 1095 days for 3-year burn rate
    console.log(`Burns in the last 3 years: ${formatNumber(burnsLast3Years)}`);
    console.log(`Time (years) to burn 50% of minted supply using 3-year burn rate: ${yearsToBurnHalf3Years}`);
    await createOrUpdateCalcTable(burnsLast3Years, yearsToBurnHalf3Years, 'Burns_Last_3_Years');

    // Since contract creation
const burnsSinceCreation = calculateBurnsSinceCreation(balances);
const yearsToBurnHalfSinceCreation = calculateYearsToBurnHalfSinceCreation(balances);
console.log(`Burns since contract creation: ${formatNumber(burnsSinceCreation)}`);
console.log(`Time (years) to burn 50% of minted supply since contract creation: ${yearsToBurnHalfSinceCreation}`);
await createOrUpdateCalcTable(burnsSinceCreation, yearsToBurnHalfSinceCreation, 'Burns_Since_Creation');




}




if (require.main === module) {
    // If burncalc.js is run directly, execute main function.
    main().catch(console.error);
}

// Export main function for use in other modules like server.js
module.exports = main;


