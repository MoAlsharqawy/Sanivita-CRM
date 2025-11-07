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
          
        </svg>
      )}
      <div className="flex flex-col items-center leading-none">
        <span className="text-3xl font-bold bg-gradient-to-r from-blue-800 to-orange-500 text-transparent bg-clip-text">
          SaniVita
        </span>
        <span className="text-xl font-light text-orange-500">
          Pharmav.36
        </span>
      </div>
    </div>
  );
};