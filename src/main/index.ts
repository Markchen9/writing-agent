import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import log from 'electron-log'

// Configure logging
log.transports.file.level = 'info'
log.transports.console.level = 'debug'

// Get user data path for storing topics
const userDataPath = app.getPath('userData')
const dataFilePath = join(userDataPath, 'topics.json')
const configFilePath = join(userDataPath, 'config.json')

// Ensure data directory exists
if (!existsSync(userDataPath)) {
  mkdirSync(userDataPath, { recursive: true })
}

// Initialize data file if not exists
if (!existsSync(dataFilePath)) {
  writeFileSync(dataFilePath, JSON.stringify({ topics: [] }, null, 2), 'utf-8')
}

// Initialize config file if not exists
if (!existsSync(configFilePath)) {
  writeFileSync(configFilePath, JSON.stringify({
    llm: {
      provider: 'openai',
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4'
    }
  }, null, 2), 'utf-8')
}

log.info('Application starting...')

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: '写作Agent',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Create menu
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建选题',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu-new-topic')
        },
        { type: 'separator' },
        {
          label: '导出Markdown',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow?.webContents.send('menu-export')
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: '关于写作Agent',
              message: '写作Agent v1.0.0',
              detail: '服务于内容创作者的AI写作工具'
            })
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(menuTemplate)
  Menu.setApplicationMenu(menu)

  // Load the app
  if (process.env.NODE_ENV === 'development' || process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  log.info('Main window created')
}

// IPC Handlers for data operations
ipcMain.handle('get-topics', () => {
  try {
    const data = readFileSync(dataFilePath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    log.error('Error reading topics:', error)
    return { topics: [] }
  }
})

ipcMain.handle('save-topics', (_event, data) => {
  try {
    writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf-8')
    return { success: true }
  } catch (error) {
    log.error('Error saving topics:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('get-config', () => {
  try {
    const data = readFileSync(configFilePath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    log.error('Error reading config:', error)
    return { llm: { provider: 'openai', apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4' } }
  }
})

ipcMain.handle('save-config', (_event, config) => {
  try {
    writeFileSync(configFilePath, JSON.stringify(config, null, 2), 'utf-8')
    return { success: true }
  } catch (error) {
    log.error('Error saving config:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('export-markdown', async (_event, content: string, title: string) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '导出Markdown',
      defaultPath: `${title}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })

    if (!result.canceled && result.filePath) {
      writeFileSync(result.filePath, content, 'utf-8')
      return { success: true, path: result.filePath }
    }
    return { success: false, canceled: true }
  } catch (error) {
    log.error('Error exporting markdown:', error)
    return { success: false, error: String(error) }
  }
})

// Call LLM API
ipcMain.handle('call-llm', async (_event, messages: Array<{ role: string; content: string }>) => {
  try {
    const config = JSON.parse(readFileSync(configFilePath, 'utf-8'))
    const { provider, apiKey, baseUrl, model } = config.llm

    if (!apiKey) {
      return { success: false, error: 'API Key未配置，请在设置中配置LLM API' }
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: `API错误: ${response.status} - ${errorText}` }
    }

    const data = await response.json()
    return { success: true, content: data.choices[0].message.content }
  } catch (error) {
    log.error('Error calling LLM:', error)
    return { success: false, error: String(error) }
  }
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled Rejection:', reason)
})
