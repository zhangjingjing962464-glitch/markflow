const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const wordConverter = require('./converters/word');
const urlConverter = require('./converters/url');
const textConverter = require('./converters/text');

const app = express();
const PORT = 3000;

// 中间件
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname)); // 服务前端静态文件

// 文件上传配置
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            cb(null, true);
        } else {
            cb(new Error('仅支持 .docx 格式的 Word 文件'));
        }
    }
});
// 判断是否在 Electron 打包环境中运行（asar 内无法写入文件）
const isPackaged = __dirname.includes('app.asar');

// 获取应用根目录（兼容 asar 打包）
const appRoot = isPackaged
    ? path.join(__dirname.replace('app.asar', 'app.asar.unpacked'))
    : __dirname;

// 输出根目录：打包后默认保存到用户文档目录
let outputDir = isPackaged
    ? path.join(require('os').homedir(), 'Documents', 'MarkFlow')
    : path.join(__dirname, 'output');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// 动态静态文件服务：让浏览器预览能加载 output 目录中的图片
// 使用自定义中间件而非 express.static，因为 outputDir 可被动态修改
app.use('/output-files', (req, res, next) => {
    const filePath = path.join(outputDir, decodeURIComponent(req.path));
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('文件未找到');
    }
});

/**
 * 获取当前生效的输出目录（支持 API 传入自定义路径覆盖默认值）
 */
function getOutputDir(customDir) {
    if (customDir && customDir.trim()) {
        const dir = customDir.trim();
        // 确保目录存在
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return dir;
    }
    return outputDir;
}

/**
 * API: 获取当前输出路径
 * GET /api/settings/output-dir
 */
app.get('/api/settings/output-dir', (req, res) => {
    res.json({ success: true, outputDir });
});

/**
 * API: 修改输出路径
 * POST /api/settings/output-dir
 */
app.post('/api/settings/output-dir', (req, res) => {
    try {
        const { dir } = req.body;
        if (!dir || !dir.trim()) {
            return res.status(400).json({ success: false, error: '路径不能为空' });
        }

        const newDir = path.resolve(dir.trim());

        // 验证路径合法性：尝试创建目录
        if (!fs.existsSync(newDir)) {
            fs.mkdirSync(newDir, { recursive: true });
        }

        // 验证路径可写
        const testFile = path.join(newDir, '.markflow_test');
        fs.writeFileSync(testFile, '', 'utf8');
        fs.unlinkSync(testFile);

        outputDir = newDir;
        console.log(`  📂  输出目录已更新: ${outputDir}`);
        res.json({ success: true, outputDir });
    } catch (err) {
        console.error('设置输出路径失败:', err);
        res.status(400).json({ success: false, error: `路径无效或无写入权限：${err.message}` });
    }
});

/**
 * API: 转换 Word 文件
 * POST /api/convert/word
 */
app.post('/api/convert/word', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: '未上传文件' });
        }
        // multer (busboy) 默认以 latin1 解析文件名，中文会乱码
        // 需要将 latin1 字节还原为 utf8
        const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        const dir = getOutputDir(req.body.outputDir);
        const result = await wordConverter.convert(req.file.buffer, originalName, dir);
        res.json({ success: true, data: result });
    } catch (err) {
        console.error('Word 转换失败:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * API: 转换 URL 文章
 * POST /api/convert/url
 */
app.post('/api/convert/url', async (req, res) => {
    try {
        const { url, outputDir: customDir } = req.body;
        if (!url) {
            return res.status(400).json({ success: false, error: '请提供文章链接' });
        }
        const dir = getOutputDir(customDir);
        const result = await urlConverter.convert(url, dir);
        res.json({ success: true, data: result });
    } catch (err) {
        console.error('URL 转换失败:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * API: 转换粘贴文本
 * POST /api/convert/text
 */
app.post('/api/convert/text', async (req, res) => {
    try {
        const { text, title, outputDir: customDir } = req.body;
        if (!text) {
            return res.status(400).json({ success: false, error: '请提供文本内容' });
        }
        const dir = getOutputDir(customDir);
        const result = await textConverter.convert(text, title, dir);
        res.json({ success: true, data: result });
    } catch (err) {
        console.error('文本转换失败:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * API: 保存编辑后的 Markdown
 * POST /api/save
 */
app.post('/api/save', async (req, res) => {
    try {
        const { markdown, folderName, outputDir: customDir } = req.body;
        if (!markdown || !folderName) {
            return res.status(400).json({ success: false, error: '缺少参数' });
        }
        const dir = getOutputDir(customDir);
        const outputFolder = path.join(dir, folderName);
        if (!fs.existsSync(outputFolder)) {
            fs.mkdirSync(outputFolder, { recursive: true });
        }
        const mdPath = path.join(outputFolder, `${folderName}.md`);
        fs.writeFileSync(mdPath, markdown, 'utf8');
        res.json({ success: true, message: '保存成功', path: mdPath });
    } catch (err) {
        console.error('保存失败:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 启动服务（支持 Electron 嵌入和独立运行两种模式）
function startServer(port = PORT) {
    return new Promise((resolve) => {
        const server = app.listen(port, () => {
            console.log(`\n  MarkFlow 服务已启动`);
            console.log(`  🌐  http://localhost:${port}`);
            console.log(`  📂  输出目录: ${outputDir}\n`);
            resolve(server);
        });
    });
}

// 导出供 Electron 主进程使用
module.exports = { app, startServer, getOutputDir };

// 如果直接运行（非 Electron），自动启动
if (require.main === module) {
    startServer();
}
