'use client'
import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, BarChart3, TrendingUp, Award, AlertCircle, Volume2, VolumeX, FileText } from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { useAuth } from '../contexts/AuthContext'

export default function InterviewResults() {
  const router = useRouter()
  const { user } = useAuth()
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [conversation, setConversation] = useState([])
  const [isPlayingSummary, setIsPlayingSummary] = useState(false)
  const [summaryGenerated, setSummaryGenerated] = useState(false)
  const audioRef = useRef(null)

  useEffect(() => {
    analyzeInterview()
  }, [])






  const analyzeInterview = async () => {
    try {
      // Get user ID from Firebase Auth or fallback to JWT
      let userId = user?.uid
      
      if (!userId) {
        const token = document.cookie
          .split('; ')
          .find(row => row.startsWith('token='))
          ?.split('=')[1]
        
        if (token) {
          try {
            const res = await fetch('/api/auth/me', {
              headers: { 'Authorization': `Bearer ${token}` }
            })
            const data = await res.json()
            userId = data.user?.id || data.user?.uid
          } catch (err) {
            console.error('Error fetching user:', err)
          }
        }
      }
      
      // Try to get conversation and config from Firebase first
      let interviewConversation = []
      let interviewConfig = null
      const sessionId = sessionStorage.getItem('currentInterviewSessionId')
      
      if (sessionId && userId) {
        console.log('Fetching conversation from Firebase, session:', sessionId)
        try {
          const sessionResponse = await fetch(`/api/interviews/session?sessionId=${sessionId}`)
          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json()
            if (sessionData.session?.conversation?.length > 0) {
              interviewConversation = sessionData.session.conversation
              interviewConfig = sessionData.session.interviewConfig
              console.log('Loaded conversation from Firebase:', interviewConversation.length, 'messages')
              console.log('Loaded config from Firebase:', interviewConfig)
            }
          }
        } catch (err) {
          console.error('Error fetching from Firebase:', err)
        }
      }
      
      // Fallback to localStorage/sessionStorage if Firebase didn't have data
      if (interviewConversation.length === 0) {
        interviewConversation = JSON.parse(localStorage.getItem('interview_conversation') || '[]')
        console.log('Loaded conversation from localStorage fallback:', interviewConversation.length, 'messages')
      }
      
      // Get config from sessionStorage if not from Firebase
      if (!interviewConfig) {
        const storedConfig = sessionStorage.getItem('interviewConfig')
        if (storedConfig) {
          interviewConfig = JSON.parse(storedConfig)
          console.log('Loaded config from sessionStorage:', interviewConfig)
        }
      }
      
      console.log('User responses:', interviewConversation.filter(m => m.type === 'user').length)
      setConversation(interviewConversation)
      
      console.log('Analyzing interview with userId:', userId, 'Config:', interviewConfig)
      
      const response = await fetch('/api/interviews/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          conversation: interviewConversation,
          userId: userId,
          sessionId: sessionId,
          interviewConfig: interviewConfig
        })
      })
      const data = await response.json()
      setAnalysis(data.analysis)
      setTimeout(() => {
        generateVoiceSummary(data.analysis, interviewConversation)
      }, 1500)
      
    } catch (error) {
      console.error('Analysis failed:', error)
    } finally {
      setLoading(false)
    }
  }










  const generateVoiceSummary = async (analysisData, conversationData) => {
    try {
      console.log('Preparing voice summary...')
      const userMessages = conversationData.filter(msg => msg.type === 'user')
      let userName = ""
      if (userMessages.length > 0) {
        const firstMessage = userMessages[0].text.toLowerCase()
        const nameMatch = firstMessage.match(/i'm\s+(\w+)|i am\s+(\w+)|my name is\s+(\w+)/i)
        if (nameMatch) {
          userName = (nameMatch[1] || nameMatch[2] || nameMatch[3]).charAt(0).toUpperCase() + 
                    (nameMatch[1] || nameMatch[2] || nameMatch[3]).slice(1).toLowerCase()
        }
      }

      const summary = generateSummaryText(analysisData, userName)
      const response = await fetch('/api/interviews/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: summary })
      })

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer()
        const blob = new Blob([arrayBuffer], { type: "audio/mpeg" })
        const url = URL.createObjectURL(blob)
        
        const audio = new Audio(url)
        audioRef.current = audio
        
        audio.onplay = () => setIsPlayingSummary(true)
        audio.onended = () => setIsPlayingSummary(false)
        audio.onerror = () => setIsPlayingSummary(false)
        
        setSummaryGenerated(true)
        console.log('Voice summary prepared and ready to play')
      }
    } catch (error) {
      console.error('Voice summary preparation failed:', error)
      setSummaryGenerated(false)
    }
  }




  const generateSummaryText = (analysisData, userName) => {
    const namePrefix = userName ? `${userName}, ` : ""
    const score = analysisData?.overallScore || 0
    
    let scoreComment = ""
    if (score >= 85) {
      scoreComment = "excellent performance"
    } else if (score >= 75) {
      scoreComment = "strong performance"
    } else if (score >= 65) {
      scoreComment = "solid performance with room for improvement"
    } else {
      scoreComment = "performance that shows potential with several areas to develop"
    }

    const strengths = analysisData?.strengths || [
      "Clear communication",
      "Professional demeanor",
      "Relevant experience"
    ]

    const improvements = analysisData?.improvements || [
      "Provide more specific examples",
      "Elaborate on technical skills",
      "Show more enthusiasm"
    ]

    const summary = `${namePrefix}thank you for completing the interview. Based on our conversation, I've given you a score of ${score} out of 100, reflecting ${scoreComment}. 

Your key strengths include ${strengths.slice(0, 2).join(' and ')}, which clearly demonstrate your capabilities. 

For areas of improvement, I recommend focusing on ${improvements.slice(0, 2).join(' and ')}. These enhancements will significantly strengthen your interview performance.

Overall, you showed good potential and with some targeted practice on the mentioned areas, you'll be well-prepared for future interviews. You can review the detailed analysis below for specific recommendations.`

    return summary
  }

  const toggleSummaryAudio = async () => {
    if (audioRef.current) {
      if (isPlayingSummary) {
        audioRef.current.pause()
        setIsPlayingSummary(false)
      } else {
        audioRef.current.play()
        setIsPlayingSummary(true)
      }
    } else if (analysis && conversation.length > 0) {
      await generateVoiceSummary(analysis, conversation)
      if (audioRef.current) {
        audioRef.current.play()
      }
    }
  }

  const downloadAudio = async () => {
    try {
      const response = await fetch('/api/interviews/download-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation })
      })
      
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `interview-${Date.now()}.mp3`
      a.click()
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  const downloadPDF = async () => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 20
      let yPosition = margin

      // Add logo at top right
      try {
        const logoImg = new Image()
        logoImg.src = '/favicon-96x96.png'
        await new Promise((resolve) => {
          logoImg.onload = resolve
          logoImg.onerror = resolve
        })
        pdf.addImage(logoImg, 'PNG', pageWidth - 35, 10, 20, 20)
      } catch (e) {
        console.log('Logo not added:', e)
      }

      // Title
      pdf.setFontSize(24)
      pdf.setTextColor(17, 24, 39)
      pdf.text('Interview Results Report', margin, yPosition)
      yPosition += 15

      // Date
      pdf.setFontSize(10)
      pdf.setTextColor(107, 114, 128)
      pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, margin, yPosition)
      yPosition += 15

      // Overall Score Section
      pdf.setFillColor(6, 182, 212)
      pdf.circle(pageWidth / 2, yPosition + 15, 20, 'S')
      pdf.setFontSize(28)
      pdf.setTextColor(17, 24, 39)
      pdf.text(`${analysis?.overallScore || 0}`, pageWidth / 2, yPosition + 18, { align: 'center' })
      pdf.setFontSize(10)
      pdf.setTextColor(107, 114, 128)
      pdf.text('out of 100', pageWidth / 2, yPosition + 25, { align: 'center' })
      yPosition += 45

      pdf.setFontSize(16)
      pdf.setTextColor(17, 24, 39)
      pdf.text('Overall Performance', pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 8

      pdf.setFontSize(10)
      pdf.setTextColor(107, 114, 128)
      const feedback = analysis?.overallFeedback || "Good performance with room for improvement"
      const feedbackLines = pdf.splitTextToSize(feedback, pageWidth - 2 * margin)
      pdf.text(feedbackLines, pageWidth / 2, yPosition, { align: 'center' })
      yPosition += feedbackLines.length * 5 + 10

      // Metrics Section
      pdf.setFontSize(14)
      pdf.setTextColor(17, 24, 39)
      pdf.text('Performance Metrics', margin, yPosition)
      yPosition += 10

      const metrics = [
        { label: 'Communication', score: analysis?.communicationScore || 0, color: [6, 182, 212] },
        { label: 'Confidence', score: analysis?.confidenceScore || 0, color: [16, 185, 129] },
        { label: 'Relevance', score: analysis?.relevanceScore || 0, color: [245, 158, 11] }
      ]

      metrics.forEach((metric) => {
        pdf.setFillColor(...metric.color)
        pdf.rect(margin, yPosition, 50, 8, 'F')
        pdf.setFontSize(10)
        pdf.setTextColor(255, 255, 255)
        pdf.text(metric.label, margin + 2, yPosition + 5.5)
        pdf.setTextColor(17, 24, 39)
        pdf.text(`${metric.score}/100`, margin + 55, yPosition + 5.5)
        yPosition += 12
      })
      yPosition += 5

      // Strengths Section
      pdf.setFontSize(14)
      pdf.setTextColor(16, 185, 129)
      pdf.text('Strengths', margin, yPosition)
      yPosition += 8

      const strengths = analysis?.strengths || [
        "Clear communication style",
        "Good examples provided",
        "Professional demeanor"
      ]

      pdf.setFontSize(10)
      pdf.setTextColor(55, 65, 81)
      strengths.forEach((strength) => {
        pdf.text(`• ${strength}`, margin + 5, yPosition)
        yPosition += 6
      })
      yPosition += 5

      // Areas for Improvement Section
      pdf.setFontSize(14)
      pdf.setTextColor(245, 158, 11)
      pdf.text('Areas for Improvement', margin, yPosition)
      yPosition += 8

      const improvements = analysis?.improvements || [
        "Provide more specific examples",
        "Elaborate on technical skills",
        "Show more enthusiasm"
      ]

      pdf.setFontSize(10)
      pdf.setTextColor(55, 65, 81)
      improvements.forEach((improvement) => {
        pdf.text(`• ${improvement}`, margin + 5, yPosition)
        yPosition += 6
      })
      yPosition += 5

      // Check if we need a new page
      if (yPosition > pageHeight - 60) {
        pdf.addPage()
        yPosition = margin
      }

      // Detailed Analysis Section
      pdf.setFontSize(14)
      pdf.setTextColor(17, 24, 39)
      pdf.text('Detailed Analysis', margin, yPosition)
      yPosition += 8

      pdf.setFontSize(10)
      pdf.setTextColor(55, 65, 81)
      const detailedAnalysis = analysis?.detailedAnalysis || "Your interview performance shows good potential with several areas of strength."
      const analysisLines = pdf.splitTextToSize(detailedAnalysis, pageWidth - 2 * margin)
      pdf.text(analysisLines, margin, yPosition)
      yPosition += analysisLines.length * 5 + 8

      // Recommendations Section
      pdf.setFontSize(12)
      pdf.setTextColor(17, 24, 39)
      pdf.text('Recommendations:', margin, yPosition)
      yPosition += 7

      const recommendations = analysis?.recommendations || [
        "Practice the STAR method for behavioral questions",
        "Prepare specific examples that demonstrate your key skills",
        "Research the company and role more thoroughly"
      ]

      pdf.setFontSize(10)
      pdf.setTextColor(55, 65, 81)
      recommendations.forEach((rec) => {
        if (yPosition > pageHeight - 20) {
          pdf.addPage()
          yPosition = margin
        }
        const recLines = pdf.splitTextToSize(`• ${rec}`, pageWidth - 2 * margin - 5)
        pdf.text(recLines, margin + 5, yPosition)
        yPosition += recLines.length * 5 + 2
      })

      pdf.setFontSize(8)
      pdf.setTextColor(156, 163, 175)
      pdf.text('InterviewPro - AI-Powered Interview Practice', pageWidth / 2, pageHeight - 10, { align: 'center' })

      // Save PDF
      pdf.save(`interview-results-${Date.now()}.pdf`)
    } catch (error) {
      console.error('PDF generation failed:', error)
      alert('Failed to generate PDF. Please try again.')
    }
  }

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        backgroundColor: '#f9fafb',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          {/* Single Spinner */}
          <div style={{
            width: '80px',
            height: '80px',
            border: '8px solid #e5e7eb',
            borderTop: '8px solid #06b6d4',
            borderRadius: '50%',
            margin: '0 auto 1.5rem',
            animation: 'spin 1s linear infinite'
          }}></div>
          
          {/* Loading Text */}
          <p style={{ 
            color: '#374151',
            fontSize: '1.25rem',
            fontWeight: '600',
            marginBottom: '0.5rem'
          }}>
            AI analyzing your interview...
          </p>
          
          {/* Status Text */}
          <p style={{
            color: '#6b7280',
            fontSize: '0.875rem'
          }}>
            Processing your responses and generating insights...
          </p>
        </div>
        
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        padding: '1rem 2rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => router.push('/user-dashboard')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 1rem', backgroundColor: 'transparent',
              border: '1px solid #d1d5db', borderRadius: '8px',
              cursor: 'pointer', color: '#374151'
            }}
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', margin: 0 }}>
            Interview Results
          </h1>
        </div>
      </div>

      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Overall Score */}
        <div style={{
          backgroundColor: 'white', borderRadius: '12px', padding: '2rem',
          marginBottom: '2rem',
          textAlign: 'center'
        }}>
          <div style={{
            width: '120px', height: '120px', margin: '0 auto 1rem',
            position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="8"/>
              <circle 
                cx="60" cy="60" r="50" fill="none" stroke="#06b6d4" strokeWidth="8"
                strokeDasharray={`${(analysis?.overallScore || 0) * 3.14} 314`}
                strokeLinecap="round"
              />
            </svg>
            <div style={{
              position: 'absolute', fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', textAlign: 'center'
            }}>
              <div>{analysis?.overallScore || 0}</div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: 'normal' }}>out of 100</div>
            </div>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>
            Overall Performance
          </h2>
          <p style={{ color: '#6b7280', fontSize: '1rem' }}>
            {analysis?.overallFeedback || "Good performance with room for improvement"}
          </p>
          
          {/* Voice Summary Control */}
          <div style={{ marginTop: '1.5rem' }}>
            <button
              onClick={toggleSummaryAudio}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: isPlayingSummary ? '#ef4444' : '#06b6d4',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: summaryGenerated || analysis ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                margin: '0 auto',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.3s ease',
                opacity: summaryGenerated || analysis ? 1 : 0.6
              }}
              disabled={!summaryGenerated && !analysis}
            >
              {isPlayingSummary ? <VolumeX size={16} /> : <Volume2 size={16} />}
              {isPlayingSummary ? 'Stop Voice Summary' : 'Play Voice Summary'}
            </button>
            {summaryGenerated && (
              <p style={{ 
                fontSize: '0.75rem', 
                color: '#6b7280', 
                marginTop: '0.5rem',
                fontStyle: 'italic' 
              }}>
                {isPlayingSummary ? 'Playing personalized results summary...' : 'Click to hear your personalized results summary'}
              </p>
            )}
          </div>
        </div>

        {/* Statistics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem',
            textAlign: 'center'
          }}>
            <BarChart3 size={32} color="#06b6d4" style={{ margin: '0 auto 1rem' }} />
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111827' }}>
              {analysis?.communicationScore || 0}/100
            </div>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Communication</p>
          </div>

          <div style={{
            backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem',
            textAlign: 'center'
          }}>
            <TrendingUp size={32} color="#10b981" style={{ margin: '0 auto 1rem' }} />
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111827' }}>
              {analysis?.confidenceScore || 0}/100
            </div>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Confidence</p>
          </div>

          <div style={{
            backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem',
            textAlign: 'center'
          }}>
            <Award size={32} color="#f59e0b" style={{ margin: '0 auto 1rem' }} />
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111827' }}>
              {analysis?.relevanceScore || 0}/100
            </div>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Relevance</p>
          </div>
        </div>

        {/* Analysis & Improvements */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
          {/* Strengths */}
          <div style={{
            backgroundColor: 'white', borderRadius: '12px', padding: '2rem'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#10b981', marginBottom: '1rem' }}>
              Strengths
            </h3>
            {(analysis?.strengths || [
              "Clear communication style",
              "Good examples provided",
              "Professional demeanor"
            ]).map((strength, index) => (
              <div key={index} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                marginBottom: '0.75rem', color: '#374151'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#10b981">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>{strength}</span>
              </div>
            ))}
          </div>

          {/* Areas for Improvement */}
          <div style={{
            backgroundColor: 'white', borderRadius: '12px', padding: '2rem'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f59e0b', marginBottom: '1rem' }}>
              Areas for Improvement
            </h3>
            {(analysis?.improvements || [
              "Provide more specific examples",
              "Elaborate on technical skills",
              "Show more enthusiasm"
            ]).map((improvement, index) => (
              <div key={index} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                marginBottom: '0.75rem', color: '#374151'
              }}>
                <AlertCircle size={16} color="#f59e0b" />
                <span>{improvement}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Analysis */}
        <div style={{
          backgroundColor: 'white', borderRadius: '12px', padding: '2rem',
          marginBottom: '2rem'
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
            Detailed Analysis
          </h3>
          <p style={{ color: '#374151', lineHeight: '1.6', marginBottom: '1rem' }}>
            {analysis?.detailedAnalysis || "Your interview performance shows good potential with several areas of strength. You demonstrated clear communication skills and provided relevant examples when discussing your experience. To improve further, consider providing more specific details and quantifiable results in your responses."}
          </p>
          
          <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '0.5rem' }}>
            Recommendations:
          </h4>
          <ul style={{ color: '#374151', paddingLeft: '1.5rem' }}>
            {(analysis?.recommendations || [
              "Practice the STAR method (Situation, Task, Action, Result) for behavioral questions",
              "Prepare specific examples that demonstrate your key skills",
              "Research the company and role more thoroughly",
              "Work on projecting confidence through body language and tone"
            ]).map((rec, index) => (
              <li key={index} style={{ marginBottom: '0.5rem' }}>{rec}</li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={downloadPDF}
            style={{
              padding: '1rem 2rem', backgroundColor: '#8b5cf6', color: 'white',
              border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
            }}
          >
            <FileText size={20} />
            Download PDF Report
          </button>

          <button
            onClick={downloadAudio}
            style={{
              padding: '1rem 2rem', backgroundColor: '#06b6d4', color: 'white',
              border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)'
            }}
          >
            <Download size={20} />
            Download Audio
          </button>
          
          <button
            onClick={() => router.push('/live-ai-interview')}
            style={{
              padding: '1rem 2rem', backgroundColor: '#10b981', color: 'white',
              border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600',
              cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}
          >
            Practice Again
          </button>
        </div>
      </div>
    </div>
  )
}
