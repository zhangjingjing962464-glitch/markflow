document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initDragAndDrop();
    initPreviewToggles();
    initMarkdownEditor();
    initConversion();
    initSettings();
    initToolbar();
    initKeyboardShortcuts();
});

// 当前上传的文件列表（支持批量）
let currentFiles = [];

// ===================== Tab 切换 =====================
function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    const indicator = document.querySelector('.tab-indicator');

    function updateIndicator(activeTab) {
        if (!indicator) return;
        indicator.style.width = activeTab.offsetWidth + 'px';
        indicator.style.transform = `translateX(${activeTab.offsetLeft}px)`;
    }

    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) updateIndicator(activeTab);

    window.addEventListener('resize', () => {
        const at = document.querySelector('.tab-btn.active');
        if (at) updateIndicator(at);
    });

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.getAttribute('data-tab')).classList.add('active');
            updateIndicator(tab);
        });
    });
}

// ===================== 拖拽上传（批量） =====================
function initDragAndDrop() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');
    const browseBtn = dropZone.querySelector('.btn-secondary');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e =>
        dropZone.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); }, false)
    );
    ['dragenter', 'dragover'].forEach(e =>
        dropZone.addEventListener(e, () => dropZone.classList.add('dragover'), false)
    );
    ['dragleave', 'drop'].forEach(e =>
        dropZone.addEventListener(e, () => dropZone.classList.remove('dragover'), false)
    );

    dropZone.addEventListener('drop', e => handleFiles(e.dataTransfer.files), false);
    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', function () { handleFiles(this.files); });

    function handleFiles(files) {
        if (files.length === 0) return;
        const newFiles = Array.from(files).filter(f => f.name.endsWith('.docx'));
        if (newFiles.length === 0) {
            showToast('请上传 .docx 格式的 Word 文档', 'error');
            return;
        }
        newFiles.forEach(f => {
            if (!currentFiles.find(c => c.name === f.name && c.size === f.size)) {
                currentFiles.push(f);
            }
        });
        renderFileList();
    }

    function renderFileList() {
        if (currentFiles.length === 0) {
            fileList.innerHTML = '';
            dropZone.style.display = 'flex';
            return;
        }
        dropZone.style.display = 'none';
        fileList.innerHTML = currentFiles.map((f, i) => `
            <div class="file-item" data-index="${i}">
                <div class="file-item-info">
                    <i class="ph ph-file-doc file-item-icon"></i>
                    <div>
                        <span class="file-item-name">${f.name}</span>
                        <span class="file-item-size">${formatFileSize(f.size)}</span>
                    </div>
                </div>
                <button class="icon-btn" onclick="removeFile(${i})" title="移除"><i class="ph ph-x"></i></button>
            </div>
        `).join('') + `
            <button class="btn btn-secondary full-width" onclick="document.getElementById('file-input').click()" style="margin-top: 8px">
                <i class="ph ph-plus"></i> 添加更多文件
            </button>
        `;
    }

    window.removeFile = function (index) {
        currentFiles.splice(index, 1);
        renderFileList();
    };

    window.resetUpload = function () {
        currentFiles = [];
        renderFileList();
        fileInput.value = '';
    };
}

// ===================== 预览视图切换 =====================
function initPreviewToggles() {
    const toggles = document.querySelectorAll('.toggle-btn');
    const previewBody = document.getElementById('preview-body');
    toggles.forEach(btn => {
        btn.addEventListener('click', () => {
            toggles.forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            const viewType = btn.getAttribute('data-view');
            previewBody.classList.remove('view-split', 'view-edit', 'view-render');
            previewBody.classList.add(`view-${viewType}`);
        });
    });
}

// ===================== Markdown 编辑与渲染 =====================
function initMarkdownEditor() {
    const editor = document.getElementById('markdown-editor');

    if (typeof marked === 'undefined') {
        console.warn('marked.js 未加载');
        return;
    }

    editor.addEventListener('input', () => renderMarkdown(editor.value));

    document.getElementById('copy-btn').addEventListener('click', () => {
        if (editor.value.trim() === '') return;
        navigator.clipboard.writeText(editor.value).then(() => {
            const btn = document.getElementById('copy-btn');
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="ph ph-check"></i> 已复制';
            btn.style.background = '#34C759'; btn.style.color = '#fff';
            setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; btn.style.color = ''; }, 2000);
        });
    });

    document.getElementById('save-btn').addEventListener('click', async () => {
        if (editor.value.trim() === '') { showToast('没有可保存的内容', 'warning'); return; }
        await saveMarkdown(editor.value);
    });
}

let currentFolderName = '';

/**
 * 渲染 Markdown 到预览区（图片路径映射）
 */
