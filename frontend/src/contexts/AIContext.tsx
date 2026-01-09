import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type LLMProvider = 'gemini' | 'openai' | 'claude' | 'perplexity' | 'deepseek' | 'grok' | 'custom';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  customEndpoint?: string;
  customName?: string;
  enabled: boolean;
}

interface AIContextType {
  llmConfig: LLMConfig | null;
  setLLMConfig: (config: LLMConfig) => void;
  clearLLMConfig: () => void;
  optimizeContent: (content: string, context?: string) => Promise<string>;
  suggestHashtags: (content: string) => Promise<string[]>;
  suggestPostingTime: (platform: string) => Promise<string>;
}

const AI_CONFIG_KEY = 'mastablasta_ai_config';

const defaultLLMEndpoints: Record<Exclude<LLMProvider, 'custom'>, string> = {
  gemini: 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent',
  openai: 'https://api.openai.com/v1/chat/completions',
  claude: 'https://api.anthropic.com/v1/messages',
  perplexity: 'https://api.perplexity.ai/chat/completions',
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  grok: 'https://api.x.ai/v1/chat/completions',
};

const AIContext = createContext<AIContextType | undefined>(undefined);

export function AIProvider({ children }: { children: ReactNode }) {
  const [llmConfig, setLLMConfigState] = useState<LLMConfig | null>(() => {
    const stored = localStorage.getItem(AI_CONFIG_KEY);
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (llmConfig) {
      localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(llmConfig));
    } else {
      localStorage.removeItem(AI_CONFIG_KEY);
    }
  }, [llmConfig]);

  const setLLMConfig = (config: LLMConfig) => {
    setLLMConfigState(config);
  };

  const clearLLMConfig = () => {
    setLLMConfigState(null);
  };

  const callLLM = async (prompt: string): Promise<string> => {
    if (!llmConfig || !llmConfig.enabled) {
      throw new Error('AI is not configured or enabled');
    }

    const endpoint = llmConfig.provider === 'custom' 
      ? llmConfig.customEndpoint 
      : defaultLLMEndpoints[llmConfig.provider];

    if (!endpoint) {
      throw new Error('No endpoint configured');
    }

    let requestBody: any;
    let headers: any = {
      'Content-Type': 'application/json',
    };

    // Configure request based on provider
    switch (llmConfig.provider) {
      case 'gemini':
        requestBody = {
          contents: [{
            parts: [{ text: prompt }]
          }]
        };
        const geminiUrl = `${endpoint}?key=${llmConfig.apiKey}`;
        const geminiResponse = await fetch(geminiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        });
        if (!geminiResponse.ok) throw new Error('Gemini API request failed');
        const geminiData = await geminiResponse.json();
        return geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

      case 'openai':
      case 'perplexity':
      case 'deepseek':
      case 'grok':
        headers['Authorization'] = `Bearer ${llmConfig.apiKey}`;
        requestBody = {
          model: llmConfig.provider === 'openai' ? 'gpt-4' : 
                 llmConfig.provider === 'perplexity' ? 'pplx-70b-online' :
                 llmConfig.provider === 'deepseek' ? 'deepseek-chat' :
                 'grok-beta',
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
        };
        break;

      case 'claude':
        headers['x-api-key'] = llmConfig.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        requestBody = {
          model: 'claude-3-sonnet-20240229',
          messages: [
            { role: 'user', content: prompt }
          ],
          max_tokens: 1024,
        };
        break;

      case 'custom':
        headers['Authorization'] = `Bearer ${llmConfig.apiKey}`;
        requestBody = {
          messages: [
            { role: 'user', content: prompt }
          ],
        };
        break;
    }

    // Make API call for non-Gemini providers
    if (llmConfig.provider !== 'gemini') {
      const response = await fetch(endpoint!, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();

      // Extract response based on provider
      if (llmConfig.provider === 'claude') {
        return data.content?.[0]?.text || '';
      } else {
        return data.choices?.[0]?.message?.content || '';
      }
    }

    return '';
  };

  const optimizeContent = async (content: string, context?: string): Promise<string> => {
    const prompt = `You are a social media content optimization expert. Improve the following post to make it more engaging, concise, and effective for social media platforms. ${context ? `Context: ${context}` : ''}\n\nOriginal post:\n${content}\n\nProvide ONLY the optimized post text without any explanations or labels.`;
    
    try {
      return await callLLM(prompt);
    } catch (error) {
      console.error('AI optimization error:', error);
      throw error;
    }
  };

  const suggestHashtags = async (content: string): Promise<string[]> => {
    const prompt = `Analyze this social media post and suggest 5-7 relevant hashtags that would increase its reach and engagement:\n\n${content}\n\nProvide ONLY the hashtags, one per line, starting with #. No explanations.`;
    
    try {
      const response = await callLLM(prompt);
      return response
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('#'))
        .slice(0, 7);
    } catch (error) {
      console.error('AI hashtag suggestion error:', error);
      throw error;
    }
  };

  const suggestPostingTime = async (platform: string): Promise<string> => {
    const prompt = `Based on social media best practices and engagement data, what is the optimal time to post on ${platform} for maximum engagement? Consider the current day and time. Provide ONLY the recommended time in format "HH:MM AM/PM" with a brief one-sentence explanation.`;
    
    try {
      return await callLLM(prompt);
    } catch (error) {
      console.error('AI posting time suggestion error:', error);
      throw error;
    }
  };

  return (
    <AIContext.Provider value={{
      llmConfig,
      setLLMConfig,
      clearLLMConfig,
      optimizeContent,
      suggestHashtags,
      suggestPostingTime,
    }}>
      {children}
    </AIContext.Provider>
  );
}

export function useAI() {
  const context = useContext(AIContext);
  if (context === undefined) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
}
