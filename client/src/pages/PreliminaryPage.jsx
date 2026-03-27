import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';
import GlassBox from '../components/GlassBox';
import TeamCard from '../components/TeamCard';
import PrivacyConsent from '../components/PrivacyConsent';
import { getTeams, verifyPreliminary, submitPreliminary } from '../api';

const ACCENT = '#f97316'; // Orange

export default function PreliminaryPage() {
  const [step, setStep] = useState('auth');
  const [teams, setTeams] = useState([]);
  const [eid, setEid] = useState('');
  const [nm, setNm] = useState('');
  const [err, setErr] = useState('');
  const [sel, setSel] = useState(null);
  const [dupTeam, setDupTeam] = useState(null);
  const [loading, setLoading] = useState(false);
  const [privacy, setPrivacy] = useState(false);

  useEffect(() => { getTeams().then(setTeams).catch(() => {}); }, []);

  const verify = async () => {
    const id = eid.trim(), n = nm.trim();
    if (!id || !n) return setErr('사번과 이름을 모두 입력해주세요');
    if (!/^[A-Za-z]\d{6}$/.test(id)) return setErr('사번은 영문 1자리 + 숫자 6자리입니다 (예: A000000)');
    setLoading(true);
    try {
      const res = await verifyPreliminary(id);
      if (res.already_voted) {
        setDupTeam(teams.find(t => t.id === res.team_id));
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

  const vote = async () => {
    if (!sel) return;
    setLoading(true);
    try {
      await submitPreliminary(eid.trim(), nm.trim(), sel);
      setStep('done');
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell accent={ACCENT} icon="📋" title="사전심사 투표" sub="사전 심사를 통해 최고의 팀을 선택하세요">
      {step === 'auth' && (
        <div className="flex justify-center min-h-[50vh] items-center">
          <GlassBox glow accent={ACCENT} className="w-full max-w-md text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3.5 text-3xl"
              style={{ background: `linear-gradient(135deg,${ACCENT},#ea580c)` }}>📋</div>
            <h2 className="text-xl font-extrabold mb-1">본인 확인</h2>
            <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>사번과 이름을 입력해주세요</p>
            <div className="flex flex-col gap-2.5">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-35">🔢</span>
                <input value={eid} onChange={e => { setEid(e.target.value); setErr(''); }} placeholder="사번 (예: A000000)"
                  className="w-full py-3 pl-10 pr-3.5 rounded-xl text-sm text-white outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-35">👤</span>
                <input value={nm} onChange={e => { setNm(e.target.value); setErr(''); }} placeholder="이름 (실명)"
                  onKeyDown={e => e.key === 'Enter' && verify()}
                  className="w-full py-3 pl-10 pr-3.5 rounded-xl text-sm text-white outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
            </div>
            <PrivacyConsent checked={privacy} onChange={setPrivacy} accent={ACCENT} />
            {err && <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg mt-2 text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>⚠️ {err}</div>}
            <button onClick={verify} disabled={loading || !privacy}
              className="w-full py-3 rounded-xl text-sm font-bold mt-3 transition-all"
              style={{ background: (loading || !privacy) ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg,${ACCENT},${ACCENT}cc)`, color: (loading || !privacy) ? 'rgba(255,255,255,0.25)' : '#fff' }}>
              {loading ? '확인 중...' : '투표 참여'}
            </button>
            <p className="text-[10px] mt-3.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.2)' }}>⚠️ 1인 1회 투표</p>
          </GlassBox>
        </div>
      )}

      {step === 'dup' && (
        <div className="text-center py-9 animate-up">
          <div className="text-6xl mb-2.5">ℹ️</div>
          <h2 className="text-2xl font-extrabold mb-1.5">이미 투표하셨습니다</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>
            <strong style={{ color: ACCENT }}>{dupTeam?.name}</strong>에 투표하셨습니다
          </p>
        </div>
      )}

      {step === 'pick' && (
        <div className="animate-up">
          <p className="text-center text-xs mb-3.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
            <strong style={{ color: ACCENT }}>{nm.trim()}</strong>님, 가장 우수한 팀을 선택하세요
          </p>
          <div className="flex flex-col gap-2.5">
            {teams.map(t => <TeamCard key={t.id} team={t} selected={sel === t.id} onSelect={setSel} accent={ACCENT} />)}
          </div>
          {err && <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg mt-2 text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>⚠️ {err}</div>}
          <button onClick={vote} disabled={!sel || loading}
            className="w-full py-3 rounded-xl text-sm font-bold mt-3.5 transition-all"
            style={{ background: !sel ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg,${ACCENT},${ACCENT}cc)`, color: !sel ? 'rgba(255,255,255,0.25)' : '#fff' }}>
            {loading ? '투표 중...' : '투표하기'}
          </button>
        </div>
      )}

      {step === 'done' && (
        <div className="text-center py-9 animate-up">
          <div className="text-7xl animate-pop">📋</div>
          <h2 className="text-2xl font-extrabold my-2.5" style={{ background: `linear-gradient(to right,${ACCENT},#ea580c)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            투표 완료!
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>
            <strong>{nm.trim()}</strong>님 → <strong style={{ color: ACCENT }}>{teams.find(t => t.id === sel)?.name}</strong>
          </p>
          <p className="text-xs mt-5" style={{ color: 'rgba(255,255,255,0.25)' }}>감사합니다!</p>
        </div>
      )}
    </PageShell>
  );
}
