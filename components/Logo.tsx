import React from 'react';

export const Logo: React.FC<{ className?: string, showIcon?: boolean }> = ({ className, showIcon = true }) => {
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      {/* 
        This is a custom two-toned pill capsule SVG icon.
        The colors are chosen from the app's primary color palette (blue and orange).
        The `h-full` class makes the icon's height scale with its parent container,
        which is controlled by the `className` prop (e.g., h-12, h-20).
      */}
      {showIcon && (
        <svg
          className="h-full"
          viewBox="0 0 512 512"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          role="img"
        >
          <path
            d="M256 512c141.4 0 256-114.6 256-256S397.4 0 256 0 0 114.6 0 256s114.6 256 256 256zM256 48a208.1 208.1 0 010 416V48z"
            fill="#2563eb" // Blue-600
          ></path>
          <path
            d="M256 48a208.1 208.1 0 000 416c114.9 0 208-93.1 208-208S370.9 48 256 48z"
            fill="#f97316" // Orange-500
          ></path>
        </svg>
      )}
      <div className="flex flex-col items-center leading-none">
        <span className="text-3xl font-bold bg-gradient-to-r from-blue-800 to-orange-500 text-transparent bg-clip-text">
          SaniVita
        </span>
        <span className="text-xl font-light text-orange-500">
          Pharma
        </span>
      </div>
    </div>
  );
};