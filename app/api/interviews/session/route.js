import { NextResponse } from 'next/server'
import { db } from '../../../../lib/firebase.js'
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'

// Create or update an interview session in real-time
export async function POST(request) {
  try {
    const { sessionId, userId, conversation, interviewConfig, action } = await request.json()
    
    console.log('=== Interview Session API ===')
    console.log('Action:', action)
    console.log('Session ID:', sessionId)
    console.log('User ID:', userId)
    console.log('Conversation length:', conversation?.length || 0)
    console.log('Interview Config:', interviewConfig)
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }
    
    if (action === 'create') {
      // Create a new interview session
      const sessionRef = doc(db, 'interview_sessions_live', sessionId)
      await setDoc(sessionRef, {
        userId,
        conversation: conversation || [],
        interviewConfig: interviewConfig || {},
        status: 'in_progress',
        questionsAnswered: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      
      console.log('Created new session:', sessionId)
      return NextResponse.json({ success: true, sessionId })
    }
    
    if (action === 'update') {
      // Update existing session with new conversation
      const sessionRef = doc(db, 'interview_sessions_live', sessionId)
      const userResponses = conversation?.filter(m => m.type === 'user')?.length || 0
      
      const updateData = {
        conversation: conversation || [],
        questionsAnswered: userResponses,
        updatedAt: serverTimestamp()
      }
      
      // Also update interviewConfig if provided
      if (interviewConfig) {
        updateData.interviewConfig = interviewConfig
      }
      
      await updateDoc(sessionRef, updateData)
      
      console.log('Updated session:', sessionId, 'Questions answered:', userResponses)
      return NextResponse.json({ success: true, questionsAnswered: userResponses })
    }
    
    if (action === 'complete') {
      // Mark session as complete
      const sessionRef = doc(db, 'interview_sessions_live', sessionId)
      const userResponses = conversation?.filter(m => m.type === 'user')?.length || 0
      
      await updateDoc(sessionRef, {
        conversation: conversation || [],
        questionsAnswered: userResponses,
        status: 'completed',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      
      console.log('Completed session:', sessionId)
      return NextResponse.json({ success: true, status: 'completed' })
    }
    
    if (action === 'get') {
      // Get session data
      const sessionRef = doc(db, 'interview_sessions_live', sessionId)
      const sessionSnap = await getDoc(sessionRef)
      
      if (!sessionSnap.exists()) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
      
      const sessionData = sessionSnap.data()
      console.log('Retrieved session:', sessionId)
      return NextResponse.json({ success: true, session: sessionData })
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    
  } catch (error) {
    console.error('Interview session error:', error)
    return NextResponse.json({ error: 'Session operation failed' }, { status: 500 })
  }
}

// Get session by ID
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }
    
    const sessionRef = doc(db, 'interview_sessions_live', sessionId)
    const sessionSnap = await getDoc(sessionRef)
    
    if (!sessionSnap.exists()) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true, session: sessionSnap.data() })
    
  } catch (error) {
    console.error('Get session error:', error)
    return NextResponse.json({ error: 'Failed to get session' }, { status: 500 })
  }
}