function renderMarkdown(text) {
    const renderPane = document.getElementById('markdown-render');
    if (text.trim() === '') {
        renderPane.innerHTML = `<div class="empty-state"><i class="ph ph-magic-wand"></i><p>转换后的内容将在此预览</p></div>`;
    } else {
        let html = marked.parse(text);
        if (currentFolderName) {
            html = html.replace(/src="images\//g, `src="/output-files/${encodeURIComponent(currentFolderName)}/images/`);
        }
        renderPane.innerHTML = html;
    }
}

// ===================== 转换逻辑（支持批量） =====================
function initConversion() {
    document.getElementById('convert-btn').addEventListener('click', async () => {
        const activeTabId = document.querySelector('.tab-content.active').id;
        try {
            switch (activeTabId) {
                case 'tab-word': await convertWord(); break;
                case 'tab-link': await convertUrl(); break;
                case 'tab-text': await convertText(); break;
            }
        } catch (err) {
            showLoading(false);
            showToast(`转换失败：${err.message}`, 'error');
        }
    });
}

async function convertWord() {
    if (currentFiles.length === 0) { showToast('请先上传 Word 文件', 'warning'); return; }

    if (currentFiles.length === 1) {
        // 单文件转换
        showLoading(true, '正在转换', '正在解析 Word 文档并提取图片...');
        const formData = new FormData();
        formData.append('file', currentFiles[0]);
        const response = await fetch('/api/convert/word', { method: 'POST', body: formData });
        const result = await response.json();
        showLoading(false);
        if (result.success) { displayResult(result.data); showToast(`转换成功！提取了 ${result.data.imagesCount} 张图片`, 'success'); }
        else showToast(`转换失败：${result.error}`, 'error');
    } else {
        // 批量转换
        showBatchProgress(true, currentFiles.length);
        let successCount = 0;
        let lastResult = null;
        for (let i = 0; i < currentFiles.length; i++) {
            updateProgress(i, currentFiles.length, currentFiles[i].name);
            const formData = new FormData();
            formData.append('file', currentFiles[i]);
            try {
                const response = await fetch('/api/convert/word', { method: 'POST', body: formData });
                const result = await response.json();
                if (result.success) { successCount++; lastResult = result.data; }
                // 标记文件状态
                const el = document.querySelector(`.file-item[data-index="${i}"]`);
                if (el) {
                    const statusEl = document.createElement('span');
                    statusEl.className = 'file-item-status';
                    statusEl.innerHTML = result.success ? '<i class="ph ph-check-circle" style="color:#34C759"></i>' : '<i class="ph ph-x-circle" style="color:#FF3B30"></i>';
                    el.appendChild(statusEl);
                }
            } catch (e) { console.error(e); }
        }
        showBatchProgress(false);
        if (lastResult) displayResult(lastResult);
        showToast(`批量转换完成！成功 ${successCount}/${currentFiles.length}`, successCount === currentFiles.length ? 'success' : 'warning');
    }
}

async function convertUrl() {
    const urlInput = document.getElementById('url-input');
    const text = urlInput.value.trim();
    if (!text) { showToast('请输入文章链接', 'warning'); return; }

    // 按行分割获取所有链接
    const urls = text.split('\n').map(u => u.trim()).filter(u => u && u.startsWith('http'));
    if (urls.length === 0) { showToast('未检测到有效链接', 'warning'); return; }

    if (urls.length === 1) {
        showLoading(true, '正在提取', '正在抓取网页内容并下载图片...');
        const response = await fetch('/api/convert/url', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: urls[0] })
        });
        const result = await response.json();
        showLoading(false);
        if (result.success) { displayResult(result.data); showToast(`提取成功！下载了 ${result.data.imagesCount} 张图片`, 'success'); }
        else showToast(`提取失败：${result.error}`, 'error');
    } else {
        // 批量链接转换
        showBatchProgress(true, urls.length);
        let successCount = 0;
        let lastResult = null;
        for (let i = 0; i < urls.length; i++) {
            updateProgress(i, urls.length, urls[i].substring(0, 60));
            try {
                const response = await fetch('/api/convert/url', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: urls[i] })
                });
                const result = await response.json();
                if (result.success) { successCount++; lastResult = result.data; }
            } catch (e) { console.error(e); }
        }
        showBatchProgress(false);
        if (lastResult) displayResult(lastResult);
        showToast(`批量提取完成！成功 ${successCount}/${urls.length}`, successCount === urls.length ? 'success' : 'warning');
    }
}

async function convertText() {
    const textInput = document.getElementById('raw-text-input');
    const text = textInput.value.trim();
    if (!text) { showToast('请输入或粘贴文本内容', 'warning'); return; }

    showLoading(true, '正在转换', '正在格式化文本内容...');
    const response = await fetch('/api/convert/text', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });
    const result = await response.json();
    showLoading(false);
    if (result.success) { displayResult(result.data); showToast('文本转换成功', 'success'); }
    else showToast(`转换失败：${result.error}`, 'error');
}

async function saveMarkdown(markdown) {
    if (!currentFolderName) { showToast('请先进行转换', 'warning'); return; }
    try {
        const response = await fetch('/api/save', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ markdown, folderName: currentFolderName })
        });
        const result = await response.json();
        if (result.success) showToast('保存成功', 'success');
        else showToast(`保存失败：${result.error}`, 'error');
    } catch (err) { showToast(`保存失败：${err.message}`, 'error'); }
}

function displayResult(data) {
    const editor = document.getElementById('markdown-editor');
    currentFolderName = data.folderName;
    editor.value = data.markdown;
    renderMarkdown(data.markdown);
    document.querySelector('[data-view="split"]').click();
    const label = document.getElementById('output-path-label');
    if (label) label.textContent = `${currentOutputDir}/${data.folderName}/`;
}

// ===================== 主题切换（在设置弹窗中） =====================
function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('theme-dark').classList.add('active');
        document.getElementById('theme-light').classList.remove('active');
    } else {
        document.documentElement.removeAttribute('data-theme');
        document.getElementById('theme-light').classList.add('active');
        document.getElementById('theme-dark').classList.remove('active');
    }
    localStorage.setItem('markflow-theme', theme);
}

// ===================== Markdown 工具栏 =====================
function initToolbar() {
    const toolbar = document.getElementById('editor-toolbar');
    const editor = document.getElementById('markdown-editor');

    toolbar.addEventListener('click', (e) => {
        const btn = e.target.closest('.toolbar-btn');
        if (!btn) return;
        const action = btn.dataset.action;
        applyToolbarAction(editor, action);
    });
}

function applyToolbarAction(editor, action) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const text = editor.value;
    const selected = text.substring(start, end);
    let before = '', after = '', insert = '';

    switch (action) {
        case 'bold': before = '**'; after = '**'; insert = selected || '加粗文字'; break;
        case 'italic': before = '*'; after = '*'; insert = selected || '斜体文字'; break;
        case 'strikethrough': before = '~~'; after = '~~'; insert = selected || '删除线文字'; break;
        case 'h1': before = '\n# '; insert = selected || '一级标题'; break;
        case 'h2': before = '\n## '; insert = selected || '二级标题'; break;
        case 'h3': before = '\n### '; insert = selected || '三级标题'; break;
        case 'ul': before = '\n- '; insert = selected || '列表项'; break;
        case 'ol': before = '\n1. '; insert = selected || '列表项'; break;
        case 'quote': before = '\n> '; insert = selected || '引用文字'; break;
        case 'code': before = '\n```\n'; after = '\n```'; insert = selected || '代码'; break;
        case 'link': before = '['; after = '](url)'; insert = selected || '链接文字'; break;
        case 'image': before = '!['; after = '](url)'; insert = selected || '图片描述'; break;
        case 'table':
            insert = '\n| 标题1 | 标题2 | 标题3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n';
            break;
        case 'hr': insert = '\n---\n'; break;
        default: return;
    }

    const replacement = before + insert + (after || '');
    editor.value = text.substring(0, start) + replacement + text.substring(end);
    editor.focus();
    const cursorPos = start + before.length + insert.length;
    editor.setSelectionRange(start + before.length, cursorPos);
    renderMarkdown(editor.value);
}

// ===================== 快捷键 =====================
function initKeyboardShortcuts() {
    const editor = document.getElementById('markdown-editor');

    document.addEventListener('keydown', (e) => {
        const isCtrl = e.ctrlKey || e.metaKey;

        // Ctrl+Enter 开始转换
        if (isCtrl && e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('convert-btn').click();
            return;
        }

        // Ctrl+S 保存
        if (isCtrl && e.key === 's') {
            e.preventDefault();
            document.getElementById('save-btn').click();
            return;
        }

        // 编辑器内的快捷键
        if (document.activeElement !== editor) return;

        if (isCtrl && e.key === 'b') {
            e.preventDefault();
            applyToolbarAction(editor, 'bold');
        } else if (isCtrl && e.key === 'i') {
            e.preventDefault();
            applyToolbarAction(editor, 'italic');
        } else if (isCtrl && e.key === 'k') {
            e.preventDefault();
            applyToolbarAction(editor, 'link');
        } else if (isCtrl && e.key === '`') {
            e.preventDefault();
            applyToolbarAction(editor, 'code');
        }
    });
}

