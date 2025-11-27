'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  BarChart3,
  ChevronRight,
  Lightbulb,
  Target,
  Calendar,
  HelpCircle
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { useAuth } from '../contexts/AuthContext'
import { getInterviewSessions } from '../../lib/firebase'

export default function WeaknessOverview() {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState('Problem-solving')
  const [loading, setLoading] = useState(true)
  const [weaknessData, setWeaknessData] = useState(null)
  const [categoryDetails, setCategoryDetails] = useState({})
  const [expandedCard, setExpandedCard] = useState(null)
  const [toast, setToast] = useState({ show: false, message: '' })
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      loadWeaknessData()
    }
  }, [user])

  const loadWeaknessData = async () => {
    try {
      const interviews = await getInterviewSessions(user.uid)
      
      if (interviews.length === 0) {
        setWeaknessData(null)
        setLoading(false)
        return
      }

      // Analyze weaknesses across all interviews
      const allImprovements = interviews.flatMap(i => i.improvements || [])
      const improvementCounts = {}
      
      allImprovements.forEach(improvement => {
        const normalized = improvement.toLowerCase().trim()
        improvementCounts[normalized] = (improvementCounts[normalized] || 0) + 1
      })

      // Find the most common weakness
      const topWeakness = Object.entries(improvementCounts)
        .sort((a, b) => b[1] - a[1])[0]

      if (!topWeakness) {
        setWeaknessData(null)
        setLoading(false)
        return
      }

      const [weaknessName, count] = topWeakness
      
      const relevantInterviews = interviews.filter(i => 
        i.improvements?.some(imp => imp.toLowerCase().trim() === weaknessName)
      )

      // Extract questions from conversations
      const questions = relevantInterviews
        .flatMap(i => {
          if (!i.conversation) return []
          return i.conversation
            .filter(msg => msg.type === 'ai' && msg.text.includes('?'))
            .map(msg => msg.text)
        })
        .slice(0, 2)

      // Calculate category distribution
      const categoryCount = { behavioral: 0, problemSolving: 0, situational: 0 }
      relevantInterviews.forEach(i => {
        const type = i.interview_type?.toLowerCase() || i.interviewType?.toLowerCase() || 'behavioral'
        if (type.includes('behavioral')) categoryCount.behavioral++
        else if (type.includes('problem') || type.includes('technical')) categoryCount.problemSolving++
        else if (type.includes('situational')) categoryCount.situational++
        else categoryCount.behavioral++
      })

      const total = Object.values(categoryCount).reduce((a, b) => a + b, 0)
      const categories = {
        behavioral: Math.round((categoryCount.behavioral / total) * 100),
        problemSolving: Math.round((categoryCount.problemSolving / total) * 100),
        situational: Math.round((categoryCount.situational / total) * 100)
      }

      // Calculate detailed analytics per category
      const details = {}
      const categoryTypes = [
        { id: 'behavioral', name: 'Behavioral' },
        { id: 'problem-solving', name: 'Problem-Solving' },
        { id: 'situational', name: 'Situational' }
      ]

      categoryTypes.forEach(cat => {
        const catInterviews = interviews.filter(i => {
          const type = i.interview_type?.toLowerCase() || i.interviewType?.toLowerCase() || 'behavioral'
          if (cat.id === 'behavioral') return type.includes('behavioral')
          if (cat.id === 'problem-solving') return type.includes('problem') || type.includes('technical')
          if (cat.id === 'situational') return type.includes('situational')
          return false
        })

        if (catInterviews.length > 0) {
          const avgScore = catInterviews.reduce((sum, i) => sum + (i.percentage_scored || 0), 0) / catInterviews.length
          const topImprovements = catInterviews
            .flatMap(i => i.improvements || [])
            .slice(0, 3)

          details[cat.id] = {
            count: catInterviews.length,
            avgScore: Math.round(avgScore),
            improvements: [...new Set(topImprovements)],
            examples: catInterviews.slice(0, 2).map(i => ({
              topic: i.topic || 'General Interview',
              score: i.percentage_scored || 0,
              date: i.created_at
            }))
          }
        }
      })

      setCategoryDetails(details)
      setWeaknessData({
        keyWeakness: {
          name: weaknessName.charAt(0).toUpperCase() + weaknessName.slice(1),
          identifiedIn: `${count} out of ${interviews.length} interviews`,
          questions: questions.length > 0 ? questions : [
            "Questions from your interview sessions",
            "will be displayed here as you complete more interviews"
          ],
          categories
        }
      })
      
    } catch (error) {
      console.error('Error loading weakness data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPracticeQuestions = (category) => {
    const questions = {
      'Behavioral': [
        "Tell me about a time when you had to work with a difficult team member. How did you handle it?",
        "Describe a situation where you failed to meet a deadline. What did you learn?",
        "Give me an example of when you had to adapt to a significant change at work.",
        "Tell me about a time you received constructive criticism. How did you respond?"
      ],
      'Problem-solving': [
        "Walk me through how you would approach solving a complex technical problem with limited resources.",
        "Describe a time when you had to make a decision without having all the information you needed.",
        "How would you prioritize multiple urgent tasks with competing deadlines?",
        "Tell me about a creative solution you developed to solve a challenging problem."
      ],
      'Situational': [
        "If you noticed a colleague making a serious mistake, what would you do?",
        "How would you handle a situation where your manager asks you to do something unethical?",
        "What would you do if you disagreed with your team's approach to a project?",
        "If you were assigned a project outside your expertise, how would you approach it?"
      ]
    }
    return questions[category] || questions['Behavioral']
  }

  const getCategoryTips = (category) => {
    const tips = {
      'Behavioral': {
        title: 'STAR Method',
        description: 'Structure your answers using Situation, Task, Action, Result. Be specific with examples and quantify your achievements when possible.'
      },
      'Problem-solving': {
        title: 'Think Out Loud',
        description: 'Walk through your thought process step-by-step. Show how you break down complex problems, consider alternatives, and make data-driven decisions.'
      },
      'Situational': {
        title: 'Show Your Values',
        description: 'Demonstrate your judgment, ethics, and decision-making process. Explain the reasoning behind your choices and consider multiple perspectives.'
      }
    }
    return tips[category] || tips['Behavioral']
  }

  const getRandomQuestion = () => {
    const questions = getPracticeQuestions(selectedCategory)
    return questions[Math.floor(Math.random() * questions.length)]
  }

  const [currentPracticeQuestion, setCurrentPracticeQuestion] = useState('')

  useEffect(() => {
    if (weaknessData) {
      setCurrentPracticeQuestion(getRandomQuestion())
    }
  }, [selectedCategory, weaknessData])

  const formatDate = (date) => {
    if (!date) return 'N/A'
    const d = date.toDate ? date.toDate() : new Date(date)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const questionCategories = [
    {
      id: 'behavioral',
      title: 'Behavioral Questions',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="8" r="4" fill="white"/>
          <path d="M5 20C5 16.134 8.13401 13 12 13C15.866 13 19 16.134 19 20" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      color: '#ef4444'
    },
    {
      id: 'problem-solving',
      title: 'Problem-Solving Questions',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="white" strokeWidth="2"/>
          <circle cx="12" cy="12" r="2" fill="white"/>
          <path d="M12 2V7M12 17V22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          <path d="M2 12H7M17 12H22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      color: '#f59e0b'
    },
    {
      id: 'situational',
      title: 'Situational Questions',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      color: '#8b5cf6'
    }
  ]

  const improvementCategories = [
    { id: 'behavioral', label: 'Behavioral', active: false },
    { id: 'problem-solving', label: 'Problem-solving', active: true },
    { id: 'situational', label: 'Situational', active: false }
  ]

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        height: '100vh',
        fontFamily: 'Inter, sans-serif',
        overflow: 'hidden'
      }}>
        <Sidebar activeItem="weakness-overview" />
        <div style={{
          marginLeft: '280px',
          width: 'calc(100vw - 280px)',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9fafb'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '60px',
              height: '60px',
              border: '6px solid #e5e7eb',
              borderTop: '6px solid #f59e0b',
              borderRadius: '50%',
              margin: '0 auto 1rem',
              animation: 'spin 1s linear infinite'
            }}></div>
            <p style={{ color: '#6b7280', fontSize: '1rem' }}>Analyzing your weaknesses...</p>
          </div>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    )
  }

  if (!weaknessData) {
    return (
      <div style={{
        display: 'flex',
        height: '100vh',
        fontFamily: 'Inter, sans-serif',
        overflow: 'hidden'
      }}>
        <Sidebar activeItem="weakness-overview" />
        <div style={{
          marginLeft: '280px',
          width: 'calc(100vw - 280px)',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9fafb'
        }}>
          <div style={{ textAlign: 'center', maxWidth: '500px', padding: '2rem' }}>
            <AlertTriangle size={64} color="#f59e0b" style={{ margin: '0 auto 1rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.5rem' }}>
              No Interview Data Yet
            </h2>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
              Complete some AI interviews to see your areas for improvement here. Your performance data will help identify opportunities for growth across different question categories.
            </p>
            <button
              onClick={() => router.push('/live-ai-interview')}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Start Your First Interview
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      fontFamily: 'Inter, sans-serif',
      overflow: 'hidden'
    }}>
      {/* Sidebar */}
      <Sidebar activeItem="weakness-overview" />

      {/* Main Content */}
      <div style={{
        marginLeft: '280px',
        width: 'calc(100vw - 280px)',
        height: '100vh',
        overflow: 'auto'
      }}>
        <div style={{
          flex: 1,
          backgroundColor: '#f9fafb',
          minHeight: '100vh'
        }}>
          {/* Header Section */}
          <div style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 25%, #334155 50%, #475569 75%, #64748b 100%)',
            position: 'relative',
            paddingTop: '3rem',
            paddingBottom: '3rem',
            color: 'white',
            textAlign: 'center'
          }}>

            <div style={{
              position: 'relative',
              zIndex: 2,
              maxWidth: '800px',
              margin: '0 auto',
              padding: '0 2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '2rem'
            }}>
              <div style={{
                flexShrink: 0
              }}>
                <img
                  src="/assets/images/weakness_overview.png"
                  alt="Job interview"
                  style={{
                    width: '160px',
                    height: '160px',
                    objectFit: 'contain',
                    transform: 'scale(1.5)',
                    transformOrigin: 'center'
                  }}
                />
              </div>

              <div style={{ textAlign: 'left' }}>
                <h1 style={{
                  fontSize: '2.5rem',
                  fontWeight: 'bold',
                  margin: 0,
                  marginBottom: '0.75rem'
                }}>
                  Weakness Overview
                </h1>

                <p style={{
                  fontSize: '1.125rem',
                  color: 'rgba(255, 255, 255, 0.9)',
                  margin: 0,
                  lineHeight: '1.5'
                }}>
                  Identify key areas where you can improve and refine your interview performance. Learn from past responses and take actionable steps toward progress.
                </p>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '2rem',
            position: 'relative'
          }}>
            {/* Key Weaknesses Section */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '2rem',
              marginBottom: '2rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1rem'
              }}>
                <AlertTriangle size={24} color="#f59e0b" />
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: '#374151',
                  margin: 0
                }}>
                  Key Weaknesses
                </h2>
              </div>

              <p style={{
                color: '#6b7280',
                marginBottom: '2rem',
                fontSize: '0.875rem'
              }}>
                Uncover your key areas for improvement and recognize where challenges arise the most. See how these weaknesses have been consistently observed across different interview scenarios.
              </p>

              {/* Weakness Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1.5rem'
              }}>
                <div style={{
                  backgroundColor: '#f8fafc',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  position: 'relative'
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    backgroundColor: '#ef4444',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem'
                  }}>
                    <AlertTriangle size={24} color="white" />
                  </div>

                  <h3 style={{
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    color: '#ef4444',
                    margin: 0,
                    marginBottom: '0.5rem'
                  }}>
                    {weaknessData.keyWeakness.name}
                  </h3>

                  <p style={{
                    color: '#6b7280',
                    fontSize: '0.875rem',
                    margin: 0
                  }}>
                    Identified as a weakness in {weaknessData.keyWeakness.identifiedIn}.
                  </p>
                </div>

                <div style={{
                  backgroundColor: '#fef3c7',
                  border: '2px solid #f59e0b',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  position: 'relative'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '1rem'
                  }}>
                    <HelpCircle size={20} color="#f59e0b" />
                    <h3 style={{
                      fontSize: '1.125rem',
                      fontWeight: '600',
                      color: '#f59e0b',
                      margin: 0
                    }}>
                      Questions Where This Weakness Was Highlighted
                    </h3>
                  </div>

                  <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                    {weaknessData.keyWeakness.questions.map((question, idx) => (
                      <p key={idx} style={{ margin: idx === 0 ? '0 0 0.5rem 0' : '0' }}>
                        • {question}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chart Section */}
              <div style={{
                marginTop: '2rem',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                padding: '1.5rem'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '1rem'
                }}>
                  <BarChart3 size={20} color="#374151" />
                  <h4 style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: '#374151',
                    margin: 0
                  }}>
                    Main Question Categories Contributing to this Weakness
                  </h4>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', color: '#374151' }}>Behavioral</span>
                      <span style={{ fontSize: '0.875rem', color: '#374151' }}>{weaknessData.keyWeakness.categories.behavioral}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px' }}>
                      <div style={{ width: `${weaknessData.keyWeakness.categories.behavioral}%`, height: '100%', backgroundColor: '#3b82f6', borderRadius: '4px' }}></div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', color: '#374151' }}>Problem-Solving</span>
                      <span style={{ fontSize: '0.875rem', color: '#374151' }}>{weaknessData.keyWeakness.categories.problemSolving}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px' }}>
                      <div style={{ width: `${weaknessData.keyWeakness.categories.problemSolving}%`, height: '100%', backgroundColor: '#f59e0b', borderRadius: '4px' }}></div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', color: '#374151' }}>Situational</span>
                      <span style={{ fontSize: '0.875rem', color: '#374151' }}>{weaknessData.keyWeakness.categories.situational}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px' }}>
                      <div style={{ width: `${weaknessData.keyWeakness.categories.situational}%`, height: '100%', backgroundColor: '#10b981', borderRadius: '4px' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Weakness by Question Category */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '2rem',
              marginBottom: '2rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1rem'
              }}>
                <Target size={24} color="#8b5cf6" />
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: '#374151',
                  margin: 0
                }}>
                  Weakness by Question Category
                </h2>
              </div>

              <p style={{
                color: '#6b7280',
                marginBottom: '2rem',
                fontSize: '0.875rem'
              }}>
                Tap on each card to reveal detailed insights about how this strength was demonstrated across different question categories.
              </p>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                {questionCategories.map((category) => (
                  <div
                    key={category.id}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      border: '1px solid #e5e7eb'
                    }}
                    onClick={() => setExpandedCard(expandedCard === category.id ? null : category.id)}
                    onMouseOver={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem'
                      }}>
                        <div style={{
                          width: '48px',
                          height: '48px',
                          backgroundColor: category.color,
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.5rem'
                        }}>
                          {category.icon}
                        </div>
                        <span style={{
                          fontSize: '1.125rem',
                          fontWeight: '600',
                          color: '#374151'
                        }}>
                          {category.title}
                        </span>
                      </div>
                      <ChevronRight 
                        size={24} 
                        color="#6b7280"
                        style={{
                          transform: expandedCard === category.id ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s'
                        }}
                      />
                    </div>

                    {expandedCard === category.id && (
                      <div style={{
                        marginTop: '1.5rem',
                        padding: '1.5rem',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}>
                        {categoryDetails[category.id] ? (
                          <div>
                            <div style={{ marginBottom: '1.5rem' }}>
                              <h4 style={{ 
                                fontSize: '1rem', 
                                fontWeight: '600', 
                                color: '#1f2937', 
                                marginBottom: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                              }}>
                                <BarChart3 size={18} color={category.color} />
                                Performance Analytics
                              </h4>
                              <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: '1fr 1fr', 
                                gap: '1rem',
                                marginBottom: '1rem'
                              }}>
                                <div style={{
                                  backgroundColor: 'white',
                                  padding: '1rem',
                                  borderRadius: '8px',
                                  border: '1px solid #e5e7eb'
                                }}>
                                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                                    Interviews Completed
                                  </div>
                                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: category.color }}>
                                    {categoryDetails[category.id].count}
                                  </div>
                                </div>
                                <div style={{
                                  backgroundColor: 'white',
                                  padding: '1rem',
                                  borderRadius: '8px',
                                  border: '1px solid #e5e7eb'
                                }}>
                                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                                    Average Score
                                  </div>
                                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: category.color }}>
                                    {categoryDetails[category.id].avgScore}%
                                  </div>
                                </div>
                              </div>
                            </div>

                            {categoryDetails[category.id].improvements.length > 0 && (
                              <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{ 
                                  fontSize: '0.95rem', 
                                  fontWeight: '600', 
                                  color: '#1f2937', 
                                  marginBottom: '0.5rem' 
                                }}>
                                  Areas for Improvement in This Category
                                </h4>
                                <ul style={{ 
                                  margin: 0, 
                                  paddingLeft: '1.2rem', 
                                  color: '#374151',
                                  fontSize: '0.9rem'
                                }}>
                                  {categoryDetails[category.id].improvements.map((improvement, idx) => (
                                    <li key={idx} style={{ marginBottom: '0.25rem' }}>
                                      {improvement}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {categoryDetails[category.id].examples.length > 0 && (
                              <div>
                                <h4 style={{ 
                                  fontSize: '0.95rem', 
                                  fontWeight: '600', 
                                  color: '#1f2937', 
                                  marginBottom: '0.5rem' 
                                }}>
                                  Recent Interview Examples
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  {categoryDetails[category.id].examples.map((example, idx) => (
                                    <div 
                                      key={idx}
                                      style={{
                                        backgroundColor: 'white',
                                        padding: '0.75rem',
                                        borderRadius: '6px',
                                        border: '1px solid #e5e7eb',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                      }}
                                    >
                                      <div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: '500', color: '#374151' }}>
                                          {example.topic}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                          {formatDate(example.date)}
                                        </div>
                                      </div>
                                      <div style={{
                                        fontSize: '0.9rem',
                                        fontWeight: '600',
                                        color: example.score >= 80 ? '#10b981' : example.score >= 70 ? '#f59e0b' : '#ef4444'
                                      }}>
                                        {Math.round(example.score)}%
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p style={{ color: '#6b7280', margin: 0, fontSize: '0.9rem' }}>
                            No data available for {category.title.toLowerCase()} yet. Complete more interviews in this category to see detailed analytics.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Enhancement Resources */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '2rem',
              marginBottom: '2rem'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                marginBottom: '1rem' 
              }}>
                <div>
                  <img 
                    src="/assets/images/candidate.PNG" 
                    alt="Candidate Resources"
                    style={{
                      width: '32px',
                      height: '32px',
                      marginRight: '0.5rem',
                      verticalAlign: 'middle'
                    }}
                  />
                </div>
                <h2 style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 'bold', 
                  margin: 0,
                  color: '#1f2937',
                  display: 'inline-block',
                  verticalAlign: 'middle'
                }}>
                  Candidate Weakness Enhancement Resources
                </h2>
              </div>
              <p style={{ 
                color: '#6b7280', 
                marginBottom: '1.5rem',
                fontSize: '0.95rem'
              }}>
                Access curated videos and learning materials designed to help candidates overcome their weaknesses and improve their interview performance.
              </p>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                gap: '1.5rem' 
              }}>
                <div
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                    <iframe 
                      src="https://www.youtube.com/embed/NQrUJBOcgJc" 
                      title="YouTube video player" 
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                      referrerpolicy="strict-origin-when-cross-origin" 
                      allowFullScreen
                    ></iframe>
                  </div>
                  <div style={{ padding: '1.5rem' }}>
                    <h3 style={{
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      margin: '0 0 0.5rem 0',
                      color: '#1f2937'
                    }}>
                      Communication Skills Workshop
                    </h3>
                    <p style={{
                      color: '#6b7280',
                      fontSize: '0.9rem',
                      margin: 0,
                      lineHeight: '1.5'
                    }}>
                      Enhance your verbal and written communication abilities
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                    <iframe 
                      src="https://www.youtube.com/embed/UX_dxcjp5Gw" 
                      title="YouTube video player" 
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                      referrerpolicy="strict-origin-when-cross-origin" 
                      allowFullScreen
                    ></iframe>
                  </div>
                  <div style={{ padding: '1.5rem' }}>
                    <h3 style={{
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      margin: '0 0 0.5rem 0',
                      color: '#1f2937'
                    }}>
                      Leadership Development Program
                    </h3>
                    <p style={{
                      color: '#6b7280',
                      fontSize: '0.9rem',
                      margin: 0,
                      lineHeight: '1.5'
                    }}>
                      Build confidence in leading teams and projects
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                    <iframe 
                      src="https://www.youtube.com/embed/AIz7ODolyg4" 
                      title="YouTube video player" 
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                      referrerpolicy="strict-origin-when-cross-origin" 
                      allowFullScreen
                    ></iframe>
                  </div>
                  <div style={{ padding: '1.5rem' }}>
                    <h3 style={{
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      margin: '0 0 0.5rem 0',
                      color: '#1f2937'
                    }}>
                      Interview Confidence Building
                    </h3>
                    <p style={{
                      color: '#6b7280',
                      fontSize: '0.9rem',
                      margin: 0,
                      lineHeight: '1.5'
                    }}>
                      Master the art of presenting your strengths effectively
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Personalized Improvement Plan */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '2rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1rem'
              }}>
                <Target size={24} color="#10b981" />
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: '#374151',
                  margin: 0
                }}>
                  Personalized Improvement Plan
                </h2>
              </div>

              <p style={{
                color: '#6b7280',
                marginBottom: '2rem',
                fontSize: '0.875rem'
              }}>
                Practice targeted questions based on your identified weaknesses. Select a category to get personalized practice questions and tips.
              </p>

              {/* Progress Overview */}
              {categoryDetails && Object.keys(categoryDetails).length > 0 && (
                <div style={{
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  marginBottom: '2rem'
                }}>
                  <h3 style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: '#166534',
                    margin: '0 0 1rem 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <BarChart3 size={18} />
                    Your Progress Summary
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    {Object.entries(categoryDetails).map(([key, data]) => (
                      <div key={key} style={{
                        backgroundColor: 'white',
                        padding: '1rem',
                        borderRadius: '8px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                          {key === 'behavioral' ? 'Behavioral' : key === 'problem-solving' ? 'Problem-Solving' : 'Situational'}
                        </div>
                        <div style={{ 
                          fontSize: '1.5rem', 
                          fontWeight: 'bold', 
                          color: data.avgScore >= 80 ? '#10b981' : data.avgScore >= 70 ? '#f59e0b' : '#ef4444'
                        }}>
                          {data.avgScore}%
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                          {data.count} interview{data.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '2rem' }}>
                <p style={{
                  fontSize: '0.875rem',
                  color: '#374151',
                  marginBottom: '1rem',
                  fontWeight: '600'
                }}>
                  Select Practice Category
                </p>

                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  flexWrap: 'wrap'
                }}>
                  {improvementCategories.map((category) => {
                    const isActive = selectedCategory === category.label
                    const categoryData = categoryDetails[category.id]
                    return (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.label)}
                        style={{
                          padding: '0.75rem 1.25rem',
                          backgroundColor: isActive ? '#10b981' : 'white',
                          color: isActive ? 'white' : '#6b7280',
                          border: `2px solid ${isActive ? '#10b981' : '#d1d5db'}`,
                          borderRadius: '8px',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        <span>{category.label}</span>
                        {categoryData && (
                          <span style={{ 
                            fontSize: '0.7rem', 
                            opacity: 0.8,
                            fontWeight: 'normal'
                          }}>
                            Avg: {categoryData.avgScore}%
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Practice Question Card */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '2px solid #10b981',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1rem'
                }}>
                  <h4 style={{
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#10b981',
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Practice Question - {selectedCategory}
                  </h4>
                  <button
                    onClick={() => setCurrentPracticeQuestion(getRandomQuestion())}
                    style={{
                      padding: '0.25rem 0.75rem',
                      backgroundColor: 'white',
                      color: '#10b981',
                      border: '1px solid #10b981',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    New Question
                  </button>
                </div>

                <p style={{
                  fontSize: '1.05rem',
                  color: '#1f2937',
                  margin: '0 0 1.5rem 0',
                  lineHeight: '1.6',
                  fontWeight: '500'
                }}>
                  {currentPracticeQuestion}
                </p>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button 
                    onClick={() => router.push('/live-ai-interview')}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Target size={16} />
                    Practice with AI
                  </button>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(currentPracticeQuestion)
                      setToast({ show: true, message: 'Question copied to clipboard!' })
                      setTimeout(() => setToast({ show: false, message: '' }), 3000)
                    }}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: 'white',
                      color: '#6b7280',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Copy Question
                  </button>
                </div>
              </div>

              {/* Category-Specific Tips */}
              <div style={{
                display: 'flex',
                gap: '0.75rem',
                padding: '1.25rem',
                backgroundColor: '#fef3c7',
                borderRadius: '8px',
                border: '1px solid #f59e0b'
              }}>
                <Lightbulb size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: '0.125rem' }} />
                <div>
                  <p style={{
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#92400e',
                    margin: 0,
                    marginBottom: '0.5rem'
                  }}>
                    {getCategoryTips(selectedCategory).title}
                  </p>
                  <p style={{
                    fontSize: '0.875rem',
                    color: '#92400e',
                    margin: 0,
                    lineHeight: '1.5'
                  }}>
                    {getCategoryTips(selectedCategory).description}
                  </p>
                </div>
              </div>

              {/* Additional Resources */}
              {categoryDetails[selectedCategory.toLowerCase().replace('-', '-')] && (
                <div style={{
                  marginTop: '1.5rem',
                  padding: '1.25rem',
                  backgroundColor: '#eff6ff',
                  borderRadius: '8px',
                  border: '1px solid #3b82f6'
                }}>
                  <h4 style={{
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#1e40af',
                    margin: '0 0 0.75rem 0'
                  }}>
                    📚 Focus Areas for {selectedCategory}
                  </h4>
                  <div style={{ fontSize: '0.85rem', color: '#1e40af' }}>
                    {categoryDetails[selectedCategory.toLowerCase().replace('problem-solving', 'problem-solving')]?.improvements.slice(0, 3).map((imp, idx) => (
                      <div key={idx} style={{ 
                        marginBottom: '0.5rem',
                        paddingLeft: '1rem',
                        position: 'relative'
                      }}>
                        <span style={{ position: 'absolute', left: 0 }}>•</span>
                        {imp}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast.show && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          backgroundColor: '#10b981',
          color: 'white',
          padding: '1rem 1.5rem',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          zIndex: 1000,
          animation: 'slideIn 0.3s ease-out'
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{toast.message}</span>
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}