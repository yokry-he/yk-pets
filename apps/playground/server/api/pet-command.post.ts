/**
 * 文件职责 / File responsibility
 * 将演示聊天命令映射为宠物状态事件。
 * Maps demo chat commands to pet state events.
 */
import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod'

const PetCommandSchema = z.object({
  message: z.string().min(1).max(240),
  emotion: z.enum(['neutral', 'happy', 'curious', 'confused', 'sleepy', 'excited']),
  animation: z.enum(['idle', 'happy', 'curious', 'confused', 'sleepy', 'excited', 'thinking', 'greeting', 'playful', 'spinning', 'listening', 'jumping', 'flapping', 'resting']),
  action: z.object({
    type: z.enum(['none', 'toggle-theme', 'scroll-abilities', 'reveal-secret', 'sleep']),
    value: z.string().max(80),
  }),
})

type PetCommand = z.infer<typeof PetCommandSchema>

interface RequestBody {
  message?: string
  context?: {
    theme?: 'dark' | 'light'
    affection?: number
    secretUnlocked?: boolean
  }
}

export default defineEventHandler(async (event): Promise<PetCommand> => {
  const body = await readBody<RequestBody>(event)
  const message = body.message?.trim()

  if (!message) {
    throw createError({ statusCode: 400, statusMessage: '消息不能为空' })
  }

  if (message.length > 180) {
    throw createError({ statusCode: 400, statusMessage: '消息过长' })
  }

  const config = useRuntimeConfig(event)
  if (!config.openaiApiKey) {
    return createMockCommand(message)
  }

  try {
    const client = new OpenAI({ apiKey: config.openaiApiKey })
    const response = await client.responses.parse({
      model: config.openaiModel,
      input: [
        {
          role: 'system',
          content: [
            '你是 YK-PETS 中住在网页里的 3D 数字宠物云灵，英文名 Zeph，物种是一只云狐。',
            'YK-PETS 是产品品牌，云灵（Zeph）是你的名字，云狐是你的物种；不要把产品品牌当成你的名字。',
            '你的性格温柔、好奇、略带调皮。回复必须使用简体中文，保持 1 到 3 句，像角色对话而不是客服。',
            '根据用户意图选择一个动画与一个安全动作。',
            '可用动画包括 idle、happy、curious、confused、sleepy、excited、thinking、greeting、playful、spinning、listening、jumping、flapping、resting。',
            '用户让你打招呼时优先选择 greeting；让你玩、活泼一点时优先 playful；让你转圈时选择 spinning；让你跳跃时选择 jumping；让你扑腾、挥舞前爪时选择 flapping；让你趴下、伏下或短暂休息时选择 resting；当用户在倾诉、介绍自己或让你认真听时选择 listening。',
            '只有明确要求切换主题时选择 toggle-theme。',
            '询问能力时可选择 scroll-abilities。',
            '提到真正能力、隐藏模式、秘密或炫技时选择 reveal-secret。',
            '明确要求睡觉时选择 sleep。其他情况必须选择 none。',
            'value 没有参数需求时使用空字符串。',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            message,
            context: body.context || {},
          }),
        },
      ],
      text: {
        format: zodTextFormat(PetCommandSchema, 'pet_command'),
      },
      max_output_tokens: 320,
    })

    return response.output_parsed || createMockCommand(message)
  }
  catch (error) {
    console.error('[pet-command] OpenAI request failed:', error)
    return createMockCommand(message)
  }
})

function createMockCommand(message: string): PetCommand {
  const normalized = message.toLowerCase()

  if (/睡觉|睡吧|睡一会|晚安|休息一下|休息吧/.test(normalized)) {
    return {
      message: '好呀。我会把尾巴卷成一小团，等你叫醒我。',
      emotion: 'sleepy',
      animation: 'sleepy',
      action: { type: 'sleep', value: '' },
    }
  }

  if (/打招呼|招手|你好|hello|hi/.test(normalized)) {
    return {
      message: '嗨，我是云灵，英文名 Zeph，是一只住在网页里的云狐。耳朵上线，尾巴上线，先给你一个正式的招呼。',
      emotion: 'happy',
      animation: 'greeting',
      action: { type: 'none', value: '' },
    }
  }

  if (/转个圈|转圈|旋转|spin/.test(normalized)) {
    return {
      message: '收到，进入展示模式。注意看，我要开始转圈啦。',
      emotion: 'excited',
      animation: 'spinning',
      action: { type: 'none', value: '' },
    }
  }

  if (/跳一下|跳跃|跳起来|蹦一下|jump/.test(normalized)) {
    return {
      message: '收到。先压低重心，然后——起跳！',
      emotion: 'happy',
      animation: 'jumping',
      action: { type: 'none', value: '' },
    }
  }

  if (/扑腾|挥爪|挥动前爪|前爪/.test(normalized)) {
    return {
      message: '前爪动力系统上线，我要开始扑腾啦。',
      emotion: 'excited',
      animation: 'flapping',
      action: { type: 'none', value: '' },
    }
  }

  if (/趴下|伏下|趴一会|短暂休息/.test(normalized)) {
    return {
      message: '好，我趴一会儿。耳朵还会继续听着你。',
      emotion: 'sleepy',
      animation: 'resting',
      action: { type: 'none', value: '' },
    }
  }

  if (/玩|灵动|活泼|动起来|跳一跳/.test(normalized)) {
    return {
      message: '这就切换成玩耍模式。我会把尾巴、耳朵和前爪都一起调动起来。',
      emotion: 'happy',
      animation: 'playful',
      action: { type: 'none', value: '' },
    }
  }

  if (/听我说|认真听|靠近|听着/.test(normalized)) {
    return {
      message: '我在听，而且会靠近一点点。你继续说，我不会走神。',
      emotion: 'curious',
      animation: 'listening',
      action: { type: 'none', value: '' },
    }
  }

  if (/主题|颜色|亮色|暗色|深色/.test(normalized)) {
    return {
      message: '收到。我来给这个小世界换一种光线。',
      emotion: 'curious',
      animation: 'curious',
      action: { type: 'toggle-theme', value: '' },
    }
  }

  if (/真正|秘密|隐藏|炫技|爆发/.test(normalized)) {
    return {
      message: '那就别眨眼。我要暂时解除浏览器世界的稳定协议了。',
      emotion: 'excited',
      animation: 'excited',
      action: { type: 'reveal-secret', value: '' },
    }
  }

  if (/会什么|能力|功能|介绍/.test(normalized)) {
    return {
      message: '我是云灵（Zeph），一只云狐。我能感知你的操作、控制网页、切换情绪，还能把 AI 回复变成真实动作。往下看，我把能力矩阵展开给你。',
      emotion: 'excited',
      animation: 'excited',
      action: { type: 'scroll-abilities', value: '' },
    }
  }

  if (/醒|起来/.test(normalized)) {
    return {
      message: '已上线。耳朵、尾巴和好奇心都恢复工作了。',
      emotion: 'happy',
      animation: 'happy',
      action: { type: 'none', value: '' },
    }
  }

  return {
    message: '我听见了。虽然现在是本地模拟大脑，但我的动作、记忆和状态系统都是真实运行的。',
    emotion: 'curious',
    animation: 'listening',
    action: { type: 'none', value: '' },
  }
}
