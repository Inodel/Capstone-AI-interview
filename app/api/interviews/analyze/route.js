import { NextResponse } from 'next/server'
import { createInterview } from '../../../../lib/firebase.js'

export async function POST(request) {
  try {
    const { conversation, userId, sessionId, interviewConfig: passedConfig } = await request.json()
    
    console.log('=== Analyze API Called ===')
    console.log('Conversation length:', conversation?.length || 0)
    console.log('User responses:', conversation?.filter(m => m.type === 'user')?.length || 0)
    console.log('User ID:', userId)
    console.log('Session ID:', sessionId)
    console.log('Passed Config:', passedConfig)

   





    

    // tig analyze sa AI kung unsa ang performance kapoy nag copy paste sa template comments yawaa :)) gora! 
  
    const conversationText = conversation
      .map(msg => `${msg.type === 'ai' ? 'Interviewer' : 'Candidate'}: ${msg.text}`)
      .join('\n\n')

    // Count questions and responses for context
    const userResponses = conversation.filter(msg => msg.type === 'user')
    const aiQuestions = conversation.filter(msg => 
      msg.type === 'ai' && 
      msg.text.includes('?') && 
      !msg.text.toLowerCase().includes('hello') &&
      !msg.text.toLowerCase().includes('thank you')
    )
    
    // Count "I don't know" responses
    const dontKnowCount = userResponses.filter(r => 
      /i don't know|i dont know|idk|no idea|not sure|dunno|i have no clue/i.test(r.text.toLowerCase())
    ).length
    
    const analysisPrompt = `Analyze this job interview conversation fairly and constructively.

CONTEXT:
- Expected questions: 6
- Questions answered: ${userResponses.length}
- Completion rate: ${Math.round((userResponses.length / 6) * 100)}%
- Average response length: ${Math.round(userResponses.reduce((acc, r) => acc + r.text.length, 0) / Math.max(userResponses.length, 1))} characters

BALANCED SCORING GUIDELINES (Start from 50 as baseline):

SCORING CRITERIA:
1. Completion (0-20 points): Full interview = +20, Partial = proportional
2. Response Quality (0-25 points): Based on detail and relevance
3. Communication (0-20 points): Clarity and articulation
4. Professionalism (0-15 points): Appropriate language and attitude
5. Relevance (0-20 points): Answers relate to questions asked

SCORE RANGES:
- 80-100: Excellent - Detailed, relevant, professional responses
- 65-79: Good - Solid answers with room for improvement
- 50-64: Average - Basic responses, needs more detail
- 35-49: Below Average - Brief or off-topic responses
- 0-34: Poor - Incomplete, inappropriate, or minimal effort

IMPORTANT:
- Casual speech (yeah, gonna, kinda) is acceptable in spoken interviews
- Focus on content quality, not perfect grammar
- Be constructive, not punitive
- Recognize effort and engagement

CONVERSATION:
${conversationText}

Provide analysis in this EXACT JSON format (no markdown, just JSON):
{
  "overallScore": 65,
  "communicationScore": 68,
  "confidenceScore": 62,
  "relevanceScore": 65,
  "overallFeedback": "Brief overall assessment",
  "strengths": ["strength1", "strength2", "strength3"],
  "improvements": ["improvement1", "improvement2", "improvement3"],
  "detailedAnalysis": "Detailed paragraph analysis",
  "recommendations": ["rec1", "rec2", "rec3", "rec4"]
}`
    const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-ai/DeepSeek-V3.1",
        messages: [
          { role: "system", content: "You are an expert interview analyst. Provide unbiased, constructive feedback in the exact JSON format requested." },
          { role: "user", content: analysisPrompt }
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    })

    let analysis
    if (response.ok) {
      const data = await response.json()
      try {
        analysis = JSON.parse(data.choices[0].message.content)
      } catch {
        analysis = generateFallbackAnalysis(conversation)
      }
    } else {
      analysis = generateFallbackAnalysis(conversation)
    }
    await saveInterviewToDatabase(conversation, analysis, userId, passedConfig)

    return NextResponse.json({ analysis })

  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json(
      { error: 'Analysis failed', analysis: generateFallbackAnalysis([]) },
      { status: 500 }
    )
  }
}

