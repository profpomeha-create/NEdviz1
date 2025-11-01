import { memo } from 'react';

interface UnitToggleProps {
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}

function UnitToggleBase({ value, options, onChange }: UnitToggleProps) {
  return (
    <div className="toggle" role="tablist" aria-label="Переключатель единиц">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`toggle-btn ${value === opt.value ? 'is-active' : ''}`}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export const UnitToggle = memo(UnitToggleBase);
