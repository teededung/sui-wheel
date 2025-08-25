# SUI Svelte dApp Starter

A modern, responsive starter template for building decentralized applications (dApps) on the SUI blockchain using SvelteKit and Svelte 5, with integrated Tailwind CSS 4 and daisyUI. This project demonstrates essential dApp functionality including wallet integration, transaction handling, and balance monitoring.

## 🚀 Features

- **Svelte 5 Runes**: Modern reactive state management with `$state`, `$derived`, and `$effect`
- **Wallet Integration**: Seamless connection with SUI wallets (Slush, Suiet, etc.)
- **Transaction Demo**: Send test transactions and sign messages
- **Real-time Balance**: Live wallet balance monitoring with automatic refresh
- **Network Detection**: Automatic detection and validation of SUI testnet connection
- **Responsive UI**: Mobile-first design using Tailwind CSS 4 and daisyUI
- **Toast Notifications**: User-friendly feedback with `svelte-daisy-toaster`

## 🛠️ Tech Stack

- **Framework**: SvelteKit 2.x with Svelte 5
- **Styling**: Tailwind CSS 4 + daisyUI components
- **Blockchain**: SUI Testnet integration with `@mysten/sui`
- **Wallet Kit**: `sui-svelte-wallet-kit` for wallet management
- **Package Manager**: Yarn
- **Icons**: Lucide icons via `@iconify-json/lucide`

## 📋 Prerequisites

- Node.js 18+
- Yarn package manager
- SUI-compatible wallet (Slush, Suiet, etc.) for testing

## 🔧 Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd sui-svelte-dapp-starter
```

2. Install dependencies:

```bash
yarn install
```

3. Start the development server:

```bash
yarn dev
```

4. Open [http://localhost:5177](http://localhost:5177) in your browser. You can configure your port in `svelte.config.js`

## 🧪 Demo Features

This starter includes several pre-built dApp features:

- **Wallet Connection**: Connect, switch, and disconnect SUI wallets
- **Account Management**: Display account address, network, and balance
- **Demo Transactions**: Send test transactions (0 SUI to self)
- **Message Signing**: Sign arbitrary messages with connected wallet
- **Network Validation**: Ensure users are on SUI testnet
- **Error Handling**: Comprehensive error handling with user-friendly toasts

> ⚠️ **Important**: This is a starter template for educational purposes. All transactions are performed on the SUI testnet only.

## 📁 Project Structure

```
src/
├── lib/
│   ├── components/          # Reusable Svelte components
│   │   ├── ButtonLoading.svelte    # Loading button component
│   │   ├── Navbar.svelte           # Navigation component
│   │   └── dashboard/              # Dashboard-specific components
│   ├── server/
│   │   └── suiHelpers.js           # SUI blockchain utilities
│   ├── utils/
│   │   ├── string.js               # String formatting utilities
│   │   └── other.js                # General utilities
│   └── index.js                    # Main exports
├── routes/
│   ├── (app)/
│   │   ├── +layout.svelte          # App layout
│   │   └── +page.svelte            # Main demo page
│   ├── api/
│   │   └── wallet-balance/         # API endpoint for balance
│   ├── +error.svelte               # Error page
│   └── +layout.svelte              # Root layout
├── app.css                         # Global styles
└── app.html                        # HTML template
```

## 🔑 Key Components

- **ButtonLoading**: Reusable button with loading states and multiple style variants
- **Navbar**: Main navigation with wallet connection status
- **Toast System**: User notifications with customizable actions

## 📜 Scripts

- `yarn dev` - Start development server with hot reload
- `yarn build` - Build for production
- `yarn preview` - Preview production build locally
- `yarn check` - Run Svelte type checking
- `yarn lint` - Run ESLint and Prettier checks
- `yarn format` - Format code with Prettier

## 🎯 Getting Started

1. **Connect Wallet**: Click "Connect Wallet" to connect your SUI wallet
2. **Switch Network**: Ensure you're connected to SUI Testnet
3. **Try Features**:
   - View your account balance
   - Send a demo transaction (0 SUI)
   - Sign a test message
   - Switch between different wallets

## 🔧 Customization

### Adding New Features

1. **New Components**: Add to `src/lib/components/`
2. **New Pages**: Create in `src/routes/` following SvelteKit conventions
3. **API Routes**: Add to `src/routes/api/` for server-side functionality
4. **Styling**: Use Tailwind classes or extend `src/app.css`

### SUI Integration

The project uses `sui-svelte-wallet-kit` for wallet management. Key exports:

- `wallet`, `account` - Current wallet and account state
- `connectWithModal()`, `switchWallet()`, `disconnect()` - Wallet actions
- `signAndExecuteTransaction()`, `signMessage()` - Transaction functions

## 🤝 Contributing

This is a starter template for SUI dApp development. Feel free to:

- Report issues and suggest improvements
- Submit pull requests for enhancements
- Fork and customize for your own projects

## 📚 Learn More

- [Svelte 5 Documentation](https://svelte.dev/docs/svelte/overview)
- [SvelteKit Guide](https://kit.svelte.dev/docs/introduction)
- [SUI Developer Documentation](https://docs.sui.io/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [DaisyUI](https://daisyui.com/components/)

## ⚖️ License

MIT License - free to use for personal and commercial projects.

---

> **Note**: This starter template is for development and testing purposes only. Implement proper security measures before deploying to production.
