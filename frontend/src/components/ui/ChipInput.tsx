import { useState, useRef, KeyboardEvent } from 'react';
import { X } from 'lucide-react';

export interface ChipInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}

export function ChipInput({
  tags,
  onChange,
  suggestions = [],
  placeholder = 'Add tag and press Enter...',
}: ChipInputProps) {
  const [inputVal, setInputVal] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const availableSuggestions = suggestions.filter(
    (s) =>
      !tags.includes(s) &&
      s.toLowerCase().includes(inputVal.toLowerCase().trim())
  );

  function addTag(tag: string) {
    const clean = tag.trim();
    if (clean && !tags.includes(clean)) {
      onChange([...tags, clean]);
    }
    setInputVal('');
    setShowSuggestions(false);
  }

  function removeTag(tagToRemove: string) {
    onChange(tags.filter((t) => t !== tagToRemove));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputVal);
    } else if (e.key === 'Backspace' && !inputVal && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={() => inputRef.current?.focus()}
        style={{
          minHeight: 'var(--control-height)',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-control)',
          padding: '4px 8px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 6,
          cursor: 'text',
        }}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 'var(--text-caption)',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              padding: '1px 6px',
              backgroundColor: 'var(--bg-raised)',
            }}
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 0,
              }}
            >
              <X size={11} strokeWidth={2} />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={(e) => {
            setInputVal(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ''}
          style={{
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            color: 'var(--text-primary)',
            fontSize: 'var(--text-label)',
            flex: 1,
            minWidth: 80,
          }}
        />
      </div>

      {showSuggestions && availableSuggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            backgroundColor: 'var(--bg-overlay)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-control)',
            boxShadow: 'var(--shadow-popover)',
            maxHeight: 140,
            overflowY: 'auto',
            zIndex: 1000,
            padding: 4,
          }}
        >
          {availableSuggestions.map((s) => (
            <div
              key={s}
              onMouseDown={() => addTag(s)}
              style={{
                padding: '4px 8px',
                fontSize: 'var(--text-label)',
                borderRadius: 4,
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-raised)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

