import { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Topic } from '../App'

interface TopicListProps {
  topics: Topic[]
  onSelectTopic: (id: string) => void
  onSaveTopics: (topics: Topic[]) => void
}

type FilterStatus = 'all' | 'pending' | 'in_progress' | 'completed'

interface Column {
  id: string
  title: string
  status?: 'pending' | 'in_progress' | 'completed' | string
}

const DEFAULT_COLUMNS: Column[] = [
  { id: 'pending', title: '待创作', status: 'pending' },
  { id: 'in_progress', title: '进行中', status: 'in_progress' },
  { id: 'completed', title: '已完成', status: 'completed' }
]

// 可拖拽的选题卡片组件
function SortableTopicCard({ topic, onSelect, onEdit, onDelete, onStatusChange, onDragStart }: {
  topic: Topic
  onSelect: (id: string) => void
  onEdit: (topic: Topic, e: React.MouseEvent) => void
  onDelete: (id: string, e: React.MouseEvent) => void
  onStatusChange: (id: string, status: Topic['status'], e: React.MouseEvent) => void
  onDragStart: (e: React.DragEvent, id: string) => void
}) {
  const getStatusBadge = (status: Topic['status']) => {
    const statusMap: Record<string, { label: string; class: string }> = {
      pending: { label: '待创作', class: 'pending' },
      in_progress: { label: '进行中', class: 'in_progress' },
      completed: { label: '已完成', class: 'completed' }
    }
    const { label, class: cls } = statusMap[status] || { label: status, class: 'pending' }
    return <span className={`badge ${cls}`}>{label}</span>
  }

  return (
    <div
      className="sortable-topic-card"
      draggable
      onDragStart={(e) => onDragStart(e, topic.id)}
    >
      <div className="topic-card" onClick={() => onSelect(topic.id)}>
        <div className="topic-header">
          <h3>{topic.title}</h3>
          {getStatusBadge(topic.status)}
        </div>
        {topic.description && (
          <p className="topic-description">{topic.description}</p>
        )}
        <div className="topic-meta">
          <span>更新于 {new Date(topic.updatedAt).toLocaleDateString()}</span>
        </div>
        <div className="topic-actions">
          <select
            value={topic.status}
            onChange={e => onStatusChange(topic.id, e.target.value as Topic['status'], e as unknown as React.MouseEvent)}
            onClick={e => e.stopPropagation()}
          >
            <option value="pending">待创作</option>
            <option value="in_progress">进行中</option>
            <option value="completed">已完成</option>
          </select>
          <button className="secondary" onClick={e => onEdit(topic, e)}>编辑</button>
          <button className="danger" onClick={e => onDelete(topic.id, e)}>删除</button>
        </div>
      </div>
    </div>
  )
}

