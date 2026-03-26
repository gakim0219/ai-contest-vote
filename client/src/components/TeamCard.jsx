import GlassBox from './GlassBox';

export default function TeamCard({ team, selected, onSelect, accent = '#6366f1' }) {
  return (
    <GlassBox
      onClick={() => onSelect(team.id)}
      glow={selected}
      accent={accent}
      style={{
        cursor: 'pointer',
        border: selected ? `2px solid ${accent}` : '1px solid rgba(255,255,255,0.06)',
        padding: 15,
      }}
    >
      <div className="flex justify-between items-center">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="font-bold text-xs" style={{ color: accent }}>{team.name}</span>
            <span
              className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: `${accent}15`, border: `1px solid ${accent}35`, color: accent }}
            >
              {team.company}
            </span>
          </div>
          <h3 className="text-sm font-bold mb-0.5">{team.project}</h3>
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{team.desc}</p>
        </div>
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ml-3"
          style={{ border: `2px solid ${selected ? accent : 'rgba(255,255,255,0.12)'}` }}
        >
          {selected && (
            <div className="w-3 h-3 rounded-full animate-pop" style={{ background: accent }} />
          )}
        </div>
      </div>
    </GlassBox>
  );
}
