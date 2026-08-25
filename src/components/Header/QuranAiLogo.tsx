import React from 'react';

interface QuranAiLogoProps {
  className?: string;
  showText?: boolean;
}

export const QuranAiLogo: React.FC<QuranAiLogoProps> = ({ 
  className = "h-8 sm:h-9", 
  showText = true 
}) => {
  return (
    <div className={`inline-flex items-center gap-2 sm:gap-2.5 select-none ${className}`}>
      {/* Golden Book Minimalist Vector Emblem matching provided image */}
      <svg
        viewBox="0 0 160 140"
        className="h-full w-auto aspect-[160/140] shrink-0 drop-shadow-[0_2px_10px_rgba(212,175,55,0.4)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="quranLogoGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef3c7" />
            <stop offset="25%" stopColor="#f59e0b" />
            <stop offset="60%" stopColor="#d4af37" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
        </defs>

        {/* Outer Left Cover Flap [ */}
        <path
          d="M 22 36 L 10 36 L 10 102 L 22 102"
          stroke="url(#quranLogoGold)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Outer Right Cover Flap ] */}
        <path
          d="M 138 36 L 150 36 L 150 102 L 138 102"
          stroke="url(#quranLogoGold)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Left Book Page Top & Outer Contour */}
        <path
          d="M 80 48 Q 50 20 22 26 L 22 92 Q 52 88 80 114"
          stroke="url(#quranLogoGold)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Right Book Page Top & Outer Contour */}
        <path
          d="M 80 48 Q 110 20 138 26 L 138 92 Q 108 88 80 114"
          stroke="url(#quranLogoGold)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Center Vertical Spine Line */}
        <path
          d="M 80 48 L 80 114"
          stroke="url(#quranLogoGold)"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Bottom Echo Spine Base Arc */}
        <path
          d="M 10 102 Q 50 108 80 128 Q 110 108 150 102"
          stroke="url(#quranLogoGold)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Brand Typography matching the exact uploaded image */}
      {showText && (
        <div className="flex flex-col justify-center text-left leading-none">
          <div className="flex items-center gap-1.5 font-bold">
            <span 
              className="text-base sm:text-lg font-amiri font-bold leading-none tracking-normal"
              style={{
                background: 'linear-gradient(135deg, #fef08a 0%, #f59e0b 50%, #d4af37 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              القرآن
            </span>
            <span 
              className="text-sm sm:text-base font-sans font-bold leading-none tracking-wider"
              style={{
                background: 'linear-gradient(135deg, #fef08a 0%, #f59e0b 50%, #d4af37 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              AI
            </span>
          </div>
          <span 
            className="text-[9px] sm:text-[10px] font-sans font-semibold tracking-wider opacity-90 mt-0.5"
            style={{
              color: '#d4af37'
            }}
          >
            Quran AI
          </span>
        </div>
      )}
    </div>
  );
};
