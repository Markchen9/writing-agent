import { contextBridge, ipcRenderer } from 'electron'

type CreationConstitution = {
  id: string
  name: string
  isDefault: boolean
  tone: 'professional' | 'casual' | 'humorous' | 'serious' | 'technical'
  perspective: 'first-person' | 'third-person'
  targetAudience: string
  contentRules: string[]
  customConstitution: string
}

type Topic = {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
  order?: number
  constitutionId?: string | null
  temporaryAdjustments?: string
  chatHistory?: { role: 'user' | 'assistant', content: string }[]
  aiEditHistory?: {
    undoStack: string[]
    redoStack: string[]
    maxSteps: number
  }
}

type Config = {
  llm: {
    provider: string
    apiKey: string
    baseUrl: string
    model: string
  }
  creationConstitutions?: CreationConstitution[]
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Topics
  getTopics: () => ipcRenderer.invoke('get-topics'),
  saveTopics: (data: unknown) => ipcRenderer.invoke('save-topics', data),

  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config: unknown) => ipcRenderer.invoke('save-config', config),

  // Export
  exportMarkdown: (content: string, title: string) =>
    ipcRenderer.invoke('export-markdown', content, title),

  // LLM
  callLLM: (messages: Array<{ role: string; content: string }>) =>
    ipcRenderer.invoke('call-llm', messages),

  // Menu events
  onMenuNewTopic: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('menu-new-topic', handler)
    return () => ipcRenderer.removeListener('menu-new-topic', handler)
  },
  onMenuExport: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('menu-export', handler)
    return () => ipcRenderer.removeListener('menu-export', handler)
  }
})

declare global {
  interface Window {
    electronAPI: {
      getTopics: () => Promise<{ topics: Topic[] }>
      saveTopics: (data: { topics: Topic[] }) => Promise<{ success: boolean; error?: string }>
      getConfig: () => Promise<Config>
      saveConfig: (config: Config) => Promise<{ success: boolean; error?: string }>
      exportMarkdown: (content: string, title: string) => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>
      callLLM: (messages: Array<{ role: string; content: string }>) => Promise<{ success: boolean; content?: string; error?: string }>
      onMenuNewTopic: (callback: () => void) => () => void
      onMenuExport: (callback: () => void) => () => void
    }
  }
}
