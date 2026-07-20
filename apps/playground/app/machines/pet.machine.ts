/**
 * 文件职责 / File responsibility
 * 宠物演示状态机与事件转换。
 * Pet demo state machine and event transitions.
 */
import { setup } from 'xstate'

export type PetMachineEvent =
  | { type: 'PET' }
  | { type: 'THINK' }
  | { type: 'TALK' }
  | { type: 'HAPPY' }
  | { type: 'EXCITED' }
  | { type: 'CONFUSED' }
  | { type: 'SLEEP' }
  | { type: 'WAKE' }
  | { type: 'GREET' }
  | { type: 'PLAY' }
  | { type: 'SPIN' }
  | { type: 'LISTEN' }
  | { type: 'JUMP' }
  | { type: 'FLAP' }
  | { type: 'REST' }

export const petMachine = setup({
  types: {
    events: {} as PetMachineEvent,
  },
}).createMachine({
  id: 'pet',
  initial: 'loading',

  on: {
    PET: '.happy',
    THINK: '.thinking',
    TALK: '.talking',
    HAPPY: '.happy',
    EXCITED: '.excited',
    CONFUSED: '.confused',
    SLEEP: '.sleeping',
    WAKE: '.waking',
    GREET: '.greeting',
    PLAY: '.playing',
    SPIN: '.spinning',
    LISTEN: '.listening',
    JUMP: '.jumping',
    FLAP: '.flapping',
    REST: '.resting',
  },

  states: {
    loading: {
      after: {
        450: 'waking',
      },
    },
    waking: {
      after: {
        900: 'idle',
      },
    },
    idle: {},
    thinking: {},
    talking: {
      after: {
        2600: 'idle',
      },
    },
    happy: {
      after: {
        1300: 'idle',
      },
    },
    excited: {
      after: {
        2400: 'idle',
      },
    },
    confused: {
      after: {
        1900: 'idle',
      },
    },
    greeting: {
      after: {
        1800: 'idle',
      },
    },
    playing: {
      after: {
        2200: 'idle',
      },
    },
    spinning: {
      after: {
        1700: 'idle',
      },
    },
    listening: {
      after: {
        2200: 'idle',
      },
    },
    jumping: {
      after: {
        1500: 'idle',
      },
    },
    flapping: {
      after: {
        1900: 'idle',
      },
    },
    resting: {
      after: {
        4200: 'idle',
      },
    },
    sleeping: {},
  },
})
