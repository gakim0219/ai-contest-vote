import Particles from './Particles';

export default function PageShell({ children, accent, icon, title, sub }) {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(160deg,#08081a 0%,#151030 40%,#0c1525 100%)' }}>
      <Particles />
      <div className="relative z-10">
        <div className="pt-5 px-5 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <span className="text-xl">🤖</span>
            <span className="text-xs font-extrabold tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
              HD현대 AI AGENT CHALLENGE
            </span>
          </div>
          <div className="flex items-center justify-center gap-2 mb-0.5">
            <span className="text-3xl">{icon}</span>
            <h1 className="text-2xl font-black" style={{ color: accent }}>{title}</h1>
          </div>
          {sub && <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>{sub}</p>}
        </div>
        <div className="px-4 pb-10 max-w-2xl mx-auto pt-2">
          {children}
        </div>
      </div>
    </div>
  );
}
