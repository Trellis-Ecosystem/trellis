#!/usr/bin/env python3
"""Cross-layer type-consistency check (#503).

Fails when the contract's public types (contracts/trellis_core/src/types.rs)
drift from the hand-written copies in the CLI and the frontend:

  * every `EscrowStatus` variant must appear in the frontend `EscrowStatus`
    union (the CLI treats statuses opaquely, so it is not checked);
  * every `Milestone` field must appear in the frontend `Milestone` interface
    and in `milestoneToScVal`;
  * every `Agreement` field must appear in the frontend `Agreement` interface
    or `RawAgreementResponse`, and (for the `init` inputs) in the CLI source.

It compares names only, not field types -- see docs/data-flow.md.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TYPES = ROOT / "contracts/trellis_core/src/types.rs"
CLI = ROOT / "cli/trellis_cli/src/commands/mod.rs"
FRONTEND = ROOT / "frontend/src/lib/soroban.ts"


def block(src: str, header: str, open_ch: str = "{", close_ch: str = "}") -> str:
    m = re.search(header + r"\s*" + re.escape(open_ch), src)
    if not m:
        sys.exit(f"check-type-consistency: could not find `{header}`")
    depth, i = 1, m.end()
    while depth:
        depth += (src[i] == open_ch) - (src[i] == close_ch)
        i += 1
    return src[m.end():i - 1]


def strip_comments(s: str) -> str:
    return re.sub(r"//[^\n]*", "", s)


def rust_fields(body: str) -> list:
    return re.findall(r"^\s*pub (\w+):", strip_comments(body), re.M)


def rust_variants(body: str) -> list:
    return re.findall(r"^\s*([A-Z]\w*)\s*[,({]", strip_comments(body), re.M)


types, cli, fe = (p.read_text() for p in (TYPES, CLI, FRONTEND))
errors = []

# Deliberate gaps, each with a reason. Anything not listed here must match.
KNOWN_GAPS = {
    ("frontend Agreement / RawAgreementResponse", "total_amount"): "derived client-side from milestones",
    ("CLI commands/mod.rs", "released_amounts"): "read-only; CLI prints the RPC JSON as-is",
    ("CLI commands/mod.rs", "dispute_resolver"): "exposed as `init --resolver`",
}


def require(names, haystack, where):
    for n in names:
        if (where, n) in KNOWN_GAPS:
            continue
        if not re.search(r"\b" + re.escape(n) + r"\b", haystack):
            errors.append(f"`{n}` (contract) missing from {where}")


status = rust_variants(block(types, r"pub enum EscrowStatus"))
milestone = rust_fields(block(types, r"pub struct Milestone"))
agreement = rust_fields(block(types, r"pub struct Agreement"))
if not (status and milestone and agreement):
    sys.exit("check-type-consistency: parsed an empty type from types.rs")

fe_status = re.search(r"export type EscrowStatus =(.*?);", fe, re.S).group(1)
require(status, fe_status, "frontend EscrowStatus union")

require(milestone, block(fe, r"export interface Milestone"), "frontend Milestone interface")
require(milestone, block(fe, r"export function milestoneToScVal\([^)]*\)[^{]*"), "frontend milestoneToScVal")
require(milestone, cli, "CLI commands/mod.rs")

fe_agreement = block(fe, r"export interface Agreement") + block(fe, r"export interface RawAgreementResponse")
require(agreement, fe_agreement, "frontend Agreement / RawAgreementResponse")
require(agreement, cli, "CLI commands/mod.rs")

if errors:
    print("Cross-layer type drift detected:", file=sys.stderr)
    for e in errors:
        print(f"  - {e}", file=sys.stderr)
    sys.exit(1)
print(f"OK: {len(status)} statuses, {len(milestone)} Milestone fields, {len(agreement)} Agreement fields consistent")
