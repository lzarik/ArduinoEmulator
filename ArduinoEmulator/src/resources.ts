// The Resources tab on the home screen: other tools and sites worth knowing about, grouped by what
// you'd use them for. Each has one link and one short description.

export interface Resource {
  name: string
  url: string
  description: string
}

export interface ResourceGroup {
  title: string
  resources: Resource[]
}

export const RESOURCES: ResourceGroup[] = [
  {
    title: 'Simulate circuits',
    resources: [
      {
        name: 'EveryCircuit',
        url: 'https://everycircuit.com/',
        description: 'Build a circuit and watch current flow through it as moving dots, on your phone or in the browser.',
      },
      {
        name: 'Tinkercad Circuits',
        url: 'https://www.tinkercad.com/circuits',
        description: 'Drag an Arduino and parts onto a virtual breadboard and run real code, free in the browser.',
      },
      {
        name: 'Wokwi',
        url: 'https://wokwi.com/',
        description: 'Simulate Arduino, ESP32 and Raspberry Pi Pico projects with displays, sensors and motors.',
      },
      {
        name: 'Falstad Circuit Simulator',
        url: 'https://www.falstad.com/circuit/',
        description: 'A classic in-browser simulator that animates the voltages and currents in any circuit you draw.',
      },
    ],
  },
  {
    title: 'Build and make',
    resources: [
      {
        name: 'Thingiverse',
        url: 'https://www.thingiverse.com/',
        description: 'Free 3D-printable designs, including cases, mounts and enclosures for Arduino projects.',
      },
      {
        name: 'Fritzing',
        url: 'https://fritzing.org/',
        description: 'Draw your breadboard as it really looks, then turn it into a schematic or a circuit board.',
      },
      {
        name: 'KiCad',
        url: 'https://www.kicad.org/',
        description: 'Free, professional software for drawing schematics and designing your own circuit boards.',
      },
      {
        name: 'Arduino Project Hub',
        url: 'https://projecthub.arduino.cc/',
        description: 'Projects shared by the Arduino community, each with its wiring and the code to run it.',
      },
      {
        name: 'Instructables',
        url: 'https://www.instructables.com/circuits/',
        description: 'Step-by-step electronics builds from other makers, with photos, parts lists and code.',
      },
    ],
  },
  {
    title: 'Learn more',
    resources: [
      {
        name: 'Arduino Documentation',
        url: 'https://docs.arduino.cc/',
        description: 'The official reference for every Arduino function and board, plus the built-in examples.',
      },
      {
        name: 'SparkFun Learn',
        url: 'https://learn.sparkfun.com/',
        description: 'Beginner-friendly tutorials on electronics basics, from reading resistors to soldering.',
      },
      {
        name: 'Adafruit Learning System',
        url: 'https://learn.adafruit.com/',
        description: 'Thousands of project guides for electronics and microcontrollers, written for beginners.',
      },
    ],
  },
  {
    title: 'Video courses',
    resources: [
      {
        name: 'Intro to Arduino Course',
        url: 'https://www.youtube.com/watch?v=zJ-LqeX_fLU',
        description: "freeCodeCamp's four-hour beginner course on Arduino hardware, wiring and code.",
      },
      {
        name: 'Fusion 360 in 30 Days',
        url: 'https://www.youtube.com/playlist?list=PLrZ2zKOtC_-C4rWfapgngoe9o2-ng8ZBr',
        description: 'One short lesson a day for learning Autodesk Fusion and designing your own parts to 3D print.',
      },
      {
        name: "Ben Eater's 8-bit Computer",
        url: 'https://www.youtube.com/playlist?list=PLowKtXNTBypGqImE405J2565dvjafglHU',
        description: 'Build a working computer on breadboards, chip by chip, and see exactly how a CPU runs a program.',
      },
      {
        name: 'The 12 Hour Introduction to Computer Architecture',
        url: 'https://www.youtube.com/watch?v=rl0jkP9kOMw',
        description: 'Starts from 0s and 1s and builds up to a whole processor, assuming no prior knowledge.',
      },
    ],
  },
  {
    title: 'Go deeper',
    resources: [
      {
        name: 'Compiler Explorer',
        url: 'https://godbolt.org/',
        description: 'Type C++ and see the assembly it compiles to, including with the AVR compiler Arduino uses.',
      },
      {
        name: 'AVR Instruction Set Manual',
        url: 'https://ww1.microchip.com/downloads/en/DeviceDoc/AVR-InstructionSet-Manual-DS40002198.pdf',
        description: "Microchip's list of every instruction the Arduino's chip runs, with its encoding and the flags it sets.",
      },
    ],
  },
]

/** "everycircuit.com" from "https://everycircuit.com/", shown so you know where a link goes. */
export const siteOf = (url: string) => new URL(url).hostname.replace(/^www\d*\./, '')
