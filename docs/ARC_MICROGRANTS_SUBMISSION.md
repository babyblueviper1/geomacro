# Arc Microgrants submission path

## Goal

Create a small, real Arc mainnet proof for Geomacro without turning on the production x402/payment launch flags.

Public surface after deployment:

- `https://geomacro.live/arc-microgrant.html`

## What the proof does

1. Reads `/api/intelligence/state?country=USA` from Geomacro.
2. Builds a compact canonical proof payload from the current state version, as-of time and freshness.
3. Computes SHA-256 locally in the browser.
4. Connects an injected EVM wallet and requires Arc mainnet (`chainId 5042`, `0x13b2`).
5. Sends a zero-value transaction from the wallet to itself with the Geomacro proof in calldata.
6. Exposes the resulting mainnet transaction hash and explorer link.

The only real value spent is Arc gas, which is paid in USDC.

## Safety boundaries

- No private key is stored by Geomacro.
- No server-side signing or custody is introduced.
- Existing Arc Testnet flows are untouched.
- `ARC_MAINNET.live` is not changed.
- Production x402 provider flags remain disabled where they are disabled today.
- The Risk Gate remains non-executing and the mainnet proof does not authorize a payment or business action.

## Mainnet network parameters

- Chain ID: `5042`
- Hex chain ID: `0x13b2`
- RPC: `https://rpc.mainnet.arc.io`
- Gas asset: USDC
- Explorer: `https://explorer.arc.io`

## Final manual acceptance

After this branch is merged and the site is published:

1. Open `https://geomacro.live/arc-microgrant.html`.
2. Load a current state.
3. Connect a wallet that has a small amount of real USDC available for Arc mainnet gas.
4. Confirm the Arc mainnet network.
5. Click `Anchor proof on mainnet` and approve the wallet transaction.
6. Confirm the transaction succeeds in the Arc explorer.
7. Save the live page URL, public repository URL and transaction URL for the DoraHacks submission.

Do not submit until the mainnet transaction has actually confirmed.

## Suggested DoraHacks description

Geomacro is machine-readable geopolitical and macro risk infrastructure for autonomous systems. This Arc mainnet experiment takes a current Geomacro intelligence state, creates a deterministic local proof, and anchors that proof on Arc in a wallet-signed transaction. It demonstrates a minimal production-safe bridge between offchain risk intelligence and verifiable onchain state without enabling Geomacro's broader production payment rails.

## Suggested proof links

- Live app: `https://geomacro.live/arc-microgrant.html`
- Repository: `https://github.com/blocknine0/geomacro`
- Mainnet transaction: add after final acceptance
