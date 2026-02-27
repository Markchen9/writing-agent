import { useMemo } from 'react'

interface DiffPreviewProps {
    originalText: string   // 原文
    modifiedText: string   // 修改后
    onAccept: () => void   // 用户确认应用
    onReject: () => void   // 用户放弃
}

// ========== 简单的逐行 diff 算法（最长公共子序列） ==========
type DiffLine = {
    type: 'same' | 'added' | 'removed'
    content: string
}

// 计算两个字符串数组的 LCS 长度表
function lcsTable(a: string[], b: string[]): number[][] {
    const m = a.length
    const n = b.length
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
            }
        }
    }
    return dp
}

// 回溯 LCS 表生成 diff 结果
function computeDiff(original: string, modified: string): DiffLine[] {
    const aLines = original.split('\n')
    const bLines = modified.split('\n')
    const dp = lcsTable(aLines, bLines)
    const result: DiffLine[] = []

    let i = aLines.length
    let j = bLines.length

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && aLines[i - 1] === bLines[j - 1]) {
            result.unshift({ type: 'same', content: aLines[i - 1] })
            i--
            j--
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            result.unshift({ type: 'added', content: bLines[j - 1] })
            j--
        } else {
            result.unshift({ type: 'removed', content: aLines[i - 1] })
            i--
        }
    }

    return result
}

function DiffPreview({ originalText, modifiedText, onAccept, onReject }: DiffPreviewProps) {
    // 计算 diff
    const diffLines = useMemo(() => computeDiff(originalText, modifiedText), [originalText, modifiedText])

    // 统计变化数量
    const addedCount = diffLines.filter(l => l.type === 'added').length
    const removedCount = diffLines.filter(l => l.type === 'removed').length

    return (
        <div className="diff-overlay" onClick={onReject}>
            <div className="diff-dialog" onClick={e => e.stopPropagation()}>
                {/* 头部 */}
                <div className="diff-header">
                    <h3>润色预览</h3>
                    <div className="diff-stats">
                        <span className="diff-stat-added">+{addedCount} 行</span>
                        <span className="diff-stat-removed">-{removedCount} 行</span>
                    </div>
                </div>

                {/* Diff 内容区 */}
                <div className="diff-body">
                    {diffLines.map((line, i) => (
                        <div key={i} className={`diff-line diff-${line.type}`}>
                            <span className="diff-marker">
                                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                            </span>
                            <span className="diff-text">{line.content || ' '}</span>
                        </div>
                    ))}
                </div>

                {/* 操作按钮 */}
                <div className="diff-footer">
                    <button className="secondary" onClick={onReject}>放弃</button>
                    <button className="primary" onClick={onAccept}>应用修改</button>
                </div>
            </div>

            <style>{`
        /* 遮罩层 */
        .diff-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: diffFadeIn 0.15s ease-out;
        }

        @keyframes diffFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* 弹窗 */
        .diff-dialog {
          width: 90%;
          max-width: 720px;
          max-height: 80vh;
          background: white;
          border-radius: 12px;
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: diffSlideIn 0.2s ease-out;
        }

        @keyframes diffSlideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* 头部 */
        .diff-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
        }

        .diff-header h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }

        .diff-stats {
          display: flex;
          gap: 12px;
          font-size: 13px;
          font-weight: 500;
        }

        .diff-stat-added {
          color: #16a34a;
        }

        .diff-stat-removed {
          color: #dc2626;
        }

        /* Diff 内容 */
        .diff-body {
          flex: 1;
          overflow-y: auto;
          padding: 0;
          font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
          font-size: 13px;
          line-height: 1.6;
        }

        .diff-line {
          display: flex;
          padding: 1px 16px;
          white-space: pre-wrap;
          word-break: break-all;
        }

        .diff-line.diff-same {
          background: white;
          color: var(--text-primary);
        }

        .diff-line.diff-added {
          background: #dcfce7;
          color: #166534;
        }

        .diff-line.diff-removed {
          background: #fee2e2;
          color: #991b1b;
          text-decoration: line-through;
        }

        .diff-marker {
          display: inline-block;
          width: 20px;
          flex-shrink: 0;
          color: inherit;
          font-weight: bold;
          user-select: none;
        }

        .diff-text {
          flex: 1;
          min-width: 0;
        }

        /* 底部按钮 */
        .diff-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 20px;
          border-top: 1px solid var(--border-color);
        }
      `}</style>
        </div>
    )
}

export default DiffPreview
