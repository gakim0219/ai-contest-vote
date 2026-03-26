export default function StarRating({ value, onChange }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
        <div
          key={n}
          onClick={() => onChange?.(n)}
          className="cursor-pointer text-xl transition-all duration-150 select-none"
          style={{ color: n <= value ? '#facc15' : 'rgba(255,255,255,0.08)' }}
        >
          ★
        </div>
      ))}
    </div>
  );
}
