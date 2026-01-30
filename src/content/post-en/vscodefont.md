---
title: VSCode terminal display issues
description: This post showcases using the markdown admonition feature in Astro Cactus
publishDate: 12 Jul 2025
tags:
  - vscode
---
<!-- hash: pvfspm -->

> This article is machine-translated.

<iframe frameborder="no" border="0" marginwidth="0" marginheight="0" width=666 height=86 src="//music.163.com/outchain/player?type=2&id=22693858&auto=0&height=66"></iframe>

## Discovered
 While using the VSCode terminal, I found that it doesn't show the icon that should be there, it's a question mark box!
 ! [image.png](https://roim-picx-9nr.pages.dev/rest/26mYqVK.png)
 When opened in powershell, the normal display should look like this
 ! [image.png](https://roim-picx-9nr.pages.dev/rest/bHgyqVK.png)
 I honestly forgot when I configured this thing (why didn't I fix this before...)
## Resolved
Well, I asked ChatGPT about it and it said it was a font mismatch, so I changed the font of the VSCode terminal to match that of the Powershell terminal.

1. First open the terminal json

![image.png](https://roim-picx-9nr.pages.dev/rest/WqozqVK.png)

2. Then search for "Font".

! [image.png](https://roim-picx-9nr.pages.dev/rest/ohvzqVK.png)
Copy font name

3. Open the VSCode settings and search for "terminal.integrated.fontFamily".
Then open the json
! [image.png](https://roim-picx-9nr.pages.dev/rest/2CmARVK.png)
Fill in the name of the font
! [image.png](https://roim-picx-9nr.pages.dev/rest/dXeaRVK.png)
ctrl+s to save, you will see that the terminal has displayed the icon normally!
! [image.png](https://roim-picx-9nr.pages.dev/rest/rc7aRVK.png)

鹰

![Image_227565357857100.jpg](https://roim-picx-9nr.pages.dev/rest/HdUSkvK.jpeg)

