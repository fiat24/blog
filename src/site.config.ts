import type { SiteConfig } from "@/types";
import type { AstroExpressiveCodeOptions } from "astro-expressive-code";

export const siteConfig: SiteConfig = {
	// Used as both a meta property (src/components/BaseHead.astro L:31 + L:49) & the generated satori png (src/pages/og-image/[slug].png.ts)
	author: "Faust",
	// Date.prototype.toLocaleDateString() parameters, found in src/utils/date.ts.
	date: {
		locale: "zh-CN",
		options: {
			day: "numeric",
			month: "narrow",
			year: "numeric",
		},
	},
	// Used as the default description meta property and webmanifest description
	description: "Faust",
	// HTML lang property, found in src/layouts/Base.astro L:18 & astro.config.ts L:48
	lang: "en",
	// Meta property, found in src/components/BaseHead.astro L:42
	ogLocale: "en_US",
	// Used to construct the meta title property found in src/components/BaseHead.astro L:11, and webmanifest name found in astro.config.ts L:42
	title: "Faust",
	// Used to generate deployment URLs
	url: "https://blog-zeta-one-12.vercel.app",
};

// Used to generate links in both the Header & Footer.
export const menuLinks: { path: string; title: string }[] = [
	// 修改：改为中文
	{
		path: "/",
		title: "主页",
	},
	{
		path: "/about/",
		title: "关于",
	},
	{
		path: "/posts/",
		title: "博客",
	},
	{
		path: "/notes/",
		title: "笔记",
	},
];

// https://expressive-code.com/reference/configuration/
export const expressiveCodeOptions: AstroExpressiveCodeOptions = {
	styleOverrides: {
		borderRadius: "4px",
		borderColor: "hsl(var(--theme-border))",
		codeFontFamily:
			'"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;',
		codeFontSize: "0.875rem",
		codeLineHeight: "1.7142857rem",
		codePaddingInline: "1rem",
		codeBackground: "var(--academia-bg-alt)",
		frames: {
			frameBoxShadowCssValue: "none",
			editorActiveTabBackground: "var(--academia-bg-alt)",
			editorActiveTabForeground: "hsl(var(--theme-text))",
			editorTabBarBackground: "hsl(var(--theme-muted))",
			editorTabBarBorderBottomColor: "hsl(var(--theme-border))",
			terminalBackground: "var(--academia-bg-alt)",
			terminalTitlebarBackground: "hsl(var(--theme-muted))",
			terminalTitlebarBorderBottomColor: "hsl(var(--theme-border))",
			tooltipSuccessBackground: "var(--academia-brass)",
		},
		uiLineHeight: "inherit",
	},
	themeCssSelector(theme, { styleVariants }) {
		// If one dark and one light theme are available
		// generate theme CSS selectors compatible with cactus-theme dark mode switch
		if (styleVariants.length >= 2) {
			const baseTheme = styleVariants[0]?.theme;
			const altTheme = styleVariants.find((v) => v.theme.type !== baseTheme?.type)?.theme;
			if (theme === baseTheme || theme === altTheme) return `[data-theme='${theme.type}']`;
		}
		// return default selector
		return `[data-theme="${theme.name}"]`;
	},
	// One dark, one light theme => https://expressive-code.com/guides/themes/#available-themes
	themes: ["vitesse-dark", "vitesse-light"],
	useThemedScrollbars: false,
};
