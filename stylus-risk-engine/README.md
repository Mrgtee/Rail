# Rail Stylus Risk Engine Proof Module

This is the optional Rust/Stylus-facing risk engine for Rail. It mirrors the Solidity `PolicyVault` checks in a compact deterministic function that can be wrapped with `stylus-sdk` for Arbitrum Stylus deployment.

It currently includes pure Rust logic and unit tests so the policy semantics are easy to audit:

- active policy requirement
- expiry check
- cooldown check
- spend limit
- monthly cap
- slippage cap
- minimum reserve

Local commands when Rust tooling is installed:

```bash
cargo test --manifest-path stylus-risk-engine/Cargo.toml
cargo stylus check --manifest-path stylus-risk-engine/Cargo.toml
```

This module is not required for the main Rail demo path. The Solidity contracts remain the primary enforcement layer.
