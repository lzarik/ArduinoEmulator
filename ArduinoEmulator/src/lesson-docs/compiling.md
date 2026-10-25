The ATmega328P can't read C++. It only understands **machine code**: numbers that each encode one simple instruction. Every time you press Compile, a chain of tools (called the **toolchain**) translates your sketch into those numbers. This lesson follows that chain.

## The toolchain

1. **Preprocess.** The Arduino tools tidy up your sketch before translating it. They add `#include <Arduino.h>`, a line that pulls in the Arduino library's list of functions. They write **declarations** for your functions (short notes telling the compiler each function exists). And they expand every `#include` and `#define` (shortcuts that paste in other files or swap one word for another).
2. **Compile.** The compiler, **avr-g++**, turns each C++ file into AVR machine code. It also optimizes: removing work that isn't needed and choosing fast instructions.
3. **Link.** The **linker** joins your code with the **Arduino core**: the library that provides `main()`, `pinMode`, `digitalWrite`, `delay`, `millis` and the rest. It decides where in flash each function will live.
4. **Output.** The result is an **.elf** file (machine code plus extra information such as function names and which line of your code each instruction came from) and a **.hex** file (just the bytes to put in flash).

Ohmster runs this same toolchain. The status label at the top of the screen shows each stage as it runs, and the **Hex file** view in the Code tab shows the result.

## Inside a .hex file

Machine code is almost always written in **hexadecimal** (hex for short): counting in 16s instead of 10s. Hex uses the digits 0 to 9 and then the letters A to F for 10 to 15. So hex `10` means 16, `1F` means 31, and `FF` means 255, the biggest number one byte can hold. Two hex digits always make exactly one byte, which is why programmers like it. In this course, a `0x` in front of a number (as in `0x25`) means it's written in hex.

A .hex file is plain text in the **Intel HEX** format, a standard way of writing bytes as text. Here is the first line of a compiled Blink:

```text
:100000000C945C000C946E000C946E000C946E00CA
```

It breaks down like this:

| Part | Value | Meaning |
|---|---|---|
| Start | `:` | Every record starts with a colon |
| Byte count | `10` | 16 data bytes on this line (hex 10 = 16) |
| Address | `0000` | Put them at flash address 0 |
| Type | `00` | A data record |
| Data | `0C945C00…6E00` | The 16 bytes of machine code |
| Checksum | `CA` | Lets the **loader** (the program copying the file onto the chip) detect a damaged line |

Every line of the file is one of these **records**, filling flash a chunk at a time. The last line, `:00000001FF`, marks the end.

## Reading the first instruction

Those first four bytes, `0C 94 5C 00`, are an instruction. AVR instructions are made of **words**: pairs of bytes read together as one 16-bit number. Each word is stored with its low byte (the right-hand half) first, so these bytes read as the two words `940C` and `005C`. That pattern is the **JMP** (jump) instruction, and `005C` is where it jumps to.

Address 0 is where the CPU starts when it is reset, so the very first thing every Arduino program does is jump to the startup code. The next several JMPs form the **interrupt vector table**, a list of where to go when hardware events happen (like a timer ticking or a pin changing). You will meet it again in *Timers and Interrupts*.

> [!TIP]
> Compile any sketch in Ohmster and look at the **Program** list in the debugger (the panel on the right of the Code tab). Each instruction shows its flash address, its name, and the line of your sketch it came from. Click one to highlight that line in the editor.

## Why the core is there

Even an empty sketch compiles to several hundred bytes. That is the Arduino core: startup code that sets up the stack and copies starting values for global variables into RAM, plus `init()`, which sets up Timer0 (the first of the chip's three built-in timers) so that `millis()` and `delay()` work. Your own code is usually the smaller part of the program.

## Key ideas

- The CPU only runs machine code: binary-encoded instructions.
- Compiling preprocesses, compiles (avr-g++), links in the Arduino core, and outputs .elf and .hex.
- A .hex file lists the bytes to place in flash, with an address and checksum on every line.
- The program starts at flash address 0, which holds a jump to the startup code.

```quiz
Q: What does the linker do?
- [ ] Checks your code for spelling mistakes
- [x] Joins your compiled code with the Arduino core and places every function in memory
- [ ] Uploads the program over USB
- [ ] Turns machine code back into C++
= The linker combines your code with library code like digitalWrite and decides each function's address in flash.

Q: In the record :100000000C945C00..., what does the 10 right after the colon mean?
- [ ] Line number 10
- [x] The record holds 16 data bytes
- [ ] Ten instructions
- [ ] Address 10
= The first field is the byte count, written in hexadecimal. Hex 10 is 16 in decimal.

Q: Why does every Arduino program start with a jump instruction at address 0?
- [x] The CPU starts at address 0 after reset, and the startup code lives elsewhere
- [ ] Jump instructions are required by the hex format
- [ ] It's a checksum
- [ ] To skip over your sketch
= Address 0 is the reset vector. The rest of the vector table follows it, so the startup code has to live further along in flash.
```
