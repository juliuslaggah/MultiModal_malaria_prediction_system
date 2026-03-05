"use client"

import { useState, useRef, useEffect } from 'react'
import { 
  Bot,
  Send,
  X,
  Maximize2,
  Minimize2,
  MessageSquare,
  Sparkles,
  Stethoscope,
  Thermometer,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react'
import clsx from 'clsx'

type Message = {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  suggestions?: string[]
}

// Predefined responses for the mock AI assistant (kept as fallback)
const getAssistantResponse = (userMessage: string): { response: string; suggestions: string[] } => {
  const lowerMsg = userMessage.toLowerCase()
  
  if (lowerMsg.includes('fever') && lowerMsg.includes('headache')) {
    return {
      response: "Fever with headache is common in malaria, but also occurs in many other conditions. How long have these symptoms been present? Have you traveled to an endemic area recently?",
      suggestions: ['2-3 days', '1 week', 'Traveled recently', 'No travel']
    }
  }
  else if (lowerMsg.includes('symptom') || lowerMsg.includes('symptoms')) {
    return {
      response: "Common malaria symptoms include fever, headache, chills, fatigue, nausea, and muscle pain. In severe cases, patients may experience confusion, seizures, or difficulty breathing.",
      suggestions: ['Tell me about fever', 'What about chills?', 'Severe symptoms?', 'Treatment options']
    }
  }
  else if (lowerMsg.includes('treatment') || lowerMsg.includes('medication')) {
    return {
      response: "Treatment depends on the malaria type, severity, and patient factors. Common antimalarials include artemisinin-based combination therapies (ACTs). Always consult a healthcare provider for proper diagnosis and treatment.",
      suggestions: ['ACT medications', 'Side effects', 'Prevention', 'Drug resistance']
    }
  }
  else if (lowerMsg.includes('prevent') || lowerMsg.includes('prevention')) {
    return {
      response: "Malaria prevention includes: using insecticide-treated bed nets, indoor residual spraying, taking prophylactic medications when traveling to endemic areas, and wearing protective clothing.",
      suggestions: ['Bed nets', 'Travel medication', 'Vaccines?', 'Mosquito repellent']
    }
  }
  else if (lowerMsg.includes('risk') || lowerMsg.includes('endemic')) {
    return {
      response: "Malaria is endemic in tropical and subtropical regions including sub-Saharan Africa, parts of Asia, and Latin America. Children under 5 and pregnant women are at highest risk.",
      suggestions: ['High-risk areas', 'Pregnancy risks', 'Children', 'Travel precautions']
    }
  }
  else if (lowerMsg.includes('diagnos') || lowerMsg.includes('test')) {
    return {
      response: "Malaria is diagnosed through: 1) Microscopic examination of blood smears (gold standard), 2) Rapid diagnostic tests (RDTs), and 3) PCR tests. Our system uses blood smear images for AI-assisted diagnosis.",
      suggestions: ['Blood smear', 'RDT accuracy', 'PCR test', 'Our AI model']
    }
  }
  else if (lowerMsg.includes('heatmap') || lowerMsg.includes('grad-cam')) {
    return {
      response: "Grad-CAM heatmaps highlight regions in blood smear images that influenced our model's decision. Red areas indicate where the model focused most - typically infected red blood cells or parasite clusters.",
      suggestions: ['How to interpret', 'Example heatmap', 'Model confidence', 'False positives']
    }
  }
  else if (lowerMsg.includes('accuracy') || lowerMsg.includes('how good')) {
    return {
      response: "Our multimodal system achieves 94.5% accuracy on test data. The fusion model (clinical + image) outperforms either modality alone. For specific metrics, check the Analytics page.",
      suggestions: ['Clinical accuracy', 'Image accuracy', 'Fusion benefits', 'View analytics']
    }
  }
  else {
    return {
      response: "I'm your AI clinical assistant for malaria diagnosis. I can help with symptoms, treatment, prevention, and explain how our prediction system works. What would you like to know?",
      suggestions: ['Common symptoms', 'How diagnosis works', 'Treatment options', 'Prevention tips']
    }
  }
}

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(true) // Keep open by default
  const [isExpanded, setIsExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      type: 'assistant',
      content: "👋 Hi! I'm your AI clinical assistant. Ask me anything about malaria diagnosis, symptoms, or how our system works.",
      timestamp: new Date(),
      suggestions: ['Common symptoms', 'How diagnosis works', 'Treatment options', 'Prevention tips']
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // ✅ UPDATED: handleSendMessage now calls the real API with fallback to mock
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsTyping(true)

    try {
      // Try to get response from real API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: inputValue })
      })

      if (!response.ok) throw new Error('API request failed')
      
      const data = await response.json()
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.response,
        timestamp: new Date(),
        suggestions: data.suggestions
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      // Fallback to mock responses if API fails
      const { response, suggestions } = getAssistantResponse(inputValue)
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response,
        timestamp: new Date(),
        suggestions
      }
      setMessages(prev => [...prev, assistantMessage])
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion)
    setTimeout(() => handleSendMessage(), 100)
  }

  return (
    <>
      {/* Compact Sidebar - Always visible, but slim */}
      <div className={clsx(
        "fixed top-0 left-0 z-40 flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-lg transition-all duration-300 h-full",
        isExpanded ? "w-80" : "w-64"
      )}>
        {/* Ultra Compact Header */}
        <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-gray-800 dark:to-gray-800">
          <div className="flex items-center space-x-2">
            <div className="p-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-md">
              <Bot className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-xs font-semibold text-gray-900 dark:text-white">AI Assistant</span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              title={isExpanded ? "Compact view" : "Expanded view"}
            >
              {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              title="Hide"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Messages - Compact */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {messages.map((message) => (
            <div
              key={message.id}
              className={clsx(
                "flex",
                message.type === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div className={clsx(
                "max-w-[90%] rounded-lg p-1.5",
                message.type === 'user'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
              )}>
                <p className="text-[11px] leading-tight">{message.content}</p>
                <p className="text-[8px] mt-0.5 opacity-70">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          
          {/* Suggestions - Mini chips */}
          {messages[messages.length - 1]?.suggestions && (
            <div className="flex flex-wrap gap-1 mt-1">
              {messages[messages.length - 1].suggestions?.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="text-[9px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-gray-700 dark:text-gray-300 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-1.5">
                <div className="flex space-x-0.5">
                  <div className="w-1 h-1 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1 h-1 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1 h-1 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Info - Ultra compact */}
        <div className="px-2 pb-1 grid grid-cols-2 gap-1">
          <div className="p-1 bg-blue-50 dark:bg-blue-900/20 rounded">
            <div className="flex items-center text-[8px] text-blue-600 dark:text-blue-400">
              <Stethoscope className="h-2 w-2 mr-0.5" />
              Clinical
            </div>
            <p className="text-[7px] text-gray-600 dark:text-gray-400">94.5%</p>
          </div>
          <div className="p-1 bg-purple-50 dark:bg-purple-900/20 rounded">
            <div className="flex items-center text-[8px] text-purple-600 dark:text-purple-400">
              <Bot className="h-2 w-2 mr-0.5" />
              Image
            </div>
            <p className="text-[7px] text-gray-600 dark:text-gray-400">92.1%</p>
          </div>
        </div>

        {/* Input - Compact */}
        <div className="p-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-1">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask..."
              className="flex-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border-0 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isTyping}
              className={clsx(
                "p-1 rounded transition-colors",
                inputValue.trim() && !isTyping
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:opacity-90'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              )}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content shift - Add padding to main content to account for sidebar */}
      <style jsx global>{`
        main {
          padding-left: ${isOpen && !isExpanded ? '256px' : isOpen && isExpanded ? '320px' : '0'};
          transition: padding-left 0.3s ease;
        }
      `}</style>
    </>
  )
}