function generateFallbackAnalysis(conversation) {
  const userResponses = conversation.filter(msg => msg.type === 'user')
  const responseCount = userResponses.length
  const avgResponseLength = userResponses.reduce((acc, msg) => acc + msg.text.length, 0) / Math.max(responseCount, 1)
  
  // Calculate completion rate (expected 6 questions)
  const expectedQuestions = 6
  const completionRate = Math.min(responseCount / expectedQuestions, 1)
  
  // Combine all user text for analysis
  const combinedText = userResponses.map(r => r.text.toLowerCase()).join(' ')
  
  // Only flag truly inappropriate language (not casual speech)
  const hasProfanity = /\b(fuck|shit|bitch|bastard|asshole)\b/i.test(combinedText)
  const hasNegativeAttitude = /\b(don't care|hate this|waste of time|this is stupid|i quit)\b/i.test(combinedText)
  
  // Count genuine "I don't know" responses (not just uncertainty)
  const dontKnowCount = userResponses.filter(r => {
    const text = r.text.toLowerCase().trim()
    // Only count if the ENTIRE response is basically "I don't know"
    return /^(i don't know|i dont know|idk|no idea|i have no clue|not sure)\.?$/i.test(text) ||
           (text.length < 20 && /i don't know|idk|no idea/i.test(text))
  }).length
  const dontKnowRatio = dontKnowCount / Math.max(responseCount, 1)
  
  // Start with a BASE score of 50 (average) and adjust from there
  let baseScore = 50
  
  // COMPLETION BONUS (up to +20 points)
  if (completionRate === 1) {
    baseScore += 20 // Full interview completed
  } else if (completionRate >= 0.83) {
    baseScore += 15 // 5/6 questions
  } else if (completionRate >= 0.67) {
    baseScore += 10 // 4/6 questions
  } else if (completionRate >= 0.5) {
    baseScore += 5 // 3/6 questions
  } else {
    baseScore -= 10 // Less than half completed
  }
  
  // RESPONSE QUALITY (up to +25 points or -15 points)
  if (avgResponseLength > 200) {
    baseScore += 25 // Exceptional detail
  } else if (avgResponseLength > 150) {
    baseScore += 20 // Very detailed
  } else if (avgResponseLength > 100) {
    baseScore += 15 // Good detail
  } else if (avgResponseLength > 70) {
    baseScore += 10 // Moderate detail
  } else if (avgResponseLength > 50) {
    baseScore += 5 // Acceptable
  } else if (avgResponseLength > 30) {
    baseScore += 0 // Brief but okay
  } else {
    baseScore -= 15 // Too brief
  }
  
  // PROFESSIONALISM ADJUSTMENTS
  if (hasProfanity) {
    baseScore -= 30 // Significant penalty for profanity
  }
  
  if (hasNegativeAttitude) {
    baseScore -= 25 // Penalty for negative attitude
  }
  
  // "I DON'T KNOW" PENALTIES (only for excessive use)
  if (dontKnowRatio >= 0.5) {
    baseScore -= 20 // Half or more responses are "I don't know"
  } else if (dontKnowRatio >= 0.33) {
    baseScore -= 10 // Third of responses
  } else if (dontKnowCount >= 2) {
    baseScore -= 5 // A couple "I don't know"
  }
  
  // Ensure score is within bounds
  let overallScore = Math.max(15, Math.min(100, Math.round(baseScore)))
  
  // Calculate individual scores with some variation
  const communicationScore = Math.max(20, Math.min(100, Math.round(overallScore + (avgResponseLength > 80 ? 5 : -5))))
  const confidenceScore = Math.max(20, Math.min(100, Math.round(overallScore + (responseCount >= 5 ? 5 : -5))))
  const relevanceScore = Math.max(20, Math.min(100, Math.round(overallScore + (dontKnowCount === 0 ? 5 : -5))))
  
  // Generate feedback based on the calculated score
  let overallFeedback = ""
  let strengths = []
  let improvements = []
  let detailedAnalysis = ""
  
  // Feedback based on score ranges (more balanced approach)
  if (hasProfanity || hasNegativeAttitude) {
    overallFeedback = "Interview needs improvement - please maintain professional conduct"
    strengths = [
      "Participated in the interview",
      "Showed willingness to engage"
    ]
    improvements = [
      "Maintain professional language throughout",
      "Show genuine interest and enthusiasm",
      "Provide thoughtful, detailed responses"
    ]
    detailedAnalysis = `Your interview could benefit from a more professional approach. You answered ${responseCount} out of ${expectedQuestions} questions with an average response length of ${Math.round(avgResponseLength)} characters. Focus on maintaining a positive, professional demeanor and providing detailed, thoughtful responses.`
  } else if (overallScore >= 80) {
    overallFeedback = "Excellent interview performance - well prepared and articulate"
    strengths = [
      "Completed all interview questions thoroughly",
      "Provided detailed and relevant responses",
      "Demonstrated strong communication skills",
      "Showed professionalism throughout"
    ]
    improvements = [
      "Continue refining your STAR method responses",
      "Include more quantifiable achievements",
      "Research company-specific details for future interviews"
    ]
    detailedAnalysis = `Outstanding performance! You answered ${responseCount} questions with an average response length of ${Math.round(avgResponseLength)} characters. Your responses were detailed, relevant, and demonstrated strong preparation. Keep up the excellent work!`
  } else if (overallScore >= 65) {
    overallFeedback = "Good interview performance with room for improvement"
    strengths = [
      "Completed the interview questions",
      "Provided reasonable responses",
      "Maintained professional demeanor"
    ]
    improvements = [
      "Provide more detailed examples in your answers",
      "Use the STAR method for behavioral questions",
      "Elaborate on specific achievements and results"
    ]
    detailedAnalysis = `Good job! You answered ${responseCount} questions with an average response length of ${Math.round(avgResponseLength)} characters. Your responses showed engagement and understanding. To improve further, focus on providing more specific examples and quantifiable results.`
  } else if (overallScore >= 50) {
    overallFeedback = "Satisfactory performance - more preparation recommended"
    strengths = [
      "Participated in the interview",
      "Showed willingness to answer questions"
    ]
    improvements = [
      "Provide longer, more detailed responses",
      "Prepare specific examples from your experience",
      "Practice articulating your thoughts clearly",
      "Complete all interview questions"
    ]
    detailedAnalysis = `You answered ${responseCount} questions with an average response length of ${Math.round(avgResponseLength)} characters. While you showed engagement, your responses could be more detailed. Focus on preparing specific examples and practicing your delivery for better results.`
  } else {
    overallFeedback = "Interview needs significant improvement"
    strengths = [
      "Started the interview process",
      "Showed initial engagement"
    ]
    improvements = [
      "Complete all interview questions",
      "Provide much more detailed responses",
      "Prepare thoroughly before interviews",
      "Practice answering common interview questions"
    ]
    detailedAnalysis = `You answered ${responseCount} out of ${expectedQuestions} questions with an average response length of ${Math.round(avgResponseLength)} characters. To improve, focus on completing all questions and providing detailed, thoughtful responses. Practice with common interview questions in your field.`
  }

  return {
    overallScore,
    communicationScore,
    confidenceScore,
    relevanceScore,
    overallFeedback,
    strengths,
    improvements,
    detailedAnalysis,
    recommendations: [
      "Practice the STAR method (Situation, Task, Action, Result) for behavioral questions",
      "Prepare specific examples from your experience with measurable outcomes",
      "Research the company and role thoroughly before interviews",
      "Work on projecting confidence and enthusiasm in your responses",
      "Complete all interview questions to get a proper assessment"
    ]
  }
}
async function saveInterviewToDatabase(conversation, analysis, userId, passedConfig = null) {
  try {
    // Use passed config first, then fallback to conversation[0].interviewConfig
    const interviewConfig = passedConfig || conversation[0]?.interviewConfig || {}
    
    console.log('Saving interview with config:', interviewConfig)
    
    const categoryMap = {
      'software-engineering': 'Software Engineering',
      'web-development': 'Web Development',
      'data-science': 'Data Science & Analytics',
      'business-management': 'Business Management',
      'accounting-finance': 'Accounting & Finance',
      'healthcare-medical': 'Healthcare & Medical',
      'marketing-sales': 'Marketing & Sales',
      'database-administration': 'Database Administration',
      // Also map titles to themselves in case title is passed instead of ID
      'Software Engineering': 'Software Engineering',
      'Web Development': 'Web Development',
      'Data Science & Analytics': 'Data Science & Analytics',
      'Business Management': 'Business Management',
      'Accounting & Finance': 'Accounting & Finance',
      'Healthcare & Medical': 'Healthcare & Medical',
      'Marketing & Sales': 'Marketing & Sales',
      'Database Administration': 'Database Administration'
    }
    
    const categoryId = interviewConfig.category || interviewConfig.topic || 'general'
    // Try to get title from map, or use the category value directly if it's already a title
    const categoryTitle = categoryMap[categoryId] || categoryId || 'General'
    
    console.log('Interview Config:', interviewConfig)
    console.log('Category ID:', categoryId, 'Category Title:', categoryTitle)
    
    await createInterview({
      userId: userId,
      conversation,
      analysis,
      overall_score: analysis.overallScore,
      communicationScore: analysis.communicationScore,
      confidenceScore: analysis.confidenceScore,
      relevanceScore: analysis.relevanceScore,
      clarityScore: analysis.clarityScore || 0,
      detailedAnalysis: analysis.detailedAnalysis,
      strengths: analysis.strengths,
      improvements: analysis.improvements,
      recommendations: analysis.recommendations,
      interviewType: interviewConfig.interviewType || 'General',
      difficulty: interviewConfig.difficulty || 'intermediate',
      topic: categoryTitle,
      category: categoryId,
      timestamp: new Date()
    })
    console.log('Interview saved successfully for user:', userId, 'Category:', categoryTitle)
  } catch (error) {
    console.error('Database save error:', error)
  }
}