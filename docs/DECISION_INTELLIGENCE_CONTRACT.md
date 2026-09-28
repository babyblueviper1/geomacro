# Geomacro Decision Intelligence Contract

## Product position

Geomacro is not a raw-data API. It delivers concise, machine-readable decision intelligence derived from governed stored state and verified real-time fallback sources.

The permanent delivery order is:

1. answer the question directly;
2. state the current risk and confidence;
3. explain the cause using `Geomacro detects this because ...`;
4. identify the most material verified drivers;
5. explain why the state matters for the requested subject;
6. expose a bounded decision action and guardrail;
7. show what changed from the prior verified state when available;
8. expose what to watch next;
9. include freshness, evidence quality and a state version for repeat checks.

## Commercial architecture

Geomacro must not grow a warehouse simply to claim global coverage.

For every requested module:

- use governed stored state when it is current and commercially eligible;
- when the required state is absent or stale, retrieve from approved real-time or near-real-time public/authorized sources;
- cross-check and normalize source observations before deriving intelligence;
- do not redistribute upstream raw payloads, full articles, source dumps or private warehouse material;
- if the required evidence cannot be verified to the module freshness and commercial-delivery contract, fail closed and do not accept payment.

Only compact state, evidence metadata, integrity hashes, payment/reconciliation records and short-lived operational cache should be retained when required for trust, replay safety or continuity.

## Decision Intelligence Object

The customer-facing object is intentionally compact. The canonical v1 fields are:

- `status`
- `risk.level`
- `risk.score`
- `risk.confidence`
- `freshness`
- `answer`
- `cause`
- `geomacro_detected`
- `why_it_matters`
- `decision.action`
- `decision.guardrail`
- `change`
- `watch_next`
- `evidence_quality`
- `state_version`
- `as_of`

The output boundary is `DERIVED_DECISION_INTELLIGENCE_ONLY` and `raw_data_delivered` must remain `false`.

## Repeat-use moat

The repeat-use value is state continuity, not data volume. A later request should be able to answer what changed, why it changed, whether that change is material, and what currently deserves attention. This must be based on compact versioned state and governed evidence rather than retaining the complete upstream dataset.

## Safety and execution boundary

Decision actions are bounded intelligence labels for a caller or policy engine. Geomacro does not autonomously execute transactions, custody funds, sign transactions, replace sanctions screening, or provide legal or financial advice. `execution_authorized` remains `false` in the commercial intelligence response.
