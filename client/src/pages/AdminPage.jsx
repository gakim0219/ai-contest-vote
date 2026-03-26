import { useState, useEffect, useCallback } from 'react';
import PageShell from '../components/PageShell';
import GlassBox from '../components/GlassBox';
import AuthGate from '../components/AuthGate';
import { adminAuth, getResults, getVotes, getPreliminaryVotes, getPredictions, getJudgeScoresAdmin, updateSettings, resetData, getJudges, addJudge, removeJudge } from '../api';

const CRITERIA = [
  { id: 'innovation', label: '혁신성' },
  { id: 'completeness', label: '완성도' },
  { id: 'impact', label: '업무 영향도' },
  { id: 'presentation', label: '발표력' },
];

export default function AdminPage() {
  const [pw, setPw] = useState(null);
  const [data, setData] = useState(null);
  const [votes, setVotes] = useState([]);
  const [prelimVotes, setPrelimVotes] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [judgeScores, setJudgeScores] = useState([]);
  const [judges, setJudges] = useState([]);
  const [jWeight, setJWeight] = useState(50);
  const [pWeight, setPWeight] = useState(30);
  const [preWeight, setPreWeight] = useState(20);
  const [newJudge, setNewJudge] = useState('');

  const handleAuth = async (password) => {
    await adminAuth(password);
    setPw(password);
  };

  const loadData = useCallback(async () => {
    if (!pw) return;
    try {
      const [r, v, pv, p, js, j] = await Promise.all([
        getResults(pw), getVotes(pw), getPreliminaryVotes(pw), getPredictions(pw), getJudgeScoresAdmin(pw), getJudges(pw),
      ]);
      setData(r);
      setVotes(v);
      setPrelimVotes(pv);
      setPredictions(p);
      setJudgeScores(js);
      setJudges(j);
      setJWeight(parseInt(r.settings?.judge_weight) || 50);
      setPWeight(parseInt(r.settings?.public_weight) || 30);
      setPreWeight(parseInt(r.settings?.preliminary_weight) || 20);
    } catch {}
  }, [pw]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleWeightSave = async () => {
    await updateSettings(pw, { judge_weight: jWeight, public_weight: pWeight, preliminary_weight: preWeight });
    loadData();
  };

  const handleSetWinner = async (tid) => {
    await updateSettings(pw, { winner_team_id: tid });
    loadData();
  };

  const handleReset = async () => {
    if (!confirm('모든 데이터를 초기화하시겠습니까?')) return;
    await resetData(pw);
    loadData();
  };

  const handleAddJudge = async () => {
    if (!newJudge.trim()) return;
    try {
      await addJudge(pw, newJudge.trim());
      setNewJudge('');
      loadData();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleRemoveJudge = async (name) => {
    if (!confirm(`"${name}" 심사위원을 삭제하시겠습니까?`)) return;
    await removeJudge(pw, name);
    loadData();
  };

  if (!pw) {
    return (
      <PageShell accent="#ef4444" icon="📊" title="관리자">
        <AuthGate accent="#ef4444" icon="📊" title="관리자 인증" placeholder="관리자 비밀번호" type="password" onAuth={handleAuth} />
      </PageShell>
    );
  }

  const results = data?.results || [];
  const summary = data?.summary || {};
  const winnerTid = data?.settings?.winner_team_id;
  const maxScore = Math.max(...results.map(r => r.finalScore), 1);
  const weightInput = "w-14 py-1 px-2 rounded text-sm text-white text-center outline-none";
  const weightStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' };

  return (
    <PageShell accent="#ef4444" icon="📊" title="관리자 집계">
      {/* 상단 컨트롤 */}
      <div className="flex justify-between items-center mb-3">
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444' }}>ADMIN</span>
        <div className="flex gap-1.5">
          <button onClick={loadData} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8', cursor: 'pointer' }}>🔄 새로고침</button>
          <button onClick={handleReset} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', cursor: 'pointer' }}>🗑️ 초기화</button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-5 gap-1.5 mb-3">
        {[
          ['📋', summary.totalPrelimVotes || 0, '사전심사', '#f97316'],
          ['🗳️', summary.totalVotes || 0, '인기투표', '#a855f7'],
          ['⚖️', `${summary.judgeCount || 0}/${summary.totalJudges || 0}`, '심사위원', '#f59e0b'],
          ['🎯', summary.totalPredictions || 0, '예측참여', '#ec4899'],
          ['🏢', summary.teamCount || 0, '참가팀', '#22c55e'],
        ].map(([icon, val, label, color]) => (
          <GlassBox key={label} className="text-center" style={{ padding: 8 }}>
            <div className="text-base">{icon}</div>
            <div className="text-lg font-extrabold" style={{ color }}>{val}</div>
            <div className="text-[8px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</div>
          </GlassBox>
        ))}
      </div>

      {/* 심사위원 관리 */}
      <GlassBox className="mb-3" style={{ padding: 14 }}>
        <h3 className="text-xs font-bold mb-2">심사위원 관리</h3>
        <div className="flex gap-2 mb-2">
          <input value={newJudge} onChange={e => setNewJudge(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddJudge()}
            placeholder="심사위원 이름"
            className="flex-1 py-1.5 px-3 rounded-lg text-xs text-white outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
          <button onClick={handleAddJudge} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', cursor: 'pointer' }}>+ 추가</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {judges.map(j => (
            <span key={j.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}>
              {j.name}
              <button onClick={() => handleRemoveJudge(j.name)} className="text-[10px] opacity-50 hover:opacity-100" style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#ef4444' }}>✕</button>
            </span>
          ))}
          {judges.length === 0 && <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>등록된 심사위원이 없습니다</span>}
        </div>
      </GlassBox>

      {/* 가중치 설정 */}
      <GlassBox className="mb-3" style={{ padding: 14 }}>
        <h3 className="text-xs font-bold mb-2">가중치 설정 (합계: {jWeight + pWeight + preWeight}%)</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>심사</label>
          <input type="number" value={jWeight} onChange={e => setJWeight(Number(e.target.value))} min={0} max={100} className={weightInput} style={weightStyle} />
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>:</span>
          <label className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>인기</label>
          <input type="number" value={pWeight} onChange={e => setPWeight(Number(e.target.value))} min={0} max={100} className={weightInput} style={weightStyle} />
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>:</span>
          <label className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>사전</label>
          <input type="number" value={preWeight} onChange={e => setPreWeight(Number(e.target.value))} min={0} max={100} className={weightInput} style={weightStyle} />
          <button onClick={handleWeightSave} className="px-3 py-1 rounded text-xs font-semibold" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', cursor: 'pointer' }}>저장</button>
        </div>
      </GlassBox>

      {/* 종합 순위 */}
      <GlassBox className="mb-3">
        <h3 className="text-xs font-bold mb-2.5">종합 순위</h3>
        {results.map((t, i) => (
          <div key={t.id} className="mb-2.5">
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xs w-4" style={{ color: i < 3 ? ['#facc15', '#94a3b8', '#cd7f32'][i] : 'rgba(255,255,255,0.2)' }}>{i + 1}</span>
                <span className="font-semibold text-xs">{t.name}</span>
                {String(winnerTid) === String(t.id) && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(250,204,21,0.15)', color: '#facc15' }}>1위 확정</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xs" style={{ color: '#22c55e' }}>{t.finalScore?.toFixed(2)}</span>
                {i === 0 && String(winnerTid) !== String(t.id) && (
                  <button onClick={() => handleSetWinner(t.id)} className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.3)', color: '#facc15', cursor: 'pointer' }}>1위 확정</button>
                )}
              </div>
            </div>
            <div className="h-1.5 rounded-sm overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="h-full rounded-sm animate-bar" style={{ width: `${(t.finalScore / maxScore) * 100}%`, background: `linear-gradient(90deg,#6366f1,${i === 0 ? '#facc15' : '#a855f7'})` }} />
            </div>
          </div>
        ))}
      </GlassBox>

      {/* 심사 상세 */}
      <GlassBox className="mb-3">
        <h3 className="text-xs font-bold mb-2">심사 상세</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <th className="text-left p-1" style={{ color: 'rgba(255,255,255,0.3)' }}>심사위원</th>
                <th className="text-left p-1" style={{ color: 'rgba(255,255,255,0.3)' }}>팀</th>
                {CRITERIA.map(c => <th key={c.id} className="text-center p-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {judgeScores.map(row => (
                <tr key={`${row.judge_name}-${row.team_id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <td className="p-1" style={{ color: '#f59e0b' }}>{row.judge_name}</td>
                  <td className="p-1">{results.find(t => t.id === row.team_id)?.name}</td>
                  {CRITERIA.map(c => <td key={c.id} className="text-center p-1" style={{ color: '#facc15' }}>{row[c.id]}</td>)}
                </tr>
              ))}
              {judgeScores.length === 0 && <tr><td colSpan={6} className="text-center p-3" style={{ color: 'rgba(255,255,255,0.2)' }}>아직 제출된 심사가 없습니다</td></tr>}
            </tbody>
          </table>
        </div>
      </GlassBox>

      {/* 사전심사 / 투표 / 예측 상세 */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <GlassBox>
          <h3 className="text-xs font-bold mb-2">사전심사 ({prelimVotes.length})</h3>
          <div className="max-h-40 overflow-y-auto text-[11px]">
            {prelimVotes.map(v => (
              <div key={v.id} className="flex justify-between py-0.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{v.voter_name}</span>
                <span style={{ color: '#f97316' }}>{results.find(t => t.id === v.team_id)?.name}</span>
              </div>
            ))}
            {prelimVotes.length === 0 && <p className="text-center py-2" style={{ color: 'rgba(255,255,255,0.2)' }}>없음</p>}
          </div>
        </GlassBox>
        <GlassBox>
          <h3 className="text-xs font-bold mb-2">인기투표 ({votes.length})</h3>
          <div className="max-h-40 overflow-y-auto text-[11px]">
            {votes.map(v => (
              <div key={v.id} className="flex justify-between py-0.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{v.voter_name}</span>
                <span style={{ color: '#a855f7' }}>{results.find(t => t.id === v.team_id)?.name}</span>
              </div>
            ))}
            {votes.length === 0 && <p className="text-center py-2" style={{ color: 'rgba(255,255,255,0.2)' }}>없음</p>}
          </div>
        </GlassBox>
        <GlassBox>
          <h3 className="text-xs font-bold mb-2">예측 ({predictions.length})</h3>
          <div className="max-h-40 overflow-y-auto text-[11px]">
            {predictions.map(p => (
              <div key={p.id} className="flex justify-between py-0.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{p.voter_name}</span>
                <span style={{ color: '#ec4899' }}>{results.find(t => t.id === p.predicted_team_id)?.name}</span>
              </div>
            ))}
            {predictions.length === 0 && <p className="text-center py-2" style={{ color: 'rgba(255,255,255,0.2)' }}>없음</p>}
          </div>
        </GlassBox>
      </div>
    </PageShell>
  );
}
