// The Learn tab's course outline, from a first Arduino sketch up to the instruction set.
// Each lesson's text and quiz live in src/lesson-docs/<id>.md (see lessonDoc.ts for the format).
// Each lesson's `video` is a YouTube link or a file URL (e.g. '/videos/blink.mp4' in the public folder);
// `videoBy` credits whoever made it. The YouTube videos are by other creators, picked to go with each
// lesson until we record our own.

export interface Lesson {
  id: string
  title: string
  summary: string
  video?: string
  /** Who made the video, shown under it */
  videoBy?: string
}

export interface Unit {
  id: string
  title: string
  /** Color of the unit's LEDs on the course map */
  led: string
  lessons: Lesson[]
}

export const COURSE: Unit[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    led: '#ff4a3d',
    lessons: [
      {
        id: 'what-is-arduino',
        title: 'What is an Arduino?',
        summary: 'The board, the microcontroller on it, and what it can do.',
        video: 'https://www.youtube.com/watch?v=nL34zDTPkcs',
        videoBy: 'Afrotechmods',
      },
      {
        id: 'board-tour',
        title: 'A Tour of the Board',
        summary: 'Pins, power, USB and the parts you will use most.',
        video: 'https://www.youtube.com/watch?v=E-YKpx4ucds',
        videoBy: 'LittleBots',
      },
      {
        id: 'first-sketch',
        title: 'Your First Sketch: Blink',
        summary: 'Write, compile and run a program that blinks an LED.',
        video: 'https://www.youtube.com/watch?v=Bz_s3D96C5c',
        videoBy: 'Core Electronics',
      },
      {
        id: 'setup-loop',
        title: 'setup() and loop()',
        summary: 'How every Arduino program starts and keeps running.',
        video: 'https://www.youtube.com/watch?v=RDDa_YQsiHk',
        videoBy: 'Robotics Back-End',
      },
    ],
  },
  {
    id: 'electronics',
    title: 'Electronics Basics',
    led: '#ffb21e',
    lessons: [
      {
        id: 'ohms-law',
        title: 'Voltage, Current and Resistance',
        summary: "Ohm's law and why it matters for every circuit.",
        video: 'https://www.youtube.com/watch?v=HsLLq6Rm5tU',
        videoBy: 'The Engineering Mindset',
      },
      {
        id: 'leds-resistors',
        title: 'LEDs and Resistors',
        summary: 'Why an LED needs a resistor, and how to pick one.',
        video: 'https://www.youtube.com/watch?v=Bozb8t6d1Xk',
        videoBy: 'Kitronik',
      },
      {
        id: 'breadboards',
        title: 'Breadboards and Wiring',
        summary: 'How the rows and rails connect, and how to build a circuit.',
        video: 'https://www.youtube.com/watch?v=W6mixXsn-Vc',
        videoBy: 'LeftyMaker',
      },
      {
        id: 'buttons',
        title: 'Buttons and Pull-up Resistors',
        summary: 'Reading a button reliably as an input.',
        video: 'https://www.youtube.com/watch?v=SwbfG9MtGao',
        videoBy: 'Zero Amps',
      },
    ],
  },
  {
    id: 'programming',
    title: 'Programming the Arduino',
    led: '#3fdc6b',
    lessons: [
      {
        id: 'variables',
        title: 'Variables and Types',
        summary: 'Storing numbers, and how big each type is.',
        video: 'https://www.youtube.com/watch?v=xmZXWMEltEc',
        videoBy: 'SparkFun Electronics',
      },
      {
        id: 'digital-io',
        title: 'Digital Input and Output',
        summary: 'pinMode, digitalWrite and digitalRead.',
        video: 'https://www.youtube.com/watch?v=OZGMLOwHYf8',
        videoBy: 'Core Electronics',
      },
      {
        id: 'timing',
        title: 'Timing with delay() and millis()',
        summary: 'Waiting, and keeping time without stopping the program.',
        video: 'https://www.youtube.com/watch?v=IyxY1uQyY9U',
        videoBy: 'Programming Electronics Academy',
      },
      {
        id: 'control-flow',
        title: 'Conditions and Loops',
        summary: 'if, for and while on a microcontroller.',
        video: 'https://www.youtube.com/watch?v=PO1xuIb7dC4',
        videoBy: 'Code With Conner',
      },
      {
        id: 'functions',
        title: 'Functions',
        summary: 'Breaking a sketch into reusable pieces.',
        video: 'https://www.youtube.com/watch?v=xdesWQ85e5k',
        videoBy: 'logMaker360',
      },
    ],
  },
  {
    id: 'inside',
    title: 'Inside the Microcontroller',
    led: '#3f8dff',
    lessons: [
      {
        id: 'compiling',
        title: 'From C++ to Machine Code',
        summary: 'What compiling does, and what a .hex file holds.',
        video: 'https://www.youtube.com/watch?v=OVTu4XcmnwE',
        videoBy: 'Dark Mode Club',
      },
      {
        id: 'registers-memory',
        title: 'Registers and Memory',
        summary: 'The 32 registers, SRAM, flash, and I/O registers.',
        video: 'https://www.youtube.com/watch?v=mqv085ZjEXA',
        videoBy: 'Embedded system programming with AVR uC',
      },
      {
        id: 'io-ports',
        title: 'I/O Ports: DDR, PORT and PIN',
        summary: 'What digitalWrite really changes inside the chip.',
        video: 'https://www.youtube.com/watch?v=gJ_b4ura5Tw',
        videoBy: 'Ben Finio',
      },
      {
        id: 'timers-interrupts',
        title: 'Timers and Interrupts',
        summary: 'How millis() keeps counting in the background.',
        video: 'https://www.youtube.com/watch?v=m5_pFID-f-M',
        videoBy: 'eTech Tom',
      },
    ],
  },
  {
    id: 'isa',
    title: 'Instruction Set Architecture',
    led: '#e9e4ff',
    lessons: [
      {
        id: 'what-is-isa',
        title: 'What is an ISA?',
        summary: 'The contract between software and the processor.',
        video: 'https://www.youtube.com/watch?v=DJgZi0Bdp_g',
        videoBy: 'Matthew Watkins',
      },
      {
        id: 'fetch-execute',
        title: 'Fetch, Decode, Execute',
        summary: 'How the CPU works through a program one instruction at a time.',
        video: 'https://www.youtube.com/watch?v=jFDMZpkUWCw',
        videoBy: 'Computer Science Lessons',
      },
      {
        id: 'encoding',
        title: 'Instruction Formats and Encoding',
        summary: 'How opcodes and operands are packed into 16 bits.',
        video: 'https://www.youtube.com/watch?v=lHaW1MOlgnk',
        videoBy: 'CodeLucky',
      },
      {
        id: 'sreg',
        title: 'The Status Register and Flags',
        summary: 'Carry, zero, negative and how branches use them.',
        video: 'https://www.youtube.com/watch?v=7eaTT8PekE0',
        videoBy: 'Intermation',
      },
      {
        id: 'branches-stack',
        title: 'Branches, Calls and the Stack',
        summary: 'Jumping around a program and returning from functions.',
        video: 'https://www.youtube.com/watch?v=Q2sFmqvpBe0',
        videoBy: 'Computer Science Lessons',
      },
      {
        id: 'reading-disassembly',
        title: 'Reading Blink, Instruction by Instruction',
        summary: 'Step through a real program in the debugger.',
        video: 'https://www.youtube.com/watch?v=9e1wSQnttXY',
        videoBy: 'SteamCode',
      },
    ],
  },
]
