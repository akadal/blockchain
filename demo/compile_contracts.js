const fs = require('fs');
const path = require('path');
const solc = require('solc');

const contracts = [
    'SimpleAMM.sol',
    'SimpleLending.sol',
    'SimpleYieldFarm.sol',
    'SimpleDAO.sol'
];

const input = {
    language: 'Solidity',
    sources: {},
    settings: {
        outputSelection: {
            '*': {
                '*': ['*']
            }
        },
        evmVersion: 'paris' // Strictly set to Paris as per GEMINI.md
    }
};

contracts.forEach(file => {
    const filePath = path.join(__dirname, file);
    const content = fs.readFileSync(filePath, 'utf8');
    input.sources[file] = { content };
});

console.log('Compiling contracts...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
    output.errors.forEach(err => {
        console.error(err.formattedMessage);
    });
    if (output.errors.some(err => err.severity === 'error')) {
        process.exit(1);
    }
}

const results = {};

for (const file in output.contracts) {
    for (const name in output.contracts[file]) {
        results[name.toLowerCase()] = {
            name: name,
            abi: output.contracts[file][name].abi,
            bytecode: output.contracts[file][name].evm.bytecode.object
        };
    }
}

fs.writeFileSync(path.join(__dirname, 'compiled_results.json'), JSON.stringify(results, null, 2));
console.log('Compilation successful. Results saved to compiled_results.json');
