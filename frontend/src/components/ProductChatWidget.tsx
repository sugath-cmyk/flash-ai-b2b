import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

interface ProductChatWidgetProps {
  apiKey: string;
  storeId: string;
  product: {
    id: string;
    title: string;
    description: string;
    price: string;
    vendor: string;
  };
}

export default function ProductChatWidget({ apiKey, storeId, product }: ProductChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generate or retrieve sessionId
  useEffect(() => {
    let storedSessionId = localStorage.getItem('chat_session_id');
    if (!storedSessionId) {
      storedSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('chat_session_id', storedSessionId);
    }
    setSessionId(storedSessionId);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initialize with welcome message when component mounts
    if (messages.length === 0) {
      const welcomeMessage: Message = {
        id: '1',
        text: `Hi! I'm Flash AI. Ask me anything about ${product.title}!`,
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, []);

  const sendMessage = async () => {
    if (!inputMessage.trim() || !sessionId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageToSend = inputMessage;
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await axios.post(
        'http://localhost:3000/api/widget/chat',
        {
          message: messageToSend,
          conversationId,
          sessionId,
          visitorId: sessionId, // Use sessionId as visitorId for now
          productContext: {
            productId: product.id,
            productTitle: product.title,
            productDescription: product.description,
            price: product.price,
            vendor: product.vendor,
          },
        },
        {
          headers: {
            'X-API-Key': apiKey,
            'X-Store-ID': storeId,
          },
        }
      );

      if (response.data.success) {
        const botMessage: Message = {
          id: Date.now().toString(),
          text: response.data.data.message,
          sender: 'bot',
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, botMessage]);

        if (response.data.data.conversationId) {
          setConversationId(response.data.data.conversationId);
        }
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      let errorText = 'Sorry, I encountered an error. Please try again.';

      if (error.response?.data?.error) {
        errorText = error.response.data.error;
      } else if (error.response?.status === 429) {
        errorText = 'Message limit exceeded. Please upgrade your plan or try again later.';
      } else if (error.response?.status === 401) {
        errorText = 'Authentication error. Please refresh the page.';
      }

      const errorMessage: Message = {
        id: Date.now().toString(),
        text: errorText,
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="bg-white flex flex-col h-[400px]">

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.sender === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 ${
                message.sender === 'user'
                  ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white'
                  : 'bg-white text-gray-800 border border-gray-200'
              }`}
            >
              <p className="text-xs whitespace-pre-wrap leading-relaxed">{message.text}</p>
              <p
                className={`text-[10px] mt-1 ${
                  message.sender === 'user'
                    ? 'text-white/70'
                    : 'text-gray-400'
                }`}
              >
                {message.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-800 border border-gray-200 rounded-xl px-3 py-2">
              <div className="flex space-x-1">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"></div>
                <div
                  className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.1s' }}
                ></div>
                <div
                  className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s' }}
                ></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Questions */}
      {messages.length === 1 && (
        <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
          <p className="text-[10px] text-gray-500 mb-1.5">Quick questions:</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => {
                setInputMessage('What are the key ingredients?');
                setTimeout(() => sendMessage(), 100);
              }}
              className="text-[10px] bg-white border border-gray-200 px-2 py-1 rounded-full hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
            >
              Key ingredients?
            </button>
            <button
              onClick={() => {
                setInputMessage('Is this suitable for sensitive skin?');
                setTimeout(() => sendMessage(), 100);
              }}
              className="text-[10px] bg-white border border-gray-200 px-2 py-1 rounded-full hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
            >
              For sensitive skin?
            </button>
            <button
              onClick={() => {
                setInputMessage('How do I use this product?');
                setTimeout(() => sendMessage(), 100);
              }}
              className="text-[10px] bg-white border border-gray-200 px-2 py-1 rounded-full hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
            >
              How to use?
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-gray-200 bg-white">
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about this product..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !inputMessage.trim()}
            className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-4 py-2 rounded-full hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
