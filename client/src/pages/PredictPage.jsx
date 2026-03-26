import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';
import GlassBox from '../components/GlassBox';
import TeamCard from '../components/TeamCard';
import { getTeams, verifyPredict, submitPredict } from '../api';

export default function PredictPage() {
  const [step, setStep] = useState('auth');
  const [teams, setTeams] = useState([]);
  const [eid, setEid] = useState('');
  const [nm, setNm] = useState('');
  const [err, setErr] = useState('');
  const [sel, setSel] = useState(null);
  const [dupTeam, setDupTeam] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { getTeams().then(setTeams).catch(() => {}); }, []);

  const verify = async () => {
    const id = eid.trim(), n = nm.trim();
    if (!id || !n) return setErr('사번과 이름을 모두 입력해주세요');
    if (!/^[A-Za-z]\d{6}$/.test(id)) return setErr('사번은 영문 1자리 + 숫자 6자리입니다 (예: A000000)');
    setLoading(true);
    try {
      const res = await verifyPredict(id);
      if (res.already_predicted) {
        setDupTeam(teams.find(t => t.id === res.predicted_team_id));
        setStep('dup');
      } else {
        setStep('pick');
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const predict = async () => {
    if (!sel) return;
    setLoading(true);
    try {
      await submitPredict(eid.trim(), nm.trim(), sel);
      setStep('done');
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const ACCENT = '#ec4899';

  return (
    <PageShell accent={ACCENT} icon="🎯" title="1등을 맞혀라!" sub="최종 1위 팀을 예측하세요 — 맞히면 추첨 기회!">
      {step === 'auth' && (
        <div className="flex justify-center min-h-[50vh] items-center">
          <GlassBox glow accent={ACCENT} className="w-full max-w-md text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3.5 text-3xl"
              style={{ background: 'linear-gradient(135deg,#ec4899,#f43f5e)' }}>🎯</div>
            <h2 className="text-xl font-extrabold mb-1">참여하기</h2>
            <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>사번과 이름을 입력해주세요</p>
            <div className="flex flex-col gap-2.5">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-35">🔢</span>
                <input value={eid} onChange={e => { setEid(e.target.value); setErr(''); }} placeholder="사번"
                  className="w-full py-3 pl-10 pr-3.5 rounded-xl text-sm text-white outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-35">👤</span>
                <input value={nm} onChange={e => { setNm(e.target.value); setErr(''); }} placeholder="이름"
                  onKeyDown={e => e.key === 'Enter' && verify()}
                  className="w-full py-3 pl-10 pr-3.5 rounded-xl text-sm text-white outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
            </div>
            {err && <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg mt-2 text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>⚠️ {err}</div>}
            <button onClick={verify} disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold mt-3 transition-all"
              style={{ background: loading ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg,${ACCENT},${ACCENT}cc)`, color: loading ? 'rgba(255,255,255,0.25)' : '#fff' }}>
              {loading ? '확인 중...' : '참여하기'}
            </button>
            <p className="text-[10px] mt-3.5" style={{ color: 'rgba(255,255,255,0.2)' }}>⚠️ 1인 1회 · 1위 팀 맞히면 경품 추첨 대상!</p>
          </GlassBox>
        </div>
      )}

      {step === 'dup' && (
        <div className="text-center py-9 animate-up">
          <div className="text-6xl">ℹ️</div>
          <h2 className="text-2xl font-extrabold my-2.5">이미 참여하셨습니다</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>
            <strong style={{ color: ACCENT }}>{dupTeam?.name}</strong>을 예측하셨습니다
          </p>
        </div>
      )}

      {step === 'pick' && (
        <div className="animate-up">
          <div className="text-center mb-3.5 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.2)' }}>
            <p className="text-sm font-bold m-0" style={{ color: ACCENT }}>🏆 최종 1위가 될 팀을 선택하세요!</p>
          </div>
          <div className="flex flex-col gap-2.5">
            {teams.map(t => <TeamCard key={t.id} team={t} selected={sel === t.id} onSelect={setSel} accent={ACCENT} />)}
          </div>
          {err && <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg mt-2 text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>⚠️ {err}</div>}
          <button onClick={predict} disabled={!sel || loading}
            className="w-full py-3 rounded-xl text-sm font-bold mt-3.5 transition-all"
            style={{ background: !sel ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg,${ACCENT},${ACCENT}cc)`, color: !sel ? 'rgba(255,255,255,0.25)' : '#fff' }}>
            {loading ? '제출 중...' : '예측 제출'}
          </button>
        </div>
      )}

      {step === 'done' && (
        <div className="text-center py-9 animate-up">
          <div className="text-7xl animate-pop">🎯</div>
          <h2 className="text-2xl font-extrabold my-2.5" style={{ background: 'linear-gradient(to right,#ec4899,#f43f5e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            예측 완료!
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>
            <strong>{nm.trim()}</strong>님 → <strong style={{ color: ACCENT }}>{teams.find(t => t.id === sel)?.name}</strong>
          </p>
          <p className="text-xs mt-5" style={{ color: 'rgba(255,255,255,0.25)' }}>🎁 맞히면 추첨을 통해 경품 증정!</p>
        </div>
      )}
    </PageShell>
  );
}
