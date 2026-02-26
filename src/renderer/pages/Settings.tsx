import { useState, useEffect } from 'react'
import { Config, CreationConstitution } from '../App'

interface SettingsProps {
  config: Config
  onSaveConfig: (config: Config) => void
}

function Settings({ config, onSaveConfig }: SettingsProps) {
  const [llmConfig, setLlmConfig] = useState(config.llm)
  const [showApiKey, setShowApiKey] = useState(false)
  const [saved, setSaved] = useState(false)

  // 折叠面板状态
  const [expandedSection, setExpandedSection] = useState<'llm' | 'constitution' | 'about' | null>('llm')

  // 创作宪法管理状态
  const [constitutions, setConstitutions] = useState<CreationConstitution[]>(
    config.creationConstitutions || []
  )
  const [editingConstitution, setEditingConstitution] = useState<CreationConstitution | null>(null)
  const [showConstitutionForm, setShowConstitutionForm] = useState(false)

  // 当 config 更新时，同步更新 constitutions 状态
  useEffect(() => {
    setConstitutions(config.creationConstitutions || [])
  }, [config.creationConstitutions])

  // 检查是否需要创建默认提示词（只在没有提示词时执行一次）
  useEffect(() => {
    if (config.creationConstitutions && config.creationConstitutions.length > 0) {
      return // 已有提示词，不需要创建
    }

    // 只执行一次，创建后设置一个标记
    const hasCreatedDefaults = sessionStorage.getItem('createdDefaultConstitutions')
    if (hasCreatedDefaults) {
      return
    }

    const defaultConstitutions: CreationConstitution[] = [
      {
        id: 'constitution-tech-' + Date.now(),
        name: '技术文章风格',
        isDefault: true,
        tone: 'technical',
        perspective: 'first-person',
        targetAudience: '技术从业者、开发者',
        contentRules: [
          '逻辑清晰，层次分明',
          '多用代码示例和图表说明',
          '避免模糊表述，用词准确',
          '重要概念加粗或单独说明'
        ],
        customConstitution: `技术文章写作要求：

1. 先说结论，再展开细节（金字塔原理）
2. 代码示例要完整、可运行
3. 遇到专业术语要解释清楚
4. 段落之间用过渡句衔接
5. 避免"可能"、"应该"等模糊词汇`
      },
      {
        id: 'constitution-casual-' + (Date.now() + 1),
        name: '轻松随笔风格',
        isDefault: false,
        tone: 'casual',
        perspective: 'first-person',
        targetAudience: '普通读者、朋友',
        contentRules: [
          '像跟朋友聊天一样自然',
          '多用短句，每段不超过 5 行',
          '用故事和例子代替说教',
          '适当使用语气词和感叹句'
        ],
        customConstitution: `轻松随笔写作要求：

1. 开头用一个场景或问题引入
2. 多用"你"、"我"拉近距离
3. 少用形容词堆砌，多用动词
4. 结尾留一个开放式问题或思考
5. 禁用词汇：底层逻辑、认知升级、降维打击`
      }
    ]

    onSaveConfig({ ...config, creationConstitutions: defaultConstitutions })
    sessionStorage.setItem('createdDefaultConstitutions', 'true')
  }, [])

  const handleSave = () => {
    onSaveConfig({
      ...config,
      llm: llmConfig
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTest = async () => {
    const response = await window.electronAPI.callLLM([
      { role: 'user', content: '你好' }
    ])

    if (response.success) {
      alert('API 测试成功！')
    } else {
      alert(`API 测试失败：${response.error}`)
    }
  }

  // 生成唯一 ID
  const generateId = () => `constitution-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // 新建创作宪法
  const handleNewConstitution = () => {
    setEditingConstitution({
      id: generateId(),
      name: '新创作宪法',
      isDefault: constitutions.length === 0,
      tone: 'professional',
      perspective: 'first-person',
      targetAudience: '',
      contentRules: [],
      customConstitution: ''
    })
    setShowConstitutionForm(true)
  }

  // 编辑现有宪法
  const handleEditConstitution = (constitution: CreationConstitution) => {
    setEditingConstitution({ ...constitution })
    setShowConstitutionForm(true)
  }

  // 保存宪法
  const handleSaveConstitution = () => {
    if (!editingConstitution) return

    const exists = constitutions.find(c => c.id === editingConstitution.id)
    let newConstitutions: CreationConstitution[]

    if (exists) {
      newConstitutions = constitutions.map(c =>
        c.id === editingConstitution.id ? editingConstitution : c
      )
    } else {
      newConstitutions = [...constitutions, editingConstitution]
    }

    if (editingConstitution.isDefault) {
      newConstitutions = newConstitutions.map(c =>
        c.id === editingConstitution.id ? { ...c, isDefault: true } : { ...c, isDefault: false }
      )
    }

    setConstitutions(newConstitutions)
    onSaveConfig({ ...config, creationConstitutions: newConstitutions })
    setShowConstitutionForm(false)
    setEditingConstitution(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // 删除宪法
  const handleDeleteConstitution = (id: string) => {
    if (!confirm('确定要删除这套创作宪法吗？')) return

    const newConstitutions = constitutions.filter(c => c.id !== id)
    setConstitutions(newConstitutions)
    onSaveConfig({ ...config, creationConstitutions: newConstitutions })
  }

  // 设为默认
  const handleSetDefault = (id: string) => {
    const newConstitutions = constitutions.map(c => ({
      ...c,
      isDefault: c.id === id
    }))
    setConstitutions(newConstitutions)
    onSaveConfig({ ...config, creationConstitutions: newConstitutions })
  }

  // 添加内容规则
  const handleAddRule = () => {
    if (!editingConstitution) return
    setEditingConstitution({
      ...editingConstitution,
      contentRules: [...editingConstitution.contentRules, '']
    })
  }

  // 更新内容规则
  const handleUpdateRule = (index: number, value: string) => {
    if (!editingConstitution) return
    const newRules = [...editingConstitution.contentRules]
    newRules[index] = value
    setEditingConstitution({ ...editingConstitution, contentRules: newRules })
  }

  // 删除内容规则
  const handleDeleteRule = (index: number) => {
    if (!editingConstitution) return
    const newRules = editingConstitution.contentRules.filter((_, i) => i !== index)
    setEditingConstitution({ ...editingConstitution, contentRules: newRules })
  }

  return (
    <div className="settings-container">
      {/* LLM 设置 */}
      <div className="settings-section">
        <button
          className="section-header"
          onClick={() => setExpandedSection(expandedSection === 'llm' ? null : 'llm')}
        >
          <span className="section-icon">⚙️</span>
          <span className="section-title">LLM 设置</span>
          {saved && <span className="save-indicator">已保存</span>}
          <span className="section-arrow">{expandedSection === 'llm' ? '▼' : '▶'}</span>
        </button>

        {expandedSection === 'llm' && (
          <div className="section-content">
            <div className="form-group">
              <label>API Provider</label>
              <select
                value={llmConfig.provider}
                onChange={e => setLlmConfig({ ...llmConfig, provider: e.target.value })}
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="custom">自定义</option>
              </select>
            </div>

            <div className="form-group">
              <label>API Key</label>
              <div className="api-key-input">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={llmConfig.apiKey}
                  onChange={e => setLlmConfig({ ...llmConfig, apiKey: e.target.value })}
                  placeholder="输入你的 API Key"
                />
                <button
                  className="secondary"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? '隐藏' : '显示'}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Base URL</label>
              <input
                type="text"
                value={llmConfig.baseUrl}
                onChange={e => setLlmConfig({ ...llmConfig, baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
              <span className="hint">
                OpenAI: https://api.openai.com/v1
                <br />
                Anthropic: https://api.anthropic.com
                <br />
                自定义 API: 你的 API 地址
              </span>
            </div>

            <div className="form-group">
              <label>Model</label>
              <input
                type="text"
                value={llmConfig.model}
                onChange={e => setLlmConfig({ ...llmConfig, model: e.target.value })}
                placeholder="gpt-4"
              />
              <span className="hint">
                常用：gpt-4, gpt-4-turbo, gpt-3.5-turbo
              </span>
            </div>

            <div className="actions">
              <button className="secondary" onClick={handleTest}>
                测试连接
              </button>
              <button className="primary" onClick={handleSave}>
                {saved ? '已保存 ✓' : '保存设置'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 创作提示词管理 */}
      <div className="settings-section">
        <button
          className="section-header"
          onClick={() => setExpandedSection(expandedSection === 'constitution' ? null : 'constitution')}
        >
          <span className="section-icon">📜</span>
          <span className="section-title">创作提示词管理</span>
          <span className="section-count">{constitutions.length} 套</span>
          <span className="section-arrow">{expandedSection === 'constitution' ? '▼' : '▶'}</span>
        </button>

        {expandedSection === 'constitution' && (
          <div className="section-content">
            <p className="section-description">定义你的写作风格和要求，让 AI 按你的要求创作</p>

            {constitutions.length === 0 ? (
              <div className="empty-state">
                <p>还没有创作提示词，创建一套开始吧～</p>
                <button className="primary" onClick={handleNewConstitution}>
                  + 新建创作提示词
                </button>
              </div>
            ) : (
              <div className="constitution-list">
                {constitutions.map(c => (
                  <div key={c.id} className={`constitution-item ${c.isDefault ? 'default' : ''}`}>
                    <div className="constitution-info">
                      <h3>{c.name}</h3>
                      {c.isDefault && <span className="default-badge">默认</span>}
                      <p className="constitution-meta">
                        <span>语气：{getToneLabel(c.tone)}</span>
                        <span>人称：{getPerspectiveLabel(c.perspective)}</span>
                      </p>
                    </div>
                    <div className="constitution-actions">
                      <button className="secondary" onClick={() => handleEditConstitution(c)}>编辑</button>
                      {!c.isDefault && (
                        <button className="secondary" onClick={() => handleSetDefault(c.id)}>设为默认</button>
                      )}
                      <button className="danger" onClick={() => handleDeleteConstitution(c.id)}>删除</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {constitutions.length > 0 && (
              <button className="secondary add-constitution-btn" onClick={handleNewConstitution}>
                + 新建创作提示词
              </button>
            )}
          </div>
        )}
      </div>

      {/* 关于 */}
      <div className="settings-section">
        <button
          className="section-header"
          onClick={() => setExpandedSection(expandedSection === 'about' ? null : 'about')}
        >
          <span className="section-icon">ℹ️</span>
          <span className="section-title">关于</span>
          <span className="section-arrow">{expandedSection === 'about' ? '▼' : '▶'}</span>
        </button>

        {expandedSection === 'about' && (
          <div className="section-content">
            <div className="about-content">
              <p><strong>写作 Agent</strong> v1.0.0</p>
              <p>服务于内容创作者的 AI 写作工具</p>
              <ul>
                <li>选题管理 - 生成和管理写作选题</li>
                <li>Markdown 创作 - 支持实时预览</li>
                <li>AI 润色 - 改写、调整语气、纠错</li>
                <li>AI 助手 - 边写边问</li>
                <li>创作提示词 - 定义你的写作风格</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* 创作宪法编辑弹窗 */}
      {showConstitutionForm && editingConstitution && (
        <div className="modal-overlay" onClick={() => setShowConstitutionForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingConstitution.id.startsWith('constitution-') && !constitutions.find(c => c.id === editingConstitution.id) ? '新建创作提示词' : '编辑创作提示词'}</h2>
              <button className="close-btn" onClick={() => setShowConstitutionForm(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>提示词名称</label>
                <input
                  type="text"
                  value={editingConstitution.name}
                  onChange={e => setEditingConstitution({ ...editingConstitution, name: e.target.value })}
                  placeholder="例如：默认风格、技术文章风格、随笔风格"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>写作语气</label>
                  <select
                    value={editingConstitution.tone}
                    onChange={e => setEditingConstitution({ ...editingConstitution, tone: e.target.value as any })}
                  >
                    <option value="professional">专业严谨</option>
                    <option value="casual">轻松友好</option>
                    <option value="humorous">幽默风趣</option>
                    <option value="serious">严肃正式</option>
                    <option value="technical">技术专业</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>人称视角</label>
                  <select
                    value={editingConstitution.perspective}
                    onChange={e => setEditingConstitution({ ...editingConstitution, perspective: e.target.value as any })}
                  >
                    <option value="first-person">第一人称（我）</option>
                    <option value="third-person">第三人称（他/它）</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>目标读者</label>
                <input
                  type="text"
                  value={editingConstitution.targetAudience}
                  onChange={e => setEditingConstitution({ ...editingConstitution, targetAudience: e.target.value })}
                  placeholder="例如：25-35 岁职场人士、大学生、技术从业者"
                />
              </div>

              <div className="form-group">
                <label>内容规则</label>
                <div className="rules-list">
                  {editingConstitution.contentRules.map((rule, index) => (
                    <div key={index} className="rule-item">
                      <input
                        type="text"
                        value={rule}
                        onChange={e => handleUpdateRule(index, e.target.value)}
                        placeholder="例如：避免使用被动语态"
                      />
                      <button className="icon-btn" onClick={() => handleDeleteRule(index)}>×</button>
                    </div>
                  ))}
                  <button className="add-rule-btn" onClick={handleAddRule}>+ 添加规则</button>
                </div>
              </div>

              <div className="form-group">
                <label>自由定义区（我的创作提示词全文）</label>
                <textarea
                  className="custom-constitution-textarea"
                  value={editingConstitution.customConstitution}
                  onChange={e => setEditingConstitution({ ...editingConstitution, customConstitution: e.target.value })}
                  placeholder={`在这里自由书写你的写作要求，例如：

1. 永远用第一人称写作，像跟朋友聊天一样
2. 多用短句，每段不超过 5 行
3. 避免说教，用故事和例子说话
4. 禁用词汇：割韭菜、智商税、底层逻辑
5. 结尾总要留一个开放式问题让读者思考

...任何你想让 AI 遵守的写作规则`}
                  rows={8}
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editingConstitution.isDefault}
                    onChange={e => setEditingConstitution({ ...editingConstitution, isDefault: e.target.checked })}
                  />
                  设为默认（新建文章时自动使用）
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button className="secondary" onClick={() => setShowConstitutionForm(false)}>取消</button>
              <button className="primary" onClick={handleSaveConstitution}>保存</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .settings-container {
          max-width: 720px;
          margin: 0 auto;
          padding: 24px 20px 40px;
          max-height: calc(100vh - 80px);
          overflow-y: auto;
        }

        .settings-container::-webkit-scrollbar {
          width: 8px;
        }

        .settings-container::-webkit-scrollbar-track {
          background: var(--sidebar-bg);
          border-radius: 4px;
        }

        .settings-container::-webkit-scrollbar-thumb {
          background: var(--border-color);
          border-radius: 4px;
        }

        .settings-container::-webkit-scrollbar-thumb:hover {
          background: var(--text-secondary);
        }

        .settings-section {
          background: white;
          border: 1px solid var(--border-color);
          border-radius: 10px;
          margin-bottom: 16px;
          overflow: hidden;
        }

        .section-header {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          background: white;
          border: none;
          cursor: pointer;
          text-align: left;
          transition: background 0.2s;
        }

        .section-header:hover {
          background: var(--sidebar-bg);
        }

        .section-icon {
          font-size: 20px;
        }

        .section-title {
          flex: 1;
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .section-count {
          font-size: 13px;
          color: var(--text-secondary);
          padding: 4px 10px;
          background: var(--sidebar-bg);
          border-radius: 12px;
        }

        .section-arrow {
          font-size: 12px;
          color: var(--text-secondary);
          width: 20px;
        }

        .section-content {
          padding: 20px;
          border-top: 1px solid var(--border-color);
        }

        .section-description {
          color: var(--text-secondary);
          font-size: 14px;
          margin-bottom: 16px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 6px;
        }

        .form-group select,
        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
        }

        .form-group select:focus,
        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .form-group .hint {
          display: block;
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 6px;
          line-height: 1.5;
        }

        .api-key-input {
          display: flex;
          gap: 8px;
        }

        .api-key-input input {
          flex: 1;
        }

        .api-key-input button {
          padding: 10px 16px;
          white-space: nowrap;
        }

        .actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid var(--border-color);
        }

        .about-content {
          color: var(--text-secondary);
          font-size: 14px;
        }

        .about-content ul {
          margin-top: 16px;
          padding-left: 20px;
        }

        .about-content li {
          margin-bottom: 8px;
        }

        /* 创作宪法列表 */
        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: var(--text-secondary);
        }

        .empty-state p {
          margin-bottom: 16px;
        }

        .constitution-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 16px;
        }

        .constitution-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          background: var(--sidebar-bg);
        }

        .constitution-item.default {
          border-color: var(--primary-color);
          background: rgba(37, 99, 235, 0.05);
        }

        .constitution-info h3 {
          font-size: 16px;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .default-badge {
          font-size: 12px;
          padding: 2px 8px;
          background: var(--primary-color);
          color: white;
          border-radius: 4px;
        }

        .constitution-meta {
          font-size: 13px;
          color: var(--text-secondary);
          display: flex;
          gap: 16px;
          margin-top: 4px;
        }

        .constitution-actions {
          display: flex;
          gap: 8px;
        }

        .constitution-actions button {
          padding: 6px 12px;
          font-size: 13px;
        }

        .danger {
          background: #ef4444;
          color: white;
          border: none;
        }

        .danger:hover {
          background: #dc2626;
        }

        .add-constitution-btn {
          width: 100%;
        }

        /* 弹窗样式 */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          border-radius: 12px;
          padding: 24px;
          width: 90%;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .modal-header h2 {
          font-size: 20px;
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

        .modal-body {
          margin-bottom: 24px;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 16px;
          border-top: 1px solid var(--border-color);
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .rules-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .rule-item {
          display: flex;
          gap: 8px;
        }

        .rule-item input {
          flex: 1;
        }

        .icon-btn {
          width: 36px;
          height: 36px;
          border: 1px solid var(--border-color);
          background: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 18px;
          color: var(--text-secondary);
        }

        .icon-btn:hover {
          background: var(--sidebar-bg);
        }

        .add-rule-btn {
          width: 100%;
          padding: 8px;
          border: 1px dashed var(--border-color);
          background: transparent;
          border-radius: 6px;
          color: var(--text-secondary);
          cursor: pointer;
        }

        .add-rule-btn:hover {
          border-color: var(--primary-color);
          color: var(--primary-color);
        }

        .custom-constitution-textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          font-family: inherit;
          font-size: 14px;
          resize: vertical;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .checkbox-label input[type="checkbox"] {
          width: auto;
        }
      `}</style>
    </div>
  )
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

export default Settings
