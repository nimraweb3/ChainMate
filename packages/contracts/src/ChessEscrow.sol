// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import {Pausable} from '@openzeppelin/contracts/utils/Pausable.sol';
import {EIP712} from '@openzeppelin/contracts/utils/cryptography/EIP712.sol';
import {ECDSA} from '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
contract ChessEscrow is ReentrancyGuard,Pausable,EIP712 {
 using SafeERC20 for IERC20;
 enum State {None,Open,Active,Pending,Disputed,Settled,Cancelled}
 struct Match {address white;address black;uint256 stake;uint64 fundingDeadline;uint64 recoveryDeadline;uint64 disputeDeadline;State state;bool whitePaid;bool blackPaid;uint8 outcome;bytes32 recordHash;}
 IERC20 public immutable token;address public immutable authority;
 uint256 public constant MAX_STAKE=1000*10**6;uint64 public constant DISPUTE_WINDOW=120;uint64 public constant RECOVERY_WINDOW=1 days;
 bytes32 public constant RESULT_TYPEHASH=keccak256('Result(bytes32 matchId,address white,address black,uint8 outcome,bytes32 recordHash,uint256 nonce,uint256 expiry)');
 mapping(bytes32=>Match) public matches;mapping(bytes32=>uint256) public nonces;
 event MatchCreated(bytes32 indexed id,address white,address black,uint256 stake);
 event Funded(bytes32 indexed id,address player);event Activated(bytes32 indexed id);
 event ResultPending(bytes32 indexed id,uint8 outcome,bytes32 recordHash,uint64 deadline);
 event Disputed(bytes32 indexed id,address player,bytes32 evidence);
 event Settled(bytes32 indexed id,uint8 outcome);event Cancelled(bytes32 indexed id);event Refunded(bytes32 indexed id,address player,uint256 amount);
 error InvalidState();error Unauthorized();error InvalidInput();error InvalidSignature();error Deadline();
 constructor(IERC20 t,address signer) EIP712('ChainMate','1'){require(block.chainid==31337||block.chainid==84532,'TESTNET ONLY');if(address(t)==address(0)||signer==address(0))revert InvalidInput();token=t;authority=signer;}
 function create(bytes32 id,address opponent,uint256 stake) external whenNotPaused {if(matches[id].state!=State.None||id==bytes32(0)||opponent==address(0)||opponent==msg.sender||stake==0||stake>MAX_STAKE)revert InvalidInput();matches[id]=Match(msg.sender,opponent,stake,uint64(block.timestamp+15 minutes),uint64(block.timestamp+RECOVERY_WINDOW),0,State.Open,false,false,0,bytes32(0));emit MatchCreated(id,msg.sender,opponent,stake);}
 function fund(bytes32 id) external nonReentrant whenNotPaused {Match storage m=matches[id];if(m.state!=State.Open)revert InvalidState();if(block.timestamp>=m.fundingDeadline)revert Deadline();if(msg.sender==m.white&&!m.whitePaid)m.whitePaid=true;else if(msg.sender==m.black&&!m.blackPaid)m.blackPaid=true;else revert Unauthorized();uint256 beforeBalance=token.balanceOf(address(this));token.safeTransferFrom(msg.sender,address(this),m.stake);if(token.balanceOf(address(this))-beforeBalance!=m.stake)revert InvalidInput();emit Funded(id,msg.sender);if(m.whitePaid&&m.blackPaid){m.state=State.Active;emit Activated(id);}}
 function submitResult(bytes32 id,uint8 outcome,bytes32 recordHash,uint256 nonce,uint256 expiry,bytes calldata signature) external whenNotPaused {Match storage m=matches[id];if(m.state!=State.Active)revert InvalidState();if(outcome<1||outcome>3||recordHash==bytes32(0)||nonce!=nonces[id])revert InvalidInput();if(block.timestamp>expiry||block.timestamp>=m.recoveryDeadline)revert Deadline();bytes32 d=_hashTypedDataV4(keccak256(abi.encode(RESULT_TYPEHASH,id,m.white,m.black,outcome,recordHash,nonce,expiry)));if(ECDSA.recover(d,signature)!=authority)revert InvalidSignature();nonces[id]++;m.outcome=outcome;m.recordHash=recordHash;m.state=State.Pending;m.disputeDeadline=uint64(block.timestamp+DISPUTE_WINDOW);emit ResultPending(id,outcome,recordHash,m.disputeDeadline);}
 function dispute(bytes32 id,bytes32 evidence) external {Match storage m=matches[id];if(msg.sender!=m.white&&msg.sender!=m.black)revert Unauthorized();if(m.state!=State.Pending)revert InvalidState();if(block.timestamp>=m.disputeDeadline)revert Deadline();m.state=State.Disputed;emit Disputed(id,msg.sender,evidence);}
 function settle(bytes32 id) external nonReentrant {Match storage m=matches[id];if(m.state!=State.Pending)revert InvalidState();if(block.timestamp<m.disputeDeadline)revert Deadline();_payout(id,m,m.outcome);}
 function resolve(bytes32 id,uint8 outcome) external nonReentrant {if(msg.sender!=authority)revert Unauthorized();Match storage m=matches[id];if(m.state!=State.Disputed)revert InvalidState();if(block.timestamp>=m.recoveryDeadline)revert Deadline();if(outcome<1||outcome>3)revert InvalidInput();_payout(id,m,outcome);}
 function recover(bytes32 id) external nonReentrant {Match storage m=matches[id];if(m.state==State.Open){if(block.timestamp<m.fundingDeadline)revert Deadline();}else if(m.state==State.Active||m.state==State.Disputed){if(block.timestamp<m.recoveryDeadline)revert Deadline();}else revert InvalidState();m.state=State.Cancelled;if(m.whitePaid){token.safeTransfer(m.white,m.stake);emit Refunded(id,m.white,m.stake);}if(m.blackPaid){token.safeTransfer(m.black,m.stake);emit Refunded(id,m.black,m.stake);}emit Cancelled(id);}
 function _payout(bytes32 id,Match storage m,uint8 outcome) private {m.state=State.Settled;m.outcome=outcome;if(outcome==3){token.safeTransfer(m.white,m.stake);token.safeTransfer(m.black,m.stake);}else token.safeTransfer(outcome==1?m.white:m.black,m.stake*2);emit Settled(id,outcome);}
 function setPaused(bool value) external {if(msg.sender!=authority)revert Unauthorized();if(value)_pause();else _unpause();}
}
