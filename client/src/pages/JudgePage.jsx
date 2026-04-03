import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';
import GlassBox from '../components/GlassBox';
import AuthGate from '../components/AuthGate';
import StarRating from '../components/StarRating';
import { getTeams, judgeAuth, getJudgeScores, submitJudgeScore } from '../api';

const CRITERIA = [
  { id: 'innovation', label: '혁신성', desc: 'AI Agent 활용의 창의성과 독창성', w: 25 },
  { id: 'completeness', label: '완성도', desc: '프로토타입 기능 구현 수준', w: 25 },
  { id: 'impact', label: '업무 영향도', desc: '업무 효율화 기여 가능성', w: 30 },
  { id: 'presentation', label: '발표력', desc: '발표 구성력과 전달력', w: 20 },
];

export default function JudgePage() {
  const [judge, setJudge] = useState(null);
  const [teams, setTeams] = useState([]);
  const [activeTeam, setActiveTeam] = useState(1);
  const [scores, setScores] = useState({}); // { "teamId-criteriaId": number }
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { getTeams().then(setTeams).catch(() => {}); }, []);

  const handleAuth = async (name) => {
    await judgeAuth(name);
    setJudge(name);
    // 기존 점수 로드
    try {
      const existing = await getJudgeScores(name);
      const loaded = {};
      existing.forEach(row => {
        CRITERIA.forEach(c => {
          loaded[`${row.team_id}-${c.id}`] = row[c.id];
        });
      });
      setScores(loaded);
    } catch {}
  };

  const getScore = (tid, cid) => scores[`${tid}-${cid}`] || 0;

  const setScore = (tid, cid, val) => {
    setScores(prev => ({ ...prev, [`${tid}-${cid}`]: val }));
  };

  const weightedAvg = (tid) => {
    let sum = 0;
    CRITERIA.forEach(c => { sum += getScore(tid, c.id) * (c.w / 100); });
    return sum;
  };

  const allComplete = teams.every(t => CRITERIA.every(c => getScore(t.id, c.id) > 0));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      for (const t of teams) {
        const data = { judge_name: judge, team_id: t.id };
        CRITERIA.forEach(c => { data[c.id] = getScore(t.id, c.id); });
        await submitJudgeScore(data);
      }
      setDone(true);
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!judge) {
    return (
      <PageShell accent="#f59e0b" icon="⚖️" title="심사위원 평가" sub="등록된 심사위원만 접근 가능합니다">
        <AuthGate accent="#f59e0b" icon="⚖️" title="심사위원 인증" placeholder="심사위원 이름" iconEmoji="⚖️" onAuth={handleAuth} showPrivacy />
      </PageShell>
    );
  }

  if (done) {
    return (
      <PageShell accent="#f59e0b" icon="⚖️" title="심사위원 평가">
        <div className="text-center py-9 animate-up">
          <div className="text-7xl animate-pop">✅</div>
          <h2 className="text-2xl font-extrabold my-2.5">평가 제출 완료</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>
            <strong style={{ color: '#f59e0b' }}>{judge}</strong>님의 심사가 저장되었습니다
          </p>
        </div>
      </PageShell>
    );
  }

  const tm = teams.find(t => t.id === activeTeam) || teams[0];
  const tw = tm ? weightedAvg(tm.id) : 0;

  return (
    <PageShell accent="#f59e0b" icon="⚖️" title="심사위원 평가" sub={`심사위원: ${judge}`}>
      {/* 팀 탭 */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {teams.map(t => {
          const ok = CRITERIA.every(c => getScore(t.id, c.id) > 0);
          return (
            <button key={t.id} onClick={() => setActiveTeam(t.id)}
              className="px-3 py-1.5 rounded-lg text-xs whitespace-nowrap relative text-white"
              style={{
                border: activeTeam === t.id ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.07)',
                background: activeTeam === t.id ? 'rgba(245,158,11,0.12)' : 'transparent',
                fontWeight: activeTeam === t.id ? 700 : 400,
              }}>
              {t.name}
              {ok && <span className="absolute -top-1 -right-1 text-[9px]">✅</span>}
            </button>
          );
        })}
      </div>

      {/* 팀 정보 */}
      {tm && (
        <>
          <GlassBox glow accent="#f59e0b" className="mb-2.5" style={{ padding: 14 }}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)', color: '#f59e0b' }}>{tm.company}</span>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{tm.members}</span>
            </div>
            <h3 className="text-sm font-bold mb-0.5">{tm.project}</h3>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{tm.desc}</p>
          </GlassBox>

          {/* 평가 항목 */}
          <div className="flex flex-col gap-2">
            {CRITERIA.map(c => (
              <GlassBox key={c.id} style={{ padding: 14 }}>
                <div className="flex justify-between items-center mb-1">
                  <div>
                    <span className="font-bold text-sm">{c.label}</span>
                    <span className="text-[10px] ml-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{c.w}%</span>
                  </div>
                  <span className="font-extrabold text-lg" style={{ color: getScore(tm.id, c.id) > 0 ? '#facc15' : 'rgba(255,255,255,0.12)' }}>
                    {getScore(tm.id, c.id) || '—'}
                  </span>
                </div>
                <p className="text-[10px] mb-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{c.desc}</p>
                <StarRating value={getScore(tm.id, c.id)} onChange={v => setScore(tm.id, c.id, v)} />
              </GlassBox>
            ))}
          </div>

          {/* 총점 */}
          <GlassBox className="mt-2.5 text-center" style={{ padding: 12 }}>
            <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>총점</div>
            <div className="text-3xl font-extrabold" style={{ color: tw > 0 ? '#22c55e' : 'rgba(255,255,255,0.12)' }}>
              {tw.toFixed(1)}
            </div>
          </GlassBox>

          {allComplete && (
            <button onClick={handleSubmit} disabled={submitting}
              className="w-full py-3 rounded-xl text-sm font-bold mt-3 transition-all"
              style={{ background: 'linear-gradient(135deg,#22c55e,#22c55ecc)', color: '#fff' }}>
              {submitting ? '제출 중...' : '전체 평가 제출'}
            </button>
          )}
        </>
      )}
    </PageShell>
  );
}
