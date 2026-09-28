#!/usr/bin/env python3
"""Independent second reference implementation of geomacro-canonical-json-v1 + gro-1.1 Risk Object verification.

Written from docs/GRO_CANONICAL_JSON_V1.md only (no Geomacro code), in Python, so canonicalization is checked across two
language runtimes. Canonicalization is standard-library only; Ed25519 verification needs `cryptography` and is used only
by the --object mode. The key is taken from the LIVE registry, never from the object's embedded key.

    python3 verifiers/python/verify_gro.py --vectors test-vectors/gro-canonical-json-v1-edge-vectors.json   # offline, CI
    python3 verifiers/python/verify_gro.py --object risk-object.json                                        # live registry
Contributed by invinoveritas (babyblueviper1), CC0."""
import base64, copy, hashlib, json, math, sys, urllib.request
from datetime import datetime, timezone


def js_number(x):
    """ECMAScript Number::toString(10) (what JSON.stringify emits for finite numbers)."""
    if isinstance(x, bool):
        raise TypeError
    if isinstance(x, int):
        x = float(x) if abs(x) >= 2**53 else x
        if isinstance(x, int):
            return str(x)
    if not math.isfinite(x):
        raise ValueError("non-finite")
    if x == 0:
        return "0"                       # spec: negative zero -> 0
    sign = "-" if x < 0 else ""
    r = repr(abs(x))                     # shortest round-trip digits, same as JS
    m, _, e = r.lower().partition("e")
    exp10 = int(e) if e else 0
    if "." in m:
        ip, fp = m.split(".")
    else:
        ip, fp = m, ""
    digits = (ip + fp).lstrip("0")
    lead_zeros = len(ip + fp) - len((ip + fp).lstrip("0"))
    n = len(ip) - lead_zeros + exp10     # decimal point position relative to digits
    digits = digits.rstrip("0") or "0"
    k = len(digits)
    if k <= n <= 21:
        out = digits + "0" * (n - k)
    elif 0 < n <= 21:
        out = digits[:n] + "." + digits[n:]
    elif -6 < n <= 0:
        out = "0." + "0" * (-n) + digits
    else:
        e_ = n - 1
        es = ("+" if e_ >= 0 else "-") + str(abs(e_))
        out = digits[0] + ("" if k == 1 else "." + digits[1:]) + "e" + es
    return sign + out


def js_string(s):
    out = ['"']
    for ch in s:
        o = ord(ch)
        if ch == '"': out.append('\\"')
        elif ch == "\\": out.append("\\\\")
        elif ch == "\b": out.append("\\b")
        elif ch == "\f": out.append("\\f")
        elif ch == "\n": out.append("\\n")
        elif ch == "\r": out.append("\\r")
        elif ch == "\t": out.append("\\t")
        elif o < 0x20: out.append("\\u%04x" % o)
        else: out.append(ch)             # JSON.stringify does not escape non-ASCII
    out.append('"')
    return "".join(out)


def canon(v):
    if v is None: return "null"
    if v is True: return "true"
    if v is False: return "false"
    if isinstance(v, (int, float)): return js_number(v)
    if isinstance(v, str): return js_string(v)
    if isinstance(v, list): return "[" + ",".join(canon(i) for i in v) + "]"
    if isinstance(v, dict):
        keys = sorted(v.keys(), key=lambda k: k.encode("utf-16-be"))   # UTF-16 code-unit order
        return "{" + ",".join(js_string(k) + ":" + canon(v[k]) for k in keys) + "}"
    raise TypeError(type(v))


def signable(obj):
    o = copy.deepcopy(obj)
    o["integrity"]["payload_hash"] = None
    o["integrity"]["signature"] = None
    return canon(o).encode("utf-8")


def verify(obj, registry_keys, now=None):
    r = {}
    integ = obj["integrity"]
    key = next((k for k in registry_keys if k["key_id"] == integ["signing_key_id"]), None)
    r["key_in_registry"] = key is not None
    if not key:
        return r
    r["embedded_key_matches_registry"] = integ.get("public_key_spki_b64") == key["public_key_spki_b64"]
    msg = signable(obj)
    r["payload_hash_recomputes"] = hashlib.sha256(msg).hexdigest() == integ["payload_hash"]
    try:
        from cryptography.hazmat.primitives.serialization import load_der_public_key
        pk = load_der_public_key(base64.b64decode(key["public_key_spki_b64"]))
        pk.verify(base64.b64decode(integ["signature"]), msg)
        r["ed25519_signature_valid"] = True
    except Exception:
        r["ed25519_signature_valid"] = False
    now = now or datetime.now(timezone.utc)
    exp = datetime.fromisoformat(obj["expires_at"].replace("Z", "+00:00"))
    r["not_expired_at_now"] = now < exp
    return r


def check_vectors(path):
    v = json.load(open(path))
    got = canon(json.loads(v["input_json_text"]))
    sha = hashlib.sha256(got.encode("utf-8")).hexdigest()
    ok = got == v["canonical_json"] and sha == v["canonical_sha256"]
    print(json.dumps({"vectors": path, "canonical_matches": got == v["canonical_json"], "sha256_matches": sha == v["canonical_sha256"],
                      "sha256": sha}, indent=1))
    return ok


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--vectors":
        sys.exit(0 if check_vectors(sys.argv[2]) else 1)
    if len(sys.argv) == 3 and sys.argv[1] == "--object":
        obj = json.load(open(sys.argv[2]))
        reg = json.load(urllib.request.urlopen(urllib.request.Request("https://geomacro.live/api/risk-object-keys", headers={"User-Agent": "curl/8"}), timeout=20))["keys"]
        res = verify(obj, reg)
        print(json.dumps(res, indent=1))
        sys.exit(0 if all(res.values()) else 1)
    sys.exit("usage: verify_gro.py --vectors <file> | --object <risk-object.json>")
