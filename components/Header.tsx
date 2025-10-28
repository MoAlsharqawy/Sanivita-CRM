


import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth'
import { LogoutIcon, EditIcon } from './icons'
import ChangePasswordModal from './ChangePasswordModal'

export const Header: React.FC = () => {
  const { user, logout } = useAuth()
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)

  return (
    <>
      <header className="bg-white/30 backdrop-blur-lg shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Right Side (User Info) */}
            <div className="flex-1 flex justify-start items-center">
              <span className="text-slate-700 font-medium ms-2">
                مرحباً, {user?.name}
              </span>
              <button
                onClick={() => setIsPasswordModalOpen(true)}
                className="p-2 text-slate-600 hover:text-orange-600 focus:outline-none transition-colors rounded-full hover:bg-slate-200/50"
                aria-label="تغيير كلمة المرور"
              >
                <EditIcon className="h-5 w-5" />
              </button>
              <button
                onClick={logout}
                className="flex items-center text-slate-600 hover:text-orange-600 focus:outline-none transition-colors ms-2"
                aria-label="تسجيل الخروج"
              >
                <LogoutIcon className="h-6 w-6" />
                <span className="ms-1 hidden md:block">خروج</span>
              </button>
            </div>

            {/* Center (Company Name) */}
            <div className="flex-1 flex justify-center">
              <div className="text-4xl font-extrabold tracking-wider bg-gradient-to-r from-blue-700 to-cyan-500 text-transparent bg-clip-text">
                SPI
              </div>
            </div>

            {/* Left Side (App Name) */}
            <div className="flex-1 flex justify-end">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-800 to-orange-500 text-transparent bg-clip-text">
                Mizan CRM
              </h1>
            </div>
          </div>
        </div>
      </header>
      {isPasswordModalOpen && user && (
        <ChangePasswordModal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          user={user}
          onSuccess={() => setIsPasswordModalOpen(false)}
        />
      )}
    </>
  )
}