# Hearth 🔥⚒

**A warm, elegant desktop GUI for the [Foundry](https://github.com/foundry-rs/foundry) toolchain.**

English · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

Hearth wraps your local `forge`, `cast`, `anvil` and `chisel` binaries in a clean, Claude-style desktop app — deploy contracts, send transactions, trace failures and spin up local chains without memorizing a single flag.

<p align="center">
  <img src="docs/screenshot.png" alt="Hearth — light" width="49.5%">
  <img src="docs/screenshot-dark.png" alt="Hearth — dark" width="49.5%">
</p>

## Download

Grab the latest `.dmg` from [**Releases**](https://github.com/Cafexss/hearth-foundry-gui/releases) (Apple Silicon & Intel).
The app is unsigned — on first launch, right-click the app and choose **Open**, or run `xattr -dr com.apple.quarantine /Applications/Hearth.app`.

## Requirements

- [Foundry](https://getfoundry.sh) (`forge` / `cast` / `anvil` / `chisel` in `~/.foundry/bin` or on `PATH`)
- Node.js ≥ 18

## Run

```bash
npm install
npm start
```

## Features

| Module | What it does |
|--------|--------------|
| **Dashboard** | Live network status (block height, gas price, RPC latency), toolchain versions, quick balance lookup, local transaction history |
| **Build & Test** (forge) | Create or open a Foundry project; one-click build / test / fmt / snapshot / coverage with streaming output and test filters |
| **Deploy** (forge create / script) | Single-contract deploys with auto-parsed constructor args and dry-run simulation, plus full `forge script` support — simulate, broadcast, and parse every transaction from `run-latest.json` |
| **ABI Workbench** | Load an ABI from project artifacts or pasted JSON and get a clickable function panel: batch-read all view functions, call with args, estimate & send writes, payable value support |
| **Transfer** (cast send) | Native coin transfers (with a max-minus-gas button) and ERC-20 transfers with automatic decimals conversion, plus approve / unlimited approve / allowance |
| **Contract Calls** (cast call / send) | Read & write with function signatures, gas estimation from the real sender, raw-calldata mode for unverified contracts, and a raw `cast` passthrough |
| **Chain Queries** (cast) | Balance / nonce / code / tx / receipt / block / storage slots |
| **Debug & Logs** (cast run / logs) | Replay transaction traces, trace simulated calls with colorized output, query event logs by address, signature and block range |
| **Encode & Convert** (cast) | Unit & base conversion, Keccak-256, selectors & event topics, ABI encode / calldata decode, checksums, 4byte lookup |
| **Wallet Tools** (cast wallet) | Generate wallets & mnemonics, derive addresses, sign & verify messages, import and list keystores |
| **Anvil Node** | One-click local chain with mainnet forking; the 10 funded test accounts are parsed into a copyable table |
| **Chain Operations** (cast rpc) | Mine blocks, warp time, snapshot & revert state, set any balance, impersonate whale accounts |
| **Multi-chain** | Ethereum / Sepolia / Base / Arbitrum / Optimism / Polygon / BSC / Anvil built in, custom RPCs, one-click switching — every action follows the selected network |
| **i18n & themes** | 中文 / English / 日本語 / 한국어, light & dark themes |

## Security notes

- Private keys are passed only as arguments to your local `forge` / `cast` processes and are **never stored**; logs mask them automatically.
- For a safer workflow, import a keystore via `cast wallet import` (Wallet Tools page) and sign with the account name + password.
- All configuration (networks, history, preferences) lives in your local `userData` directory.

## Performance & reliability

Child-process output is coalesced in ~40 ms windows before crossing IPC, and the renderer batches DOM writes per animation frame with a node cap — a 5,000-line test log (369 KB) renders in ~0.5 s with zero UI jank. Configs are written atomically with debouncing, a single-instance lock prevents port fights, and a crashed renderer auto-recovers while orphaned child processes are reaped.

## Architecture

```
main.js        Electron main process: command execution, streaming processes, project scanning, config store
preload.js     contextBridge security bridge
renderer/      vanilla HTML/CSS/JS UI — no build step
renderer/i18n.js  four-language dictionary & runtime switcher
build/         app icon (SVG source, PNG, macOS .icns)
```

## Credits

Designed & built by **Claude (Fable 5)**. Foundry is a project of [Paradigm / foundry-rs](https://github.com/foundry-rs/foundry).

## License

[MIT](LICENSE)