// ===================== 设置弹窗 =====================
let currentOutputDir = '';

function initSettings() {
    const modal = document.getElementById('settings-modal');
    const settingsBtn = document.getElementById('settingsBtn');
    const closeBtn = document.getElementById('close-settings');
    const saveBtn = document.getElementById('save-output-dir');
    const resetBtn = document.getElementById('reset-output-dir');
    const dirInput = document.getElementById('output-dir-input');
    const previewDir = document.getElementById('preview-dir');

    loadOutputDir();

    // 加载保存的主题
    const savedTheme = localStorage.getItem('markflow-theme');
    if (savedTheme === 'dark') applyTheme('dark');

    // 打开设置
    function open() {
        dirInput.value = currentOutputDir;
        previewDir.textContent = currentOutputDir;
        modal.classList.add('active');
    }

    settingsBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });
    dirInput.addEventListener('input', () => { previewDir.textContent = dirInput.value || '/path/to/output'; });

    // 主题切换按钮
    document.getElementById('theme-light').addEventListener('click', () => applyTheme('light'));
    document.getElementById('theme-dark').addEventListener('click', () => applyTheme('dark'));

    // Electron 原生目录选择对话框
    if (window.electronAPI && window.electronAPI.isElectron) {
        // 在路径输入框后添加浏览按钮
        const inputWrapper = dirInput.closest('.settings-input-row');
        const browseBtn = document.createElement('button');
        browseBtn.className = 'btn btn-secondary';
        browseBtn.innerHTML = '<i class="ph ph-folder-open"></i> 浏览';
        browseBtn.style.marginTop = '8px';
        browseBtn.addEventListener('click', async () => {
            const dir = await window.electronAPI.selectDirectory();
            if (dir) {
                dirInput.value = dir;
                previewDir.textContent = dir;
            }
        });
        inputWrapper.appendChild(browseBtn);

        // 监听菜单触发的目录选择
        window.electronAPI.onSetOutputDir(async (dir) => {
            dirInput.value = dir;
            previewDir.textContent = dir;
            // 自动保存
            try {
                const res = await fetch('/api/settings/output-dir', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dir })
                });
                const r = await res.json();
                if (r.success) { currentOutputDir = r.outputDir; updatePathLabel(); showToast('输出目录已更新', 'success'); }
            } catch (e) { /* 忽略 */ }
        });
    }

    // 保存路径
    saveBtn.addEventListener('click', async () => {
        const newDir = dirInput.value.trim();
        if (!newDir) { showToast('路径不能为空', 'warning'); return; }
        try {
            const res = await fetch('/api/settings/output-dir', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dir: newDir })
            });
            const r = await res.json();
            if (r.success) { currentOutputDir = r.outputDir; updatePathLabel(); modal.classList.remove('active'); showToast('输出目录已更新', 'success'); }
            else showToast(r.error, 'error');
        } catch (err) { showToast(`保存失败：${err.message}`, 'error'); }
    });

    // 恢复默认
    resetBtn.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/settings/output-dir', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dir: './output' })
            });
            const r = await res.json();
            if (r.success) {
                currentOutputDir = r.outputDir;
                dirInput.value = currentOutputDir;
                previewDir.textContent = currentOutputDir;
                updatePathLabel(); showToast('已恢复默认', 'success');
            } else showToast(r.error, 'error');
        } catch (err) { showToast(`操作失败：${err.message}`, 'error'); }
    });
}

