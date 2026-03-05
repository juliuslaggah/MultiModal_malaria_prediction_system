import { NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are a clinical AI assistant specializing in malaria diagnosis and tropical medicine. 
You provide concise, accurate information about:
- Malaria symptoms, diagnosis, and treatment
- Interpreting blood smear images and Grad-CAM heatmaps
- WHO guidelines for malaria management
- Prevention and risk factors

Keep responses brief (2-3 sentences) and suitable for healthcare workers. 
Always include appropriate medical disclaimers.`

export async function POST(req: Request) {
  try {
    const { message } = await req.json()
    const API_KEY = process.env.GEMINI_API_KEY

    if (!API_KEY) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      )
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${SYSTEM_PROMPT}\n\nUser: ${message}`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 200,
          }
        })
      }
    )

    const data = await response.json()
    
    // Extract the response text
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                      "I'm having trouble answering that right now."

    // Generate context-aware suggestions
    const suggestions = generateSuggestions(message)

    return NextResponse.json({ 
      response: aiResponse,
      suggestions 
    })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to get response' },
      { status: 500 }
    )
  }
}

function generateSuggestions(message: string): string[] {
  const lower = message.toLowerCase()
  
  if (lower.includes('fever')) {
    return ['Malaria symptoms', 'When to test', 'Other causes', 'Treatment']
  }
  if (lower.includes('image') || lower.includes('microscopy') || lower.includes('heatmap')) {
    return ['Image quality', 'Grad-CAM help', 'False positives', 'Confidence scores']
  }
  if (lower.includes('treatment') || lower.includes('drug')) {
    return ['First-line drugs', 'Dosing', 'Side effects', 'Drug resistance']
  }
  if (lower.includes('prevent') || lower.includes('avoid')) {
    return ['Bed nets', 'Prophylaxis', 'Vaccines', 'Travel advice']
  }
  if (lower.includes('risk') || lower.includes('endemic')) {
    return ['High-risk areas', 'Children', 'Pregnancy', 'Travel precautions']
  }
  if (lower.includes('diagnos') || lower.includes('test')) {
    return ['Blood smear', 'RDT', 'PCR test', 'Accuracy']
  }
  
  return [
    'Common symptoms',
    'Diagnosis methods',
    'Treatment options',
    'Prevention tips'
  ]
}
