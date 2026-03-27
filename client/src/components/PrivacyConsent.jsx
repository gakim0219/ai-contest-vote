export default function PrivacyConsent({ checked, onChange, accent = '#6366f1' }) {
  return (
    <label className="flex items-start gap-2 mt-3 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded accent-current shrink-0 cursor-pointer"
        style={{ accentColor: accent }}
      />
      <span className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
        개인정보 수집 및 이용에 동의합니다.{' '}
        <a
          href="https://www.hd.com/kr/private/policy/index"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
          style={{ color: accent }}
        >
          [전문보기]
        </a>
      </span>
    </label>
  );
}
