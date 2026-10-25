An Arduino is a small **circuit board** (a flat board that holds electronic parts, with thin copper lines connecting them) built around a **microcontroller**: a complete computer squeezed onto a single **chip** (a small black package holding millions of tiny electronic switches). You write a program on your laptop, send it to the board, and the board runs that program by itself, over and over, for as long as it has power.

The board this course uses is the **Arduino Uno**. Its microcontroller is the black chip labelled *ATmega328P*. Almost everything else on the board exists to power that chip, connect it to your computer, and make its **pins** (the metal connection points that link the chip to other parts) easy to reach.

## A computer on one chip

Your laptop's processor, memory and storage are separate parts spread across a motherboard. A microcontroller puts all of them on one chip:

| Part | On the ATmega328P | What it holds |
|---|---|---|
| CPU | 8-bit AVR core, 16 MHz | Runs your program, one instruction at a time |
| Flash memory | 32 KB | Your program. It stays put when the power is off. |
| SRAM | 2 KB | Variables while the program runs. Wiped when the power goes off. |
| EEPROM | 1 KB | Small settings you want to keep between power-ups |
| I/O pins | 23 | Wires to the outside world: LEDs, buttons, sensors |

That table packs in a lot of new words, so here they are one at a time:

- **CPU** (central processing unit): the "brain" of the chip. It follows your program one **instruction** at a time, where an instruction is a single tiny step such as "add these two numbers" or "turn this pin on". The **core** is just another name for the CPU part of a chip.
- **Bit, byte and KB**: computers store everything as 0s and 1s. One 0-or-1 is a **bit**. Eight bits make a **byte**, which is enough to hold one small number (0 to 255) or one letter. A **KB** (kilobyte) is about a thousand bytes, so 32 KB is room for about 32,000 of them.
- **8-bit**: the CPU works on one byte at a time.
- **AVR**: the name of the family of chips the ATmega328P belongs to. Chips in the same family understand the same instructions.
- **Flash, SRAM and EEPROM**: three different kinds of memory. The names are technical; what matters is what each one holds, in the right-hand column.
- **Variables**: values your program remembers while it runs, like a score or a count. You'll write your own in *Variables and Types*.
- **I/O**: short for input/output, meaning anything going into or out of the chip.
- **LED**: a small light (short for light-emitting diode). **Sensor**: a part that measures something, like light or temperature.

Those numbers are tiny next to a laptop (which has millions of times more memory), and that is the point. A microcontroller is cheap, uses very little power, starts instantly, and does one job well: blink a light, read a sensor, run a motor, control a microwave.

> [!NOTE]
> Inside the chip, a **clock** sends out a steady tick that keeps everything in step, like a metronome. **16 MHz** (megahertz) means it ticks 16 million times a second. Most instructions finish in one tick, so the Uno runs roughly 16 million simple instructions every second.

## What it can do

A microcontroller talks to the world through its **pins**. A program can set a pin to 5 volts or 0 volts to switch something on or off (a **volt** measures electrical "push"; 5 volts is about what a phone charger gives, and you'll meet volts properly in *Voltage, Current and Resistance*), or read a pin to find out whether a button is pressed. Everything you will build in this course comes down to those two ideas: **output** (the chip drives a pin) and **input** (the chip reads a pin).

## How Ohmster fits in

Normally you would plug a real Uno into your computer with a USB cable and **upload** your program (copy it onto the board). Ohmster lets you do the whole thing in the browser:

1. You write a sketch (an Arduino program) in the **Code** tab.
2. Ohmster **compiles** it: it translates your code into **machine code**, the raw numbers that are the only thing the chip actually understands. It uses the same **compiler** (the translating program) as the **Arduino IDE**, the official app for writing Arduino code, so you get exactly what a real Uno would run.
3. An **emulator** (a program that imitates a piece of hardware) runs that machine code instruction by instruction, just as the ATmega328P would.
4. The **Design** tab shows the board and a **breadboard** (a board full of holes for building circuits without soldering), so the LEDs you wire up light up when your program turns them on.

Because Ohmster runs the real machine code, you can also pause and look inside the chip: its **registers** (a handful of tiny, super-fast storage slots inside the CPU), its memory, and which instruction it is on. By the end of this course you will be able to read those instructions yourself.

## Key ideas

- An Arduino Uno is a board built around the ATmega328P microcontroller.
- A microcontroller is a CPU, memory and I/O pins on one chip.
- Programs live in flash memory and run from the moment the board gets power.
- Pins are how the chip affects the world (output) and senses it (input).

```quiz
Q: What is the name of the microcontroller on the Arduino Uno?
- [ ] AVR-16
- [x] ATmega328P
- [ ] Uno R3
- [ ] ARM Cortex-M0
= The black chip on the Uno is the ATmega328P, made by Microchip (originally Atmel). "AVR" is the family of chips it belongs to.

Q: Where is your program stored, so that it is still there after the board loses power?
- [ ] SRAM
- [x] Flash memory
- [ ] The USB cable
- [ ] The CPU's registers
= Flash keeps its contents with the power off. SRAM holds variables while the program runs and is wiped when power is lost.

Q: The Uno's clock runs at 16 MHz. Roughly how many simple instructions can it run per second?
- [ ] 16 thousand
- [x] 16 million
- [ ] 16 billion
- [ ] 16
= 16 MHz is 16 million clock ticks per second, and most AVR instructions take a single tick.
```