async function loadOutputDir() {
    try {
        const res = await fetch('/api/settings/output-dir');
        const r = await res.json();
        if (r.success) { currentOutputDir = r.outputDir; updatePathLabel(); }
    } catch (err) { console.warn('获取输出目录失败:', err); }
}

function updatePathLabel() {
    const label = document.getElementById('output-path-label');
    if (label) label.textContent = currentOutputDir;
}

// ===================== UI 工具函数 =====================
function showLoading(show, title, desc) {
    const modal = document.getElementById('loading-modal');
    const batchProgress = document.getElementById('batch-progress');
    if (show) {
        document.getElementById('loading-title').textContent = title || '正在转换';
        document.getElementById('loading-desc').textContent = desc || '请稍候...';
        batchProgress.style.display = 'none';
        modal.classList.add('active');
    } else {
        modal.classList.remove('active');
    }
}

function showBatchProgress(show, total) {
    const modal = document.getElementById('loading-modal');
    const batchProgress = document.getElementById('batch-progress');
    if (show) {
        document.getElementById('loading-title').textContent = '批量转换中';
        document.getElementById('loading-desc').textContent = '准备中...';
        batchProgress.style.display = 'flex';
        document.getElementById('progress-fill').style.width = '0%';
        document.getElementById('progress-text').textContent = `0/${total}`;
        modal.classList.add('active');
    } else {
        modal.classList.remove('active');
    }
}

function updateProgress(current, total, name) {
    const pct = ((current + 1) / total * 100);
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-text').textContent = `${current + 1}/${total}`;
    document.getElementById('loading-desc').textContent = name || '';
}

function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: 'ph-check-circle', error: 'ph-x-circle', warning: 'ph-warning', info: 'ph-info' };
    toast.innerHTML = `<i class="ph ${icons[type] || icons.info}"></i><span>${message}</span>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
