


const { Web3, HttpProvider } = require('web3');
const mysql = require('mysql2/promise');
const config = require('./config'); // Importing configuration

const web3 = new Web3(new HttpProvider(`https://mainnet.infura.io/v3/${config.INFURA_API_KEY}`));
const tokenContract = new web3.eth.Contract(config.ERC20_ABI, config.TOKEN_CONTRACT_ADDRESS);

async function ensureTableExists() {
    const connection = await mysql.createConnection(config.DB_CONFIG);
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS ${config.BALANCESTABLE} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            block_number VARCHAR(255) NOT NULL,
            balance VARCHAR(255) NOT NULL,
            estimated_date DATETIME NOT NULL
        );
    `;
    await connection.execute(createTableQuery);
    await connection.end();
}

async function checkDatabaseForBlock(blockNumber) {
  const connection = await mysql.createConnection(config.DB_CONFIG);
  const lowerBound = (blockNumber - BigInt(config.BLOCK_RANGE)).toString();
  const upperBound = (blockNumber + BigInt(config.BLOCK_RANGE)).toString();

  const [rows] = await connection.execute(
    `SELECT 1 FROM ${config.BALANCESTABLE} WHERE block_number BETWEEN ? AND ? LIMIT 1;`,
    [lowerBound, upperBound]
  );

  await connection.end();
  return rows.length > 0;
}

async function insertBalanceData(blockNumber, balance, estimatedDate) {
  const connection = await mysql.createConnection(config.DB_CONFIG);
  const mysqlFormattedDate = estimatedDate.toISOString().replace('T', ' ').replace('Z', '');
  
  await connection.execute(
    `INSERT INTO ${config.BALANCESTABLE} (block_number, balance, estimated_date) VALUES (?, ?, ?)`,
    [blockNumber.toString(), balance.toString(), mysqlFormattedDate]
  );

  console.log(`Inserted balance for block number ${blockNumber.toString()}.`);
  await connection.end();
}

/*
async function fetchBalanceAtBlock(address, blockNumber, currentBlockTimestamp, currentBlockNumber) {
  if (blockNumber >= config.CONTRACT_CREATION_BLOCK_NUMBER && blockNumber <= currentBlockNumber) {
    try {
      const balanceBigInt = await tokenContract.methods.balanceOf(address).call({}, blockNumber.toString());
      const balance = balanceBigInt / BigInt(100000000);
      const secondsSinceCurrentBlock = Number(currentBlockNumber - blockNumber) * 13.0;
      const estimatedTimestamp = Number(currentBlockTimestamp) - secondsSinceCurrentBlock;
      const estimatedDate = new Date(estimatedTimestamp * 1000);

      console.log(`Balance at block ${blockNumber.toString()} (Approx. date: ${estimatedDate.toISOString()}):`, balance.toString());
      await insertBalanceData(blockNumber, balance, estimatedDate);
    } catch (error) {
      console.error(`Error fetching balance for block number ${blockNumber}:`, error);
    }
  } else {
    console.log(`Skipping invalid block number ${blockNumber}.`);
  }
}*/


async function fetchBalanceAtBlock(address, blockNumber, currentBlockTimestamp, currentBlockNumber) {
  if (blockNumber >= config.CONTRACT_CREATION_BLOCK_NUMBER && blockNumber <= currentBlockNumber) {
    try {
      const balanceBigInt = await tokenContract.methods.balanceOf(address).call({}, blockNumber.toString());
      // Adjusting for 18 decimal places
      const balance = balanceBigInt / BigInt(Math.pow(10, config.TOKENDECIMALS));
      const secondsSinceCurrentBlock = Number(currentBlockNumber - blockNumber) * 13.0;
      const estimatedTimestamp = Number(currentBlockTimestamp) - secondsSinceCurrentBlock;
      const estimatedDate = new Date(estimatedTimestamp * 1000);

      console.log(`Balance at block ${blockNumber.toString()} (Approx. date: ${estimatedDate.toISOString()}):`, balance.toString());
      await insertBalanceData(blockNumber, balance, estimatedDate);
    } catch (error) {
      console.error(`Error fetching balance for block number ${blockNumber}:`, error);
    }
  } else {
    console.log(`Skipping invalid block number ${blockNumber}.`);
  }
}


async function getCurrentBlockTimestamp() {
  const currentBlock = await web3.eth.getBlock('latest');
  return {
    number: BigInt(currentBlock.number),
    timestamp: BigInt(currentBlock.timestamp)
  };
}

function calculateContractCreationDate(currentBlockNumber, currentBlockTimestamp) {
  const daysExisted = Number(currentBlockNumber - config.CONTRACT_CREATION_BLOCK_NUMBER) / config.BLOCKS_PER_DAY;
  const secondsSinceCreation = Number(currentBlockNumber - config.CONTRACT_CREATION_BLOCK_NUMBER) * 13.14;
  const creationTimestamp = Number(currentBlockTimestamp) - secondsSinceCreation;
  const creationDate = new Date(creationTimestamp * 1000);

  console.log(`Contract created at approximately ${creationDate.toISOString()}, existed for ${Math.floor(daysExisted)} days.`);
}

function generateBlockNumbers(currentBlockNumber) {
  // Calculate the total number of days since contract creation
  const totalDays = Math.floor(Number(currentBlockNumber - config.CONTRACT_CREATION_BLOCK_NUMBER) / config.BLOCKS_PER_DAY);
  
  let blockNumbers = [];
  // Start from the contract creation block number and proceed forward
  for (let i = 0; i <= totalDays; i++) {
    blockNumbers.push(config.CONTRACT_CREATION_BLOCK_NUMBER + BigInt(i * config.BLOCKS_PER_DAY));
  }

  return blockNumbers;
}


async function main() {
 await ensureTableExists(); 
 const { timestamp: currentBlockTimestamp, number: currentBlockNumber } = await getCurrentBlockTimestamp();
  calculateContractCreationDate(currentBlockNumber, currentBlockTimestamp);
  
  const blockNumbers = generateBlockNumbers(currentBlockNumber);

  for (const blockNumber of blockNumbers) {
    const exists = await checkDatabaseForBlock(blockNumber);
    if (!exists) {
      await fetchBalanceAtBlock(config.TARGET_ADDRESS, blockNumber, currentBlockTimestamp, currentBlockNumber);
    } else {
      console.log(`Skipping block number ${blockNumber} as it is within range of existing database entries.`);
    }
  }
}

// Conditional execution
if (require.main === module) {
    main().catch(console.error);
}

// Export main function
module.exports = main;