// 看板列组件
function KanbanColumn({
  column,
  topics,
  onDrop,
  onRename,
  onDelete,
  isCustomColumn,
  onSelectTopic,
  onEdit,
  onDeleteTopic,
  onStatusChange,
  onDragStart,
  onDragOver,
  onDropColumn,
  onCardDrop
}: {
  column: Column
  topics: Topic[]
  onDrop: (topicId: string, status: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  isCustomColumn: boolean
  onSelectTopic: (id: string) => void
  onEdit: (topic: Topic, e: React.MouseEvent) => void
  onDeleteTopic: (id: string, e: React.MouseEvent) => void
  onStatusChange: (id: string, status: Topic['status'], e: React.MouseEvent) => void
  onDragStart: (e: React.DragEvent, id: string) => void
  onDragOver: (e: React.DragEvent) => void
  onDropColumn: (e: React.DragEvent, status: string) => void
  onCardDrop: (e: React.DragEvent, targetId: string, position: 'before' | 'after') => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(column.title)
  const [isDragOver, setIsDragOver] = useState(false)
  const [dragOverCard, setDragOverCard] = useState<{ id: string; position: 'before' | 'after' } | null>(null)

  const handleRename = () => {
    if (editTitle.trim()) {
      onRename(column.id, editTitle)
    }
    setIsEditing(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
    onDragOver(e)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    setDragOverCard(null)
    onDropColumn(e, column.status as string)
  }

  const handleCardDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const offsetY = e.clientY - rect.top
    const position = offsetY < rect.height / 2 ? 'before' : 'after'
    setDragOverCard({ id: targetId, position })
  }

  const handleCardDropWrapper = (e: React.DragEvent, targetId: string, position: 'before' | 'after') => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverCard(null)
    onCardDrop(e, targetId, position)
  }

  return (
    <div
      className={`kanban-column ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="column-header">
        <div className="column-title-row">
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onBlur={handleRename}
              onKeyDown={e => e.key === 'Enter' && handleRename()}
              autoFocus
              className="column-title-input"
            />
          ) : (
            <h3 onDoubleClick={() => setIsEditing(true)}>{column.title}</h3>
          )}
          <span className="topic-count">{topics.length}</span>
        </div>
        <div className="column-actions">
          {isCustomColumn && (
            <>
              <button className="icon-btn-small" onClick={() => setIsEditing(true)} title="重命名">✏️</button>
              <button className="icon-btn-small" onClick={() => onDelete(column.id)} title="删除">🗑️</button>
            </>
          )}
        </div>
      </div>
      <div className="column-cards">
        {topics.map(topic => {
          const isBefore = dragOverCard?.id === topic.id && dragOverCard.position === 'before'
          const isAfter = dragOverCard?.id === topic.id && dragOverCard.position === 'after'
          return (
            <div
              key={topic.id}
              className={`card-drop-zone ${isBefore ? 'drop-before' : ''} ${isAfter ? 'drop-after' : ''}`}
              onDragOver={(e) => handleCardDragOver(e, topic.id)}
              onDrop={(e) => handleCardDropWrapper(e, topic.id, dragOverCard?.position || 'before')}
            >
              <SortableTopicCard
                topic={topic}
                onSelect={onSelectTopic}
                onEdit={onEdit}
                onDelete={onDeleteTopic}
                onStatusChange={onStatusChange}
                onDragStart={onDragStart}
              />
            </div>
          )
        })}
        {topics.length === 0 && (
          <div className="empty-column">暂无选题</div>
        )}
      </div>
    </div>
  )
}

function TopicList({ topics, onSelectTopic, onSaveTopics }: TopicListProps) {
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateTopic, setGenerateTopic] = useState('')
  const [generatedTopics, setGeneratedTopics] = useState<{ title: string; description: string }[]>([])
  const [showGeneratedModal, setShowGeneratedModal] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [selectedTopics, setSelectedTopics] = useState<{ title: string; description: string }[]>([])
  const [isKanbanView, setIsKanbanView] = useState(() => {
    const saved = localStorage.getItem('kanbanView')
    return saved ? JSON.parse(saved) : false
  })
  const [columns, setColumns] = useState<Column[]>(() => {
    const saved = localStorage.getItem('kanbanColumns')
    return saved ? JSON.parse(saved) : DEFAULT_COLUMNS
  })
  const [kanbanSearch, setKanbanSearch] = useState('')
  const [newColumnName, setNewColumnName] = useState('')

  // Listen for new topic event from menu
  useEffect(() => {
    const handleNewTopic = () => {
      setShowModal(true)
      setEditingTopic(null)
      setNewTitle('')
      setNewDescription('')
    }
    window.addEventListener('new-topic', handleNewTopic)
    return () => window.removeEventListener('new-topic', handleNewTopic)
  }, [])

  // 保存视图状态
  useEffect(() => {
    localStorage.setItem('kanbanView', JSON.stringify(isKanbanView))
  }, [isKanbanView])

  // 保存列配置
  useEffect(() => {
    localStorage.setItem('kanbanColumns', JSON.stringify(columns))
  }, [columns])

  const filteredTopics = topics.filter(t =>
    filter === 'all' ? true : t.status === filter
  ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  const handleCreateOrUpdate = () => {
    if (!newTitle.trim()) return

    const now = new Date().toISOString()
    if (editingTopic) {
      const updated = topics.map(t =>
        t.id === editingTopic.id
          ? { ...t, title: newTitle, description: newDescription, updatedAt: now }
          : t
      )
      onSaveTopics(updated)
    } else {
      const newTopic: Topic = {
        id: uuidv4(),
        title: newTitle,
        description: newDescription,
        status: 'pending',
        content: '',
        tags: [],
        createdAt: now,
        updatedAt: now
      }
      onSaveTopics([...topics, newTopic])
    }
    setShowModal(false)
    setNewTitle('')
    setNewDescription('')
    setEditingTopic(null)
  }

  const handleEdit = (topic: Topic, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingTopic(topic)
    setNewTitle(topic.title)
    setNewDescription(topic.description)
    setShowModal(true)
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('确定要删除这个选题吗？')) {
      onSaveTopics(topics.filter(t => t.id !== id))
    }
  }

  const handleStatusChange = (id: string, status: Topic['status'], e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = topics.map(t =>
      t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t
    )
    onSaveTopics(updated)
  }

  const handleGenerateTopics = async () => {
    if (!generateTopic.trim()) return

    setIsGenerating(true)
    try {
      const response = await window.electronAPI.callLLM([
        {
          role: 'user',
          content: `请为以下主题生成 3 个写作选题，每个选题包含标题和简短描述。请严格返回 JSON 格式，不要其他文字：
[
  {"title": "选题标题 1", "description": "选题描述 1"},
  {"title": "选题标题 2", "description": "选题描述 2"},
  {"title": "选题标题 3", "description": "选题描述 3"}
]

主题：${generateTopic}`
        }
      ])

      if (response.success && response.content) {
        const jsonMatch = response.content.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          const topics = JSON.parse(jsonMatch[0])
          setGeneratedTopics(topics)
          setShowGeneratedModal(true)
        } else {
          alert('生成失败：无法解析返回内容')
        }
      } else {
        alert(`生成失败：${response.error}`)
      }
    } catch (error) {
      alert('生成选题失败')
    }
    setIsGenerating(false)
  }

  const handleRegenerate = async () => {
    if (!generateTopic.trim()) return

    setIsRegenerating(true)
    try {
      const response = await window.electronAPI.callLLM([
        {
          role: 'user',
          content: `请为以下主题生成 3 个写作选题，每个选题包含标题和简短描述。请严格返回 JSON 格式，不要其他文字：
[
  {"title": "选题标题 1", "description": "选题描述 1"},
  {"title": "选题标题 2", "description": "选题描述 2"},
  {"title": "选题标题 3", "description": "选题描述 3"}
]

主题：${generateTopic}`
        }
      ])

      if (response.success && response.content) {
        const jsonMatch = response.content.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          const topics = JSON.parse(jsonMatch[0])
          setGeneratedTopics(topics)
        } else {
          alert('生成失败：无法解析返回内容')
        }
      } else {
        alert(`生成失败：${response.error}`)
      }
    } catch (error) {
      alert('生成选题失败')
    }
    setIsRegenerating(false)
  }

  const handleSelectGenerated = (topic: { title: string; description: string }) => {
    if (isMultiSelectMode) {
      const index = selectedTopics.findIndex(t => t.title === topic.title)
      if (index > -1) {
        setSelectedTopics(selectedTopics.filter((_, i) => i !== index))
      } else {
        setSelectedTopics([...selectedTopics, topic])
      }
    } else {
      setNewTitle(topic.title)
      setNewDescription(topic.description)
      setShowGeneratedModal(false)
      setShowModal(true)
    }
  }

  const handleBatchCreate = () => {
    if (selectedTopics.length === 0) return

    const now = new Date().toISOString()
    const newTopics = selectedTopics.map((topic) => ({
      id: uuidv4(),
      title: topic.title,
      description: topic.description,
      status: 'pending' as const,
      content: '',
      tags: [],
      createdAt: now,
      updatedAt: now
    }))

    onSaveTopics([...topics, ...newTopics])
    setShowGeneratedModal(false)
    setSelectedTopics([])
    setIsMultiSelectMode(false)
  }

  const handleAddColumn = () => {
    if (!newColumnName.trim()) return
    const newColumn: Column = {
      id: `custom-${Date.now()}`,
      title: newColumnName,
      status: newColumnName
    }
    setColumns([...columns, newColumn])
    setNewColumnName('')
  }

  const handleRenameColumn = (columnId: string, newTitle: string) => {
    setColumns(columns.map(col =>
      col.id === columnId ? { ...col, title: newTitle } : col
    ))
  }

  const handleDeleteColumn = (columnId: string) => {
    if (columnId === 'pending' || columnId === 'in_progress' || columnId === 'completed') {
      alert('默认列无法删除')
      return
    }
    setColumns(columns.filter(col => col.id !== columnId))
  }

  const handleDrop = (topicId: string, newStatus: string) => {
    const now = new Date().toISOString()
    const updated = topics.map(t =>
      t.id === topicId ? { ...t, status: newStatus, updatedAt: now } : t
    )
    onSaveTopics(updated)
  }

  const handleDragStart = (e: React.DragEvent, topicId: string) => {
    e.dataTransfer.setData('topicId', topicId)
    e.dataTransfer.setData('sourceType', 'card')
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDropColumn = (e: React.DragEvent, status: string) => {
    const topicId = e.dataTransfer.getData('topicId')
    const sourceType = e.dataTransfer.getData('sourceType')

    if (sourceType === 'card' && topicId) {
      handleDrop(topicId, status)
    }
  }

  // 处理卡片在列内排序
  const handleCardDrop = (e: React.DragEvent, targetTopicId: string, position: 'before' | 'after') => {
    e.preventDefault()
    e.stopPropagation()

    const topicId = e.dataTransfer.getData('topicId')
    const sourceType = e.dataTransfer.getData('sourceType')

    if (sourceType !== 'card' || !topicId) return

    // 找到当前状态的所有卡片
    const currentStatusTopics = topics.filter(t => t.status === topics.find(tt => tt.id === targetTopicId)?.status)

    // 移除被拖拽的卡片
    let filtered = currentStatusTopics.filter(t => t.id !== topicId)

    // 找到目标卡片的位置
    const targetIndex = filtered.findIndex(t => t.id === targetTopicId)
    const insertIndex = position === 'before' ? targetIndex : targetIndex + 1

    // 插入到目标位置
    const draggedTopic = topics.find(t => t.id === topicId)
    if (draggedTopic) {
      filtered.splice(insertIndex, 0, { ...draggedTopic, status: currentStatusTopics[0]?.status || 'pending' })
    }

    // 更新所有卡片的 order
    const now = new Date().toISOString()
    const updatedTopics = topics.map(t => {
      const newIndex = filtered.findIndex(ft => ft.id === t.id)
      if (newIndex > -1) {
        return { ...t, order: newIndex, updatedAt: now }
      }
      return t
    })

    onSaveTopics(updatedTopics)
  }

  const getStatusBadge = (status: Topic['status']) => {
    const statusMap = {
      pending: { label: '待创作', class: 'pending' },
      in_progress: { label: '进行中', class: 'in_progress' },
      completed: { label: '已完成', class: 'completed' }
    }
    const { label, class: cls } = statusMap[status] || { label: status, class: 'pending' }
    return <span className={`badge ${cls}`}>{label}</span>
  }

  // 看板视图渲染
  const renderKanbanView = () => {
    // 筛选卡片
    const filterTopics = (topic: Topic) => {
      if (!kanbanSearch.trim()) return true
      const searchLower = kanbanSearch.toLowerCase()
      return (
        topic.title.toLowerCase().includes(searchLower) ||
        topic.description.toLowerCase().includes(searchLower) ||
        topic.tags.some(tag => tag.toLowerCase().includes(searchLower))
      )
    }

    return (
      <div className="kanban-board-wrapper">
        {/* 搜索栏 */}
        <div className="kanban-search-bar">
          <input
            type="text"
            placeholder="搜索标题、描述或标签..."
            value={kanbanSearch}
            onChange={e => setKanbanSearch(e.target.value)}
            className="kanban-search-input"
          />
          {kanbanSearch && (
            <button className="clear-search" onClick={() => setKanbanSearch('')}>
              ✕
            </button>
          )}
        </div>
        <div className="kanban-board">
          {columns.map(column => {
            const columnTopics = topics
              .filter(t => t.status === column.status)
              .filter(filterTopics)
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            return (
              <KanbanColumn
                key={column.id}
                column={column}
                topics={columnTopics}
                onDrop={handleDrop}
                onRename={handleRenameColumn}
                onDelete={handleDeleteColumn}
                isCustomColumn={column.id.startsWith('custom-')}
                onSelectTopic={onSelectTopic}
                onEdit={handleEdit}
                onDeleteTopic={handleDelete}
                onStatusChange={handleStatusChange}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDropColumn={handleDropColumn}
                onCardDrop={handleCardDrop}
              />
            )
          })}
          {/* 添加列 */}
          <div className="add-column">
            <div className="add-column-content">
              <input
                type="text"
                placeholder="新列名称..."
                value={newColumnName}
                onChange={e => setNewColumnName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddColumn()}
              />
              <button className="primary" onClick={handleAddColumn}>添加列</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="topic-list-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-section">
          <div className="section-header">
            <h3>筛选</h3>
            <button className="icon-btn" onClick={() => setIsKanbanView(!isKanbanView)} title={isKanbanView ? '列表视图' : '看板视图'}>
              {isKanbanView ? '📋' : '📊'}
            </button>
          </div>
          {!isKanbanView && (
            <ul className="filter-list">
              <li className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
                全部 ({topics.length})
              </li>
              <li className={filter === 'pending' ? 'active' : ''} onClick={() => setFilter('pending')}>
                待创作 ({topics.filter(t => t.status === 'pending').length})
              </li>
              <li className={filter === 'in_progress' ? 'active' : ''} onClick={() => setFilter('in_progress')}>
                进行中 ({topics.filter(t => t.status === 'in_progress').length})
              </li>
              <li className={filter === 'completed' ? 'active' : ''} onClick={() => setFilter('completed')}>
                已完成 ({topics.filter(t => t.status === 'completed').length})
              </li>
            </ul>
          )}
        </div>

        <div className="sidebar-section">
          <button className="primary generate-btn" onClick={() => setShowModal(true)}>
            + 新建选题
          </button>
        </div>

        <div className="sidebar-section">
          <h3>AI 生成选题</h3>
          <div className="generate-input">
            <input
              type="text"
              placeholder="输入主题..."
              value={generateTopic}
              onChange={e => setGenerateTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGenerateTopics()}
            />
            <button
              className="secondary"
              onClick={handleGenerateTopics}
              disabled={isGenerating}
            >
              {isGenerating ? '生成中...' : '生成'}
            </button>
          </div>
        </div>
      </aside>

      {/* Topic List / Kanban View */}
      <div className="topic-list">
        {isKanbanView ? (
          renderKanbanView()
        ) : (
          <>
            <h2>
              {filter === 'all' ? '全部选题' :
               filter === 'pending' ? '待创作' :
               filter === 'in_progress' ? '进行中' : '已完成'}
            </h2>

            {filteredTopics.length === 0 ? (
              <div className="empty-state">
                <p>暂无选题</p>
                <button className="primary" onClick={() => setShowModal(true)}>
                  创建第一个选题
                </button>
              </div>
            ) : (
              <div className="topics-grid">
                {filteredTopics.map(topic => (
                  <div
                    key={topic.id}
                    className="topic-card"
                    onClick={() => onSelectTopic(topic.id)}
                  >
                    <div className="topic-header">
                      <h3>{topic.title}</h3>
                      {getStatusBadge(topic.status)}
                    </div>
                    {topic.description && (
                      <p className="topic-description">{topic.description}</p>
                    )}
                    <div className="topic-meta">
                      <span>更新于 {new Date(topic.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="topic-actions">
                      <select
                        value={topic.status}
                        onChange={e => handleStatusChange(topic.id, e.target.value as Topic['status'], e)}
                        onClick={e => e.stopPropagation()}
                      >
                        <option value="pending">待创作</option>
                        <option value="in_progress">进行中</option>
                        <option value="completed">已完成</option>
                      </select>
                      <button className="secondary" onClick={e => handleEdit(topic, e)}>编辑</button>
                      <button className="danger" onClick={e => handleDelete(topic.id, e)}>删除</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal - New/Edit Topic */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editingTopic ? '编辑选题' : '新建选题'}</h2>
            <div className="form-group">
              <label>标题</label>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="输入选题标题"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>描述</label>
              <textarea
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                placeholder="输入选题描述（可选）"
                rows={3}
              />
            </div>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setShowModal(false)}>取消</button>
              <button className="primary" onClick={handleCreateOrUpdate}>
                {editingTopic ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Generated Topics Selection */}
      {showGeneratedModal && (
        <div className="modal-overlay">
          <div className="modal generated-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>选择选题</h2>
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={isMultiSelectMode}
                  onChange={e => {
                    setIsMultiSelectMode(e.target.checked)
                    setSelectedTopics([])
                  }}
                />
                <span className="toggle-text">{isMultiSelectMode ? '多选' : '单选'}</span>
              </label>
            </div>
            <p className="modal-subtitle">
              {isMultiSelectMode
                ? 'AI 为你生成了 3 个选题，可选择多个进行批量创建：'
                : 'AI 为你生成了 3 个选题，请点击选择：'}
            </p>
            <div className="generated-topics-list">
              {generatedTopics.map((topic, index) => {
                const isSelected = selectedTopics.findIndex(t => t.title === topic.title) > -1
                return (
                  <div
                    key={index}
                    className={`generated-topic-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectGenerated(topic)}
                  >
                    {isMultiSelectMode && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="topic-checkbox"
                      />
                    )}
                    <h4>{topic.title}</h4>
                    <p>{topic.description}</p>
                  </div>
                )
              })}
            </div>
            <div className="modal-actions">
              <button
                className="secondary"
                onClick={handleRegenerate}
                disabled={isRegenerating}
              >
                {isRegenerating ? '重新生成中...' : '重新生成'}
              </button>
              {isMultiSelectMode && selectedTopics.length > 0 && (
                <button className="primary" onClick={handleBatchCreate}>
                  批量创建 ({selectedTopics.length}个)
                </button>
              )}
              <button className="secondary" onClick={() => setShowGeneratedModal(false)}>取消</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .topic-list-container {
          display: flex;
          height: 100%;
        }

        .sidebar {
          width: 240px;
          background: var(--sidebar-bg);
          padding: 20px;
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .sidebar h3 {
          font-size: 12px;
          text-transform: uppercase;
          color: var(--text-secondary);
          margin-bottom: 12px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .section-header h3 {
          margin-bottom: 0;
        }

        .icon-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 18px;
          padding: 4px 8px;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .icon-btn:hover {
          background: var(--border-color);
        }

        .filter-list {
          list-style: none;
        }

        .filter-list li {
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          color: var(--text-secondary);
          font-size: 14px;
        }

        .filter-list li:hover {
          background: var(--border-color);
        }

        .filter-list li.active {
          background: white;
          color: var(--primary-color);
          font-weight: 500;
        }

        .generate-btn {
          width: 100%;
        }

        .generate-input {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .generate-input input {
          width: 100%;
        }

        .topic-list {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
        }

        .topic-list h2 {
          margin-bottom: 20px;
          font-size: 20px;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: var(--text-secondary);
        }

        .empty-state p {
          margin-bottom: 16px;
        }

        .topics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        .topic-card {
          background: white;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 16px;
          cursor: pointer;
          transition: box-shadow 0.2s;
        }

        .topic-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .topic-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }

        .topic-header h3 {
          font-size: 16px;
          font-weight: 600;
        }

        .topic-description {
          color: var(--text-secondary);
          font-size: 14px;
          margin-bottom: 12px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .topic-meta {
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 12px;
        }

        .topic-actions {
          display: flex;
          gap: 8px;
        }

        .topic-actions select {
          padding: 4px 8px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          font-size: 12px;
        }

        .topic-actions button {
          padding: 4px 8px;
          font-size: 12px;
        }

        /* Kanban Board Styles */
        .kanban-board-wrapper {
          position: relative;
          height: 100%;
        }

        .kanban-board {
          display: flex;
          gap: 16px;
          height: 100%;
          overflow-x: auto;
          padding: 16px;
          padding-top: 60px;
        }

        .kanban-search-bar {
          position: absolute;
          top: 16px;
          right: 24px;
          display: flex;
          align-items: center;
          gap: 8px;
          z-index: 10;
        }

        .kanban-search-input {
          width: 280px;
          padding: 8px 12px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          font-size: 14px;
          background: white;
        }

        .kanban-search-input:focus {
          outline: none;
          border-color: var(--primary-color);
        }

        .clear-search {
          padding: 4px 8px;
          font-size: 16px;
          background: var(--sidebar-bg);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          cursor: pointer;
          color: var(--text-secondary);
        }

        .clear-search:hover {
          background: var(--border-color);
        }

        .kanban-column {
          background: var(--sidebar-bg);
          border-radius: 8px;
          min-width: 300px;
          max-width: 300px;
          display: flex;
          flex-direction: column;
          transition: background 0.2s;
        }

        .kanban-column.drag-over {
          background: #e2e8f0;
        }

        .column-header {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
        }

        .column-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .column-title-row h3 {
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .column-title-input {
          font-size: 14px;
          font-weight: 600;
          padding: 4px 8px;
          border: 1px solid var(--primary-color);
          border-radius: 4px;
          width: 100%;
        }

        .topic-count {
          background: var(--border-color);
          color: var(--text-secondary);
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 12px;
          font-weight: 500;
        }

        .column-actions {
          display: flex;
          gap: 4px;
          margin-top: 8px;
        }

        .icon-btn-small {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          padding: 2px 4px;
          border-radius: 4px;
          opacity: 0.6;
          transition: all 0.2s;
        }

        .icon-btn-small:hover {
          opacity: 1;
          background: var(--border-color);
        }

        .column-cards {
          flex: 1;
          padding: 12px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 100px;
        }

        .card-drop-zone {
          position: relative;
        }

        .card-drop-zone::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: var(--primary-color);
          opacity: 0;
          transition: opacity 0.2s;
          z-index: 10;
        }

        .card-drop-zone::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: var(--primary-color);
          opacity: 0;
          transition: opacity 0.2s;
          z-index: 10;
        }

        .card-drop-zone.drop-before::before {
          opacity: 1;
        }

        .card-drop-zone.drop-after::after {
          opacity: 1;
        }

        .sortable-topic-card {
          cursor: grab;
        }

        .sortable-topic-card:active {
          cursor: grabbing;
        }

        .sortable-topic-card.dragging {
          opacity: 0.5;
        }

        .empty-column {
          text-align: center;
          color: var(--text-secondary);
          font-size: 13px;
          padding: 20px 8px;
        }

        .add-column {
          min-width: 300px;
        }

        .add-column-content {
          background: var(--sidebar-bg);
          border-radius: 8px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .add-column-content input {
          width: 100%;
        }

        /* Modal Styles */
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
          z-index: 100;
        }

        .modal {
          background: white;
          border-radius: 12px;
          padding: 24px;
          width: 90%;
          max-width: 480px;
        }

        .modal h2 {
          margin-bottom: 20px;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .modal-header h2 {
          margin-bottom: 0;
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 14px;
          color: var(--text-secondary);
        }

        .toggle-label input[type="checkbox"] {
          width: auto;
          cursor: pointer;
        }

        .toggle-text {
          font-weight: 500;
        }

        .modal-subtitle {
          color: var(--text-secondary);
          font-size: 14px;
          margin-bottom: 16px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-size: 14px;
          font-weight: 500;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
        }

        .generated-modal {
          max-width: 560px;
        }

        .generated-topics-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 20px;
        }

        .generated-topic-card {
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .generated-topic-card:hover {
          background: var(--sidebar-bg);
          border-color: var(--primary-color);
        }

        .generated-topic-card.selected {
          background: var(--sidebar-bg);
          border-color: var(--primary-color);
          border-width: 2px;
        }

        .topic-checkbox {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .generated-topic-card h4 {
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 6px;
          color: var(--text-primary);
          padding-right: 24px;
        }

        .generated-topic-card p {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0;
        }

        /* Badge Styles */
        .badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .badge.pending {
          background-color: #fef3c7;
          color: #92400e;
        }

        .badge.in_progress {
          background-color: #dbeafe;
          color: #1e40af;
        }

        .badge.completed {
          background-color: #dcfce7;
          color: #166534;
        }

        /* Button Styles */
        button {
          cursor: pointer;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-size: 14px;
          transition: all 0.2s;
        }

        button.primary {
          background-color: var(--primary-color);
          color: white;
        }

        button.primary:hover {
          background-color: var(--primary-hover);
        }

        button.secondary {
          background-color: var(--sidebar-bg);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
        }

        button.secondary:hover {
          background-color: var(--border-color);
        }

        button.danger {
          background-color: var(--danger-color);
          color: white;
        }

        button.danger:hover {
          background-color: #dc2626;
        }

        input, textarea {
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 14px;
          font-family: inherit;
          width: 100%;
        }

        input:focus, textarea:focus {
          outline: none;
          border-color: var(--primary-color);
        }
      `}</style>
    </div>
  )
}

export default TopicList
