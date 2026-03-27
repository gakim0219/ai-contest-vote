import { useState, useEffect, useRef } from 'react';
import PageShell from '../components/PageShell';
import GlassBox from '../components/GlassBox';
import AuthGate from '../components/AuthGate';
import { adminAuth, getEligible, drawPick, getDrawWinners } from '../api';

export default function DrawPage() {
  const [pw, setPw] = useState(null);
  const [eligible, setEligible] = useState([]);
  const [winnerTeam, setWinnerTeam] = useState(null);
  const [drawnIds, setDrawnIds] = useState([]);
  const [winners, setWinners] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [currentWinner, setCurrentWinner] = useState(null);
  const [displayNames, setDisplayNames] = useState([]);
  const intervalRef = useRef(null);

  const handleAuth = async (password) => {
    await adminAuth(password);
    setPw(password);
  };

  const loadData = async () => {
    if (!pw) return;
    try {
      const [eligData, winnersData] = await Promise.all([getEligible(pw), getDrawWinners(pw)]);
      setEligible(eligData.eligible || []);
      setWinnerTeam(eligData.winnerTeam);
      setDrawnIds(eligData.drawnIds || []);
      setWinners(winnersData || []);
    } catch {}
  };

  useEffect(() => { loadData(); }, [pw]);

  const remaining = eligible.filter(e => !drawnIds.includes(e.voter_id));

  const startDraw = async () => {
    if (remaining.length === 0) return;
    setSpinning(true);
    setCurrentWinner(null);

    // 슬롯 애니메이션
    const allNames = eligible.map(e => e.voter_name);
    let i = 0;
    intervalRef.current = setInterval(() => {
      setDisplayNames([
        allNames[i % allNames.length],
        allNames[(i + 1) % allNames.length],
        allNames[(i + 2) % allNames.length],
      ]);
      i++;
    }, 80);

    // 3초 후 서버에서 추첨
    setTimeout(async () => {
      clearInterval(intervalRef.current);
      try {
        const res = await drawPick(pw);
        setCurrentWinner(res.winner);
        setDisplayNames([res.winner.voter_name]);
        await loadData();
      } catch (e) {
        alert(e.message);
      } finally {
        setSpinning(false);
      }
    }, 3000);
  };

  if (!pw) {
    return (
      <PageShell accent="#10b981" icon="🎰" title="행운의 추첨">
        <AuthGate accent="#10b981" icon="🎰" title="관리자 인증" placeholder="관리자 비밀번호" type="password" onAuth={handleAuth} />
      </PageShell>
    );
  }

  const totalPredictions = eligible.length + drawnIds.length; // approx

  return (
    <PageShell accent="#10b981" icon="🎰" title="행운의 추첨" sub="1등을 맞힌 분들 중 행운의 주인공은?">
      {/* 1위 팀 정보 */}
      <GlassBox glow accent="#10b981" className="text-center mb-4">
        <div className="text-[11px] mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>최종 1위</div>
        <div className="text-2xl font-extrabold" style={{ color: '#facc15' }}>{winnerTeam?.name || '미확정'}</div>
        {winnerTeam && <div className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{winnerTeam.project}</div>}
        <div className="flex justify-center gap-4 mt-2.5">
          <div>
            <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>정답자</div>
            <div className="text-xl font-extrabold" style={{ color: '#10b981' }}>{eligible.length + drawnIds.length}</div>
          </div>
          <div>
            <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>추첨 가능</div>
            <div className="text-xl font-extrabold" style={{ color: '#6366f1' }}>{remaining.length}</div>
          </div>
          <div>
            <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>당첨자</div>
            <div className="text-xl font-extrabold" style={{ color: '#facc15' }}>{winners.length}</div>
          </div>
        </div>
      </GlassBox>

      {/* 슬롯 머신 */}
      <GlassBox className="text-center mb-4" style={{ padding: 20, minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {!currentWinner && !spinning && (
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {!winnerTeam ? '관리자 페이지에서 1위 팀을 먼저 확정해주세요' : '추첨 버튼을 눌러주세요'}
          </p>
        )}
        {spinning && (
          <div style={{ overflow: 'hidden', height: 48 }}>
            <div className="flex flex-col gap-1" style={{ animation: 'spin 0.3s linear infinite' }}>
              {(displayNames.length ? displayNames : ['...']).map((n, i) => (
                <div key={i} className="text-3xl font-extrabold" style={{ color: '#10b981' }}>{n}</div>
              ))}
            </div>
          </div>
        )}
        {currentWinner && !spinning && (
          <div className="animate-pop">
            <div className="text-5xl mb-1.5">🎊</div>
            <div className="text-4xl font-black" style={{ color: '#10b981' }}>{currentWinner.voter_name}</div>
            <div className="text-sm font-semibold mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{currentWinner.voter_id}</div>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>축하합니다!</p>
          </div>
        )}
      </GlassBox>

      {/* 추첨 버튼 */}
      <button
        onClick={startDraw}
        disabled={remaining.length === 0 || spinning || !winnerTeam}
        className="w-full py-3.5 rounded-xl text-sm font-bold transition-all"
        style={{
          background: (remaining.length === 0 || !winnerTeam) ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#10b981,#10b981cc)',
          color: (remaining.length === 0 || !winnerTeam) ? 'rgba(255,255,255,0.25)' : '#fff',
          cursor: (remaining.length === 0 || !winnerTeam) ? 'not-allowed' : 'pointer',
        }}
      >
        {spinning ? '추첨 중...' : winners.length === 0 ? '🎰 추첨 시작' : `🎰 한 명 더 추첨 (${remaining.length}명 남음)`}
      </button>

      {/* 당첨자 목록 */}
      {winners.length > 0 && (
        <GlassBox className="mt-3.5">
          <h3 className="text-xs font-bold mb-2">🏆 당첨자 목록</h3>
          {winners.map((w, i) => (
            <div key={w.id || i} className="flex items-center gap-2 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>{i + 1}</span>
              <span className="font-semibold">{w.voter_name}</span>
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{w.voter_id}</span>
            </div>
          ))}
        </GlassBox>
      )}
    </PageShell>
  );
}
