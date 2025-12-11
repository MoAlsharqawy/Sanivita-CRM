
import React, { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-end sm:items-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white/90 backdrop-blur-xl sm:rounded-2xl rounded-t-2xl shadow-2xl w-full sm:max-w-lg relative border border-white/50 flex flex-col max-h-[95dvh] sm:max-h-[90vh] overflow-hidden animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-300/50 flex-shrink-0 bg-white/40">
          <h3 className="text-xl font-semibold text-blue-800 truncate">{title}</h3>
          <button
            type="button"
            className="text-slate-400 bg-transparent hover:bg-slate-200/50 hover:text-slate-900 rounded-lg text-sm p-1.5 ms-auto inline-flex items-center"
            onClick={onClose}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              ></path>
            </svg>
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto w-full">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
