import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';
import GlassBox from '../components/GlassBox';
import AuthGate from '../components/AuthGate';
import { adminAuth, getResults } from '../api';

export default function CeremonyPage() {
  const [pw, setPw] = useState(null);
  const [results, setResults] = useState([]);
  const [revealed, setRevealed] = useState(0); // 0→대기, 1→3위, 2→2위, 3→1위

  const handleAuth = async (password) => {
    await adminAuth(password);
    setPw(password);
  };

  useEffect(() => {
    if (!pw) return;
    getResults(pw).then(data => setResults(data.results || [])).catch(() => {});
  }, [pw]);

  if (!pw) {
    return (
      <PageShell accent="#facc15" icon="🏆" title="시상식">
        <AuthGate accent="#facc15" icon="🏆" title="관리자 인증" placeholder="관리자 비밀번호" type="password" onAuth={handleAuth} />
      </PageShell>
    );
  }

  const top3 = results.slice(0, 3);
  const medals = ['🥇', '🥈', '🥉'];
  const colors = [['#facc15', 'rgba(250,204,21,0.1)'], ['#94a3b8', 'rgba(148,163,184,0.07)'], ['#cd7f32', 'rgba(205,127,50,0.07)']];
  const scales = [1.06, 1, 0.94];

  // 공개 순서: 3위(index 2) → 2위(index 1) → 1위(index 0)
  const revealOrder = [2, 1, 0]; // 실제 렌더 순서도 3위 먼저 위에
  const isRevealed = (rankIndex) => {
    // rankIndex 2(3위) → revealed>=1, rankIndex 1(2위) → revealed>=2, rankIndex 0(1위) → revealed>=3
    return revealed >= (3 - rankIndex);
  };

  return (
    <PageShell accent="#facc15" icon="🏆" title="AI AGENT AWARDS" sub="HD현대 AI Agent 경진대회">
      <div className="text-center">
        {revealed < 3 && (
          <button
            onClick={() => setRevealed(p => p + 1)}
            className="mb-6 px-12 py-4 rounded-2xl text-white text-lg font-bold border-none animate-glow"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', cursor: 'pointer' }}
          >
            {revealed === 0 ? '🥉 3위 공개' : revealed === 1 ? '🥈 2위 공개' : '🥇 1위 공개'}
          </button>
        )}

        <div className="flex flex-col gap-4">
          {revealOrder.map(i => {
            if (!isRevealed(i) || !top3[i]) return null;
            const t = top3[i];
            return (
              <div key={i} className="animate-up">
                <GlassBox glow accent={colors[i][0]}
                  style={{
                    border: `2px solid ${colors[i][0]}44`,
                    background: colors[i][1],
                    transform: `scale(${scales[i]})`,
                    position: 'relative',
                    overflow: 'hidden',
                    textAlign: 'center',
                  }}>
                  {/* Shine effect */}
                  <div className="absolute top-0 w-1/2 h-full pointer-events-none"
                    style={{ left: '-100%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent)', animation: 'shine 3s infinite' }} />

                  <div className="text-5xl animate-pop">{medals[i]}</div>
                  <div className="text-sm font-bold" style={{ color: colors[i][0] }}>{i + 1}위</div>
                  <h3 className="text-2xl font-extrabold my-1">{t.name}</h3>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{t.project}</p>
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{t.company}</p>
                </GlassBox>
              </div>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}
