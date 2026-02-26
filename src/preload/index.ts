import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
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
    ipcRenderer.on('menu-new-topic', callback)
  },
  onMenuExport: (callback: () => void) => {
    ipcRenderer.on('menu-export', callback)
  }
})

// Type declarations for the exposed API
declare global {
  interface Window {
    electronAPI: {
      getTopics: () => Promise<{ topics: Topic[] }>
      saveTopics: (data: { topics: Topic[] }) => Promise<{ success: boolean; error?: string }>
      getConfig: () => Promise<Config>
      saveConfig: (config: Config) => Promise<{ success: boolean; error?: string }>
      exportMarkdown: (content: string, title: string) => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>
      callLLM: (messages: Array<{ role: string; content: string }>) => Promise<{ success: boolean; content?: string; error?: string }>
      onMenuNewTopic: (callback: () => void) => void
      onMenuExport: (callback: () => void) => void
    }
  }
}

interface Topic {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

interface Config {
  llm: {
    provider: string
    apiKey: string
    baseUrl: string
    model: string
  }
}
