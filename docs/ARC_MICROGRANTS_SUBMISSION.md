# Geomacro Arc Microgrants submission

## Project name

Geomacro Arc Risk Proof

## One-line pitch

Geomacro turns live geopolitical and macro risk states into tamper-evident proofs that can be anchored and independently verified on Arc mainnet.

## Short description

Geomacro is a machine-readable geopolitical and macro risk intelligence layer. This Arc deployment focuses on one practical trust problem: when an AI agent or automated treasury acts on an offchain risk signal, how can someone later prove exactly which state informed that decision?

The demo loads a current Geomacro risk state, creates a deterministic SHA-256 proof in the browser, and anchors a compact public proof record on Arc mainnet. Anyone can paste the transaction hash into the verifier. The verifier reads the Arc transaction, reconstructs the same proof input, recomputes the hash, decodes the onchain proof fields into a human-readable panel, and returns `VERIFIED` only when everything matches.

The underlying intelligence dataset stays offchain. Arc is used as the public, timestamped verification layer for the exact state that existed at the point of decision.

## Live demo

`https://geomacro.live/arc-microgrant.html`

The flow is deliberately simple:

1. Generate a proof from a current Geomacro country risk state.
2. Anchor the proof record on Arc mainnet with a wallet-signed transaction.
3. Verify the transaction independently from Arc and recompute the proof.
4. Decode the confirmed transaction into the exact proof metadata that was anchored.

## Confirmed Arc mainnet proof

This proof was generated from the live Geomacro site and successfully verified after confirmation on Arc mainnet.

- Network: Arc Mainnet
- Chain ID: `5042`
- Country: `USA`
- State version: `gstate_3c96a1b637d773c8447e6baacf5e297e`
- As of: `2026-09-27T08:56:48.491Z`
- Freshness: `CURRENT`
- SHA-256 proof: `b02ed954dae3ec1035c06242f928e732b17adfe0925755f7f92f45ea6c1a6918`
- Transaction: `0x53bd3e998b482725e72d40ea914dc800d047c3ef6a254dce04946b8701d452fe`
- Confirmed block: `23003294`
- Explorer: `https://explorer.arc.io/tx/0x53bd3e998b482725e72d40ea914dc800d047c3ef6a254dce04946b8701d452fe`
- Verification result: `VERIFIED`

The verifier confirmed that the Arc transaction is confirmed, zero-value, self-sent, and that the Geomacro proof recomputes exactly from the onchain proof record.

## What is written on Arc

Proof format:

`GEOMACRO_ARC_MAINNET_V2|<country>|<state_version>|<as_of>|<freshness>|<sha256_proof>`

The proof hash is derived from:

- schema version
- ISO3 country
- Geomacro state version
- as-of timestamp
- freshness status

After verification, the live demo shows the decoded values, the canonical JSON used for hashing, and the raw UTF-8 proof record recovered from transaction calldata.

The transaction is wallet-to-self with value `0`. Only Arc gas is spent. The full underlying risk dataset is not written onchain.

## Why Arc

Arc gives Geomacro a public and independently readable verification layer for machine decisions that depend on offchain intelligence.

Instead of asking a reviewer, an AI agent, or a treasury operator to trust a screenshot or a database row, Geomacro can point to one Arc mainnet transaction. The transaction contains enough public proof material to reproduce the exact hash and confirm which intelligence state was used.

This is especially useful for agentic systems because the proof is small, deterministic, machine-readable, and does not require publishing the underlying intelligence dataset onchain.

## What is working now

- live Geomacro intelligence state
- deterministic SHA-256 proof generation
- real Arc mainnet wallet transaction
- compact proof record in transaction calldata
- independent transaction verification
- decoded human-readable onchain proof fields
- verified current-state proof on Arc mainnet
- public live demo
- public source code
- no custody of wallet private keys

## Safety boundaries

This Arc proof implementation is intentionally isolated from Geomacro's wider payment launch.

- Geomacro does not store private keys.
- The wallet signs the Arc transaction directly.
- The proof transaction sends zero value.
- Existing Arc Testnet flows remain unchanged.
- Arc mainnet is not globally enabled for Geomacro's production payment system.
- Production x402 flags remain unchanged.
- The Risk Gate remains non-executing.
- The proof does not authorize a payment or business action.
- No personal data, secrets, or raw source material is written onchain.
- Unavailable, stale, or commercially ineligible x402 intelligence remains fail-closed and does not trigger production payment or execution.

## What I would use the 500 USDC for

I would use the grant to move this from a country-state proof into a reusable Arc verification layer for AI agents.

The next milestone is signed Risk Object attestations that agents can verify before making a payment or business decision. The funding would cover Arc mainnet testing, transaction costs, monitoring, proof lifecycle tooling, and the first production-grade verification workflow for external agent integrations.

The goal is to make Geomacro intelligence not only machine-readable, but independently provable at the moment an automated decision is made.

## Links for the submission

- Live demo: `https://geomacro.live/arc-microgrant.html`
- Main product: `https://geomacro.live`
- Source code: `https://github.com/blocknine0/geomacro`
- Arc mainnet proof: `https://explorer.arc.io/tx/0x53bd3e998b482725e72d40ea914dc800d047c3ef6a254dce04946b8701d452fe`

## Final acceptance

- [x] Live Arc proof page is published.
- [x] Current Geomacro state loads successfully.
- [x] Browser wallet connects to Arc mainnet.
- [x] A real Arc mainnet proof transaction confirmed.
- [x] Proof transaction hash is recorded.
- [x] Pasting the transaction into the verifier returns `VERIFIED`.
- [x] Freshness was `CURRENT` at proof generation.
- [x] Repository is public.
- [x] Live URL, repository URL, and Arc transaction URL are ready for the submission.
- [x] Verifier decodes the onchain proof metadata into human-readable fields.
- [ ] Record a short screen video showing Generate, Anchor, Verify, and Decoded Onchain Data.
- [ ] Submit the BUIDL on DoraHacks from the project owner's account.

## 60-second demo script

Geomacro provides machine-readable geopolitical and macro risk intelligence. The problem I am testing here is simple. If an automated system uses an offchain risk state, I want that exact state to be auditable later.

I load a current Geomacro state and generate a deterministic proof from it. I then anchor that public proof record on Arc mainnet with a wallet-signed, zero-value transaction.

Now I paste the transaction hash into the verifier. It reads the Arc transaction, rebuilds the proof from the onchain record, and only returns VERIFIED when the recomputed hash matches. The page also decodes the exact country, state version, timestamp, freshness, proof hash, canonical JSON, and raw proof record recovered from Arc calldata.

This means an AI agent or treasury workflow can prove which Geomacro intelligence state existed at the point of decision without putting the underlying dataset onchain.

## Very short version for small text fields

Geomacro turns live geopolitical and macro risk intelligence into deterministic proofs that can be anchored and independently verified on Arc mainnet. The live demo has already produced a confirmed Arc mainnet transaction, and the verifier recomputes and decodes the proof directly from the transaction record.
