/**
 * 在普通网页中安装 YK-PETS 品牌与存储兼容层。
 * Installs the YK-PETS brand and storage compatibility bridge in host pages.
 */
import { installYkPetsCompatibility } from '../brand'

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_start',
  main() {
    installYkPetsCompatibility(document)
  },
})
