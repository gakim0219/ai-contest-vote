import { useState } from 'react';
import GlassBox from './GlassBox';

export default function AuthGate({ accent, icon, title, placeholder, onAuth, type = 'text', iconEmoji = '🔑' }) {
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!val.trim()) return setErr('입력해주세요');
    setLoading(true);
    setErr('');
    try {
      await onAuth(val.trim());
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center min-h-[50vh] items-center">
      <GlassBox glow accent={accent} className="w-full max-w-md text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3.5 text-3xl"
          style={{ background: `linear-gradient(135deg,${accent},${accent}cc)` }}
        >
          {icon}
        </div>
        <h2 className="text-xl font-extrabold mb-4">{title}</h2>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-35">{iconEmoji}</span>
          <input
            value={val}
            onChange={e => { setVal(e.target.value); setErr(''); }}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder={placeholder}
            type={type}
            className="w-full py-3 pl-10 pr-3.5 rounded-xl text-sm text-white outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
        </div>
        {err && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg mt-2 text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
            ⚠️ {err}
          </div>
        )}
        <button
          onClick={submit}
          disabled={loading}
          className="w-full py-3 rounded-xl text-sm font-bold mt-3 transition-all"
          style={{ background: loading ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg,${accent},${accent}cc)`, color: loading ? 'rgba(255,255,255,0.25)' : '#fff', cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? '확인 중...' : '확인'}
        </button>
      </GlassBox>
    </div>
  );
}
