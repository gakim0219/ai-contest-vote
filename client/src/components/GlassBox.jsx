export default function GlassBox({ children, className = '', glow, accent = '#6366f1', onClick, style }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl p-5 backdrop-blur-xl transition-all duration-300 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        background: 'rgba(12,12,30,0.88)',
        border: `1px solid ${glow ? `${accent}55` : 'rgba(255,255,255,0.06)'}`,
        ...(glow ? { boxShadow: `0 0 25px ${accent}18` } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
