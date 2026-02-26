import { useState, useEffect } from 'react'
import TopicList from './pages/TopicList'
import Editor from './pages/Editor'
import Settings from './pages/Settings'

// 创作宪法类型定义
export type CreationConstitution = {
  id: string
  name: string
  isDefault: boolean
  tone: 'professional' | 'casual' | 'humorous' | 'serious' | 'technical'
  perspective: 'first-person' | 'third-person'
  targetAudience: string
  contentRules: string[]
  customConstitution: string
}

export type Topic = {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
  order?: number  // 同一列内的排序顺序
  constitutionId: string | null  // 关联的创作宪法 ID，null 表示不启用
  temporaryAdjustments: string    // 临时调整的规则（只对当前文档生效）
}

export type Config = {
  llm: {
    provider: string
    apiKey: string
    baseUrl: string
    model: string
  }
  creationConstitutions: CreationConstitution[]  // 多套创作宪法
}

type Page = 'topics' | 'editor' | 'settings'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('topics')
  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
  const [config, setConfig] = useState<Config | null>(null)

  // Load topics and config on mount
  useEffect(() => {
    loadTopics()
    loadConfig()
  }, [])

  // Listen for menu events
  useEffect(() => {
    window.electronAPI.onMenuNewTopic(() => {
      setCurrentPage('topics')
      // Trigger new topic modal
      const event = new CustomEvent('new-topic')
      window.dispatchEvent(event)
    })

    window.electronAPI.onMenuExport(() => {
      if (selectedTopicId) {
        const topic = topics.find(t => t.id === selectedTopicId)
        if (topic) {
          handleExport(topic.content, topic.title)
        }
      }
    })
  }, [selectedTopicId, topics])

  const loadTopics = async () => {
    const data = await window.electronAPI.getTopics()
    setTopics(data.topics || [])
  }

  const loadConfig = async () => {
    const cfg = await window.electronAPI.getConfig()
    // 如果没有创作宪法，提供一个默认的
    if (cfg && !cfg.creationConstitutions) {
      cfg.creationConstitutions = []
    }
    setConfig(cfg)
  }

  const saveTopics = async (newTopics: Topic[]) => {
    await window.electronAPI.saveTopics({ topics: newTopics })
    setTopics(newTopics)
  }

  const saveConfig = async (newConfig: Config) => {
    await window.electronAPI.saveConfig(newConfig)
    setConfig(newConfig)
  }

  const handleExport = async (content: string, title: string) => {
    const result = await window.electronAPI.exportMarkdown(content, title)
    if (result.success) {
      alert(`已导出到: ${result.path}`)
    } else if (!result.canceled) {
      alert(`导出失败: ${result.error}`)
    }
  }

  const handleSelectTopic = (topicId: string) => {
    setSelectedTopicId(topicId)
    setCurrentPage('editor')

    // Update status to in_progress if pending
    const topic = topics.find(t => t.id === topicId)
    if (topic && topic.status === 'pending') {
      const updatedTopics = topics.map(t =>
        t.id === topicId ? { ...t, status: 'in_progress' as const, updatedAt: new Date().toISOString() } : t
      )
      saveTopics(updatedTopics)
    }
  }

  const handleBackToTopics = () => {
    setCurrentPage('topics')
    setSelectedTopicId(null)
    loadTopics()
  }

  const selectedTopic = selectedTopicId ? topics.find(t => t.id === selectedTopicId) : null

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title" onClick={() => setCurrentPage('topics')}>写作Agent</h1>
        </div>
        <nav className="header-nav">
          <button
            className={currentPage === 'topics' ? 'active' : ''}
            onClick={() => setCurrentPage('topics')}
          >
            选题管理
          </button>
          <button
            className={currentPage === 'editor' ? 'active' : ''}
            onClick={() => selectedTopicId && setCurrentPage('editor')}
            disabled={!selectedTopicId}
          >
            创作
          </button>
          <button
            className={currentPage === 'settings' ? 'active' : ''}
            onClick={() => setCurrentPage('settings')}
          >
            设置
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {currentPage === 'topics' && (
          <TopicList
            topics={topics}
            onSelectTopic={handleSelectTopic}
            onSaveTopics={saveTopics}
          />
        )}
        {currentPage === 'editor' && selectedTopic && (
          <Editor
            topic={selectedTopic}
            onUpdateTopic={(updated) => {
              const newTopics = topics.map(t =>
                t.id === updated.id ? updated : t
              )
              saveTopics(newTopics)
            }}
            onBack={handleBackToTopics}
            config={config}
            constitutions={config?.creationConstitutions || []}
          />
        )}
        {currentPage === 'settings' && config && (
          <Settings
            config={config}
            onSaveConfig={saveConfig}
          />
        )}
      </main>

      <style>{`
        .app {
          display: flex;
          flex-direction: column;
          height: 100vh;
        }

        .app-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 24px;
          background: white;
          border-bottom: 1px solid var(--border-color);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .app-title {
          font-size: 20px;
          font-weight: 600;
          color: var(--text-primary);
          cursor: pointer;
        }

        .header-nav {
          display: flex;
          gap: 8px;
        }

        .header-nav button {
          background: transparent;
          border: none;
          padding: 8px 16px;
          color: var(--text-secondary);
          font-weight: 500;
          cursor: pointer;
          border-radius: 6px;
        }

        .header-nav button:hover {
          background: var(--sidebar-bg);
        }

        .header-nav button.active {
          background: var(--primary-color);
          color: white;
        }

        .header-nav button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .app-main {
          flex: 1;
          overflow: hidden;
        }
      `}</style>
    </div>
  )
}

export default App
