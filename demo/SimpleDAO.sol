// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Basic Governance Token with Snapshot capability for voting power
contract GovernanceToken {
    string public name = "DAO Governance Token";
    string public symbol = "GOV";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // simplistic voting power snapshot (balance at block number)
    // For a real DAO, we'd use checkpoints, but this is a simplified demo
    mapping(address => uint256) public votingPower;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // Give founder initial supply
    constructor(uint256 initialSupply) {
        _mint(msg.sender, initialSupply);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        balanceOf[to] += amount;
        totalSupply += amount;
        votingPower[to] = balanceOf[to]; // simplified sync
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;

        votingPower[msg.sender] = balanceOf[msg.sender];
        votingPower[to] = balanceOf[to];

        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;

        votingPower[from] = balanceOf[from];
        votingPower[to] = balanceOf[to];

        emit Transfer(from, to, amount);
        return true;
    }

    // For DAO contract to read
    function getVotes(address account) external view returns (uint256) {
        return votingPower[account];
    }
}

contract SimpleDAO {
    GovernanceToken public govToken;

    struct Proposal {
        uint256 id;
        string description;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 deadline;
        bool executed;
        address proposer;
    }

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(uint256 id, string description, address proposer, uint256 deadline);
    event VoteCast(uint256 id, address voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 id, bool passed);

    constructor(address _govTokenAddress) {
        govToken = GovernanceToken(_govTokenAddress);
    }

    function createProposal(string memory _description) external returns (uint256) {
        // Require at least some voting power to propose
        require(govToken.getVotes(msg.sender) > 0, "No voting power to propose");

        proposalCount++;
        uint256 pId = proposalCount;

        proposals[pId] = Proposal({
            id: pId,
            description: _description,
            votesFor: 0,
            votesAgainst: 0,
            deadline: block.timestamp + 10 minutes, // Short deadline for testing
            executed: false,
            proposer: msg.sender
        });

        emit ProposalCreated(pId, _description, msg.sender, proposals[pId].deadline);
        return pId;
    }

    function castVote(uint256 _proposalId, bool _support) external {
        Proposal storage p = proposals[_proposalId];
        require(block.timestamp < p.deadline, "Voting ended");
        require(!hasVoted[_proposalId][msg.sender], "Already voted");

        uint256 weight = govToken.getVotes(msg.sender);
        require(weight > 0, "No voting power");

        hasVoted[_proposalId][msg.sender] = true;

        if (_support) {
            p.votesFor += weight;
        } else {
            p.votesAgainst += weight;
        }

        emit VoteCast(_proposalId, msg.sender, _support, weight);
    }

    function executeProposal(uint256 _proposalId) external {
        Proposal storage p = proposals[_proposalId];
        require(block.timestamp >= p.deadline, "Voting not ended yet");
        require(!p.executed, "Already executed");

        p.executed = true;
        bool passed = p.votesFor > p.votesAgainst;

        emit ProposalExecuted(_proposalId, passed);
    }

    // View function to get proposal details
    function getProposal(uint256 _id) external view returns (
        uint256 id, string memory description, uint256 votesFor, uint256 votesAgainst, uint256 deadline, bool executed, address proposer
    ) {
        Proposal memory p = proposals[_id];
        return (p.id, p.description, p.votesFor, p.votesAgainst, p.deadline, p.executed, p.proposer);
    }
}
