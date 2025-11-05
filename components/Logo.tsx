import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className }) => {
  // This check allows the logo to be either a gradient or a single color.
  // If a text color utility (e.g., `text-cyan-400`) is passed in the className,
  // the logo will be that single color. Otherwise, it defaults to the gradient.
  const hasColorOverride = className?.includes('text-');

  const textClasses = hasColorOverride
    ? "" // Inherit color from parent for a monocolor look
    : "bg-gradient-to-r from-blue-800 to-orange-500 text-transparent bg-clip-text";

  return (
    // The className from props is applied here, which can set height and color.
    <div className={`flex items-baseline justify-center font-bold gap-1 ${className}`}>
      {/* Font size is fixed, which should be okay. Text color is conditional. */}
      <span className={`text-3xl ${textClasses}`}>
        SaniVita
      </span>
      <span className="text-sm font-bold text-orange-500">v12</span>
    </div>
  );
};
