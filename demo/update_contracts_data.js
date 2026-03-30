const fs = require('fs');
const path = require('path');

const compiledResults = require('./compiled_results.json');
const lendingSource = fs.readFileSync('SimpleLending.sol', 'utf8');
const farmSource = fs.readFileSync('SimpleYieldFarm.sol', 'utf8');
const ammSource = fs.readFileSync('SimpleAMM.sol', 'utf8');

const contractsDataPath = path.join(__dirname, 'js', 'contracts-data.js');
let content = fs.readFileSync(contractsDataPath, 'utf8');

// Helper to update or add a template
function updateTemplate(key, data) {
    const regex = new RegExp(`"${key}":\\s*\\{[\\s\\S]*?\\n\\s{2}\\},?`, 'm');
    const newEntry = `"${key}": ${JSON.stringify(data, null, 2)},`;
    
    if (regex.test(content)) {
        content = content.replace(regex, newEntry);
    } else {
        // Find the last closing brace of the root object
        const lastBraceIndex = content.lastIndexOf('};');
        if (lastBraceIndex !== -1) {
            content = content.slice(0, lastBraceIndex) + `  ${newEntry}\n` + content.slice(lastBraceIndex);
        }
    }
}

const daoSource = fs.readFileSync('SimpleDAO.sol', 'utf8');

const ammData = {
    name: "SimpleAMM",
    desc: "A basic constant-product Automated Market Maker (AMM). Now also an ERC20 for LP tokens.",
    source: ammSource,
    abi: compiledResults.simpleamm.abi,
    bytecode: "0x" + compiledResults.simpleamm.bytecode,
    constructorArgs: ["address _tokenA", "address _tokenB"]
};

const lendingData = {
    name: "SimpleLending",
    desc: "A collateralized lending platform. Users can deposit tokens as collateral and borrow up to a certain ratio.",
    source: lendingSource,
    abi: compiledResults.simplelending.abi,
    bytecode: "0x" + compiledResults.simplelending.bytecode,
    constructorArgs: ["address _token"]
};

const farmData = {
    name: "SimpleYieldFarm",
    desc: "A yield farming contract that rewards users for staking LP tokens.",
    source: farmSource,
    abi: compiledResults.simpleyieldfarm.abi,
    bytecode: "0x" + compiledResults.simpleyieldfarm.bytecode,
    constructorArgs: ["address _lpToken", "address _rewardToken"]
};

const daoData = {
    name: "SimpleDAO",
    desc: "A basic DAO contract where members can create proposals and vote using governance tokens.",
    source: daoSource,
    abi: compiledResults.simpledao.abi,
    bytecode: "0x" + compiledResults.simpledao.bytecode,
    constructorArgs: ["address _govTokenAddress"]
};

const govTokenData = {
    name: "GovernanceToken",
    desc: "A basic ERC20 token with weight-based voting power for DAO governance.",
    source: daoSource, // GovernanceToken is in the same file
    abi: compiledResults.governancetoken.abi,
    bytecode: "0x" + compiledResults.governancetoken.bytecode,
    constructorArgs: ["uint256 initialSupply"]
};

updateTemplate("simpleamm", ammData);
updateTemplate("simplelending", lendingData);
updateTemplate("simpleyieldfarm", farmData);
updateTemplate("simpledao", daoData);
updateTemplate("governancetoken", govTokenData);

fs.writeFileSync(contractsDataPath, content);
console.log('Updated contracts-data.js successfully.');
