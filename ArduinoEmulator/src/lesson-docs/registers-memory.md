To understand what the CPU actually does, you need a map of where everything lives: your program, your variables, and the controls for the pins. The ATmega328P keeps these in separate memories, each with its own job.

## Two memories: Harvard architecture

A chip's **architecture** is the overall design of how it's organised. The ATmega328P uses a **Harvard architecture**: program and data live in completely separate memories, each with its own **bus** (the set of wires that carries data between memory and the CPU).

- **Program memory (flash)**: 32 KB holding your machine code. It is organized as 16,384 **words** of 16 bits, because AVR instructions are 16 bits wide (a few are 32). The **program counter (PC)** holds the address of the next instruction to run, and it counts in words.
- **Data memory**: everything the program reads and writes while it runs.

Because they are separate, the CPU can **fetch** (read) the next instruction at the same moment it reads or writes data. Most desktop processors instead use one shared memory for both, called a **von Neumann architecture**.

## The data memory map

Data memory is one long list of byte addresses, divided into regions:

| Addresses | Size | Holds |
|---|---|---|
| `0x0000`–`0x001F` | 32 bytes | The 32 general-purpose registers, R0 to R31 |
| `0x0020`–`0x005F` | 64 bytes | I/O registers: pins, timers, SREG, the stack pointer |
| `0x0060`–`0x00FF` | 160 bytes | Extended I/O registers for more peripherals |
| `0x0100`–`0x08FF` | 2048 bytes | SRAM: your variables and the stack |

The `0x` means the number is written in hexadecimal (see *From C++ to Machine Code*). **SREG** is the status register, covered in *The Status Register and Flags*, and **peripherals** are the extra pieces of hardware built into the chip, like its timers. Separate from all of this is the 1 KB **EEPROM**, reached through special registers.

## Registers: the CPU's workbench

The 32 **general-purpose registers**, R0 to R31, are where all arithmetic happens. The CPU can't add two values sitting in SRAM; it must first **load** them into registers, do the math there, and **store** the result back. That style is called a **load–store architecture**, and it is typical of **RISC** processors (a style of CPU built on lots of simple instructions; *What is an ISA?* explains it).

Some registers have special roles:

- **R26 to R31** pair up as three 16-bit **pointers** (registers that hold a memory address, "pointing" at a spot in memory): **X** (R27:R26), **Y** (R29:R28) and **Z** (R31:R30).
- **R16 to R31** are the only registers that can be loaded with a **constant** (a fixed number written right into the instruction) directly, using the `LDI` (load immediate) instruction.
- The compiler always keeps **R1** at zero, and uses **R24 and R25** to pass and return values.

## The stack

The **stack** is a region at the top of SRAM used for function calls and temporary storage. The **stack pointer (SP)**, an I/O register at `0x5D`–`0x5E`, holds the address of the next free byte. The startup code sets it to `0x08FF`, the very top. Putting a byte on the stack is called **pushing** it: the byte is stored at SP and then SP moves *down*. Taking one off is **popping**: SP moves up and the byte is read back.

Your global variables sit at the bottom of SRAM and the stack grows down from the top. If they ever meet, the stack overwrites your variables. On a chip with 2 KB, that is a real risk.

> [!TIP]
> Ohmster's debugger shows all 32 registers and the SP as your program runs. Registers that just changed are highlighted, so **stepping** (pressing Step to run just one instruction at a time) shows exactly what each instruction did.

## I/O registers: controlling hardware

The I/O registers look like memory, but each one is wired to a piece of hardware. Writing a byte to one doesn't just store a number; it changes a pin, starts a timer, or sets up a peripheral. That idea, called **memory-mapped I/O**, is the subject of the next lesson.

## Key ideas

- Harvard architecture: flash (program) and data memory are separate.
- The PC counts 16-bit words in flash.
- Data memory holds R0–R31, then I/O registers, then 2 KB of SRAM.
- Arithmetic only happens in registers: load, compute, store.
- The stack starts at the top of SRAM (0x08FF) and grows downward.

```quiz
Q: What is at data address 0x0000?
- [ ] The first instruction of your program
- [x] Register R0
- [ ] The stack pointer
- [ ] The first global variable
= The first 32 data addresses are the registers R0 to R31. Program instructions live in flash, a separate memory.

Q: The CPU needs to add two variables stored in SRAM. What must happen first?
- [ ] Nothing, ADD works directly on SRAM
- [x] Both values are loaded into registers
- [ ] They are copied to flash
- [ ] They are pushed onto the stack
= AVR is a load–store architecture: arithmetic instructions only work on registers, so values are loaded in first and the result stored back.

Q: When a byte is pushed onto the stack, which way does the stack pointer move?
- [ ] Up, to a higher address
- [x] Down, to a lower address
- [ ] It doesn't move
- [ ] It jumps to 0x0000
= The stack starts at the top of SRAM and grows downward, so every push lowers SP.
```
