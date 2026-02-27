import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Topic, Config, CreationConstitution } from '../App'
import FloatingBall from './FloatingBall'
import DiffPreview from './DiffPreview'

interface EditorProps {
  topic: Topic
  onUpdateTopic: (topic: Topic) => void
  onBack: () => void
  config: Config | null
  constitutions: CreationConstitution[]
}

function Editor({ topic, onUpdateTopic, onBack, config, constitutions }: EditorProps) {
  type StartMode = 'direct' | 'chat'
  const [content, setContent] = useState(topic.content)
  const [startMode, setStartMode] = useState<StartMode | null>(() => {
    if (topic.content.trim() || (topic.chatHistory?.length || 0) > 0) {
      return 'chat'
    }
    return null
  })
  const [draftIntent, setDraftIntent] = useState('')
  const [isDraftGenerating, setIsDraftGenerating] = useState(false)
  const [pendingPolish, setPendingPolish] = useState<{
    original: string, modified: string, isFullText: boolean, range: { start: number, end: number } | null
  } | null>(null) // 待确认的润色结果
  const [selection, setSelection] = useState('')
  const [selectionRange, setSelectionRange] = useState<{ start: number, end: number } | null>(null)
  const [showPolishMenu, setShowPolishMenu] = useState(false)
  const [polishPosition, setPolishPosition] = useState({ x: 0, y: 0 })
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [isInlineEditing, setIsInlineEditing] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)

  // 创作提示词相关状态
  const [selectedConstitutionId, setSelectedConstitutionId] = useState<string | null>(
    topic.constitutionId || (constitutions.find(c => c.isDefault)?.id || null)
  )
  const [temporaryAdjustments, setTemporaryAdjustments] = useState(topic.temporaryAdjustments || '')
  const [showConstitutionPanel, setShowConstitutionPanel] = useState(false)

  // 获取当前选中的提示词
  const selectedConstitution = constitutions.find(c => c.id === selectedConstitutionId) || null

  // 切换文章时同步内容和历史
  useEffect(() => {
    setContent(topic.content)
    if (topic.content.trim() || (topic.chatHistory?.length || 0) > 0) {
      setStartMode('chat')
    } else {
      setStartMode(null)
    }
  }, [topic.id])

  useEffect(() => {
    if (!isInlineEditing || !editorRef.current) return
    const el = editorRef.current
    el.focus()
    const sel = window.getSelection()
    if (!sel) return
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
  }, [isInlineEditing])

  // 应用 AI 内容改动
  const applyAiContentChange = (nextContent: string) => {
    if (nextContent === content) return
    setContent(nextContent)
  }

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

  // 清除选中状态的回调（给 FloatingBall 用）
  const clearSelection = () => {
    setSelection('')
    setSelectionRange(null)
  }

  // 统一接收 AI 候选改动，先进入预览，再由用户确认应用
  const handleProposeAiChange = (change: {
    original: string
    modified: string
    isFullText: boolean
    range: { start: number, end: number } | null
  }) => {
    setPendingPolish(change)
  }

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

  const getSelectionOffsets = (container: HTMLElement) => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return null
    const range = sel.getRangeAt(0)
    if (!container.contains(range.commonAncestorContainer)) return null

    const preRange = range.cloneRange()
    preRange.selectNodeContents(container)
    preRange.setEnd(range.startContainer, range.startOffset)
    const start = preRange.toString().length
    const selectedText = range.toString()

    return {
      start,
      end: start + selectedText.length,
      selectedText
    }
  }

  const handleTextSelect = () => {
    const editor = editorRef.current
    if (!editor || !isInlineEditing) return

    const offsets = getSelectionOffsets(editor)
    if (offsets && offsets.selectedText.trim()) {
      setSelection(offsets.selectedText)
      setSelectionRange({ start: offsets.start, end: offsets.end })
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
        // 不直接替换，先弹出预览
        setPendingPolish({
          original: selection,
          modified: response.content,
          isFullText: false,
          range: selectionRange
        })
      } else {
        alert(`润色失败：${response.error}`)
      }
    } catch (error) {
      alert('润色失败')
    }
  }

  const acceptPolish = () => {
    if (!pendingPolish) return
    if (pendingPolish.isFullText) {
      // 全文润色：直接替换整篇内容
      applyAiContentChange(pendingPolish.modified)
    } else {
      // 选中润色：替换选中部分
      if (pendingPolish.range) {
        const before = content.slice(0, pendingPolish.range.start)
        const after = content.slice(pendingPolish.range.end)
        applyAiContentChange(before + pendingPolish.modified + after)
        clearSelection()
      } else {
        const newContent = content.replace(pendingPolish.original, pendingPolish.modified)
        applyAiContentChange(newContent)
      }
    }
    setPendingPolish(null)
  }

  // 用户放弃润色结果
  const rejectPolish = () => {
    setPendingPolish(null)
  }


  const handleExport = async () => {
    const result = await window.electronAPI.exportMarkdown(content, topic.title)
    if (result.success) {
      alert(`已导出到：${result.path}`)
    } else if (!result.canceled) {
      alert(`导出失败：${result.error}`)
    }
  }

  // 直接生成初稿：仍走“先预览再应用”链路
  const handleGenerateDraftFromStart = async () => {
    setIsDraftGenerating(true)
    const constitutionPrompt = buildConstitutionPrompt()
    const extraIntent = draftIntent.trim()
      ? `\n【用户补充重点】\n${draftIntent.trim()}\n`
      : ''

    const prompt = `你是一个写作助手，正在帮助用户创作文章。

【选题名称】${topic.title}
${topic.description ? `【选题描述】${topic.description}\n` : ''}
${constitutionPrompt}
${extraIntent}
---

请基于以上信息输出一篇完整初稿，直接输出正文，不要解释。`

    try {
      const response = await window.electronAPI.callLLM([
        { role: 'user', content: prompt }
      ])
      if (response.success && response.content) {
        setStartMode('direct')
        handleProposeAiChange({
          original: content,
          modified: response.content,
          isFullText: true,
          range: null
        })
      } else {
        alert(`生成失败：${response.error}`)
      }
    } catch (error) {
      alert('生成失败')
    }
    setIsDraftGenerating(false)
  }

  return (
    <div className="editor-container">
      {/* Header */}
      <div className="editor-header">
        <div className="header-left">
          <button className="secondary" onClick={onBack}>← 返回</button>
          <span className="header-title">{topic.title}</span>
        </div>
        <div className="header-right">
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
          <div className="more-menu-wrapper">
            <button
              className="secondary more-menu-btn"
              onClick={() => setShowMoreMenu(v => !v)}
              title="更多操作"
            >
              ···
            </button>
            {showMoreMenu && (
              <div className="more-menu">
                <button
                  className="secondary"
                  onClick={() => {
                    setShowMoreMenu(false)
                    handleExport()
                  }}
                >
                  导出
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="editor-main">
        {startMode === null ? (
          <div className="creation-start-panel">
            <div className="start-topic-card">
              <h2>{topic.title}</h2>
              {topic.description && <p>{topic.description}</p>}
            </div>
            <div className="start-options">
              <button className="start-option-card" onClick={() => setStartMode('direct')}>
                <h3>直接生成初稿</h3>
                <p>基于当前选题和提示词，直接出一版初稿。</p>
              </button>
              <button className="start-option-card" onClick={() => setStartMode('chat')}>
                <h3>先聊一聊再写</h3>
                <p>先聊你的真实经历和想法，再生成更贴近你的稿子。</p>
              </button>
            </div>
            <div className="start-note">
              系统会自动使用你当前选题绑定的创作提示词。
            </div>
          </div>
        ) : (
          <>
        {startMode === 'direct' && !content.trim() && (
          <div className="direct-start-bar">
            <textarea
              value={draftIntent}
              onChange={e => setDraftIntent(e.target.value)}
              placeholder="可选：补充这篇文章的重点，比如想强调的经历、观点、语气..."
              rows={3}
            />
            <div className="direct-start-actions">
              <button className="secondary" onClick={() => setStartMode('chat')}>
                改为先聊一聊
              </button>
              <button className="primary" onClick={handleGenerateDraftFromStart} disabled={isDraftGenerating}>
                {isDraftGenerating ? '生成中...' : '生成初稿（先预览）'}
              </button>
            </div>
          </div>
        )}
        {/* Markdown Editor */}
        {/* Single Surface Editor */}
        <div className="editor-pane">
          {isInlineEditing ? (
            <div
              ref={editorRef}
              className="editor-editable"
              contentEditable
              suppressContentEditableWarning
              onInput={e => setContent(e.currentTarget.innerText)}
              onMouseUp={handleTextSelect}
              onKeyUp={handleTextSelect}
              onBlur={() => {
                setIsInlineEditing(false)
                setShowPolishMenu(false)
              }}
              onPaste={e => {
                e.preventDefault()
                const text = e.clipboardData.getData('text/plain')
                document.execCommand('insertText', false, text)
              }}
            >
              {content}
            </div>
          ) : (
            <div
              className="editor-rendered markdown-preview"
              onClick={() => {
                setIsInlineEditing(true)
                setShowPolishMenu(false)
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content || '*点击开始写作...*'}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* AI 悬浮球 */}
        <FloatingBall
          config={config}
          constitutions={constitutions}
          topic={topic}
          content={content}
          onProposeAiChange={handleProposeAiChange}
          selection={selection}
          selectionRange={selectionRange}
          onClearSelection={clearSelection}
          buildConstitutionPrompt={buildConstitutionPrompt}
          defaultExpanded={startMode === 'chat'}
          initialChatHistory={topic.chatHistory || []}
          onChatHistoryChange={(history) => {
            onUpdateTopic({
              ...topic,
              chatHistory: history
            })
          }}
        />
          </>
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

      {/* 润色结果预览弹窗 */}
      {pendingPolish && (
        <DiffPreview
          originalText={pendingPolish.original}
          modifiedText={pendingPolish.modified}
          onAccept={acceptPolish}
          onReject={rejectPolish}
        />
      )}

      <style>{`
        .editor-container {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .editor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 20px;
          background: white;
          border-bottom: 1px solid var(--border-color);
        }

        .header-left, .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-title {
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

        .more-menu-wrapper {
          position: relative;
        }

        .more-menu-btn {
          min-width: 42px;
          letter-spacing: 2px;
          font-weight: 700;
        }

        .more-menu {
          position: absolute;
          right: 0;
          top: calc(100% + 6px);
          background: white;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 8px;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
          z-index: 20;
        }

        .more-menu button {
          width: 100%;
          white-space: nowrap;
        }

        .editor-main {
          flex: 1;
          display: flex;
          overflow: hidden;
          position: relative;
        }

        .creation-start-panel {
          flex: 1;
          padding: 28px;
          overflow-y: auto;
          background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
        }

        .start-topic-card {
          background: white;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 18px;
          margin-bottom: 18px;
        }

        .start-topic-card h2 {
          margin: 0;
          font-size: 22px;
        }

        .start-topic-card p {
          margin: 10px 0 0;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        .start-options {
          display: grid;
          grid-template-columns: repeat(2, minmax(260px, 1fr));
          gap: 14px;
        }

        .start-option-card {
          text-align: left;
          background: white;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .start-option-card:hover {
          border-color: var(--primary-color);
          box-shadow: 0 6px 20px rgba(37, 99, 235, 0.08);
        }

        .start-option-card h3 {
          margin: 0 0 8px;
          font-size: 18px;
        }

        .start-option-card p {
          margin: 0;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        .start-note {
          margin-top: 12px;
          color: var(--text-secondary);
          font-size: 13px;
        }

        @media (max-width: 900px) {
          .start-options {
            grid-template-columns: 1fr;
          }
        }

        .direct-start-bar {
          position: absolute;
          left: 16px;
          right: 16px;
          top: 16px;
          z-index: 11;
          background: white;
          border: 1px solid var(--border-color);
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
          padding: 12px;
        }

        .direct-start-bar textarea {
          width: 100%;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 10px;
          font-size: 14px;
          resize: vertical;
          font-family: inherit;
        }

        .direct-start-actions {
          margin-top: 10px;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .editor-pane {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          min-height: 0;
        }

        .editor-editable,
        .editor-rendered {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 20px;
          line-height: 1.8;
          background: white;
        }

        .editor-editable {
          white-space: pre-wrap;
          word-break: break-word;
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 15px;
          outline: none;
        }

        .editor-rendered {
          cursor: text;
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

