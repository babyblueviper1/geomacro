import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../../public/arc-microgrant.html', import.meta.url), 'utf8');
const arc = await readFile(new URL('../../src/lib/arc.ts', import.meta.url), 'utf8');
const discovery = await readFile(new URL('../../src/lib/x402-discovery.server.ts', import.meta.url), 'utf8');

function requireText(haystack, needle, label) {
  if (!haystack.includes(needle)) throw new Error(`${label}: missing ${needle}`);
}

requireText(page, "const ARC_CHAIN_ID='0x13b2'", 'Arc mainnet chain lock');
requireText(page, "const ARC_RPC='https://rpc.mainnet.arc.io'", 'Arc mainnet RPC');
requireText(page, "const PREFIX='GEOMACRO_ARC_MAINNET_V2'", 'Proof schema');
requireText(page, "value:'0x0'", 'Zero-value anchor');
requireText(page, "from:account,to:account", 'Self-transaction boundary');
requireText(page, "eth_getTransactionByHash", 'Independent verification');
requireText(page, "eth_getTransactionReceipt", 'Confirmation verification');
requireText(page, "recomputed!==proof", 'Hash recomputation');
requireText(page, "execution_authorized!==false", 'Risk Gate safety check');

requireText(arc, 'chainIdDec: 5042', 'Canonical Arc mainnet chain');
requireText(arc, 'live: false', 'Global mainnet safety lock');
requireText(discovery, 'arc_mainnet_enabled: false', 'x402 mainnet safety lock');

if (/PRIVATE_KEY|SECRET_KEY|MNEMONIC/.test(page)) {
  throw new Error('Microgrant page must not reference private-key material');
}

console.log('Arc Microgrants static readiness: PASS');
