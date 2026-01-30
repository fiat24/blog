/**
 * 预构建翻译脚本 - 使用 DeepLX API（支持多 Key 轮询）
 * 优化版本：并行翻译 + 减少延迟
 * 使用方式: node scripts/translate.mjs
 * 环境变量: DEEPLX_API_KEYS (逗号分隔的多个 key)
 */
import { readFile, writeFile, mkdir, readdir, stat, rename } from "node:fs/promises";
import { join, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// 并行控制配置
const CONCURRENCY = 5; // 并行翻译的段落数
const DELAY_MS = 100; // 每次请求后的延迟（从300ms减少到100ms）

// 文件名映射：中文文件名 -> 英文文件名
const FILE_NAME_MAP = {
    "梦.md": "dream.md",
    "2025.07.29_梦.md": "2025.07.29_dream.md",
    // 可以在这里添加更多映射
};

// API Key 管理器（轮询）
class KeyManager {
    constructor(keys) {
        this.keys = keys;
        this.index = 0;
    }

    getNextKey() {
        const key = this.keys[this.index];
        this.index = (this.index + 1) % this.keys.length;
        return key;
    }
}

// 计算 hash
function hashContent(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

// 使用 DeepLX 翻译文本（支持重试和 key 轮询）
async function translateText(text, keyManager, retries = 3) {
    if (!text || text.trim().length === 0) return text;

    for (let i = 0; i < retries; i++) {
        const apiKey = keyManager.getNextKey();
        const url = `https://api.deeplx.org/${apiKey}/translate`;

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: text,
                    source_lang: "auto",
                    target_lang: "EN",
                }),
            });

            if (!response.ok) {
                console.error(`DeepLX error (key ${i + 1}): ${response.status}, trying next key...`);
                await new Promise(r => setTimeout(r, 500));
                continue;
            }

            const data = await response.json();

            if (data.code !== 200) {
                console.error(`DeepLX error: ${data.message || "Unknown error"}, trying next key...`);
                await new Promise(r => setTimeout(r, 500));
                continue;
            }

            return data.data;
        } catch (error) {
            console.error(`Translation error: ${error.message}, trying next key...`);
            await new Promise(r => setTimeout(r, 500));
        }
    }

    return null;
}

// 并行翻译多个文本块
async function translateBatch(texts, keyManager) {
    const results = [];

    // 分批处理，每批 CONCURRENCY 个
    for (let i = 0; i < texts.length; i += CONCURRENCY) {
        const batch = texts.slice(i, i + CONCURRENCY);
        const batchPromises = batch.map(async (text, idx) => {
            // 跳过不需要翻译的内容
            if (!text.trim() || text.startsWith("```") || text.startsWith("    ") || text.startsWith("<")) {
                return { index: i + idx, result: text };
            }

            const translated = await translateText(text, keyManager);
            return { index: i + idx, result: translated || text };
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // 批次间延迟
        if (i + CONCURRENCY < texts.length) {
            await new Promise(r => setTimeout(r, DELAY_MS));
        }
    }

    // 按原始顺序排序
    results.sort((a, b) => a.index - b.index);
    return results.map(r => r.result);
}

// 获取输出文件名
function getOutputFileName(inputFileName) {
    return FILE_NAME_MAP[inputFileName] || inputFileName;
}

// 翻译目录
async function translateDirectory(sourceDir, outputDir, keyManager) {
    const sourcePath = join(projectRoot, sourceDir);
    const outputPath = join(projectRoot, outputDir);

    await mkdir(outputPath, { recursive: true });

    let files;
    try {
        files = await readdir(sourcePath);
    } catch {
        console.log(`Source directory ${sourceDir} not found, skipping`);
        return;
    }

    const mdFiles = files.filter(f => f.endsWith(".md") || f.endsWith(".mdx"));
    console.log(`Found ${mdFiles.length} files to process in ${sourceDir}`);

    // 收集需要翻译的文件
    const filesToTranslate = [];

    for (const file of mdFiles) {
        const filePath = join(sourcePath, file);
        const outputFileName = getOutputFileName(file);
        const outPath = join(outputPath, outputFileName);

        const fileStat = await stat(filePath);
        if (fileStat.isDirectory()) continue;

        const content = await readFile(filePath, "utf-8");
        const contentHash = hashContent(content);

        // 检查是否已翻译
        try {
            const existing = await readFile(outPath, "utf-8");
            const existingHash = existing.match(/<!-- hash: (\w+) -->/)?.[1];
            // 如果已有缓存且内容一致，跳过
            if (existingHash === contentHash) {
                console.log(`Skip (cached): ${file} -> ${outputFileName}`);
                continue;
            }
        } catch {
            // 文件不存在
        }

        filesToTranslate.push({ file, filePath, outPath, content, contentHash, outputFileName });
    }

    console.log(`Need to translate ${filesToTranslate.length} files`);

    // 翻译文件
    for (const { file, outPath, content, contentHash, outputFileName } of filesToTranslate) {
        console.log(`Translating: ${file} -> ${outputFileName}`);

        try {
            // 使用 gray-matter 解析
            const parsed = matter(content);
            const { data: frontmatter, content: body } = parsed;

            // Ensure required fields exist and have correct types
            if (!Array.isArray(frontmatter.tags)) {
                frontmatter.tags = [];
            }
            if (typeof frontmatter.title !== 'string') {
                frontmatter.title = '';
            }
            if (typeof frontmatter.description !== 'string') {
                frontmatter.description = '';
            }

            // 分割段落
            const paragraphs = body.split(/\n\n+/);

            // 并行翻译所有段落
            const translatedParagraphs = await translateBatch(paragraphs, keyManager);
            const translatedBody = translatedParagraphs.join("\n\n");

            // 并行翻译标题和描述
            const [translatedTitle, translatedDesc] = await Promise.all([
                frontmatter.title ? translateText(frontmatter.title, keyManager) : Promise.resolve(null),
                frontmatter.description ? translateText(frontmatter.description, keyManager) : Promise.resolve(null),
            ]);

            if (translatedTitle) frontmatter.title = translatedTitle.replace(/\n/g, " ").trim();
            if (translatedDesc) frontmatter.description = translatedDesc.replace(/\n/g, " ").trim();

            // 添加哈希和提示
            const finalContent = `<!-- hash: ${contentHash} -->\n\n> This article is machine-translated.\n\n${translatedBody}`;

            // 使用 gray-matter 生成及保存
            const finalFile = matter.stringify(finalContent, frontmatter);
            await writeFile(outPath, finalFile);
            console.log(`Done: ${file} -> ${outputFileName}`);

        } catch (e) {
            console.error(`Failed to process ${file}: ${e.message}`);
        }
    }
}

// 主函数
async function main() {
    const startTime = Date.now();

    // 支持逗号分隔的多个 key
    const keysEnv = process.env.DEEPLX_API_KEYS || process.env.DEEPLX_API_KEY;

    if (!keysEnv) {
        console.log("DEEPLX_API_KEYS not set, skipping translation");
        return;
    }

    const keys = keysEnv.split(",").map(k => k.trim()).filter(k => k);
    console.log(`Starting translation with DeepLX (${keys.length} API keys)...`);
    console.log(`Concurrency: ${CONCURRENCY}, Delay: ${DELAY_MS}ms`);

    const keyManager = new KeyManager(keys);

    await translateDirectory("src/content/post", "src/content/post-en", keyManager);
    await translateDirectory("src/content/note", "src/content/note-en", keyManager);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Translation complete! (${elapsed}s)`);
}

main().catch(console.error);
