'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Home, 
  Clock, 
  Zap, 
  HelpCircle, 
  CreditCard, 
  User, 
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  X
} from 'lucide-react'
import { useAuth } from '../app/contexts/AuthContext'
import ChatBubbleLogo from './ChatBubbleLogo'

export default function Sidebar({ activeItem }) {
  const router = useRouter()
  const { logout } = useAuth()
  const isSubItemActive = activeItem === 'strengths-overview' || activeItem === 'weakness-overview'
  const [isPastInterviewsExpanded, setIsPastInterviewsExpanded] = useState(isSubItemActive)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  useEffect(() => {
    if (isSubItemActive) {
      setIsPastInterviewsExpanded(true)
    }
  }, [isSubItemActive])

  const handleNavigation = (itemId) => {
    switch(itemId) {
      case 'dashboard':
        router.push('/user-dashboard')
        break
      case 'live-interview':
        router.push('/live-ai-interview-content-page')
        break
      case 'past-interviews':
        setIsPastInterviewsExpanded(!isPastInterviewsExpanded)
        break
      case 'strengths-overview':
        router.push('/strengths-overview')
        break
      case 'weakness-overview':
        router.push('/weakness-overview')
        break
      case 'question-bank':
        router.push('/question-bank')
        break
      case 'subscriptions':
        router.push('/my-plan')
        break
      case 'profile':
        router.push('/profile')
        break
      case 'faq':
        router.push('/faq')
        break
      case 'app-info':
        router.push('/app-info')
        break
      default:
        break
    }
  }

  const handleLogoutClick = () => {
    setShowLogoutModal(true)
  }

  const handleLogoutConfirm = async () => {
    try {
      setShowLogoutModal(false)
      await logout()
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const handleLogoutCancel = () => {
    setShowLogoutModal(false)
  }

  const sidebarItems = [
    { id: 'dashboard', icon: Home, label: 'Dashboard' },
    { id: 'past-interviews', icon: Clock, label: 'Past Interviews' },
    { id: 'live-interview', icon: Zap, label: 'Live AI Interview' },
    { id: 'question-bank', icon: HelpCircle, label: 'Question Bank' },
    { id: 'subscriptions', icon: CreditCard, label: 'Subscriptions' },
    { id: 'profile', icon: User, label: 'Profile' },
    { id: 'faq', icon: HelpCircle, label: 'FAQ' },
    { id: 'app-info', icon: Settings, label: 'App Info' }
  ]

  return (
    <div style={{
      width: '280px',
      backgroundColor: '#1f2937',
      backgroundImage: 'url("https://images.pexels.com/photos/12902862/pexels-photo-12902862.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      top: 0,
      left: 0,
      height: '100vh',
      zIndex: 10
    }}>
      {/* Dark overlay for sidebar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(31, 41, 55, 0.9)',
        zIndex: 1
      }}></div>
      
      {/* Sidebar content wrapper */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      }}>
        {/* Logo Section */}
        <div style={{
          padding: '2rem 1.5rem',
          borderBottom: '1px solid rgba(55, 65, 81, 0.5)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <ChatBubbleLogo size={48} />
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: 'bold',
              margin: 0,
              color: 'white'
            }}>
              InterviewPro
            </h2>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '1rem 0' }}>
          {sidebarItems.map((item) => {
            const Icon = item.icon
            const isActive = item.id === activeItem
            const isPastInterviews = item.id === 'past-interviews'
            const isSubItemActive = activeItem === 'strengths-overview' || activeItem === 'weakness-overview'
            
            return (
              <div key={item.id}>
                <button
                  onClick={() => handleNavigation(item.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1.5rem',
                    backgroundColor: (isActive || (isPastInterviews && isSubItemActive)) ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
                    color: 'white',
                    border: 'none',
                    borderLeft: (isActive || (isPastInterviews && isSubItemActive)) ? '4px solid #06b6d4' : '4px solid transparent',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    position: 'relative'
                  }}
                  onMouseOver={(e) => {
                    if (!isActive && !(isPastInterviews && isSubItemActive)) {
                      e.target.style.backgroundColor = 'rgba(55, 65, 81, 0.7)'
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isActive && !(isPastInterviews && isSubItemActive)) {
                      e.target.style.backgroundColor = 'transparent'
                    }
                  }}
                >
                  <Icon size={20} />
                  {item.label}
                  {isPastInterviews && (
                    <div style={{ marginLeft: 'auto' }}>
                      {isPastInterviewsExpanded ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </div>
                  )}
                </button>
                
                {/* Dropdown for Past Interviews */}
                {isPastInterviews && isPastInterviewsExpanded && (
                  <div style={{ 
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    borderLeft: '4px solid transparent'
                  }}>
                    <button
                      onClick={() => handleNavigation('strengths-overview')}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1.5rem 0.75rem 3rem',
                        backgroundColor: activeItem === 'strengths-overview' ? 'rgba(6, 182, 212, 0.3)' : 'transparent',
                        color: 'white',
                        border: 'none',
                        borderLeft: activeItem === 'strengths-overview' ? '4px solid #06b6d4' : '4px solid transparent',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        textAlign: 'left',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => {
                        if (activeItem !== 'strengths-overview') {
                          e.target.style.backgroundColor = 'rgba(55, 65, 81, 0.5)'
                        }
                      }}
                      onMouseOut={(e) => {
                        if (activeItem !== 'strengths-overview') {
                          e.target.style.backgroundColor = 'transparent'
                        }
                      }}
                    >
                      <TrendingUp size={18} />
                      Strengths Overview
                    </button>
                    
                    <button
                      onClick={() => handleNavigation('weakness-overview')}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1.5rem 0.75rem 3rem',
                        backgroundColor: activeItem === 'weakness-overview' ? 'rgba(6, 182, 212, 0.3)' : 'transparent',
                        color: 'white',
                        border: 'none',
                        borderLeft: activeItem === 'weakness-overview' ? '4px solid #06b6d4' : '4px solid transparent',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        textAlign: 'left',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => {
                        if (activeItem !== 'weakness-overview') {
                          e.target.style.backgroundColor = 'rgba(55, 65, 81, 0.5)'
                        }
                      }}
                      onMouseOut={(e) => {
                        if (activeItem !== 'weakness-overview') {
                          e.target.style.backgroundColor = 'transparent'
                        }
                      }}
                    >
                      <TrendingDown size={18} />
                      Weakness Overview
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Logout Button */}
        <div style={{ padding: '1rem' }}>
          <button
            onClick={handleLogoutClick}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.75rem',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = '#b91c1c'
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = '#dc2626'
            }}
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            animation: 'modalFadeIn 0.2s ease-out'
          }}>
            {/* Close button */}
            <button
              onClick={handleLogoutCancel}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#6b7280',
                padding: '0.25rem'
              }}
            >
              <X size={20} />
            </button>

            {/* Icon */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#fef2f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <AlertTriangle size={32} color="#dc2626" />
              </div>
            </div>

            {/* Title */}
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#111827',
              textAlign: 'center',
              marginBottom: '0.5rem'
            }}>
              Confirm Logout
            </h3>

            {/* Message */}
            <p style={{
              fontSize: '0.95rem',
              color: '#6b7280',
              textAlign: 'center',
              marginBottom: '1.5rem',
              lineHeight: '1.5'
            }}>
              Are you sure you want to logout? You will need to sign in again to access your account.
            </p>

            {/* Buttons */}
            <div style={{
              display: 'flex',
              gap: '0.75rem'
            }}>
              <button
                onClick={handleLogoutCancel}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = '#e5e7eb'
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = '#f3f4f6'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleLogoutConfirm}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = '#b91c1c'
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = '#dc2626'
                }}
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>

          {/* Modal animation styles */}
          <style jsx>{`
            @keyframes modalFadeIn {
              from {
                opacity: 0;
                transform: scale(0.95);
              }
              to {
                opacity: 1;
                transform: scale(1);
              }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}