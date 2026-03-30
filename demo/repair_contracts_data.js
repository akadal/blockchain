const fs = require('fs');
const path = require('path');

const contractsDataPath = path.join(__dirname, 'js', 'contracts-data.js');
let content = fs.readFileSync(contractsDataPath, 'utf8');

// 1. Identify the structural components
const templatesStartMarker = 'var CONTRACT_TEMPLATES ={';
const templatesStartIndex = content.indexOf(templatesStartMarker);

// 2. Identify the other globals (these were at the end of the original file)
const explorerApisMarker = 'var EXPLORER_APIS = {';
const explorerApisIndex = content.indexOf(explorerApisMarker);

const networkNamesMarker = 'var NETWORK_NAMES = {';
const networkNamesIndex = content.indexOf(networkNamesMarker);

const shortAddrMarker = 'function shortAddr(addr) {';
const shortAddrIndex = content.indexOf(shortAddrMarker);

if (templatesStartIndex === -1 || explorerApisIndex === -1 || networkNamesIndex === -1 || shortAddrIndex === -1) {
    console.error('Could not identify all markers for repair.');
    process.exit(1);
}

// 3. Extract the original definitions before I broke them
// We assume CONTRACT_TEMPLATES should end with }; before EXPLORER_APIS
// Based on my view_file, CONTRACT_TEMPLATES ended at 3869 and EXPLORER_APIS was 3871.

// Let's find the original templates (everything from start marker to the FIRST }; before EXPLORER_APIS)
// Actually, it's easier to just rebuild the file.

const EXPLORER_APIS_CONTENT = `var EXPLORER_APIS = {
  1:     { api: 'https://api.etherscan.io/api',              url: 'https://etherscan.io',            name: 'Etherscan' },
  11155111: { api: 'https://api-sepolia.etherscan.io/api',   url: 'https://sepolia.etherscan.io',    name: 'Sepolia Etherscan' },
  137:   { api: 'https://api.polygonscan.com/api',           url: 'https://polygonscan.com',         name: 'Polygonscan' },
  56:    { api: 'https://api.bscscan.com/api',               url: 'https://bscscan.com',             name: 'BscScan' },
  42161: { api: 'https://api.arbiscan.io/api',               url: 'https://arbiscan.io',             name: 'Arbiscan' },
  10:    { api: 'https://api-optimistic.etherscan.io/api',   url: 'https://optimistic.etherscan.io', name: 'Optimism Etherscan' },
  8453:  { api: 'https://api.basescan.org/api',              url: 'https://basescan.org',            name: 'BaseScan' },
  43114: { api: 'https://api.snowtrace.io/api',              url: 'https://snowtrace.io',            name: 'Snowtrace' }
};`;

const NETWORK_NAMES_CONTENT = `var NETWORK_NAMES = {
  1: 'Ethereum Mainnet', 11155111: 'Sepolia', 137: 'Polygon', 80001: 'Mumbai',
  56: 'BSC', 97: 'BSC Testnet', 42161: 'Arbitrum One', 421614: 'Arbitrum Sepolia',
  10: 'Optimism', 8453: 'Base', 84532: 'Base Sepolia', 43114: 'Avalanche',
  31337: 'Simulated (In-Browser)'
};`;

const SHORT_ADDR_CONTENT = `function shortAddr(addr) {
  if (!addr) return '\u2014';
  return addr;
}`;

// Re-read compiled results to re-populate the templates correctly
const compiledResults = require('./compiled_results.json');
const lendingSource = fs.readFileSync('SimpleLending.sol', 'utf8');
const farmSource = fs.readFileSync('SimpleYieldFarm.sol', 'utf8');
const ammSource = fs.readFileSync('SimpleAMM.sol', 'utf8');
const daoSource = fs.readFileSync('SimpleDAO.sol', 'utf8');

// Keep original templates (storage, test_amm, erc20, counter, etc.)
// We know they exist in the file until the first "simpleamm": { we broke.
const firstBrokeMarker = '"simpleamm": {';
const originalEndIndex = content.indexOf(firstBrokeMarker);

let newTemplatesContent = content.substring(templatesStartIndex, originalEndIndex);
// The above substring ends just before "simpleamm":

// Add cleaned up new templates
const ammData = {
    name: "SimpleAMM", desc: "A basic constant-product Automated Market Maker (AMM). Now also an ERC20 for LP tokens.",
    source: ammSource, abi: compiledResults.simpleamm.abi, bytecode: "0x" + compiledResults.simpleamm.bytecode,
    constructorArgs: ["address _tokenA", "address _tokenB"]
};
const lendingData = {
    name: "SimpleLending", desc: "A collateralized lending platform. Users can deposit tokens as collateral and borrow up to a certain ratio.",
    source: lendingSource, abi: compiledResults.simplelending.abi, bytecode: "0x" + compiledResults.simplelending.bytecode,
    constructorArgs: ["address _token"]
};
const farmData = {
    name: "SimpleYieldFarm", desc: "A yield farming contract that rewards users for staking LP tokens.",
    source: farmSource, abi: compiledResults.simpleyieldfarm.abi, bytecode: "0x" + compiledResults.simpleyieldfarm.bytecode,
    constructorArgs: ["address _lpToken", "address _rewardToken"]
};
const daoData = {
    name: "SimpleDAO", desc: "A basic DAO contract where members can create proposals and vote using governance tokens.",
    source: daoSource, abi: compiledResults.simpledao.abi, bytecode: "0x" + compiledResults.simpledao.bytecode,
    constructorArgs: ["address _govTokenAddress"]
};
const govTokenData = {
    name: "GovernanceToken", desc: "A basic ERC20 token with weight-based voting power for DAO governance.",
    source: daoSource, abi: compiledResults.governancetoken.abi, bytecode: "0x" + compiledResults.governancetoken.bytecode,
    constructorArgs: ["uint256 initialSupply"]
};

const templatesToAdd = { 
    "simpleamm": ammData, 
    "simplelending": lendingData, 
    "simpleyieldfarm": farmData, 
    "simpledao": daoData, 
    "governancetoken": govTokenData 
};

for (const [key, data] of Object.entries(templatesToAdd)) {
    newTemplatesContent += `  "${key}": ${JSON.stringify(data, null, 2)},\n`;
}

// Close the object
newTemplatesContent += '};\n\n';

const finalContent = `/* ========================================
   Smart Contract Templates — Pre-compiled
   Compiler: solc 0.8.24
   ======================================== */

${newTemplatesContent}
${EXPLORER_APIS_CONTENT}

${NETWORK_NAMES_CONTENT}

${SHORT_ADDR_CONTENT}
`;

fs.writeFileSync(contractsDataPath, finalContent);
console.log('REPAIRED contracts-data.js successfully.');
