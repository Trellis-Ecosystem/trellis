import { NetworkStatus } from './NetworkStatus'

function TrellisLogo() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="nodeGrad1" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#67E8F9" />
          <stop offset="100%" stopColor="#00C2FF" />
        </linearGradient>
        <linearGradient id="nodeGrad2" x1="32" y1="0" x2="0" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00C2FF" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <filter id="logoGlow">
          <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#00C2FF" floodOpacity="0.8" />
        </filter>
      </defs>

      {/* Connection lines — drawn first so nodes appear on top */}
      {/* Top-left to top-right */}
      <line x1="6" y1="6" x2="26" y2="6" stroke="#00C2FF" strokeWidth="1.2" strokeOpacity="0.4" />
      {/* Top-left to bottom-left */}
      <line x1="6" y1="6" x2="6" y2="26" stroke="#00C2FF" strokeWidth="1.2" strokeOpacity="0.4" />
      {/* Top-right to center */}
      <line x1="26" y1="6" x2="16" y2="16" stroke="#00C2FF" strokeWidth="1.2" strokeOpacity="0.6" />
      {/* Top-left to center */}
      <line x1="6" y1="6" x2="16" y2="16" stroke="#00C2FF" strokeWidth="1.2" strokeOpacity="0.6" />
      {/* Center to bottom-left */}
      <line x1="16" y1="16" x2="6" y2="26" stroke="#00C2FF" strokeWidth="1.2" strokeOpacity="0.6" />
      {/* Center to bottom-right */}
      <line x1="16" y1="16" x2="26" y2="26" stroke="#00C2FF" strokeWidth="1.2" strokeOpacity="0.6" />
      {/* Bottom-left to bottom-right */}
      <line x1="6" y1="26" x2="26" y2="26" stroke="#00C2FF" strokeWidth="1.2" strokeOpacity="0.4" />
      {/* Top-right to bottom-right */}
      <line x1="26" y1="6" x2="26" y2="26" stroke="#00C2FF" strokeWidth="1.2" strokeOpacity="0.4" />

      {/* Corner nodes */}
      <circle cx="6" cy="6" r="2.5" fill="url(#nodeGrad1)" filter="url(#logoGlow)" />
      <circle cx="26" cy="6" r="2.5" fill="url(#nodeGrad1)" filter="url(#logoGlow)" />
      <circle cx="6" cy="26" r="2.5" fill="url(#nodeGrad2)" filter="url(#logoGlow)" />
      <circle cx="26" cy="26" r="2.5" fill="url(#nodeGrad2)" filter="url(#logoGlow)" />

      {/* Center node — larger and brighter */}
      <circle cx="16" cy="16" r="4" fill="url(#nodeGrad1)" filter="url(#logoGlow)" />
      {/* Center node inner highlight */}
      <circle cx="15" cy="15" r="1.5" fill="white" fillOpacity="0.4" />
    </svg>
  )
}

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-gray-800/50 bg-[#0A0E17]/80 backdrop-blur-md">
      {/* Left — Logo mark + brand name + network status */}
      <div className="flex items-center gap-4">
        {/* Logo mark + Trellis text */}
        <div className="flex items-center gap-2.5 group cursor-pointer">
          <div className="transition-transform duration-300 group-hover:scale-110">
            <TrellisLogo />
          </div>
          <span className="text-xl font-bold text-cyan-400 tracking-tight">
            Trellis
          </span>
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-gray-700" />

        {/* Network status */}
        <NetworkStatus />
      </div>

      {/* Right — Connect Wallet */}
      <button className="bg-cyan-400 text-[#0A0E17] font-semibold px-5 py-2 rounded-lg text-sm hover:bg-cyan-300 transition-colors">
        Connect Wallet
      </button>
    </nav>
  )
}
