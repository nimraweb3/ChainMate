import { parseAbi } from 'viem';
export const escrowAbi = parseAbi([
  'function create(bytes32 id,address opponent,uint256 stake)',
  'function fund(bytes32 id)',
  'function submitResult(bytes32 id,uint8 outcome,bytes32 recordHash,uint256 nonce,uint256 expiry,bytes signature)',
  'function dispute(bytes32 id,bytes32 evidence)',
  'function settle(bytes32 id)',
  'function recover(bytes32 id)',
  'function cancel(bytes32 id)',
  'function nonces(bytes32) view returns(uint256)',
  'function matches(bytes32) view returns(address white,address black,uint256 stake,uint64 fundingDeadline,uint64 recoveryDeadline,uint64 disputeDeadline,uint8 state,bool whitePaid,bool blackPaid,uint8 outcome,bytes32 recordHash)',
]);
export const tokenAbi = parseAbi([
  'function faucet()',
  'function approve(address,uint256) returns(bool)',
  'function balanceOf(address) view returns(uint256)',
  'function allowance(address,address) view returns(uint256)',
]);
export const resultTypes = {
  Result: [
    { name: 'matchId', type: 'bytes32' },
    { name: 'white', type: 'address' },
    { name: 'black', type: 'address' },
    { name: 'outcome', type: 'uint8' },
    { name: 'recordHash', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
  ],
} as const;
