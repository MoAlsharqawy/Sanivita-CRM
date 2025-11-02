import React from 'react';
import { PharmaLogoIcon } from './icons';

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
    <div className={`flex items-center justify-center font-bold ${className}`}>
      {/* Icon always inherits color from the container div */}
      <PharmaLogoIcon className="h-[50%] w-auto me-2" />
      {/* Font size is fixed, which should be okay. Text color is conditional. */}
      <span className={`text-3xl ${textClasses}`}>
        SaniVita
      </span>
    </div>
  );
};
