import { useState, useEffect, useRef } from 'react';
import PageShell from '../components/PageShell';
import GlassBox from '../components/GlassBox';
import AuthGate from '../components/AuthGate';
import { adminAuth, getVoteDrawEligible, voteDrawPick, getVoteDrawWinners } from '../api';

export default function RandomVotePage() {
  const [pw, setPw] = useState(null);
  const [eligible, setEligible] = useState([]);
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
      const [eligData, winnersData] = await Promise.all([
        getVoteDrawEligible(pw),
        getVoteDrawWinners(pw),
      ]);
      setEligible(eligData.eligible || []);
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

    const allLabels = eligible.map(e => `${e.voter_id}_${e.voter_name}`);
    let i = 0;
    intervalRef.current = setInterval(() => {
      setDisplayNames([
        allLabels[i % allLabels.length],
        allLabels[(i + 1) % allLabels.length],
        allLabels[(i + 2) % allLabels.length],
      ]);
      i++;
    }, 80);

    setTimeout(async () => {
      clearInterval(intervalRef.current);
      try {
        const res = await voteDrawPick(pw);
        setCurrentWinner(res.winner);
        setDisplayNames([`${res.winner.voter_id}_${res.winner.voter_name}`]);
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
      <PageShell accent="#f97316" icon="🎲" title="인기투표 랜덤 추첨">
        <AuthGate accent="#f97316" icon="🎲" title="관리자 인증" placeholder="관리자 비밀번호" type="password" onAuth={handleAuth} />
      </PageShell>
    );
  }

  return (
    <PageShell accent="#f97316" icon="🎲" title="참여자 랜덤 추첨" sub="인기투표 + 예측투표 참여자 중 행운의 주인공은?">
      {/* 참여자 현황 */}
      <GlassBox glow accent="#f97316" className="text-center mb-4">
        <div className="text-[11px] mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>인기투표 + 예측투표 통합 추첨</div>
        <div className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>투표 참여자 중 랜덤 1명 선정</div>
        <div className="flex justify-center gap-4 mt-2.5">
          <div>
            <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>전체 참여자</div>
            <div className="text-xl font-extrabold" style={{ color: '#f97316' }}>{eligible.length}</div>
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
            {eligible.length === 0 ? '아직 투표 참여자가 없습니다' : '추첨 버튼을 눌러주세요'}
          </p>
        )}
        {spinning && (
          <div style={{ overflow: 'hidden', height: 48 }}>
            <div className="flex flex-col gap-1" style={{ animation: 'spin 0.3s linear infinite' }}>
              {(displayNames.length ? displayNames : ['...']).map((n, i) => (
                <div key={i} className="text-3xl font-extrabold" style={{ color: '#f97316' }}>{n}</div>
              ))}
            </div>
          </div>
        )}
        {currentWinner && !spinning && (
          <div className="animate-pop">
            <div className="text-5xl mb-1.5">🎉</div>
            <div className="text-4xl font-black" style={{ color: '#f97316' }}>{currentWinner.voter_id}_{currentWinner.voter_name}</div>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>축하합니다!</p>
          </div>
        )}
      </GlassBox>

      {/* 추첨 버튼 */}
      <button
        onClick={startDraw}
        disabled={remaining.length === 0 || spinning}
        className="w-full py-3.5 rounded-xl text-sm font-bold transition-all"
        style={{
          background: remaining.length === 0 ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#f97316,#f97316cc)',
          color: remaining.length === 0 ? 'rgba(255,255,255,0.25)' : '#fff',
          cursor: remaining.length === 0 ? 'not-allowed' : 'pointer',
        }}
      >
        {spinning ? '추첨 중...' : winners.length === 0 ? '🎲 추첨 시작' : `🎲 한 명 더 추첨 (${remaining.length}명 남음)`}
      </button>

      {/* 당첨자 목록 */}
      {winners.length > 0 && (
        <GlassBox className="mt-3.5">
          <h3 className="text-xs font-bold mb-2">🏆 당첨자 목록</h3>
          {winners.map((w, i) => (
            <div key={w.id || i} className="flex items-center gap-2 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>{i + 1}</span>
              <span className="font-semibold">{w.voter_id}_{w.voter_name}</span>
            </div>
          ))}
        </GlassBox>
      )}
    </PageShell>
  );
}
