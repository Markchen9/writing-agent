import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Topic, Config, CreationConstitution } from '../App'

interface EditorProps {
  topic: Topic
  onUpdateTopic: (topic: Topic) => void
  onBack: () => void
  config: Config | null
  constitutions: CreationConstitution[]
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

function Editor({ topic, onUpdateTopic, onBack, config, constitutions }: EditorProps) {
  const [content, setContent] = useState(topic.content)
  const [showPreview, setShowPreview] = useState(true)
  const [showAI, setShowAI] = useState(true) // AI 助手默认展开
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selection, setSelection] = useState('')
  const [selectionRange, setSelectionRange] = useState<{ start: number, end: number } | null>(null)
  const [showPolishMenu, setShowPolishMenu] = useState(false)
  const [polishPosition, setPolishPosition] = useState({ x: 0, y: 0 })
  const chatEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 创作提示词相关状态
  const [selectedConstitutionId, setSelectedConstitutionId] = useState<string | null>(
    topic.constitutionId || (constitutions.find(c => c.isDefault)?.id || null)
  )
  const [temporaryAdjustments, setTemporaryAdjustments] = useState(topic.temporaryAdjustments || '')
  const [showConstitutionPanel, setShowConstitutionPanel] = useState(false)

  // 获取当前选中的提示词
  const selectedConstitution = constitutions.find(c => c.id === selectedConstitutionId) || null

  // 保存提示词选择到 topic
  useEffect(() => {
    onUpdateTopic({
      ...topic,
      constitutionId: selectedConstitutionId,
      temporaryAdjustments: temporaryAdjustments
    })
  }, [selectedConstitutionId, temporaryAdjustments])

