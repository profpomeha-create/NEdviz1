import { memo, useState, useRef, useEffect } from 'react';

interface MultiSelectProps {
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}

function MultiSelectBase({ options, value, onChange, placeholder = 'Выберите...', className = '' }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (optionValue: string) => {
    if (optionValue === 'all') {
      if (value.length === options.length) {
        onChange([]);
      } else {
        onChange(options.map(opt => opt.value));
      }
    } else {
      if (value.includes(optionValue)) {
        onChange(value.filter(v => v !== optionValue));
      } else {
        onChange([...value, optionValue]);
      }
    }
  };

  const removeOption = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter(v => v !== optionValue));
  };

  const isAllSelected = value.length === options.length;
  const selectedLabels = value.map(v => options.find(opt => opt.value === v)?.label || v);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }} className={className}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '6px 10px',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          background: '#fff',
          cursor: 'pointer',
          minHeight: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexWrap: 'wrap',
          boxSizing: 'border-box',
          width: '100%',
          fontSize: '14px'
        }}
        className="multiselect-trigger"
      >
        {value.length === 0 ? (
          <span style={{ color: 'var(--color-subtext)', fontSize: 'inherit' }}>{placeholder}</span>
        ) : (
          <>
            {selectedLabels.slice(0, 2).map((label, idx) => {
              const optValue = options.find(opt => opt.label === label)?.value || '';
              return (
                <span
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'var(--color-primary)',
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: '12px'
                  }}
                >
                  {label}
                  <button
                    onClick={(e) => removeOption(optValue, e)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      cursor: 'pointer',
                      padding: 0,
                      margin: 0,
                      lineHeight: 1,
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}
                  >
                    ×
                  </button>
                </span>
              );
            })}
            {value.length > 2 && (
              <span style={{ color: 'var(--color-subtext)', fontSize: '12px' }}>
                +{value.length - 2} еще
              </span>
            )}
          </>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--color-subtext)' }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </div>
      
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            background: '#fff',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            zIndex: 1000,
            maxHeight: '300px',
            overflowY: 'auto',
            padding: '4px'
          }}
        >
          <div
            onClick={() => toggleOption('all')}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              borderRadius: 4,
              background: isAllSelected ? 'rgba(26, 115, 232, 0.1)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px'
            }}
          >
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={() => {}}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontWeight: 600 }}>Выбрать все</span>
          </div>
          {options.map((option) => {
            const isSelected = value.includes(option.value);
            return (
              <div
                key={option.value}
                onClick={() => toggleOption(option.value)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderRadius: 4,
                  background: isSelected ? 'rgba(26, 115, 232, 0.1)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  style={{ cursor: 'pointer' }}
                />
                <span>{option.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const MultiSelect = memo(MultiSelectBase);

