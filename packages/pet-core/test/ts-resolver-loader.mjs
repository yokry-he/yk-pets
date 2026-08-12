/**
 * 文件职责 / File responsibility
 * 为 Node 类型擦除测试把无扩展名相对导入回退解析到同目录 `.ts` 文件。
 * Resolves extensionless relative imports to sibling `.ts` files for Node type-stripping tests.
 */
import { extname } from 'node:path'

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  }
  catch (error) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !extname(specifier)) {
      return nextResolve(`${specifier}.ts`, context)
    }
    throw error
  }
}
