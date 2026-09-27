# Geomacro · Arc Microgrants submission

## One-line pitch

Geomacro turns live geopolitical and macro risk states into tamper-evident proofs that can be anchored and independently verified on Arc mainnet.

## Why this exists

AI agents and automated treasury systems increasingly make decisions from offchain data. The hard part is proving, later, exactly which risk state informed a decision.

Geomacro already produces machine-readable risk intelligence. This Arc mainnet proof adds a simple trust layer: generate a deterministic proof from a current Geomacro state, anchor the proof record on Arc, then let any reviewer recompute and verify it from the transaction itself.

The point is not to put the full intelligence dataset onchain. The point is to make the exact state used at a moment in time independently auditable.

## Live flow

Public page after deployment:

- `https://geomacro.live/arc-microgrant.html`

The flow is intentionally small:

1. **Generate** — load a current Geomacro country risk state.
2. **Anchor** — create a deterministic SHA-256 proof and write the public proof record to an Arc mainnet transaction.
3. **Verify** — paste the transaction hash; the page reads Arc mainnet, decodes the record, recomputes the hash and returns `VERIFIED` only if everything matches.

## What is written on Arc

Proof format:

`GEOMACRO_ARC_MAINNET_V2|<country>|<state_version>|<as_of>|<freshness>|<sha256_proof>`

The proof hash is derived from:

- schema version
- ISO3 country
- Geomacro state version
- as-of timestamp
- freshness status

The transaction is wallet-to-self with value `0`. Only Arc gas is spent.

## Arc mainnet

- Chain ID: `5042`
- Hex: `0x13b2`
- RPC: `https://rpc.mainnet.arc.io`
- Gas asset: USDC
- Explorer: `https://explorer.arc.io`

## Safety boundaries

This Microgrants implementation is deliberately isolated from Geomacro's wider payment launch.

- No private key is stored by Geomacro.
- The user signs directly in their wallet.
- Existing Arc Testnet flows remain unchanged.
- `ARC_MAINNET.live` is not globally enabled.
- Production x402 flags remain unchanged.
- The Risk Gate remains non-executing.
- The proof does not authorize a payment or business action.
- No personal data, secrets or raw source material is written onchain.

## Final acceptance before submission

Do not submit until all of these are true:

- [ ] `https://geomacro.live/arc-microgrant.html` loads publicly.
- [ ] Current Geomacro state loads successfully.
- [ ] Browser wallet switches to Arc mainnet.
- [ ] A real Arc mainnet proof transaction confirms.
- [ ] The transaction is visible on `explorer.arc.io`.
- [ ] Pasting the same transaction into **Verify** returns `VERIFIED`.
- [ ] Repository is public.
- [ ] The live URL, repository URL and Arc transaction URL are included in the DoraHacks submission.
- [ ] A short screen recording shows Generate → Anchor → Verify.

## Human submission copy

### Project name

**Geomacro · Arc Risk Proof**

### Short description

Geomacro is a geopolitical and macro risk intelligence layer for machines. For this Arc deployment, I wanted to solve a very specific trust problem: if an AI agent or treasury system acts on an offchain risk signal, how can someone later prove which state it actually used?

The demo loads a current Geomacro risk state, creates a deterministic proof in the browser, and anchors that proof on Arc mainnet. Anyone can paste the transaction hash back into the verifier, which reads the Arc transaction and recomputes the proof independently.

It is intentionally small and auditable. The wallet signs directly, the transaction sends zero value, and only Arc gas is spent. Geomacro never receives the private key and the broader production payment rails stay disabled.

### Why Arc

Arc gives the proof a public, timestamped and independently readable execution layer while keeping the interaction simple for USDC-native applications. Instead of asking users to trust a screenshot or a database record, I can point to one Arc transaction and reproduce the proof from it.

### What is working today

- live Geomacro intelligence state
- deterministic SHA-256 proof generation
- real Arc mainnet wallet transaction
- proof data stored in transaction calldata
- independent transaction verification
- public Arc explorer proof
- public source code

### What I would use the 500 USDC for

The next step is to move from country-level state proofs to agent-consumable signed Risk Object attestations on Arc, then connect that verification layer to Geomacro's machine-payment API. The grant would cover Arc mainnet testing, transaction costs, monitoring and the first production verification workflow for external agent integrators.

## Links to include

- Live demo: `https://geomacro.live/arc-microgrant.html`
- Main product: `https://geomacro.live`
- Source: `https://github.com/blocknine0/geomacro`
- Arc mainnet transaction: **add after final acceptance**

## 60-second demo script

> Geomacro provides machine-readable geopolitical and macro risk intelligence. The problem I am testing here is simple: when an automated system uses an offchain risk state, I want that exact state to be auditable later. I load a current Geomacro state, generate its deterministic proof, and anchor the public proof record on Arc mainnet. The wallet signs the transaction directly. Now I can paste the transaction hash into the verifier. It reads the Arc transaction, rebuilds the proof from the onchain record, and only returns VERIFIED when the recomputed hash matches. This gives an AI agent or treasury workflow a simple way to prove which Geomacro state existed at the point of decision without putting the underlying dataset onchain.
