/**
 * Astro 翻译集成 - 构建时自动翻译文章和笔记
 */
import type { AstroIntegration } from "astro";
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { translateMarkdown, hashContent } from "../utils/translate";
import matter from "gray-matter";

interface ContentDir {
    source: string;
    output: string;
    name: string;
}

interface TranslateIntegrationOptions {
    /** 是否启用（可用于开发时禁用） */
    enabled?: boolean;
}

// 翻译缓存（内存中，避免重复翻译）
const translationCache = new Map<string, string>();

// 要翻译的内容目录
const contentDirs: ContentDir[] = [
    { source: "src/content/post", output: "src/content/post-en", name: "posts" },
    { source: "src/content/note", output: "src/content/note-en", name: "notes" },
];

async function translateDirectory(
    dir: ContentDir,
    apiKey: string,
    logger: { info: (msg: string) => void; error: (msg: string) => void; warn: (msg: string) => void }
) {
    const { source: sourceDir, output: outputDir, name } = dir;

    // 确保输出目录存在
    await mkdir(outputDir, { recursive: true });

    // 读取所有 markdown 文件
    let files: string[];
    try {
        files = await readdir(sourceDir);
    } catch {
        logger.warn(`Source directory ${sourceDir} not found, skipping ${name}`);
        return { translated: 0, skipped: 0 };
    }

    const mdFiles = files.filter((f) => f.endsWith(".md") || f.endsWith(".mdx"));

    let translated = 0;
    let skipped = 0;

    for (const file of mdFiles) {
        const sourcePath = join(sourceDir, file);
        const outputPath = join(outputDir, file);

        // 检查是否是目录
        const fileStat = await stat(sourcePath);
        if (fileStat.isDirectory()) {
            continue;
        }

        // 读取源文件
        const content = await readFile(sourcePath, "utf-8");
        const contentHash = hashContent(content);

        // 检查缓存
        if (translationCache.has(contentHash)) {
            await writeFile(outputPath, translationCache.get(contentHash)!);
            skipped++;
            continue;
        }

        // 检查输出文件是否已存在且是最新的
        try {
            const existingContent = await readFile(outputPath, "utf-8");
            const existingHash = existingContent.match(/<!-- hash: (\w+) -->/)?.[1];
            if (existingHash === contentHash) {
                skipped++;
                continue;
            }
        } catch {
            // 文件不存在，需要翻译
        }

        // 解析 frontmatter
        const { data: frontmatter, content: markdownContent } = matter(content);

        // 翻译内容
        logger.info(`Translating ${name}: ${file}`);
        const result = await translateMarkdown(markdownContent, { apiKey });

        if (!result.success) {
            logger.error(`Failed to translate ${file}: ${result.error}`);
            continue;
        }

        // 翻译标题和描述
        let translatedTitle = frontmatter.title;
        let translatedDescription = frontmatter.description;

        if (frontmatter.title) {
            const titleResult = await translateMarkdown(frontmatter.title as string, { apiKey });
            if (titleResult.success) {
                translatedTitle = titleResult.content?.trim();
            }
        }

        if (frontmatter.description) {
            const descResult = await translateMarkdown(frontmatter.description as string, { apiKey });
            if (descResult.success) {
                translatedDescription = descResult.content?.trim();
            }
        }

        // 构建翻译后的文件内容（过滤掉 undefined 值，否则 YAML 序列化会报错）
        const translatedFrontmatter: Record<string, unknown> = {
            ...frontmatter,
        };

        // 只有存在 title 时才覆盖
        if (translatedTitle !== undefined) {
            translatedFrontmatter.title = translatedTitle;
        }
        // 只有存在 description 时才覆盖
        if (translatedDescription !== undefined) {
            translatedFrontmatter.description = translatedDescription;
        }

        // 移除所有 undefined 值
        for (const key of Object.keys(translatedFrontmatter)) {
            if (translatedFrontmatter[key] === undefined) {
                delete translatedFrontmatter[key];
            }
        }

        const translatedContent = matter.stringify(
            `<!-- hash: ${contentHash} -->\n\n> This article is machine-translated and may contain errors. Please refer to the original Chinese version if anything is unclear.\n\n${result.content}`,
            translatedFrontmatter
        );

        // 写入文件
        await writeFile(outputPath, translatedContent);
        translationCache.set(contentHash, translatedContent);
        translated++;

        // 添加延迟避免 API 限流
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return { translated, skipped };
}

export function astroTranslate(options: TranslateIntegrationOptions = {}): AstroIntegration {
    const { enabled = true } = options;

    return {
        name: "astro-translate",
        hooks: {
            "astro:build:start": async ({ logger }) => {
                if (!enabled) {
                    logger.info("Translation integration is disabled");
                    return;
                }

                const apiKey = process.env.DEEPLX_API_KEY;
                if (!apiKey) {
                    logger.warn("DEEPLX_API_KEY not set, skipping translation");
                    return;
                }

                logger.info("Starting content translation...");

                let totalTranslated = 0;
                let totalSkipped = 0;

                for (const dir of contentDirs) {
                    try {
                        const result = await translateDirectory(dir, apiKey, logger);
                        totalTranslated += result.translated;
                        totalSkipped += result.skipped;
                    } catch (error) {
                        logger.error(`Error translating ${dir.name}: ${error}`);
                    }
                }

                logger.info(`Translation complete: ${totalTranslated} translated, ${totalSkipped} skipped`);
            },
        },
    };
}

export default astroTranslate;
