import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { messages, isClosingStatement = false, interviewConfig } = await request.json()
    console.log('=== Chat API Called ===')
    console.log('Messages:', messages)
    console.log('Interview Config:', interviewConfig)
    console.log('Is closing statement:', isClosingStatement)
    if (isClosingStatement) {
      const userMessages = messages.filter(m => m.role === 'user')
      
      //===============================================
      // I-extract  ang name sa user sa ilang conversation so that personal ang message
      //===============================================
      let userName = ""
      const firstUserMessage = userMessages[0]?.content?.toLowerCase() || ""
      const namePatterns = [
        /i'm\s+(\w+)/i,
        /i am\s+(\w+)/i,
        /my name is\s+(\w+)/i,
        /call me\s+(\w+)/i,
        /im\s+(\w+)/i
      ]
      for (const pattern of namePatterns) {
        const match = firstUserMessage.match(pattern)
        if (match && match[1] && match[1].toLowerCase() !== 'a') {
          userName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()
          break
        }
      }      
 //===============================================
      //  ambot sagbot, (para AI  prompt sheshh!)
  //===============================================
      const closingMessages = userName 
        ? [
            `Thank you so much, ${userName}! That was a wonderful interview. Let me analyze our conversation now and I'll have your personalized feedback ready in just a moment. You did great!`,
            `Excellent interview, ${userName}! I really enjoyed our conversation. Give me a moment to analyze your responses and prepare detailed feedback for you. Well done!`,
            `Thank you, ${userName}, that was fantastic! I'm now going to review our entire conversation and create a comprehensive analysis for you. You'll see the results shortly!`
          ]
        : [
            `Thank you so much! That was a wonderful interview. Let me analyze our conversation now and I'll have your personalized feedback ready in just a moment. You did great!`,
            `Excellent interview! I really enjoyed our conversation. Give me a moment to analyze your responses and prepare detailed feedback for you. Well done!`,
            `Thank you, that was fantastic! I'm now going to review our entire conversation and create a comprehensive analysis for you. You'll see the results shortly!`
          ]
      
      const randomClosing = closingMessages[Math.floor(Math.random() * closingMessages.length)]
      console.log('Generated closing statement:', randomClosing)
      
      return NextResponse.json({ response: randomClosing })
    }
    
    // Handle null or undefined interviewConfig
    const category = interviewConfig?.category || 'general'
    const interviewType = interviewConfig?.interviewType || 'behavioral'
    const difficulty = interviewConfig?.difficulty || 'intermediate'
    const categoryName = category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    
    const difficultyPrompts = {
      beginner: 'Ask simple, entry-level questions suitable for beginners.',
      intermediate: 'Ask moderate complexity questions for mid-level professionals.',
      advanced: 'Ask challenging, senior-level questions requiring deep expertise.'
    }
    
    const systemPrompt = `You are a PROFESSIONAL ${categoryName.toUpperCase()} INTERVIEWER conducting a ${interviewType.toUpperCase()} interview.

CRITICAL RULES:
1. YOU ARE THE INTERVIEWER - NEVER answer as the candidate
2. ONLY ask interview questions related to ${categoryName}
3. ${difficultyPrompts[difficulty]}
4. Ask follow-up questions based on the candidate's previous responses
5. Keep your questions concise (under 40 words)
6. NEVER provide example answers or respond as if you are the candidate
7. Stay in character as the interviewer at all times

Your role: Ask thoughtful ${interviewType} questions about ${categoryName} and listen to the candidate's responses.`
    
    // Check if messages already has a system prompt from voice mode
    const hasSystemPrompt = messages[0]?.role === 'system'
    const messagesToSend = hasSystemPrompt 
      ? messages  // Use existing system prompt from voice mode
      : [{ role: "system", content: systemPrompt }, ...messages]  // Add system prompt for chat mode
    
    const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-ai/DeepSeek-V3.1",
        messages: messagesToSend,
        max_tokens: 60,
        temperature: 0.7,
      }),
    })

    console.log('HuggingFace API Status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('HuggingFace API Error:', response.status, errorText)
      
      //=================================================
      // Kung ma fail ang API, =======> backup response <=======
      // base sa last message sa user para dili ma stuck
      //=================================================
      const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || ""
      
      // More contextual fallback responses based on message content
      const messageWords = lastMessage.split(/\s+/)
      
      if (lastMessage.includes("freelance") || lastMessage.includes("developer")) {
        return NextResponse.json({ response: "What technologies do you specialize in?" })
      } else if (lastMessage.includes("yes") || lastMessage.includes("yeah") || lastMessage.includes("sure")) {
        return NextResponse.json({ response: "Great! Can you give me a specific example?" })
      } else if (lastMessage.includes("no") || lastMessage.includes("not really") || lastMessage.includes("nope")) {
        return NextResponse.json({ response: "I see. What would you say drives your professional growth?" })
      } else if (lastMessage.includes("project") || lastMessage.includes("work")) {
        return NextResponse.json({ response: "What challenges did you face in that project?" })
      } else if (lastMessage.includes("team") || lastMessage.includes("collaborate")) {
        return NextResponse.json({ response: "How do you handle disagreements in a team?" })
      } else if (messageWords.length < 5) {
        return NextResponse.json({ response: "Could you elaborate on that a bit more?" })
      } else {
        return NextResponse.json({ response: "Interesting. How did that experience shape your approach?" })
      }
    }

    const data = await response.json()
    console.log('HuggingFace API Response:', data)
    
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      let aiResponse = data.choices[0].message.content.trim()
      console.log('AI Response:', aiResponse)
      // Check if AI is incorrectly responding as the candidate
      if (aiResponse.toLowerCase().includes("i am") || aiResponse.toLowerCase().includes("i'm a") || aiResponse.toLowerCase().includes("my name is")) {
        const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || ""
        const messageWords = lastMessage.split(/\s+/)
        
        if (lastMessage.includes("freelance") || lastMessage.includes("developer")) {
          aiResponse = "What kind of projects do you enjoy working on most?"
        } else if (lastMessage.includes("yes") || lastMessage.includes("yeah")) {
          aiResponse = "Tell me more about your experience with that."
        } else if (lastMessage.includes("no") || lastMessage.includes("not really")) {
          aiResponse = "What would you say is your biggest professional strength?"
        } else if (lastMessage.includes("project") || lastMessage.includes("work")) {
          aiResponse = "What was your specific role in that project?"
        } else if (messageWords.length < 5) {
          aiResponse = "Can you provide more details about that?"
        } else {
          aiResponse = "How did that experience impact your career development?"
        }
      }
      return NextResponse.json({ response: aiResponse })
    }
    console.log('No valid response from API, using contextual fallback')
    const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || ""
    const messageWords = lastMessage.split(/\s+/)
    
    // Generate contextual fallback based on message length and content
    if (messageWords.length < 5) {
      return NextResponse.json({ response: "Could you expand on that answer?" })
    } else if (lastMessage.includes("work") || lastMessage.includes("project")) {
      return NextResponse.json({ response: "What was the outcome of that work?" })
    } else {
      return NextResponse.json({ response: "How would you approach a similar situation in the future?" })
    }
  } catch (error) {
    console.error('Complete Chat API Failure:', error)
    return NextResponse.json({ response: "Could you tell me more about your experience?" })
  }
}