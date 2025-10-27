import { NextResponse } from 'next/server'
import { createInterview } from '../../../../lib/firebase.js'

export async function POST(request) {
  try {
    const { conversation, userId } = await request.json()

   





    

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
    
    const analysisPrompt = `Analyze this job interview conversation with EXTREME STRICTNESS and BRUTAL HONESTY.

IMPORTANT CONTEXT:
- Expected questions: 6
- Actual questions asked: ${aiQuestions.length}
- Candidate responses: ${userResponses.length}
- Completion rate: ${Math.round((userResponses.length / 6) * 100)}%
- "I don't know" responses: ${dontKnowCount} out of ${userResponses.length}
- Average response length: ${Math.round(userResponses.reduce((acc, r) => acc + r.text.length, 0) / Math.max(userResponses.length, 1))} characters

ULTRA-STRICT SCORING GUIDELINES (START FROM 0):

INSTANT DISQUALIFICATION (0-10 points):
- Profanity or disrespectful language
- "Don't care" or "not interested" attitude
- 75%+ "I don't know" responses
- Answered less than 2 questions

CATASTROPHIC FAILURE (10-25 points):
- 50-75% "I don't know" responses
- Answered only 2-3 questions
- Average response under 20 characters
- Multiple instances of profanity or negativity

SEVERE FAILURE (25-40 points):
- 33-50% "I don't know" responses
- Answered only 4 questions
- Average response 20-40 characters
- Mostly vague or wrong answers

POOR PERFORMANCE (40-55 points):
- 20-33% "I don't know" responses
- Answered 5 questions
- Average response 40-70 characters
- Some correct answers but lacking detail

BELOW AVERAGE (55-65 points):
- Few "I don't know" responses
- Answered all 6 questions but very brief (70-100 chars avg)
- Correct but minimal answers
- Lacks enthusiasm or detail

AVERAGE (65-75 points):
- No "I don't know" responses
- Answered all 6 questions with moderate detail (100-150 chars avg)
- Mostly correct answers
- Professional demeanor

GOOD (75-85 points):
- Answered all 6 questions with good detail (150-200 chars avg)
- All correct answers with examples
- Professional and enthusiastic
- Clear communication

EXCELLENT (85-95 points):
- Answered all 6 questions with exceptional detail (200+ chars avg)
- Perfect answers with specific examples and results
- Highly professional and passionate
- Outstanding communication

PERFECT (95-100 points):
- Reserved for truly exceptional interviews only
- Every answer is detailed, insightful, and demonstrates mastery
- Goes above and beyond expectations

CRITICAL RULES:
- Brief responses (<50 chars avg) = Maximum 50 points regardless of other factors
- Any "I don't know" = Deduct 5-10 points EACH
- Incomplete interview (<6 questions) = Maximum 60 points
- Vague answers ("maybe", "I think", "I guess") = Deduct 3-5 points EACH
- Internet slang = Deduct 5-10 points
- Wrong answers = Deduct 5-10 points EACH

BE ABSOLUTELY RUTHLESS. Real hiring managers would reject 90% of candidates. Only truly prepared, knowledgeable, professional candidates should score above 70.

CONVERSATION:
${conversationText}

Provide analysis in this EXACT JSON format (no markdown, just JSON):
{
  "overallScore": 75,
  "communicationScore": 78,
  "confidenceScore": 82,
  "relevanceScore": 85,
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
    await saveInterviewToDatabase(conversation, analysis, userId)

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
  
  // Count AI questions (excluding greetings and closing remarks)
  const aiQuestions = conversation.filter(msg => 
    msg.type === 'ai' && 
    msg.text.includes('?') && 
    !msg.text.toLowerCase().includes('hello') &&
    !msg.text.toLowerCase().includes('thank you')
  ).length
  
  // Calculate completion rate (expected 6 questions)
  const expectedQuestions = 6
  const completionRate = Math.min(responseCount / expectedQuestions, 1)
  
  // Start from 0 for truly unbiased scoring
  let baseScore = 0
  
  // Add points for completion (up to 25 points) - FURTHER REDUCED
  // Must complete ALL questions to get full points
  if (completionRate === 1) {
    baseScore += 25 // Only full credit for 6/6
  } else if (completionRate >= 0.83) {
    baseScore += 15 // 5/6 questions
  } else if (completionRate >= 0.67) {
    baseScore += 8 // 4/6 questions
  } else if (completionRate >= 0.5) {
    baseScore += 4 // 3/6 questions
  } else if (completionRate >= 0.33) {
    baseScore += 2 // 2/6 questions
  } else {
    baseScore += 0 // Less than 2 questions - ZERO
  }
  
  // Add points for response quality (up to 45 points) - FURTHER INCREASED
  // Quality is KING - matters most
  if (avgResponseLength > 250) {
    baseScore += 45 // Exceptional detail (250+ chars)
  } else if (avgResponseLength > 200) {
    baseScore += 38 // Outstanding detail (200-250 chars)
  } else if (avgResponseLength > 150) {
    baseScore += 30 // Very detailed responses (150-200 chars)
  } else if (avgResponseLength > 120) {
    baseScore += 22 // Good detail (120-150 chars)
  } else if (avgResponseLength > 90) {
    baseScore += 14 // Moderate detail (90-120 chars)
  } else if (avgResponseLength > 60) {
    baseScore += 8 // Minimal detail (60-90 chars)
  } else if (avgResponseLength > 40) {
    baseScore += 4 // Very brief (40-60 chars)
  } else if (avgResponseLength > 25) {
    baseScore += 1 // Extremely brief (25-40 chars)
  } else {
    baseScore += 0 // Pathetic responses (<25 chars) - ZERO points
  }
  
  // Add points for professionalism and knowledge (up to 30 points) - SAME but HARSHER penalties
  // Check for unprofessional language and lack of knowledge
  const combinedText = userResponses.map(r => r.text.toLowerCase()).join(' ')
  const hasProfanity = /fuck|shit|damn|crap|hell|ass|bitch|bastard|piss/i.test(combinedText)
  const hasNegativeAttitude = /don't care|not interested|whatever|boring|waste.*time|stupid|dumb/i.test(combinedText)
  
  // Count "I don't know" responses - EXPANDED detection
  const dontKnowCount = userResponses.filter(r => 
    /i don't know|i dont know|idk|no idea|not sure|dunno|i have no clue|what is that|i didn't|i didnt|no clue|clueless|beats me/i.test(r.text.toLowerCase())
  ).length
  const dontKnowRatio = dontKnowCount / Math.max(responseCount, 1)
  
  // Check for internet slang and unprofessional shortcuts - EXPANDED
  const hasSlang = /\bidk\b|\blol\b|\blmao\b|\bbrb\b|\btbh\b|\bngl\b|\bfr\b|lowkey|highkey|gonna|wanna|gotta|kinda|sorta|dunno|yeah|yep|nope|nah/i.test(combinedText)
  
  // Check for extremely vague responses - EXPANDED
  const vagueCount = userResponses.filter(r => {
    const text = r.text.toLowerCase().trim()
    return /^(hmm|uh|um|er|like|maybe|i think|i guess|probably|perhaps|possibly|i suppose|not really|kind of|sort of)[\s,]*/i.test(text) ||
           text.length < 15 // Responses under 15 chars are likely vague
  }).length
  const vagueRatio = vagueCount / Math.max(responseCount, 1)
  
  // Calculate professionalism and knowledge score
  let professionalismScore = 30
  
  // INSTANT ZERO for profanity - NO TOLERANCE
  if (hasProfanity) {
    professionalismScore = 0 // Set to ZERO immediately, don't subtract
  }
  
  // INSTANT ZERO for negative attitude - NO TOLERANCE
  if (hasNegativeAttitude) {
    professionalismScore = 0 // Set to ZERO immediately
  }
  
  // DEVASTATING deductions for "I don't know" responses
  if (dontKnowRatio >= 0.75) {
    professionalismScore = 0 // 75%+ "I don't know" = INSTANT ZERO
  } else if (dontKnowRatio >= 0.5) {
    professionalismScore -= 28 // 50-75% "I don't know" = almost zero
  } else if (dontKnowRatio >= 0.33) {
    professionalismScore -= 20 // 33-50% "I don't know" = severe penalty
  } else if (dontKnowCount >= 3) {
    professionalismScore -= 15 // 3+ "I don't know" = major penalty
  } else if (dontKnowCount >= 2) {
    professionalismScore -= 10 // 2 "I don't know" = significant penalty
  } else if (dontKnowCount === 1) {
    professionalismScore -= 5 // 1 "I don't know" = minor penalty
  }
  
  // HARSH deductions for vague responses
  if (vagueRatio >= 0.75) {
    professionalismScore -= 15 // 75%+ vague = major issue
  } else if (vagueRatio > 0.5) {
    professionalismScore -= 12 // More than half are vague
  } else if (vagueRatio > 0.3) {
    professionalismScore -= 8 // 30-50% vague
  }
  
  // HARSH deductions for internet slang
  if (hasSlang) {
    professionalismScore -= 10 // Increased from 8
  }
  
  // Ensure minimum 0
  professionalismScore = Math.max(0, professionalismScore)
  baseScore += professionalismScore
  
  // Apply STRICT caps based on performance
  let overallScore = Math.round(baseScore)
  
  // HARD CAP: Brief responses (<60 chars avg) = MAX 40 points
  if (avgResponseLength < 60) {
    overallScore = Math.min(overallScore, 40)
  }
  // HARD CAP: Very brief responses (<40 chars avg) = MAX 25 points
  else if (avgResponseLength < 40) {
    overallScore = Math.min(overallScore, 25)
  }
  // HARD CAP: Pathetic responses (<25 chars avg) = MAX 15 points
  else if (avgResponseLength < 25) {
    overallScore = Math.min(overallScore, 15)
  }
  
  // HARD CAP: Incomplete interview (<6 questions) = MAX 50 points
  if (responseCount < 6) {
    overallScore = Math.min(overallScore, 50)
  }
  
  // HARD CAP: Very incomplete (<4 questions) = MAX 30 points
  if (responseCount < 4) {
    overallScore = Math.min(overallScore, 30)
  }
  
  // HARD CAP: Barely started (<3 questions) = MAX 20 points
  if (responseCount < 3) {
    overallScore = Math.min(overallScore, 20)
  }
  
  // HARD CAP: Any "I don't know" responses = deduct from cap
  if (dontKnowRatio >= 0.5) {
    overallScore = Math.min(overallScore, 35) // 50%+ "idk" = MAX 35
  }
  
  // HARD CAP: Profanity or negative attitude = MAX 15 points
  if (hasProfanity || hasNegativeAttitude) {
    overallScore = Math.min(overallScore, 15)
  }
  
  // Final cap at 100
  overallScore = Math.min(overallScore, 100)
  
  // Calculate individual scores based on completion and quality
  const communicationScore = Math.min(Math.round(baseScore * 0.9 + (avgResponseLength > 50 ? 10 : 0)), 100)
  const confidenceScore = Math.min(Math.round(baseScore * 0.95 + (responseCount >= 5 ? 5 : 0)), 100)
  const relevanceScore = Math.min(Math.round(baseScore * 1.05), 100)
  
  // Generate feedback based on performance
  let overallFeedback = ""
  let strengths = []
  let improvements = []
  let detailedAnalysis = ""
  
  // Use the already declared variables from above: dontKnowCount, dontKnowRatio, hasSlang, hasProfanity, hasNegativeAttitude
  if (hasProfanity || hasNegativeAttitude) {
    overallFeedback = "Unprofessional interview conduct - inappropriate language and/or negative attitude"
    strengths = [
      "Showed up for the interview"
    ]
    improvements = [
      "Maintain professional language at all times",
      "Show genuine interest and enthusiasm",
      "Avoid profanity and negative statements",
      "Treat interviews with respect and seriousness",
      "Complete all interview questions",
      "Provide thoughtful, detailed responses"
    ]
    detailedAnalysis = `Your interview performance was highly unprofessional. ${hasProfanity ? 'You used inappropriate language, which is completely unacceptable in any professional setting.' : ''} ${hasNegativeAttitude ? 'You expressed disinterest and a negative attitude, which immediately disqualifies you from consideration.' : ''} You only answered ${responseCount} out of ${expectedQuestions} questions with an average response length of ${Math.round(avgResponseLength)} characters. This demonstrates a lack of preparation, respect, and genuine interest. In real interviews, such behavior would result in immediate termination of the interview and no job offer.`
  } else if (dontKnowRatio > 0.5) {
    overallFeedback = "Insufficient knowledge demonstrated - majority of responses were 'I don't know'"
    strengths = [
      "Completed all interview questions",
      "Maintained professional demeanor"
    ]
    improvements = [
      "Study and prepare thoroughly before interviews",
      "Research common interview questions for your field",
      "Practice answering technical questions",
      "Never say 'I don't know' without attempting an answer",
      "Use the 'best guess' approach when uncertain",
      "Demonstrate problem-solving skills even when unsure"
    ]
    detailedAnalysis = `You completed all ${expectedQuestions} questions, which shows commitment. However, ${dontKnowCount} out of ${responseCount} responses (${Math.round(dontKnowRatio * 100)}%) were variations of "I don't know." This demonstrates a severe lack of preparation and knowledge. ${hasSlang ? 'Additionally, you used internet slang like "idk" which is unprofessional.' : ''} In real interviews, repeatedly saying "I don't know" signals to employers that you lack the necessary skills and preparation. Even when uncertain, you should attempt to reason through the question or relate it to what you do know. Your average response length was ${Math.round(avgResponseLength)} characters, which is too brief. You must prepare more thoroughly and practice articulating your thoughts.`
  } else if (completionRate < 0.5) {
    overallFeedback = "Interview incomplete - only answered " + responseCount + " out of " + expectedQuestions + " questions"
    strengths = [
      "Showed initial engagement",
      "Started the interview process"
    ]
    improvements = [
      "Complete all interview questions",
      "Provide more detailed responses",
      "Demonstrate commitment by finishing the interview",
      "Prepare better before starting the interview"
    ]
    detailedAnalysis = `You only answered ${responseCount} out of ${expectedQuestions} questions, which significantly impacts your score. Completing the full interview is essential for a proper assessment. Your responses averaged ${Math.round(avgResponseLength)} characters, which ${avgResponseLength < 30 ? 'is quite brief and needs more detail' : 'shows some effort but could be more comprehensive'}. To improve, ensure you complete all questions and provide thoughtful, detailed answers.`
  } else if (completionRate < 1) {
    overallFeedback = "Partially completed interview with room for improvement"
    strengths = [
      "Participated in most of the interview",
      "Provided responses to several questions"
    ]
    improvements = [
      "Complete all interview questions",
      "Provide more detailed examples",
      "Elaborate on specific experiences",
      "Show more enthusiasm for the role"
    ]
    detailedAnalysis = `You answered ${responseCount} out of ${expectedQuestions} questions. While you showed engagement, completing the full interview is important for a comprehensive evaluation. Your responses averaged ${Math.round(avgResponseLength)} characters. Consider providing more detailed answers with specific examples to strengthen your performance.`
  } else {
    if (avgResponseLength < 30) {
      overallFeedback = "Completed interview but responses were too brief"
      strengths = [
        "Completed all interview questions",
        "Maintained professional demeanor"
      ]
      improvements = [
        "Provide much more detailed responses",
        "Use the STAR method for structured answers",
        "Include specific examples and results",
        "Elaborate on your experiences and skills"
      ]
      if (dontKnowCount > 0) {
        improvements.unshift("Avoid saying 'I don't know' - always attempt an answer")
      }
      detailedAnalysis = `You completed all ${expectedQuestions} questions, which is good. However, your responses averaged only ${Math.round(avgResponseLength)} characters, which is too brief for a meaningful interview. ${dontKnowCount > 0 ? `Additionally, you said "I don't know" ${dontKnowCount} time(s), which shows lack of preparation. ` : ''}${hasSlang ? 'You also used internet slang which is unprofessional. ' : ''}Effective interview answers should be detailed, include specific examples, and demonstrate your qualifications thoroughly.`
    } else if (avgResponseLength < 80) {
      overallFeedback = dontKnowCount > 2 ? "Completed interview but lacked sufficient knowledge" : "Completed interview with adequate responses"
      strengths = [
        "Completed all interview questions",
        "Provided reasonable responses",
        "Maintained professional demeanor"
      ]
      improvements = [
        "Provide more detailed examples",
        "Use the STAR method for behavioral questions",
        "Elaborate on specific achievements",
        "Show more enthusiasm and passion"
      ]
      if (dontKnowCount > 0) {
        improvements.unshift("Prepare more thoroughly to avoid 'I don't know' responses")
      }
      detailedAnalysis = `You completed all ${expectedQuestions} questions with responses averaging ${Math.round(avgResponseLength)} characters. ${dontKnowCount > 0 ? `However, you said "I don't know" ${dontKnowCount} time(s), which indicates insufficient preparation. ` : ''}${hasSlang ? 'You used internet slang which should be avoided in professional settings. ' : ''}This shows some engagement, but there's significant room to provide more comprehensive answers with specific examples and measurable results to strengthen your interview performance.`
    } else {
      overallFeedback = "Good interview performance with clear communication"
      strengths = [
        "Completed all interview questions",
        "Provided detailed responses",
        "Maintained professional demeanor",
        "Demonstrated good communication skills"
      ]
      improvements = [
        "Continue refining your STAR method responses",
        "Include more quantifiable achievements",
        "Show even more enthusiasm for the role",
        "Practice articulating complex ideas clearly"
      ]
      detailedAnalysis = `You completed all ${expectedQuestions} questions with responses averaging ${Math.round(avgResponseLength)} characters. This demonstrates good engagement and communication skills. You provided thoughtful answers and maintained professionalism throughout. Continue to refine your responses with specific examples and measurable results.`
    }
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
async function saveInterviewToDatabase(conversation, analysis, userId) {
  try {
    const interviewConfig = conversation[0]?.interviewConfig || {}
    
    const categoryMap = {
      'software-engineering': 'Software Engineering',
      'web-development': 'Web Development',
      'data-science': 'Data Science & Analytics',
      'business-management': 'Business Management',
      'accounting-finance': 'Accounting & Finance',
      'healthcare-medical': 'Healthcare & Medical',
      'marketing-sales': 'Marketing & Sales',
      'database-administration': 'Database Administration'
    }
    
    const categoryId = interviewConfig.category || interviewConfig.topic || 'general'
    const categoryTitle = categoryMap[categoryId] || interviewConfig.topic || 'General'
    
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