  // Auto-save
  useEffect(() => {
    const timer = setTimeout(() => {
      if (content !== topic.content) {
        onUpdateTopic({
          ...topic,
          content,
          updatedAt: new Date().toISOString()
        })
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [content])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 构建创作提示词的 system prompt
  const buildConstitutionPrompt = () => {
    if (!selectedConstitution && !temporaryAdjustments.trim()) {
      return ''
    }

    let prompt = '【创作提示词】\n'

    if (selectedConstitution) {
      prompt += `- 语气风格：${getToneLabel(selectedConstitution.tone)}\n`
      prompt += `- 人称视角：${getPerspectiveLabel(selectedConstitution.perspective)}\n`
      if (selectedConstitution.targetAudience) {
        prompt += `- 目标读者：${selectedConstitution.targetAudience}\n`
      }
      if (selectedConstitution.contentRules.length > 0) {
        prompt += `- 内容规则：\n${selectedConstitution.contentRules.map(r => `  - ${r}`).join('\n')}\n`
      }
      if (selectedConstitution.customConstitution.trim()) {
        prompt += `- 作者自定义要求：\n${selectedConstitution.customConstitution}\n`
      }
    }

    if (temporaryAdjustments.trim()) {
      prompt += `\n【临时调整】\n${temporaryAdjustments}\n`
    }

    return prompt + '\n请严格按照以上规则进行创作和修改。'
  }

  // 辅助函数：获取语气标签
  function getToneLabel(tone: string) {
    const labels: Record<string, string> = {
      professional: '专业严谨',
      casual: '轻松友好',
      humorous: '幽默风趣',
      serious: '严肃正式',
      technical: '技术专业'
    }
    return labels[tone] || tone
  }

  // 辅助函数：获取人称标签
  function getPerspectiveLabel(perspective: string) {
    const labels: Record<string, string> = {
      'first-person': '第一人称',
      'third-person': '第三人称'
    }
    return labels[perspective] || perspective
  }

  const handleTextSelect = () => {
    const textarea = textareaRef.current
    if (!textarea) return

    const selected = window.getSelection()?.toString()
    if (selected && selected.trim()) {
      setSelection(selected)
      // 记录选中位置的索引
      setSelectionRange({
        start: textarea.selectionStart,
        end: textarea.selectionEnd
      })
      const rect = window.getSelection()?.getRangeAt(0).getBoundingClientRect()
      if (rect) {
        setPolishPosition({ x: rect.left + rect.width / 2, y: rect.top - 10 })
        setShowPolishMenu(true)
      }
    } else {
      setShowPolishMenu(false)
      setSelection('')
      setSelectionRange(null)
    }
  }

  const handlePolish = async (type: 'rewrite' | 'formal' | 'casual' | 'fix') => {
    if (!selection) return
    setShowPolishMenu(false)
    setIsLoading(true)

    const constitutionPrompt = buildConstitutionPrompt()
    const promptMap: Record<string, string> = {
      rewrite: `${constitutionPrompt}\n\n请改写以下文字，使其更加流畅：\n\n${selection}`,
      formal: `${constitutionPrompt}\n\n请将以下文字改写为正式语气：\n\n${selection}`,
      casual: `${constitutionPrompt}\n\n请将以下文字改写为轻松活泼的语气：\n\n${selection}`,
      fix: `${constitutionPrompt}\n\n请检查并纠正以下文字的语法错误和错别字：\n\n${selection}`
    }

    try {
      const response = await window.electronAPI.callLLM([
        { role: 'user', content: promptMap[type] }
      ])

      if (response.success && response.content) {
        const newContent = content.replace(selection, response.content)
        setContent(newContent)
      } else {
        alert(`润色失败：${response.error}`)
      }
    } catch (error) {
      alert('润色失败')
    }
    setIsLoading(false)
  }

  const handlePolishAll = async (type: 'rewrite' | 'formal' | 'casual' | 'fix') => {
    if (!content) return
    setIsLoading(true)

    const constitutionPrompt = buildConstitutionPrompt()
    const promptMap: Record<string, string> = {
      rewrite: `${constitutionPrompt}\n\n请改写以下文章，使其更加流畅：\n\n${content}`,
      formal: `${constitutionPrompt}\n\n请将以下文章改写为正式语气：\n\n${content}`,
      casual: `${constitutionPrompt}\n\n请将以下文章改写为轻松活泼的语气：\n\n${content}`,
      fix: `${constitutionPrompt}\n\n请检查并纠正以下文章的语法错误和错别字：\n\n${content}`
    }

    try {
      const response = await window.electronAPI.callLLM([
        { role: 'user', content: promptMap[type] }
      ])

      if (response.success && response.content) {
        setContent(response.content)
      } else {
        alert(`润色失败：${response.error}`)
      }
    } catch (error) {
      alert('润色失败')
    }
    setIsLoading(false)
  }

  const handleGenerateDraft = async () => {
    if (messages.length === 0) {
      alert('请先和 AI 助手讨论文章需求')
      return
    }

    setIsLoading(true)

    // 构建 Prompt：聊天历史 + 创作提示词 + 选题描述
    const constitutionPrompt = buildConstitutionPrompt()

    // 提取聊天历史
    const conversationHistory = messages.map(msg =>
      `${msg.role === 'user' ? '用户' : 'AI'}: ${msg.content}`
    ).join('\n')

    const fullPrompt = `你是一个写作助手，正在帮助用户创作文章。

【选题名称】${topic.title}
${topic.description ? '【选题描述】' + topic.description : ''}

${constitutionPrompt}

【对话历史】
${conversationHistory}

---

请根据以上对话历史和创作要求，为用户生成一篇完整的文章初稿。直接输出文章内容，不需要解释。
`

    try {
      const response = await window.electronAPI.callLLM([
        { role: 'user', content: fullPrompt }
      ])

      if (response.success && response.content) {
        setContent(response.content)
        // 生成成功后，清空聊天记录，方便后续修改
        setMessages([])
      } else {
        alert(`生成失败：${response.error}`)
      }
    } catch (error) {
      alert('生成失败')
    }
    setIsLoading(false)
  }

  const handleSendMessage = async () => {
    if (!input.trim()) return

    const userMessage = input
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    // 构建带创作提示词的 context
    const constitutionPrompt = buildConstitutionPrompt()

    // 如果有选中内容，只修改选中的部分
    if (selection && selectionRange) {
      // 局部修改模式
      const beforeText = content.slice(0, selectionRange.start)
      const afterText = content.slice(selectionRange.end)
      const beforeContext = content.slice(Math.max(0, selectionRange.start - 300), selectionRange.start)
      const afterContext = content.slice(selectionRange.end, Math.min(content.length, selectionRange.end + 300))

      const modifyPrompt = `你是一个写作助手，正在帮助用户修改文章中的选中内容。

【选题名称】${topic.title}
${constitutionPrompt}

【当前选中内容】
${selection}

【选中内容的前文】（仅供参考上下文）
${beforeContext || '（无）'}

【选中内容的后文】（仅供参考上下文）
${afterContext || '（无）'}

【用户修改要求】
${userMessage}

---

请根据用户的要求修改选中内容。只输出修改后的选中内容，不需要解释，不要包含其他文字。
`

      try {
        const response = await window.electronAPI.callLLM([
          { role: 'user', content: modifyPrompt }
        ])

        if (response.success && response.content) {
          // 将修改后的内容替换到编辑区
          const newContent = beforeText + response.content + afterText
          setContent(newContent)
          // 清空选中状态
          setSelection('')
          setSelectionRange(null)
          // 添加 AI 回复到聊天记录
          setMessages(prev => [...prev, { role: 'assistant', content: `已修改选中内容：\n\n${response.content}` }])
        } else {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `修改失败：${response.error}`
          }])
        }
      } catch (error) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '抱歉，修改失败'
        }])
      }
    } else {
      // 普通聊天模式
      const contextMessages = [
        {
          role: 'system',
          content: `你是一个写作助手，正在帮助用户创作一篇名为"${topic.title}"的文章。\n\n${constitutionPrompt}\n\n当前文章内容：\n\n${content.slice(0, 2000)}`
        },
        ...messages,
        { role: 'user', content: userMessage }
      ]

      try {
        const response = await window.electronAPI.callLLM(contextMessages)

        if (response.success && response.content) {
          setMessages(prev => [...prev, { role: 'assistant', content: response.content! }])
        } else {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `调用失败：${response.error}`
          }])
        }
      } catch (error) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '抱歉，请先在设置中配置 LLM API'
        }])
      }
    }
    setIsLoading(false)
  }

  const handleExport = async () => {
    const result = await window.electronAPI.exportMarkdown(content, topic.title)
    if (result.success) {
      alert(`已导出到：${result.path}`)
    } else if (!result.canceled) {
      alert(`导出失败：${result.error}`)
    }
  }

  return (
    <div className="editor-container">
      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <button className="secondary" onClick={onBack}>← 返回</button>
          <span className="topic-title">{topic.title}</span>
          {/* 创作提示词徽章 */}
          {constitutions.length > 0 && (
            <button
              className={`constitution-badge ${selectedConstitution ? 'active' : ''}`}
              onClick={() => setShowConstitutionPanel(!showConstitutionPanel)}
              title="点击选择或调整创作提示词"
            >
              📜 {selectedConstitution ? selectedConstitution.name : '未选择'}
              {selectedConstitution && <span className="check">✓</span>}
            </button>
          )}
        </div>
        <div className="toolbar-right">
          <button
            className={`secondary ${showPreview ? 'active' : ''}`}
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? '隐藏预览' : '显示预览'}
          </button>
          <button
            className={`secondary ${showAI ? 'active' : ''}`}
            onClick={() => setShowAI(!showAI)}
          >
            {showAI ? '隐藏 AI 助手' : 'AI 助手'}
          </button>
          <button className="secondary" onClick={() => handlePolishAll('rewrite')}>
            全文润色
          </button>
          <button className="primary" onClick={handleExport}>导出</button>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="editor-main">
        {/* Markdown Editor */}
        <div className={`editor-pane ${showPreview ? '' : 'full'}`}>
          <textarea
            ref={textareaRef}
            className="markdown-input"
            value={content}
            onChange={e => setContent(e.target.value)}
            onMouseUp={handleTextSelect}
            onKeyUp={handleTextSelect}
            placeholder="开始写作..."
          />
        </div>

        {/* Preview Pane */}
        {showPreview && (
          <div className="preview-pane">
            <div className="markdown-preview">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content || '*预览区域*'}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* AI Chat Panel */}
        {showAI && (
          <div className="ai-panel">
            <div className="ai-header">
              <h3>AI 助手</h3>
              {!config?.llm.apiKey && (
                <span className="warning">请先在设置中配置 API Key</span>
              )}
            </div>
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="chat-empty">
                  <p>你好！我是 AI 写作助手，可以帮你：</p>
                  <ul>
                    <li>续写文章</li>
                    <li>提供写作建议</li>
                    <li>回答写作问题</li>
                  </ul>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`chat-message ${msg.role}`}>
                    <div className="message-content">{msg.content}</div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="chat-message assistant">
                  <div className="message-content loading">思考中...</div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="chat-input">
              {/* 选中内容提示条 */}
              {selection && (
                <div className="selection-notice">
                  <span>已选中 {selection.length} 字，输入修改要求...</span>
                  <button onClick={() => { setSelection(''); setSelectionRange(null); }}>取消</button>
                </div>
              )}
              <button
                className="secondary"
                onClick={handleGenerateDraft}
                disabled={isLoading}
                style={{ width: '100%', marginBottom: '8px' }}
              >
                📝 生成初稿
              </button>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder="输入问题..."
                disabled={isLoading}
              />
              <button className="primary" onClick={handleSendMessage} disabled={isLoading}>
                发送
              </button>
            </div>
          </div>
        )}

        {/* 创作提示词面板 */}
        {showConstitutionPanel && (
          <div className="constitution-panel">
            <div className="constitution-panel-header">
              <h3>创作提示词</h3>
              <button className="close-btn" onClick={() => setShowConstitutionPanel(false)}>×</button>
            </div>
            <div className="constitution-panel-body">
              {/* 提示词选择 */}
              <div className="panel-section">
                <label className="section-label">选择提示词</label>
                <select
                  value={selectedConstitutionId || ''}
                  onChange={e => setSelectedConstitutionId(e.target.value || null)}
                  className="constitution-select"
                >
                  <option value="">不启用</option>
                  {constitutions.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.isDefault ? '（默认）' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* 提示词预览 */}
              {selectedConstitution && (
                <div className="panel-section">
                  <label className="section-label">提示词内容</label>
                  <div className="constitution-preview">
                    <p><strong>语气：</strong>{getToneLabel(selectedConstitution.tone)}</p>
                    <p><strong>人称：</strong>{getPerspectiveLabel(selectedConstitution.perspective)}</p>
                    {selectedConstitution.targetAudience && (
                      <p><strong>目标读者：</strong>{selectedConstitution.targetAudience}</p>
                    )}
                    {selectedConstitution.contentRules.length > 0 && (
                      <div className="rules-preview">
                        <strong>内容规则：</strong>
                        <ul>
                          {selectedConstitution.contentRules.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedConstitution.customConstitution && (
                      <div className="custom-preview">
                        <strong>自定义要求：</strong>
                        <p>{selectedConstitution.customConstitution}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 临时调整 */}
              <div className="panel-section">
                <label className="section-label">临时调整（只对当前文章生效）</label>
                <textarea
                  className="temporary-adjustments"
                  value={temporaryAdjustments}
                  onChange={e => setTemporaryAdjustments(e.target.value)}
                  placeholder="添加额外的写作要求，例如：这篇文章需要用更简单的语言，适合初学者阅读..."
                  rows={4}
                />
              </div>

              {/* 设置链接 */}
              <div className="panel-footer">
                <span>在</span>
                <button className="link-btn" onClick={() => { onBack(); setShowConstitutionPanel(false); }}>
                  设置
                </button>
                <span>中管理更多提示词</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Polish Menu Popup */}
      {showPolishMenu && (
        <div
          className="polish-menu"
          style={{ left: polishPosition.x, top: polishPosition.y }}
        >
          <button onClick={() => handlePolish('rewrite')}>改写</button>
          <button onClick={() => handlePolish('formal')}>正式语气</button>
          <button onClick={() => handlePolish('casual')}>轻松语气</button>
          <button onClick={() => handlePolish('fix')}>纠错</button>
        </div>
      )}

      <style>{`
        .editor-container {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .editor-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 20px;
          background: white;
          border-bottom: 1px solid var(--border-color);
        }

        .toolbar-left, .toolbar-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .topic-title {
          font-weight: 600;
          font-size: 16px;
        }

        .constitution-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: var(--sidebar-bg);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .constitution-badge:hover {
          border-color: var(--primary-color);
        }

        .constitution-badge.active {
          background: rgba(37, 99, 235, 0.1);
          border-color: var(--primary-color);
        }

        .constitution-badge .check {
          color: var(--primary-color);
          font-weight: bold;
        }

        .toolbar-right button.active {
          background: var(--primary-color);
          color: white;
        }

        .editor-main {
          flex: 1;
          display: flex;
          overflow: hidden;
          position: relative;
        }

        .editor-pane {
          flex: 1;
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--border-color);
          min-width: 0;
        }

        .editor-pane.full {
          border-right: none;
        }

        .markdown-input {
          flex: 1;
          padding: 20px;
          border: none;
          resize: none;
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 15px;
          line-height: 1.8;
        }

        .markdown-input:focus {
          outline: none;
        }

        .preview-pane {
          flex: 1;
          overflow-y: auto;
          background: white;
        }

        .markdown-preview {
          padding: 20px;
          line-height: 1.8;
        }

        .markdown-preview h1 { font-size: 2em; margin: 0.67em 0; }
        .markdown-preview h2 { font-size: 1.5em; margin: 0.83em 0; }
        .markdown-preview h3 { font-size: 1.17em; margin: 1em 0; }
        .markdown-preview p { margin: 1em 0; }
        .markdown-preview ul, .markdown-preview ol { margin: 1em 0; padding-left: 2em; }
        .markdown-preview code {
          background: var(--sidebar-bg);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
        }
        .markdown-preview pre {
          background: var(--sidebar-bg);
          padding: 16px;
          border-radius: 8px;
          overflow-x: auto;
        }
        .markdown-preview blockquote {
          border-left: 4px solid var(--border-color);
          padding-left: 16px;
          margin-left: 0;
          color: var(--text-secondary);
        }

        .ai-panel {
          width: 320px;
          display: flex;
          flex-direction: column;
          border-left: 1px solid var(--border-color);
          background: white;
        }

        .ai-header {
          padding: 16px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .ai-header h3 {
          font-size: 14px;
          font-weight: 600;
        }

        .ai-header .warning {
          font-size: 11px;
          color: var(--warning-color);
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .chat-empty {
          color: var(--text-secondary);
          font-size: 14px;
        }

        .chat-empty ul {
          margin-top: 12px;
          padding-left: 20px;
        }

        .chat-message {
          margin-bottom: 12px;
        }

        .chat-message.user {
          text-align: right;
        }

        .chat-message .message-content {
          display: inline-block;
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 14px;
          max-width: 90%;
          text-align: left;
        }

        .chat-message.user .message-content {
          background: var(--primary-color);
          color: white;
        }

        .chat-message.assistant .message-content {
          background: var(--sidebar-bg);
        }

        .chat-message .loading {
          color: var(--text-secondary);
          font-style: italic;
        }

        .chat-input {
          padding: 16px;
          border-top: 1px solid var(--border-color);
          display: flex;
          gap: 8px;
        }

        .chat-input input {
          flex: 1;
        }

        /* 选中内容提示条 */
        .selection-notice {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: rgba(37, 99, 235, 0.1);
          border: 1px solid var(--primary-color);
          border-radius: 6px;
          margin-bottom: 8px;
          font-size: 13px;
          width: 100%;
        }

        .selection-notice button {
          background: transparent;
          border: none;
          color: var(--primary-color);
          cursor: pointer;
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .selection-notice button:hover {
          background: rgba(37, 99, 235, 0.1);
        }

        .polish-menu {
          position: fixed;
          transform: translateX(-50%) translateY(-100%);
          background: white;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          display: flex;
          gap: 4px;
          padding: 4px;
          z-index: 100;
        }

        .polish-menu button {
          padding: 6px 12px;
          font-size: 12px;
          background: transparent;
          border: none;
          cursor: pointer;
          border-radius: 4px;
        }

        .polish-menu button:hover {
          background: var(--sidebar-bg);
        }

        /* Constitution Panel */
        .constitution-panel {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 320px;
          background: white;
          border-left: 1px solid var(--border-color);
          box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
          z-index: 10;
          display: flex;
          flex-direction: column;
        }

        .constitution-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid var(--border-color);
        }

        .constitution-panel-header h3 {
          font-size: 16px;
          margin: 0;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: var(--text-secondary);
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .constitution-panel-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .panel-section {
          margin-bottom: 20px;
        }

        .section-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 8px;
          text-transform: uppercase;
        }

        .constitution-select {
          width: 100%;
          padding: 10px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          font-size: 14px;
          background: white;
        }

        .constitution-preview {
          background: var(--sidebar-bg);
          padding: 12px;
          border-radius: 8px;
          font-size: 13px;
        }

        .constitution-preview p {
          margin: 8px 0;
        }

        .rules-preview ul {
          margin: 8px 0;
          padding-left: 20px;
        }

        .rules-preview li {
          margin-bottom: 4px;
        }

        .custom-preview {
          margin-top: 12px;
        }

        .custom-preview p {
          margin-top: 6px;
          white-space: pre-wrap;
        }

        .temporary-adjustments {
          width: 100%;
          padding: 10px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          font-family: inherit;
          font-size: 14px;
          resize: vertical;
        }

        .panel-footer {
          text-align: center;
          font-size: 13px;
          color: var(--text-secondary);
          padding-top: 16px;
          border-top: 1px solid var(--border-color);
        }

        .link-btn {
          background: none;
          border: none;
          color: var(--primary-color);
          cursor: pointer;
          padding: 0 4px;
          font-size: 13px;
          text-decoration: underline;
        }
      `}</style>
    </div>
  )
}

export default Editor
