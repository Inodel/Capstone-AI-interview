'use client'
import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mic, MicOff, Square } from 'lucide-react'

export default function VoiceInterview() {
  const router = useRouter()
  const [isListening, setIsListening] = useState(false)
  const [isAISpeaking, setIsAISpeaking] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(1)
  const [conversation, setConversation] = useState([])
  const [interviewConfig, setInterviewConfig] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [messages, setMessages] = useState([])
  const [isChatMode, setIsChatMode] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [isInterviewEnding, setIsInterviewEnding] = useState(false)
  const [isWaitingForMoreSpeech, setIsWaitingForMoreSpeech] = useState(false)
  const recognitionRef = useRef(null)
  const currentAudioRef = useRef(null)
  const hasStartedRef = useRef(false)
  const silenceTimeoutRef = useRef(null)
  const accumulatedTranscriptRef = useRef('')
  const lastSpeechTimeRef = useRef(null)
  const SILENCE_THRESHOLD_MS = 3500 // 3.5 seconds of silence before processing
  


  useEffect(() => {
    const config = sessionStorage.getItem('interviewConfig')
    if (config) {
      const parsedConfig = JSON.parse(config)
      setInterviewConfig(parsedConfig)

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false // Changed to false to prevent network errors
      recognitionRef.current.interimResults = true
      recognitionRef.current.maxAlternatives = 1
      
      recognitionRef.current.onresult = (event) => {
        if (isProcessing || isAISpeaking) return
        
        const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join('')
        
        // Update last speech time whenever we receive any result
        lastSpeechTimeRef.current = Date.now()
        
        // Clear any existing silence timeout
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current)
          silenceTimeoutRef.current = null
        }
        
        if (event.results[event.results.length - 1].isFinal) {
          // Accumulate the final transcript
          accumulatedTranscriptRef.current = transcript
          
          // Show waiting indicator
          setIsWaitingForMoreSpeech(true)
          
          // Start silence countdown - wait 3.5 seconds before processing
          // This gives user time to continue speaking after a brief pause
          silenceTimeoutRef.current = setTimeout(() => {
            const finalTranscript = accumulatedTranscriptRef.current
            setIsWaitingForMoreSpeech(false)
            if (finalTranscript.trim()) {
              console.log('Silence threshold reached, processing response:', finalTranscript)
              setIsProcessing(true)
              setIsListening(false)
              if (recognitionRef.current) {
                try {
                  recognitionRef.current.stop()
                } catch (e) {
                  // Ignore stop errors
                }
              }
              handleUserResponse(finalTranscript)
              accumulatedTranscriptRef.current = ''
            }
          }, SILENCE_THRESHOLD_MS)
          
          console.log('Final result received, waiting', SILENCE_THRESHOLD_MS, 'ms for more speech...')
        }
      }
      
      recognitionRef.current.onstart = () => {
        console.log('Speech recognition started')
        setIsListening(true)
      }
      
      recognitionRef.current.onerror = (event) => {
        setIsListening(false)
        setIsProcessing(false)
        
        // Handle specific error types
        if (event.error === 'network') {
          console.warn('Network error - speech recognition requires internet connection')
          alert('Speech recognition requires an active internet connection. Please check your connection and try again.')
        } else if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          console.error('Speech recognition error:', event.error)
          alert('Microphone permission denied. Please allow microphone access in your browser settings.')
        } else if (event.error === 'no-speech') {
          // Don't log or show alert for no-speech, just silently handle it
        } else if (event.error === 'aborted') {
          // Don't log aborted errors
        } else {
          console.warn('Speech recognition error:', event.error)
        }
      }
      
      recognitionRef.current.onend = () => {
        console.log('Speech recognition ended')
        
        // If we have accumulated transcript and silence timeout is pending,
        // auto-restart recognition to continue listening for more speech
        if (accumulatedTranscriptRef.current && silenceTimeoutRef.current && !isProcessing && !isAISpeaking && !isInterviewEnding) {
          console.log('Auto-restarting recognition to continue listening...')
          try {
            setTimeout(() => {
              if (recognitionRef.current && !isProcessing && !isAISpeaking) {
                recognitionRef.current.start()
              }
            }, 100)
          } catch (e) {
            console.log('Could not restart recognition:', e)
            setIsListening(false)
          }
        } else {
          setIsListening(false)
        }
      }
    } else {
      console.error('Speech recognition not supported in this browser')
      alert('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.')
    }

      if (!hasStartedRef.current) {
        hasStartedRef.current = true
        const category = parsedConfig.category || 'general'
        const interviewType = parsedConfig.interviewType || 'behavioral'
        const difficulty = parsedConfig.difficulty || 'intermediate'
        
        const categoryName = category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
        
        const difficultyInstructions = {
          beginner: 'Ask entry-level questions. Be encouraging and supportive.',
          intermediate: 'Ask mid-level professional questions with moderate complexity.',
          advanced: 'Ask senior-level challenging questions that require deep expertise.'
        }
        
        const systemPrompt = `You are a PROFESSIONAL ${categoryName.toUpperCase()} INTERVIEWER conducting a ${interviewType.toUpperCase()} interview.

CRITICAL RULES:
1. YOU ARE THE INTERVIEWER - The candidate is being interviewed BY YOU
2. ONLY ask questions related to ${categoryName} and ${interviewType} interview type
3. ${difficultyInstructions[difficulty]}
4. Keep responses under 40 words
5. NEVER go off-topic from ${categoryName}
6. Ask follow-up questions based on candidate's responses
7. Stay strictly within the ${categoryName} domain

Example for Software Engineering Technical:
"What data structures would you use for this problem?"
"Explain the time complexity of your solution."
"How would you optimize this code?"`
        
        setMessages([{ role: "system", content: systemPrompt }])
        
        setTimeout(() => {
          startInterview(parsedConfig)
        }, 1000)
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
      }
    }
  }, [])

  const startInterview = (config) => {
    const category = config?.category || 'general'
    const categoryName = category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    const interviewType = config?.interviewType || 'behavioral'
    
    const greeting = `Hello! Welcome to your ${interviewType} interview for ${categoryName}. I'm your AI interviewer today. Let's begin with our first question. Tell me about yourself and why you're interested in this position.`
    
    const initialConversation = [
      { 
        type: 'ai', 
        text: greeting,
        interviewConfig: config
      }
    ]
    setConversation(initialConversation)
    setMessages(prev => [...prev, { role: "assistant", content: greeting }])
    
    localStorage.setItem('interview_conversation', JSON.stringify(initialConversation))
    
    speakText(greeting)
  }

  const speakText = async (text, isFinalQuestion = false) => {
    if (isAISpeaking) return
    
    setIsAISpeaking(true)
    
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }
    
    try {
      const response = await fetch('/api/interviews/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })

      if (!response.ok) throw new Error("TTS request failed")
      const arrayBuffer = await response.arrayBuffer()
      const blob = new Blob([arrayBuffer], { type: "audio/mpeg" })
      const url = URL.createObjectURL(blob)
      
      const audio = new Audio(url)
      currentAudioRef.current = audio
      
      audio.onended = () => {
        setIsAISpeaking(false)
        currentAudioRef.current = null
        
        if (isFinalQuestion) {
          console.log('Final question audio finished, waiting 10 more seconds before routing...')
          setTimeout(() => {
            console.log('Routing to interview results...')
            router.push('/interview-results')
          }, 10000) // 10 second delay
        }
        // Removed auto-restart - user clicks mic button when ready to respond
      }
      
      audio.onerror = () => {
        setIsAISpeaking(false)
        currentAudioRef.current = null
        
        if (isFinalQuestion) {
          console.log('Audio error on final question, waiting 10 seconds before routing...')
          setTimeout(() => {
            router.push('/interview-results')
          }, 10000)
        }
      }
      
      audio.play()
    } catch (err) {
      console.error("TTS failed:", err)
      setIsAISpeaking(false)
      currentAudioRef.current = null
      
      if (isFinalQuestion) {
        console.log('TTS failed on final question, waiting 10 seconds before routing...')
        setTimeout(() => {
          router.push('/interview-results')
        }, 10000)
      }
    }
  }

  const startListening = async () => {
    if (!recognitionRef.current || isListening || isProcessing || isAISpeaking) {
      console.log('Cannot start listening:', { 
        hasRecognition: !!recognitionRef.current, 
        isListening, 
        isProcessing, 
        isAISpeaking 
      })
      return
    }
    
    try {
      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Small delay to prevent rapid restarts
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Check state again after delay
      if (isProcessing || isAISpeaking || isInterviewEnding) {
        console.log('Aborting start - state changed during delay')
        return
      }
      
      recognitionRef.current.start()
      console.log('Speech recognition start called')
    } catch (error) {
      console.error('Error starting speech recognition:', error)
      setIsListening(false)
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        alert('Microphone permission denied. Please allow microphone access in your browser settings and try again.')
      } else if (error.name === 'InvalidStateError') {
        // Recognition already started, just update state
        console.log('Recognition already started')
        setIsListening(true)
      } else {
        alert('Could not access microphone. Please check your browser settings and try again.')
      }
    }
  }

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      try {
        // Clear silence timeout
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current)
          silenceTimeoutRef.current = null
        }
        setIsWaitingForMoreSpeech(false)
        
        // If there's accumulated transcript, process it immediately
        if (accumulatedTranscriptRef.current.trim()) {
          const finalTranscript = accumulatedTranscriptRef.current
          accumulatedTranscriptRef.current = ''
          setIsProcessing(true)
          setIsListening(false)
          recognitionRef.current.stop()
          handleUserResponse(finalTranscript)
          console.log('Speech recognition stopped - processing accumulated transcript')
        } else {
          recognitionRef.current.stop()
          setIsListening(false)
          console.log('Speech recognition stopped')
        }
      } catch (error) {
        console.error('Error stopping recognition:', error)
        setIsListening(false)
      }
    }
  }

  const handleUserResponse = (transcript) => {
    if (transcript.trim()) {
      const newConversation = [...conversation, { type: 'user', text: transcript }]
      setConversation(newConversation)
      
      const updatedMessages = [...messages, { role: "user", content: transcript }]
      setMessages(updatedMessages)
      
      localStorage.setItem('interview_conversation', JSON.stringify(newConversation))
      
      setTimeout(() => {
        generateAIResponse(updatedMessages)
      }, 500)
    } else {
      setIsProcessing(false)
    }
  }

  const generateAIResponse = async (currentMessages = messages) => {
    try {
      // Count user messages to determine if we should end
      const userMessageCount = currentMessages.filter(m => m.role === 'user').length
      console.log('=== Generating AI Response ===')
      console.log('User message count:', userMessageCount)
      console.log('Sending messages:', currentMessages)
      
      const isRequestingClosing = userMessageCount >= 6
      
      const requestBody = { 
        messages: currentMessages,
        isClosingStatement: isRequestingClosing,
        interviewConfig: interviewConfig
      }
      
      console.log('Request body:', requestBody)
      
      const response = await fetch('/api/interviews/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      console.log('Response status:', response.status, response.ok)

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }

      const data = await response.json()
      console.log('Response data:', data)
      
      if (!data.response) {
        throw new Error('No response received')
      }
      
      const aiResponse = data.response
      console.log('AI will say:', aiResponse)
      
      setMessages(prev => [...prev, { role: "assistant", content: aiResponse }])
      const newConversation = [...conversation, { type: 'ai', text: aiResponse }]
      setConversation(newConversation)
      
      localStorage.setItem('interview_conversation', JSON.stringify(newConversation))
      
      const isFinalQuestion = userMessageCount >= 6
      speakText(aiResponse, isFinalQuestion)
      
      if (isFinalQuestion) {
        setIsInterviewEnding(true)
        console.log('Final question reached - waiting for audio to finish before routing')
      }
      
      setCurrentQuestion(userMessageCount + 1)
      
    } catch (err) {
      console.error("AI Response Generation Failed:", err)
      
      const userMessageCount = currentMessages.filter(m => m.role === 'user').length
      
      if (userMessageCount >= 6) {
        const userMessages = messages.filter(m => m.role === 'user')
        const firstMessage = userMessages[0]?.content?.toLowerCase() || ""
        
        let userName = ""
        const nameMatch = firstMessage.match(/i'm\s+(\w+)|i am\s+(\w+)|my name is\s+(\w+)/i)
        if (nameMatch) {
          userName = (nameMatch[1] || nameMatch[2] || nameMatch[3]).charAt(0).toUpperCase() + 
                    (nameMatch[1] || nameMatch[2] || nameMatch[3]).slice(1).toLowerCase()
        }
        
        const closingResponse = userName 
          ? `Thank you so much, ${userName}! That concludes our interview. Let me analyze our conversation and prepare your results. You did wonderfully!`
          : "Thank you so much! That concludes our interview. Let me analyze our conversation and prepare your results. You did wonderfully!"
        
        setMessages(prev => [...prev, { role: "assistant", content: closingResponse }])
        const newConversation = [...conversation, { type: 'ai', text: closingResponse }]
        setConversation(newConversation)
        
        localStorage.setItem('interview_conversation', JSON.stringify(newConversation))
        speakText(closingResponse, true) // Final question flag
        
        setIsInterviewEnding(true)
        console.log('Final question fallback - waiting for audio to finish')
      } else {
        // Generate contextual fallback response based on last user message
        const lastUserMessage = currentMessages.filter(m => m.role === 'user').pop()
        const userText = lastUserMessage?.content?.toLowerCase() || ''
        const wordCount = userText.split(/\s+/).length
        
        let contextualResponse
        if (wordCount < 5) {
          contextualResponse = "Can you provide more details about that?"
        } else if (userText.includes("project") || userText.includes("work")) {
          contextualResponse = "What was your role in that project?"
        } else if (userText.includes("team") || userText.includes("collaborate")) {
          contextualResponse = "How do you handle team conflicts?"
        } else if (userText.includes("challenge") || userText.includes("difficult")) {
          contextualResponse = "What did you learn from that challenge?"
        } else if (userText.includes("yes") || userText.includes("yeah")) {
          contextualResponse = "Can you give me a specific example?"
        } else if (userText.includes("no") || userText.includes("not really")) {
          contextualResponse = "What motivates you professionally?"
        } else {
          contextualResponse = "How did that experience shape your approach to work?"
        }
        
        setMessages(prev => [...prev, { role: "assistant", content: contextualResponse }])
        const newConversation = [...conversation, { type: 'ai', text: contextualResponse }]
        setConversation(newConversation)
        
        localStorage.setItem('interview_conversation', JSON.stringify(newConversation))
        speakText(contextualResponse, false)
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const endInterview = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }
    accumulatedTranscriptRef.current = ''
    setIsProcessing(false)
    router.push('/interview-results')
  }

  // Sound wave visualization
  const SoundWave = () => {
    const bars = Array.from({ length: 9 }, (_, i) => i)
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '60px' }}>
        {bars.map((bar) => (
          <div
            key={bar}
            style={{
              width: '6px',
              backgroundColor: isListening ? '#ef4444' : isAISpeaking ? '#06b6d4' : '#d1d5db',
              borderRadius: '3px',
              height: isListening || isAISpeaking ? `${20 + Math.random() * 40}px` : '20px',
              animation: isListening || isAISpeaking ? `wave 0.5s ease-in-out infinite alternate` : 'none',
              animationDelay: `${bar * 0.1}s`,
              transition: 'all 0.3s ease',
              boxShadow: isListening || isAISpeaking ? '0 0 10px rgba(6, 182, 212, 0.3)' : 'none'
            }}
          />
        ))}
        <style jsx>{`
          @keyframes wave {
            0% { transform: scaleY(0.5); }
            100% { transform: scaleY(1.5); }
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
        borderBottom: '1px solid #e5e7eb',
        padding: '1rem 2rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => router.push('/live-ai-interview')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                backgroundColor: 'transparent',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                cursor: 'pointer',
                color: '#374151'
              }}
            >
              <ArrowLeft size={16} />
              Back to Setup
            </button>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', margin: 0 }}>
              AI Interview Session
            </h1>
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            {isInterviewEnding ? 'Interview Completed - Preparing Results...' : `Question ${messages.filter(m => m.role === 'user').length + 1} of 6`}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Interview Title */}
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
            {interviewConfig?.type ? 
              (interviewConfig.type.charAt(0).toUpperCase() + interviewConfig.type.slice(1) + ' Interview') : 
              'AI Interview'
            }
          </h2>
        </div>

        {/* Sound Wave Visualization */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <SoundWave />
        </div>

        {/* Status Text */}
        <div style={{ fontSize: '1.125rem', color: '#374151', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isAISpeaking ? (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#06b6d4">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span style={{ color: '#06b6d4' }}>AI is speaking...</span>
              </>
            ) : isListening ? (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#ef4444">
                  <path d="M12 1a3 3 0 0 1 3 3v8a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23" stroke="#ef4444" strokeWidth="2"/>
                  <line x1="8" y1="23" x2="16" y2="23" stroke="#ef4444" strokeWidth="2"/>
                </svg>
                <span style={{ color: '#ef4444' }}>Listening to your response...</span>
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#10b981">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span style={{ color: '#10b981' }}>Ready for next interaction</span>
              </>
            )}
          </div>
          {isWaitingForMoreSpeech && isListening && (
            <span style={{ fontSize: '0.875rem', color: '#f59e0b', fontStyle: 'italic' }}>
              Continue speaking or wait 3.5s to submit...
            </span>
          )}
        </div>

        {/* Mode Toggle */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{
            display: 'flex',
            backgroundColor: '#f3f4f6',
            borderRadius: '8px',
            padding: '4px'
          }}>
            <button
              onClick={() => setIsChatMode(false)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: !isChatMode ? '#06b6d4' : 'transparent',
                color: !isChatMode ? 'white' : '#6b7280',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              Voice Mode
            </button>
            <button
              onClick={() => setIsChatMode(true)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: isChatMode ? '#06b6d4' : 'transparent',
                color: isChatMode ? 'white' : '#6b7280',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              Chat Mode
            </button>
          </div>
        </div>

        {/* Chat Input (when in chat mode) */}
        {isChatMode && (
          <div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !isProcessing && textInput.trim()) {
                    handleUserResponse(textInput.trim())
                    setTextInput('')
                  }
                }}
                placeholder="Type your response..."
                disabled={isProcessing || isAISpeaking}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  outline: 'none'
                }}
              />
              <button
                onClick={() => {
                  if (textInput.trim() && !isProcessing) {
                    handleUserResponse(textInput.trim())
                    setTextInput('')
                  }
                }}
                disabled={isProcessing || isAISpeaking || !textInput.trim()}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#06b6d4',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '500',
                  opacity: (isProcessing || isAISpeaking || !textInput.trim()) ? 0.5 : 1
                }}
              >
                Send
              </button>
            </div>
          </div>
        )}

        {/* Voice Controls (when in voice mode) */}
        {!isChatMode && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={isAISpeaking}
              style={{
                padding: '1rem 2rem',
                backgroundColor: isListening ? '#ef4444' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isAISpeaking ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                opacity: isAISpeaking ? 0.5 : 1,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
              }}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              {isListening ? 'Stop Recording' : 'Start Recording'}
            </button>
          </div>
        )}

        {/* End Interview Button */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={endInterview}
            style={{
              padding: '1rem 2rem',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
            }}
          >
            <Square size={20} />
            End Interview
          </button>
        </div>

        {/* Conversation History */}
        <div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem', textAlign: 'center' }}>
            Conversation
          </h3>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {conversation.map((message, index) => (
              <div
                key={index}
                style={{
                  marginBottom: '1rem',
                  padding: '1rem',
                  borderRadius: '8px',
                  backgroundColor: message.type === 'ai' ? '#f0f9ff' : '#f0fdf4',
                  border: message.type === 'ai' ? '1px solid #e0f2fe' : '1px solid #dcfce7'
                }}
              >
                <div style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {message.type === 'ai' ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#06b6d4">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                      <span>AI Interviewer</span>
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#10b981">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      <span>You</span>
                    </>
                  )}
                </div>
                <div style={{ color: '#111827' }}>{message.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}