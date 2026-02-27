import { useState, useEffect, useRef, useCallback } from 'react'
import { Config, CreationConstitution, Topic } from '../App'

// 聊天消息类型
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface FloatingBallProps {
  config: Config | null
  constitutions: CreationConstitution[]
  topic: Topic
  content: string                         // 编辑区当前内容
  onContentChange: (content: string) => void  // 写回编辑区
  selection: string                       // 编辑区选中的文字
  selectionRange: { start: number, end: number } | null
  onClearSelection: () => void            // 清除选中状态
  buildConstitutionPrompt: () => string   // 构建创作提示词
  initialChatHistory?: { role: 'user' | 'assistant', content: string }[]  // 初始聊天记录
  onChatHistoryChange?: (history: { role: 'user' | 'assistant', content: string }[]) => void  // 聊天记录变化回调
}

function FloatingBall({
  config, constitutions, topic, content, onContentChange,
  selection, selectionRange, onClearSelection, buildConstitutionPrompt,
  initialChatHistory, onChatHistoryChange
}: FloatingBallProps) {
  // 面板展开/收起
  const [expanded, setExpanded] = useState(true) // 默认展开
  // 聊天相关状态
  const [messages, setMessages] = useState<ChatMessage[]>(initialChatHistory || [])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // 聊天记录持久化：当 messages 变化时，保存到 topic
  useEffect(() => {
    if (onChatHistoryChange && messages.length > 0) {
      onChatHistoryChange(messages)
    }
  }, [messages])

  // 加载初始聊天记录
  useEffect(() => {
    if (initialChatHistory) {
      setMessages(initialChatHistory)
    }
  }, [initialChatHistory])
  // 未读消息红点
  const [hasUnread, setHasUnread] = useState(false)
  // 拖拽相关状态
  const [position, setPosition] = useState({ x: 0, y: 0 })         // 浮球位置
  const [panelPos, setPanelPos] = useState<{ x: number, y: number } | null>(null)  // 面板拖拽位置
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 })
  const dragTargetRef = useRef<'ball' | 'panel'>('ball')  // 当前拖拽的是浮球还是面板
  const hasDraggedRef = useRef(false)  // 区分拖拽和点击
  const ballRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // 初始化位置：右下角
  useEffect(() => {
    setPosition({
      x: window.innerWidth - 80,
      y: window.innerHeight - 80
    })
  }, [])

  // 自动滚动到最新消息
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ========== 拖拽逻辑（浮球） ==========
  const handleBallMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragTargetRef.current = 'ball'
    hasDraggedRef.current = false
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y
    }
  }, [position])

  // ========== 拖拽逻辑（面板头部） ==========
  const handlePanelMouseDown = useCallback((e: React.MouseEvent) => {
    // 如果点击的是按钮等交互元素，不拖拽
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    setIsDragging(true)
    dragTargetRef.current = 'panel'
    hasDraggedRef.current = false
    // 获取面板当前实际位置
    const currentPanel = panelPos || calcPanelPos()
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: currentPanel.x,
      posY: currentPanel.y
    }
  }, [panelPos, position])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y
      // 移动超过 5px 才算拖拽（避免误判点击）
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        hasDraggedRef.current = true
      }

      if (dragTargetRef.current === 'ball') {
        // 拖拽浮球
        const newX = Math.max(0, Math.min(window.innerWidth - 56, dragStartRef.current.posX + dx))
        const newY = Math.max(0, Math.min(window.innerHeight - 56, dragStartRef.current.posY + dy))
        setPosition({ x: newX, y: newY })
      } else {
        // 拖拽面板
        const panelW = 360, panelH = 500
        const newX = Math.max(0, Math.min(window.innerWidth - panelW, dragStartRef.current.posX + dx))
        const newY = Math.max(0, Math.min(window.innerHeight - panelH, dragStartRef.current.posY + dy))
        setPanelPos({ x: newX, y: newY })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // ========== 点击浮球展开 ==========
  const handleBallClick = () => {
    if (hasDraggedRef.current) return  // 拖拽结束，不触发点击
    setExpanded(true)
    setHasUnread(false)
  }

  // ========== 生成初稿 ==========
  const handleGenerateDraft = async () => {
    setIsLoading(true)

    const constitutionPrompt = buildConstitutionPrompt()
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
        onContentChange(response.content)
        setMessages([])
      } else {
        alert(`生成失败：${response.error}`)
      }
    } catch (error) {
      alert('生成失败')
    }
    setIsLoading(false)
  }

  // ========== 发送消息 ==========
  const handleSendMessage = async () => {
    if (!input.trim()) return
    const userMessage = input
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    const constitutionPrompt = buildConstitutionPrompt()

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
          const newContent = beforeText + response.content + afterText
          onContentChange(newContent)
          onClearSelection()
          setMessages(prev => [...prev, { role: 'assistant', content: `已修改选中内容：\n\n${response.content}` }])
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: `修改失败：${response.error}` }])
        }
      } catch (error) {
        setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，修改失败' }])
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
          // 如果面板收起，显示未读红点
          if (!expanded) setHasUnread(true)
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: `调用失败：${response.error}` }])
        }
      } catch (error) {
        setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，请先在设置中配置 LLM API' }])
      }
    }
    setIsLoading(false)
  }

  // ========== 计算面板默认位置（基于浮球位置） ==========
  const calcPanelPos = () => {
    const panelWidth = 360
    const panelHeight = 500
    let left = position.x - panelWidth + 56
    let top = position.y - panelHeight
    if (left < 8) left = 8
    if (top < 8) top = 8
    if (left + panelWidth > window.innerWidth - 8) left = window.innerWidth - panelWidth - 8
    return { x: left, y: top }
  }

  // 如果面板被拖拽过，使用拖拽位置；否则根据浮球位置计算
  const getPanelStyle = () => {
    const pos = panelPos || calcPanelPos()
    return { left: pos.x, top: pos.y, width: 360, height: 500 }
  }

  return (
    <>
      {/* 悬浮球（收起状态显示） */}
      {!expanded && (
        <div
          ref={ballRef}
          className="floating-ball"
          style={{
            left: position.x,
            top: position.y,
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
          onMouseDown={handleBallMouseDown}
          onClick={handleBallClick}
        >
          <span className="ball-icon">🤖</span>
          {hasUnread && <span className="ball-badge" />}
        </div>
      )}

      {/* 展开面板 */}
      {expanded && (
        <div className="floating-panel" style={getPanelStyle()}>
          {/* 面板头部（可拖拽） */}
          <div
            className="fp-header"
            onMouseDown={handlePanelMouseDown}
            style={{ cursor: isDragging && dragTargetRef.current === 'panel' ? 'grabbing' : 'grab' }}
          >
            <h3>AI 助手</h3>
            <div className="fp-header-actions">
              {!config?.llm.apiKey && (
                <span className="fp-warning">请先配置 API Key</span>
              )}
              <button className="fp-minimize" onClick={() => setExpanded(false)} title="最小化">
                ─
              </button>
            </div>
          </div>

          {/* 聊天消息区 */}
          <div className="fp-messages">
            {messages.length === 0 ? (
              <div className="fp-empty">
                <p>你好！我是 AI 写作助手，可以帮你：</p>
                <ul>
                  <li>续写文章</li>
                  <li>提供写作建议</li>
                  <li>回答写作问题</li>
                </ul>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`fp-msg ${msg.role}`}>
                  <div className="fp-msg-content">{msg.content}</div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="fp-msg assistant">
                <div className="fp-msg-content loading">思考中...</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* 输入区 */}
          <div className="fp-input-area">
            {/* 选中内容提示条 */}
            {selection && (
              <div className="fp-selection-notice">
                <span>已选中 {selection.length} 字，输入修改要求...</span>
                <button onClick={onClearSelection}>取消</button>
              </div>
            )}
            <button
              className="secondary fp-draft-btn"
              onClick={handleGenerateDraft}
              disabled={isLoading}
            >
              📝 生成初稿
            </button>
            <div className="fp-input-row">
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
        </div>
      )}

      <style>{`
        /* ========== 悬浮球 ========== */
        .floating-ball {
          position: fixed;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #2563eb, #7c3aed);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px rgba(37, 99, 235, 0.4);
          z-index: 9999;
          user-select: none;
          transition: box-shadow 0.2s;
        }

        .floating-ball:hover {
          box-shadow: 0 6px 24px rgba(37, 99, 235, 0.55);
        }

        .ball-icon {
          font-size: 24px;
          pointer-events: none;
        }

        /* 未读红点 */
        .ball-badge {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--danger-color);
          border: 2px solid white;
        }

        /* ========== 展开面板 ========== */
        .floating-panel {
          position: fixed;
          border-radius: 12px;
          background: white;
          border: 1px solid var(--border-color);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
          z-index: 9999;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: fpSlideIn 0.2s ease-out;
        }

        @keyframes fpSlideIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        /* 面板头部（可拖拽） */
        .fp-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
          background: linear-gradient(135deg, #2563eb, #7c3aed);
          color: white;
          user-select: none;
        }

        .fp-header h3 {
          font-size: 14px;
          font-weight: 600;
          margin: 0;
        }

        .fp-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .fp-warning {
          font-size: 11px;
          color: #fcd34d;
        }

        .fp-minimize {
          background: rgba(255, 255, 255, 0.2) !important;
          border: none !important;
          color: white !important;
          width: 28px;
          height: 28px;
          border-radius: 6px !important;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0 !important;
          font-size: 14px;
          font-weight: bold;
        }

        .fp-minimize:hover {
          background: rgba(255, 255, 255, 0.35) !important;
        }

        /* 消息区 */
        .fp-messages {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }

        .fp-empty {
          color: var(--text-secondary);
          font-size: 13px;
          padding: 8px;
        }

        .fp-empty ul {
          margin-top: 8px;
          padding-left: 18px;
        }

        .fp-msg {
          margin-bottom: 10px;
        }

        .fp-msg.user {
          text-align: right;
        }

        .fp-msg-content {
          display: inline-block;
          padding: 8px 12px;
          border-radius: 12px;
          font-size: 13px;
          max-width: 85%;
          text-align: left;
          word-break: break-word;
          white-space: pre-wrap;
        }

        .fp-msg.user .fp-msg-content {
          background: var(--primary-color);
          color: white;
        }

        .fp-msg.assistant .fp-msg-content {
          background: var(--sidebar-bg);
        }

        .fp-msg-content.loading {
          color: var(--text-secondary);
          font-style: italic;
        }

        /* 输入区 */
        .fp-input-area {
          padding: 12px;
          border-top: 1px solid var(--border-color);
        }

        .fp-selection-notice {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 10px;
          background: rgba(37, 99, 235, 0.1);
          border: 1px solid var(--primary-color);
          border-radius: 6px;
          margin-bottom: 8px;
          font-size: 12px;
        }

        .fp-selection-notice button {
          background: transparent;
          border: none;
          color: var(--primary-color);
          cursor: pointer;
          font-size: 12px;
          padding: 2px 6px;
        }

        .fp-draft-btn {
          width: 100%;
          margin-bottom: 8px;
          font-size: 13px !important;
          padding: 6px 12px !important;
        }

        .fp-input-row {
          display: flex;
          gap: 6px;
        }

        .fp-input-row input {
          flex: 1;
          font-size: 13px;
          padding: 6px 10px;
        }

        .fp-input-row button {
          font-size: 13px;
          padding: 6px 14px;
          white-space: nowrap;
        }
      `}</style>
    </>
  )
}

export default FloatingBall
